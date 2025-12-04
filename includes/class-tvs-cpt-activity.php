<?php
/**
 * Registers the tvs_activity CPT
 */
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class TVS_CPT_Activity {
    public function __construct() {
        add_action( 'init', array( $this, 'register_post_type' ) );
        add_action( 'save_post_tvs_activity', array( $this, 'save_meta' ), 10, 2 );
        add_action( 'add_meta_boxes', array( $this, 'add_meta_boxes' ) );
    }

    public function register_post_type() {
        $labels = array(
            'name' => __( 'Activities', 'tvs-virtual-sports' ),
            'singular_name' => __( 'Activity', 'tvs-virtual-sports' ),
        );

        register_post_type( 'tvs_activity', array(
            'labels' => $labels,
            'public' => false, // not publicly listed
            'publicly_queryable' => true, // allow direct viewing by URL
            'exclude_from_search' => true,
            'show_ui' => true,
            'show_in_rest' => true,
            'query_var' => 'tvs_activity', // explicit query var to avoid rewrite ambiguity
            'supports' => array( 'title' ),
            'has_archive' => false,
            'rewrite' => array( 'slug' => 'activity', 'with_front' => false ),
        ) );

        // Register activity meta keys and expose to REST API
        // String fields
        $string_fields = array('route_id','started_at','ended_at','synced_strava','strava_activity_id','activity_type','source','route_name','activity_date');
        foreach ( $string_fields as $meta_key ) {
            register_post_meta( 'tvs_activity', $meta_key, array(
                'show_in_rest' => true,
                'single' => true,
                'type' => 'string',
                'sanitize_callback' => 'sanitize_text_field',
            ) );
        }
        
        // Number fields (integer)
        $integer_fields = array('duration_s','distance_m','avg_hr','max_hr','perceived_exertion','rating');
        foreach ( $integer_fields as $meta_key ) {
            register_post_meta( 'tvs_activity', $meta_key, array(
                'show_in_rest' => true,
                'single' => true,
                'type' => 'integer',
                'sanitize_callback' => 'absint',
            ) );
        }
        
        // Text field (can be long)
        register_post_meta( 'tvs_activity', 'notes', array(
            'show_in_rest' => true,
            'single' => true,
            'type' => 'string',
            'sanitize_callback' => 'sanitize_textarea_field',
        ) );
        
        // Visibility with stricter control (only authors/admins can update)
        register_post_meta( 'tvs_activity', 'visibility', array(
            'show_in_rest' => true,
            'single' => true,
            'type' => 'string',
            'sanitize_callback' => 'sanitize_text_field',
            'auth_callback' => function() {
                if ( ! current_user_can( 'edit_post', get_the_ID() ) ) { return false; }
                return true;
            },
            'default' => 'private',
        ) );
    }

    public function save_meta( $post_id, $post ) {
        // Security checks
        if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
            return;
        }
        if ( wp_is_post_revision( $post_id ) ) {
            return;
        }

        if ( empty( $_POST['tvs_activity_meta_nonce'] ) || ! wp_verify_nonce( wp_unslash( $_POST['tvs_activity_meta_nonce'] ), 'tvs_save_activity_meta' ) ) {
            return;
        }

        if ( ! current_user_can( 'edit_post', $post_id ) ) {
            return;
        }

        $keys = array(
            'route_id', 'route_name', 'activity_date', 'started_at', 'ended_at', 'duration_s', 'distance_m', 'avg_hr', 'max_hr', 'perceived_exertion', 'synced_strava', 'strava_activity_id', 'visibility', 'rating', 'notes', 'activity_type', 'source'
        );

        if ( isset( $_POST['tvs_activity_meta'] ) && is_array( $_POST['tvs_activity_meta'] ) ) {
            foreach ( $keys as $k ) {
                if ( isset( $_POST['tvs_activity_meta'][ $k ] ) ) {
                    update_post_meta( $post_id, $k, sanitize_text_field( wp_unslash( $_POST['tvs_activity_meta'][ $k ] ) ) );
                }
            }
        }

        // Mirror underscore-prefixed Strava sync fields into human-readable ones if they exist (legacy compatibility)
        $legacy_synced = get_post_meta( $post_id, '_tvs_synced_strava', true );
        if ( $legacy_synced !== '' && get_post_meta( $post_id, 'synced_strava', true ) === '' ) {
            update_post_meta( $post_id, 'synced_strava', $legacy_synced );
        }
        $legacy_remote = get_post_meta( $post_id, '_tvs_strava_remote_id', true );
        if ( $legacy_remote !== '' && get_post_meta( $post_id, 'strava_activity_id', true ) === '' ) {
            update_post_meta( $post_id, 'strava_activity_id', $legacy_remote );
        }

        // Automatically set a friendly title and numeric slug per requirements
        // Title format: "Fullført {ended_at date - time}" (fallback to current time if missing)
        $post = get_post( $post_id );
        if ( $post && 'tvs_activity' === $post->post_type ) {
            $ended_at = get_post_meta( $post_id, 'ended_at', true );
            $timestamp = $ended_at ? strtotime( $ended_at ) : current_time( 'timestamp' );
            if ( $timestamp ) {
                $title = sprintf( __( 'Fullført %s', 'tvs-virtual-sports' ), date_i18n( 'j. F Y – H:i', $timestamp ) );
            } else {
                $title = sprintf( __( 'Fullført %s', 'tvs-virtual-sports' ), date_i18n( 'j. F Y – H:i', current_time( 'timestamp' ) ) );
            }

            // Update title if empty or set to an auto-draft/placeholder
            $should_update_title = ( empty( $post->post_title ) || 'auto-draft' === $post->post_status );

            // Always enforce numeric slug == post ID once (if not already)
            $desired_slug = (string) $post_id;
            $should_update_slug = ( $post->post_name !== $desired_slug );

            if ( $should_update_title || $should_update_slug ) {
                // Prevent infinite save loop
                remove_action( 'save_post_tvs_activity', array( $this, 'save_meta' ), 10 );
                wp_update_post( array(
                    'ID'         => $post_id,
                    'post_title' => $should_update_title ? $title : $post->post_title,
                    'post_name'  => $desired_slug,
                ) );
                add_action( 'save_post_tvs_activity', array( $this, 'save_meta' ), 10, 2 );
            }
        }
    }

    public function add_meta_boxes() {
        add_meta_box(
            'tvs_activity_meta',
            __( 'Activity details', 'tvs-virtual-sports' ),
            array( $this, 'render_meta_box' ),
            'tvs_activity',
            'normal',
            'default'
        );
    }

    public function render_meta_box( $post ) {
        wp_nonce_field( 'tvs_save_activity_meta', 'tvs_activity_meta_nonce' );

        $keys = array('route_id','started_at','ended_at','duration_s','distance_m','avg_hr','max_hr','perceived_exertion','synced_strava','strava_activity_id','visibility');
        echo '<div class="tvs-activity-meta">';
        foreach ( $keys as $k ) {
            $val_raw = get_post_meta( $post->ID, $k, true );
            // Fallback for legacy underscore-prefixed Strava meta if not yet mirrored
            if ( $val_raw === '' ) {
                if ( $k === 'synced_strava' ) {
                    $val_raw = get_post_meta( $post->ID, '_tvs_synced_strava', true );
                } elseif ( $k === 'strava_activity_id' ) {
                    $val_raw = get_post_meta( $post->ID, '_tvs_strava_remote_id', true );
                }
            }

            // Skip visibility here; custom select rendered separately to avoid duplicate IDs
            if ( $k === 'visibility' ) {
                continue;
            }

            $label = esc_html( str_replace( '_', ' ', $k ) );

            // Detect datetime fields and format for datetime-local input
            $is_datetime = in_array( $k, array( 'started_at', 'ended_at', 'activity_date' ), true );
            $input_type  = $is_datetime ? 'datetime-local' : 'text';
            $display_val = $val_raw;
            if ( $is_datetime && ! empty( $val_raw ) ) {
                $ts = strtotime( $val_raw );
                if ( $ts ) {
                    // HTML datetime-local requires no timezone designator; use site local time
                    $display_val = date( 'Y-m-d\TH:i', $ts );
                }
            }

            printf(
                '<p><label for="tvs_activity_meta_%1$s">%2$s</label><br/><input type="%5$s" id="tvs_activity_meta_%1$s" name="tvs_activity_meta[%1$s]" value="%3$s" class="widefat" %4$s /></p>',
                esc_attr( $k ),
                esc_html( ucfirst( $label ) ),
                esc_attr( $display_val ),
                $is_datetime ? 'step="60"' : '',
                esc_attr( $input_type )
            );
        }

        // Visibility selector (private/public)
        $visibility = get_post_meta( $post->ID, 'visibility', true );
        if ( $visibility !== 'public' ) { $visibility = 'private'; }
        echo '<p><label for="tvs_activity_meta_visibility"><strong>' . esc_html__( 'Visibility', 'tvs-virtual-sports' ) . '</strong></label><br/>';
        echo '<select id="tvs_activity_meta_visibility" name="tvs_activity_meta[visibility]" class="widefat">';
        echo '<option value="private"' . selected( $visibility, 'private', false ) . '>' . esc_html__( 'Private (only you)', 'tvs-virtual-sports' ) . '</option>';
        echo '<option value="public"' . selected( $visibility, 'public', false ) . '>' . esc_html__( 'Public (shareable link)', 'tvs-virtual-sports' ) . '</option>';
        echo '</select></p>';
        echo '<p class="description">' . esc_html__( 'Activity meta: set started/ended timestamps, duration (s), distance (m), heart rate etc.', 'tvs-virtual-sports' ) . '</p>';
        // Strava quick link if synced
        $remote_id = get_post_meta( $post->ID, '_tvs_strava_remote_id', true );
        if ( $remote_id ) {
            $url = 'https://www.strava.com/activities/' . rawurlencode( $remote_id );
            echo '<p><a href="' . esc_url( $url ) . '" target="_blank" rel="noopener" style="font-weight:600;">' . esc_html__( 'View on Strava →', 'tvs-virtual-sports' ) . '</a></p>';
        }
        echo '</div>';
    }
}

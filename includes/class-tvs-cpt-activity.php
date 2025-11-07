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

        // Register activity meta keys and expose to REST
        $keys = array('route_id','started_at','ended_at','duration_s','distance_m','avg_hr','max_hr','perceived_exertion','synced_strava','strava_activity_id');
        foreach ( $keys as $meta_key ) {
            register_post_meta( 'tvs_activity', $meta_key, array(
                'show_in_rest' => true,
                'single' => true,
                'type' => 'string',
                'sanitize_callback' => 'sanitize_text_field',
            ) );
        }
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
            'route_id', 'started_at', 'ended_at', 'duration_s', 'distance_m', 'avg_hr', 'max_hr', 'perceived_exertion', 'synced_strava', 'strava_activity_id'
        );

        if ( isset( $_POST['tvs_activity_meta'] ) && is_array( $_POST['tvs_activity_meta'] ) ) {
            foreach ( $keys as $k ) {
                if ( isset( $_POST['tvs_activity_meta'][ $k ] ) ) {
                    update_post_meta( $post_id, $k, sanitize_text_field( wp_unslash( $_POST['tvs_activity_meta'][ $k ] ) ) );
                }
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

        $keys = array('route_id','started_at','ended_at','duration_s','distance_m','avg_hr','max_hr','perceived_exertion','synced_strava','strava_activity_id');
        echo '<div class="tvs-activity-meta">';
        foreach ( $keys as $k ) {
            $val = get_post_meta( $post->ID, $k, true );
            $label = esc_html( str_replace( '_', ' ', $k ) );
            printf(
                '<p><label for="tvs_activity_meta_%1$s">%2$s</label><br/><input type="text" id="tvs_activity_meta_%1$s" name="tvs_activity_meta[%1$s]" value="%3$s" class="widefat"/></p>',
                esc_attr( $k ),
                esc_html( ucfirst( $label ) ),
                esc_attr( $val )
            );
        }
        echo '<p class="description">' . esc_html__( 'Activity meta: set started/ended timestamps, duration (s), distance (m), heart rate etc.', 'tvs-virtual-sports' ) . '</p>';
        echo '</div>';
    }
}

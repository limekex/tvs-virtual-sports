<?php
/**
 * Registers the tvs_route CPT
 */
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class TVS_CPT_Route {
    public function __construct() {
        add_action( 'init', array( $this, 'register_post_type' ) );
        add_action( 'save_post_tvs_route', array( $this, 'save_meta' ), 10, 2 );
        add_action( 'add_meta_boxes', array( $this, 'add_meta_boxes' ) );
    }

    public function register_post_type() {
        $labels = array(
            'name' => __( 'Routes', 'tvs-virtual-sports' ),
            'singular_name' => __( 'Route', 'tvs-virtual-sports' ),
        );

        register_post_type( 'tvs_route', array(
            'labels' => $labels,
            'public' => true,
            'show_in_rest' => true,
            'supports' => array( 'title', 'editor', 'thumbnail' ),
            'has_archive' => false,
            'rewrite' => array( 'slug' => 'routes' ),
        ) );

        // Register route meta keys and expose to REST
        foreach ( tvs_route_meta_keys() as $meta_key ) {
            register_post_meta( 'tvs_route', $meta_key, array(
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

        // Verify nonce
        if ( empty( $_POST['tvs_route_meta_nonce'] ) || ! wp_verify_nonce( wp_unslash( $_POST['tvs_route_meta_nonce'] ), 'tvs_save_route_meta' ) ) {
            return;
        }

        // Capability check
        if ( ! current_user_can( 'edit_post', $post_id ) ) {
            return;
        }

        // Expecting meta in $_POST['tvs_route_meta'] as an array
        if ( isset( $_POST['tvs_route_meta'] ) && is_array( $_POST['tvs_route_meta'] ) ) {
            $meta = tvs_sanitize_route_meta( $_POST['tvs_route_meta'] );
            foreach ( $meta as $k => $v ) {
                update_post_meta( $post_id, $k, $v );
            }
        }
    }

    /**
     * Register meta boxes for routes
     */
    public function add_meta_boxes() {
        add_meta_box(
            'tvs_route_meta',
            __( 'Route details', 'tvs-virtual-sports' ),
            array( $this, 'render_meta_box' ),
            'tvs_route',
            'normal',
            'default'
        );
    }

    /**
     * Render the route meta box
     */
    public function render_meta_box( $post ) {
        // Add nonce for security
        wp_nonce_field( 'tvs_save_route_meta', 'tvs_route_meta_nonce' );

        $values = array();
        foreach ( tvs_route_meta_keys() as $k ) {
            $values[ $k ] = get_post_meta( $post->ID, $k, true );
        }

        echo '<div class="tvs-route-meta">';
        foreach ( $values as $k => $v ) {
            $label = esc_html( str_replace( '_', ' ', $k ) );
            printf(
                '<p><label for="tvs_route_meta_%1$s">%2$s</label><br/><input type="text" id="tvs_route_meta_%1$s" name="tvs_route_meta[%1$s]" value="%3$s" class="widefat"/></p>',
                esc_attr( $k ),
                esc_html( ucfirst( $label ) ),
                esc_attr( $v )
            );
        }
        echo '<p class="description">' . esc_html__( 'Enter route details (distance in meters, duration in seconds, GPX URL, Vimeo ID, etc.)', 'tvs-virtual-sports' ) . '</p>';
        echo '</div>';
    }
}

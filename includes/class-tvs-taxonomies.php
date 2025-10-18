<?php
/**
 * Registers taxonomies: tvs_region and tvs_activity_type
 */
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class TVS_Taxonomies {
    public function __construct() {
        add_action( 'init', array( $this, 'register_taxonomies' ) );
    }

    public function register_taxonomies() {
        // tvs_region hierarchical
        $labels = array(
            'name' => __( 'Regions', 'tvs-virtual-sports' ),
            'singular_name' => __( 'Region', 'tvs-virtual-sports' ),
        );
        register_taxonomy( 'tvs_region', array( 'tvs_route' ), array(
            'hierarchical' => true,
            'labels' => $labels,
            'show_in_rest' => true,
        ) );

        // tvs_activity_type flat (run|ride|walk)
        $labels2 = array(
            'name' => __( 'Activity Types', 'tvs-virtual-sports' ),
            'singular_name' => __( 'Activity Type', 'tvs-virtual-sports' ),
        );
        register_taxonomy( 'tvs_activity_type', array( 'tvs_activity' ), array(
            'hierarchical' => false,
            'labels' => $labels2,
            'show_in_rest' => true,
        ) );

        // Pre-populate activity types (if desired) - TODO: Only run once on activation
        if ( ! term_exists( 'run', 'tvs_activity_type' ) ) {
            wp_insert_term( 'run', 'tvs_activity_type' );
            wp_insert_term( 'ride', 'tvs_activity_type' );
            wp_insert_term( 'walk', 'tvs_activity_type' );
        }
    }
}

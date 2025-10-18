<?php
/**
 * Frontend helpers: shortcode and script injection
 */
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class TVS_Frontend {
    public function __construct() {
        add_shortcode( 'tvs_route', array( $this, 'shortcode_route' ) );
    }

    public function shortcode_route( $atts ) {
        $atts = shortcode_atts( array( 'id' => 0 ), $atts, 'tvs_route' );
        $id = intval( $atts['id'] );
        if ( ! $id ) {
            return '<p>' . esc_html__( 'No route specified', 'tvs-virtual-sports' ) . '</p>';
        }

        // Prepare payload
        $rest = new TVS_REST();
        $payload = $rest->prepare_route_response( $id );

        // Enqueue script and inline data
        wp_enqueue_script( 'tvs-app' );
        $json = wp_json_encode( $payload );
        $inline = sprintf( "window.tvs_route_payload = %s;", $json );
        wp_add_inline_script( 'tvs-app', $inline, 'before' );

        // Render mount point
        $out = '<div id="tvs-app-root" data-route-id="' . esc_attr( $id ) . '"></div>';
        return $out;
    }
}

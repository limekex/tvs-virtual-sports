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

    /* public function shortcode_route( $atts ) {
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
    } */
   public function shortcode_route( $atts ) {
    $atts = shortcode_atts( array( 'id' => 0 ), $atts, 'tvs_route' );
    $id   = absint( $atts['id'] );

    // Fallback: bruk gjeldende post (single-visning)
    if ( ! $id ) {
        $id = get_the_ID();
        if ( ! $id ) {
            $id = get_queried_object_id();
        }
    }

    if ( ! $id ) {
        return '<p>' . esc_html__( 'No route found', 'tvs-virtual-sports' ) . '</p>';
    }

    $post = get_post( $id );
    if ( ! $post || 'tvs_route' !== $post->post_type ) {
        return '<p>' . esc_html__( 'Invalid route', 'tvs-virtual-sports' ) . '</p>';
    }

    // Forbered payload
    if ( ! class_exists( 'TVS_REST' ) ) {
        return '<p>' . esc_html__( 'Route API unavailable', 'tvs-virtual-sports' ) . '</p>';
    }

    $rest    = new TVS_REST();
    $payload = $rest->get_route_payload( $id );
    if ( is_wp_error( $payload ) || empty( $payload ) ) {
        return '<p>' . esc_html__( 'Could not load route data', 'tvs-virtual-sports' ) . '</p>';
    }

    // Sørg for at skriptet finnes (registrert) og enqueue det
if ( ! wp_script_is( 'tvs-app', 'registered' ) ) {
    // optional fallback hvis temaet ikke registrerte
    $fallback = plugin_dir_url( __FILE__ ) . 'public/js/tvs-app.js';
    if ( file_exists( plugin_dir_path( __FILE__ ) . 'public/js/tvs-app.js' ) ) {
        wp_register_script( 'tvs-app', $fallback, array( 'wp-element' ), null, true );
    }
}
wp_enqueue_script( 'tvs-app' );

// 1) Prøv vanlig WP-måte
$json   = wp_json_encode( $payload );
wp_add_inline_script( 'tvs-app', "window.tvs_route_payload = {$json};", 'before' );

// 2) I tillegg: skriv payload direkte i markup (sikrer at den finnes tidlig)
$inline_tag = '<script>window.tvs_route_payload = ' . $json . ';</script>';

// Mountpunkt + inline payload (payload før root er fint)
$out  = $inline_tag;
$out .= sprintf( '<div id="tvs-app-root" data-route-id="%d"></div>', $id );

return $out;
}

}

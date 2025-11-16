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
        add_shortcode( 'tvs_strava_status', array( $this, 'shortcode_strava_status' ) );
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
// Enqueue Mapbox CSS for virtual training
wp_enqueue_style( 'mapbox-gl' );

// Add Mapbox token to payload
$payload['mapbox_token'] = get_option( 'tvs_mapbox_token', '' );

// Enqueue script
wp_enqueue_script( 'tvs-app' );

// Embed data directly in HTML (inline script in output)
$json = wp_json_encode( $payload );
$json = str_replace( '</script>', '<\/script>', $json ); // Protect against script injection

$out = sprintf( 
    '<script>window.tvs_route_payload = %s;</script><div id="tvs-app-root" data-route-id="%d"></div>',
    $json,
    $id
);

return $out;
}

    /**
     * Shortcode to display Strava connection status
     * Usage: [tvs_strava_status]
     */
    public function shortcode_strava_status( $atts ) {
        // Render the Connect Strava block server-side so we have a single source of truth for UI and logic
        if ( function_exists( 'do_blocks' ) ) {
            return do_blocks( '<!-- wp:tvs/connect-strava /-->' );
        }
        // Fallback: minimal link
        return '<p><a class="button" href="/connect-strava/?mode=popup">' . esc_html__( 'Connect with Strava', 'tvs-virtual-sports' ) . '</a></p>';
    }

}

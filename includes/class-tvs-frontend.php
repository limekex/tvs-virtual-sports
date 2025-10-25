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
wp_enqueue_script( 'tvs-app' );

// 1) Legg data på en trygg måte før app-skriptet
$json = wp_json_encode( $payload );
// Beskytt mot </script> sekvens i innhold
$json = str_replace( '</script>', '<\/script>', $json );
wp_add_inline_script( 'tvs-app', "window.tvs_route_payload = {$json};", 'before' );

// 2) Kun mountpunkt i markup (unngå ekstra inline <script> i innholdet)
$out = sprintf( '<div id="tvs-app-root" data-route-id="%d"></div>', $id );

return $out;
}

    /**
     * Shortcode to display Strava connection status
     * Usage: [tvs_strava_status]
     */
    public function shortcode_strava_status( $atts ) {
        if ( ! is_user_logged_in() ) {
            return '<p>' . esc_html__( 'Du må være innlogget for å se Strava-status.', 'tvs-virtual-sports' ) . '</p>';
        }
        
        $status = tvs_get_strava_status();
        
        if ( ! $status['connected'] ) {
            return '<div class="tvs-strava-status">
                <p><strong>Strava:</strong> Ikke tilkoblet</p>
                <p><a href="/connect-strava/" class="button">Koble til Strava</a></p>
            </div>';
        }
        
        $athlete_name = $status['athlete_name'] ? esc_html( $status['athlete_name'] ) : 'Ukjent';
        $athlete_id = $status['athlete_id'] ? esc_html( $status['athlete_id'] ) : 'N/A';
        $scope = $status['scope'] ? esc_html( $status['scope'] ) : 'N/A';
        
        $expires_at = '';
        if ( $status['expires_at'] ) {
            $expires_at = date( 'Y-m-d H:i:s', $status['expires_at'] );
        }
        
        return '<div class="tvs-strava-status" style="border:1px solid #ddd;padding:1em;margin:1em 0;">
            <h3>Strava-tilkobling</h3>
            <p><strong>Status:</strong> Tilkoblet ✓</p>
            <p><strong>Atlet:</strong> ' . $athlete_name . ' (ID: ' . $athlete_id . ')</p>
            <p><strong>Scope:</strong> ' . $scope . '</p>
            ' . ( $expires_at ? '<p><strong>Utløper:</strong> ' . esc_html( $expires_at ) . '</p>' : '' ) . '
            <p><em>Tokens er lagret i user_meta[\'tvs_strava\']</em></p>
        </div>';
    }

}

<?php
/**
 * Invite Friends Block - Server-side render
 * 
 * @package TVS_Virtual_Sports
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// Hide block completely for logged-out users (no output, no assets)
if ( ! is_user_logged_in() ) {
    return;
}

wp_enqueue_script( 'tvs-block-invites' );
wp_enqueue_style( 'tvs-public' );

// Localize TVS_SETTINGS in case not already
$settings = array(
    'env'       => ( defined( 'WP_DEBUG' ) && WP_DEBUG ) ? 'development' : 'production',
    'restRoot'  => get_rest_url(),
    'nonce'     => wp_create_nonce( 'wp_rest' ),
    'version'   => TVS_PLUGIN_VERSION,
    'user'      => is_user_logged_in() ? wp_get_current_user()->user_login : null,
    'pluginUrl' => TVS_PLUGIN_URL,
    'mapbox'    => array(
        'accessToken'         => get_option( 'tvs_mapbox_access_token', '' ),
        'style'               => get_option( 'tvs_mapbox_map_style', 'mapbox://styles/mapbox/satellite-streets-v12' ),
        'initialZoom'         => floatval( get_option( 'tvs_mapbox_initial_zoom', 14 ) ),
        'minZoom'             => floatval( get_option( 'tvs_mapbox_min_zoom', 10 ) ),
        'maxZoom'             => floatval( get_option( 'tvs_mapbox_max_zoom', 18 ) ),
        'pitch'               => floatval( get_option( 'tvs_mapbox_pitch', 60 ) ),
        'bearing'             => floatval( get_option( 'tvs_mapbox_bearing', 0 ) ),
        'defaultSpeed'        => floatval( get_option( 'tvs_mapbox_default_speed', 1.0 ) ),
        'cameraOffset'        => floatval( get_option( 'tvs_mapbox_camera_offset', 0.0002 ) ),
        'smoothFactor'        => floatval( get_option( 'tvs_mapbox_smooth_factor', 0.7 ) ),
        'markerColor'         => get_option( 'tvs_mapbox_marker_color', '#ff0000' ),
        'routeColor'          => get_option( 'tvs_mapbox_route_color', '#ec4899' ),
        'routeWidth'          => intval( get_option( 'tvs_mapbox_route_width', 6 ) ),
        'terrainEnabled'      => (bool) get_option( 'tvs_mapbox_terrain_enabled', 0 ),
        'terrainExaggeration' => floatval( get_option( 'tvs_mapbox_terrain_exaggeration', 1.5 ) ),
        'flyToZoom'           => floatval( get_option( 'tvs_mapbox_flyto_zoom', 16 ) ),
        'buildings3dEnabled'  => (bool) get_option( 'tvs_mapbox_buildings_3d_enabled', 0 ),
    ),
);
wp_localize_script( 'tvs-block-invites', 'TVS_SETTINGS', $settings );

$mount_id = 'tvs-invite-friends-' . uniqid();
?>

<div id="<?php echo esc_attr( $mount_id ); ?>" class="tvs-invite-friends-block"></div>

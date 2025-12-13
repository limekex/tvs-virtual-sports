<?php
/**
 * Route Weather Block - Server-side render
 * 
 * @package TVS_Virtual_Sports
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

wp_enqueue_script( 'tvs-block-route-weather' );
wp_enqueue_style( 'tvs-public' );

$mount_id      = 'tvs-route-weather-' . uniqid();
$title         = isset( $attributes['title'] ) ? sanitize_text_field( $attributes['title'] ) : 'Weather Conditions';
$max_distance  = isset( $attributes['maxDistance'] ) ? intval( $attributes['maxDistance'] ) : 50;
$debug         = ! empty( $attributes['debug'] );
$attr_route_id = isset( $attributes['routeId'] ) ? intval( $attributes['routeId'] ) : 0;
$route_id      = $attr_route_id > 0 ? $attr_route_id : ( is_singular( 'tvs_route' ) ? get_the_ID() : 0 );

// Check if route has Vimeo video (real route) or is virtual (mapbox simulation only)
$vimeo_id   = get_post_meta( $route_id, 'vimeo_id', true );
$is_virtual = empty( $vimeo_id ) || trim( $vimeo_id ) === '';

// Get route meta for location
$meta = get_post_meta( $route_id, 'meta', true );
$lat  = '0';
$lng  = '0';
if ( ! empty( $meta ) && is_string( $meta ) ) {
    $meta_arr = json_decode( $meta, true );
    if ( ! empty( $meta_arr['lat'] ) ) {
        $lat = $meta_arr['lat'];
    }
    if ( ! empty( $meta_arr['lng'] ) ) {
        $lng = $meta_arr['lng'];
    }
}
?>

<div class="tvs-app tvs-weather-widget">
    <div id="<?php echo esc_attr( $mount_id ); ?>"
         class="tvs-route-weather"
         data-route-id="<?php echo esc_attr( $route_id ); ?>"
         data-title="<?php echo esc_attr( $title ); ?>"
         data-max-distance="<?php echo esc_attr( $max_distance ); ?>"
         data-lat="<?php echo esc_attr( $lat ); ?>"
         data-lng="<?php echo esc_attr( $lng ); ?>"
         data-debug="<?php echo esc_attr( $debug ? '1' : '0' ); ?>"
         data-plugin-url="<?php echo esc_attr( TVS_PLUGIN_URL ); ?>"
         data-is-virtual="<?php echo esc_attr( $is_virtual ? '1' : '0' ); ?>"
    >
        <div class="tvs-weather-loading">
            <div class="tvs-weather-shimmer">
                <div class="tvs-shimmer-icon"></div>
                <div class="tvs-shimmer-text"></div>
                <div class="tvs-shimmer-text"></div>
            </div>
        </div>
    </div>
</div>

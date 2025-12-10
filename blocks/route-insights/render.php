<?php
/**
 * Route Insights Block - Server-side render
 * 
 * @package TVS_Virtual_Sports
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

wp_enqueue_script( 'tvs-block-route-insights' );
wp_enqueue_style( 'tvs-public' );

$mount_id        = 'tvs-route-insights-' . uniqid();
$title           = isset( $attributes['title'] ) ? sanitize_text_field( $attributes['title'] ) : 'Route Insights';
$attr_route_id   = isset( $attributes['routeId'] ) ? intval( $attributes['routeId'] ) : 0;
$show_distance   = array_key_exists( 'showDistance', $attributes ) ? (bool) $attributes['showDistance'] : true;
$show_pace       = array_key_exists( 'showPace', $attributes ) ? (bool) $attributes['showPace'] : true;
$show_cumulative = array_key_exists( 'showCumulative', $attributes ) ? (bool) $attributes['showCumulative'] : false;
$show_elev       = ! empty( $attributes['showElevation'] );
$show_surface    = ! empty( $attributes['showSurface'] );
$show_eta        = ! empty( $attributes['showEta'] );
$show_maps       = ! empty( $attributes['showMapsLink'] );
$route_id        = $attr_route_id > 0 ? $attr_route_id : ( is_singular( 'tvs_route' ) ? get_the_ID() : 0 );
?>

<div class="tvs-app">
    <div id="<?php echo esc_attr( $mount_id ); ?>"
         class="tvs-route-insights-block"
         data-title="<?php echo esc_attr( $title ); ?>"
         data-show-elevation="<?php echo esc_attr( $show_elev ? '1' : '0' ); ?>"
         data-show-surface="<?php echo esc_attr( $show_surface ? '1' : '0' ); ?>"
         data-show-eta="<?php echo esc_attr( $show_eta ? '1' : '0' ); ?>"
         data-show-maps-link="<?php echo esc_attr( $show_maps ? '1' : '0' ); ?>"
         data-route-id="<?php echo esc_attr( $route_id ); ?>"
    ></div>
</div>

<?php
/**
 * Activity Heatmap Block - Server-side render
 * 
 * @package TVS_Virtual_Sports
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

wp_enqueue_script( 'tvs-block-activity-heatmap' );
wp_enqueue_style( 'tvs-public' );

$mount_id      = 'tvs-activity-heatmap-' . uniqid();
$title         = isset( $attributes['title'] ) ? sanitize_text_field( $attributes['title'] ) : 'Activity Heatmap';
$type          = isset( $attributes['heatmapType'] ) ? sanitize_text_field( $attributes['heatmapType'] ) : 'sparkline';
$attr_route_id = isset( $attributes['routeId'] ) ? intval( $attributes['routeId'] ) : 0;
$route_id      = $attr_route_id > 0 ? $attr_route_id : ( is_singular( 'tvs_route' ) ? get_the_ID() : 0 );
?>

<div class="tvs-app">
    <div id="<?php echo esc_attr( $mount_id ); ?>"
         class="tvs-activity-heatmap-block"
         data-title="<?php echo esc_attr( $title ); ?>"
         data-type="<?php echo esc_attr( $type ); ?>"
         data-route-id="<?php echo esc_attr( $route_id ); ?>"
    ></div>
</div>

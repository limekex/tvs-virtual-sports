<?php
/**
 * Personal Records Block - Server-side render
 * 
 * @package TVS_Virtual_Sports
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

wp_enqueue_script( 'tvs-block-personal-records' );
wp_enqueue_style( 'tvs-public' );

$mount_id      = 'tvs-personal-records-' . uniqid();
$title         = isset( $attributes['title'] ) ? sanitize_text_field( $attributes['title'] ) : 'Personal Records';
$attr_route_id = isset( $attributes['routeId'] ) ? intval( $attributes['routeId'] ) : 0;
$show_best     = ! empty( $attributes['showBestTime'] );
$show_avg_pace = ! empty( $attributes['showAvgPace'] );
$show_avg_tempo = ! empty( $attributes['showAvgTempo'] );
$show_recent   = ! empty( $attributes['showMostRecent'] );
$route_id      = $attr_route_id > 0 ? $attr_route_id : ( is_singular( 'tvs_route' ) ? get_the_ID() : 0 );
?>

<div class="tvs-app">
    <div id="<?php echo esc_attr( $mount_id ); ?>"
         class="tvs-personal-records-block"
         data-title="<?php echo esc_attr( $title ); ?>"
         data-show-best="<?php echo esc_attr( $show_best ? '1' : '0' ); ?>"
         data-show-avg-pace="<?php echo esc_attr( $show_avg_pace ? '1' : '0' ); ?>"
         data-show-avg-tempo="<?php echo esc_attr( $show_avg_tempo ? '1' : '0' ); ?>"
         data-show-recent="<?php echo esc_attr( $show_recent ? '1' : '0' ); ?>"
         data-route-id="<?php echo esc_attr( $route_id ); ?>"
    ></div>
</div>

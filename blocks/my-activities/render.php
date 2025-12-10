<?php
/**
 * My Activities Block - Server-side render
 * 
 * @package TVS_Virtual_Sports
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

wp_enqueue_script( 'tvs-block-my-activities' );
wp_enqueue_style( 'tvs-public' );

$mount_id = 'tvs-my-activities-' . uniqid();
$route_id = isset( $attributes['routeId'] ) ? intval( $attributes['routeId'] ) : 0;
$limit    = isset( $attributes['limit'] ) ? max( 1, min( 20, intval( $attributes['limit'] ) ) ) : 5;
$title    = isset( $attributes['title'] ) ? sanitize_text_field( $attributes['title'] ) : 'Recent Activities';

// Sensible defaults: on a route page, default to route mode
if ( is_singular( 'tvs_route' ) && $route_id <= 0 ) {
    $route_id = get_the_ID();
}
?>

<div class="tvs-app tvs-app--activities">
    <div id="<?php echo esc_attr( $mount_id ); ?>"
         class="tvs-my-activities-block"
         data-route-id="<?php echo esc_attr( $route_id ); ?>"
         data-limit="<?php echo esc_attr( $limit ); ?>"
         data-title="<?php echo esc_attr( $title ); ?>"
    ></div>
</div>

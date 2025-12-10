<?php
/**
 * Activity Comparison Block - Server-side render
 *
 * @package TVS_Virtual_Sports
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

$mount_id     = 'tvs-activity-comparison-' . uniqid();
$user_id      = isset( $attributes['userId'] ) && $attributes['userId'] > 0 
    ? intval( $attributes['userId'] ) 
    : get_current_user_id();
$mode         = isset( $attributes['mode'] ) ? sanitize_text_field( $attributes['mode'] ) : 'manual';
$activity_id1 = isset( $attributes['activityId1'] ) ? intval( $attributes['activityId1'] ) : 0;
$activity_id2 = isset( $attributes['activityId2'] ) ? intval( $attributes['activityId2'] ) : 0;

// Auto-detect route ID if block is on a route CPT page
$route_id = isset( $attributes['routeId'] ) ? intval( $attributes['routeId'] ) : 0;
if ( $route_id === 0 && is_singular( 'tvs_route' ) ) {
    $route_id = get_the_ID();
}

$title        = isset( $attributes['title'] ) ? sanitize_text_field( $attributes['title'] ) : 'Activity Comparison';

// Enqueue scripts
wp_enqueue_script( 'tvs-block-activity-comparison' );
wp_enqueue_style( 'tvs-public' );
?>

<div class="tvs-app tvs-app--comparison">
    <div id="<?php echo esc_attr( $mount_id ); ?>"
         class="tvs-comparison-block"
         data-user-id="<?php echo esc_attr( $user_id ); ?>"
         data-mode="<?php echo esc_attr( $mode ); ?>"
         data-activity-id-1="<?php echo esc_attr( $activity_id1 ); ?>"
         data-activity-id-2="<?php echo esc_attr( $activity_id2 ); ?>"
         data-route-id="<?php echo esc_attr( $route_id ); ?>"
         data-title="<?php echo esc_attr( $title ); ?>"
    ></div>
</div>

<?php
/**
 * Single Activity Details Block - Server-side render
 * 
 * @package TVS_Virtual_Sports
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

wp_enqueue_script( 'tvs-block-single-activity-details' );
wp_enqueue_style( 'tvs-public' );

$mount_id = 'tvs-single-activity-details-' . uniqid();

// Auto-detect activity ID from global post or use attribute
$activity_id = isset( $attributes['activityId'] ) && $attributes['activityId'] > 0 
    ? intval( $attributes['activityId'] ) 
    : get_the_ID();

// Verify it's an activity post
if ( get_post_type( $activity_id ) !== 'tvs_activity' ) {
    echo '<p>' . esc_html__( 'This block can only be used on activity pages.', 'tvs-virtual-sports' ) . '</p>';
    return;
}

$show_comparison = isset( $attributes['showComparison'] ) ? (bool) $attributes['showComparison'] : true;
$show_actions    = isset( $attributes['showActions'] ) ? (bool) $attributes['showActions'] : true;
$show_notes      = isset( $attributes['showNotes'] ) ? (bool) $attributes['showNotes'] : true;

$current_user_id = get_current_user_id();
$is_author       = $current_user_id && ( $current_user_id == get_post_field( 'post_author', $activity_id ) );

// Fetch metadata directly as fallback (since REST API might not expose it)
$meta_fields = array(
    'distance_m'    => get_post_meta( $activity_id, 'distance_m', true ),
    'duration_s'    => get_post_meta( $activity_id, 'duration_s', true ),
    'rating'        => get_post_meta( $activity_id, 'rating', true ),
    'notes'         => get_post_meta( $activity_id, 'notes', true ),
    'activity_type' => get_post_meta( $activity_id, 'activity_type', true ),
    'route_id'      => get_post_meta( $activity_id, 'route_id', true ),
    'source'        => get_post_meta( $activity_id, 'source', true ),
    'activity_date' => get_post_meta( $activity_id, 'activity_date', true ),
);

// For workout activities, include exercises and circuits
$exercises_json = get_post_meta( $activity_id, '_tvs_manual_exercises', true );
$circuits_json  = get_post_meta( $activity_id, '_tvs_manual_circuits', true );
if ( $exercises_json ) {
    $meta_fields['exercises'] = json_decode( $exercises_json, true );
}
if ( $circuits_json ) {
    $meta_fields['circuits'] = json_decode( $circuits_json, true );
}
?>

<div class="tvs-app tvs-app--activity-details">
    <div id="<?php echo esc_attr( $mount_id ); ?>"
         class="tvs-single-activity-details-block"
         data-activity-id="<?php echo esc_attr( $activity_id ); ?>"
         data-show-comparison="<?php echo esc_attr( $show_comparison ? '1' : '0' ); ?>"
         data-show-actions="<?php echo esc_attr( $show_actions ? '1' : '0' ); ?>"
         data-show-notes="<?php echo esc_attr( $show_notes ? '1' : '0' ); ?>"
         data-is-author="<?php echo esc_attr( $is_author ? '1' : '0' ); ?>"
         data-meta="<?php echo esc_attr( wp_json_encode( $meta_fields ) ); ?>"
    ></div>
</div>

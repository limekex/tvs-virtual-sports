<?php
/**
 * Activity Stats Dashboard Block - Server-side render
 * 
 * @package TVS_Virtual_Sports
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

wp_enqueue_script( 'tvs-block-activity-stats-dashboard' );
wp_enqueue_style( 'tvs-public' );

$mount_id    = 'tvs-activity-stats-dashboard-' . uniqid();
$user_id     = isset( $attributes['userId'] ) && $attributes['userId'] > 0 
    ? intval( $attributes['userId'] ) 
    : get_current_user_id();
$period      = isset( $attributes['period'] ) ? sanitize_text_field( $attributes['period'] ) : '30d';
$title       = isset( $attributes['title'] ) ? sanitize_text_field( $attributes['title'] ) : 'Activity Dashboard';
$show_charts = isset( $attributes['showCharts'] ) ? (bool) $attributes['showCharts'] : true;
?>

<div class="tvs-app tvs-app--stats-dashboard">
    <div id="<?php echo esc_attr( $mount_id ); ?>"
         class="tvs-stats-dashboard-block"
         data-user-id="<?php echo esc_attr( $user_id ); ?>"
         data-period="<?php echo esc_attr( $period ); ?>"
         data-title="<?php echo esc_attr( $title ); ?>"
         data-show-charts="<?php echo esc_attr( $show_charts ? '1' : '0' ); ?>"
    ></div>
</div>

<?php
/**
 * Manual Activity Tracker Block - Server-side render
 * 
 * @package TVS_Virtual_Sports
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// Must be logged in to use manual activity tracker
if ( ! is_user_logged_in() ) {
    echo '<div class="tvs-app"><p>' . esc_html__( 'You must be logged in to track activities.', 'tvs-virtual-sports' ) . '</p></div>';
    return;
}

// Enqueue block-specific frontend script and styles
wp_enqueue_script( 'tvs-block-manual-activity-tracker' );
wp_enqueue_style( 'tvs-public' );

$mount_id           = 'tvs-manual-tracker-' . uniqid();
$title              = isset( $attributes['title'] ) ? sanitize_text_field( $attributes['title'] ) : 'Start Activity';
$show_type_selector = isset( $attributes['showTypeSelector'] ) ? (bool) $attributes['showTypeSelector'] : true;
$allowed_types      = isset( $attributes['allowedTypes'] ) && is_array( $attributes['allowedTypes'] ) 
    ? array_map( 'sanitize_text_field', $attributes['allowedTypes'] ) 
    : array( 'Run', 'Ride', 'Walk', 'Hike', 'Swim', 'Workout' );
$auto_start         = isset( $attributes['autoStart'] ) ? (bool) $attributes['autoStart'] : false;
$default_type       = isset( $attributes['defaultType'] ) ? sanitize_text_field( $attributes['defaultType'] ) : 'Run';
?>

<div class="tvs-app tvs-manual-tracker-widget">
    <div id="<?php echo esc_attr( $mount_id ); ?>"
         class="tvs-manual-activity-tracker"
         data-title="<?php echo esc_attr( $title ); ?>"
         data-show-type-selector="<?php echo esc_attr( $show_type_selector ? '1' : '0' ); ?>"
         data-allowed-types="<?php echo esc_attr( wp_json_encode( $allowed_types ) ); ?>"
         data-auto-start="<?php echo esc_attr( $auto_start ? '1' : '0' ); ?>"
         data-default-type="<?php echo esc_attr( $default_type ); ?>"
    >
        <div class="tvs-tracker-loading">
            <p><?php esc_html_e( 'Loading activity tracker...', 'tvs-virtual-sports' ); ?></p>
        </div>
    </div>
</div>

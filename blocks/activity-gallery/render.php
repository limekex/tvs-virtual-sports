<?php
/**
 * Activity Gallery Block - Server-side render
 * 
 * @package TVS_Virtual_Sports
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

wp_enqueue_script( 'tvs-block-activity-gallery' );
wp_enqueue_style( 'tvs-public' );

$mount_id = 'tvs-activity-gallery-' . uniqid();
$user_id  = isset( $attributes['userId'] ) && $attributes['userId'] > 0 
    ? intval( $attributes['userId'] ) 
    : get_current_user_id();

// Require authentication
if ( ! is_user_logged_in() && $user_id === 0 ) {
    echo '<div class="tvs-app tvs-auth-required"><p>' . 
         sprintf( 
             /* translators: %s: login URL */
             __( 'Du må <a href="%s">logge inn</a> for å se ditt aktivitetsgalleri.', 'tvs-virtual-sports' ),
             esc_url( wp_login_url( get_permalink() ) )
         ) . 
         '</p></div>';
    return;
}

$limit        = isset( $attributes['limit'] ) ? max( 1, min( 100, intval( $attributes['limit'] ) ) ) : 12;
$title        = isset( $attributes['title'] ) ? sanitize_text_field( $attributes['title'] ) : 'Activity Gallery';
$layout       = isset( $attributes['layout'] ) ? sanitize_text_field( $attributes['layout'] ) : 'grid';
$columns      = isset( $attributes['columns'] ) ? max( 1, min( 4, intval( $attributes['columns'] ) ) ) : 3;
$show_filters = isset( $attributes['showFilters'] ) ? (bool) $attributes['showFilters'] : true;
?>

<div class="tvs-app tvs-app--activity-gallery">
    <div id="<?php echo esc_attr( $mount_id ); ?>"
         class="tvs-activity-gallery-block"
         data-user-id="<?php echo esc_attr( $user_id ); ?>"
         data-limit="<?php echo esc_attr( $limit ); ?>"
         data-title="<?php echo esc_attr( $title ); ?>"
         data-layout="<?php echo esc_attr( $layout ); ?>"
         data-columns="<?php echo esc_attr( $columns ); ?>"
         data-show-filters="<?php echo esc_attr( $show_filters ? '1' : '0' ); ?>"
    ></div>
</div>

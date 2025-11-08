<?php
/**
 * Server-side render for TVS My Activities block
 */
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// Enqueue the React app if not already loaded
wp_enqueue_script( 'tvs-app' );
wp_enqueue_style( 'tvs-public' );

// Create a unique mount point for this block instance
$mount_id = 'tvs-my-activities-' . uniqid();
?>
<div id="<?php echo esc_attr( $mount_id ); ?>" class="tvs-my-activities-block"></div>
<?php
/**
 * Deprecated: This legacy render file is intentionally a no-op.
 * The My Activities block is registered and rendered via class-tvs-plugin.php
 * (tvs-virtual-sports/my-activities) and a dedicated JS bundle.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }
return;

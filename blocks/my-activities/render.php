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
<script>
(function() {
    if (typeof window.tvsMyActivitiesMount === 'undefined') {
        window.tvsMyActivitiesMount = [];
    }
    window.tvsMyActivitiesMount.push('<?php echo esc_js( $mount_id ); ?>');
})();
</script>

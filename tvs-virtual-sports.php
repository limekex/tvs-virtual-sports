<?php
/**
 * Plugin Name: TVS Virtual Sports
 * Plugin URI:  https://virtualsport.online/
 * Description: MVP for Virtual Routes with video + map playback and user activity logging.
 * Version:           1.2.709
 * Author:      TVS
 * Text Domain: tvs-virtual-sports
 * Domain Path: /languages
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly
}

define( 'TVS_PLUGIN_VERSION', '1.2.709' );
define( 'TVS_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'TVS_PLUGIN_URL', plugin_dir_url( __FILE__ ) );



require_once TVS_PLUGIN_DIR . 'includes/class-tvs-plugin.php';

// Initialize plugin
function tvs_virtual_sports_init_plugin() {
    $plugin = new TVS_Plugin( __FILE__ );
    $plugin->init();
}
add_action( 'plugins_loaded', 'tvs_virtual_sports_init_plugin' );

// Activation hook
function tvs_virtual_sports_activate() {
    $plugin = new TVS_Plugin( __FILE__ );
    $plugin->activate();
}
register_activation_hook( __FILE__, 'tvs_virtual_sports_activate' );

<?php
/**
 * Quick debug script to check plugin version
 * Access via: http://localhost:8080/wp-content/plugins/tvs-virtual-sports/debug-version.php
 */

// Load WordPress
require_once __DIR__ . '/../../../wp-load.php';

header('Content-Type: text/plain');

echo "Plugin file constant TVS_PLUGIN_VERSION: " . (defined('TVS_PLUGIN_VERSION') ? TVS_PLUGIN_VERSION : 'NOT DEFINED') . "\n";
echo "From file directly: ";
$content = file_get_contents(__DIR__ . '/tvs-virtual-sports.php');
preg_match("/define\(\s*'TVS_PLUGIN_VERSION'\s*,\s*'([^']+)'/", $content, $matches);
echo isset($matches[1]) ? $matches[1] : 'NOT FOUND';
echo "\n";

// Check what WordPress thinks
$plugins = get_plugins();
$plugin_file = 'tvs-virtual-sports/tvs-virtual-sports.php';
if (isset($plugins[$plugin_file])) {
    echo "WordPress plugin data version: " . $plugins[$plugin_file]['Version'] . "\n";
}

echo "\nScript registration check:\n";
global $wp_scripts;
if (isset($wp_scripts->registered['tvs-block-manual-activity-tracker'])) {
    echo "Registered version: " . $wp_scripts->registered['tvs-block-manual-activity-tracker']->ver . "\n";
} else {
    echo "Script not registered yet\n";
}

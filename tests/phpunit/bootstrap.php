<?php
// PHPUnit bootstrap for plugin tests
// Note: these tests expect the WP PHPUnit test suite to be installed and configured.
// See README for instructions.

// Load WordPress test environment if WP_TESTS_DIR is set
if ( getenv( 'WP_TESTS_DIR' ) ) {
    require getenv( 'WP_TESTS_DIR' ) . '/includes/functions.php';
}

// Load plugin
require_once dirname( dirname( __DIR__ ) ) . '/tvs-virtual-sports.php';

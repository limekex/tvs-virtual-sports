<?php
/**
 * TVS Roles and auth hardening for athlete users
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

class TVS_Roles {
    public function __construct() {
        add_action( 'init', array( $this, 'ensure_roles' ) );
        add_action( 'admin_init', array( $this, 'block_admin_for_athletes' ) );
        add_filter( 'show_admin_bar', array( $this, 'hide_admin_bar_for_athletes' ) );
    }

    public function ensure_roles() {
        if ( ! get_role( 'tvs_athlete' ) ) {
            add_role( 'tvs_athlete', 'Athlete', array( 'read' => true ) );
        }
    }

    public function block_admin_for_athletes() {
        if ( ! is_user_logged_in() || ! is_admin() ) return;
        if ( defined('DOING_AJAX') && DOING_AJAX ) return;
        $user = wp_get_current_user();
        if ( $user && in_array( 'tvs_athlete', (array) $user->roles, true ) ) {
            wp_safe_redirect( home_url( '/user-profile/' ) );
            exit;
        }
    }

    public function hide_admin_bar_for_athletes( $show ) {
        if ( ! is_user_logged_in() ) return $show;
        $user = wp_get_current_user();
        if ( $user && in_array( 'tvs_athlete', (array) $user->roles, true ) ) {
            return false;
        }
        return $show;
    }
}

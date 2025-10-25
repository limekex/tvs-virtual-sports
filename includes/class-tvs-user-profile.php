<?php
/**
 * TVS User Profile - Manages user profile data and integrations
 */
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class TVS_User_Profile {
    
    /**
     * Get Strava connection data for a user
     * 
     * @param int $user_id User ID (defaults to current user)
     * @return array|null Array with Strava data or null if not connected
     */
    public static function get_strava_connection( $user_id = null ) {
        if ( ! $user_id ) {
            $user_id = get_current_user_id();
        }
        
        if ( ! $user_id ) {
            return null;
        }
        
        $strava_data = get_user_meta( $user_id, 'tvs_strava', true );
        
        if ( empty( $strava_data ) || ! is_array( $strava_data ) ) {
            return null;
        }
        
        return $strava_data;
    }
    
    /**
     * Check if user is connected to Strava
     * 
     * @param int $user_id User ID (defaults to current user)
     * @return bool True if connected, false otherwise
     */
    public static function is_strava_connected( $user_id = null ) {
        $connection = self::get_strava_connection( $user_id );
        return ! empty( $connection ) && ! empty( $connection['access'] );
    }
    
    /**
     * Get Strava athlete info for a user
     * 
     * @param int $user_id User ID (defaults to current user)
     * @return array|null Athlete data or null if not available
     */
    public static function get_strava_athlete( $user_id = null ) {
        $connection = self::get_strava_connection( $user_id );
        
        if ( ! $connection || empty( $connection['athlete'] ) ) {
            return null;
        }
        
        return $connection['athlete'];
    }
    
    /**
     * Get formatted Strava connection status for display
     * 
     * @param int $user_id User ID (defaults to current user)
     * @return array Status information with keys: connected, athlete_name, connected_at
     */
    public static function get_strava_status( $user_id = null ) {
        $connection = self::get_strava_connection( $user_id );
        
        $status = array(
            'connected' => false,
            'athlete_name' => null,
            'athlete_id' => null,
            'expires_at' => null,
            'scope' => null,
        );
        
        if ( ! $connection ) {
            return $status;
        }
        
        $status['connected'] = true;
        
        if ( ! empty( $connection['athlete'] ) ) {
            $athlete = $connection['athlete'];
            $status['athlete_name'] = isset( $athlete['firstname'], $athlete['lastname'] ) 
                ? trim( $athlete['firstname'] . ' ' . $athlete['lastname'] )
                : ( isset( $athlete['username'] ) ? $athlete['username'] : null );
            $status['athlete_id'] = isset( $athlete['id'] ) ? $athlete['id'] : null;
        }
        
        $status['expires_at'] = isset( $connection['expires_at'] ) ? $connection['expires_at'] : null;
        $status['scope'] = isset( $connection['scope'] ) ? $connection['scope'] : null;
        
        return $status;
    }
    
    /**
     * Disconnect user from Strava (remove tokens)
     * 
     * @param int $user_id User ID (defaults to current user)
     * @return bool True on success, false on failure
     */
    public static function disconnect_strava( $user_id = null ) {
        if ( ! $user_id ) {
            $user_id = get_current_user_id();
        }
        
        if ( ! $user_id ) {
            return false;
        }
        
        return delete_user_meta( $user_id, 'tvs_strava' );
    }
}

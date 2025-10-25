<?php
/**
 * Simple Strava integration class with server-side OAuth stubs.
 * TODO: Move client id/secret to env or settings page
 */
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class TVS_Strava {
    protected $client_id;
    protected $client_secret;
    protected $api_base = 'https://www.strava.com/api/v3';

    public function __construct() {
        // Priority: 1) WP options (from admin settings), 2) constants, 3) env vars
        $this->client_id = get_option( 'tvs_strava_client_id' );
        if ( empty( $this->client_id ) ) {
            $this->client_id = defined( 'STRAVA_CLIENT_ID' ) ? STRAVA_CLIENT_ID : getenv( 'STRAVA_CLIENT_ID' );
        }
        
        $this->client_secret = get_option( 'tvs_strava_client_secret' );
        if ( empty( $this->client_secret ) ) {
            $this->client_secret = defined( 'STRAVA_CLIENT_SECRET' ) ? STRAVA_CLIENT_SECRET : getenv( 'STRAVA_CLIENT_SECRET' );
        }
    }

    /**
     * Exchange authorization code for token
     */
    public function exchange_code_for_token( $code ) {
        if ( empty( $this->client_id ) || empty( $this->client_secret ) ) {
            error_log( 'Strava: client_id or client_secret not configured' );
            return new WP_Error( 'config', 'Strava client id/secret not configured' );
        }

        error_log( "Strava: Exchanging code (first 10 chars): " . substr( $code, 0, 10 ) . '...' );
        
        $resp = wp_remote_post( 'https://www.strava.com/oauth/token', array(
            'body' => array(
                'client_id' => $this->client_id,
                'client_secret' => $this->client_secret,
                'code' => $code,
                'grant_type' => 'authorization_code',
            ),
            'timeout' => 15,
        ) );

        if ( is_wp_error( $resp ) ) {
            error_log( 'Strava token exchange WP error: ' . $resp->get_error_message() );
            return $resp;
        }

        $http_code = wp_remote_retrieve_response_code( $resp );
        $body_raw = wp_remote_retrieve_body( $resp );
        error_log( "Strava token exchange HTTP {$http_code}, body: " . substr( $body_raw, 0, 500 ) );
        
        $body = json_decode( $body_raw, true );
        if ( empty( $body ) ) {
            error_log( 'Strava: Invalid/empty response body from token exchange' );
            return new WP_Error( 'invalid_response', 'Invalid response from Strava' );
        }
        
        // Check if Strava returned an error
        if ( isset( $body['errors'] ) || isset( $body['message'] ) ) {
            $err_msg = isset( $body['message'] ) ? $body['message'] : json_encode( $body['errors'] );
            error_log( "Strava token exchange error: {$err_msg}" );
            return new WP_Error( 'strava_error', "Strava error: {$err_msg}" );
        }
        
        error_log( 'Strava: Token exchange successful, got access_token' );
        return $body;
    }

    /**
     * Ensure token for user is valid and refresh if needed
     * Uses tvs_strava user_meta field (from issue #3)
     */
    public function ensure_token( $user_id ) {
        $token = get_user_meta( $user_id, 'tvs_strava', true );
        if ( empty( $token ) || empty( $token['access'] ) ) {
            return new WP_Error( 'no_token', 'No Strava token for user' );
        }

        // Check if token is expired and refresh if needed
        if ( isset( $token['expires_at'] ) && time() > intval( $token['expires_at'] ) ) {
            return $this->refresh_token( $user_id, $token );
        }
        
        return $token;
    }

    /**
     * Refresh Strava token if needed
     * Alias method for consistency with issue #4 spec
     */
    public function maybe_refresh_tokens( $user_id ) {
        return $this->ensure_token( $user_id );
    }

    /**
     * Refresh expired Strava token
     */
    protected function refresh_token( $user_id, $token ) {
        if ( empty( $this->client_id ) || empty( $this->client_secret ) ) {
            return new WP_Error( 'config', 'Strava client id/secret not configured' );
        }

        if ( empty( $token['refresh'] ) ) {
            return new WP_Error( 'no_refresh_token', 'No refresh token available' );
        }

        $resp = wp_remote_post( 'https://www.strava.com/oauth/token', array(
            'body' => array(
                'client_id' => $this->client_id,
                'client_secret' => $this->client_secret,
                'grant_type' => 'refresh_token',
                'refresh_token' => $token['refresh'],
            ),
            'timeout' => 15,
        ) );

        if ( is_wp_error( $resp ) ) {
            error_log( 'Strava token refresh failed: ' . $resp->get_error_message() );
            return $resp;
        }

        $code = wp_remote_retrieve_response_code( $resp );
        if ( $code !== 200 ) {
            $body = wp_remote_retrieve_body( $resp );
            error_log( "Strava token refresh HTTP {$code}: {$body}" );
            return new WP_Error( 'refresh_failed', "Failed to refresh token (HTTP {$code})" );
        }

        $body = json_decode( wp_remote_retrieve_body( $resp ), true );
        if ( empty( $body['access_token'] ) ) {
            return new WP_Error( 'invalid_response', 'Invalid refresh response from Strava' );
        }

        // Update user_meta with new tokens
        $updated = array(
            'access'     => $body['access_token'],
            'refresh'    => $body['refresh_token'],
            'expires_at' => isset( $body['expires_at'] ) ? $body['expires_at'] : null,
            'scope'      => isset( $body['scope'] ) ? $body['scope'] : $token['scope'],
            'athlete'    => $token['athlete'], // Keep existing athlete info
        );
        update_user_meta( $user_id, 'tvs_strava', $updated );
        
        return $updated;
    }

    /**
     * Upload activity to Strava (renamed from create_activity for clarity)
     * Maps activity type and builds proper payload
     */
    public function upload_activity( $user_id, $activity_post_id ) {
        $token = $this->ensure_token( $user_id );
        if ( is_wp_error( $token ) ) {
            return $token;
        }

        $access_token = $token['access'];

        // Get activity post and meta
        $post = get_post( $activity_post_id );
        if ( ! $post || $post->post_type !== 'tvs_activity' ) {
            return new WP_Error( 'invalid_activity', 'Invalid activity post' );
        }

        // Get meta fields with _tvs_ prefix
        $route_id = get_post_meta( $activity_post_id, '_tvs_route_id', true ) ?: get_post_meta( $activity_post_id, 'route_id', true );
        $started_at = get_post_meta( $activity_post_id, '_tvs_started_at', true ) ?: get_post_meta( $activity_post_id, 'started_at', true );
        $duration_s = get_post_meta( $activity_post_id, '_tvs_duration_s', true ) ?: get_post_meta( $activity_post_id, 'duration_s', true );
        $distance_m = get_post_meta( $activity_post_id, '_tvs_distance_m', true ) ?: get_post_meta( $activity_post_id, 'distance_m', true );
        
        // Get activity type from taxonomy or meta
        $activity_type = 'VirtualRun'; // default - virtual activities
        $terms = wp_get_post_terms( $activity_post_id, 'tvs_activity_type', array( 'fields' => 'names' ) );
        if ( ! empty( $terms ) && ! is_wp_error( $terms ) ) {
            $activity_type = $this->map_activity_type( $terms[0] );
        }

        // Build activity name and template context
        $route_title = '';
        $route_url = '';
        if ( $route_id ) {
            $route_post = get_post( $route_id );
            if ( $route_post ) {
                $route_title = $route_post->post_title;
            }
            $permalink = get_permalink( $route_id );
            if ( $permalink && ! is_wp_error( $permalink ) ) {
                $route_url = $permalink;
            }
        }
            $context = array(
                'route_title'  => $route_title,
                'activity_id'  => $activity_post_id,
                'distance_km'  => $this->format_km_with_unit( $distance_m ),
                'duration_hms' => $this->format_hms_smart( $duration_s ),
                'date_local'   => $started_at ? date( 'Y-m-d H:i', strtotime( $started_at ) ) : date( 'Y-m-d H:i' ),
                'type'         => $activity_type,
                'route_url'    => $route_url,
            );

        $title_tpl = get_option( 'tvs_strava_title_template', 'TVS: {route_title}' );
        $desc_tpl  = get_option( 'tvs_strava_desc_template', 'Uploaded from TVS Virtual Sports (Activity ID: {activity_id})' );
        $is_private = (bool) get_option( 'tvs_strava_private', true );

        $name = $this->render_template( $title_tpl, $context );
        if ( ! $name ) {
            $name = $route_title ? "TVS: {$route_title}" : sprintf( 'TVS Activity %d', $activity_post_id );
        }

        // Build payload for Strava API
        $payload = array(
            'name' => $name,
            'type' => $activity_type,
            'start_date_local' => $started_at ?: date( 'c' ),
            'elapsed_time' => intval( $duration_s ),
            'distance' => floatval( $distance_m ),
            'description' => $this->render_template( $desc_tpl, $context ),
            'private' => (bool) $is_private,
        );
        
        // Debug log payload
        error_log( 'Strava upload payload: ' . json_encode( $payload, JSON_PRETTY_PRINT ) );

        // Closure to perform upload with a given token
        $do_upload = function( $bearer ) use ( $payload ) {
            return wp_remote_post( $this->api_base . '/activities', array(
                'headers' => array(
                    'Authorization' => 'Bearer ' . $bearer,
                    'Content-Type'  => 'application/json',
                ),
                'body'    => json_encode( $payload ),
                'timeout' => 20,
            ) );
        };

        // Make API request (attempt 1)
        $resp = $do_upload( $access_token );

        if ( is_wp_error( $resp ) ) {
            error_log( 'Strava upload failed: ' . $resp->get_error_message() );
            return $resp;
        }

        $code = wp_remote_retrieve_response_code( $resp );
        $body = json_decode( wp_remote_retrieve_body( $resp ), true );

        // Handle auth error by attempting token refresh and one retry
        if ( $code === 401 ) {
            error_log( 'Strava upload got 401, attempting token refresh and retry...' );
            $refreshed = $this->refresh_token( $user_id, $token );
            if ( is_wp_error( $refreshed ) ) {
                return new WP_Error( 'upload_failed', 'Strava auth failed (token expired or revoked). Please reconnect Strava and ensure activity:write scope.', array( 'status' => 401 ) );
            }
            $access_token = $refreshed['access'];
            $resp = $do_upload( $access_token );
            if ( is_wp_error( $resp ) ) {
                error_log( 'Strava upload failed after refresh: ' . $resp->get_error_message() );
                return $resp;
            }
            $code = wp_remote_retrieve_response_code( $resp );
            $body = json_decode( wp_remote_retrieve_body( $resp ), true );
        }

        if ( $code !== 201 && $code !== 200 ) {
            $error_msg = isset( $body['message'] ) ? $body['message'] : 'Unknown error';
            // Detect missing scope hint, if any
            if ( $code === 401 || $code === 403 ) {
                $error_msg .= '. Please reconnect Strava and ensure the application has activity:write scope.';
            }
            error_log( "Strava upload HTTP {$code}: {$error_msg}" );
            return new WP_Error( 'upload_failed', "Strava upload failed: {$error_msg} (HTTP {$code})", array( 'status' => $code ) );
        }

        if ( empty( $body ) || empty( $body['id'] ) ) {
            return new WP_Error( 'invalid_response', 'Invalid response from Strava (missing activity ID)' );
        }

        $activity_id = $body['id'];
        
        // Strava ignores 'private' during creation, so we need to update it separately
        // Note: 'private' field may not be settable via API - try 'hide_from_home' as well
        if ( $is_private !== null ) {
            $update_payload = array(
                'private' => (bool) $is_private,
                'hide_from_home' => (bool) $is_private, // Also try hide_from_home parameter
            );
            error_log( "Strava: Updating activity {$activity_id} privacy with: " . json_encode( $update_payload ) );
            
            $update_resp = wp_remote_request( $this->api_base . '/activities/' . $activity_id, array(
                'method'  => 'PUT',
                'headers' => array(
                    'Authorization' => 'Bearer ' . $access_token,
                    'Content-Type'  => 'application/json',
                ),
                'body'    => json_encode( $update_payload ),
                'timeout' => 15,
            ) );
            
            if ( ! is_wp_error( $update_resp ) ) {
                $update_code = wp_remote_retrieve_response_code( $update_resp );
                $update_body = wp_remote_retrieve_body( $update_resp );
                $update_data = json_decode( $update_body, true );
                
                // Log both private and hide_from_home fields
                $returned_private = isset( $update_data['private'] ) ? $update_data['private'] : 'FIELD_MISSING';
                $returned_hide = isset( $update_data['hide_from_home'] ) ? $update_data['hide_from_home'] : 'FIELD_MISSING';
                error_log( "Strava: Privacy update response HTTP {$update_code}, private: " . var_export( $returned_private, true ) . ", hide_from_home: " . var_export( $returned_hide, true ) );
                
                if ( $update_code === 200 ) {
                    // Check if either field was successfully updated
                    $privacy_matches = ( $returned_private === (bool) $is_private || $returned_hide === (bool) $is_private );
                    if ( $privacy_matches ) {
                        error_log( "Strava activity {$activity_id} privacy confirmed: " . ( $is_private ? 'private' : 'public' ) );
                    } else {
                        error_log( "Strava activity {$activity_id} privacy MISMATCH: requested " . ( $is_private ? 'private' : 'public' ) . " but Strava returned different values" );
                    }
                } else {
                    error_log( "Strava activity {$activity_id} privacy update failed: HTTP {$update_code}, body: " . substr( $update_body, 0, 200 ) );
                }
            } else {
                error_log( "Strava: Privacy update WP error: " . $update_resp->get_error_message() );
            }
        }

        return $body;
    }

    /**
     * Simple template renderer replacing {placeholders} with context values
     */
    protected function render_template( $tpl, array $ctx ) {
        if ( ! is_string( $tpl ) || $tpl === '' ) return '';
        $replacements = array();
        foreach ( $ctx as $k => $v ) {
            $replacements['{' . $k . '}'] = (string) $v;
        }
        return strtr( $tpl, $replacements );
    }

    protected function format_km( $meters ) {
        $m = floatval( $meters );
        if ( $m <= 0 ) return '0.00';
        return number_format( $m / 1000, 2 );
    }

    protected function format_hms( $seconds ) {
        $s = intval( $seconds );
        if ( $s < 0 ) $s = 0;
        $h = floor( $s / 3600 );
        $m = floor( ($s % 3600) / 60 );
        $sec = $s % 60;
        if ( $h > 0 ) {
            return sprintf('%d:%02d:%02d', $h, $m, $sec);
        }
        return sprintf('%02d:%02d', $m, $sec);
    }

    /**
     * Format distance in km with unit postfix
     */
    protected function format_km_with_unit( $meters ) {
        $km = round( floatval( $meters ) / 1000, 2 );
        return $km . ' km';
    }

    /**
     * Format duration smart: "mm ss" if <1h, "h mm ss" if >=1h
     */
    protected function format_hms_smart( $seconds ) {
        $s = intval( $seconds );
        if ( $s < 0 ) $s = 0;
        $h = floor( $s / 3600 );
        $m = floor( ($s % 3600) / 60 );
        $sec = $s % 60;
        if ( $h > 0 ) {
            return sprintf( '%dh %dm %ds', $h, $m, $sec );
        }
        return sprintf( '%dm %ds', $m, $sec );
    }

    /**
     * Map TVS activity type to Strava activity type
     */
    protected function map_activity_type( $tvs_type ) {
        $map = array(
            'run' => 'VirtualRun',
            'løp' => 'VirtualRun',
            'ride' => 'VirtualRide',
            'sykkel' => 'VirtualRide',
            'walk' => 'Walk',
            'gå' => 'Walk',
            'hike' => 'Hike',
            'ski' => 'NordicSki',
        );
        
        $lower = strtolower( trim( $tvs_type ) );
        return isset( $map[ $lower ] ) ? $map[ $lower ] : 'VirtualRun';
    }

    /**
     * Legacy alias for backward compatibility
     * @deprecated Use upload_activity() instead
     */
    public function create_activity( $user_id, $activity_post_id ) {
        return $this->upload_activity( $user_id, $activity_post_id );
    }
}

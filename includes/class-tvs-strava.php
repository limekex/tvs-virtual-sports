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
            return new WP_Error( 'config', 'Strava client id/secret not configured' );
        }

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
            return $resp;
        }

        $body = json_decode( wp_remote_retrieve_body( $resp ), true );
        if ( empty( $body ) ) {
            return new WP_Error( 'invalid_response', 'Invalid response from Strava' );
        }
        return $body;
    }

    /**
     * Ensure token for user is valid and refresh if needed
     */
    public function ensure_token( $user_id ) {
        $token = get_user_meta( $user_id, 'tvs_strava_token', true );
        if ( empty( $token ) ) {
            return new WP_Error( 'no_token', 'No Strava token for user' );
        }

        if ( isset( $token['expires_at'] ) && time() > intval( $token['expires_at'] ) ) {
            // refresh
            $resp = wp_remote_post( 'https://www.strava.com/oauth/token', array(
                'body' => array(
                    'client_id' => $this->client_id,
                    'client_secret' => $this->client_secret,
                    'grant_type' => 'refresh_token',
                    'refresh_token' => $token['refresh_token'],
                ),
                'timeout' => 15,
            ) );

            if ( is_wp_error( $resp ) ) {
                return $resp;
            }
            $body = json_decode( wp_remote_retrieve_body( $resp ), true );
            if ( ! empty( $body ) ) {
                update_user_meta( $user_id, 'tvs_strava_token', $body );
                return $body;
            }
            return new WP_Error( 'refresh_failed', 'Failed to refresh token' );
        }
        return $token;
    }

    /**
     * Create an activity on Strava using stored user token
     * TODO: Build proper payload, handle GPX upload if available
     */
    public function create_activity( $user_id, $activity_post_id ) {
        $token = $this->ensure_token( $user_id );
        if ( is_wp_error( $token ) ) {
            return $token;
        }

        $access_token = $token['access_token'];

        $meta = get_post_meta( $activity_post_id );
        $name = sprintf( 'TVS Activity %d', $activity_post_id );
        $payload = array(
            'name' => $name,
            'type' => 'Run', // TODO: map activity type
            'start_date_local' => isset( $meta['started_at'][0] ) ? $meta['started_at'][0] : date( 'c' ),
            'elapsed_time' => isset( $meta['duration_s'][0] ) ? intval( $meta['duration_s'][0] ) : 0,
            'distance' => isset( $meta['distance_m'][0] ) ? floatval( $meta['distance_m'][0] ) : 0,
        );

        $resp = wp_remote_post( $this->api_base . '/activities', array(
            'headers' => array( 'Authorization' => 'Bearer ' . $access_token ),
            'body' => $payload,
            'timeout' => 20,
        ) );

        if ( is_wp_error( $resp ) ) {
            return $resp;
        }
        $body = json_decode( wp_remote_retrieve_body( $resp ), true );
        if ( empty( $body ) ) {
            return new WP_Error( 'invalid_response', 'Empty response from Strava' );
        }
        return $body;
    }
}

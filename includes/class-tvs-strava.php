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
    public function refresh_token( $user_id, $token ) {
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
        
        // Get activity type from meta (preferred) or taxonomy (fallback)
        $activity_type = 'VirtualRun'; // default - virtual activities
        $stored_type = get_post_meta( $activity_post_id, 'activity_type', true );
        if ( $stored_type ) {
            $activity_type = $this->map_activity_type( $stored_type );
        } else {
            // Fallback to taxonomy for backward compatibility
            $terms = wp_get_post_terms( $activity_post_id, 'tvs_activity_type', array( 'fields' => 'names' ) );
            if ( ! empty( $terms ) && ! is_wp_error( $terms ) ) {
                $activity_type = $this->map_activity_type( $terms[0] );
            }
        }
        
        // For virtual activities, ensure we use Virtual prefix (VirtualRun, VirtualRide)
        $is_virtual = get_post_meta( $activity_post_id, 'is_virtual', true );
        if ( $is_virtual && $is_virtual !== 'false' && $is_virtual !== '0' ) {
            if ( $activity_type === 'Run' ) {
                $activity_type = 'VirtualRun';
            } elseif ( $activity_type === 'Ride' ) {
                $activity_type = 'VirtualRide';
            } elseif ( $activity_type === 'Walk' ) {
                $activity_type = 'Walk'; // Walk stays as Walk even for virtual
            }
        }

        // Build activity name and template context
        $route_title = '';
        $route_url = '';
        $is_manual = get_post_meta( $activity_post_id, '_tvs_is_manual', true );
        
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
        
        // Build context with all available placeholders
        $context = array(
            'route_title'  => $route_title,
            'activity_id'  => $activity_post_id,
            'distance_km'  => $this->format_km_with_unit( $distance_m ),
            'duration_hms' => $this->format_hms_smart( $duration_s ),
            'date_local'   => $started_at ? date( 'Y-m-d H:i', strtotime( $started_at ) ) : date( 'Y-m-d H:i' ),
            'type'         => $activity_type,
            'route_url'    => $route_url,
        );
        
        // Add activity-specific placeholders
        if ( $stored_type === 'Swim' ) {
            $laps = (int) get_post_meta( $activity_post_id, '_tvs_laps', true );
            $pool_length = (int) get_post_meta( $activity_post_id, '_tvs_pool_length', true );
            $avg_pace = (int) get_post_meta( $activity_post_id, '_tvs_pace', true );
            
            $context['laps'] = $laps;
            $context['pool_length'] = $pool_length;
            $context['avg_pace_sec_lap'] = $avg_pace > 0 ? $avg_pace : '-';
        }
        
        if ( $stored_type === 'Workout' ) {
            $exercises_json = get_post_meta( $activity_post_id, '_tvs_manual_exercises', true );
            $exercises = $exercises_json ? json_decode( $exercises_json, true ) : array();
            
            $context['exercise_count'] = count( $exercises );
            
            // Build formatted exercise list
            $exercise_list_items = array();
            foreach ( $exercises as $idx => $ex ) {
                $name = isset( $ex['name'] ) ? $ex['name'] : 'Exercise';
                $sets = isset( $ex['sets'] ) ? $ex['sets'] : 0;
                $reps = isset( $ex['reps'] ) ? $ex['reps'] : 0;
                $weight = isset( $ex['weight'] ) ? $ex['weight'] : 0;
                $metric_type = isset( $ex['metric_type'] ) ? $ex['metric_type'] : 'reps';
                
                $line = sprintf( '%d. %s (%d × %d', $idx + 1, $name, $sets, $reps );
                if ( $metric_type === 'time' ) {
                    $line .= 's';
                }
                if ( $weight > 0 ) {
                    $line .= sprintf( ' @ %dkg', $weight );
                }
                $line .= ')';
                $exercise_list_items[] = $line;
            }
            $context['exercise_list'] = implode( "\n", $exercise_list_items );
        }
            
        // Check if activity has static map image attached
        $map_image_url = get_post_meta( $activity_post_id, '_tvs_map_image_url', true );
        $map_attachment_id = get_post_meta( $activity_post_id, '_tvs_map_image_attachment_id', true );
        if ( $map_attachment_id ) {
            // Use permanent WordPress attachment URL if available
            $attachment_url = wp_get_attachment_url( $map_attachment_id );
            if ( $attachment_url ) {
                $context['map_image_url'] = $attachment_url;
            }
        } elseif ( $map_image_url ) {
            // Fallback to direct Mapbox API URL
            $context['map_image_url'] = $map_image_url;
        }

        // Choose appropriate templates based on activity type
        if ( $stored_type === 'Swim' ) {
            // Swim-specific templates
            $default_title = 'Swim Activity';
            $default_desc = 'Swim session: {laps} laps × {pool_length}m = {distance_km} in {duration_hms}.\n\nAverage pace: {avg_pace_sec_lap} sec/lap';
            $title_tpl = get_option( 'tvs_strava_title_template_swim', $default_title );
            $desc_tpl  = get_option( 'tvs_strava_desc_template_swim', $default_desc );
        } elseif ( $stored_type === 'Workout' ) {
            // Workout-specific templates
            $default_title = 'Workout Session';
            $default_desc = 'Completed {exercise_count} exercises in {duration_hms}.\n\n{exercise_list}';
            $title_tpl = get_option( 'tvs_strava_title_template_workout', $default_title );
            $desc_tpl  = get_option( 'tvs_strava_desc_template_workout', $default_desc );
        } elseif ( ! $is_manual ) {
            // Virtual routes (Run, Walk, Hike)
            $default_title = 'TVS: {route_title}';
            $default_desc = 'I just completed a {type} activity from virtualsport.online: {route_title}. The virtual track is {distance_km} and I finished in {duration_hms}. Take a look at the route at: {route_url}';
            $title_tpl = get_option( 'tvs_strava_title_template_virtual', $default_title );
            $desc_tpl  = get_option( 'tvs_strava_desc_template_virtual', $default_desc );
            
            // Check if user disabled route URL for virtual activities
            $show_route_url = (bool) get_option( 'tvs_strava_show_route_url_virtual', true );
            if ( ! $show_route_url ) {
                // Remove route_url placeholder from context to avoid showing it
                $context['route_url'] = '';
            }
        } else {
            // Generic manual activity (shouldn't happen with current types, but fallback)
            $default_title = '{type} Activity';
            $default_desc = 'I completed a {type} activity: {distance_km} in {duration_hms}.';
            // Use old generic templates as fallback
            $title_tpl = get_option( 'tvs_strava_title_template', $default_title );
            $desc_tpl  = get_option( 'tvs_strava_desc_template', $default_desc );
        }
        
        $is_private = (bool) get_option( 'tvs_strava_private', true );

        $name = $this->render_template( $title_tpl, $context );
        if ( ! $name || trim( $name ) === '' ) {
            // Fallback based on activity type
            if ( $stored_type === 'Swim' ) {
                $name = 'Swim Activity';
            } elseif ( $stored_type === 'Workout' ) {
                $name = 'Workout Session';
            } elseif ( $is_manual ) {
                $name = $stored_type ? "{$stored_type} Activity" : 'Activity';
            } else {
                $name = $route_title ? "TVS: {$route_title}" : sprintf( 'TVS Activity %d', $activity_post_id );
            }
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
        $result = strtr( $tpl, $replacements );
        
        // Clean up any remaining empty placeholders or their surrounding text
        // Remove patterns like ": {route_title}" when route_title is empty
        $result = preg_replace('/:\s*\{\w+\}\s*\.?/', '', $result);
        // Remove patterns like "at: {route_url}" when route_url is empty
        $result = preg_replace('/\bat:\s*\{\w+\}/', '', $result);
        // Remove any leftover empty placeholders
        $result = preg_replace('/\{\w+\}/', '', $result);
        // Clean up multiple spaces and trailing punctuation
        $result = preg_replace('/\s+/', ' ', $result);
        $result = preg_replace('/\s+([.,;!?])/', '$1', $result);
        $result = trim( $result );
        
        return $result;
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
     * Map TVS activity type to Strava activity type (base mapping, virtualization applied separately)
     */
    protected function map_activity_type( $tvs_type ) {
        $map = array(
            'run' => 'Run',
            'ride' => 'Ride',
            'walk' => 'Walk',
            'hike' => 'Hike',
            'swim' => 'Swim',
            'workout' => 'WeightTraining',
            'ski' => 'NordicSki',
        );
        
        $lower = strtolower( trim( $tvs_type ) );
        return isset( $map[ $lower ] ) ? $map[ $lower ] : 'Run';
    }

    /**
     * Legacy alias for backward compatibility
     * @deprecated Use upload_activity() instead
     */
    public function create_activity( $user_id, $activity_post_id ) {
        return $this->upload_activity( $user_id, $activity_post_id );
    }

    /**
     * List athlete routes from Strava API
     * Returns [ 'items' => [ { id, name, distance_m, elevation_m, type, updated_at } ], 'total'?, 'totalPages'? ]
     */
    public function list_routes( $user_id, $page = 1, $per_page = 20 ) {
        $token = $this->ensure_token( $user_id );
        if ( is_wp_error( $token ) ) {
            return $token;
        }
        $access = $token['access'];

        $url = add_query_arg( array(
            'page' => max( 1, (int) $page ),
            'per_page' => max( 1, min( 50, (int) $per_page ) ),
        ), $this->api_base . '/athlete/routes' );

        $resp = wp_remote_get( $url, array(
            'headers' => array( 'Authorization' => 'Bearer ' . $access ),
            'timeout' => 15,
        ) );
        if ( is_wp_error( $resp ) ) {
            return $resp;
        }
        $code = wp_remote_retrieve_response_code( $resp );
        $body = json_decode( wp_remote_retrieve_body( $resp ), true );
        if ( $code === 401 ) {
            // try refresh once
            $refreshed = $this->refresh_token( $user_id, $token );
            if ( is_wp_error( $refreshed ) ) {
                return new WP_Error( 'unauthorized', 'Strava auth failed; please reconnect', array( 'status' => 401 ) );
            }
            $access = $refreshed['access'];
            $resp = wp_remote_get( $url, array(
                'headers' => array( 'Authorization' => 'Bearer ' . $access ),
                'timeout' => 15,
            ) );
            $code = wp_remote_retrieve_response_code( $resp );
            $body = json_decode( wp_remote_retrieve_body( $resp ), true );
        }
        if ( $code !== 200 ) {
            $msg = isset( $body['message'] ) ? $body['message'] : 'HTTP ' . $code;
            return new WP_Error( 'strava_error', 'Failed to list routes: ' . $msg, array( 'status' => $code ) );
        }

        $items = array();
        if ( is_array( $body ) ) {
            foreach ( $body as $r ) {
                $map_summary = ( isset( $r['map'] ) && is_array( $r['map'] ) && isset( $r['map']['summary_polyline'] ) ) ? (string) $r['map']['summary_polyline'] : null;
                $map_id      = ( isset( $r['map'] ) && is_array( $r['map'] ) && isset( $r['map']['id'] ) ) ? (string) $r['map']['id'] : null;
                $map_state   = ( isset( $r['map'] ) && is_array( $r['map'] ) && isset( $r['map']['resource_state'] ) ) ? $r['map']['resource_state'] : null;
                $items[] = array(
                    'id'                     => isset( $r['id'] ) ? (int) $r['id'] : null,
                    'name'                   => isset( $r['name'] ) ? (string) $r['name'] : '',
                    'distance_m'             => isset( $r['distance'] ) ? floatval( $r['distance'] ) : null,
                    'elevation_m'            => isset( $r['elevation_gain'] ) ? floatval( $r['elevation_gain'] ) : null,
                    'type'                   => isset( $r['type'] ) ? (string) $r['type'] : null,
                    'updated_at'             => isset( $r['updated_at'] ) ? (string) $r['updated_at'] : null,
                    'map_summary_polyline'   => $map_summary,
                    'map_id'                 => $map_id,
                    'map_resource_state'     => $map_state,
                );
            }
        }

        // Strava provides pagination via Link headers; we return items only
        return array( 'items' => $items );
    }

    /**
     * Get single route detail from Strava API
     */
    public function get_route( $user_id, $route_id ) {
        $token = $this->ensure_token( $user_id );
        if ( is_wp_error( $token ) ) {
            return $token;
        }
        $access = $token['access'];
        $url = $this->api_base . '/routes/' . intval( $route_id );

        $resp = wp_remote_get( $url, array(
            'headers' => array( 'Authorization' => 'Bearer ' . $access ),
            'timeout' => 15,
        ) );
        if ( is_wp_error( $resp ) ) {
            return $resp;
        }
        $code = wp_remote_retrieve_response_code( $resp );
        $body = json_decode( wp_remote_retrieve_body( $resp ), true );
        if ( $code === 401 ) {
            $refreshed = $this->refresh_token( $user_id, $token );
            if ( is_wp_error( $refreshed ) ) {
                return new WP_Error( 'unauthorized', 'Strava auth failed; please reconnect', array( 'status' => 401 ) );
            }
            $access = $refreshed['access'];
            $resp = wp_remote_get( $url, array(
                'headers' => array( 'Authorization' => 'Bearer ' . $access ),
                'timeout' => 15,
            ) );
            $code = wp_remote_retrieve_response_code( $resp );
            $body = json_decode( wp_remote_retrieve_body( $resp ), true );
        }
        if ( $code === 404 ) {
            return new WP_Error( 'not_found', 'Strava route not found', array( 'status' => 404 ) );
        }
        if ( $code !== 200 ) {
            $msg = isset( $body['message'] ) ? $body['message'] : 'HTTP ' . $code;
            return new WP_Error( 'strava_error', 'Failed to get route: ' . $msg, array( 'status' => $code ) );
        }
        return $body;
    }

    /**
     * List athlete activities. Optionally filter client-side to those with GPS.
     * Returns array( 'items' => [ { id, name, distance_m, elevation_m, moving_time_s, has_gps, start_date } ] )
     */
    public function list_activities( $user_id, $page = 1, $per_page = 20 ) {
        $token = $this->ensure_token( $user_id );
        if ( is_wp_error( $token ) ) {
            return $token;
        }
        $access = $token['access'];
        $url = add_query_arg( array(
            'page'     => max( 1, (int) $page ),
            'per_page' => max( 1, min( 50, (int) $per_page ) ),
        ), $this->api_base . '/athlete/activities' );

        $resp = wp_remote_get( $url, array( 'headers' => array( 'Authorization' => 'Bearer ' . $access ), 'timeout' => 20 ) );
        if ( is_wp_error( $resp ) ) return $resp;
        $code = wp_remote_retrieve_response_code( $resp );
        $body = json_decode( wp_remote_retrieve_body( $resp ), true );
        if ( $code === 401 ) {
            $refreshed = $this->refresh_token( $user_id, $token );
            if ( is_wp_error( $refreshed ) ) {
                return new WP_Error( 'unauthorized', 'Strava auth failed; please reconnect', array( 'status' => 401 ) );
            }
            $access = $refreshed['access'];
            $resp = wp_remote_get( $url, array( 'headers' => array( 'Authorization' => 'Bearer ' . $access ), 'timeout' => 20 ) );
            $code = wp_remote_retrieve_response_code( $resp );
            $body = json_decode( wp_remote_retrieve_body( $resp ), true );
        }
        if ( $code !== 200 ) {
            $msg = isset( $body['message'] ) ? $body['message'] : 'HTTP ' . $code;
            return new WP_Error( 'strava_error', 'Failed to list activities: ' . $msg, array( 'status' => $code ) );
        }
        $items = array();
        if ( is_array( $body ) ) {
            foreach ( $body as $a ) {
                $items[] = array(
                    'id'              => isset( $a['id'] ) ? (int) $a['id'] : null,
                    'name'            => isset( $a['name'] ) ? (string) $a['name'] : '',
                    'distance_m'      => isset( $a['distance'] ) ? floatval( $a['distance'] ) : null,
                    'elevation_m'     => isset( $a['total_elevation_gain'] ) ? floatval( $a['total_elevation_gain'] ) : null,
                    'moving_time_s'   => isset( $a['moving_time'] ) ? (int) $a['moving_time'] : null,
                    'has_gps'         => ! empty( $a['map']['summary_polyline'] ),
                    'start_date'      => isset( $a['start_date'] ) ? (string) $a['start_date'] : null,
                    'type'            => isset( $a['type'] ) ? (string) $a['type'] : null,
                );
            }
        }
        return array( 'items' => $items );
    }

    /** Get a single activity */
    public function get_activity( $user_id, $activity_id ) {
        $token = $this->ensure_token( $user_id );
        if ( is_wp_error( $token ) ) return $token;
        $access = $token['access'];
        $url = $this->api_base . '/activities/' . intval( $activity_id );
        $resp = wp_remote_get( $url, array( 'headers' => array( 'Authorization' => 'Bearer ' . $access ), 'timeout' => 20 ) );
        if ( is_wp_error( $resp ) ) return $resp;
        $code = wp_remote_retrieve_response_code( $resp );
        $body = json_decode( wp_remote_retrieve_body( $resp ), true );
        if ( $code === 401 ) {
            $refreshed = $this->refresh_token( $user_id, $token );
            if ( is_wp_error( $refreshed ) ) return new WP_Error( 'unauthorized', 'Strava auth failed; please reconnect', array( 'status' => 401 ) );
            $access = $refreshed['access'];
            $resp = wp_remote_get( $url, array( 'headers' => array( 'Authorization' => 'Bearer ' . $access ), 'timeout' => 20 ) );
            $code = wp_remote_retrieve_response_code( $resp );
            $body = json_decode( wp_remote_retrieve_body( $resp ), true );
        }
        if ( $code !== 200 ) {
            $msg = isset( $body['message'] ) ? $body['message'] : 'HTTP ' . $code;
            return new WP_Error( 'strava_error', 'Failed to get activity: ' . $msg, array( 'status' => $code ) );
        }
        return $body;
    }

    /** Get activity streams (latlng, altitude, time, distance) */
    public function get_activity_streams( $user_id, $activity_id ) {
        $token = $this->ensure_token( $user_id );
        if ( is_wp_error( $token ) ) return $token;
        $access = $token['access'];
        $url = $this->api_base . '/activities/' . intval( $activity_id ) . '/streams?keys=latlng,altitude,time,distance&key_by_type=true';
        $resp = wp_remote_get( $url, array( 'headers' => array( 'Authorization' => 'Bearer ' . $access ), 'timeout' => 25 ) );
        if ( is_wp_error( $resp ) ) return $resp;
        $code = wp_remote_retrieve_response_code( $resp );
        $body = json_decode( wp_remote_retrieve_body( $resp ), true );
        if ( $code === 401 ) {
            $refreshed = $this->refresh_token( $user_id, $token );
            if ( is_wp_error( $refreshed ) ) return new WP_Error( 'unauthorized', 'Strava auth failed; please reconnect', array( 'status' => 401 ) );
            $access = $refreshed['access'];
            $resp = wp_remote_get( $url, array( 'headers' => array( 'Authorization' => 'Bearer ' . $access ), 'timeout' => 25 ) );
            $code = wp_remote_retrieve_response_code( $resp );
            $body = json_decode( wp_remote_retrieve_body( $resp ), true );
        }
        if ( $code !== 200 || empty( $body ) ) {
            $msg = is_array( $body ) ? 'invalid streams' : (string) $body;
            return new WP_Error( 'strava_error', 'Failed to get streams: ' . $msg, array( 'status' => $code ) );
        }
        return $body; // associative array keyed by stream type
    }

    /** Fetch GPX for a Strava route */
    public function fetch_route_gpx( $user_id, $route_id ) {
        $token = $this->ensure_token( $user_id );
        if ( is_wp_error( $token ) ) return $token;
        $access = $token['access'];
        $url = $this->api_base . '/routes/' . intval( $route_id ) . '/export_gpx';
        $resp = wp_remote_get( $url, array( 'headers' => array( 'Authorization' => 'Bearer ' . $access ), 'timeout' => 30 ) );
        if ( is_wp_error( $resp ) ) return $resp;
        $code = wp_remote_retrieve_response_code( $resp );
        $body = wp_remote_retrieve_body( $resp );
        if ( $code === 401 ) {
            $refreshed = $this->refresh_token( $user_id, $token );
            if ( is_wp_error( $refreshed ) ) return new WP_Error( 'unauthorized', 'Strava auth failed; please reconnect', array( 'status' => 401 ) );
            $access = $refreshed['access'];
            $resp = wp_remote_get( $url, array( 'headers' => array( 'Authorization' => 'Bearer ' . $access ), 'timeout' => 30 ) );
            $code = wp_remote_retrieve_response_code( $resp );
            $body = wp_remote_retrieve_body( $resp );
        }
        if ( $code !== 200 || empty( $body ) ) {
            return new WP_Error( 'strava_error', 'Failed to fetch route GPX (HTTP ' . $code . ')' );
        }
        return $body; // raw GPX XML
    }

    /** Build GPX XML from streams */
    public function build_gpx_from_streams( $streams, $name = 'Activity' ) {
        if ( empty( $streams['latlng']['data'] ) ) {
            return new WP_Error( 'no_gps', 'No latlng stream available' );
        }
        $latlng  = $streams['latlng']['data'];
        $time    = isset( $streams['time']['data'] ) ? $streams['time']['data'] : array();
        $alt     = isset( $streams['altitude']['data'] ) ? $streams['altitude']['data'] : array();
        $nowIso  = gmdate( 'c' );
        $xml  = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
        $xml .= '<gpx version="1.1" creator="TVS" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">';
        $xml .= '<metadata><time>' . esc_html( $nowIso ) . '</time><name>' . esc_html( $name ) . '</name></metadata>';
        $xml .= '<trk><name>' . esc_html( $name ) . '</name><trkseg>';
        $count = count( $latlng );
        for ( $i = 0; $i < $count; $i++ ) {
            $pt = $latlng[$i];
            $lat = isset( $pt[0] ) ? floatval( $pt[0] ) : 0;
            $lng = isset( $pt[1] ) ? floatval( $pt[1] ) : 0;
            $ele = isset( $alt[$i] ) ? floatval( $alt[$i] ) : null;
            $t   = isset( $time[$i] ) ? (int) $time[$i] : null;
            $xml .= '<trkpt lat="' . $lat . '" lon="' . $lng . '">';
            if ( $ele !== null ) $xml .= '<ele>' . $ele . '</ele>';
            if ( $t !== null ) $xml .= '<time>' . esc_html( gmdate( 'c', $t ) ) . '</time>';
            $xml .= '</trkpt>';
        }
        $xml .= '</trkseg></trk></gpx>';
        return $xml;
    }

    /** Save GPX string as attachment and return attachment id */
    public function save_gpx_attachment( $post_id, $gpx_string, $filename = 'track.gpx' ) {
        if ( empty( $gpx_string ) ) {
            return new WP_Error( 'empty_gpx', 'Empty GPX content' );
        }
        $upload = wp_upload_dir();
        if ( ! empty( $upload['error'] ) ) {
            return new WP_Error( 'upload_dir', $upload['error'] );
        }
        $dir  = trailingslashit( $upload['path'] );
        $url  = trailingslashit( $upload['url'] );
        $base = sanitize_file_name( $filename );
        $path = $dir . $base;
        $ok = file_put_contents( $path, $gpx_string );
        if ( ! $ok ) {
            return new WP_Error( 'write_failed', 'Unable to write GPX file' );
        }
        $filetype = wp_check_filetype( $base, null );
        if ( empty( $filetype['type'] ) ) {
            $filetype['type'] = 'application/gpx+xml';
        }
        $attachment = array(
            'post_mime_type' => $filetype['type'],
            'post_title'     => preg_replace( '/\.[^.]+$/', '', $base ),
            'post_content'   => '',
            'post_status'    => 'inherit'
        );
        $attach_id = wp_insert_attachment( $attachment, $path, $post_id );
        if ( is_wp_error( $attach_id ) ) return $attach_id;
        require_once ABSPATH . 'wp-admin/includes/image.php';
        wp_update_attachment_metadata( $attach_id, wp_generate_attachment_metadata( $attach_id, $path ) );
        return $attach_id;
    }

    /**
     * Issue #21: Create manual activity on Strava (no GPS track)
     * Used for treadmill/indoor activities
     * 
     * @param int $user_id WordPress user ID
     * @param array $payload Activity data (name, type, elapsed_time, distance, trainer=1)
     * @return array|WP_Error Strava API response or error
     */
    public function create_manual_activity( $user_id, $payload ) {
        // Ensure token is valid
        $token = $this->ensure_token( $user_id );
        if ( is_wp_error( $token ) ) {
            return $token;
        }

        $access_token = $token['access'];

        // Build Strava API payload
        $strava_payload = array(
            'name' => isset( $payload['name'] ) ? $payload['name'] : 'Manual Activity',
            'type' => isset( $payload['type'] ) ? $this->map_activity_type( $payload['type'] ) : 'Run',
            'start_date_local' => isset( $payload['start_date_local'] ) ? $payload['start_date_local'] : date( 'c' ),
            'elapsed_time' => isset( $payload['elapsed_time'] ) ? intval( $payload['elapsed_time'] ) : 0,
            'distance' => isset( $payload['distance'] ) ? floatval( $payload['distance'] ) : 0,
            'trainer' => 1, // Mark as indoor/trainer activity
            'description' => isset( $payload['description'] ) ? $payload['description'] : '',
        );

        // Add optional fields
        if ( isset( $payload['private'] ) ) {
            $strava_payload['private'] = (bool) $payload['private'];
        }

        error_log( 'TVS Strava: Creating manual activity: ' . wp_json_encode( $strava_payload ) );

        // POST to Strava API
        $response = wp_remote_post( $this->api_base . '/activities', array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $access_token,
                'Content-Type' => 'application/json',
            ),
            'body' => wp_json_encode( $strava_payload ),
            'timeout' => 30,
        ) );

        if ( is_wp_error( $response ) ) {
            error_log( 'TVS Strava: Manual activity creation failed: ' . $response->get_error_message() );
            return $response;
        }

        $code = wp_remote_retrieve_response_code( $response );
        $body = json_decode( wp_remote_retrieve_body( $response ), true );

        if ( $code !== 201 ) {
            $error_msg = isset( $body['message'] ) ? $body['message'] : 'Unknown error';
            error_log( "TVS Strava: Manual activity creation failed (HTTP {$code}): {$error_msg}" );
            
            // Handle specific errors
            if ( $code === 401 ) {
                return new WP_Error( 'strava_auth', 'Strava authentication failed. Please reconnect.', array( 'status' => 401 ) );
            }
            if ( $code === 429 ) {
                return new WP_Error( 'strava_rate_limit', 'Strava API rate limit exceeded. Please try again later.', array( 'status' => 429 ) );
            }
            
            return new WP_Error( 'strava_error', $error_msg, array( 'status' => $code ) );
        }

        error_log( 'TVS Strava: Manual activity created successfully: ID ' . ( $body['id'] ?? 'unknown' ) );
        return $body;
    }
}

<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/** Helper: get route meta keys as array */
function tvs_route_meta_keys() {
    return array(
        'distance_m',
        'elevation_m',
        'duration_s',
        'gpx_url',
        'vimeo_id',
        'surface',
        'difficulty',
        'location',
        'season',
        // Enriched/derived metadata
        'route_name',
        'activity_date',
        'route_created_at',
        'year',
        'start_lat',
        'start_lng',
        'end_lat',
        'end_lng',
        'sport_type',
        'strava_type',
        'strava_sub_type',
        'summary_polyline',
        'polyline',
        'map_id',
        'map_resource_state',
        'timezone',
    );
}

/** Sanitize route meta before saving */
function tvs_sanitize_route_meta( $data ) {
    $out = array();
    foreach ( tvs_route_meta_keys() as $k ) {
        if ( isset( $data[ $k ] ) ) {
            // Numeric fields should be normalized to numbers
            if ( in_array( $k, array( 'distance_m', 'elevation_m', 'duration_s' ), true ) ) {
                $out[ $k ] = is_numeric( $data[ $k ] ) ? $data[ $k ] + 0 : sanitize_text_field( $data[ $k ] );
            } else {
                $out[ $k ] = sanitize_text_field( $data[ $k ] );
            }
        }
    }
    return $out;
}

/**
 * Check if current user is connected to Strava
 * 
 * @param int $user_id Optional user ID (defaults to current user)
 * @return bool True if connected, false otherwise
 */
function tvs_is_strava_connected( $user_id = null ) {
    return TVS_User_Profile::is_strava_connected( $user_id );
}

/**
 * Get Strava connection status for a user
 * 
 * @param int $user_id Optional user ID (defaults to current user)
 * @return array Status with keys: connected, athlete_name, athlete_id, expires_at, scope
 */
function tvs_get_strava_status( $user_id = null ) {
    return TVS_User_Profile::get_strava_status( $user_id );
}

/**
 * Get Strava athlete data for a user
 * 
 * @param int $user_id Optional user ID (defaults to current user)
 * @return array|null Athlete data or null
 */
function tvs_get_strava_athlete( $user_id = null ) {
    return TVS_User_Profile::get_strava_athlete( $user_id );
}

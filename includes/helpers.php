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

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
        // Weather data (cached)
        'weather_data',
        'weather_cached_at',
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

/**
 * Decode a Google-encoded polyline string into an array of [lat, lng] pairs.
 * @param string $encoded
 * @return array<int, array{0: float, 1: float}>
 */
function tvs_decode_polyline( $encoded ) {
    $encoded = (string) $encoded;
    $len = strlen( $encoded );
    $index = 0; $lat = 0; $lng = 0; $points = array();
    while ( $index < $len ) {
        $b = 0; $shift = 0; $result = 0;
        do {
            $b = ord( $encoded[ $index++ ] ) - 63;
            $result |= ( $b & 0x1F ) << $shift;
            $shift += 5;
        } while ( $b >= 0x20 && $index < $len );
        $dlat = ( ( $result & 1 ) ? ~( $result >> 1 ) : ( $result >> 1 ) );
        $lat += $dlat;

        $shift = 0; $result = 0;
        do {
            $b = ord( $encoded[ $index++ ] ) - 63;
            $result |= ( $b & 0x1F ) << $shift;
            $shift += 5;
        } while ( $b >= 0x20 && $index < $len );
        $dlng = ( ( $result & 1 ) ? ~( $result >> 1 ) : ( $result >> 1 ) );
        $lng += $dlng;

        $points[] = array( $lat / 1e5, $lng / 1e5 );
    }
    return $points;
}

/**
 * Convert Frost API weather symbol code to Norwegian description and emoji
 * Based on WMO weather code standard used by MET Norway
 * 
 * @param int|string $code Weather symbol code from Frost API
 * @return array ['text' => 'Description', 'emoji' => '☀️']
 */
function tvs_weather_symbol_to_text( $code ) {
    $code = intval( $code );
    
    // Mapping based on MET Norway / yr.no symbol codes
    // https://api.met.no/weatherapi/weathericon/2.0/documentation
    $symbols = array(
        1  => array( 'text' => 'Klarvær',           'emoji' => '☀️' ),
        2  => array( 'text' => 'Lettskyet',         'emoji' => '🌤️' ),
        3  => array( 'text' => 'Delvis skyet',      'emoji' => '⛅' ),
        4  => array( 'text' => 'Overskyet',         'emoji' => '☁️' ),
        5  => array( 'text' => 'Regnbyger',         'emoji' => '🌦️' ),
        6  => array( 'text' => 'Regnbyger og torden', 'emoji' => '⛈️' ),
        7  => array( 'text' => 'Sluddbyger',        'emoji' => '🌨️' ),
        8  => array( 'text' => 'Snøbyger',          'emoji' => '🌨️' ),
        9  => array( 'text' => 'Regn',              'emoji' => '🌧️' ),
        10 => array( 'text' => 'Kraftig regn',      'emoji' => '🌧️' ),
        11 => array( 'text' => 'Regn og torden',    'emoji' => '⛈️' ),
        12 => array( 'text' => 'Sludd',             'emoji' => '🌨️' ),
        13 => array( 'text' => 'Snø',               'emoji' => '❄️' ),
        14 => array( 'text' => 'Snø og torden',     'emoji' => '⛈️' ),
        15 => array( 'text' => 'Tåke',              'emoji' => '🌫️' ),
        20 => array( 'text' => 'Regnbyger',         'emoji' => '🌦️' ),
        21 => array( 'text' => 'Regnbyger og torden', 'emoji' => '⛈️' ),
        22 => array( 'text' => 'Sluddbyger',        'emoji' => '🌨️' ),
        23 => array( 'text' => 'Snøbyger',          'emoji' => '🌨️' ),
        24 => array( 'text' => 'Lett regn',         'emoji' => '🌦️' ),
        25 => array( 'text' => 'Kraftig regn',      'emoji' => '🌧️' ),
        26 => array( 'text' => 'Lett regn og torden', 'emoji' => '⛈️' ),
        27 => array( 'text' => 'Sludd',             'emoji' => '🌨️' ),
        28 => array( 'text' => 'Lett snø',          'emoji' => '🌨️' ),
        29 => array( 'text' => 'Snø og torden',     'emoji' => '⛈️' ),
    );
    
    if ( isset( $symbols[ $code ] ) ) {
        return $symbols[ $code ];
    }
    
    // Default fallback
    return array( 'text' => 'Ukjent', 'emoji' => '🌡️' );
}

/**
 * Convert WMO synoptic weather code (00-99) to English description and emoji with i18n support
 * Used by Frost API's weather_type_automatic element
 * 
 * @param int $code WMO synoptic code (00-99)
 * @return array ['text' => 'Description', 'emoji' => '☀️', 'icon' => 'clearsky_day.svg']
 */
function tvs_wmo_code_to_text( $code ) {
    $code = intval( $code );
    
    // WMO Present Weather codes (simplified mapping)
    // https://www.nodc.noaa.gov/archive/arc0021/0002199/1.1/data/0-data/HTML/WMO-CODE/WMO4677.HTM
    if ( $code === 0 ) {
        return array( 'text' => __( 'Clear sky', 'tvs-virtual-sports' ), 'emoji' => '☀️', 'icon' => 'clearsky_day.svg' );
    }
    
    // 1-9: Cloud development, dust, haze
    if ( $code <= 9 ) {
        if ( $code <= 2 ) {
            return array( 'text' => __( 'Fair', 'tvs-virtual-sports' ), 'emoji' => '🌤️', 'icon' => 'fair_day.svg' );
        }
        if ( $code <= 4 ) {
            return array( 'text' => __( 'Partly cloudy', 'tvs-virtual-sports' ), 'emoji' => '⛅', 'icon' => 'partlycloudy_day.svg' );
        }
        return array( 'text' => __( 'Haze', 'tvs-virtual-sports' ), 'emoji' => '🌫️', 'icon' => 'fog.svg' );
    }
    
    // 10-19: Non-precipitation events (mist, fog, etc.)
    if ( $code <= 19 ) {
        if ( $code >= 10 && $code <= 12 ) {
            return array( 'text' => __( 'Mist', 'tvs-virtual-sports' ), 'emoji' => '🌫️', 'icon' => 'fog.svg' );
        }
        return array( 'text' => __( 'Fog', 'tvs-virtual-sports' ), 'emoji' => '🌫️', 'icon' => 'fog.svg' );
    }
    
    // 20-29: Precipitation in past hour
    if ( $code <= 29 ) {
        if ( $code <= 25 ) {
            return array( 'text' => __( 'Recent rain', 'tvs-virtual-sports' ), 'emoji' => '🌦️', 'icon' => 'lightrain.svg' );
        }
        return array( 'text' => __( 'Recent snow', 'tvs-virtual-sports' ), 'emoji' => '🌨️', 'icon' => 'lightsnow.svg' );
    }
    
    // 30-39: Dust/sand storms
    if ( $code <= 39 ) {
        return array( 'text' => __( 'Dust or haze', 'tvs-virtual-sports' ), 'emoji' => '🌫️', 'icon' => 'fog.svg' );
    }
    
    // 40-49: Fog
    if ( $code <= 49 ) {
        return array( 'text' => __( 'Fog', 'tvs-virtual-sports' ), 'emoji' => '🌫️', 'icon' => 'fog.svg' );
    }
    
    // 50-59: Drizzle
    if ( $code <= 59 ) {
        if ( $code <= 51 ) {
            return array( 'text' => __( 'Light drizzle', 'tvs-virtual-sports' ), 'emoji' => '🌦️', 'icon' => 'lightrain.svg' );
        }
        if ( $code <= 55 ) {
            return array( 'text' => __( 'Drizzle', 'tvs-virtual-sports' ), 'emoji' => '🌧️', 'icon' => 'rain.svg' );
        }
        return array( 'text' => __( 'Freezing drizzle', 'tvs-virtual-sports' ), 'emoji' => '🌧️', 'icon' => 'rain.svg' );
    }
    
    // 60-69: Rain
    if ( $code <= 69 ) {
        if ( $code <= 61 ) {
            return array( 'text' => __( 'Light rain', 'tvs-virtual-sports' ), 'emoji' => '🌦️', 'icon' => 'lightrain.svg' );
        }
        if ( $code <= 65 ) {
            return array( 'text' => __( 'Rain', 'tvs-virtual-sports' ), 'emoji' => '🌧️', 'icon' => 'rain.svg' );
        }
        return array( 'text' => __( 'Freezing rain', 'tvs-virtual-sports' ), 'emoji' => '🌧️', 'icon' => 'rain.svg' );
    }
    
    // 70-79: Snow
    if ( $code <= 79 ) {
        if ( $code <= 71 ) {
            return array( 'text' => __( 'Light snow', 'tvs-virtual-sports' ), 'emoji' => '🌨️', 'icon' => 'lightsnow.svg' );
        }
        if ( $code <= 75 ) {
            return array( 'text' => __( 'Snow', 'tvs-virtual-sports' ), 'emoji' => '❄️', 'icon' => 'snow.svg' );
        }
        return array( 'text' => __( 'Snow grains', 'tvs-virtual-sports' ), 'emoji' => '❄️', 'icon' => 'heavysnow.svg' );
    }
    
    // 80-89: Showers
    if ( $code <= 89 ) {
        if ( $code <= 81 ) {
            return array( 'text' => __( 'Rain showers', 'tvs-virtual-sports' ), 'emoji' => '🌦️', 'icon' => 'lightrain.svg' );
        }
        if ( $code <= 85 ) {
            return array( 'text' => __( 'Sleet showers', 'tvs-virtual-sports' ), 'emoji' => '🌨️', 'icon' => 'lightsnow.svg' );
        }
        return array( 'text' => __( 'Snow showers', 'tvs-virtual-sports' ), 'emoji' => '🌨️', 'icon' => 'snow.svg' );
    }
    
    // 90-99: Thunderstorms
    if ( $code <= 99 ) {
        if ( $code <= 94 ) {
            return array( 'text' => __( 'Thunderstorm', 'tvs-virtual-sports' ), 'emoji' => '⛈️', 'icon' => 'lightrainandthunder.svg' );
        }
        if ( $code <= 96 ) {
            return array( 'text' => __( 'Thunderstorm with hail', 'tvs-virtual-sports' ), 'emoji' => '⛈️', 'icon' => 'rainandthunder.svg' );
        }
        return array( 'text' => __( 'Heavy thunderstorm', 'tvs-virtual-sports' ), 'emoji' => '⛈️', 'icon' => 'rainandthunder.svg' );
    }
    
    // Fallback
    return array( 'text' => __( 'Unknown', 'tvs-virtual-sports' ), 'emoji' => '🌡️', 'icon' => 'cloudy.svg' );
}


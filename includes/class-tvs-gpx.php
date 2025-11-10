<?php
/**
 * GPX Parser for Virtual Training
 * 
 * Parses GPX files and extracts data needed for map animation:
 * - Coordinates (lat/lng) for route path
 * - Elevation profile for stats
 * - Total distance calculation
 * - Bounding box for map viewport
 * 
 * @package TVS_Virtual_Sports
 */

class TVS_GPX {
    
    /**
     * Parse GPX file from URL or file path
     * 
     * @param string $source URL or file path to GPX file
     * @return array|WP_Error Parsed data or error
     */
    public function parse( $source ) {
        // Load GPX content
        $content = $this->load_gpx( $source );
        if ( is_wp_error( $content ) ) {
            return $content;
        }
        
        // Parse XML
        libxml_use_internal_errors( true );
        $xml = simplexml_load_string( $content );
        
        if ( $xml === false ) {
            $errors = libxml_get_errors();
            $msg = ! empty( $errors ) ? $errors[0]->message : 'Invalid XML';
            libxml_clear_errors();
            return new WP_Error( 'parse_error', 'Failed to parse GPX: ' . $msg );
        }
        
        // Register GPX namespace
        $namespaces = $xml->getNamespaces( true );
        $gpx_ns = isset( $namespaces[''] ) ? $namespaces[''] : 'http://www.topografix.com/GPX/1/1';
        
        // Extract track points
        $points = $this->extract_track_points( $xml, $gpx_ns );
        
        if ( empty( $points ) ) {
            return new WP_Error( 'no_data', 'No track points found in GPX file' );
        }
        
        // Calculate distance
        $total_distance_m = $this->calculate_distance( $points );
        
        // Extract elevation data
        $elevation = $this->extract_elevation( $points );
        
        // Calculate bounding box
        $bounds = $this->calculate_bounds( $points );
        
        // Simplify points for performance (keep every Nth point for large tracks)
        $simplified = $this->simplify_points( $points, 500 ); // Max 500 points
        
        return array(
            'points' => $simplified,
            'distance_m' => $total_distance_m,
            'distance_km' => round( $total_distance_m / 1000, 2 ),
            'elevation' => $elevation,
            'bounds' => $bounds,
            'point_count' => count( $points ),
            'simplified_count' => count( $simplified ),
        );
    }
    
    /**
     * Load GPX content from URL or file path
     */
    private function load_gpx( $source ) {
        // Check if URL
        if ( filter_var( $source, FILTER_VALIDATE_URL ) ) {
            $response = wp_remote_get( $source, array( 'timeout' => 30 ) );
            
            if ( is_wp_error( $response ) ) {
                return $response;
            }
            
            $code = wp_remote_retrieve_response_code( $response );
            if ( $code !== 200 ) {
                return new WP_Error( 'http_error', 'Failed to fetch GPX (HTTP ' . $code . ')' );
            }
            
            return wp_remote_retrieve_body( $response );
        }
        
        // Try as file path
        if ( file_exists( $source ) ) {
            $content = file_get_contents( $source );
            if ( $content === false ) {
                return new WP_Error( 'read_error', 'Failed to read GPX file' );
            }
            return $content;
        }
        
        return new WP_Error( 'invalid_source', 'Invalid GPX source (not a valid URL or file path)' );
    }
    
    /**
     * Extract track points from GPX XML
     */
    private function extract_track_points( $xml, $namespace ) {
        $points = array();
        
        // Try different possible structures: trk/trkseg/trkpt or rte/rtept
        $xml->registerXPathNamespace( 'gpx', $namespace );
        
        // Try track points first
        $trkpts = $xml->xpath( '//gpx:trkpt' );
        if ( empty( $trkpts ) ) {
            // Try without namespace
            $trkpts = $xml->xpath( '//trkpt' );
        }
        
        if ( ! empty( $trkpts ) ) {
            foreach ( $trkpts as $pt ) {
                $lat = (float) $pt['lat'];
                $lng = (float) $pt['lon'];
                $ele = isset( $pt->ele ) ? (float) $pt->ele : null;
                
                $points[] = array(
                    'lat' => $lat,
                    'lng' => $lng,
                    'ele' => $ele,
                );
            }
        }
        
        // Fallback: try route points
        if ( empty( $points ) ) {
            $rtepts = $xml->xpath( '//gpx:rtept' );
            if ( empty( $rtepts ) ) {
                $rtepts = $xml->xpath( '//rtept' );
            }
            
            if ( ! empty( $rtepts ) ) {
                foreach ( $rtepts as $pt ) {
                    $lat = (float) $pt['lat'];
                    $lng = (float) $pt['lon'];
                    $ele = isset( $pt->ele ) ? (float) $pt->ele : null;
                    
                    $points[] = array(
                        'lat' => $lat,
                        'lng' => $lng,
                        'ele' => $ele,
                    );
                }
            }
        }
        
        return $points;
    }
    
    /**
     * Calculate total distance using Haversine formula
     */
    private function calculate_distance( $points ) {
        $total = 0.0;
        $count = count( $points );
        
        for ( $i = 1; $i < $count; $i++ ) {
            $total += $this->haversine_distance(
                $points[ $i - 1 ]['lat'],
                $points[ $i - 1 ]['lng'],
                $points[ $i ]['lat'],
                $points[ $i ]['lng']
            );
        }
        
        return $total;
    }
    
    /**
     * Haversine formula for distance between two points on Earth
     * Returns distance in meters
     */
    private function haversine_distance( $lat1, $lng1, $lat2, $lng2 ) {
        $earth_radius = 6371000; // meters
        
        $lat1_rad = deg2rad( $lat1 );
        $lat2_rad = deg2rad( $lat2 );
        $delta_lat = deg2rad( $lat2 - $lat1 );
        $delta_lng = deg2rad( $lng2 - $lng1 );
        
        $a = sin( $delta_lat / 2 ) * sin( $delta_lat / 2 ) +
             cos( $lat1_rad ) * cos( $lat2_rad ) *
             sin( $delta_lng / 2 ) * sin( $delta_lng / 2 );
        
        $c = 2 * atan2( sqrt( $a ), sqrt( 1 - $a ) );
        
        return $earth_radius * $c;
    }
    
    /**
     * Extract elevation data and statistics
     */
    private function extract_elevation( $points ) {
        $elevations = array();
        $min = null;
        $max = null;
        $gain = 0.0;
        $loss = 0.0;
        
        foreach ( $points as $i => $pt ) {
            if ( $pt['ele'] === null ) {
                continue;
            }
            
            $ele = $pt['ele'];
            $elevations[] = $ele;
            
            if ( $min === null || $ele < $min ) {
                $min = $ele;
            }
            if ( $max === null || $ele > $max ) {
                $max = $ele;
            }
            
            // Calculate gain/loss
            if ( $i > 0 && isset( $points[ $i - 1 ]['ele'] ) && $points[ $i - 1 ]['ele'] !== null ) {
                $diff = $ele - $points[ $i - 1 ]['ele'];
                if ( $diff > 0 ) {
                    $gain += $diff;
                } else {
                    $loss += abs( $diff );
                }
            }
        }
        
        return array(
            'min' => $min !== null ? round( $min, 1 ) : null,
            'max' => $max !== null ? round( $max, 1 ) : null,
            'gain' => round( $gain, 1 ),
            'loss' => round( $loss, 1 ),
            'samples' => $elevations,
        );
    }
    
    /**
     * Calculate bounding box for map viewport
     */
    private function calculate_bounds( $points ) {
        $min_lat = $max_lat = $points[0]['lat'];
        $min_lng = $max_lng = $points[0]['lng'];
        
        foreach ( $points as $pt ) {
            if ( $pt['lat'] < $min_lat ) $min_lat = $pt['lat'];
            if ( $pt['lat'] > $max_lat ) $max_lat = $pt['lat'];
            if ( $pt['lng'] < $min_lng ) $min_lng = $pt['lng'];
            if ( $pt['lng'] > $max_lng ) $max_lng = $pt['lng'];
        }
        
        return array(
            'sw' => array( $min_lng, $min_lat ), // [lng, lat] for Mapbox
            'ne' => array( $max_lng, $max_lat ),
            'center' => array(
                ( $min_lng + $max_lng ) / 2,
                ( $min_lat + $max_lat ) / 2,
            ),
        );
    }
    
    /**
     * Simplify points using basic sampling
     * For large tracks, keep every Nth point to reduce payload
     */
    private function simplify_points( $points, $max_points = 500 ) {
        $count = count( $points );
        
        if ( $count <= $max_points ) {
            return $points;
        }
        
        $simplified = array();
        $step = $count / $max_points;
        
        // Always include first point
        $simplified[] = $points[0];
        
        // Sample evenly
        for ( $i = 1; $i < $count - 1; $i++ ) {
            if ( $i % (int) ceil( $step ) === 0 ) {
                $simplified[] = $points[ $i ];
            }
        }
        
        // Always include last point
        $simplified[] = $points[ $count - 1 ];
        
        return $simplified;
    }
}

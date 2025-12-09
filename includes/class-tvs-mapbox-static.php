<?php
/**
 * Mapbox Static Images API helper
 * Generates static map images from routes (polyline, GPX points) for use as featured images
 * and activity thumbnails for sharing.
 * 
 * API Documentation: https://docs.mapbox.com/api/maps/static-images/
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class TVS_Mapbox_Static {
    
    /**
     * Mapbox Static Images API base URL
     */
    const API_BASE = 'https://api.mapbox.com/styles/v1';
    
    /**
     * Default map style
     */
    const DEFAULT_STYLE = 'mapbox/outdoors-v12';
    
    /**
     * Get Mapbox access token from options
     */
    private function get_access_token() {
        $token = get_option( 'tvs_mapbox_access_token', '' );
        if ( empty( $token ) ) {
            return new WP_Error( 'no_token', 'Mapbox access token not configured' );
        }
        return $token;
    }
    
    /**
     * Generate static map image URL from encoded polyline
     * 
     * @param string $polyline Encoded polyline (Strava/Mapbox format)
     * @param array $options Configuration options:
     *   - width: Image width in pixels (default: 1200)
     *   - height: Image height in pixels (default: 800)
     *   - style: Mapbox style ID (default: outdoors-v12)
     *   - stroke_color: Line color in hex (default: F56565 - red)
     *   - stroke_width: Line width in pixels (default: 3)
     *   - stroke_opacity: Line opacity 0-1 (default: 0.9)
     *   - padding: Padding around route in pixels (default: 50)
     *   - watermark_text: Optional watermark text (e.g., "TVS Virtual Sports")
     *   - watermark_position: Position of watermark (default: bottom-right)
     * @return string|WP_Error Static image URL or error
     */
    public function generate_from_polyline( $polyline, $options = array() ) {
        $token = $this->get_access_token();
        if ( is_wp_error( $token ) ) {
            return $token;
        }
        
        // Merge with defaults
        $defaults = array(
            'width'              => 1200,
            'height'             => 800,
            'style'              => self::DEFAULT_STYLE,
            'stroke_color'       => 'F56565', // Red
            'stroke_width'       => 3,
            'stroke_opacity'     => 0.9,
            'padding'            => 50,
            'watermark_text'     => '',
            'watermark_position' => 'bottom-right',
        );
        $opts = wp_parse_args( $options, $defaults );
        
        // Validate polyline is not empty
        if ( empty( $polyline ) || ! is_string( $polyline ) ) {
            return new WP_Error( 'invalid_polyline', 'Polyline is empty or invalid' );
        }
        
        error_log( 'TVS Mapbox: Using original Strava polyline, length: ' . strlen($polyline) . ' chars' );
        
        // Use Strava polyline directly WITHOUT any re-encoding
        // According to Mapbox docs: path-{width}+{color}-{opacity}({polyline})
        // The polyline should be the raw encoded string (NOT url-encoded yet)
        $overlay_raw = sprintf(
            'path-%d+%s-%.1f(%s)',
            $opts['stroke_width'],
            $opts['stroke_color'],
            $opts['stroke_opacity'],
            $polyline  // Raw Strava polyline
        );
        
        // URL-encode the overlay once (required by Mapbox Static API)
        $overlay = rawurlencode( $overlay_raw );
        
        // Add watermark as custom marker if text provided
        // Note: Mapbox doesn't support text overlays directly in Static API
        // We'll add a small transparent marker at the position (limited functionality)
        // For proper watermark, we'd need to fetch the image and add text via PHP GD/Imagick
        
        // Build URL
        // Format: https://api.mapbox.com/styles/v1/{username}/{style_id}/static/{overlay}/auto/{width}x{height}?access_token={token}
        
        $url = sprintf(
            '%s/%s/static/%s/auto/%dx%d?padding=%d&access_token=%s',
            self::API_BASE,
            $opts['style'],
            $overlay,  // Already URL-encoded overlay
            $opts['width'],
            $opts['height'],
            $opts['padding'],
            $token
        );
        
        // Debug: Log URL without token
        $debug_url = substr( $url, 0, strrpos( $url, '&access_token=' ) );
        error_log( 'TVS Mapbox: Full URL (no token, first 300 chars): ' . substr( $debug_url, 0, 300 ) );
        
        return $url;
    }
    
    /**
     * Generate static map image URL from GPX coordinates array
     * 
     * @param array $coordinates Array of [lng, lat] coordinate pairs
     * @param array $options Same options as generate_from_polyline()
     * @return string|WP_Error Static image URL or error
     */
    public function generate_from_coordinates( $coordinates, $options = array() ) {
        if ( empty( $coordinates ) || ! is_array( $coordinates ) ) {
            return new WP_Error( 'invalid_coordinates', 'Coordinates array is empty or invalid' );
        }
        
        // Convert coordinates to encoded polyline
        $polyline = $this->encode_polyline( $coordinates );
        if ( is_wp_error( $polyline ) ) {
            return $polyline;
        }
        
        return $this->generate_from_polyline( $polyline, $options );
    }
    
    /**
     * Encode coordinates to polyline format (Google Encoded Polyline)
     * Google Polyline encoding uses lat,lng order (same as both Mapbox and Strava)
     * 
     * @param array $coordinates Array of [lat, lng] coordinate pairs
     * @return string|WP_Error Encoded polyline
     */
    private function encode_polyline( $coordinates ) {
        if ( empty( $coordinates ) ) {
            return new WP_Error( 'no_coords', 'No coordinates to encode' );
        }
        
        $encoded = '';
        $prev_lat = 0;
        $prev_lng = 0;
        
        foreach ( $coordinates as $coord ) {
            if ( ! isset( $coord[0] ) || ! isset( $coord[1] ) ) {
                continue; // Skip invalid coordinates
            }
            
            $lat = $coord[0]; // Latitude (first element in [lat, lng] pair)
            $lng = $coord[1]; // Longitude (second element)
            
            // Convert to integer (multiply by 1e5 and round)
            $lat_int = (int) round( $lat * 1e5 );
            $lng_int = (int) round( $lng * 1e5 );
            
            // Calculate differences
            $d_lat = $lat_int - $prev_lat;
            $d_lng = $lng_int - $prev_lng;
            
            // Encode latitude and longitude (lat first, then lng)
            $encoded .= $this->encode_number( $d_lat );
            $encoded .= $this->encode_number( $d_lng );
            
            $prev_lat = $lat_int;
            $prev_lng = $lng_int;
        }
        
        return $encoded;
    }
    
    /**
     * Encode a single number for polyline algorithm
     * 
     * @param int $num Number to encode
     * @return string Encoded string
     */
    private function encode_number( $num ) {
        // Left shift the signed integer
        $encoded_num = $num << 1;
        
        // If negative, invert
        if ( $num < 0 ) {
            $encoded_num = ~$encoded_num;
        }
        
        $encoded = '';
        while ( $encoded_num >= 0x20 ) {
            $next_chunk = ( $encoded_num & 0x1f ) | 0x20;
            $encoded .= chr( $next_chunk + 63 );
            $encoded_num >>= 5;
        }
        
        $encoded .= chr( $encoded_num + 63 );
        return $encoded;
    }
    
    /**
     * Decode polyline to array of [lat, lng] coordinates
     * Google Polyline encoding uses lat,lng order (same as Strava)
     * 
     * @param string $polyline Encoded polyline
     * @return array Array of [lat, lng] coordinate pairs
     */
    private function decode_polyline( $polyline ) {
        $coordinates = array();
        $index = 0;
        $len = strlen( $polyline );
        $lat = 0;
        $lng = 0;
        
        while ( $index < $len ) {
            // Decode latitude
            $shift = 0;
            $result = 0;
            do {
                $b = ord( $polyline[ $index++ ] ) - 63;
                $result |= ( $b & 0x1f ) << $shift;
                $shift += 5;
            } while ( $b >= 0x20 && $index < $len );
            $dlat = ( $result & 1 ) ? ~( $result >> 1 ) : ( $result >> 1 );
            $lat += $dlat;
            
            // Decode longitude
            $shift = 0;
            $result = 0;
            do {
                if ( $index >= $len ) break; // Prevent out of bounds
                $b = ord( $polyline[ $index++ ] ) - 63;
                $result |= ( $b & 0x1f ) << $shift;
                $shift += 5;
            } while ( $b >= 0x20 && $index < $len );
            $dlng = ( $result & 1 ) ? ~( $result >> 1 ) : ( $result >> 1 );
            $lng += $dlng;
            
            // Return in [lat, lng] order (Google Polyline standard)
            $coordinates[] = array( $lat / 1e5, $lng / 1e5 );
        }
        
        return $coordinates;
    }
    
    /**
     * Download static map image and save as WordPress attachment
     * 
     * @param int $post_id Post ID to attach image to
     * @param string $image_url Static image URL
     * @param string $filename Filename for attachment (e.g., "route-12345.png")
     * @param string $title Image title (default: "Route Map")
     * @return int|WP_Error Attachment ID or error
     */
    public function save_as_attachment( $post_id, $image_url, $filename, $title = 'Route Map' ) {
        require_once( ABSPATH . 'wp-admin/includes/file.php' );
        require_once( ABSPATH . 'wp-admin/includes/media.php' );
        require_once( ABSPATH . 'wp-admin/includes/image.php' );
        
        // Download image to temp file
        $temp_file = download_url( $image_url );
        if ( is_wp_error( $temp_file ) ) {
            return new WP_Error( 'download_failed', 'Failed to download map image: ' . $temp_file->get_error_message() );
        }
        
        // Prepare file array
        $file_array = array(
            'name'     => $filename,
            'tmp_name' => $temp_file,
        );
        
        // Move file to uploads directory and create attachment
        $attachment_id = media_handle_sideload( $file_array, $post_id, $title );
        
        // Clean up temp file
        if ( file_exists( $temp_file ) ) {
            @unlink( $temp_file );
        }
        
        if ( is_wp_error( $attachment_id ) ) {
            return new WP_Error( 'upload_failed', 'Failed to create attachment: ' . $attachment_id->get_error_message() );
        }
        
        return $attachment_id;
    }
    
    /**
     * Generate and save static map image as featured image for a route post
     * 
     * @param int $post_id Route post ID
     * @param string $polyline Encoded polyline
     * @param array $options Image generation options
     * @param bool $force_featured If true, always set as featured image even if one exists
     * @return int|WP_Error Attachment ID or error
     */
    public function generate_and_set_featured_image( $post_id, $polyline, $options = array(), $force_featured = false ) {
        // Generate static map URL
        $image_url = $this->generate_from_polyline( $polyline, $options );
        if ( is_wp_error( $image_url ) ) {
            return $image_url;
        }
        
        // Save as attachment
        $route_title = get_the_title( $post_id );
        $filename = 'route-map-' . $post_id . '.png';
        $attachment_id = $this->save_as_attachment( $post_id, $image_url, $filename, $route_title . ' - Map' );
        
        if ( is_wp_error( $attachment_id ) ) {
            return $attachment_id;
        }
        
        // Always save map image in custom meta for routes
        update_post_meta( $post_id, '_tvs_route_map_url', $image_url );
        update_post_meta( $post_id, '_tvs_route_map_attachment_id', $attachment_id );
        
        // Also get permanent WordPress URL
        $attachment_url = wp_get_attachment_url( $attachment_id );
        if ( $attachment_url ) {
            update_post_meta( $post_id, '_tvs_route_map_attachment_url', $attachment_url );
        }
        
        // Optionally set as featured image if no featured image exists OR force is true
        if ( $force_featured || ! has_post_thumbnail( $post_id ) ) {
            set_post_thumbnail( $post_id, $attachment_id );
        }
        
        return $attachment_id;
    }
    
    /**
     * Generate static map image for an activity and save URL in meta
     * (Activities use meta instead of featured images since they're private CPT)
     * 
     * @param int $activity_id Activity post ID
     * @param string $polyline Encoded polyline from route
     * @param array $options Image generation options
     * @return string|WP_Error Image URL or error
     */
    public function generate_activity_image( $activity_id, $polyline, $options = array() ) {
        // Generate static map URL
        $image_url = $this->generate_from_polyline( $polyline, $options );
        if ( is_wp_error( $image_url ) ) {
            return $image_url;
        }
        
        // Save URL in activity meta for sharing
        update_post_meta( $activity_id, '_tvs_map_image_url', $image_url );
        
        // Optionally download and save as attachment for future use
        $filename = 'activity-map-' . $activity_id . '.png';
        $activity_title = get_the_title( $activity_id );
        $attachment_id = $this->save_as_attachment( $activity_id, $image_url, $filename, $activity_title . ' - Map' );
        
        if ( ! is_wp_error( $attachment_id ) ) {
            update_post_meta( $activity_id, '_tvs_map_image_attachment_id', $attachment_id );
            
            // Set as featured image so it appears in gallery
            set_post_thumbnail( $activity_id, $attachment_id );
            
            // Return WordPress attachment URL (permanent, doesn't require Mapbox API)
            $attachment_url = wp_get_attachment_url( $attachment_id );
            if ( $attachment_url ) {
                return $attachment_url;
            }
        }
        
        // Fallback to API URL
        return $image_url;
    }
}

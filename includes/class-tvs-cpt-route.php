<?php
/**
 * Registers the tvs_route CPT
 */
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class TVS_CPT_Route {
    public function __construct() {
        add_action( 'init', array( $this, 'register_post_type' ) );
        add_action( 'save_post_tvs_route', array( $this, 'save_meta' ), 10, 2 );
        // Always bust routes cache on any route save (separate from meta save/nonce)
        add_action( 'save_post_tvs_route', array( $this, 'bust_routes_cache' ), 99, 2 );
        add_action( 'add_meta_boxes', array( $this, 'add_meta_boxes' ) );
        add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_media_uploader' ) );
        
        // AJAX handler for regenerating route map
        add_action( 'wp_ajax_tvs_regenerate_route_map', array( $this, 'ajax_regenerate_route_map' ) );
    }
    
    /**
     * Enqueue WordPress media uploader on route edit screens
     */
    public function enqueue_media_uploader( $hook ) {
        global $post_type;
        if ( 'tvs_route' === $post_type && ( 'post.php' === $hook || 'post-new.php' === $hook ) ) {
            wp_enqueue_media();
        }
    }

    public function register_post_type() {
        $labels = array(
            'name' => __( 'Routes', 'tvs-virtual-sports' ),
            'singular_name' => __( 'Route', 'tvs-virtual-sports' ),
        );

        register_post_type( 'tvs_route', array(
            'labels' => $labels,
            'public' => true,
            'show_in_rest' => true,
            'supports' => array( 'title', 'editor', 'thumbnail' ),
            'has_archive' => false,
            'rewrite' => array( 'slug' => 'routes' ),
        ) );

        // Register route meta keys and expose to REST
        foreach ( tvs_route_meta_keys() as $meta_key ) {
            register_post_meta( 'tvs_route', $meta_key, array(
                'show_in_rest' => true,
                'single' => true,
                'type' => 'string',
                'sanitize_callback' => 'sanitize_text_field',
            ) );
        }
    }

    public function save_meta( $post_id, $post ) {
        // Security checks
        if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
            return;
        }
        if ( wp_is_post_revision( $post_id ) ) {
            return;
        }

        // Verify nonce
        if ( empty( $_POST['tvs_route_meta_nonce'] ) || ! wp_verify_nonce( wp_unslash( $_POST['tvs_route_meta_nonce'] ), 'tvs_save_route_meta' ) ) {
            return;
        }

        // Capability check
        if ( ! current_user_can( 'edit_post', $post_id ) ) {
            return;
        }

        // Expecting meta in $_POST['tvs_route_meta'] as an array
        if ( isset( $_POST['tvs_route_meta'] ) && is_array( $_POST['tvs_route_meta'] ) ) {
            $meta = tvs_sanitize_route_meta( $_POST['tvs_route_meta'] );
            foreach ( $meta as $k => $v ) {
                update_post_meta( $post_id, $k, $v );
            }
        }

        // Invalidate routes REST cache when meta saved through the metabox form
        update_option( 'tvs_routes_cache_buster', time() );
    }

    /**
     * Bust the routes list cache on any route save (independent of meta box nonce)
     */
    public function bust_routes_cache( $post_id, $post ) {
        // Skip for autosave/revision like in save_meta
        if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
            return;
        }
        if ( wp_is_post_revision( $post_id ) ) {
            return;
        }
        // Update the cache buster option unconditionally on valid route saves
        update_option( 'tvs_routes_cache_buster', time() );
    }

    /**
     * Register meta boxes for routes
     */
    public function add_meta_boxes() {
        add_meta_box(
            'tvs_route_meta',
            __( 'Route details', 'tvs-virtual-sports' ),
            array( $this, 'render_meta_box' ),
            'tvs_route',
            'normal',
            'default'
        );
        
        // Add Route Map meta box
        add_meta_box(
            'tvs_route_map',
            __( 'Route Map', 'tvs-virtual-sports' ),
            array( $this, 'render_route_map_meta_box' ),
            'tvs_route',
            'side',
            'default'
        );
    }

    /**
     * Render the route meta box
     */
    public function render_meta_box( $post ) {
        // Add nonce for security
        wp_nonce_field( 'tvs_save_route_meta', 'tvs_route_meta_nonce' );

        $values = array();
        foreach ( tvs_route_meta_keys() as $k ) {
            $values[ $k ] = get_post_meta( $post->ID, $k, true );
        }

        echo '<div class="tvs-route-meta">';
        foreach ( $values as $k => $v ) {
            $label = esc_html( str_replace( '_', ' ', $k ) );
            
            // Special handling for gpx_url field with upload capability
            if ( $k === 'gpx_url' ) {
                echo '<p>';
                printf( '<label for="tvs_route_meta_%s">%s</label><br/>', esc_attr( $k ), esc_html( ucfirst( $label ) ) );
                
                if ( empty( $v ) ) {
                    // Show file upload button when empty
                    echo '<button type="button" class="button tvs-upload-gpx" data-post-id="' . esc_attr( $post->ID ) . '">';
                    echo esc_html__( 'Upload GPX File', 'tvs-virtual-sports' );
                    echo '</button>';
                    printf( '<input type="text" id="tvs_route_meta_%1$s" name="tvs_route_meta[%1$s]" value="%2$s" class="widefat" style="margin-top:8px;" placeholder="' . esc_attr__( 'Or enter GPX URL manually', 'tvs-virtual-sports' ) . '"/>', esc_attr( $k ), esc_attr( $v ) );
                } else {
                    // Show current URL with option to replace
                    printf( '<input type="text" id="tvs_route_meta_%1$s" name="tvs_route_meta[%1$s]" value="%2$s" class="widefat"/>', esc_attr( $k ), esc_attr( $v ) );
                    echo '<button type="button" class="button tvs-replace-gpx" data-post-id="' . esc_attr( $post->ID ) . '" style="margin-top:8px;">';
                    echo esc_html__( 'Replace with upload', 'tvs-virtual-sports' );
                    echo '</button>';
                }
                echo '</p>';
            } else {
                // Standard text input for other fields
                printf(
                    '<p><label for="tvs_route_meta_%1$s">%2$s</label><br/><input type="text" id="tvs_route_meta_%1$s" name="tvs_route_meta[%1$s]" value="%3$s" class="widefat"/></p>',
                    esc_attr( $k ),
                    esc_html( ucfirst( $label ) ),
                    esc_attr( $v )
                );
            }
        }
        echo '<p class="description">' . esc_html__( 'Enter route details (distance in meters, duration in seconds, GPX URL, Vimeo ID, etc.)', 'tvs-virtual-sports' ) . '</p>';
        echo '</div>';
        
        // Enqueue media uploader script
        $this->enqueue_upload_script();
    }
    
    /**
     * Enqueue script for GPX file upload using WordPress media library
     */
    private function enqueue_upload_script() {
        ?>
        <script>
        jQuery(document).ready(function($) {
            var gpxUploader;
            
            // Handle upload button click
            $(document).on('click', '.tvs-upload-gpx, .tvs-replace-gpx', function(e) {
                e.preventDefault();
                var $button = $(this);
                var postId = $button.data('post-id');
                
                // If the uploader already exists, reuse it
                if (gpxUploader) {
                    gpxUploader.open();
                    return;
                }
                
                // Create the media uploader
                gpxUploader = wp.media({
                    title: '<?php echo esc_js( __( 'Upload GPX File', 'tvs-virtual-sports' ) ); ?>',
                    button: {
                        text: '<?php echo esc_js( __( 'Use this GPX', 'tvs-virtual-sports' ) ); ?>'
                    },
                    multiple: false
                });
                
                // When a file is selected, populate the gpx_url field
                gpxUploader.on('select', function() {
                    var attachment = gpxUploader.state().get('selection').first().toJSON();
                    $('#tvs_route_meta_gpx_url').val(attachment.url);
                    
                    // Visual feedback
                    $('#tvs_route_meta_gpx_url').css('border', '2px solid #46b450').delay(1000).queue(function() {
                        $(this).css('border', '').dequeue();
                    });
                });
                
                gpxUploader.open();
            });
        });
        </script>
        <?php
    }
    
    /**
     * Render the route map meta box (sidebar)
     */
    public function render_route_map_meta_box( $post ) {
        $map_attachment_id = get_post_meta( $post->ID, '_tvs_route_map_attachment_id', true );
        $map_url = get_post_meta( $post->ID, '_tvs_route_map_attachment_url', true );
        $polyline = get_post_meta( $post->ID, 'polyline', true );
        $summary_polyline = get_post_meta( $post->ID, 'summary_polyline', true );
        
        if ( $map_attachment_id && $map_url ) {
            echo '<div class="tvs-route-map-preview" style="margin-bottom: 10px;">';
            echo '<img src="' . esc_url( $map_url ) . '" alt="Route Map" style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px;" />';
            echo '</div>';
            echo '<p class="description" style="margin-top: 8px; font-size: 12px;">';
            esc_html_e( 'This map was generated automatically from the route\'s GPS data.', 'tvs-virtual-sports' );
            echo '</p>';
            echo '<p style="margin-top: 10px;">';
            echo '<a href="' . esc_url( $map_url ) . '" target="_blank" class="button button-secondary" style="width: 100%; text-align: center; margin-bottom: 5px;">' . esc_html__( 'View Full Size', 'tvs-virtual-sports' ) . '</a>';
            
            // Add regenerate button if polyline exists
            if ( $polyline || $summary_polyline ) {
                echo '<button type="button" class="button button-secondary tvs-regenerate-map" data-post-id="' . esc_attr( $post->ID ) . '" style="width: 100%; text-align: center;">';
                echo esc_html__( 'Regenerate Map', 'tvs-virtual-sports' );
                echo '</button>';
                echo '<span class="spinner" style="float: none; margin: 8px auto 0; display: none;"></span>';
            }
            echo '</p>';
        } else {
            // Check if we have polyline data to generate map
            if ( $polyline || $summary_polyline ) {
                echo '<p class="description">';
                esc_html_e( 'No map image yet. Click the button below to generate one from the route\'s GPS data.', 'tvs-virtual-sports' );
                echo '</p>';
                echo '<p style="margin-top: 10px;">';
                echo '<button type="button" class="button button-primary tvs-regenerate-map" data-post-id="' . esc_attr( $post->ID ) . '" style="width: 100%; text-align: center;">';
                echo esc_html__( 'Generate Map Image', 'tvs-virtual-sports' );
                echo '</button>';
                echo '<span class="spinner" style="float: none; margin: 8px auto 0; display: none;"></span>';
                echo '</p>';
            } else {
                echo '<p class="description">';
                esc_html_e( 'No map image available. Import a route from Strava or add polyline data to automatically generate a map image.', 'tvs-virtual-sports' );
                echo '</p>';
            }
        }
        
        // Add inline JavaScript for regenerate button
        ?>
        <script type="text/javascript">
        jQuery(document).ready(function($) {
            $('.tvs-regenerate-map').on('click', function() {
                var $btn = $(this);
                var $spinner = $btn.next('.spinner');
                var postId = $btn.data('post-id');
                
                $btn.prop('disabled', true);
                $spinner.css('visibility', 'visible').show();
                
                $.ajax({
                    url: ajaxurl,
                    method: 'POST',
                    data: {
                        action: 'tvs_regenerate_route_map',
                        post_id: postId,
                        nonce: '<?php echo wp_create_nonce( 'tvs_regenerate_map' ); ?>'
                    },
                    success: function(response) {
                        if (response.success) {
                            // Reload page to show new image
                            location.reload();
                        } else {
                            alert('Failed to generate map: ' + (response.data || 'Unknown error'));
                            $btn.prop('disabled', false);
                            $spinner.hide();
                        }
                    },
                    error: function() {
                        alert('Failed to generate map image. Please try again.');
                        $btn.prop('disabled', false);
                        $spinner.hide();
                    }
                });
            });
        });
        </script>
        <?php
    }
    
    /**
     * AJAX handler to regenerate route map image
     */
    public function ajax_regenerate_route_map() {
        // Verify nonce
        if ( ! isset( $_POST['nonce'] ) || ! wp_verify_nonce( $_POST['nonce'], 'tvs_regenerate_map' ) ) {
            wp_send_json_error( 'Invalid nonce' );
        }
        
        // Check user permissions
        if ( ! current_user_can( 'edit_posts' ) ) {
            wp_send_json_error( 'Insufficient permissions' );
        }
        
        $post_id = isset( $_POST['post_id'] ) ? intval( $_POST['post_id'] ) : 0;
        if ( ! $post_id || get_post_type( $post_id ) !== 'tvs_route' ) {
            wp_send_json_error( 'Invalid route ID' );
        }
        
        // Try to get GPX data first (most accurate)
        $gpx_url = get_post_meta( $post_id, 'gpx_url', true );
        
        if ( ! empty( $gpx_url ) ) {
            // Convert URL to file path if it's a local URL
            $gpx_path = $gpx_url;
            if ( strpos( $gpx_url, home_url() ) === 0 || strpos( $gpx_url, 'localhost' ) !== false ) {
                // Local URL - convert to file path
                $upload_dir = wp_upload_dir();
                $gpx_path = str_replace( 
                    array( home_url() . '/wp-content/uploads/', 'http://localhost:8080/wp-content/uploads/' ),
                    array( $upload_dir['basedir'] . '/', $upload_dir['basedir'] . '/' ),
                    $gpx_url 
                );
            }
            
            // Parse GPX file
            $gpx_parser = new TVS_GPX();
            $gpx_data = $gpx_parser->parse( $gpx_path );
                
            if ( ! is_wp_error( $gpx_data ) && ! empty( $gpx_data['points'] ) ) {
                // Convert GPX points to [lat, lng] array for Mapbox
                $coordinates = array();
                foreach ( $gpx_data['points'] as $point ) {
                    $coordinates[] = array( $point['lat'], $point['lng'] );
                }
                    
                // Generate map from GPX coordinates
                $mapbox_static = new TVS_Mapbox_Static();
                $image_url = $mapbox_static->generate_from_coordinates( $coordinates, array(
                    'width'          => 1200,
                    'height'         => 800,
                    'stroke_color'   => 'F56565', // Red route line
                    'stroke_width'   => 4,
                    'stroke_opacity' => 0.9,
                ) );
                
                if ( ! is_wp_error( $image_url ) ) {
                    // Save as attachment
                    $route_title = get_the_title( $post_id );
                    $filename = 'route-map-' . $post_id . '.png';
                    $attachment_id = $mapbox_static->save_as_attachment( $post_id, $image_url, $filename, $route_title . ' - Map' );
                    
                    if ( ! is_wp_error( $attachment_id ) ) {
                        // Set as featured image
                        set_post_thumbnail( $post_id, $attachment_id );
                        
                        // Save map references
                        update_post_meta( $post_id, '_tvs_route_map_url', $image_url );
                        update_post_meta( $post_id, '_tvs_route_map_attachment_id', $attachment_id );
                        
                        $attachment_url = wp_get_attachment_url( $attachment_id );
                        if ( $attachment_url ) {
                            update_post_meta( $post_id, '_tvs_route_map_attachment_url', $attachment_url );
                        }
                        
                        wp_send_json_success( array(
                            'message' => 'Map image generated from GPX data (' . count($coordinates) . ' points)',
                            'attachment_id' => $attachment_id,
                            'attachment_url' => $attachment_url,
                        ) );
                    }
                }
                // If error, fall through to polyline method
            }
        }
        
        // Fallback: Get polyline from meta
        $polyline = get_post_meta( $post_id, 'polyline', true );
        if ( empty( $polyline ) ) {
            $polyline = get_post_meta( $post_id, 'summary_polyline', true );
        }
        
        if ( empty( $polyline ) ) {
            wp_send_json_error( 'No GPX or polyline data available for this route' );
        }
        
        // Generate map image
        $mapbox_static = new TVS_Mapbox_Static();
        $result = $mapbox_static->generate_and_set_featured_image( $post_id, $polyline, array(
            'width'          => 1200,
            'height'         => 800,
            'stroke_color'   => 'F56565', // Red route line
            'stroke_width'   => 4,
            'stroke_opacity' => 0.9,
        ), false ); // Don't force as featured image
        
        if ( is_wp_error( $result ) ) {
            wp_send_json_error( $result->get_error_message() );
        }
        
        wp_send_json_success( array(
            'message' => 'Map image generated successfully',
            'attachment_id' => $result,
        ) );
    }
}

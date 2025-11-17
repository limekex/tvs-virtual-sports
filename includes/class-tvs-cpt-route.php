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
}

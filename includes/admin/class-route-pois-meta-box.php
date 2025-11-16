<?php
/**
 * Meta Box for managing Route Points of Interest
 *
 * @package TVS_Virtual_Sports
 */

if (!defined('ABSPATH')) {
    exit;
}

class TVS_Route_POIs_Meta_Box {

    public function __construct() {
        add_action('add_meta_boxes', array($this, 'add_meta_box'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_scripts'));
    }

    /**
     * Register meta box
     */
    public function add_meta_box() {
        add_meta_box(
            'tvs_route_pois',
            __('Points of Interest', 'tvs-virtual-sports'),
            array($this, 'render_meta_box'),
            'tvs_route',
            'normal',
            'high'
        );
    }

    /**
     * Enqueue scripts for admin
     */
    public function enqueue_scripts($hook) {
        global $post;

        // Only load on route edit screen
        if ($hook !== 'post.php' && $hook !== 'post-new.php') {
            return;
        }

        if (!$post || $post->post_type !== 'tvs_route') {
            return;
        }

        // Mapbox GL JS
        wp_enqueue_style('mapbox-gl', 'https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css');
        wp_enqueue_script('mapbox-gl', 'https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.js', array(), '3.0.1', true);

        // Admin PoI manager script (will be built later)
        wp_enqueue_script(
            'tvs-poi-manager',
            TVS_PLUGIN_URL . 'admin/js/poi-manager.js',
            array('jquery', 'mapbox-gl', 'wp-api'),
            TVS_PLUGIN_VERSION,
            true
        );

        wp_enqueue_style(
            'tvs-poi-manager',
            TVS_PLUGIN_URL . 'admin/css/poi-manager.css',
            array(),
            TVS_PLUGIN_VERSION
        );

        // Pass data to script
        $mapbox_token = get_option('tvs_mapbox_token', '');
        $gpx_url = get_post_meta($post->ID, 'gpx_url', true);

        wp_localize_script('tvs-poi-manager', 'tvsPoiData', array(
            'routeId'      => $post->ID,
            'mapboxToken'  => $mapbox_token,
            'gpxUrl'       => $gpx_url,
            'nonce'        => wp_create_nonce('wp_rest'),
            'apiUrl'       => rest_url('tvs/v1/routes/' . $post->ID . '/pois'),
        ));
    }

    /**
     * Render meta box content
     */
    public function render_meta_box($post) {
        $pois = get_post_meta($post->ID, '_route_pois', true);
        if (!is_array($pois)) {
            $pois = array();
        }

        $gpx_url = get_post_meta($post->ID, 'gpx_url', true);
        $mapbox_token = get_option('tvs_mapbox_token', '');

        ?>
        <div id="tvs-poi-manager">
            <?php if (empty($gpx_url)): ?>
                <div class="notice notice-warning inline">
                    <p><?php _e('Please upload a GPX file first to enable PoI placement on the map.', 'tvs-virtual-sports'); ?></p>
                </div>
            <?php elseif (empty($mapbox_token)): ?>
                <div class="notice notice-warning inline">
                    <p><?php _e('Mapbox token is missing. Please configure it in plugin settings.', 'tvs-virtual-sports'); ?></p>
                </div>
            <?php else: ?>
                <div class="tvs-poi-header">
                    <button type="button" class="button button-primary" id="tvs-add-poi-btn">
                        <span class="dashicons dashicons-plus-alt"></span>
                        <?php _e('Add Point of Interest', 'tvs-virtual-sports'); ?>
                    </button>
                </div>

                <!-- PoI List -->
                <div id="tvs-poi-list" class="tvs-poi-list">
                    <?php if (empty($pois)): ?>
                        <p class="tvs-no-pois"><?php _e('No points of interest yet. Click "Add Point of Interest" to get started.', 'tvs-virtual-sports'); ?></p>
                    <?php else: ?>
                        <?php foreach ($pois as $poi): ?>
                            <?php $this->render_poi_item($poi); ?>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </div>

                <!-- Add/Edit Modal -->
                <div id="tvs-poi-modal" class="tvs-poi-modal" style="display: none;">
                    <div class="tvs-poi-modal-content">
                        <div class="tvs-poi-modal-header">
                            <h2 id="tvs-poi-modal-title"><?php _e('Add Point of Interest', 'tvs-virtual-sports'); ?></h2>
                            <button type="button" class="tvs-poi-modal-close">&times;</button>
                        </div>
                        
                        <div class="tvs-poi-modal-body">
                            <!-- Map for placement -->
                            <div class="tvs-poi-field">
                                <label><?php _e('Click on the map to place the PoI marker:', 'tvs-virtual-sports'); ?></label>
                                <div id="tvs-poi-map" style="height: 400px; border-radius: 8px; overflow: hidden;"></div>
                            </div>

                            <!-- Name -->
                            <div class="tvs-poi-field">
                                <label for="poi-name"><?php _e('Name', 'tvs-virtual-sports'); ?> *</label>
                                <input type="text" id="poi-name" class="widefat" required>
                            </div>

                            <!-- Description -->
                            <div class="tvs-poi-field">
                                <label for="poi-description"><?php _e('Description', 'tvs-virtual-sports'); ?></label>
                                <textarea id="poi-description" class="widefat" rows="3"></textarea>
                            </div>

                            <!-- Icon Selector -->
                            <div class="tvs-poi-field">
                                <label><?php _e('Icon', 'tvs-virtual-sports'); ?></label>
                                <div class="tvs-icon-selector">
                                    <div class="tvs-icon-tabs">
                                        <button type="button" class="tvs-icon-tab active" data-tab="library">
                                            <?php _e('Icon Library', 'tvs-virtual-sports'); ?>
                                        </button>
                                        <button type="button" class="tvs-icon-tab" data-tab="custom">
                                            <?php _e('Custom SVG', 'tvs-virtual-sports'); ?>
                                        </button>
                                    </div>

                                    <!-- Icon Library Tab -->
                                    <div id="tvs-icon-library" class="tvs-icon-tab-content active">
                                        <div class="tvs-icon-grid">
                                            <?php
                                            $icons = array(
                                                'FaLandmark' => '🏛️',
                                                'FaTheaterMasks' => '🎭',
                                                'FaFortAwesome' => '🏰',
                                                'FaChurch' => '⛪',
                                                'FaTrain' => '🚉',
                                                'FaTree' => '🌳',
                                                'FaMountain' => '🏔️',
                                                'FaWater' => '💧',
                                                'FaBridge' => '🌉',
                                                'FaMonument' => '🗿',
                                                'FaUniversity' => '🎓',
                                                'FaHospital' => '🏥',
                                                'FaStore' => '🏪',
                                                'FaCoffee' => '☕',
                                                'FaCamera' => '📷',
                                            );
                                            foreach ($icons as $name => $emoji): ?>
                                                <button type="button" class="tvs-icon-option" data-icon="<?php echo esc_attr($name); ?>" data-type="library">
                                                    <span class="icon-emoji"><?php echo $emoji; ?></span>
                                                    <span class="icon-name"><?php echo esc_html($name); ?></span>
                                                </button>
                                            <?php endforeach; ?>
                                        </div>
                                    </div>

                                    <!-- Custom SVG Tab -->
                                    <div id="tvs-icon-custom" class="tvs-icon-tab-content">
                                        <button type="button" class="button" id="tvs-upload-svg-btn">
                                            <?php _e('Upload SVG', 'tvs-virtual-sports'); ?>
                                        </button>
                                        <div id="tvs-custom-icon-preview" style="margin-top: 10px;"></div>
                                        <input type="hidden" id="poi-custom-icon-id">
                                    </div>
                                </div>
                                <input type="hidden" id="poi-icon-type" value="library">
                                <input type="hidden" id="poi-icon" value="FaLandmark">
                            </div>

                            <!-- Marker Color -->
                            <div class="tvs-poi-field">
                                <label><?php _e('Marker Color', 'tvs-virtual-sports'); ?></label>
                                <div class="tvs-color-picker">
                                    <?php
                                    $colors = array(
                                        '#2563eb' => 'Blue',
                                        '#dc2626' => 'Red',
                                        '#16a34a' => 'Green',
                                        '#ca8a04' => 'Yellow',
                                        '#9333ea' => 'Purple',
                                        '#ea580c' => 'Orange',
                                        '#0891b2' => 'Cyan',
                                        '#db2777' => 'Pink',
                                    );
                                    foreach ($colors as $hex => $name): ?>
                                        <button type="button" class="tvs-color-option" data-color="<?php echo esc_attr($hex); ?>" style="background-color: <?php echo esc_attr($hex); ?>;" title="<?php echo esc_attr($name); ?>"></button>
                                    <?php endforeach; ?>
                                </div>
                                <input type="hidden" id="poi-color" value="#2563eb">
                            </div>

                            <!-- Image Upload -->
                            <div class="tvs-poi-field">
                                <label><?php _e('Image (optional)', 'tvs-virtual-sports'); ?></label>
                                <div class="tvs-image-upload">
                                    <button type="button" class="button" id="tvs-upload-image-btn">
                                        <?php _e('Upload Image', 'tvs-virtual-sports'); ?>
                                    </button>
                                    <div id="tvs-image-preview" style="margin-top: 10px;"></div>
                                    <input type="hidden" id="poi-image-id">
                                </div>
                            </div>

                            <!-- Trigger Distance -->
                            <div class="tvs-poi-field">
                                <label for="poi-trigger-distance"><?php _e('Trigger Distance (meters)', 'tvs-virtual-sports'); ?></label>
                                <input type="number" id="poi-trigger-distance" class="small-text" value="150" min="0" step="10">
                                <p class="description"><?php _e('Distance from PoI when popup appears', 'tvs-virtual-sports'); ?></p>
                            </div>

                            <!-- Hide Distance -->
                            <div class="tvs-poi-field">
                                <label for="poi-hide-distance"><?php _e('Hide Distance (meters)', 'tvs-virtual-sports'); ?></label>
                                <input type="number" id="poi-hide-distance" class="small-text" value="100" min="0" step="10">
                                <p class="description"><?php _e('Distance from PoI when popup disappears', 'tvs-virtual-sports'); ?></p>
                            </div>

                            <!-- Coordinates (readonly) -->
                            <div class="tvs-poi-field">
                                <label><?php _e('Coordinates', 'tvs-virtual-sports'); ?></label>
                                <p class="description">
                                    <strong>Lng:</strong> <span id="poi-lng-display">--</span>, 
                                    <strong>Lat:</strong> <span id="poi-lat-display">--</span>
                                </p>
                                <input type="hidden" id="poi-lng">
                                <input type="hidden" id="poi-lat">
                                <input type="hidden" id="poi-id"> <!-- For editing -->
                            </div>
                        </div>

                        <div class="tvs-poi-modal-footer">
                            <button type="button" class="button" id="tvs-poi-cancel-btn"><?php _e('Cancel', 'tvs-virtual-sports'); ?></button>
                            <button type="button" class="button button-primary" id="tvs-poi-save-btn"><?php _e('Save PoI', 'tvs-virtual-sports'); ?></button>
                        </div>
                    </div>
                </div>
            <?php endif; ?>
        </div>
        <?php
    }

    /**
     * Render a single PoI item in the list
     */
    private function render_poi_item($poi) {
        $image_url = !empty($poi['image_id']) ? wp_get_attachment_image_url($poi['image_id'], 'thumbnail') : '';
        ?>
        <div class="tvs-poi-item" data-poi-id="<?php echo esc_attr($poi['id']); ?>">
            <?php if ($image_url): ?>
                <div class="poi-thumbnail">
                    <img src="<?php echo esc_url($image_url); ?>" alt="">
                </div>
            <?php endif; ?>
            <div class="poi-info">
                <div class="poi-name">
                    <span class="poi-icon"><?php echo esc_html($poi['icon'] ?? '📍'); ?></span>
                    <strong><?php echo esc_html($poi['name']); ?></strong>
                </div>
                <div class="poi-meta">
                    <span><?php printf(__('Trigger: %dm', 'tvs-virtual-sports'), $poi['trigger_distance_m']); ?></span>
                    <span class="poi-coords"><?php printf('Lng: %.6f, Lat: %.6f', $poi['lng'], $poi['lat']); ?></span>
                </div>
            </div>
            <div class="poi-actions">
                <button type="button" class="button button-small tvs-edit-poi" data-poi-id="<?php echo esc_attr($poi['id']); ?>">
                    <?php _e('Edit', 'tvs-virtual-sports'); ?>
                </button>
                <button type="button" class="button button-small button-link-delete tvs-delete-poi" data-poi-id="<?php echo esc_attr($poi['id']); ?>">
                    <?php _e('Delete', 'tvs-virtual-sports'); ?>
                </button>
            </div>
        </div>
        <?php
    }
}

// Initialize
new TVS_Route_POIs_Meta_Box();

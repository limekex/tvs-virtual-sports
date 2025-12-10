<?php
/**
 * Main plugin bootstrap class
 */
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

require_once TVS_PLUGIN_DIR . 'includes/helpers.php';
require_once TVS_PLUGIN_DIR . 'includes/class-tvs-cpt-route.php';
require_once TVS_PLUGIN_DIR . 'includes/class-tvs-cpt-activity.php';
require_once TVS_PLUGIN_DIR . 'includes/class-tvs-cpt-exercise.php';
require_once TVS_PLUGIN_DIR . 'includes/class-tvs-taxonomies.php';
require_once TVS_PLUGIN_DIR . 'includes/class-tvs-rest.php';
require_once TVS_PLUGIN_DIR . 'includes/class-tvs-rest-exercises.php';
require_once TVS_PLUGIN_DIR . 'includes/class-tvs-strava.php';
require_once TVS_PLUGIN_DIR . 'includes/class-tvs-gpx.php';
require_once TVS_PLUGIN_DIR . 'includes/class-tvs-mapbox-static.php';
require_once TVS_PLUGIN_DIR . 'includes/class-tvs-user-profile.php';
require_once TVS_PLUGIN_DIR . 'includes/class-tvs-frontend.php';
require_once TVS_PLUGIN_DIR . 'includes/class-tvs-admin.php';
require_once TVS_PLUGIN_DIR . 'includes/class-tvs-roles.php';
require_once TVS_PLUGIN_DIR . 'includes/admin/class-route-pois-meta-box.php';

class TVS_Plugin {
    /** @var string */
    protected $file;

    public function __construct( $file ) {
        $this->file = $file;
    }

    public function init() {
        // Load textdomain
        add_action( 'init', array( $this, 'load_textdomain' ) );

        // Setup components
        add_action( 'init', array( $this, 'register_components' ), 5 );

        // Register Gutenberg blocks
        add_action( 'init', array( $this, 'register_blocks' ) );

        // Register shortcodes
        add_action( 'init', array( $this, 'register_shortcodes' ) );

        // Enqueue admin assets
        add_action( 'admin_enqueue_scripts', array( $this, 'admin_assets' ) );

        // Enqueue public assets (theme no longer registers tvs-app, plugin handles it)
        add_action( 'wp_enqueue_scripts', array( $this, 'public_assets' ) );

        // Safety: Ensure DB tables exist even if plugin wasn't re-activated after updates
        add_action( 'admin_init', array( $this, 'ensure_invites_table' ) );

        // Allow GPX file uploads
        add_filter( 'upload_mimes', array( $this, 'allow_gpx_uploads' ) );
        add_filter( 'wp_check_filetype_and_ext', array( $this, 'gpx_filetype_check' ), 10, 4 );

        // Enqueue Gutenberg block editor assets (to make blocks appear in Inserter)
        add_action( 'enqueue_block_editor_assets', array( $this, 'editor_assets' ) );

        // One-time rewrite flush when plugin version changes (ensures CPT permalinks like /activity/ work after updates)
        add_action( 'init', array( $this, 'maybe_flush_rewrite' ), 20 );

        // Enforce activity privacy on front-end views
        add_action( 'template_redirect', array( $this, 'guard_activity_privacy' ) );
    }

    public function load_textdomain() {
        load_plugin_textdomain( 'tvs-virtual-sports', false, dirname( plugin_basename( $this->file ) ) . '/languages' );
    }

    /**
     * Flush rewrite rules once after updates when version changes.
     * Ensures tvs_activity rewrite (/activity/slug) is recognized without manual Permalinks save.
     */
    public function maybe_flush_rewrite() {
        $stored = get_option( 'tvs_virtual_sports_version' );
        if ( $stored !== TVS_PLUGIN_VERSION ) {
            // Ensure CPTs/taxonomies are registered before flushing
            $this->register_components_for_activation();
            flush_rewrite_rules();
            update_option( 'tvs_virtual_sports_version', TVS_PLUGIN_VERSION );
        }
    }

    public function register_components() {
        new TVS_CPT_Route();
        new TVS_CPT_Activity();
        
        // Exercise library
        new TVS_CPT_Exercise();
        $rest_exercises = new TVS_REST_Exercises();
        $rest_exercises->init();
        
        new TVS_Taxonomies();
        new TVS_REST();
        new TVS_Strava();
        new TVS_Frontend();
        new TVS_Roles();

        // Initialize admin
        $admin = new TVS_Admin();
        $admin->init();
        
        // Initialize PoI meta box
        new TVS_Route_POIs_Meta_Box();
    }

    public function register_blocks() {
        // Register "My Activities" block using PHP (simpler, no build step needed)
        if ( function_exists( 'register_block_type' ) ) {
            register_block_type( 'tvs-virtual-sports/my-activities', array(
                'title'           => __( 'TVS My Activities', 'tvs-virtual-sports' ),
                'description'     => __( 'Display user activities list', 'tvs-virtual-sports' ),
                'category'        => 'widgets',
                'icon'            => 'list-view',
                'keywords'        => array( 'tvs', 'activities', 'virtual sports' ),
                'render_callback' => array( $this, 'render_my_activities_block' ),
                'attributes'      => array(
                    'routeId' => array(
                        'type'    => 'integer',
                        'default' => 0,
                    ),
                    'limit' => array(
                        'type'    => 'integer',
                        'default' => 5,
                    ),
                    'title' => array(
                        'type'    => 'string',
                        'default' => 'Recent Activities',
                    ),
                ),
            ) );

            register_block_type( 'tvs-virtual-sports/invite-friends', array(
                'title'           => __( 'TVS Invite Friends', 'tvs-virtual-sports' ),
                'description'     => __( 'Generate and manage invitation codes for your friends.', 'tvs-virtual-sports' ),
                'category'        => 'widgets',
                'icon'            => 'share',
                'keywords'        => array( 'tvs', 'invites', 'friends' ),
                'render_callback' => array( $this, 'render_invite_friends_block' ),
                'attributes'      => array(),
            ) );

            // Route Insights block
            register_block_type( 'tvs-virtual-sports/route-insights', array(
                'title'           => __( 'TVS Route Insights', 'tvs-virtual-sports' ),
                'description'     => __( 'Route elevation, surface, ETA and real-life link.', 'tvs-virtual-sports' ),
                'category'        => 'widgets',
                'icon'            => 'analytics',
                'render_callback' => array( $this, 'render_route_insights_block' ),
                'attributes'      => array(
                    'title' => array( 'type' => 'string', 'default' => 'Route Insights' ),
                    'routeId' => array( 'type' => 'integer', 'default' => 0 ),
                    'showElevation' => array( 'type' => 'boolean', 'default' => true ),
                    'showSurface'   => array( 'type' => 'boolean', 'default' => true ),
                    'showEta'       => array( 'type' => 'boolean', 'default' => true ),
                    'showMapsLink'  => array( 'type' => 'boolean', 'default' => true ),
                ),
            ) );

            // Personal Records block
            register_block_type( 'tvs-virtual-sports/personal-records', array(
                'title'           => __( 'TVS Personal Records', 'tvs-virtual-sports' ),
                'description'     => __( 'Best time, average pace/tempo, most recent.', 'tvs-virtual-sports' ),
                'category'        => 'widgets',
                'icon'            => 'awards',
                'render_callback' => array( $this, 'render_personal_records_block' ),
                'attributes'      => array(
                    'title'        => array( 'type' => 'string', 'default' => 'Personal Records' ),
                    'routeId'      => array( 'type' => 'integer', 'default' => 0 ),
                    'showBestTime' => array( 'type' => 'boolean', 'default' => true ),
                    'showAvgPace'  => array( 'type' => 'boolean', 'default' => true ),
                    'showAvgTempo' => array( 'type' => 'boolean', 'default' => false ),
                    'showMostRecent' => array( 'type' => 'boolean', 'default' => true ),
                ),
            ) );

            // Activity Heatmap block
            register_block_type( 'tvs-virtual-sports/activity-heatmap', array(
                'title'           => __( 'TVS Activity Heatmap', 'tvs-virtual-sports' ),
                'description'     => __( 'Sparkline/heatmap of your attempts over time.', 'tvs-virtual-sports' ),
                'category'        => 'widgets',
                'icon'            => 'chart-area',
                'render_callback' => array( $this, 'render_activity_heatmap_block' ),
                'attributes'      => array(
                    'title'       => array( 'type' => 'string', 'default' => 'Activity Heatmap' ),
                    'heatmapType' => array( 'type' => 'string', 'default' => 'sparkline' ),
                    'routeId'     => array( 'type' => 'integer', 'default' => 0 ),
                ),
            ) );

            // Route Weather block
            register_block_type( 'tvs-virtual-sports/route-weather', array(
                'api_version'     => 2,
                'title'           => __( 'TVS Route Weather', 'tvs-virtual-sports' ),
                'description'     => __( 'Display historical weather data from MET Norway for a route.', 'tvs-virtual-sports' ),
                'category'        => 'widgets',
                'icon'            => 'cloud',
                'supports'        => array(
                    'html' => false,
                ),
                'render_callback' => array( $this, 'render_route_weather_block' ),
                'attributes'      => array(
                    'title'       => array( 'type' => 'string', 'default' => 'Weather Conditions' ),
                    'routeId'     => array( 'type' => 'integer', 'default' => 0 ),
                    'maxDistance' => array( 'type' => 'integer', 'default' => 50 ),
                    'debug'       => array( 'type' => 'boolean', 'default' => false ),
                ),
            ) );

            // Issue #21: Manual Activity Tracker - Register via block.json
            register_block_type( TVS_PLUGIN_DIR . 'blocks/manual-activity-tracker/block.json', array(
                'render_callback' => array( $this, 'render_manual_activity_tracker_block' ),
            ) );

            // Activity Stats Dashboard block
            register_block_type( 'tvs-virtual-sports/activity-stats-dashboard', array(
                'title'           => __( 'TVS Activity Stats Dashboard', 'tvs-virtual-sports' ),
                'description'     => __( 'Comprehensive dashboard with activity statistics and charts.', 'tvs-virtual-sports' ),
                'category'        => 'widgets',
                'icon'            => 'chart-bar',
                'render_callback' => array( $this, 'render_activity_stats_dashboard_block' ),
                'attributes'      => array(
                    'title'      => array( 'type' => 'string', 'default' => 'Activity Dashboard' ),
                    'period'     => array( 'type' => 'string', 'default' => '30d' ),
                    'showCharts' => array( 'type' => 'boolean', 'default' => true ),
                    'userId'     => array( 'type' => 'integer', 'default' => 0 ),
                ),
            ) );

            // Single Activity Details block
            register_block_type( 'tvs-virtual-sports/single-activity-details', array(
                'title'           => __( 'TVS Activity Details', 'tvs-virtual-sports' ),
                'description'     => __( 'Display detailed statistics for a single activity.', 'tvs-virtual-sports' ),
                'category'        => 'widgets',
                'icon'            => 'analytics',
                'render_callback' => array( $this, 'render_single_activity_details_block' ),
                'attributes'      => array(
                    'activityId'     => array( 'type' => 'integer', 'default' => 0 ),
                    'showComparison' => array( 'type' => 'boolean', 'default' => true ),
                    'showActions'    => array( 'type' => 'boolean', 'default' => true ),
                    'showNotes'      => array( 'type' => 'boolean', 'default' => true ),
                ),
            ) );

            // Activity Timeline block
            register_block_type( TVS_PLUGIN_DIR . 'blocks/activity-timeline/block.json', array(
                'render_callback' => array( $this, 'render_activity_timeline_block' ),
            ) );

            // Activity Gallery block
            register_block_type( TVS_PLUGIN_DIR . 'blocks/activity-gallery/block.json', array(
                'render_callback' => array( $this, 'render_activity_gallery_block' ),
            ) );

            // My Favourites block
            register_block_type( TVS_PLUGIN_DIR . 'blocks/my-favourites/block.json', array(
                'render_callback' => array( $this, 'render_my_favourites_block' ),
            ) );

            // People's Favourites block
            register_block_type( TVS_PLUGIN_DIR . 'blocks/people-favourites/block.json', array(
                'render_callback' => array( $this, 'render_people_favourites_block' ),
            ) );

            // Activity Comparison block
            register_block_type( TVS_PLUGIN_DIR . 'blocks/activity-comparison/block.json' );
        }
    }

    public function render_my_activities_block( $attributes ) {
        // Enqueue block-specific frontend script
        wp_enqueue_script( 'tvs-block-my-activities' );
        wp_enqueue_style( 'tvs-public' );

        // Create a unique mount point for this block instance
        $mount_id = 'tvs-my-activities-' . uniqid();
    $route_id = isset( $attributes['routeId'] ) ? intval( $attributes['routeId'] ) : 0;
    $limit    = isset( $attributes['limit'] ) ? max( 1, min( 20, intval( $attributes['limit'] ) ) ) : 5;
    $title    = isset( $attributes['title'] ) ? sanitize_text_field( $attributes['title'] ) : 'Recent Activities';

        // Sensible defaults: on a route page, default to route mode
        if ( is_singular( 'tvs_route' ) && $route_id <= 0 ) {
            $route_id = get_the_ID();
        }
        
        ob_start();
        ?>
        <div class="tvs-app tvs-app--activities">
          <div id="<?php echo esc_attr( $mount_id ); ?>"
                 class="tvs-my-activities-block"
                 data-route-id="<?php echo esc_attr( $route_id ); ?>"
                 data-limit="<?php echo esc_attr( $limit ); ?>"
              data-title="<?php echo esc_attr( $title ); ?>"
            ></div>
        </div>
        <?php
        return ob_get_clean();
    }

    public function render_invite_friends_block( $attributes ) {
        // Hide block completely for logged-out users (no output, no assets)
        if ( ! is_user_logged_in() ) {
            return '';
        }
        // Enqueue block-specific frontend script
        wp_enqueue_script( 'tvs-block-invites' );
        wp_enqueue_style( 'tvs-public' );

        // Localize TVS_SETTINGS in case not already
        $settings = array(
            'env'       => ( defined( 'WP_DEBUG' ) && WP_DEBUG ) ? 'development' : 'production',
            'restRoot'  => get_rest_url(),
            'nonce'     => wp_create_nonce( 'wp_rest' ),
            'version'   => TVS_PLUGIN_VERSION,
            'user'      => is_user_logged_in() ? wp_get_current_user()->user_login : null,
            'pluginUrl' => TVS_PLUGIN_URL,
            'mapbox'    => array(
                'accessToken'         => get_option( 'tvs_mapbox_access_token', '' ),
                'style'               => get_option( 'tvs_mapbox_map_style', 'mapbox://styles/mapbox/satellite-streets-v12' ),
                'initialZoom'         => floatval( get_option( 'tvs_mapbox_initial_zoom', 14 ) ),
                'minZoom'             => floatval( get_option( 'tvs_mapbox_min_zoom', 10 ) ),
                'maxZoom'             => floatval( get_option( 'tvs_mapbox_max_zoom', 18 ) ),
                'pitch'               => floatval( get_option( 'tvs_mapbox_pitch', 60 ) ),
                'bearing'             => floatval( get_option( 'tvs_mapbox_bearing', 0 ) ),
                'defaultSpeed'        => floatval( get_option( 'tvs_mapbox_default_speed', 1.0 ) ),
                'cameraOffset'        => floatval( get_option( 'tvs_mapbox_camera_offset', 0.0002 ) ),
                'smoothFactor'        => floatval( get_option( 'tvs_mapbox_smooth_factor', 0.7 ) ),
                'markerColor'         => get_option( 'tvs_mapbox_marker_color', '#ff0000' ),
                'routeColor'          => get_option( 'tvs_mapbox_route_color', '#ec4899' ),
                'routeWidth'          => intval( get_option( 'tvs_mapbox_route_width', 6 ) ),
                'terrainEnabled'      => (bool) get_option( 'tvs_mapbox_terrain_enabled', 0 ),
                'terrainExaggeration' => floatval( get_option( 'tvs_mapbox_terrain_exaggeration', 1.5 ) ),
                'flyToZoom'           => floatval( get_option( 'tvs_mapbox_flyto_zoom', 16 ) ),
                'buildings3dEnabled'  => (bool) get_option( 'tvs_mapbox_buildings_3d_enabled', 0 ),
            ),
        );
        wp_localize_script( 'tvs-block-invites', 'TVS_SETTINGS', $settings );

        $mount_id = 'tvs-invite-friends-' . uniqid();
        ob_start();
        ?>
        <div id="<?php echo esc_attr( $mount_id ); ?>" class="tvs-invite-friends-block"></div>
        <?php
        return ob_get_clean();
    }

    public function render_route_insights_block( $attributes ) {
        wp_enqueue_script( 'tvs-block-route-insights' );
        wp_enqueue_style( 'tvs-public' );

        $mount_id = 'tvs-route-insights-' . uniqid();
        $title = isset( $attributes['title'] ) ? sanitize_text_field( $attributes['title'] ) : 'Route Insights';
    $attr_route_id = isset( $attributes['routeId'] ) ? intval( $attributes['routeId'] ) : 0;
    $show_distance   = array_key_exists( 'showDistance', $attributes ) ? (bool) $attributes['showDistance'] : true;
    $show_pace       = array_key_exists( 'showPace', $attributes ) ? (bool) $attributes['showPace'] : true;
    $show_cumulative = array_key_exists( 'showCumulative', $attributes ) ? (bool) $attributes['showCumulative'] : false;
        $show_elev = ! empty( $attributes['showElevation'] );
        $show_surface = ! empty( $attributes['showSurface'] );
        $show_eta = ! empty( $attributes['showEta'] );
        $show_maps = ! empty( $attributes['showMapsLink'] );
        $route_id = $attr_route_id > 0 ? $attr_route_id : ( is_singular( 'tvs_route' ) ? get_the_ID() : 0 );

        ob_start();
        ?>
        <div class="tvs-app">
            <div id="<?php echo esc_attr( $mount_id ); ?>"
                 class="tvs-route-insights-block"
                 data-title="<?php echo esc_attr( $title ); ?>"
                 data-show-elevation="<?php echo esc_attr( $show_elev ? '1' : '0' ); ?>"
                 data-show-surface="<?php echo esc_attr( $show_surface ? '1' : '0' ); ?>"
                 data-show-eta="<?php echo esc_attr( $show_eta ? '1' : '0' ); ?>"
                 data-show-maps-link="<?php echo esc_attr( $show_maps ? '1' : '0' ); ?>"
                 data-route-id="<?php echo esc_attr( $route_id ); ?>"
            ></div>
        </div>
        <?php
        return ob_get_clean();
    }

    public function render_personal_records_block( $attributes ) {
        wp_enqueue_script( 'tvs-block-personal-records' );
        wp_enqueue_style( 'tvs-public' );

        $mount_id = 'tvs-personal-records-' . uniqid();
        $title = isset( $attributes['title'] ) ? sanitize_text_field( $attributes['title'] ) : 'Personal Records';
        $attr_route_id = isset( $attributes['routeId'] ) ? intval( $attributes['routeId'] ) : 0;
        $show_best = ! empty( $attributes['showBestTime'] );
        $show_avg_pace = ! empty( $attributes['showAvgPace'] );
        $show_avg_tempo = ! empty( $attributes['showAvgTempo'] );
        $show_recent = ! empty( $attributes['showMostRecent'] );
        $route_id = $attr_route_id > 0 ? $attr_route_id : ( is_singular( 'tvs_route' ) ? get_the_ID() : 0 );

        ob_start();
        ?>
        <div class="tvs-app">
            <div id="<?php echo esc_attr( $mount_id ); ?>"
                 class="tvs-personal-records-block"
                 data-title="<?php echo esc_attr( $title ); ?>"
                 data-show-best="<?php echo esc_attr( $show_best ? '1' : '0' ); ?>"
                 data-show-avg-pace="<?php echo esc_attr( $show_avg_pace ? '1' : '0' ); ?>"
                 data-show-avg-tempo="<?php echo esc_attr( $show_avg_tempo ? '1' : '0' ); ?>"
                 data-show-recent="<?php echo esc_attr( $show_recent ? '1' : '0' ); ?>"
                 data-route-id="<?php echo esc_attr( $route_id ); ?>"
            ></div>
        </div>
        <?php
        return ob_get_clean();
    }

    public function render_activity_heatmap_block( $attributes ) {
        wp_enqueue_script( 'tvs-block-activity-heatmap' );
        wp_enqueue_style( 'tvs-public' );

        $mount_id = 'tvs-activity-heatmap-' . uniqid();
        $title = isset( $attributes['title'] ) ? sanitize_text_field( $attributes['title'] ) : 'Activity Heatmap';
        $type  = isset( $attributes['heatmapType'] ) ? sanitize_text_field( $attributes['heatmapType'] ) : 'sparkline';
        $attr_route_id = isset( $attributes['routeId'] ) ? intval( $attributes['routeId'] ) : 0;
        $route_id = $attr_route_id > 0 ? $attr_route_id : ( is_singular( 'tvs_route' ) ? get_the_ID() : 0 );

        ob_start();
        ?>
        <div class="tvs-app">
            <div id="<?php echo esc_attr( $mount_id ); ?>"
                 class="tvs-activity-heatmap-block"
                 data-title="<?php echo esc_attr( $title ); ?>"
                 data-type="<?php echo esc_attr( $type ); ?>"
                 data-route-id="<?php echo esc_attr( $route_id ); ?>"
              data-show-distance="<?php echo esc_attr( $show_distance ? '1' : '0' ); ?>"
              data-show-pace="<?php echo esc_attr( $show_pace ? '1' : '0' ); ?>"
              data-show-cumulative="<?php echo esc_attr( $show_cumulative ? '1' : '0' ); ?>"
            ></div>
        </div>
        <?php
        return ob_get_clean();
    }

    public function render_route_weather_block( $attributes ) {
        // Enqueue block-specific frontend script and styles
        wp_enqueue_script( 'tvs-block-route-weather' );
        wp_enqueue_style( 'tvs-public' );

        $mount_id = 'tvs-route-weather-' . uniqid();
        $title = isset( $attributes['title'] ) ? sanitize_text_field( $attributes['title'] ) : 'Weather Conditions';
        $max_distance = isset( $attributes['maxDistance'] ) ? intval( $attributes['maxDistance'] ) : 50;
        $debug = ! empty( $attributes['debug'] );
        $attr_route_id = isset( $attributes['routeId'] ) ? intval( $attributes['routeId'] ) : 0;
        $route_id = $attr_route_id > 0 ? $attr_route_id : ( is_singular( 'tvs_route' ) ? get_the_ID() : 0 );

        // Check if route has Vimeo video (real route) or is virtual (mapbox simulation only)
        $vimeo_id = get_post_meta( $route_id, 'vimeo_id', true );
        $is_virtual = empty( $vimeo_id ) || trim( $vimeo_id ) === '';

        // Get route meta for location
        $meta = get_post_meta( $route_id, 'meta', true );
        $lat = '0';
        $lng = '0';
        if ( ! empty( $meta ) && is_string( $meta ) ) {
            $meta_arr = json_decode( $meta, true );
            if ( ! empty( $meta_arr['lat'] ) ) {
                $lat = $meta_arr['lat'];
            }
            if ( ! empty( $meta_arr['lng'] ) ) {
                $lng = $meta_arr['lng'];
            }
        }

        ob_start();
        ?>
        <div class="tvs-app tvs-weather-widget">
            <div id="<?php echo esc_attr( $mount_id ); ?>"
                 class="tvs-route-weather"
                 data-route-id="<?php echo esc_attr( $route_id ); ?>"
                 data-title="<?php echo esc_attr( $title ); ?>"
                 data-max-distance="<?php echo esc_attr( $max_distance ); ?>"
                 data-lat="<?php echo esc_attr( $lat ); ?>"
                 data-lng="<?php echo esc_attr( $lng ); ?>"
                 data-debug="<?php echo esc_attr( $debug ? '1' : '0' ); ?>"
                 data-plugin-url="<?php echo esc_attr( TVS_PLUGIN_URL ); ?>"
                 data-is-virtual="<?php echo esc_attr( $is_virtual ? '1' : '0' ); ?>"
            >
                <div class="tvs-weather-loading">
                    <div class="tvs-weather-shimmer">
                        <div class="tvs-shimmer-icon"></div>
                        <div class="tvs-shimmer-text"></div>
                        <div class="tvs-shimmer-text"></div>
                    </div>
                </div>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    public function render_manual_activity_tracker_block( $attributes ) {
        // Must be logged in to use manual activity tracker
        if ( ! is_user_logged_in() ) {
            return '<div class="tvs-app"><p>' . esc_html__( 'You must be logged in to track activities.', 'tvs-virtual-sports' ) . '</p></div>';
        }

        // Enqueue block-specific frontend script and styles
        wp_enqueue_script( 'tvs-block-manual-activity-tracker' );
        wp_enqueue_style( 'tvs-public' );

        $mount_id = 'tvs-manual-tracker-' . uniqid();
        $title = isset( $attributes['title'] ) ? sanitize_text_field( $attributes['title'] ) : 'Start Activity';
        $show_type_selector = isset( $attributes['showTypeSelector'] ) ? (bool) $attributes['showTypeSelector'] : true;
        $allowed_types = isset( $attributes['allowedTypes'] ) && is_array( $attributes['allowedTypes'] ) 
            ? array_map( 'sanitize_text_field', $attributes['allowedTypes'] ) 
            : array( 'Run', 'Ride', 'Walk', 'Hike', 'Swim', 'Workout' );
        $auto_start = isset( $attributes['autoStart'] ) ? (bool) $attributes['autoStart'] : false;
        $default_type = isset( $attributes['defaultType'] ) ? sanitize_text_field( $attributes['defaultType'] ) : 'Run';

        ob_start();
        ?>
        <div class="tvs-app tvs-manual-tracker-widget">
            <div id="<?php echo esc_attr( $mount_id ); ?>"
                 class="tvs-manual-activity-tracker"
                 data-title="<?php echo esc_attr( $title ); ?>"
                 data-show-type-selector="<?php echo esc_attr( $show_type_selector ? '1' : '0' ); ?>"
                 data-allowed-types="<?php echo esc_attr( wp_json_encode( $allowed_types ) ); ?>"
                 data-auto-start="<?php echo esc_attr( $auto_start ? '1' : '0' ); ?>"
                 data-default-type="<?php echo esc_attr( $default_type ); ?>"
            >
                <div class="tvs-tracker-loading">
                    <p><?php esc_html_e( 'Loading activity tracker...', 'tvs-virtual-sports' ); ?></p>
                </div>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    public function render_activity_stats_dashboard_block( $attributes ) {
        wp_enqueue_script( 'tvs-block-activity-stats-dashboard' );
        wp_enqueue_style( 'tvs-public' );

        $mount_id = 'tvs-activity-stats-dashboard-' . uniqid();
        $user_id  = isset( $attributes['userId'] ) && $attributes['userId'] > 0 
            ? intval( $attributes['userId'] ) 
            : get_current_user_id();
        $period   = isset( $attributes['period'] ) ? sanitize_text_field( $attributes['period'] ) : '30d';
        $title    = isset( $attributes['title'] ) ? sanitize_text_field( $attributes['title'] ) : 'Activity Dashboard';
        $show_charts = isset( $attributes['showCharts'] ) ? (bool) $attributes['showCharts'] : true;

        ob_start();
        ?>
        <div class="tvs-app tvs-app--stats-dashboard">
            <div id="<?php echo esc_attr( $mount_id ); ?>"
                 class="tvs-stats-dashboard-block"
                 data-user-id="<?php echo esc_attr( $user_id ); ?>"
                 data-period="<?php echo esc_attr( $period ); ?>"
                 data-title="<?php echo esc_attr( $title ); ?>"
                 data-show-charts="<?php echo esc_attr( $show_charts ? '1' : '0' ); ?>"
            ></div>
        </div>
        <?php
        return ob_get_clean();
    }

    public function render_single_activity_details_block( $attributes ) {
        wp_enqueue_script( 'tvs-block-single-activity-details' );
        wp_enqueue_style( 'tvs-public' );

        $mount_id = 'tvs-single-activity-details-' . uniqid();
        
        // Auto-detect activity ID from global post or use attribute
        $activity_id = isset( $attributes['activityId'] ) && $attributes['activityId'] > 0 
            ? intval( $attributes['activityId'] ) 
            : get_the_ID();
        
        // Verify it's an activity post
        if ( get_post_type( $activity_id ) !== 'tvs_activity' ) {
            return '<p>' . __( 'This block can only be used on activity pages.', 'tvs-virtual-sports' ) . '</p>';
        }
        
        $show_comparison = isset( $attributes['showComparison'] ) ? (bool) $attributes['showComparison'] : true;
        $show_actions = isset( $attributes['showActions'] ) ? (bool) $attributes['showActions'] : true;
        $show_notes = isset( $attributes['showNotes'] ) ? (bool) $attributes['showNotes'] : true;
        
        $current_user_id = get_current_user_id();
        $is_author = $current_user_id && ( $current_user_id == get_post_field( 'post_author', $activity_id ) );
        
        // Fetch metadata directly as fallback (since REST API might not expose it)
        $meta_fields = array(
            'distance_m' => get_post_meta( $activity_id, 'distance_m', true ),
            'duration_s' => get_post_meta( $activity_id, 'duration_s', true ),
            'rating' => get_post_meta( $activity_id, 'rating', true ),
            'notes' => get_post_meta( $activity_id, 'notes', true ),
            'activity_type' => get_post_meta( $activity_id, 'activity_type', true ),
            'route_id' => get_post_meta( $activity_id, 'route_id', true ),
            'source' => get_post_meta( $activity_id, 'source', true ),
            'activity_date' => get_post_meta( $activity_id, 'activity_date', true ),
        );
        
        // For workout activities, include exercises and circuits
        $exercises_json = get_post_meta( $activity_id, '_tvs_manual_exercises', true );
        $circuits_json = get_post_meta( $activity_id, '_tvs_manual_circuits', true );
        if ( $exercises_json ) {
            $meta_fields['exercises'] = json_decode( $exercises_json, true );
        }
        if ( $circuits_json ) {
            $meta_fields['circuits'] = json_decode( $circuits_json, true );
        }

        ob_start();
        ?>
        <div class="tvs-app tvs-app--activity-details">
            <div id="<?php echo esc_attr( $mount_id ); ?>"
                 class="tvs-single-activity-details-block"
                 data-activity-id="<?php echo esc_attr( $activity_id ); ?>"
                 data-show-comparison="<?php echo esc_attr( $show_comparison ? '1' : '0' ); ?>"
                 data-show-actions="<?php echo esc_attr( $show_actions ? '1' : '0' ); ?>"
                 data-show-notes="<?php echo esc_attr( $show_notes ? '1' : '0' ); ?>"
                 data-is-author="<?php echo esc_attr( $is_author ? '1' : '0' ); ?>"
                 data-meta="<?php echo esc_attr( wp_json_encode( $meta_fields ) ); ?>"
            ></div>
        </div>
        <?php
        return ob_get_clean();
    }

    public function render_activity_timeline_block( $attributes ) {
        wp_enqueue_script( 'tvs-block-activity-timeline' );
        wp_enqueue_style( 'tvs-public' );

        $mount_id = 'tvs-activity-timeline-' . uniqid();
        $user_id  = isset( $attributes['userId'] ) && $attributes['userId'] > 0 
            ? intval( $attributes['userId'] ) 
            : get_current_user_id();
        
        // Require authentication
        if ( ! is_user_logged_in() && $user_id === 0 ) {
            return '<div class="tvs-app tvs-auth-required"><p>Du må <a href="/login/">logge inn</a> for å se din aktivitetstidslinje.</p></div>';
        }
        
        $limit      = isset( $attributes['limit'] ) ? max( 1, min( 50, intval( $attributes['limit'] ) ) ) : 10;
        $title      = isset( $attributes['title'] ) ? sanitize_text_field( $attributes['title'] ) : 'Activity Timeline';
        $show_notes = isset( $attributes['showNotes'] ) ? (bool) $attributes['showNotes'] : true;
        $show_filters = isset( $attributes['showFilters'] ) ? (bool) $attributes['showFilters'] : false;

        ob_start();
        ?>
        <div class="tvs-app tvs-app--activity-timeline">
            <div id="<?php echo esc_attr( $mount_id ); ?>"
                 class="tvs-activity-timeline-block"
                 data-user-id="<?php echo esc_attr( $user_id ); ?>"
                 data-limit="<?php echo esc_attr( $limit ); ?>"
                 data-title="<?php echo esc_attr( $title ); ?>"
                 data-show-notes="<?php echo esc_attr( $show_notes ? '1' : '0' ); ?>"
                 data-show-filters="<?php echo esc_attr( $show_filters ? '1' : '0' ); ?>"
            ></div>
        </div>
        <?php
        return ob_get_clean();
    }

    public function render_activity_gallery_block( $attributes ) {
        wp_enqueue_script( 'tvs-block-activity-gallery' );
        wp_enqueue_style( 'tvs-public' );

        $mount_id = 'tvs-activity-gallery-' . uniqid();
        $user_id  = isset( $attributes['userId'] ) && $attributes['userId'] > 0 
            ? intval( $attributes['userId'] ) 
            : get_current_user_id();
        
        // Require authentication
        if ( ! is_user_logged_in() && $user_id === 0 ) {
            return '<div class="tvs-app tvs-auth-required"><p>Du må <a href="/login/">logge inn</a> for å se ditt aktivitetsgalleri.</p></div>';
        }
        
        $limit        = isset( $attributes['limit'] ) ? max( 1, min( 100, intval( $attributes['limit'] ) ) ) : 12;
        $title        = isset( $attributes['title'] ) ? sanitize_text_field( $attributes['title'] ) : 'Activity Gallery';
        $layout       = isset( $attributes['layout'] ) ? sanitize_text_field( $attributes['layout'] ) : 'grid';
        $columns      = isset( $attributes['columns'] ) ? max( 1, min( 4, intval( $attributes['columns'] ) ) ) : 3;
        $show_filters = isset( $attributes['showFilters'] ) ? (bool) $attributes['showFilters'] : true;

        ob_start();
        ?>
        <div class="tvs-app tvs-app--activity-gallery">
            <div id="<?php echo esc_attr( $mount_id ); ?>"
                 class="tvs-activity-gallery-block"
                 data-user-id="<?php echo esc_attr( $user_id ); ?>"
                 data-limit="<?php echo esc_attr( $limit ); ?>"
                 data-title="<?php echo esc_attr( $title ); ?>"
                 data-layout="<?php echo esc_attr( $layout ); ?>"
                 data-columns="<?php echo esc_attr( $columns ); ?>"
                 data-show-filters="<?php echo esc_attr( $show_filters ? '1' : '0' ); ?>"
            ></div>
        </div>
        <?php
        return ob_get_clean();
    }

    private function tvs_human_km( $meters ) {
        $m = floatval( $meters );
        if ( $m <= 0 ) return '';
        $km = $m / 1000;
        return ( $km >= 10 ) ? number_format( floor( $km ) ) . ' km' : number_format( $km, 1 ) . ' km';
    }

    private function tvs_human_elevation( $meters ) {
        $m = intval( $meters );
        if ( $m <= 0 ) return '';
        return number_format( $m ) . ' m';
    }

    public function render_my_favourites_block( $attributes ) {
        $user_id = get_current_user_id();
        
        // If not logged in, show login prompt
        if ( ! $user_id ) {
            $login_url = wp_login_url( get_permalink() );
            return sprintf(
                '<div class="tvs-favourites-block tvs-auth-required" style="padding: var(--tvs-space-8); text-align: center; background: var(--tvs-glass-bg); backdrop-filter: blur(var(--tvs-glass-blur)); border: 1px solid var(--tvs-glass-border); border-radius: var(--tvs-radius-lg);">
                    <p style="margin-bottom: var(--tvs-space-4); font-size: var(--tvs-text-lg); color: var(--tvs-color-text-primary);">Please log in to view your favourites.</p>
                    <a href="%s" style="display: inline-block; padding: var(--tvs-button-padding-y) var(--tvs-button-padding-x); background: var(--tvs-color-primary); color: var(--tvs-color-text-on-primary); border-radius: var(--tvs-button-radius); text-decoration: none; font-weight: var(--tvs-button-font-weight);">Log In</a>
                </div>',
                esc_url( $login_url )
            );
        }

        // Get user's favourite route IDs
        $fav_ids = get_user_meta( $user_id, 'tvs_favorites_routes', true );
        if ( is_string( $fav_ids ) ) {
            $maybe = json_decode( $fav_ids, true );
            if ( is_array( $maybe ) ) $fav_ids = $maybe;
        }
        if ( ! is_array( $fav_ids ) ) $fav_ids = array();
        $fav_ids = array_values( array_unique( array_map( 'intval', $fav_ids ) ) );

        // If no favourites, show empty state
        if ( empty( $fav_ids ) ) {
            $empty_text = isset( $attributes['emptyStateText'] ) ? $attributes['emptyStateText'] : 'No favourites yet. Start exploring routes to add some!';
            return sprintf(
                '<div class="tvs-favourites-block tvs-empty-state" style="padding: var(--tvs-space-8); text-align: center; background: var(--tvs-glass-bg); backdrop-filter: blur(var(--tvs-glass-blur)); border: 1px solid var(--tvs-glass-border); border-radius: var(--tvs-radius-lg);">
                    <p style="font-size: var(--tvs-text-lg); color: var(--tvs-color-text-secondary);">%s</p>
                </div>',
                esc_html( $empty_text )
            );
        }

        // Query favourite routes
        $per_page = isset( $attributes['perPage'] ) ? max( 1, min( 100, intval( $attributes['perPage'] ) ) ) : 12;
        $layout = isset( $attributes['layout'] ) ? sanitize_text_field( $attributes['layout'] ) : 'grid';
        $columns = isset( $attributes['columns'] ) ? max( 1, min( 4, intval( $attributes['columns'] ) ) ) : 3;
        $show_meta = isset( $attributes['showMeta'] ) ? (bool) $attributes['showMeta'] : true;
        $show_badges = isset( $attributes['showBadges'] ) ? (bool) $attributes['showBadges'] : true;
        $show_difficulty = isset( $attributes['showDifficulty'] ) ? (bool) $attributes['showDifficulty'] : true;

        $args = array(
            'post_type'      => 'tvs_route',
            'post_status'    => 'publish',
            'post__in'       => $fav_ids,
            'orderby'        => 'post__in',
            'posts_per_page' => $per_page,
        );

        $query = new WP_Query( $args );
        
        if ( ! $query->have_posts() ) {
            wp_reset_postdata();
            return '<div class="tvs-favourites-block tvs-no-results" style="padding: var(--tvs-space-4); text-align: center;">No routes found.</div>';
        }

        ob_start();
        
        // Layout-specific styles
        $container_style = $layout === 'list' 
            ? 'display: flex; flex-direction: column; gap: var(--tvs-space-4);'
            : 'display: grid; grid-template-columns: repeat(' . esc_attr( $columns ) . ', 1fr); gap: var(--tvs-space-6);';
        
        $card_style_base = 'background: var(--tvs-glass-bg); backdrop-filter: blur(var(--tvs-glass-blur)); border: 1px solid var(--tvs-glass-border); border-radius: var(--tvs-radius-lg); overflow: hidden;';
        $card_style = $layout === 'list' 
            ? $card_style_base . ' display: flex; flex-direction: row;'
            : $card_style_base;
        
        $image_style = $layout === 'list'
            ? 'width: 200px; height: 150px; object-fit: cover; flex-shrink: 0;'
            : 'width: 100%; height: 200px; object-fit: cover;';
        ?>
        <div class="tvs-favourites-block tvs-my-favourites" data-layout="<?php echo esc_attr( $layout ); ?>">
            <div class="tvs-routes-<?php echo esc_attr( $layout ); ?> <?php echo $layout === 'grid' ? 'tvs-favourites-grid' : ''; ?>" style="<?php echo esc_attr( $container_style ); ?>">
                <?php while ( $query->have_posts() ) : $query->the_post(); 
                    $id = get_the_ID();
                    $permalink = get_permalink();
                    $image_url = get_the_post_thumbnail_url( $id, 'medium' );
                    if ( ! $image_url ) {
                        $image_url = home_url( '/wp-content/uploads/2025/10/ActivityDymmy2-300x200.jpg' );
                    }
                    
                    // Meta with fallbacks to both legacy _tvs_* and new names
                    $dist_m = get_post_meta( $id, 'distance_m', true );
                    if ( '' === $dist_m ) $dist_m = get_post_meta( $id, '_tvs_distance_m', true );
                    if ( '' === $dist_m ) $dist_m = get_post_meta( $id, 'distance', true ); // old old fallback
                    
                    $elev_m = get_post_meta( $id, 'elevation_m', true );
                    if ( '' === $elev_m ) $elev_m = get_post_meta( $id, '_tvs_elevation_m', true );
                    if ( '' === $elev_m ) $elev_m = get_post_meta( $id, 'elevation', true ); // old old fallback
                    
                    $distance = $this->tvs_human_km( $dist_m );
                    $elevation = $this->tvs_human_elevation( $elev_m );
                    $difficulty = get_post_meta( $id, 'difficulty', true );
                    $surface = get_post_meta( $id, 'surface', true );
                ?>
                    <a href="<?php echo esc_url( $permalink ); ?>" class="tvs-route-card" style="<?php echo esc_attr( $card_style ); ?> text-decoration: none; color: inherit; transition: transform 0.2s, box-shadow 0.2s; cursor: pointer;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 24px rgba(0,0,0,0.15)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
                        <?php if ( $image_url ) : ?>
                            <div style="position: relative; <?php echo $layout === 'list' ? 'flex-shrink: 0;' : ''; ?>">
                                <img src="<?php echo esc_url( $image_url ); ?>" alt="<?php echo esc_attr( get_the_title() ); ?>" style="<?php echo esc_attr( $image_style ); ?>">
                                
                                <?php if ( $layout === 'grid' ) : ?>
                                    <!-- Grid: badges top-left -->
                                    <?php if ( $show_badges && ( ( $show_difficulty && $difficulty ) || $surface ) ) : ?>
                                        <div style="position: absolute; top: var(--tvs-space-2); left: var(--tvs-space-2); display: flex; gap: var(--tvs-space-2); z-index: 10;">
                                            <?php if ( $show_difficulty && $difficulty ) : ?>
                                                <span style="background: rgba(0,0,0,0.7); backdrop-filter: blur(8px); padding: var(--tvs-badge-padding-y) var(--tvs-badge-padding-x); border-radius: var(--tvs-badge-radius); font-size: var(--tvs-badge-font-size); font-weight: var(--tvs-badge-font-weight); color: white;">
                                                    <?php echo esc_html( ucfirst( $difficulty ) ); ?>
                                                </span>
                                            <?php endif; ?>
                                            <?php if ( $surface ) : ?>
                                                <span style="background: rgba(0,0,0,0.7); backdrop-filter: blur(8px); padding: var(--tvs-badge-padding-y) var(--tvs-badge-padding-x); border-radius: var(--tvs-badge-radius); font-size: var(--tvs-badge-font-size); font-weight: var(--tvs-badge-font-weight); color: white;">
                                                    <?php echo esc_html( ucfirst( $surface ) ); ?>
                                                </span>
                                            <?php endif; ?>
                                        </div>
                                    <?php endif; ?>
                                    
                                    <!-- Grid: meta pills bottom-right -->
                                    <?php if ( $show_meta && ( $distance || $elevation ) ) : ?>
                                        <div style="position: absolute; bottom: var(--tvs-space-2); right: var(--tvs-space-2); display: flex; gap: var(--tvs-space-2); z-index: 10;">
                                            <?php if ( $distance ) : ?>
                                                <span style="background: rgba(0,0,0,0.7); backdrop-filter: blur(8px); padding: var(--tvs-badge-padding-y) var(--tvs-badge-padding-x); border-radius: var(--tvs-badge-radius); font-size: var(--tvs-badge-font-size); font-weight: var(--tvs-badge-font-weight); color: white;">
                                                    📏 <?php echo esc_html( $distance ); ?>
                                                </span>
                                            <?php endif; ?>
                                            <?php if ( $elevation ) : ?>
                                                <span style="background: rgba(0,0,0,0.7); backdrop-filter: blur(8px); padding: var(--tvs-badge-padding-y) var(--tvs-badge-padding-x); border-radius: var(--tvs-badge-radius); font-size: var(--tvs-badge-font-size); font-weight: var(--tvs-badge-font-weight); color: white;">
                                                    ⛰️ <?php echo esc_html( $elevation ); ?>
                                                </span>
                                            <?php endif; ?>
                                        </div>
                                    <?php endif; ?>
                                <?php endif; ?>
                            </div>
                        <?php endif; ?>
                        
                        <div style="padding: var(--tvs-space-4); <?php echo $layout === 'list' ? 'flex: 1; display: flex; flex-direction: column; gap: var(--tvs-space-3);' : ''; ?>">
                            <h3 style="margin: 0 <?php echo $layout === 'list' ? '0 var(--tvs-space-2)' : '0 var(--tvs-space-2)'; ?>; font-size: var(--tvs-text-lg); font-weight: var(--tvs-font-semibold); color: var(--tvs-color-text-primary);">
                                <?php echo esc_html( get_the_title() ); ?>
                            </h3>
                            
                            <?php if ( $layout === 'list' ) : ?>
                                <!-- List: badges and meta in grid below title -->
                                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, max-content)); gap: var(--tvs-space-2); align-items: start;">
                                    <?php if ( $show_badges && $show_difficulty && $difficulty ) : ?>
                                        <span style="background: var(--tvs-color-surface-raised); padding: var(--tvs-badge-padding-y) var(--tvs-badge-padding-x); border-radius: var(--tvs-badge-radius); font-size: var(--tvs-badge-font-size); font-weight: var(--tvs-badge-font-weight); color: var(--tvs-color-text-primary); white-space: nowrap;">
                                            <?php echo esc_html( ucfirst( $difficulty ) ); ?>
                                        </span>
                                    <?php endif; ?>
                                    <?php if ( $show_badges && $surface ) : ?>
                                        <span style="background: var(--tvs-color-surface-raised); padding: var(--tvs-badge-padding-y) var(--tvs-badge-padding-x); border-radius: var(--tvs-badge-radius); font-size: var(--tvs-badge-font-size); font-weight: var(--tvs-badge-font-weight); color: var(--tvs-color-text-primary); white-space: nowrap;">
                                            <?php echo esc_html( ucfirst( $surface ) ); ?>
                                        </span>
                                    <?php endif; ?>
                                    <?php if ( $show_meta && $distance ) : ?>
                                        <span style="background: var(--tvs-color-surface-raised); padding: var(--tvs-badge-padding-y) var(--tvs-badge-padding-x); border-radius: var(--tvs-badge-radius); font-size: var(--tvs-badge-font-size); color: var(--tvs-color-text-secondary); white-space: nowrap;">
                                            📏 <?php echo esc_html( $distance ); ?>
                                        </span>
                                    <?php endif; ?>
                                    <?php if ( $show_meta && $elevation ) : ?>
                                        <span style="background: var(--tvs-color-surface-raised); padding: var(--tvs-badge-padding-y) var(--tvs-badge-padding-x); border-radius: var(--tvs-badge-radius); font-size: var(--tvs-badge-font-size); color: var(--tvs-color-text-secondary); white-space: nowrap;">
                                            ⛰️ <?php echo esc_html( $elevation ); ?>
                                        </span>
                                    <?php endif; ?>
                                </div>
                            <?php endif; ?>
                        </div>
                    </a>
                <?php endwhile; ?>
            </div>
        </div>
        <?php
        wp_reset_postdata();
        return ob_get_clean();
    }

    public function render_people_favourites_block( $attributes ) {
        $per_page = isset( $attributes['perPage'] ) ? max( 1, min( 100, intval( $attributes['perPage'] ) ) ) : 12;
        $layout = isset( $attributes['layout'] ) ? sanitize_text_field( $attributes['layout'] ) : 'grid';
        $columns = isset( $attributes['columns'] ) ? max( 1, min( 4, intval( $attributes['columns'] ) ) ) : 3;
        $show_counts = isset( $attributes['showCounts'] ) ? (bool) $attributes['showCounts'] : true;
        $show_meta = isset( $attributes['showMeta'] ) ? (bool) $attributes['showMeta'] : true;
        $show_badges = isset( $attributes['showBadges'] ) ? (bool) $attributes['showBadges'] : true;
        $show_difficulty = isset( $attributes['showDifficulty'] ) ? (bool) $attributes['showDifficulty'] : true;

        // Get all users' favorite route IDs and count them
        global $wpdb;
        $results = $wpdb->get_results( 
            "SELECT meta_value FROM {$wpdb->usermeta} WHERE meta_key = 'tvs_favorites_routes'",
            ARRAY_A 
        );
        
        $route_counts = array();
        foreach ( $results as $row ) {
            $fav_ids = maybe_unserialize( $row['meta_value'] );
            if ( is_string( $fav_ids ) ) {
                $maybe = json_decode( $fav_ids, true );
                if ( is_array( $maybe ) ) $fav_ids = $maybe;
            }
            if ( ! is_array( $fav_ids ) ) continue;
            
            foreach ( $fav_ids as $route_id ) {
                $route_id = intval( $route_id );
                if ( $route_id > 0 ) {
                    if ( ! isset( $route_counts[ $route_id ] ) ) {
                        $route_counts[ $route_id ] = 0;
                    }
                    $route_counts[ $route_id ]++;
                }
            }
        }
        
        // Sort by count descending
        arsort( $route_counts );
        
        // Get top N route IDs
        $top_route_ids = array_slice( array_keys( $route_counts ), 0, $per_page, true );
        
        if ( empty( $top_route_ids ) ) {
            return '<div class="tvs-favourites-block tvs-no-results" style="padding: var(--tvs-space-4); text-align: center;">No favourited routes yet.</div>';
        }

        $args = array(
            'post_type'      => 'tvs_route',
            'post_status'    => 'publish',
            'post__in'       => $top_route_ids,
            'orderby'        => 'post__in',
            'posts_per_page' => $per_page,
        );

        $query = new WP_Query( $args );
        
        if ( ! $query->have_posts() ) {
            wp_reset_postdata();
            return '<div class="tvs-favourites-block tvs-no-results" style="padding: var(--tvs-space-4); text-align: center;">No favourited routes yet.</div>';
        }

        ob_start();
        
        // Layout-specific styles
        $container_style = $layout === 'list' 
            ? 'display: flex; flex-direction: column; gap: var(--tvs-space-4);'
            : 'display: grid; grid-template-columns: repeat(' . esc_attr( $columns ) . ', 1fr); gap: var(--tvs-space-6);';
        
        $card_style_base = 'background: var(--tvs-glass-bg); backdrop-filter: blur(var(--tvs-glass-blur)); border: 1px solid var(--tvs-glass-border); border-radius: var(--tvs-radius-lg); overflow: hidden; position: relative;';
        $card_style = $layout === 'list' 
            ? $card_style_base . ' display: flex; flex-direction: row;'
            : $card_style_base;
        
        $image_style = $layout === 'list'
            ? 'width: 200px; height: 150px; object-fit: cover; flex-shrink: 0;'
            : 'width: 100%; height: 200px; object-fit: cover;';
        ?>
        <div class="tvs-favourites-block tvs-people-favourites" data-layout="<?php echo esc_attr( $layout ); ?>">
            <div class="tvs-routes-<?php echo esc_attr( $layout ); ?> <?php echo $layout === 'grid' ? 'tvs-favourites-grid' : ''; ?>" style="<?php echo esc_attr( $container_style ); ?>">
                <?php while ( $query->have_posts() ) : $query->the_post(); 
                    $id = get_the_ID();
                    $permalink = get_permalink();
                    $image_url = get_the_post_thumbnail_url( $id, 'medium' );
                    if ( ! $image_url ) {
                        $image_url = home_url( '/wp-content/uploads/2025/10/ActivityDymmy2-300x200.jpg' );
                    }
                    
                    // Meta with fallbacks to both legacy _tvs_* and new names
                    $dist_m = get_post_meta( $id, 'distance_m', true );
                    if ( '' === $dist_m ) $dist_m = get_post_meta( $id, '_tvs_distance_m', true );
                    if ( '' === $dist_m ) $dist_m = get_post_meta( $id, 'distance', true ); // old old fallback
                    
                    $elev_m = get_post_meta( $id, 'elevation_m', true );
                    if ( '' === $elev_m ) $elev_m = get_post_meta( $id, '_tvs_elevation_m', true );
                    if ( '' === $elev_m ) $elev_m = get_post_meta( $id, 'elevation', true ); // old old fallback
                    
                    $distance = $this->tvs_human_km( $dist_m );
                    $elevation = $this->tvs_human_elevation( $elev_m );
                    $difficulty = get_post_meta( $id, 'difficulty', true );
                    $surface = get_post_meta( $id, 'surface', true );
                    $fav_count = isset( $route_counts[ $id ] ) ? $route_counts[ $id ] : 0;
                ?>
                    <a href="<?php echo esc_url( $permalink ); ?>" class="tvs-route-card" style="<?php echo esc_attr( $card_style ); ?> text-decoration: none; color: inherit; transition: transform 0.2s, box-shadow 0.2s; cursor: pointer;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 24px rgba(0,0,0,0.15)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
                        <?php if ( $image_url ) : ?>
                            <div style="position: relative; <?php echo $layout === 'list' ? 'flex-shrink: 0;' : ''; ?>">
                                <img src="<?php echo esc_url( $image_url ); ?>" alt="<?php echo esc_attr( get_the_title() ); ?>" style="<?php echo esc_attr( $image_style ); ?>">
                                
                                <?php if ( $show_counts && $fav_count > 0 ) : ?>
                                    <div style="position: absolute; top: var(--tvs-space-2); right: var(--tvs-space-2); background: rgba(0,0,0,0.7); backdrop-filter: blur(8px); padding: var(--tvs-badge-padding-y) var(--tvs-badge-padding-x); border-radius: var(--tvs-badge-radius); font-size: var(--tvs-badge-font-size); font-weight: var(--tvs-badge-font-weight); color: white; z-index: 10;">
                                        ❤️ <?php echo esc_html( $fav_count ); ?>
                                    </div>
                                <?php endif; ?>
                                
                                <?php if ( $layout === 'grid' ) : ?>
                                    <!-- Grid: badges top-left -->
                                    <?php if ( $show_badges && ( ( $show_difficulty && $difficulty ) || $surface ) ) : ?>
                                        <div style="position: absolute; top: var(--tvs-space-2); left: var(--tvs-space-2); display: flex; gap: var(--tvs-space-2); z-index: 10;">
                                            <?php if ( $show_difficulty && $difficulty ) : ?>
                                                <span style="background: rgba(0,0,0,0.7); backdrop-filter: blur(8px); padding: var(--tvs-badge-padding-y) var(--tvs-badge-padding-x); border-radius: var(--tvs-badge-radius); font-size: var(--tvs-badge-font-size); font-weight: var(--tvs-badge-font-weight); color: white;">
                                                    <?php echo esc_html( ucfirst( $difficulty ) ); ?>
                                                </span>
                                            <?php endif; ?>
                                            <?php if ( $surface ) : ?>
                                                <span style="background: rgba(0,0,0,0.7); backdrop-filter: blur(8px); padding: var(--tvs-badge-padding-y) var(--tvs-badge-padding-x); border-radius: var(--tvs-badge-radius); font-size: var(--tvs-badge-font-size); font-weight: var(--tvs-badge-font-weight); color: white;">
                                                    <?php echo esc_html( ucfirst( $surface ) ); ?>
                                                </span>
                                            <?php endif; ?>
                                        </div>
                                    <?php endif; ?>
                                    
                                    <!-- Grid: meta pills bottom-right -->
                                    <?php if ( $show_meta && ( $distance || $elevation ) ) : ?>
                                        <div style="position: absolute; bottom: var(--tvs-space-2); right: var(--tvs-space-2); display: flex; gap: var(--tvs-space-2); z-index: 10;">
                                            <?php if ( $distance ) : ?>
                                                <span style="background: rgba(0,0,0,0.7); backdrop-filter: blur(8px); padding: var(--tvs-badge-padding-y) var(--tvs-badge-padding-x); border-radius: var(--tvs-badge-radius); font-size: var(--tvs-badge-font-size); font-weight: var(--tvs-badge-font-weight); color: white;">
                                                    📏 <?php echo esc_html( $distance ); ?>
                                                </span>
                                            <?php endif; ?>
                                            <?php if ( $elevation ) : ?>
                                                <span style="background: rgba(0,0,0,0.7); backdrop-filter: blur(8px); padding: var(--tvs-badge-padding-y) var(--tvs-badge-padding-x); border-radius: var(--tvs-badge-radius); font-size: var(--tvs-badge-font-size); font-weight: var(--tvs-badge-font-weight); color: white;">
                                                    ⛰️ <?php echo esc_html( $elevation ); ?>
                                                </span>
                                            <?php endif; ?>
                                        </div>
                                    <?php endif; ?>
                                <?php endif; ?>
                            </div>
                        <?php endif; ?>
                        
                        <div style="padding: var(--tvs-space-4); <?php echo $layout === 'list' ? 'flex: 1; display: flex; flex-direction: column; gap: var(--tvs-space-3);' : ''; ?>">
                            <h3 style="margin: 0 <?php echo $layout === 'list' ? '0 var(--tvs-space-2)' : '0 var(--tvs-space-2)'; ?>; font-size: var(--tvs-text-lg); font-weight: var(--tvs-font-semibold); color: var(--tvs-color-text-primary);">
                                <?php echo esc_html( get_the_title() ); ?>
                            </h3>
                            
                            <?php if ( $layout === 'list' ) : ?>
                                <!-- List: badges and meta in grid below title -->
                                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, max-content)); gap: var(--tvs-space-2); align-items: start;">
                                    <?php if ( $show_badges && $show_difficulty && $difficulty ) : ?>
                                        <span style="background: var(--tvs-color-surface-raised); padding: var(--tvs-badge-padding-y) var(--tvs-badge-padding-x); border-radius: var(--tvs-badge-radius); font-size: var(--tvs-badge-font-size); font-weight: var(--tvs-badge-font-weight); color: var(--tvs-color-text-primary); white-space: nowrap;">
                                            <?php echo esc_html( ucfirst( $difficulty ) ); ?>
                                        </span>
                                    <?php endif; ?>
                                    <?php if ( $show_badges && $surface ) : ?>
                                        <span style="background: var(--tvs-color-surface-raised); padding: var(--tvs-badge-padding-y) var(--tvs-badge-padding-x); border-radius: var(--tvs-badge-radius); font-size: var(--tvs-badge-font-size); font-weight: var(--tvs-badge-font-weight); color: var(--tvs-color-text-primary); white-space: nowrap;">
                                            <?php echo esc_html( ucfirst( $surface ) ); ?>
                                        </span>
                                    <?php endif; ?>
                                    <?php if ( $show_meta && $distance ) : ?>
                                        <span style="background: var(--tvs-color-surface-raised); padding: var(--tvs-badge-padding-y) var(--tvs-badge-padding-x); border-radius: var(--tvs-badge-radius); font-size: var(--tvs-badge-font-size); color: var(--tvs-color-text-secondary); white-space: nowrap;">
                                            📏 <?php echo esc_html( $distance ); ?>
                                        </span>
                                    <?php endif; ?>
                                    <?php if ( $show_meta && $elevation ) : ?>
                                        <span style="background: var(--tvs-color-surface-raised); padding: var(--tvs-badge-padding-y) var(--tvs-badge-padding-x); border-radius: var(--tvs-badge-radius); font-size: var(--tvs-badge-font-size); color: var(--tvs-color-text-secondary); white-space: nowrap;">
                                            ⛰️ <?php echo esc_html( $elevation ); ?>
                                        </span>
                                    <?php endif; ?>
                                </div>
                            <?php endif; ?>
                        </div>
                    </a>
                <?php endwhile; ?>
            </div>
        </div>
        <?php
        wp_reset_postdata();
        return ob_get_clean();
    }

    public function register_shortcodes() {
        add_shortcode( 'tvs_my_activities', array( $this, 'render_my_activities_block' ) );
    }

    public function admin_assets() {
        wp_enqueue_style( 'tvs-admin', TVS_PLUGIN_URL . 'admin/css/tvs-admin.css', array(), TVS_PLUGIN_VERSION );
        wp_enqueue_script( 'tvs-admin', TVS_PLUGIN_URL . 'admin/js/tvs-admin.js', array( 'jquery' ), TVS_PLUGIN_VERSION, true );

        // Conditionally load TVS token + public styles on our TVS admin pages that use TVS components
        $page = isset( $_GET['page'] ) ? sanitize_key( $_GET['page'] ) : '';
        if ( in_array( $page, array( 'tvs-invitational', 'tvs-security' ), true ) ) {
            // Try to load theme tokens (CSS variables and base components) if available
            $tokens_path = trailingslashit( get_stylesheet_directory() ) . 'assets/css/tvs-tokens.css';
            if ( file_exists( $tokens_path ) ) {
                wp_enqueue_style(
                    'tvs-tokens',
                    trailingslashit( get_stylesheet_directory_uri() ) . 'assets/css/tvs-tokens.css',
                    array(),
                    @filemtime( $tokens_path ) ?: null
                );
            }

            // Load plugin public styles (contains .tvs-app scoped components like buttons)
            wp_enqueue_style( 'tvs-public', TVS_PLUGIN_URL . 'public/css/tvs-public.css', array( 'tvs-tokens' ), TVS_PLUGIN_VERSION );

            // Small layout helpers for the admin invites UI
            $inline = '
            /* Keep WP Admin background/colors intact on this screen while using TVS tokens */
            body.wp-admin { background-color:#f0f0f1 !important; color:#1d2327 !important; }
            /* Local layout tweaks for the invites UI */
            .tvs-invites-actions{display:flex;gap:var(--tvs-space-2,8px);flex-wrap:wrap;align-items:center}
            .tvs-invites-actions .tvs-input{min-width:260px}
            ';
            wp_add_inline_style( 'tvs-public', $inline );
        }
    }

    public function public_assets() {
        wp_enqueue_style( 'tvs-public', TVS_PLUGIN_URL . 'public/css/tvs-public.css', array(), TVS_PLUGIN_VERSION );

        // Register React and ReactDOM from CDN - DEVELOPMENT versions for debugging
        wp_register_script( 'tvs-react', 'https://unpkg.com/react@18/umd/react.development.js', array(), null, true );
        wp_register_script( 'tvs-react-dom', 'https://unpkg.com/react-dom@18/umd/react-dom.development.js', array( 'tvs-react' ), null, true );

        // Register global flash script (must load before tvs-app)
        wp_register_script( 'tvs-flash', TVS_PLUGIN_URL . 'public/js/tvs-flash.js', array(), TVS_PLUGIN_VERSION, true );
        wp_enqueue_script( 'tvs-flash' );

        // Register Mapbox GL JS for virtual training
        wp_register_style( 'mapbox-gl', 'https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css', array(), '3.0.1' );
        wp_register_script( 'mapbox-gl', 'https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.js', array(), '3.0.1', true );

        // Register GSAP for virtual training animation
        wp_register_script( 'gsap', 'https://unpkg.com/gsap@3/dist/gsap.min.js', array(), '3.12.5', true );

    // Register app script (kept separate) and block script (frontend)
    // Include Mapbox and GSAP for virtual training mode
    wp_register_script( 'tvs-app', TVS_PLUGIN_URL . 'public/js/tvs-app.js', array( 'tvs-react', 'tvs-react-dom', 'tvs-flash', 'mapbox-gl', 'gsap' ), TVS_PLUGIN_VERSION, true );
    wp_register_script( 'tvs-block-my-activities', TVS_PLUGIN_URL . 'public/js/tvs-block-my-activities.js', array( 'tvs-react', 'tvs-react-dom', 'tvs-flash' ), TVS_PLUGIN_VERSION, true );
    wp_register_script( 'tvs-block-invites', TVS_PLUGIN_URL . 'public/js/tvs-block-invites.js', array( 'tvs-flash' ), TVS_PLUGIN_VERSION, true );
    wp_register_script( 'tvs-block-route-insights', TVS_PLUGIN_URL . 'public/js/tvs-block-route-insights.js', array( 'tvs-react', 'tvs-react-dom' ), TVS_PLUGIN_VERSION, true );
    wp_register_script( 'tvs-block-personal-records', TVS_PLUGIN_URL . 'public/js/tvs-block-personal-records.js', array( 'tvs-react', 'tvs-react-dom' ), TVS_PLUGIN_VERSION, true );
    wp_register_script( 'tvs-block-activity-heatmap', TVS_PLUGIN_URL . 'public/js/tvs-block-activity-heatmap.js', array( 'tvs-react', 'tvs-react-dom' ), TVS_PLUGIN_VERSION, true );
    wp_register_script( 'tvs-block-route-weather', TVS_PLUGIN_URL . 'public/js/tvs-block-route-weather.js', array(), TVS_PLUGIN_VERSION, true );
    wp_register_script( 'tvs-block-manual-activity-tracker', TVS_PLUGIN_URL . 'public/js/tvs-block-manual-activity-tracker.js', array( 'tvs-react', 'tvs-react-dom', 'tvs-flash' ), TVS_PLUGIN_VERSION, true );
    wp_register_script( 'tvs-block-activity-stats-dashboard', TVS_PLUGIN_URL . 'public/js/tvs-block-activity-stats-dashboard.js', array( 'tvs-react', 'tvs-react-dom', 'tvs-flash' ), TVS_PLUGIN_VERSION, true );
    wp_register_script( 'tvs-block-single-activity-details', TVS_PLUGIN_URL . 'public/js/tvs-block-single-activity-details.js', array( 'tvs-react', 'tvs-react-dom', 'tvs-flash' ), TVS_PLUGIN_VERSION, true );
    wp_register_script( 'tvs-block-activity-timeline', TVS_PLUGIN_URL . 'public/js/tvs-block-activity-timeline.js', array( 'tvs-react', 'tvs-react-dom', 'tvs-flash' ), TVS_PLUGIN_VERSION, true );
    wp_register_script( 'tvs-block-activity-gallery', TVS_PLUGIN_URL . 'public/js/tvs-block-activity-gallery.js', array( 'tvs-react', 'tvs-react-dom', 'tvs-flash' ), TVS_PLUGIN_VERSION, true );
    wp_register_script( 'tvs-block-activity-comparison', TVS_PLUGIN_URL . 'public/js/tvs-block-activity-comparison.js', array( 'tvs-react', 'tvs-react-dom', 'tvs-flash' ), TVS_PLUGIN_VERSION, true );

        // Localize script with settings and nonce
        $settings = array(
            'env'       => ( defined( 'WP_DEBUG' ) && WP_DEBUG ) ? 'development' : 'production',
            'restRoot'  => get_rest_url(),
            'nonce'     => wp_create_nonce( 'wp_rest' ),
            'version'   => TVS_PLUGIN_VERSION,
            'user'      => is_user_logged_in() ? wp_get_current_user()->user_login : null,
            'pluginUrl' => TVS_PLUGIN_URL,
            'themeUrl'  => get_template_directory_uri(),
            'mapbox'    => array(
                'accessToken'         => get_option( 'tvs_mapbox_access_token', '' ),
                'style'               => get_option( 'tvs_mapbox_map_style', 'mapbox://styles/mapbox/satellite-streets-v12' ),
                'initialZoom'         => floatval( get_option( 'tvs_mapbox_initial_zoom', 14 ) ),
                'minZoom'             => floatval( get_option( 'tvs_mapbox_min_zoom', 10 ) ),
                'maxZoom'             => floatval( get_option( 'tvs_mapbox_max_zoom', 18 ) ),
                'pitch'               => floatval( get_option( 'tvs_mapbox_pitch', 60 ) ),
                'bearing'             => floatval( get_option( 'tvs_mapbox_bearing', 0 ) ),
                'defaultSpeed'        => floatval( get_option( 'tvs_mapbox_default_speed', 1.0 ) ),
                'cameraOffset'        => floatval( get_option( 'tvs_mapbox_camera_offset', 0.0002 ) ),
                'smoothFactor'        => floatval( get_option( 'tvs_mapbox_smooth_factor', 0.7 ) ),
                'markerColor'         => get_option( 'tvs_mapbox_marker_color', '#ff0000' ),
                'routeColor'          => get_option( 'tvs_mapbox_route_color', '#ec4899' ),
                'routeWidth'          => intval( get_option( 'tvs_mapbox_route_width', 6 ) ),
                'terrainEnabled'      => (bool) get_option( 'tvs_mapbox_terrain_enabled', 0 ),
                'terrainExaggeration' => floatval( get_option( 'tvs_mapbox_terrain_exaggeration', 1.5 ) ),
                'flyToZoom'           => floatval( get_option( 'tvs_mapbox_flyto_zoom', 16 ) ),
                'buildings3dEnabled'  => (bool) get_option( 'tvs_mapbox_buildings_3d_enabled', 0 ),
            ),
        );
    wp_localize_script( 'tvs-app', 'TVS_SETTINGS', $settings );
    wp_localize_script( 'tvs-block-my-activities', 'TVS_SETTINGS', $settings );
    wp_localize_script( 'tvs-block-invites', 'TVS_SETTINGS', $settings );
    wp_localize_script( 'tvs-block-route-insights', 'TVS_SETTINGS', $settings );
    wp_localize_script( 'tvs-block-personal-records', 'TVS_SETTINGS', $settings );
    wp_localize_script( 'tvs-block-activity-heatmap', 'TVS_SETTINGS', $settings );
    wp_localize_script( 'tvs-block-route-weather', 'TVS_SETTINGS', $settings );
    wp_localize_script( 'tvs-block-manual-activity-tracker', 'TVS_SETTINGS', $settings );
    wp_localize_script( 'tvs-block-activity-stats-dashboard', 'TVS_SETTINGS', $settings );
    wp_localize_script( 'tvs-block-single-activity-details', 'TVS_SETTINGS', $settings );
    wp_localize_script( 'tvs-block-activity-timeline', 'TVS_SETTINGS', $settings );
    wp_localize_script( 'tvs-block-activity-gallery', 'TVS_SETTINGS', $settings );
    wp_localize_script( 'tvs-block-activity-comparison', 'TVS_SETTINGS', $settings );
    }

    /**
     * Editor-only assets: register blocks in client so they appear in the inserter
     */
    public function editor_assets() {
        // Ensure public styles are available inside the editor (for TVS tokens)
        wp_enqueue_style( 'tvs-public', TVS_PLUGIN_URL . 'public/css/tvs-public.css', array(), TVS_PLUGIN_VERSION );

        // Register/Enqueue a tiny editor script to make sure blocks appear in the inserter (safeguard)
        wp_register_script(
            'tvs-blocks-editor',
            TVS_PLUGIN_URL . 'admin/js/tvs-blocks-editor.js',
            array( 'wp-blocks', 'wp-element', 'wp-i18n', 'wp-components', 'wp-block-editor', 'wp-compose', 'wp-hooks' ),
            TVS_PLUGIN_VERSION,
            true
        );
        wp_enqueue_script( 'tvs-blocks-editor' );

        // Register manual activity tracker editor script with proper dependencies
        wp_register_script(
            'tvs-manual-activity-tracker-editor',
            TVS_PLUGIN_URL . 'blocks/manual-activity-tracker/index-simple.js',
            array( 'wp-blocks', 'wp-element', 'wp-i18n', 'wp-components', 'wp-block-editor' ),
            TVS_PLUGIN_VERSION,
            true
        );

        // Register activity timeline editor script
        wp_register_script(
            'tvs-activity-timeline-editor',
            TVS_PLUGIN_URL . 'blocks/activity-timeline/index-simple.js',
            array( 'wp-blocks', 'wp-element', 'wp-i18n', 'wp-components', 'wp-block-editor' ),
            TVS_PLUGIN_VERSION,
            true
        );

        // Register activity gallery editor script
        wp_register_script(
            'tvs-activity-gallery-editor',
            TVS_PLUGIN_URL . 'blocks/activity-gallery/index-simple.js',
            array( 'wp-blocks', 'wp-element', 'wp-i18n', 'wp-components', 'wp-block-editor' ),
            TVS_PLUGIN_VERSION,
            true
        );

        // Register my favourites editor script
        wp_register_script(
            'tvs-my-favourites-editor',
            TVS_PLUGIN_URL . 'blocks/my-favourites/index-simple.js',
            array( 'wp-blocks', 'wp-element', 'wp-i18n', 'wp-components', 'wp-block-editor' ),
            TVS_PLUGIN_VERSION,
            true
        );

        // Register people favourites editor script
        wp_register_script(
            'tvs-people-favourites-editor',
            TVS_PLUGIN_URL . 'blocks/people-favourites/index-simple.js',
            array( 'wp-blocks', 'wp-element', 'wp-i18n', 'wp-components', 'wp-block-editor' ),
            TVS_PLUGIN_VERSION,
            true
        );

        // Register activity comparison editor script
        wp_register_script(
            'tvs-activity-comparison-editor',
            TVS_PLUGIN_URL . 'blocks/activity-comparison/index-simple.js',
            array( 'wp-blocks', 'wp-element', 'wp-i18n', 'wp-components', 'wp-block-editor' ),
            TVS_PLUGIN_VERSION,
            true
        );

        // Also load the frontend invites block script so it can render inside the editor canvas
        // (it mounts onto .tvs-invite-friends-block and needs TVS_SETTINGS)
        wp_enqueue_script( 'tvs-flash', TVS_PLUGIN_URL . 'public/js/tvs-flash.js', array(), TVS_PLUGIN_VERSION, true );
        wp_enqueue_script( 'tvs-block-invites', TVS_PLUGIN_URL . 'public/js/tvs-block-invites.js', array( 'tvs-flash' ), TVS_PLUGIN_VERSION, true );
        $settings = array(
            'env'       => ( defined( 'WP_DEBUG' ) && WP_DEBUG ) ? 'development' : 'production',
            'restRoot'  => get_rest_url(),
            'nonce'     => wp_create_nonce( 'wp_rest' ),
            'version'   => TVS_PLUGIN_VERSION,
            'user'      => is_user_logged_in() ? wp_get_current_user()->user_login : null,
            'pluginUrl' => TVS_PLUGIN_URL,
            'mapbox'    => array(
                'accessToken'         => get_option( 'tvs_mapbox_access_token', '' ),
                'style'               => get_option( 'tvs_mapbox_map_style', 'mapbox://styles/mapbox/satellite-streets-v12' ),
                'initialZoom'         => floatval( get_option( 'tvs_mapbox_initial_zoom', 14 ) ),
                'minZoom'             => floatval( get_option( 'tvs_mapbox_min_zoom', 10 ) ),
                'maxZoom'             => floatval( get_option( 'tvs_mapbox_max_zoom', 18 ) ),
                'pitch'               => floatval( get_option( 'tvs_mapbox_pitch', 60 ) ),
                'bearing'             => floatval( get_option( 'tvs_mapbox_bearing', 0 ) ),
                'defaultSpeed'        => floatval( get_option( 'tvs_mapbox_default_speed', 1.0 ) ),
                'cameraOffset'        => floatval( get_option( 'tvs_mapbox_camera_offset', 0.0002 ) ),
                'smoothFactor'        => floatval( get_option( 'tvs_mapbox_smooth_factor', 0.7 ) ),
                'markerColor'         => get_option( 'tvs_mapbox_marker_color', '#ff0000' ),
                'routeColor'          => get_option( 'tvs_mapbox_route_color', '#ec4899' ),
                'routeWidth'          => intval( get_option( 'tvs_mapbox_route_width', 6 ) ),
                'terrainEnabled'      => (bool) get_option( 'tvs_mapbox_terrain_enabled', 0 ),
                'terrainExaggeration' => floatval( get_option( 'tvs_mapbox_terrain_exaggeration', 1.5 ) ),
                'flyToZoom'           => floatval( get_option( 'tvs_mapbox_flyto_zoom', 16 ) ),
                'buildings3dEnabled'  => (bool) get_option( 'tvs_mapbox_buildings_3d_enabled', 0 ),
            ),
        );
        wp_localize_script( 'tvs-block-invites', 'TVS_SETTINGS', $settings );
    }

    /**
     * Activation tasks: ensure taxonomies exist and seed terms
     */
    public function activate() {
        // Ensure CPTs and taxonomies are registered
        $this->register_components_for_activation();

        // Seed activity types
        if ( ! term_exists( 'run', 'tvs_activity_type' ) ) {
            wp_insert_term( 'run', 'tvs_activity_type' );
        }
        if ( ! term_exists( 'ride', 'tvs_activity_type' ) ) {
            wp_insert_term( 'ride', 'tvs_activity_type' );
        }
        if ( ! term_exists( 'walk', 'tvs_activity_type' ) ) {
            wp_insert_term( 'walk', 'tvs_activity_type' );
        }

        // Give 'edit_tvs_routes' capability to administrators (simple example)
        $role = get_role( 'administrator' );
        if ( $role && ! $role->has_cap( 'edit_tvs_routes' ) ) {
            $role->add_cap( 'edit_tvs_routes' );
        }

        // Ensure tvs_athlete role exists on activation
        if ( ! get_role( 'tvs_athlete' ) ) {
            add_role( 'tvs_athlete', 'Athlete', array( 'read' => true ) );
        }

        // Create invites table (for invite-only registrations)
        global $wpdb;
        $table = $wpdb->prefix . 'tvs_invites';
        $charset_collate = $wpdb->get_charset_collate();
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $sql = "CREATE TABLE {$table} (
            id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            code_hash CHAR(64) NOT NULL,
            code_hint VARCHAR(16) DEFAULT NULL,
            created_by BIGINT(20) UNSIGNED DEFAULT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            used_by BIGINT(20) UNSIGNED DEFAULT NULL,
            used_at DATETIME DEFAULT NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            PRIMARY KEY  (id),
            UNIQUE KEY uq_code_hash (code_hash)
        ) {$charset_collate};";
        dbDelta( $sql );

        // Ensure pretty permalinks for activities/routes are applied
        flush_rewrite_rules();
    }

    /**
     * Ensure invites table exists (runs on admin_init to avoid requiring reactivation after updates)
     */
    public function ensure_invites_table() {
        global $wpdb;
        $table = $wpdb->prefix . 'tvs_invites';
        $exists = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) );
        if ( $exists === $table ) {
            // Ensure required columns exist / are correct size
            $columns = $wpdb->get_results( "SHOW COLUMNS FROM {$table}", ARRAY_A );
            $map = array();
            foreach ( (array) $columns as $col ) { $map[ $col['Field'] ] = $col; }
            // Add invitee_email if missing
            if ( ! isset( $map['invitee_email'] ) ) {
                $wpdb->query( "ALTER TABLE {$table} ADD COLUMN invitee_email VARCHAR(191) NULL AFTER code_hint" );
            }
            // Widen code_hint if too small
            if ( isset( $map['code_hint'] ) && isset( $map['Type'] ) ) {
                $type = strtolower( (string) $map['Type'] );
                // Some MySQLs return just 'varchar(16)'
                if ( strpos( $type, 'varchar(' ) === 0 ) {
                    preg_match( '/varchar\((\d+)\)/i', $type, $m );
                    $len = isset( $m[1] ) ? intval( $m[1] ) : 0;
                    if ( $len > 0 && $len < 64 ) {
                        $wpdb->query( "ALTER TABLE {$table} MODIFY COLUMN code_hint VARCHAR(191) NULL" );
                    }
                }
            }
            return;
        }
        $charset_collate = $wpdb->get_charset_collate();
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $sql = "CREATE TABLE {$table} (
            id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            code_hash CHAR(64) NOT NULL,
            code_hint VARCHAR(191) DEFAULT NULL,
            invitee_email VARCHAR(191) DEFAULT NULL,
            created_by BIGINT(20) UNSIGNED DEFAULT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            used_by BIGINT(20) UNSIGNED DEFAULT NULL,
            used_at DATETIME DEFAULT NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            PRIMARY KEY  (id),
            UNIQUE KEY uq_code_hash (code_hash)
        ) {$charset_collate};";
        dbDelta( $sql );
    }

    protected function register_components_for_activation() {
        // Register necessary CPTs/taxonomies so terms can be created on activation
        $cpt_route = new TVS_CPT_Route();
        $cpt_activity = new TVS_CPT_Activity();
        $tax = new TVS_Taxonomies();
        // Manually call the registration methods if available
        if ( method_exists( $cpt_route, 'register_post_type' ) ) {
            $cpt_route->register_post_type();
        }
        if ( method_exists( $cpt_activity, 'register_post_type' ) ) {
            $cpt_activity->register_post_type();
        }
        if ( method_exists( $tax, 'register_taxonomies' ) ) {
            $tax->register_taxonomies();
        }
    }

    /**
     * If viewing a single tvs_activity, check its visibility.
     * Private: only the author can view (404 for others).
     * Public: anyone with the link can view.
     */
    public function guard_activity_privacy() {
        if ( ! is_singular( 'tvs_activity' ) ) {
            return;
        }
        $post = get_queried_object();
        if ( ! $post || empty( $post->ID ) ) { return; }
        $visibility = get_post_meta( $post->ID, 'visibility', true );
        if ( $visibility !== 'public' ) {
            $visibility = 'private';
        }
        if ( 'private' === $visibility ) {
            $author_id = isset( $post->post_author ) ? intval( $post->post_author ) : 0;
            $current   = get_current_user_id();
            if ( $current !== $author_id ) {
                // Hide existence
                global $wp_query; $wp_query->set_404();
                status_header( 404 );
                nocache_headers();
                // Use theme 404 template
                include get_query_template( '404' );
                exit;
            }
        }
    }

    /**
     * Allow GPX file uploads
     */
    public function allow_gpx_uploads( $mimes ) {
        $mimes['gpx'] = 'application/gpx+xml';
        return $mimes;
    }

    /**
     * Fix GPX filetype check (WordPress sometimes blocks XML files)
     */
    public function gpx_filetype_check( $data, $file, $filename, $mimes ) {
        $ext = pathinfo( $filename, PATHINFO_EXTENSION );
        if ( 'gpx' === strtolower( $ext ) ) {
            $data['ext']  = 'gpx';
            $data['type'] = 'application/gpx+xml';
        }
        return $data;
    }
}

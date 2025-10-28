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
require_once TVS_PLUGIN_DIR . 'includes/class-tvs-taxonomies.php';
require_once TVS_PLUGIN_DIR . 'includes/class-tvs-rest.php';
require_once TVS_PLUGIN_DIR . 'includes/class-tvs-strava.php';
require_once TVS_PLUGIN_DIR . 'includes/class-tvs-user-profile.php';
require_once TVS_PLUGIN_DIR . 'includes/class-tvs-frontend.php';
require_once TVS_PLUGIN_DIR . 'includes/class-tvs-admin.php';

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

        // Enqueue public assets
        add_action( 'wp_enqueue_scripts', array( $this, 'public_assets' ) );
    }

    public function load_textdomain() {
        load_plugin_textdomain( 'tvs-virtual-sports', false, dirname( plugin_basename( $this->file ) ) . '/languages' );
    }

    public function register_components() {
        new TVS_CPT_Route();
        new TVS_CPT_Activity();
        new TVS_Taxonomies();
        new TVS_REST();
        new TVS_Strava();
        new TVS_Frontend();

        // Initialize admin
        $admin = new TVS_Admin();
        $admin->init();
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
                'attributes'      => array(),
            ) );
        }
    }

    public function render_my_activities_block( $attributes ) {
        // Enqueue the React app if not already loaded
        wp_enqueue_script( 'tvs-app' );
        wp_enqueue_style( 'tvs-public' );

        // Create a unique mount point for this block instance
        $mount_id = 'tvs-my-activities-' . uniqid();
        
        ob_start();
        ?>
        <div id="<?php echo esc_attr( $mount_id ); ?>" class="tvs-my-activities-block"></div>
        <script>
        (function() {
            if (typeof window.tvsMyActivitiesMount === 'undefined') {
                window.tvsMyActivitiesMount = [];
            }
            window.tvsMyActivitiesMount.push('<?php echo esc_js( $mount_id ); ?>');
        })();
        </script>
        <?php
        return ob_get_clean();
    }

    public function register_shortcodes() {
        add_shortcode( 'tvs_my_activities', array( $this, 'render_my_activities_block' ) );
    }

    public function admin_assets() {
        wp_enqueue_style( 'tvs-admin', TVS_PLUGIN_URL . 'admin/css/tvs-admin.css', array(), TVS_PLUGIN_VERSION );
        wp_enqueue_script( 'tvs-admin', TVS_PLUGIN_URL . 'admin/js/tvs-admin.js', array( 'jquery' ), TVS_PLUGIN_VERSION, true );
    }

    public function public_assets() {
        wp_enqueue_style( 'tvs-public', TVS_PLUGIN_URL . 'public/css/tvs-public.css', array(), TVS_PLUGIN_VERSION );

        // Register React and ReactDOM from CDN (lightweight approach for MVP)
        wp_register_script( 'tvs-react', 'https://unpkg.com/react@18/umd/react.production.min.js', array(), null, true );
        wp_register_script( 'tvs-react-dom', 'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js', array( 'tvs-react' ), null, true );

        // Register app script that depends on React
        wp_register_script( 'tvs-app', TVS_PLUGIN_URL . 'public/js/tvs-app.js', array( 'tvs-react', 'tvs-react-dom' ), TVS_PLUGIN_VERSION, true );
        
        // Localize script with settings and nonce
        wp_localize_script( 'tvs-app', 'TVS_SETTINGS', array(
            'env'      => ( defined( 'WP_DEBUG' ) && WP_DEBUG ) ? 'development' : 'production',
            'restRoot' => get_rest_url(),
            'nonce'    => wp_create_nonce( 'wp_rest' ),
            'version'  => TVS_PLUGIN_VERSION,
            'user'     => is_user_logged_in() ? wp_get_current_user()->user_login : null,
        ) );
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
}

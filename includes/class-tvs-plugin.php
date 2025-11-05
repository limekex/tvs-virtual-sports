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
require_once TVS_PLUGIN_DIR . 'includes/class-tvs-roles.php';

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

        // Safety: Ensure DB tables exist even if plugin wasn't re-activated after updates
        add_action( 'admin_init', array( $this, 'ensure_invites_table' ) );

        // Enqueue Gutenberg block editor assets (to make blocks appear in Inserter)
        add_action( 'enqueue_block_editor_assets', array( $this, 'editor_assets' ) );
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
        new TVS_Roles();

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

            register_block_type( 'tvs-virtual-sports/invite-friends', array(
                'title'           => __( 'TVS Invite Friends', 'tvs-virtual-sports' ),
                'description'     => __( 'Generate and manage invitation codes for your friends.', 'tvs-virtual-sports' ),
                'category'        => 'widgets',
                'icon'            => 'share',
                'keywords'        => array( 'tvs', 'invites', 'friends' ),
                'render_callback' => array( $this, 'render_invite_friends_block' ),
                'attributes'      => array(),
            ) );
        }
    }

    public function render_my_activities_block( $attributes ) {
        // Enqueue block-specific frontend script
        wp_enqueue_script( 'tvs-block-my-activities' );
        wp_enqueue_style( 'tvs-public' );

        // Create a unique mount point for this block instance
        $mount_id = 'tvs-my-activities-' . uniqid();
        
        ob_start();
        ?>
        <div class="tvs-app tvs-app--activities">
            <div id="<?php echo esc_attr( $mount_id ); ?>" class="tvs-my-activities-block"></div>
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
            'env'      => ( defined( 'WP_DEBUG' ) && WP_DEBUG ) ? 'development' : 'production',
            'restRoot' => get_rest_url(),
            'nonce'    => wp_create_nonce( 'wp_rest' ),
            'version'  => TVS_PLUGIN_VERSION,
            'user'     => is_user_logged_in() ? wp_get_current_user()->user_login : null,
        );
        wp_localize_script( 'tvs-block-invites', 'TVS_SETTINGS', $settings );

        $mount_id = 'tvs-invite-friends-' . uniqid();
        ob_start();
        ?>
        <div id="<?php echo esc_attr( $mount_id ); ?>" class="tvs-invite-friends-block"></div>
        <?php
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

        // Register React and ReactDOM from CDN (lightweight approach for MVP)
        wp_register_script( 'tvs-react', 'https://unpkg.com/react@18/umd/react.production.min.js', array(), null, true );
        wp_register_script( 'tvs-react-dom', 'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js', array( 'tvs-react' ), null, true );

        // Register global flash script (must load before tvs-app)
        wp_register_script( 'tvs-flash', TVS_PLUGIN_URL . 'public/js/tvs-flash.js', array(), TVS_PLUGIN_VERSION, true );
        wp_enqueue_script( 'tvs-flash' );

    // Register app script (kept separate) and block script (frontend)
    wp_register_script( 'tvs-app', TVS_PLUGIN_URL . 'public/js/tvs-app.js', array( 'tvs-react', 'tvs-react-dom', 'tvs-flash' ), TVS_PLUGIN_VERSION, true );
    wp_register_script( 'tvs-block-my-activities', TVS_PLUGIN_URL . 'public/js/tvs-block-my-activities.js', array( 'tvs-react', 'tvs-react-dom', 'tvs-flash' ), TVS_PLUGIN_VERSION, true );
    wp_register_script( 'tvs-block-invites', TVS_PLUGIN_URL . 'public/js/tvs-block-invites.js', array( 'tvs-flash' ), TVS_PLUGIN_VERSION, true );

        // Localize script with settings and nonce
        $settings = array(
            'env'      => ( defined( 'WP_DEBUG' ) && WP_DEBUG ) ? 'development' : 'production',
            'restRoot' => get_rest_url(),
            'nonce'    => wp_create_nonce( 'wp_rest' ),
            'version'  => TVS_PLUGIN_VERSION,
            'user'     => is_user_logged_in() ? wp_get_current_user()->user_login : null,
        );
        wp_localize_script( 'tvs-app', 'TVS_SETTINGS', $settings );
        wp_localize_script( 'tvs-block-my-activities', 'TVS_SETTINGS', $settings );
        wp_localize_script( 'tvs-block-invites', 'TVS_SETTINGS', $settings );
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
            array( 'wp-blocks', 'wp-element', 'wp-i18n' ),
            TVS_PLUGIN_VERSION,
            true
        );
        wp_enqueue_script( 'tvs-blocks-editor' );

        // Also load the frontend invites block script so it can render inside the editor canvas
        // (it mounts onto .tvs-invite-friends-block and needs TVS_SETTINGS)
        wp_enqueue_script( 'tvs-flash', TVS_PLUGIN_URL . 'public/js/tvs-flash.js', array(), TVS_PLUGIN_VERSION, true );
        wp_enqueue_script( 'tvs-block-invites', TVS_PLUGIN_URL . 'public/js/tvs-block-invites.js', array( 'tvs-flash' ), TVS_PLUGIN_VERSION, true );
        $settings = array(
            'env'      => ( defined( 'WP_DEBUG' ) && WP_DEBUG ) ? 'development' : 'production',
            'restRoot' => get_rest_url(),
            'nonce'    => wp_create_nonce( 'wp_rest' ),
            'version'  => TVS_PLUGIN_VERSION,
            'user'     => is_user_logged_in() ? wp_get_current_user()->user_login : null,
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
}

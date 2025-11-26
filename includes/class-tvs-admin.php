<?php
/**
 * TVS Admin Class
 *
 * @package TVS_Virtual_Sports
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

/**
 * Class TVS_Admin
 *
 * Handles all admin functionality for the TVS Virtual Sports plugin.
 */
class TVS_Admin {
    /**
     * Sanitize and validate the client ID
     *
     * @param string $input The input to sanitize
     * @return string The sanitized input
     */
    public function sanitize_client_id($input) {
        $input = sanitize_text_field($input);
        
        if (empty($input)) {
            add_settings_error(
                'tvs_strava_client_id',
                'tvs_strava_client_id_error',
                __('Client ID cannot be empty.', 'tvs-virtual-sports'),
                'error'
            );
            return '';
        }

        if (!is_numeric($input)) {
            add_settings_error(
                'tvs_strava_client_id',
                'tvs_strava_client_id_error',
                __('Client ID must be a number.', 'tvs-virtual-sports'),
                'error'
            );
            return '';
        }

        return $input;
    }

    /**
     * Sanitize and validate the client secret
     *
     * @param string $input The input to sanitize
     * @return string The sanitized input
     */
    public function sanitize_client_secret($input) {
        $input = sanitize_text_field($input);
        
        if (empty($input)) {
            add_settings_error(
                'tvs_strava_client_secret',
                'tvs_strava_client_secret_error',
                __('Client Secret cannot be empty.', 'tvs-virtual-sports'),
                'error'
            );
            return '';
        }

        return $input;
    }

	/**
	 * Initialize the admin functionality.
	 *
	 * @return void
	 */
	public function init() {
		add_action( 'admin_menu', array( $this, 'add_admin_menu' ) );
		add_action( 'admin_init', array( $this, 'register_settings' ) );
		add_action( 'admin_init', array( $this, 'handle_clear_weather_cache' ) );
		
		// Add Strava connection info to user profile pages
		add_action( 'show_user_profile', array( $this, 'show_strava_profile_fields' ) );
		add_action( 'edit_user_profile', array( $this, 'show_strava_profile_fields' ) );

        // Activity list table enhancements
        add_filter( 'manage_tvs_activity_posts_columns', array( $this, 'activity_columns' ) );
        add_action( 'manage_tvs_activity_posts_custom_column', array( $this, 'render_activity_column' ), 10, 2 );
        add_action( 'restrict_manage_posts', array( $this, 'activity_filters' ) );
        add_filter( 'parse_query', array( $this, 'filter_activity_query' ) );
        add_action( 'admin_notices', array( $this, 'activity_stats_banner' ) );
	}

	/**
	 * Add admin menu items.
	 *
	 * @return void
	 */
	public function add_admin_menu() {
		// Add main menu item (contributors and above can see the TVS menu).
		add_menu_page(
			__( 'TVS', 'tvs-virtual-sports' ),
			__( 'TVS', 'tvs-virtual-sports' ),
			'edit_posts',
			'tvs-settings',
			array( $this, 'render_settings_page' ),
			'dashicons-share-alt',
			30
		);

		// Add Strava submenu.
		add_submenu_page(
			'tvs-settings',
			__( 'Strava Settings', 'tvs-virtual-sports' ),
			__( 'Strava', 'tvs-virtual-sports' ),
			'manage_options',
			'tvs-strava-settings',
			array( $this, 'render_strava_settings_page' )
		);

		// Add Strava Import page (contributors and above)
		add_submenu_page(
			'tvs-settings',
			__( 'Import routes (Strava)', 'tvs-virtual-sports' ),
			__( 'Import routes', 'tvs-virtual-sports' ),
			'edit_posts',
			'tvs-strava-import',
			array( $this, 'render_strava_import_page' )
		);

		// Add Invitational submenu (administrators)
		add_submenu_page(
			'tvs-settings',
			__( 'Invitational', 'tvs-virtual-sports' ),
			__( 'Invitational', 'tvs-virtual-sports' ),
			'manage_options',
			'tvs-invitational',
			array( $this, 'render_invitational_page' )
		);

		// Add Security submenu (administrators)
		add_submenu_page(
			'tvs-settings',
			__( 'Security', 'tvs-virtual-sports' ),
			__( 'Security', 'tvs-virtual-sports' ),
			'manage_options',
			'tvs-security',
			array( $this, 'render_security_settings_page' )
		);

		// Add Weather submenu (administrators)
		add_submenu_page(
			'tvs-settings',
			__( 'Weather', 'tvs-virtual-sports' ),
			__( 'Weather', 'tvs-virtual-sports' ),
			'manage_options',
			'tvs-weather',
			array( $this, 'render_weather_settings_page' )
		);

		// Add Mapbox submenu (administrators)
		add_submenu_page(
			'tvs-settings',
			__( 'Mapbox Settings', 'tvs-virtual-sports' ),
			__( 'Mapbox', 'tvs-virtual-sports' ),
			'manage_options',
			'tvs-mapbox-settings',
			array( $this, 'render_mapbox_settings_page' )
		);
	}

	/**
	 * Add custom columns to tvs_activity list table
	 */
	public function activity_columns( $cols ) {
		// Preserve checkbox & title but replace date
		$new = array();
		foreach ( $cols as $k => $v ) {
			if ( 'date' === $k ) continue; // we'll add our own at end
			$new[ $k ] = $v;
		}
		$new['route']    = __( 'Route', 'tvs-virtual-sports' );
		$new['distance'] = __( 'Distance', 'tvs-virtual-sports' );
		$new['duration'] = __( 'Duration', 'tvs-virtual-sports' );
		$new['pace']     = __( 'Pace', 'tvs-virtual-sports' );
		$new['type']     = __( 'Type', 'tvs-virtual-sports' );
		$new['synced']   = __( 'Synced', 'tvs-virtual-sports' );
		$new['date']     = __( 'Date', 'tvs-virtual-sports' );
		return $new;
	}

	/**
	 * Render custom column values
	 */
	public function render_activity_column( $col, $post_id ) {
		if ( get_post_type( $post_id ) !== 'tvs_activity' ) return;
		switch ( $col ) {
			case 'route':
				$rid = get_post_meta( $post_id, 'route_id', true );
				$rname = get_post_meta( $post_id, 'route_name', true );
				if ( $rid ) {
					echo '<a href="' . esc_url( get_permalink( (int) $rid ) ) . '">' . esc_html( $rname ?: ('#' . $rid) ) . '</a>';
				} else {
					echo '—';
				}
				break;
			case 'distance':
				$m = (float) get_post_meta( $post_id, 'distance_m', true );
				echo $m > 0 ? esc_html( round( $m / 1000, 2 ) . ' km' ) : '—';
				break;
			case 'duration':
				$s = (int) get_post_meta( $post_id, 'duration_s', true );
				if ( $s > 0 ) {
					$h = intdiv( $s, 3600 ); $rem = $s % 3600; $m = intdiv( $rem, 60 ); $sec = $rem % 60;
					echo esc_html( $h > 0 ? sprintf( '%dh %02d:%02d', $h, $m, $sec ) : sprintf( '%02d:%02d', $m, $sec ) );
				} else { echo '—'; }
				break;
			case 'pace':
				$pace = (int) get_post_meta( $post_id, 'pace_s_per_km', true );
				if ( $pace > 0 ) {
					echo esc_html( gmdate( 'i:s', $pace ) . ' /km' );
				} else {
					// Derive on the fly if not stored
					$m = (float) get_post_meta( $post_id, 'distance_m', true );
					$s = (int) get_post_meta( $post_id, 'duration_s', true );
					if ( $m > 0 && $s > 0 ) {
						$p = (int) round( $s / max( 0.001, $m / 1000 ) );
						echo esc_html( gmdate( 'i:s', $p ) . ' /km' );
					} else { echo '—'; }
				}
				break;
			case 'type':
				$terms = wp_get_post_terms( $post_id, 'tvs_activity_type', array( 'fields' => 'names' ) );
				echo $terms ? esc_html( implode( ', ', $terms ) ) : '—';
				break;
			case 'synced':
				$synced = get_post_meta( $post_id, '_tvs_synced_strava', true );
				if ( $synced ) {
					$rid = get_post_meta( $post_id, '_tvs_strava_remote_id', true );
					$url = $rid ? 'https://www.strava.com/activities/' . rawurlencode( $rid ) : '';
					echo '<span style="color:#46b450;font-weight:600;">✓</span>' . ( $url ? ' <a href="' . esc_url( $url ) . '" target="_blank" rel="noopener">' . esc_html__( 'View', 'tvs-virtual-sports' ) . '</a>' : '' );
				} else {
					echo '<span style="color:#666;">' . esc_html__( 'No', 'tvs-virtual-sports' ) . '</span>';
				}
				break;
		}
	}

	/** Filter dropdowns above list */
	public function activity_filters() {
		global $typenow;
		if ( $typenow !== 'tvs_activity' ) return;
		// Activity type filter
		$selected_type = isset( $_GET['tvs_activity_type'] ) ? sanitize_text_field( $_GET['tvs_activity_type'] ) : '';
		$types = get_terms( array( 'taxonomy' => 'tvs_activity_type', 'hide_empty' => false ) );
		echo '<select name="tvs_activity_type" style="max-width:160px;">';
		echo '<option value="">' . esc_html__( 'All types', 'tvs-virtual-sports' ) . '</option>';
		foreach ( $types as $t ) {
			printf( '<option value="%1$s" %2$s>%3$s</option>', esc_attr( $t->slug ), selected( $selected_type, $t->slug, false ), esc_html( $t->name ) );
		}
		echo '</select> ';
		// Synced filter
		$synced = isset( $_GET['tvs_synced'] ) ? sanitize_text_field( $_GET['tvs_synced'] ) : '';
		echo '<select name="tvs_synced" style="max-width:120px;">';
		echo '<option value="">' . esc_html__( 'Synced?', 'tvs-virtual-sports' ) . '</option>';
		echo '<option value="yes" ' . selected( $synced, 'yes', false ) . '>' . esc_html__( 'Yes', 'tvs-virtual-sports' ) . '</option>';
		echo '<option value="no" ' . selected( $synced, 'no', false ) . '>' . esc_html__( 'No', 'tvs-virtual-sports' ) . '</option>';
		echo '</select> ';
		// Route ID quick filter
		$route_id = isset( $_GET['tvs_route_id'] ) ? (int) $_GET['tvs_route_id'] : 0;
		echo '<input type="number" placeholder="' . esc_attr__( 'Route ID', 'tvs-virtual-sports' ) . '" name="tvs_route_id" value="' . esc_attr( $route_id ? $route_id : '' ) . '" style="width:120px;" />';
	}

	/** Apply filters to query */
	public function filter_activity_query( $q ) {
		if ( ! is_admin() || ! $q->is_main_query() ) return;
		if ( $q->get( 'post_type' ) !== 'tvs_activity' ) return;
		$meta_query = array();
		if ( isset( $_GET['tvs_synced'] ) ) {
			$synced = sanitize_text_field( $_GET['tvs_synced'] );
			if ( $synced === 'yes' ) {
				$meta_query[] = array( 'key' => '_tvs_synced_strava', 'compare' => 'EXISTS' );
			} elseif ( $synced === 'no' ) {
				$meta_query[] = array( 'key' => '_tvs_synced_strava', 'compare' => 'NOT EXISTS' );
			}
		}
		if ( isset( $_GET['tvs_route_id'] ) && (int) $_GET['tvs_route_id'] > 0 ) {
			$meta_query[] = array( 'key' => 'route_id', 'value' => (string) (int) $_GET['tvs_route_id'] );
		}
		if ( ! empty( $meta_query ) ) {
			$q->set( 'meta_query', $meta_query );
		}
		// Tax filter for type
		if ( isset( $_GET['tvs_activity_type'] ) && $_GET['tvs_activity_type'] !== '' ) {
			$q->set( 'tax_query', array( array( 'taxonomy' => 'tvs_activity_type', 'field' => 'slug', 'terms' => sanitize_text_field( $_GET['tvs_activity_type'] ) ) ) );
		}
	}

	/** Banner with summary stats above list */
	public function activity_stats_banner() {
		global $pagenow, $typenow;
		if ( $pagenow !== 'edit.php' || $typenow !== 'tvs_activity' ) return;
		// Compute stats quickly (limit scope)
		$args = array( 'post_type' => 'tvs_activity', 'posts_per_page' => -1, 'fields' => 'ids', 'post_status' => 'publish' );
		$ids = get_posts( $args );
		if ( ! $ids ) return;
		$route_count = array(); $user_count = array();
		foreach ( $ids as $id ) {
			$rid = get_post_meta( $id, 'route_id', true );
			if ( $rid ) { $route_count[ $rid ] = isset( $route_count[ $rid ] ) ? $route_count[ $rid ] + 1 : 1; }
			$author = get_post_field( 'post_author', $id );
			if ( $author ) { $user_count[ $author ] = isset( $user_count[ $author ] ) ? $user_count[ $author ] + 1 : 1; }
		}
		arsort( $route_count ); arsort( $user_count );
		$top_route_id = key( $route_count ); $top_route_hits = current( $route_count );
		$top_user_id  = key( $user_count ); $top_user_hits  = current( $user_count );
		$route_title = $top_route_id ? get_the_title( (int) $top_route_id ) : '';
		$user_obj = $top_user_id ? get_user_by( 'id', (int) $top_user_id ) : null;
		$user_name = $user_obj ? $user_obj->display_name : '';
		echo '<div class="notice notice-info is-dismissible" style="padding:8px 12px;">';
		echo '<strong>' . esc_html__( 'Activity stats', 'tvs-virtual-sports' ) . ':</strong> ';
		if ( $top_route_id ) {
			echo esc_html__( 'Most popular route', 'tvs-virtual-sports' ) . ': ' . esc_html( $route_title ?: ('#' . $top_route_id) ) . ' (' . intval( $top_route_hits ) . ') &nbsp; ';
		}
		if ( $top_user_id ) {
			echo esc_html__( 'Highest performing user', 'tvs-virtual-sports' ) . ': ' . esc_html( $user_name ?: ('User #' . $top_user_id) ) . ' (' . intval( $top_user_hits ) . ')';
		}
		echo '</div>';
	}

	/**
	 * Register plugin settings.
	 *
	 * @return void
	 */
	public function register_settings() {
		// Register settings section.
		add_settings_section(
			'tvs_strava_settings_section',
			__( 'Strava Settings', 'tvs-virtual-sports' ),
			array( $this, 'render_section_info' ),
			'tvs-strava-settings'
		);

		// Register Client ID field.
        register_setting(
            'tvs_strava_settings',
            'tvs_strava_client_id',
            array(
                'type'              => 'string',
                'sanitize_callback' => array($this, 'sanitize_client_id'),
                'default'           => '',
            )
        );

		// Register Client Secret field.
        register_setting(
            'tvs_strava_settings',
            'tvs_strava_client_secret',
            array(
                'type'              => 'string',
                'sanitize_callback' => array($this, 'sanitize_client_secret'),
                'default'           => '',
            )
        );

		// Register default upload templates and privacy
		register_setting(
			'tvs_strava_settings',
			'tvs_strava_title_template',
			array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'default'           => 'TVS: {route_title}',
			)
		);

		register_setting(
			'tvs_strava_settings',
			'tvs_strava_desc_template',
			array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_textarea_field',
				'default'           => 'Uploaded from TVS Virtual Sports (Activity ID: {activity_id}).',
			)
		);

		register_setting(
			'tvs_strava_settings',
			'tvs_strava_private',
			array(
				'type'              => 'boolean',
				'sanitize_callback' => function( $v ) { 
					// Checkbox sends '1' when checked, nothing when unchecked
					return ! empty( $v );
				},
				'default'           => true,
			)
		);

		// Activity-specific templates: Virtual Routes (Run, Walk, Hike)
		register_setting(
			'tvs_strava_settings',
			'tvs_strava_title_template_virtual',
			array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'default'           => 'TVS: {route_title}',
			)
		);

		register_setting(
			'tvs_strava_settings',
			'tvs_strava_desc_template_virtual',
			array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_textarea_field',
				'default'           => 'I just completed a {type} activity from virtualsport.online: {route_title}. The virtual track is {distance_km} and I finished in {duration_hms}. Take a look at the route at: {route_url}',
			)
		);

		register_setting(
			'tvs_strava_settings',
			'tvs_strava_show_route_url_virtual',
			array(
				'type'              => 'boolean',
				'sanitize_callback' => function( $v ) { return ! empty( $v ); },
				'default'           => true,
			)
		);

		// Activity-specific templates: Swim
		register_setting(
			'tvs_strava_settings',
			'tvs_strava_title_template_swim',
			array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'default'           => 'Swim Activity',
			)
		);

		register_setting(
			'tvs_strava_settings',
			'tvs_strava_desc_template_swim',
			array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_textarea_field',
				'default'           => 'Swim session: {laps} laps × {pool_length}m = {distance_km} in {duration_hms}.\n\nAverage pace: {avg_pace_sec_lap} sec/lap',
			)
		);

		// Activity-specific templates: WeightTraining (Workout)
		register_setting(
			'tvs_strava_settings',
			'tvs_strava_title_template_workout',
			array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'default'           => 'Workout Session',
			)
		);

		register_setting(
			'tvs_strava_settings',
			'tvs_strava_desc_template_workout',
			array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_textarea_field',
				'default'           => 'Completed {exercise_count} exercises in {duration_hms}.\n\n{exercise_list}',
			)
		);

		// Add settings fields.
		add_settings_field(
			'tvs_strava_client_id',
			__( 'Client ID', 'tvs-virtual-sports' ),
			array( $this, 'render_client_id_field' ),
			'tvs-strava-settings',
			'tvs_strava_settings_section'
		);

		add_settings_field(
			'tvs_strava_client_secret',
			__( 'Client Secret', 'tvs-virtual-sports' ),
			array( $this, 'render_client_secret_field' ),
			'tvs-strava-settings',
			'tvs_strava_settings_section'
		);

		add_settings_field(
			'tvs_strava_title_template',
			__( 'Default Title Template', 'tvs-virtual-sports' ),
			array( $this, 'render_title_template_field' ),
			'tvs-strava-settings',
			'tvs_strava_settings_section'
		);

		add_settings_field(
			'tvs_strava_desc_template',
			__( 'Default Description Template', 'tvs-virtual-sports' ),
			array( $this, 'render_desc_template_field' ),
			'tvs-strava-settings',
			'tvs_strava_settings_section'
		);

		add_settings_field(
			'tvs_strava_private',
			__( 'Publish as Private', 'tvs-virtual-sports' ),
			array( $this, 'render_private_field' ),
			'tvs-strava-settings',
			'tvs_strava_settings_section'
		);

		// Activity-specific template fields
		add_settings_field(
			'tvs_strava_templates_virtual',
			__( 'Virtual Routes (Run, Walk, Hike)', 'tvs-virtual-sports' ),
			array( $this, 'render_virtual_templates_field' ),
			'tvs-strava-settings',
			'tvs_strava_settings_section'
		);

		add_settings_field(
			'tvs_strava_templates_swim',
			__( 'Swim Activities', 'tvs-virtual-sports' ),
			array( $this, 'render_swim_templates_field' ),
			'tvs-strava-settings',
			'tvs_strava_settings_section'
		);

		add_settings_field(
			'tvs_strava_templates_workout',
			__( 'Workout Activities (WeightTraining)', 'tvs-virtual-sports' ),
			array( $this, 'render_workout_templates_field' ),
			'tvs-strava-settings',
			'tvs_strava_settings_section'
		);

		// Invitational settings (separate page)
		add_settings_section(
			'tvs_invites_settings_section',
			__( 'Invitational', 'tvs-virtual-sports' ),
			function() {
				echo '<p>' . esc_html__( 'Enable invite-only mode and manage default options. Use the tools below to generate and manage codes in the database.', 'tvs-virtual-sports' ) . '</p>';
				echo '<p>' . esc_html__( 'Note: reCAPTCHA v3 configuration has moved to TVS → Security.', 'tvs-virtual-sports' ) . '</p>';
			},
			'tvs-invitational'
		);

		register_setting(
			'tvs_invites_settings',
			'tvs_invite_only',
			array(
				'type'              => 'boolean',
				'sanitize_callback' => function( $v ) { return ! empty( $v ); },
				'default'           => false,
			)
		);


		// Weather (Frost API) settings page
		add_settings_section(
			'tvs_weather_settings_section',
			__( 'Weather / Frost API', 'tvs-virtual-sports' ),
			function(){
				echo '<p>' . esc_html__( 'Configure Frost API credentials for historical weather data.', 'tvs-virtual-sports' ) . '</p>';
				echo '<p>' . sprintf(
					esc_html__( 'Get your free client ID at %s', 'tvs-virtual-sports' ),
					'<a href="https://frost.met.no/auth/requestCredentials.html" target="_blank" rel="noopener">frost.met.no</a>'
				) . '</p>';
			},
			'tvs-weather'
		);

		register_setting(
			'tvs_weather_settings',
			'tvs_frost_client_id',
			array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'default'           => '',
			)
		);

		add_settings_field(
			'tvs_frost_client_id',
			__( 'Frost Client ID', 'tvs-virtual-sports' ),
			array( $this, 'render_frost_client_id_field' ),
			'tvs-weather',
			'tvs_weather_settings_section'
		);

		// Security settings page (reCAPTCHA v3 and future security options)
		add_settings_section(
			'tvs_security_settings_section',
			__( 'Security', 'tvs-virtual-sports' ),
			function(){
				echo '<p>' . esc_html__( 'Configure site-wide security options.', 'tvs-virtual-sports' ) . '</p>';
				echo '<p>' . esc_html__( 'reCAPTCHA v3 protects invite validation and registration. If the secret is not set, verification is skipped.', 'tvs-virtual-sports' ) . '</p>';
			},
			'tvs-security'
		);

		register_setting(
			'tvs_security_settings',
			'tvs_recaptcha_site_key',
			array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'default'           => '',
			)
		);
		register_setting(
			'tvs_security_settings',
			'tvs_recaptcha_secret',
			array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'default'           => '',
			)
		);

		// Deprecated legacy textarea for seeding removed: invites are always auto-generated

		add_settings_field(
			'tvs_invite_only',
			__( 'Invite-only registration', 'tvs-virtual-sports' ),
			array( $this, 'render_invite_only_field' ),
			'tvs-invitational',
			'tvs_invites_settings_section'
		);

		// reCAPTCHA fields on Security page
		add_settings_field(
			'tvs_recaptcha_site_key',
			__( 'reCAPTCHA Site Key', 'tvs-virtual-sports' ),
			array( $this, 'render_recaptcha_site_key_field' ),
			'tvs-security',
			'tvs_security_settings_section'
		);
		add_settings_field(
			'tvs_recaptcha_secret',
			__( 'reCAPTCHA Secret', 'tvs-virtual-sports' ),
			array( $this, 'render_recaptcha_secret_field' ),
			'tvs-security',
			'tvs_security_settings_section'
		);
	}

	/**
	 * Render the settings page.
	 *
	 * @return void
	 */
	public function render_settings_page() {
		?>
		<div class="wrap">
			<h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
			<p><?php esc_html_e( 'Welcome to TVS Virtual Sports settings.', 'tvs-virtual-sports' ); ?></p>
		</div>
		<?php
	}

	/**
	 * Render the Strava settings page.
	 *
	 * @return void
	 */
	public function render_strava_settings_page() {
		?>
		<div class="wrap">
			<h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
			<form method="post" action="options.php">
				<?php
				settings_fields( 'tvs_strava_settings' );
				do_settings_sections( 'tvs-strava-settings' );
				submit_button();
				?>
			</form>
		</div>
		<?php
	}

	/**
	 * Render the Invitational admin page: toggle + code management UI
	 */
	public function render_invitational_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( __( 'Insufficient permissions.', 'tvs-virtual-sports' ) );
		}
		$rest_root = esc_url( get_rest_url() );
		$nonce     = wp_create_nonce( 'wp_rest' );
		?>
		<div class="wrap">
			<h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
			<form method="post" action="options.php">
				<?php
				settings_fields( 'tvs_invites_settings' );
				do_settings_sections( 'tvs-invitational' );
				submit_button( __( 'Save', 'tvs-virtual-sports' ) );
				?>
			</form>

			<hr />
			<h2><?php esc_html_e( 'Manage invitation codes', 'tvs-virtual-sports' ); ?></h2>
			<p class="description"><?php esc_html_e( 'Create codes that can be shared with users. Codes are stored securely (hashed) and are one-time-use.', 'tvs-virtual-sports' ); ?></p>
			<div class="tvs-app">
				<div id="tvs-invites-admin" class="tvs-card tvs-glass" style="padding:12px;"></div>
			</div>
		</div>
		<script>
		(function(){
			const rest = <?php echo wp_json_encode( $rest_root ); ?>;
			const nonce = <?php echo wp_json_encode( $nonce ); ?>;
			const root = document.getElementById('tvs-invites-admin');
			function el(t,c,txt){ const e=document.createElement(t); if(c) e.className=c; if(txt!=null) e.textContent=txt; return e; }
			async function copyText(text, onSuccess, onFail){
				try {
					if (navigator.clipboard && navigator.clipboard.writeText) {
						await navigator.clipboard.writeText(text);
						if (onSuccess) onSuccess();
						return true;
					}
				} catch(e) {}
				try {
					const ta=document.createElement('textarea');
					ta.value=text; ta.setAttribute('readonly',''); ta.style.position='absolute'; ta.style.left='-9999px';
					document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
					const ok=document.execCommand('copy'); document.body.removeChild(ta);
					if (ok){ if (onSuccess) onSuccess(); return true; }
				} catch(e2){}
				if (onFail) onFail(); return false;
			}
			async function getJSON(url, opts){
				const r = await fetch(url, { ...(opts||{}), headers: { 'X-WP-Nonce': nonce, ...(opts&&opts.headers||{}) } });
				const t = await r.text(); let data; try{ data=JSON.parse(t);}catch{ data=t; }
				return { ok:r.ok, status:r.status, data };
			}
			function render(){
				root.innerHTML='';
				const actions = el('div','tvs-invites-actions tvs-btns');
				const email = el('input','tvs-input'); email.type='email'; email.placeholder = '<?php echo esc_js( __( 'Invitee email (optional)', 'tvs-virtual-sports' ) ); ?>'; email.autocomplete='off';
				const createBtn = el('button','tvs-btn tvs-btn--outline','<?php echo esc_js( __( 'Create code', 'tvs-virtual-sports' ) ); ?>');
				actions.appendChild(email); actions.appendChild(createBtn);
				const status = el('div'); status.style.marginTop='8px';
				const list = el('div'); list.style.marginTop='12px';
				root.appendChild(actions); root.appendChild(status); root.appendChild(list);

				async function refresh(){
					list.textContent = '<?php echo esc_js( __( 'Loading...', 'tvs-virtual-sports' ) ); ?>';
					const res = await getJSON(rest+'tvs/v1/invites/mine');
					if(!res.ok){ list.textContent = 'Error '+res.status; return; }
					const items = (res.data&&res.data.items)||[];
					if(!items.length){ list.innerHTML = '<em><?php echo esc_js( __( 'No invites yet.', 'tvs-virtual-sports' ) ); ?></em>'; return; }
					const table = el('table','widefat tvs-table'); table.style.width = '100%';
					const thead = el('thead'); const trh=el('tr');
					['ID','<?php echo esc_js( __( 'Email', 'tvs-virtual-sports' ) ); ?>','<?php echo esc_js( __( 'Hint', 'tvs-virtual-sports' ) ); ?>','<?php echo esc_js( __( 'Status', 'tvs-virtual-sports' ) ); ?>','<?php echo esc_js( __( 'Created', 'tvs-virtual-sports' ) ); ?>','<?php echo esc_js( __( 'Used by', 'tvs-virtual-sports' ) ); ?>','<?php echo esc_js( __( 'Used at', 'tvs-virtual-sports' ) ); ?>',''].forEach(h=>{ const th=el('th'); th.textContent=h; trh.appendChild(th); });
					thead.appendChild(trh); table.appendChild(thead);
					const tbody = el('tbody');
					function fmt(s){ try{return new Date(s).toLocaleString();}catch{return s||'';} }
					items.forEach(it=>{
						const tr = el('tr');
						const statusTxt = it.status==='available' ? '<?php echo esc_js( __( 'Available', 'tvs-virtual-sports' ) ); ?>' : (it.status==='used' ? '<?php echo esc_js( __( 'Used', 'tvs-virtual-sports' ) ); ?>' : '<?php echo esc_js( __( 'Inactive', 'tvs-virtual-sports' ) ); ?>');
						const tdId=el('td',null,String(it.id));
						const tdEmail=el('td',null,it.email||'');
						const tdHint=el('td',null,it.hint||'');
						const tdStatus=el('td',null,statusTxt);
						const tdCreated=el('td',null,fmt(it.created_at));
						const tdUsedBy=el('td',null,it.used_by?('#'+it.used_by):'');
						const tdUsedAt=el('td',null, it.used_at ? fmt(it.used_at) : '<?php echo esc_js(__('Not used yet','tvs-virtual-sports')); ?>');
						const tdAct = el('td');
						if(it.status==='available'){
							const deact = el('button','tvs-btn tvs-btn--outline','<?php echo esc_js( __( 'Deactivate', 'tvs-virtual-sports' ) ); ?>');
							deact.addEventListener('click', async ()=>{
								const resp = await getJSON(rest+'tvs/v1/invites/'+it.id+'/deactivate', { method:'POST' });
								if(resp.ok){ refresh(); }
								else { status.textContent = 'Error '+resp.status; }
							});
							tdAct.appendChild(deact);
						}
						tr.appendChild(tdId); tr.appendChild(tdEmail); tr.appendChild(tdHint); tr.appendChild(tdStatus); tr.appendChild(tdCreated); tr.appendChild(tdUsedBy); tr.appendChild(tdUsedAt); tr.appendChild(tdAct);
						tbody.appendChild(tr);
					});
					table.appendChild(tbody);
					list.innerHTML=''; list.appendChild(table);
				}

				createBtn.addEventListener('click', async ()=>{
					status.textContent = '<?php echo esc_js( __( 'Creating…', 'tvs-virtual-sports' ) ); ?>';
					const payload = { count: 1 };
					const eml = (email.value||'').trim(); if (eml) payload.email = eml;
					const resp = await getJSON(rest+'tvs/v1/invites/create', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
					if(!resp.ok){ status.textContent = 'Error '+resp.status; return; }
					const created = (resp.data&&resp.data.created)||[];
					if(!created.length){ status.textContent = '<?php echo esc_js( __( 'No code created', 'tvs-virtual-sports' ) ); ?>'; return; }
					status.textContent = '<?php echo esc_js( __( 'Invite code created — copy now (shown only once)', 'tvs-virtual-sports' ) ); ?>';
					const c = created[0].code;
					const box = el('div'); box.style.marginTop='8px';
					const pre = el('code','tvs-code',c);
					const copyBtn = el('button','tvs-btn tvs-btn--outline','<?php echo esc_js( __( 'Copy', 'tvs-virtual-sports' ) ); ?>'); copyBtn.style.marginLeft='8px';
					copyBtn.addEventListener('click', ()=>{
						const old = copyBtn.textContent;
						copyText(c, ()=>{
							copyBtn.textContent = '<?php echo esc_js( __( 'Copied', 'tvs-virtual-sports' ) ); ?>';
							copyBtn.disabled = true;
							setTimeout(()=>{ copyBtn.textContent = old; copyBtn.disabled = false; }, 1500);
						});
					});
					box.appendChild(pre); box.appendChild(copyBtn);
					root.insertBefore(box, list);
					refresh();
				});

				refresh();
			}
			render();
		})();
		</script>
		<?php
	}

	/**
	 * Render the Strava import admin page (contributors and above).
	 * Minimal UI that lists athlete routes from Strava and lets you import them as tvs_route.
	 */
	public function render_strava_import_page() {
		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_die( __( 'Insufficient permissions.', 'tvs-virtual-sports' ) );
		}

		$rest_root = esc_url( get_rest_url() );
		$nonce     = wp_create_nonce( 'wp_rest' );
	$connect_url = esc_url( home_url( '/connect-strava/?mode=popup' ) );
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Import routes from Strava', 'tvs-virtual-sports' ); ?></h1>
			<p class="description"><?php esc_html_e( 'Requires Strava connection with scopes: read_all, profile:read_all.', 'tvs-virtual-sports' ); ?></p>

			<style>
				/* Make the imported-checkmark column obvious and consistent */
				#tvs-routes-list th.tvs-imported-head,
				#tvs-activities-list th.tvs-imported-head { width: 32px; text-align: center; }
				#tvs-routes-list td.tvs-imported-mark,
				#tvs-activities-list td.tvs-imported-mark { text-align: center; width: 32px; }
			</style>

			<div id="tvs-strava-status" aria-live="polite"></div>
			<div style="margin:12px 0; display:flex; gap:8px; flex-wrap:wrap;">
				<button class="button" id="tvs-refresh-routes"><?php esc_html_e( 'Fetch saved routes', 'tvs-virtual-sports' ); ?></button>
				<button class="button" id="tvs-fetch-activities"><?php esc_html_e( 'Fetch activities (GPS only)', 'tvs-virtual-sports' ); ?></button>
				<button class="button" id="tvs-disconnect-strava"><?php esc_html_e( 'Disconnect Strava', 'tvs-virtual-sports' ); ?></button>
			</div>
			<h2 style="margin-top:18px;"><?php esc_html_e( 'Saved routes', 'tvs-virtual-sports' ); ?></h2>
			<div id="tvs-routes-list"></div>
			<h2 style="margin-top:24px;"><?php esc_html_e( 'Activities with GPS', 'tvs-virtual-sports' ); ?></h2>
			<div id="tvs-activities-list"></div>
		</div>
		<script>
		(function(){
			const rest = <?php echo wp_json_encode( $rest_root ); ?>;
			const nonce = <?php echo wp_json_encode( $nonce ); ?>;
			const statusEl = document.getElementById('tvs-strava-status');
			const listEl = document.getElementById('tvs-routes-list');
			const actsEl = document.getElementById('tvs-activities-list');
			const btnFetch = document.getElementById('tvs-refresh-routes');
			const btnActs = document.getElementById('tvs-fetch-activities');
			const btnDisconnect = document.getElementById('tvs-disconnect-strava');

			function setStatus(html){ statusEl.innerHTML = html; }
			function esc(s){ return (s==null?'':String(s)).replace(/[&<>]/g, c=>({"&":"&amp;","<":"&lt;",
				">":"&gt;"}[c])); }

			async function getJSON(url, opts={}){
				const r = await fetch(url, { ...opts, headers: { 'X-WP-Nonce': nonce, ...(opts.headers||{}) } });
				const t = await r.text();
				try { return { ok: r.ok, status: r.status, data: JSON.parse(t) }; }
				catch(e){ return { ok: r.ok, status: r.status, data: t }; }
			}

			async function refreshStatus(){
				const res = await getJSON(rest + 'tvs/v1/strava/status');
				if (!res.ok){ setStatus('<span style="color:#dc3232;">'+esc('Status error: '+res.status)+'</span>'); return; }
				if (res.data && res.data.connected){
					const scope = res.data.scope || '';
					setStatus('<span style="color:#46b450;">\u2713 Connected</span> — ' + esc(scope));
				} else {
					setStatus('<span style="color:#dc3232;">\u2717 Not connected</span> — <a href="<?php echo $connect_url; ?>" target="_blank">Connect Strava</a>');
				}
			}

			async function fetchRoutes(){
				listEl.innerHTML = esc('Loading routes...');
				const res = await getJSON(rest + 'tvs/v1/strava/routes?per_page=20&page=1');
				if (!res.ok){ listEl.innerHTML = '<div style="color:#dc3232;">'+esc('Error '+res.status+': '+(res.data && (res.data.message||res.data)) )+'</div>'; return; }
				const items = (res.data && res.data.items) || [];
				if (!items.length){ listEl.innerHTML = '<em><?php echo esc_js( __( 'No routes found on Strava.', 'tvs-virtual-sports' ) ); ?></em>'; return; }
				const rows = items.map(it=>{
					const id = it.id; const name = esc(it.name);
					const distVal = it.distance_m || null;
					const elevVal = it.elevation_m || null;
					const dist = distVal? (Math.round(distVal/100)/10)+' km' : '';
					const elev = elevVal? Math.round(elevVal)+' m' : '';
					const imported = !!it.imported;
					const btnAttrs = imported ? 'disabled title="Already imported"' : '';
					const btnLabel = imported ? 'Imported \u2713' : '<?php echo esc_js( __( 'Import', 'tvs-virtual-sports' ) ); ?>';
					const btnClass = imported ? 'button' : 'button button-primary';
					const mark = imported ? '<span title="Imported">\u2713<\/span>' : '';
					return '<tr>'+
						'<td class="tvs-imported-mark">'+mark+'<\/td>'+
						'<td><code>'+id+'</code></td>'+
						'<td>'+name+'</td>'+
						'<td>'+esc(dist)+'</td>'+
						'<td>'+esc(elev)+'</td>'+
						'<td><button class="'+btnClass+'" '+btnAttrs+' data-import="'+id+'" data-name="'+name+'" data-distance-m="'+(distVal||'')+'" data-elevation-m="'+(elevVal||'')+'">'+btnLabel+'</button></td>'+
						'</tr>';
				}).join('');
				listEl.innerHTML = '<table class="widefat"><thead><tr><th class="tvs-imported-head" title="Imported">\u2713</th><th>ID</th><th><?php echo esc_js( __( 'Name', 'tvs-virtual-sports' ) ); ?></th><th><?php echo esc_js( __( 'Distance', 'tvs-virtual-sports' ) ); ?></th><th><?php echo esc_js( __( 'Elevation', 'tvs-virtual-sports' ) ); ?></th><th></th></tr></thead><tbody>'+rows+'</tbody></table>';
				listEl.querySelectorAll('button[data-import]').forEach(btn=>{
					btn.addEventListener('click', ()=> importOne(parseInt(btn.getAttribute('data-import'),10)) );
				});
			}

			async function importOne(routeId){
				const btn = listEl.querySelector('button[data-import="'+routeId+'"]');
				const payload = { strava_route_id: routeId };
				if (btn){
					if (btn.dataset.name) payload.name = btn.dataset.name;
					if (btn.dataset.distanceM) payload.distance_m = parseFloat(btn.dataset.distanceM);
					if (btn.dataset.elevationM) payload.elevation_m = parseFloat(btn.dataset.elevationM);
				}
				const res = await getJSON(rest + 'tvs/v1/strava/routes/import', {
					method:'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
				if (res.ok){
					if (btn){ btn.disabled = true; btn.classList.remove('button-primary'); btn.textContent = 'Imported \u2713'; btn.title = 'Already imported'; }
					alert('Imported: '+ (res.data && res.data.title ? res.data.title : ('post '+(res.data && res.data.id))) );
				} else if (res.status === 409) {
					if (btn){ btn.disabled = true; btn.classList.remove('button-primary'); btn.textContent = 'Imported \u2713'; btn.title = 'Already imported'; }
					alert('Already imported.');
				} else {
					alert('Import failed: '+ (res.data && (res.data.message||res.data)) + ' ('+res.status+')');
				}
			}

			async function disconnect(){
				const res = await getJSON(rest + 'tvs/v1/strava/disconnect', { method:'POST' });
				if (res.ok){ alert('Disconnected.'); refreshStatus(); }
				else { alert('Disconnect failed: '+res.status); }
			}

			btnFetch.addEventListener('click', fetchRoutes);
			btnActs.addEventListener('click', fetchActivities);
			btnDisconnect.addEventListener('click', disconnect);
			refreshStatus();

			async function fetchActivities(){
				actsEl.innerHTML = esc('Loading activities...');
				const res = await getJSON(rest + 'tvs/v1/strava/activities?per_page=20&page=1&with_gps=1');
				if (!res.ok){ actsEl.innerHTML = '<div style="color:#dc3232;">'+esc('Error '+res.status+': '+(res.data && (res.data.message||res.data)) )+'</div>'; return; }
				const items = (res.data && res.data.items) || [];
				if (!items.length){ actsEl.innerHTML = '<em><?php echo esc_js( __( 'No activities with GPS found.', 'tvs-virtual-sports' ) ); ?></em>'; return; }
				const rows = items.map(it=>{
					const id = it.id; const name = esc(it.name);
					const distVal = it.distance_m || null;
					const elevVal = it.elevation_m || null;
					const durVal = it.moving_time_s || null;
					const dist = distVal? (Math.round(distVal/100)/10)+' km' : '';
					const elev = elevVal? Math.round(elevVal)+' m' : '';
					const dur  = durVal? Math.round(durVal/60)+' min' : '';
					const imported = !!it.imported;
					const btnAttrs = imported ? 'disabled title="Already imported"' : '';
					const btnLabel = imported ? 'Imported \u2713' : '<?php echo esc_js( __( 'Import', 'tvs-virtual-sports' ) ); ?>';
					const btnClass = imported ? 'button' : 'button button-primary';
					const mark = imported ? '<span title="Imported">\u2713<\/span>' : '';
					return '<tr>'+
						'<td class="tvs-imported-mark">'+mark+'<\/td>'+
						'<td><code>'+id+'</code></td>'+
						'<td>'+name+'</td>'+
						'<td>'+esc(dist)+'</td>'+
						'<td>'+esc(elev)+'</td>'+
						'<td>'+esc(dur)+'</td>'+
						'<td><button class="'+btnClass+'" '+btnAttrs+' data-import-activity="'+id+'">'+btnLabel+'</button></td>'+
						'</tr>';
				}).join('');
				actsEl.innerHTML = '<table class="widefat"><thead><tr><th class="tvs-imported-head" title="Imported">\u2713</th><th>ID</th><th><?php echo esc_js( __( 'Name', 'tvs-virtual-sports' ) ); ?></th><th><?php echo esc_js( __( 'Distance', 'tvs-virtual-sports' ) ); ?></th><th><?php echo esc_js( __( 'Elevation', 'tvs-virtual-sports' ) ); ?></th><th><?php echo esc_js( __( 'Duration', 'tvs-virtual-sports' ) ); ?></th><th></th></tr></thead><tbody>'+rows+'</tbody></table>';
				actsEl.querySelectorAll('button[data-import-activity]').forEach(btn=>{
					btn.addEventListener('click', ()=> importActivity(parseInt(btn.getAttribute('data-import-activity'),10), btn) );
				});
			}

			async function importActivity(activityId, btn){
				const res = await getJSON(rest + 'tvs/v1/strava/activities/import', {
					method:'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ strava_activity_id: activityId })
				});
				if (res.ok){
					if (!btn){ btn = actsEl.querySelector('button[data-import-activity="'+activityId+'"]'); }
					if (btn){ btn.disabled = true; btn.classList.remove('button-primary'); btn.textContent = 'Imported \u2713'; btn.title = 'Already imported'; }
					alert('Imported activity as route: '+ (res.data && res.data.title ? res.data.title : ('post '+(res.data && res.data.id))) );
				} else if (res.status === 409) {
					if (!btn){ btn = actsEl.querySelector('button[data-import-activity="'+activityId+'"]'); }
					if (btn){ btn.disabled = true; btn.classList.remove('button-primary'); btn.textContent = 'Imported \u2713'; btn.title = 'Already imported'; }
					alert('Activity already imported.');
				} else {
					alert('Import failed: '+ (res.data && (res.data.message||res.data)) + ' ('+res.status+')');
				}
			}
		})();
		</script>
		<?php
	}

	/**
	 * Render section info.
	 *
	 * @return void
	 */
	public function render_section_info() {
		?>
		<p>
			<?php
			esc_html_e(
				'Enter your Strava API credentials below. These credentials are required to connect with Strava\'s API.',
				'tvs-virtual-sports'
			);
			?>
		</p>
		<p>
			<?php
			printf(
				/* translators: %s: URL to Strava API settings */
				esc_html__( 'To get your API credentials: %s', 'tvs-virtual-sports' ),
				'<ol>' .
				'<li>' . esc_html__( 'Log in to your Strava account', 'tvs-virtual-sports' ) . '</li>' .
				'<li>' . sprintf(
					/* translators: %s: URL to Strava API settings */
					esc_html__( 'Go to %s', 'tvs-virtual-sports' ),
					'<a href="https://www.strava.com/settings/api" target="_blank">' .
					esc_html__( 'Strava API Settings', 'tvs-virtual-sports' ) .
					'</a>'
				) . '</li>' .
				'<li>' . esc_html__( 'Create a new application or select an existing one', 'tvs-virtual-sports' ) . '</li>' .
				'<li>' . esc_html__( 'Copy the Client ID and Client Secret below', 'tvs-virtual-sports' ) . '</li>' .
				'</ol>'
			);
			?>
		</p>
		<?php
	}

	/**
	 * Render Client ID field.
	 *
	 * @return void
	 */
	public function render_client_id_field() {
		$value = get_option( 'tvs_strava_client_id' );
		?>
		<input type="text"
			id="tvs_strava_client_id"
			name="tvs_strava_client_id"
			value="<?php echo esc_attr( $value ); ?>"
			class="regular-text"
		/>
		<p class="description">
			<?php
			esc_html_e(
				'The Client ID is a unique identifier for your Strava application. It\'s a numeric value found in your Strava API application settings.',
				'tvs-virtual-sports'
			);
			?>
		</p>
		<?php
	}

	/**
	 * Render Client Secret field.
	 *
	 * @return void
	 */
	public function render_client_secret_field() {
		$value = get_option( 'tvs_strava_client_secret' );
		?>
		<input type="password"
			id="tvs_strava_client_secret"
			name="tvs_strava_client_secret"
			value="<?php echo esc_attr( $value ); ?>"
			class="regular-text"
		/>
		<p class="description">
			<?php
			esc_html_e(
				'The Client Secret is your application\'s password for Strava API access. Keep this secure and never share it publicly.',
				'tvs-virtual-sports'
			);
			?>
		</p>
		<?php
	}

	/**
	 * Render title template field
	 */
	public function render_title_template_field() {
		$value = get_option( 'tvs_strava_title_template', 'TVS: {route_title}' );
		?>
		<input type="text" id="tvs_strava_title_template" name="tvs_strava_title_template" value="<?php echo esc_attr( $value ); ?>" class="regular-text" />
		<p class="description">
			<?php esc_html_e( 'Placeholders: {route_title}, {route_url}, {activity_id}, {distance_km}, {duration_hms}, {date_local}, {type}', 'tvs-virtual-sports' ); ?>
			<br><code>{distance_km}</code>: Distanse i kilometer, automatisk med "km" postfix (f.eks. "5 km")
			<br><code>{duration_hms}</code>: Tid brukt, automatisk formatert: "mm:ss" hvis under 1 time, "h mm:ss" hvis over 1 time
		</p>
		<?php
	}

	/**
	 * Render description template field
	 */
	public function render_desc_template_field() {
		$value = get_option( 'tvs_strava_desc_template', 'Uploaded from TVS Virtual Sports (Activity ID: {activity_id}).' );
		?>
		<textarea id="tvs_strava_desc_template" name="tvs_strava_desc_template" rows="4" class="large-text"><?php echo esc_textarea( $value ); ?></textarea>
		<p class="description">
			<?php esc_html_e( 'Placeholders: {route_title}, {route_url}, {activity_id}, {distance_km}, {duration_hms}, {date_local}, {type}, {map_image_url}', 'tvs-virtual-sports' ); ?>
		</p>
		<p class="description">
			<?php esc_html_e( 'Example with map: "Check out my route: {route_url}\n\nMap: {map_image_url}"', 'tvs-virtual-sports' ); ?>
		</p>
		<?php
	}

	/**
	 * Render private toggle field
	 */
	public function render_private_field() {
		$value = (bool) get_option( 'tvs_strava_private', true );
		?>
		<label>
			<input type="checkbox" id="tvs_strava_private" name="tvs_strava_private" value="1" <?php checked( $value, true ); ?> />
			<?php esc_html_e( 'Hide uploaded activities from public feed (activity will still be visible to anyone with the link).', 'tvs-virtual-sports' ); ?>
		</label>
		<p class="description">
			<?php esc_html_e( 'Note: Strava does not allow setting activities as "Only You" via API. To make an activity fully private, you must change it manually on Strava after upload.', 'tvs-virtual-sports' ); ?>
		</p>
		<?php
	}

	/**
	 * Render Virtual Routes template fields
	 */
	public function render_virtual_templates_field() {
		$title = get_option( 'tvs_strava_title_template_virtual', 'TVS: {route_title}' );
		$desc = get_option( 'tvs_strava_desc_template_virtual', 'I just completed a {type} activity from virtualsport.online: {route_title}. The virtual track is {distance_km} and I finished in {duration_hms}. Take a look at the route at: {route_url}' );
		$show_url = (bool) get_option( 'tvs_strava_show_route_url_virtual', true );
		?>
		<div style="border:1px solid #ddd; padding:15px; background:#f9f9f9; margin-bottom:10px;">
			<h4 style="margin-top:0;"><?php esc_html_e( 'Virtual Routes (Run, Walk, Hike)', 'tvs-virtual-sports' ); ?></h4>
			<p><label><strong><?php esc_html_e( 'Title Template:', 'tvs-virtual-sports' ); ?></strong></label></p>
			<input type="text" name="tvs_strava_title_template_virtual" value="<?php echo esc_attr( $title ); ?>" class="large-text" />
			<p><label><strong><?php esc_html_e( 'Description Template:', 'tvs-virtual-sports' ); ?></strong></label></p>
			<textarea name="tvs_strava_desc_template_virtual" rows="4" class="large-text"><?php echo esc_textarea( $desc ); ?></textarea>
			<p><label>
				<input type="checkbox" name="tvs_strava_show_route_url_virtual" value="1" <?php checked( $show_url, true ); ?> />
				<?php esc_html_e( 'Include route URL in description', 'tvs-virtual-sports' ); ?>
			</label></p>
			<p class="description">
				<?php esc_html_e( 'Placeholders: {route_title}, {route_url}, {activity_id}, {distance_km}, {duration_hms}, {date_local}, {type}, {map_image_url}', 'tvs-virtual-sports' ); ?>
			</p>
		</div>
		<?php
	}

	/**
	 * Render Swim template fields
	 */
	public function render_swim_templates_field() {
		$title = get_option( 'tvs_strava_title_template_swim', 'Swim Activity' );
		$desc = get_option( 'tvs_strava_desc_template_swim', 'Swim session: {laps} laps × {pool_length}m = {distance_km} in {duration_hms}.\n\nAverage pace: {avg_pace_sec_lap} sec/lap' );
		?>
		<div style="border:1px solid #ddd; padding:15px; background:#f9f9f9; margin-bottom:10px;">
			<h4 style="margin-top:0;"><?php esc_html_e( 'Swim Activities', 'tvs-virtual-sports' ); ?></h4>
			<p><label><strong><?php esc_html_e( 'Title Template:', 'tvs-virtual-sports' ); ?></strong></label></p>
			<input type="text" name="tvs_strava_title_template_swim" value="<?php echo esc_attr( $title ); ?>" class="large-text" />
			<p><label><strong><?php esc_html_e( 'Description Template:', 'tvs-virtual-sports' ); ?></strong></label></p>
			<textarea name="tvs_strava_desc_template_swim" rows="4" class="large-text"><?php echo esc_textarea( $desc ); ?></textarea>
			<p class="description">
				<?php esc_html_e( 'Placeholders: {laps}, {pool_length}, {distance_km}, {duration_hms}, {avg_pace_sec_lap}, {date_local}, {activity_id}', 'tvs-virtual-sports' ); ?>
			</p>
		</div>
		<?php
	}

	/**
	 * Render Workout template fields
	 */
	public function render_workout_templates_field() {
		$title = get_option( 'tvs_strava_title_template_workout', 'Workout Session' );
		$desc = get_option( 'tvs_strava_desc_template_workout', 'Completed {exercise_count} exercises in {duration_hms}.\n\n{exercise_list}' );
		?>
		<div style="border:1px solid #ddd; padding:15px; background:#f9f9f9; margin-bottom:10px;">
			<h4 style="margin-top:0;"><?php esc_html_e( 'Workout Activities (WeightTraining)', 'tvs-virtual-sports' ); ?></h4>
			<p><label><strong><?php esc_html_e( 'Title Template:', 'tvs-virtual-sports' ); ?></strong></label></p>
			<input type="text" name="tvs_strava_title_template_workout" value="<?php echo esc_attr( $title ); ?>" class="large-text" />
			<p><label><strong><?php esc_html_e( 'Description Template:', 'tvs-virtual-sports' ); ?></strong></label></p>
			<textarea name="tvs_strava_desc_template_workout" rows="4" class="large-text"><?php echo esc_textarea( $desc ); ?></textarea>
			<p class="description">
				<?php esc_html_e( 'Placeholders: {exercise_count}, {exercise_list}, {duration_hms}, {date_local}, {activity_id}', 'tvs-virtual-sports' ); ?>
				<br><?php esc_html_e( '{exercise_list} will be formatted as: "1. Bench Press (3 × 10 @ 80kg)\n2. Squats (4 × 8 @ 100kg)"', 'tvs-virtual-sports' ); ?>
			</p>
		</div>
		<?php
	}

	/** Render invite-only toggle */
	public function render_invite_only_field() {
		$value = (bool) get_option( 'tvs_invite_only', false );
		?>
		<label>
			<input type="checkbox" id="tvs_invite_only" name="tvs_invite_only" value="1" <?php checked( $value, true ); ?> />
			<?php esc_html_e( 'Require a valid invitation code to register new accounts.', 'tvs-virtual-sports' ); ?>
		</label>
		<?php
	}

	/** Render reCAPTCHA Site Key field */
	public function render_recaptcha_site_key_field() {
		$value = (string) get_option( 'tvs_recaptcha_site_key', '' );
		?>
		<input type="text"
			id="tvs_recaptcha_site_key"
			name="tvs_recaptcha_site_key"
			value="<?php echo esc_attr( $value ); ?>"
			class="regular-text"
		/>
		<p class="description">
			<?php esc_html_e( 'Public site key from Google reCAPTCHA (v3). Used by the client when validating invites and registering.', 'tvs-virtual-sports' ); ?>
		</p>
		<?php
	}

	/** Render reCAPTCHA Secret field */
	public function render_recaptcha_secret_field() {
		$value = (string) get_option( 'tvs_recaptcha_secret', '' );
		?>
		<input type="password"
			id="tvs_recaptcha_secret"
			name="tvs_recaptcha_secret"
			value="<?php echo esc_attr( $value ); ?>"
			class="regular-text"
		/>
		<p class="description">
			<?php esc_html_e( 'Server secret for Google reCAPTCHA (v3). If left empty, verification is skipped.', 'tvs-virtual-sports' ); ?>
		</p>
		<?php
	}

	/** Render Security settings page */
	public function render_security_settings_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( __( 'Insufficient permissions.', 'tvs-virtual-sports' ) );
		}
		?>
		<div class="wrap">
			<h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
			<form method="post" action="options.php">
				<?php
				settings_fields( 'tvs_security_settings' );
				do_settings_sections( 'tvs-security' );
				submit_button();
				?>
			</form>
		</div>
		<?php
	}

	/** Render Frost Client ID field */
	public function render_frost_client_id_field() {
		$value = (string) get_option( 'tvs_frost_client_id', '' );
		?>
		<input type="text"
			id="tvs_frost_client_id"
			name="tvs_frost_client_id"
			value="<?php echo esc_attr( $value ); ?>"
			class="regular-text"
			placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
		/>
		<p class="description">
			<?php esc_html_e( 'Client ID for accessing Frost API (free historical weather data from MET Norway).', 'tvs-virtual-sports' ); ?>
		</p>
		<?php
	}

	/** Render Weather settings page */
	public function render_weather_settings_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( __( 'Insufficient permissions.', 'tvs-virtual-sports' ) );
		}

		// Handle cache clear action
		if ( isset( $_POST['tvs_clear_weather_cache'] ) && check_admin_referer( 'tvs_clear_weather_cache' ) ) {
			$this->clear_all_weather_caches();
		}

		?>
		<div class="wrap">
			<h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
			<form method="post" action="options.php">
				<?php
				settings_fields( 'tvs_weather_settings' );
				do_settings_sections( 'tvs-weather' );
				submit_button();
				?>
			</form>

			<hr style="margin: 30px 0;">
			
			<h2><?php esc_html_e( 'Weather Cache Management', 'tvs-virtual-sports' ); ?></h2>
			<p><?php esc_html_e( 'Clear all cached weather data. This will force fresh API requests for all routes.', 'tvs-virtual-sports' ); ?></p>
			<form method="post" action="">
				<?php wp_nonce_field( 'tvs_clear_weather_cache' ); ?>
				<button type="submit" name="tvs_clear_weather_cache" class="button button-secondary"
					onclick="return confirm('<?php esc_attr_e( 'Are you sure you want to clear all weather caches?', 'tvs-virtual-sports' ); ?>');">
					<?php esc_html_e( 'Clear All Weather Caches', 'tvs-virtual-sports' ); ?>
				</button>
			</form>
		</div>
		<?php
	}

	/**
	 * Clear all weather caches from route post meta
	 */
	public function clear_all_weather_caches() {
		global $wpdb;
		
		// Delete all weather_data and weather_cached_at meta
		$deleted = $wpdb->query( "
			DELETE FROM {$wpdb->postmeta} 
			WHERE meta_key IN ('weather_data', 'weather_cached_at')
		" );

		add_settings_error(
			'tvs_weather_cache',
			'cache_cleared',
			sprintf(
				/* translators: %d: number of cache entries deleted */
				__( 'Successfully cleared %d weather cache entries.', 'tvs-virtual-sports' ),
				$deleted
			),
			'success'
		);

		settings_errors( 'tvs_weather_cache' );
	}

	/**
	 * Handle weather cache clearing from admin_init
	 */
	public function handle_clear_weather_cache() {
		// This is handled in render_weather_settings_page now
	}

	/** Render Mapbox settings page */
	public function render_mapbox_settings_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( __( 'Insufficient permissions.', 'tvs-virtual-sports' ) );
		}

		// Save settings
		if ( isset( $_POST['tvs_mapbox_settings_nonce'] ) && wp_verify_nonce( $_POST['tvs_mapbox_settings_nonce'], 'tvs_mapbox_settings' ) ) {
			$access_token = sanitize_text_field( $_POST['tvs_mapbox_access_token'] ?? '' );
			$map_style = sanitize_text_field( $_POST['tvs_mapbox_map_style'] ?? 'mapbox://styles/mapbox/satellite-streets-v12' );
			$initial_zoom = floatval( $_POST['tvs_mapbox_initial_zoom'] ?? 14 );
			$flyto_zoom = floatval( $_POST['tvs_mapbox_flyto_zoom'] ?? 16 );
			$max_zoom = floatval( $_POST['tvs_mapbox_max_zoom'] ?? 18 );
			$min_zoom = floatval( $_POST['tvs_mapbox_min_zoom'] ?? 10 );
			$pitch = floatval( $_POST['tvs_mapbox_pitch'] ?? 60 );
			$bearing = floatval( $_POST['tvs_mapbox_bearing'] ?? 0 );
			$default_speed = floatval( $_POST['tvs_mapbox_default_speed'] ?? 1.0 );
			$camera_offset = floatval( $_POST['tvs_mapbox_camera_offset'] ?? 0.0002 );
			$smooth_factor = floatval( $_POST['tvs_mapbox_smooth_factor'] ?? 0.7 );
			$marker_color = sanitize_hex_color( $_POST['tvs_mapbox_marker_color'] ?? '#ff0000' );
			$route_color = sanitize_hex_color( $_POST['tvs_mapbox_route_color'] ?? '#ec4899' );
			$route_width = intval( $_POST['tvs_mapbox_route_width'] ?? 6 );
			$terrain_enabled = isset( $_POST['tvs_mapbox_terrain_enabled'] ) ? 1 : 0;
			$terrain_exaggeration = floatval( $_POST['tvs_mapbox_terrain_exaggeration'] ?? 1.5 );
			$buildings_3d_enabled = isset( $_POST['tvs_mapbox_buildings_3d_enabled'] ) ? 1 : 0;

			update_option( 'tvs_mapbox_access_token', $access_token );
			update_option( 'tvs_mapbox_map_style', $map_style );
			update_option( 'tvs_mapbox_initial_zoom', $initial_zoom );
			update_option( 'tvs_mapbox_flyto_zoom', $flyto_zoom );
			update_option( 'tvs_mapbox_max_zoom', $max_zoom );
			update_option( 'tvs_mapbox_min_zoom', $min_zoom );
			update_option( 'tvs_mapbox_pitch', $pitch );
			update_option( 'tvs_mapbox_bearing', $bearing );
			update_option( 'tvs_mapbox_default_speed', $default_speed );
			update_option( 'tvs_mapbox_camera_offset', $camera_offset );
			update_option( 'tvs_mapbox_smooth_factor', $smooth_factor );
			update_option( 'tvs_mapbox_marker_color', $marker_color );
			update_option( 'tvs_mapbox_route_color', $route_color );
			update_option( 'tvs_mapbox_route_width', $route_width );
			update_option( 'tvs_mapbox_terrain_enabled', $terrain_enabled );
			update_option( 'tvs_mapbox_terrain_exaggeration', $terrain_exaggeration );
			update_option( 'tvs_mapbox_buildings_3d_enabled', $buildings_3d_enabled );

			echo '<div class="notice notice-success is-dismissible"><p>' . esc_html__( 'Mapbox settings saved.', 'tvs-virtual-sports' ) . '</p></div>';
		}

		// Get current values
		$access_token = get_option( 'tvs_mapbox_access_token', '' );
		$map_style = get_option( 'tvs_mapbox_map_style', 'mapbox://styles/mapbox/satellite-streets-v12' );
		$initial_zoom = get_option( 'tvs_mapbox_initial_zoom', 14 );
		$flyto_zoom = get_option( 'tvs_mapbox_flyto_zoom', 16 );
		$max_zoom = get_option( 'tvs_mapbox_max_zoom', 18 );
		$min_zoom = get_option( 'tvs_mapbox_min_zoom', 10 );
		$pitch = get_option( 'tvs_mapbox_pitch', 60 );
		$bearing = get_option( 'tvs_mapbox_bearing', 0 );
		$default_speed = get_option( 'tvs_mapbox_default_speed', 1.0 );
		$camera_offset = get_option( 'tvs_mapbox_camera_offset', 0.0002 );
		$smooth_factor = get_option( 'tvs_mapbox_smooth_factor', 0.7 );
		$marker_color = get_option( 'tvs_mapbox_marker_color', '#ff0000' );
		$route_color = get_option( 'tvs_mapbox_route_color', '#ec4899' );
		$route_width = get_option( 'tvs_mapbox_route_width', 6 );
		$terrain_enabled = get_option( 'tvs_mapbox_terrain_enabled', 0 );
		$terrain_exaggeration = get_option( 'tvs_mapbox_terrain_exaggeration', 1.5 );
		$buildings_3d_enabled = get_option( 'tvs_mapbox_buildings_3d_enabled', 0 );

		?>
		<div class="wrap">
			<h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
			<p><?php esc_html_e( 'Configure Mapbox settings for virtual training visualization.', 'tvs-virtual-sports' ); ?></p>
			
			<form method="post" action="">
				<?php wp_nonce_field( 'tvs_mapbox_settings', 'tvs_mapbox_settings_nonce' ); ?>
				
				<table class="form-table">
					<!-- Access Token -->
					<tr>
						<th scope="row">
							<label for="tvs_mapbox_access_token"><?php esc_html_e( 'Access Token', 'tvs-virtual-sports' ); ?></label>
						</th>
						<td>
							<input 
								type="text" 
								id="tvs_mapbox_access_token" 
								name="tvs_mapbox_access_token" 
								value="<?php echo esc_attr( $access_token ); ?>" 
								class="large-text"
								placeholder="pk.eyJ1IjoieW91ci11c2VybmFtZSIsImEiOiJ4eHh4eHh4In0.xxxxxxxxxx"
							/>
							<p class="description">
								<?php esc_html_e( 'Your Mapbox public access token. Get one at', 'tvs-virtual-sports' ); ?> 
								<a href="https://account.mapbox.com/access-tokens/" target="_blank">mapbox.com/access-tokens</a>
							</p>
						</td>
					</tr>

					<!-- Map Style -->
					<tr>
						<th scope="row">
							<label for="tvs_mapbox_map_style"><?php esc_html_e( 'Map Style', 'tvs-virtual-sports' ); ?></label>
						</th>
						<td>
							<select id="tvs_mapbox_map_style" name="tvs_mapbox_map_style">
								<option value="mapbox://styles/mapbox/streets-v12" <?php selected( $map_style, 'mapbox://styles/mapbox/streets-v12' ); ?>>Streets</option>
								<option value="mapbox://styles/mapbox/outdoors-v12" <?php selected( $map_style, 'mapbox://styles/mapbox/outdoors-v12' ); ?>>Outdoors</option>
								<option value="mapbox://styles/mapbox/light-v11" <?php selected( $map_style, 'mapbox://styles/mapbox/light-v11' ); ?>>Light</option>
								<option value="mapbox://styles/mapbox/dark-v11" <?php selected( $map_style, 'mapbox://styles/mapbox/dark-v11' ); ?>>Dark</option>
								<option value="mapbox://styles/mapbox/satellite-v9" <?php selected( $map_style, 'mapbox://styles/mapbox/satellite-v9' ); ?>>Satellite</option>
								<option value="mapbox://styles/mapbox/satellite-streets-v12" <?php selected( $map_style, 'mapbox://styles/mapbox/satellite-streets-v12' ); ?>>Satellite Streets (default)</option>
							</select>
							<p class="description"><?php esc_html_e( 'Choose the base map style.', 'tvs-virtual-sports' ); ?></p>
						</td>
					</tr>

					<!-- Zoom Levels -->
					<tr>
						<th scope="row"><?php esc_html_e( 'Zoom Levels', 'tvs-virtual-sports' ); ?></th>
						<td>
							<label for="tvs_mapbox_initial_zoom"><?php esc_html_e( 'Initial Zoom:', 'tvs-virtual-sports' ); ?></label>
							<input type="number" id="tvs_mapbox_initial_zoom" name="tvs_mapbox_initial_zoom" value="<?php echo esc_attr( $initial_zoom ); ?>" min="0" max="22" step="0.1" style="width: 80px;" />
							<br>
							<label for="tvs_mapbox_flyto_zoom"><?php esc_html_e( 'Fly To Zoom:', 'tvs-virtual-sports' ); ?></label>
							<input type="number" id="tvs_mapbox_flyto_zoom" name="tvs_mapbox_flyto_zoom" value="<?php echo esc_attr( $flyto_zoom ); ?>" min="0" max="22" step="0.1" style="width: 80px;" />
							<br>
							<label for="tvs_mapbox_min_zoom"><?php esc_html_e( 'Minimum Zoom:', 'tvs-virtual-sports' ); ?></label>
							<input type="number" id="tvs_mapbox_min_zoom" name="tvs_mapbox_min_zoom" value="<?php echo esc_attr( $min_zoom ); ?>" min="0" max="22" step="0.1" style="width: 80px;" />
							<br>
							<label for="tvs_mapbox_max_zoom"><?php esc_html_e( 'Maximum Zoom:', 'tvs-virtual-sports' ); ?></label>
							<input type="number" id="tvs_mapbox_max_zoom" name="tvs_mapbox_max_zoom" value="<?php echo esc_attr( $max_zoom ); ?>" min="0" max="22" step="0.1" style="width: 80px;" />
							<p class="description"><?php esc_html_e( 'Control zoom range (0-22). Initial: default view, Fly To: zoom when play starts, Min/Max: user limits.', 'tvs-virtual-sports' ); ?></p>
						</td>
					</tr>

					<!-- Camera Angle -->
					<tr>
						<th scope="row"><?php esc_html_e( 'Camera Angle', 'tvs-virtual-sports' ); ?></th>
						<td>
							<label for="tvs_mapbox_pitch"><?php esc_html_e( 'Pitch (tilt):', 'tvs-virtual-sports' ); ?></label>
							<input type="number" id="tvs_mapbox_pitch" name="tvs_mapbox_pitch" value="<?php echo esc_attr( $pitch ); ?>" min="0" max="85" step="1" style="width: 80px;" />°
							<br>
							<label for="tvs_mapbox_bearing"><?php esc_html_e( 'Bearing (rotation):', 'tvs-virtual-sports' ); ?></label>
							<input type="number" id="tvs_mapbox_bearing" name="tvs_mapbox_bearing" value="<?php echo esc_attr( $bearing ); ?>" min="-180" max="180" step="1" style="width: 80px;" />°
							<p class="description"><?php esc_html_e( 'Pitch: 0 = top-down, 60 = angled view. Bearing: map rotation (0 = north).', 'tvs-virtual-sports' ); ?></p>
						</td>
					</tr>

					<!-- Animation Settings -->
					<tr>
						<th scope="row"><?php esc_html_e( 'Animation', 'tvs-virtual-sports' ); ?></th>
						<td>
							<label for="tvs_mapbox_camera_offset"><?php esc_html_e( 'Camera Look-Ahead:', 'tvs-virtual-sports' ); ?></label>
							<input type="number" id="tvs_mapbox_camera_offset" name="tvs_mapbox_camera_offset" value="<?php echo esc_attr( $camera_offset ); ?>" min="0" max="0.01" step="0.0001" style="width: 100px;" />
							<br>
							<label for="tvs_mapbox_smooth_factor"><?php esc_html_e( 'Smooth Factor:', 'tvs-virtual-sports' ); ?></label>
							<input type="number" id="tvs_mapbox_smooth_factor" name="tvs_mapbox_smooth_factor" value="<?php echo esc_attr( $smooth_factor ); ?>" min="0.1" max="1" step="0.1" style="width: 80px;" />
							<p class="description"><?php esc_html_e( 'Look-Ahead: how far camera points ahead (0.0002 default). Smooth: animation easing (0.7 = smooth, 1 = instant).', 'tvs-virtual-sports' ); ?></p>
						</td>
					</tr>

					<!-- Default Speed -->
					<tr>
						<th scope="row">
							<label for="tvs_mapbox_default_speed"><?php esc_html_e( 'Default Animation Speed', 'tvs-virtual-sports' ); ?></label>
						</th>
						<td>
							<input 
								type="number" 
								id="tvs_mapbox_default_speed" 
								name="tvs_mapbox_default_speed" 
								value="<?php echo esc_attr( $default_speed ); ?>" 
								min="0.1" 
								max="10" 
								step="0.1" 
								style="width: 80px;"
							/>
							<p class="description"><?php esc_html_e( 'Default speed multiplier for route animation (0.1 - 10x).', 'tvs-virtual-sports' ); ?></p>
						</td>
					</tr>

					<!-- Marker Color -->
					<tr>
						<th scope="row">
							<label for="tvs_mapbox_marker_color"><?php esc_html_e( 'Marker Color', 'tvs-virtual-sports' ); ?></label>
						</th>
						<td>
							<input 
								type="color" 
								id="tvs_mapbox_marker_color" 
								name="tvs_mapbox_marker_color" 
								value="<?php echo esc_attr( $marker_color ); ?>" 
							/>
							<p class="description"><?php esc_html_e( 'Color of the animated position marker.', 'tvs-virtual-sports' ); ?></p>
						</td>
					</tr>

					<!-- Route Line Color -->
					<tr>
						<th scope="row">
							<label for="tvs_mapbox_route_color"><?php esc_html_e( 'Route Line Color', 'tvs-virtual-sports' ); ?></label>
						</th>
						<td>
							<input 
								type="color" 
								id="tvs_mapbox_route_color" 
								name="tvs_mapbox_route_color" 
								value="<?php echo esc_attr( $route_color ); ?>" 
							/>
							<p class="description"><?php esc_html_e( 'Color of the route line on the map.', 'tvs-virtual-sports' ); ?></p>
						</td>
					</tr>

					<!-- Route Line Width -->
					<tr>
						<th scope="row">
							<label for="tvs_mapbox_route_width"><?php esc_html_e( 'Route Line Width', 'tvs-virtual-sports' ); ?></label>
						</th>
						<td>
							<input 
								type="number" 
								id="tvs_mapbox_route_width" 
								name="tvs_mapbox_route_width" 
								value="<?php echo esc_attr( $route_width ); ?>" 
								min="1" 
								max="20" 
								step="1" 
								style="width: 80px;"
							/>
							<p class="description"><?php esc_html_e( 'Width of the route line in pixels (1-20).', 'tvs-virtual-sports' ); ?></p>
						</td>
					</tr>

					<!-- 3D Terrain -->
					<tr>
						<th scope="row">
							<label for="tvs_mapbox_terrain_enabled"><?php esc_html_e( '3D Terrain', 'tvs-virtual-sports' ); ?></label>
						</th>
						<td>
							<label>
								<input 
									type="checkbox" 
									id="tvs_mapbox_terrain_enabled" 
									name="tvs_mapbox_terrain_enabled" 
									value="1"
									<?php checked( $terrain_enabled, 1 ); ?>
								/>
								<?php esc_html_e( 'Enable 3D terrain', 'tvs-virtual-sports' ); ?>
							</label>
							<br>
							<label for="tvs_mapbox_terrain_exaggeration"><?php esc_html_e( 'Terrain Exaggeration:', 'tvs-virtual-sports' ); ?></label>
							<input 
								type="number" 
								id="tvs_mapbox_terrain_exaggeration" 
								name="tvs_mapbox_terrain_exaggeration" 
								value="<?php echo esc_attr( $terrain_exaggeration ); ?>" 
								min="0" 
								max="5" 
								step="0.1" 
								style="width: 80px;"
							/>
							<p class="description"><?php esc_html_e( 'Show elevation in 3D (requires Mapbox Terrain tileset). Exaggeration: 1 = realistic, 1.5 = emphasized.', 'tvs-virtual-sports' ); ?></p>
						</td>
					</tr>

					<!-- 3D Buildings -->
					<tr>
						<th scope="row">
							<label for="tvs_mapbox_buildings_3d_enabled"><?php esc_html_e( '3D Buildings', 'tvs-virtual-sports' ); ?></label>
						</th>
						<td>
							<label>
								<input 
									type="checkbox" 
									id="tvs_mapbox_buildings_3d_enabled" 
									name="tvs_mapbox_buildings_3d_enabled" 
									value="1"
									<?php checked( $buildings_3d_enabled, 1 ); ?>
								/>
								<?php esc_html_e( 'Enable 3D buildings', 'tvs-virtual-sports' ); ?>
							</label>
							<p class="description"><?php esc_html_e( 'Show buildings in 3D (experimental, works best with satellite/streets styles).', 'tvs-virtual-sports' ); ?></p>
						</td>
					</tr>
				</table>

				<?php submit_button( __( 'Save Mapbox Settings', 'tvs-virtual-sports' ) ); ?>
			</form>
		</div>
		<?php
	}

	/** Render invitation codes textarea */
	public function render_invite_codes_field() {
		$value = (string) get_option( 'tvs_invite_codes', '' );
		$lines = preg_split( '/\r?\n/', $value );
		$lines = array_filter( array_map( 'trim', (array) $lines ) );
		$help  = sprintf( /* translators: %d: number of codes */ esc_html__( '%d code(s) available. One code per line; codes are case-insensitive and consumed on first use.', 'tvs-virtual-sports' ), count( $lines ) );
		?>
		<textarea id="tvs_invite_codes" name="tvs_invite_codes" rows="6" class="large-text" placeholder="ABC123&#10;BETA-INVITE-456&#10;..."><?php echo esc_textarea( $value ); ?></textarea>
		<p class="description"><?php echo esc_html( $help ); ?></p>
		<?php
	}
	/**
	 * Show Strava connection status on user profile pages
	 *
	 * @param WP_User $user User object
	 * @return void
	 */
	public function show_strava_profile_fields( $user ) {
		$status = tvs_get_strava_status( $user->ID );
		?>
		<h2><?php esc_html_e( 'Strava Integration', 'tvs-virtual-sports' ); ?></h2>
		<table class="form-table">
			<tr>
				<th><label><?php esc_html_e( 'Strava Connection Status', 'tvs-virtual-sports' ); ?></label></th>
				<td>
					<?php if ( $status['connected'] ) : ?>
						<p>
							<span style="color: #46b450; font-weight: bold;">✓ <?php esc_html_e( 'Connected', 'tvs-virtual-sports' ); ?></span>
						</p>
						<?php if ( $status['athlete_name'] ) : ?>
							<p>
								<strong><?php esc_html_e( 'Athlete:', 'tvs-virtual-sports' ); ?></strong>
								<?php echo esc_html( $status['athlete_name'] ); ?>
								<?php if ( $status['athlete_id'] ) : ?>
									(ID: <?php echo esc_html( $status['athlete_id'] ); ?>)
								<?php endif; ?>
							</p>
						<?php endif; ?>
						<?php if ( $status['scope'] ) : ?>
							<p>
								<strong><?php esc_html_e( 'Permissions:', 'tvs-virtual-sports' ); ?></strong>
								<?php echo esc_html( $status['scope'] ); ?>
							</p>
						<?php endif; ?>
						<?php if ( $status['expires_at'] ) : ?>
							<p>
								<strong><?php esc_html_e( 'Token Expires:', 'tvs-virtual-sports' ); ?></strong>
								<?php echo esc_html( date( 'Y-m-d H:i:s', $status['expires_at'] ) ); ?>
							</p>
						<?php endif; ?>
						<p class="description">
							<?php esc_html_e( 'Strava tokens are stored in user_meta[\'tvs_strava\'].', 'tvs-virtual-sports' ); ?>
</p>
<?php else : ?>
<p>
<span style="color: #dc3232;">✗ <?php esc_html_e( 'Not Connected', 'tvs-virtual-sports' ); ?></span>
</p>
<p class="description">
<?php esc_html_e( 'User has not connected their Strava account yet.', 'tvs-virtual-sports' ); ?>
</p>
<?php endif; ?>
</td>
</tr>
</table>
<?php
}
}

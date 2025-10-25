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
		
		// Add Strava connection info to user profile pages
		add_action( 'show_user_profile', array( $this, 'show_strava_profile_fields' ) );
		add_action( 'edit_user_profile', array( $this, 'show_strava_profile_fields' ) );
	}

	/**
	 * Add admin menu items.
	 *
	 * @return void
	 */
	public function add_admin_menu() {
		// Add main menu item.
		add_menu_page(
			__( 'TVS Settings', 'tvs-virtual-sports' ),
			__( 'TVS', 'tvs-virtual-sports' ),
			'manage_options',
			'tvs-settings',
			array( $this, 'render_settings_page' ),
			'dashicons-share-alt', // Using share icon for Strava integration.
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
			<?php esc_html_e( 'Placeholders: {route_title}, {route_url}, {activity_id}, {distance_km}, {duration_hms}, {date_local}, {type}', 'tvs-virtual-sports' ); ?>
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

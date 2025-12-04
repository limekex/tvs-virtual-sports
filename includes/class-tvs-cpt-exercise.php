<?php
/**
 * Exercise Custom Post Type
 *
 * Registers tvs_exercise CPT for exercise library functionality.
 *
 * @package TVS_Virtual_Sports
 * @since 1.3.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class TVS_CPT_Exercise
 */
class TVS_CPT_Exercise {

	/**
	 * Post type slug
	 */
	const POST_TYPE = 'tvs_exercise';

	/**
	 * Category taxonomy slug
	 */
	const TAX_CATEGORY = 'exercise_category';

	/**
	 * Type taxonomy slug
	 */
	const TAX_TYPE = 'exercise_type';

	/**
	 * Constructor - Initialize hooks
	 */
	public function __construct() {
		add_action( 'init', array( $this, 'register_post_type' ) );
		add_action( 'init', array( $this, 'register_taxonomies' ) );
		add_action( 'init', array( $this, 'register_meta_fields' ) );
		add_action( 'add_meta_boxes', array( $this, 'add_meta_boxes' ) );
		add_action( 'save_post_' . self::POST_TYPE, array( $this, 'save_meta' ), 10, 2 );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_scripts' ) );
	}

	/**
	 * Enqueue admin scripts for media uploader
	 */
	public function enqueue_admin_scripts( $hook ) {
		global $post_type;
		if ( self::POST_TYPE === $post_type && ( 'post.php' === $hook || 'post-new.php' === $hook ) ) {
			wp_enqueue_media();
			wp_enqueue_script(
				'tvs-exercise-admin',
				plugin_dir_url( dirname( __FILE__ ) ) . 'public/js/exercise-admin.js',
				array( 'jquery' ),
				'1.0.0',
				true
			);
		}
	}

	/**
	 * Register meta fields for REST API
	 */
	public function register_meta_fields() {
		// Equipment (array)
		register_post_meta(
			self::POST_TYPE,
			'_tvs_equipment',
			array(
				'type'              => 'array',
				'description'       => 'Equipment required for exercise',
				'single'            => true,
				'default'           => array(),
				'sanitize_callback' => function( $value ) {
					return is_array( $value ) ? array_map( 'sanitize_text_field', $value ) : array();
				},
				'show_in_rest'      => array(
					'schema' => array(
						'type'  => 'array',
						'items' => array(
							'type' => 'string',
						),
					),
				),
			)
		);

		// Muscle groups (array)
		register_post_meta(
			self::POST_TYPE,
			'_tvs_muscle_groups',
			array(
				'type'              => 'array',
				'description'       => 'Muscle groups targeted',
				'single'            => true,
				'default'           => array(),
				'sanitize_callback' => function( $value ) {
					return is_array( $value ) ? array_map( 'sanitize_text_field', $value ) : array();
				},
				'show_in_rest'      => array(
					'schema' => array(
						'type'  => 'array',
						'items' => array(
							'type' => 'string',
						),
					),
				),
			)
		);

		// Difficulty (string)
		register_post_meta(
			self::POST_TYPE,
			'_tvs_difficulty',
			array(
				'type'              => 'string',
				'description'       => 'Difficulty level',
				'single'            => true,
				'default'           => '',
				'sanitize_callback' => 'sanitize_text_field',
				'show_in_rest'      => true,
			)
		);

		// Default metric type (string)
		register_post_meta(
			self::POST_TYPE,
			'_tvs_default_metric_type',
			array(
				'type'              => 'string',
				'description'       => 'Default metric type (reps or time)',
				'single'            => true,
				'default'           => 'reps',
				'sanitize_callback' => 'sanitize_text_field',
				'show_in_rest'      => true,
			)
		);

		// Video URL (string)
		register_post_meta(
			self::POST_TYPE,
			'_tvs_video_url',
			array(
				'type'              => 'string',
				'description'       => 'Exercise demonstration video URL',
				'single'            => true,
				'default'           => '',
				'sanitize_callback' => 'esc_url_raw',
				'show_in_rest'      => true,
			)
		);

		// Animation URL (string)
		register_post_meta(
			self::POST_TYPE,
			'_tvs_animation_url',
			array(
				'type'              => 'string',
				'description'       => 'Exercise animation/GIF URL',
				'single'            => true,
				'default'           => '',
				'sanitize_callback' => 'esc_url_raw',
				'show_in_rest'      => true,
			)
		);
	}

	/**
	 * Register exercise post type
	 */
	public function register_post_type() {
		$labels = array(
			'name'                  => __( 'Exercises', 'tvs-virtual-sports' ),
			'singular_name'         => __( 'Exercise', 'tvs-virtual-sports' ),
			'menu_name'             => __( 'Exercise Library', 'tvs-virtual-sports' ),
			'add_new'               => __( 'Add New Exercise', 'tvs-virtual-sports' ),
			'add_new_item'          => __( 'Add New Exercise', 'tvs-virtual-sports' ),
			'edit_item'             => __( 'Edit Exercise', 'tvs-virtual-sports' ),
			'new_item'              => __( 'New Exercise', 'tvs-virtual-sports' ),
			'view_item'             => __( 'View Exercise', 'tvs-virtual-sports' ),
			'search_items'          => __( 'Search Exercises', 'tvs-virtual-sports' ),
			'not_found'             => __( 'No exercises found', 'tvs-virtual-sports' ),
			'not_found_in_trash'    => __( 'No exercises found in trash', 'tvs-virtual-sports' ),
			'all_items'             => __( 'All Exercises', 'tvs-virtual-sports' ),
		);

		$args = array(
			'labels'              => $labels,
			'public'              => true,
			'publicly_queryable'  => false,
			'show_ui'             => true,
			'show_in_menu'        => 'tvs-settings',
			'show_in_rest'        => true,
			'rest_base'           => 'exercises',
			'menu_position'       => 30,
			'menu_icon'           => 'dashicons-heart',
			'capability_type'     => 'post',
			'capabilities'        => array(
				'edit_post'          => 'edit_posts',
				'read_post'          => 'read',
				'delete_post'        => 'delete_posts',
				'edit_posts'         => 'edit_posts',
				'edit_others_posts'  => 'edit_others_posts',
				'delete_posts'       => 'delete_posts',
				'publish_posts'      => 'publish_posts',
				'read_private_posts' => 'read',
			),
			'hierarchical'        => false,
			'supports'            => array( 'title', 'editor', 'thumbnail' ),
			'has_archive'         => false,
			'rewrite'             => array( 'slug' => 'exercises', 'with_front' => false ),
			'query_var'           => true,
		);

		register_post_type( self::POST_TYPE, $args );
	}

	/**
	 * Register taxonomies
	 */
	public function register_taxonomies() {
		// Exercise Category (Legs, Chest, Back, etc.)
		register_taxonomy(
			self::TAX_CATEGORY,
			self::POST_TYPE,
			array(
				'labels'            => array(
					'name'          => __( 'Categories', 'tvs-virtual-sports' ),
					'singular_name' => __( 'Category', 'tvs-virtual-sports' ),
					'search_items'  => __( 'Search Categories', 'tvs-virtual-sports' ),
					'all_items'     => __( 'All Categories', 'tvs-virtual-sports' ),
					'edit_item'     => __( 'Edit Category', 'tvs-virtual-sports' ),
					'update_item'   => __( 'Update Category', 'tvs-virtual-sports' ),
					'add_new_item'  => __( 'Add New Category', 'tvs-virtual-sports' ),
					'new_item_name' => __( 'New Category Name', 'tvs-virtual-sports' ),
				),
				'hierarchical'      => true,
				'show_ui'           => true,
				'show_in_rest'      => true,
				'show_admin_column' => true,
				'query_var'         => false,
				'rewrite'           => false,
			)
		);

		// Exercise Type (Strength, Cardio, Flexibility, etc.)
		register_taxonomy(
			self::TAX_TYPE,
			self::POST_TYPE,
			array(
				'labels'            => array(
					'name'          => __( 'Types', 'tvs-virtual-sports' ),
					'singular_name' => __( 'Type', 'tvs-virtual-sports' ),
					'search_items'  => __( 'Search Types', 'tvs-virtual-sports' ),
					'all_items'     => __( 'All Types', 'tvs-virtual-sports' ),
					'edit_item'     => __( 'Edit Type', 'tvs-virtual-sports' ),
					'update_item'   => __( 'Update Type', 'tvs-virtual-sports' ),
					'add_new_item'  => __( 'Add New Type', 'tvs-virtual-sports' ),
					'new_item_name' => __( 'New Type Name', 'tvs-virtual-sports' ),
				),
				'hierarchical'      => false,
				'show_ui'           => true,
				'show_in_rest'      => true,
				'show_admin_column' => true,
				'query_var'         => false,
				'rewrite'           => false,
			)
		);
	}

	/**
	 * Add meta boxes
	 */
	public function add_meta_boxes() {
		add_meta_box(
			'tvs_exercise_details',
			__( 'Exercise Details', 'tvs-virtual-sports' ),
			array( $this, 'render_details_meta_box' ),
			self::POST_TYPE,
			'normal',
			'high'
		);

		add_meta_box(
			'tvs_exercise_media',
			__( 'Exercise Media', 'tvs-virtual-sports' ),
			array( $this, 'render_media_meta_box' ),
			self::POST_TYPE,
			'side',
			'default'
		);
	}

	/**
	 * Render details meta box
	 */
	public function render_details_meta_box( $post ) {
		wp_nonce_field( 'tvs_exercise_meta', 'tvs_exercise_nonce' );

		$equipment = get_post_meta( $post->ID, '_tvs_equipment', true );
		$muscle_groups = get_post_meta( $post->ID, '_tvs_muscle_groups', true );
		$difficulty = get_post_meta( $post->ID, '_tvs_difficulty', true );
		$default_metric = get_post_meta( $post->ID, '_tvs_default_metric_type', true );

		// Equipment options
		$equipment_options = array(
			'barbell'     => __( 'Barbell', 'tvs-virtual-sports' ),
			'dumbbell'    => __( 'Dumbbell', 'tvs-virtual-sports' ),
			'kettlebell'  => __( 'Kettlebell', 'tvs-virtual-sports' ),
			'bodyweight'  => __( 'Bodyweight', 'tvs-virtual-sports' ),
			'cable'       => __( 'Cable Machine', 'tvs-virtual-sports' ),
			'machine'     => __( 'Machine', 'tvs-virtual-sports' ),
			'resistance'  => __( 'Resistance Band', 'tvs-virtual-sports' ),
			'bench'       => __( 'Bench', 'tvs-virtual-sports' ),
			'pullup_bar'  => __( 'Pull-up Bar', 'tvs-virtual-sports' ),
			'box'         => __( 'Box/Platform', 'tvs-virtual-sports' ),
		);

		// Muscle group options
		$muscle_options = array(
			'chest'     => __( 'Chest', 'tvs-virtual-sports' ),
			'back'      => __( 'Back', 'tvs-virtual-sports' ),
			'shoulders' => __( 'Shoulders', 'tvs-virtual-sports' ),
			'biceps'    => __( 'Biceps', 'tvs-virtual-sports' ),
			'triceps'   => __( 'Triceps', 'tvs-virtual-sports' ),
			'forearms'  => __( 'Forearms', 'tvs-virtual-sports' ),
			'core'      => __( 'Core', 'tvs-virtual-sports' ),
			'quads'     => __( 'Quadriceps', 'tvs-virtual-sports' ),
			'hamstrings'=> __( 'Hamstrings', 'tvs-virtual-sports' ),
			'glutes'    => __( 'Glutes', 'tvs-virtual-sports' ),
			'calves'    => __( 'Calves', 'tvs-virtual-sports' ),
		);

		?>
		<div class="tvs-meta-fields">
			<p>
				<label><strong><?php esc_html_e( 'Equipment Required:', 'tvs-virtual-sports' ); ?></strong></label><br>
				<?php foreach ( $equipment_options as $key => $label ) : ?>
					<label style="display:inline-block; margin-right:15px;">
						<input type="checkbox" name="tvs_equipment[]" value="<?php echo esc_attr( $key ); ?>" 
							<?php checked( is_array( $equipment ) && in_array( $key, $equipment ) ); ?>>
						<?php echo esc_html( $label ); ?>
					</label>
				<?php endforeach; ?>
			</p>

			<p>
				<label><strong><?php esc_html_e( 'Muscle Groups:', 'tvs-virtual-sports' ); ?></strong></label><br>
				<?php foreach ( $muscle_options as $key => $label ) : ?>
					<label style="display:inline-block; margin-right:15px;">
						<input type="checkbox" name="tvs_muscle_groups[]" value="<?php echo esc_attr( $key ); ?>" 
							<?php checked( is_array( $muscle_groups ) && in_array( $key, $muscle_groups ) ); ?>>
						<?php echo esc_html( $label ); ?>
					</label>
				<?php endforeach; ?>
			</p>

			<p>
				<label><strong><?php esc_html_e( 'Difficulty Level:', 'tvs-virtual-sports' ); ?></strong></label><br>
				<select name="tvs_difficulty" style="width:200px;">
					<option value=""><?php esc_html_e( 'Select...', 'tvs-virtual-sports' ); ?></option>
					<option value="beginner" <?php selected( $difficulty, 'beginner' ); ?>><?php esc_html_e( 'Beginner', 'tvs-virtual-sports' ); ?></option>
					<option value="intermediate" <?php selected( $difficulty, 'intermediate' ); ?>><?php esc_html_e( 'Intermediate', 'tvs-virtual-sports' ); ?></option>
					<option value="advanced" <?php selected( $difficulty, 'advanced' ); ?>><?php esc_html_e( 'Advanced', 'tvs-virtual-sports' ); ?></option>
				</select>
			</p>

			<p>
				<label><strong><?php esc_html_e( 'Default Metric Type:', 'tvs-virtual-sports' ); ?></strong></label><br>
				<select name="tvs_default_metric_type" style="width:200px;">
					<option value="reps" <?php selected( $default_metric, 'reps' ); ?>><?php esc_html_e( 'Reps', 'tvs-virtual-sports' ); ?></option>
					<option value="time" <?php selected( $default_metric, 'time' ); ?>><?php esc_html_e( 'Time (seconds)', 'tvs-virtual-sports' ); ?></option>
				</select>
			</p>
		</div>
		<?php
	}

	/**
	 * Render media meta box
	 */
	public function render_media_meta_box( $post ) {
		$video_url = get_post_meta( $post->ID, '_tvs_video_url', true );
		$animation_url = get_post_meta( $post->ID, '_tvs_animation_url', true );
		?>
		<p>
			<label><strong><?php esc_html_e( 'Video URL (YouTube/Vimeo):', 'tvs-virtual-sports' ); ?></strong></label><br>
			<input type="url" name="tvs_video_url" value="<?php echo esc_attr( $video_url ); ?>" 
				placeholder="https://youtube.com/watch?v=..." style="width:100%;">
		</p>
		<p>
			<label><strong><?php esc_html_e( 'Animation/GIF:', 'tvs-virtual-sports' ); ?></strong></label><br>
			<input type="text" id="tvs_animation_url" name="tvs_animation_url" value="<?php echo esc_attr( $animation_url ); ?>" 
				placeholder="Upload or paste URL" style="width:calc(100% - 120px); margin-right: 8px;">
			<button type="button" class="button tvs-upload-media-btn" data-target="tvs_animation_url">
				<?php esc_html_e( 'Upload File', 'tvs-virtual-sports' ); ?>
			</button>
		</p>
		<?php if ( $animation_url ) : ?>
			<p style="margin-top: 10px;">
				<strong><?php esc_html_e( 'Preview:', 'tvs-virtual-sports' ); ?></strong><br>
				<img src="<?php echo esc_url( $animation_url ); ?>" style="max-width: 200px; height: auto; border: 1px solid #ddd; padding: 4px; background: #f9f9f9;">
			</p>
		<?php endif; ?>
		<p class="description">
			<?php esc_html_e( 'Upload a GIF or image to demonstrate the exercise. Recommended size: 200x150px or similar aspect ratio.', 'tvs-virtual-sports' ); ?>
		</p>
		<?php
	}

	/**
	 * Save meta data
	 */
	public function save_meta( $post_id, $post ) {
		// Verify nonce
		if ( ! isset( $_POST['tvs_exercise_nonce'] ) || ! wp_verify_nonce( $_POST['tvs_exercise_nonce'], 'tvs_exercise_meta' ) ) {
			return;
		}

		// Check autosave
		if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
			return;
		}

		// Check permissions
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}

		// Save equipment
		$equipment = isset( $_POST['tvs_equipment'] ) ? array_map( 'sanitize_text_field', $_POST['tvs_equipment'] ) : array();
		update_post_meta( $post_id, '_tvs_equipment', $equipment );

		// Save muscle groups
		$muscle_groups = isset( $_POST['tvs_muscle_groups'] ) ? array_map( 'sanitize_text_field', $_POST['tvs_muscle_groups'] ) : array();
		update_post_meta( $post_id, '_tvs_muscle_groups', $muscle_groups );

		// Save difficulty
		$difficulty = isset( $_POST['tvs_difficulty'] ) ? sanitize_text_field( $_POST['tvs_difficulty'] ) : '';
		update_post_meta( $post_id, '_tvs_difficulty', $difficulty );

		// Save default metric type
		$default_metric = isset( $_POST['tvs_default_metric_type'] ) ? sanitize_text_field( $_POST['tvs_default_metric_type'] ) : 'reps';
		update_post_meta( $post_id, '_tvs_default_metric_type', $default_metric );

		// Save video URL
		$video_url = isset( $_POST['tvs_video_url'] ) ? esc_url_raw( $_POST['tvs_video_url'] ) : '';
		update_post_meta( $post_id, '_tvs_video_url', $video_url );

		// Save animation URL
		$animation_url = isset( $_POST['tvs_animation_url'] ) ? esc_url_raw( $_POST['tvs_animation_url'] ) : '';
		update_post_meta( $post_id, '_tvs_animation_url', $animation_url );
	}
}

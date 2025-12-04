<?php
/**
 * Exercise REST API Controller
 *
 * Handles REST API endpoints for exercise library search and retrieval.
 *
 * @package TVS_Virtual_Sports
 * @since 1.3.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class TVS_REST_Exercises
 */
class TVS_REST_Exercises {

	/**
	 * REST namespace
	 */
	const NAMESPACE = 'tvs/v1';

	/**
	 * Initialize REST routes
	 */
	public function init() {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	/**
	 * Register REST routes
	 */
	public function register_routes() {
		// Search exercises
		register_rest_route(
			self::NAMESPACE,
			'/exercises/search',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'search_exercises' ),
				'permission_callback' => '__return_true', // Public endpoint
				'args'                => array(
					'q' => array(
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
						'validate_callback' => function( $param ) {
							return strlen( $param ) >= 2; // Minimum 2 characters
						},
					),
					'limit' => array(
						'default'           => 10,
						'type'              => 'integer',
						'sanitize_callback' => 'absint',
					),
					'category' => array(
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
				),
			)
		);

		// Get single exercise
		register_rest_route(
			self::NAMESPACE,
			'/exercises/(?P<id>\d+)',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_exercise' ),
				'permission_callback' => '__return_true',
				'args'                => array(
					'id' => array(
						'required'          => true,
						'type'              => 'integer',
						'sanitize_callback' => 'absint',
					),
				),
			)
		);
	}

	/**
	 * Search exercises
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response|WP_Error
	 */
	public function search_exercises( $request ) {
		$query_string = $request->get_param( 'q' );
		$limit = $request->get_param( 'limit' );
		$category = $request->get_param( 'category' );

		$args = array(
			'post_type'      => 'tvs_exercise',
			'post_status'    => 'publish',
			'posts_per_page' => min( $limit, 50 ), // Max 50 results
			's'              => $query_string,
			'orderby'        => 'relevance',
			'order'          => 'DESC',
		);

		// Filter by category if provided
		if ( $category ) {
			$args['tax_query'] = array(
				array(
					'taxonomy' => 'exercise_category',
					'field'    => 'slug',
					'terms'    => $category,
				),
			);
		}

		$query = new WP_Query( $args );
		$results = array();

		if ( $query->have_posts() ) {
			while ( $query->have_posts() ) {
				$query->the_post();
				$post_id = get_the_ID();

			// Get taxonomy terms (direct query since taxonomies may not be registered yet in REST context)
			global $wpdb;
			
			$category_names = $wpdb->get_col( $wpdb->prepare(
				"SELECT t.name FROM {$wpdb->terms} t
				INNER JOIN {$wpdb->term_taxonomy} tt ON t.term_id = tt.term_id
				INNER JOIN {$wpdb->term_relationships} tr ON tt.term_taxonomy_id = tr.term_taxonomy_id
				WHERE tr.object_id = %d AND tt.taxonomy = %s",
				$post_id,
				'exercise_category'
			) );
			
			$type_names = $wpdb->get_col( $wpdb->prepare(
				"SELECT t.name FROM {$wpdb->terms} t
				INNER JOIN {$wpdb->term_taxonomy} tt ON t.term_id = tt.term_id
				INNER JOIN {$wpdb->term_relationships} tr ON tt.term_taxonomy_id = tr.term_taxonomy_id
				WHERE tr.object_id = %d AND tt.taxonomy = %s",
				$post_id,
				'exercise_type'
			) );

			$results[] = array(
				'id'             => $post_id,
				'name'           => get_the_title(),
				'description'    => get_the_excerpt(),
				'category'       => ! empty( $category_names ) ? $category_names[0] : '',
				'categories'     => $category_names,
				'type'           => ! empty( $type_names ) ? $type_names[0] : '',
					'equipment'      => get_post_meta( $post_id, '_tvs_equipment', true ),
					'muscle_groups'  => get_post_meta( $post_id, '_tvs_muscle_groups', true ),
					'difficulty'     => get_post_meta( $post_id, '_tvs_difficulty', true ),
					'default_metric' => get_post_meta( $post_id, '_tvs_default_metric_type', true ) ?: 'reps',
					'video_url'      => get_post_meta( $post_id, '_tvs_video_url', true ),
					'animation_url'  => get_post_meta( $post_id, '_tvs_animation_url', true ),
					'thumbnail'      => get_the_post_thumbnail_url( $post_id, 'thumbnail' ),
				);
			}
			wp_reset_postdata();
		}

		return rest_ensure_response(
			array(
				'success' => true,
				'query'   => $query_string,
				'count'   => count( $results ),
				'results' => $results,
			)
		);
	}

	/**
	 * Get single exercise by ID
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_exercise( $request ) {
		$exercise_id = $request->get_param( 'id' );
		$post = get_post( $exercise_id );

		if ( ! $post || $post->post_type !== 'tvs_exercise' || $post->post_status !== 'publish' ) {
			return new WP_Error(
				'exercise_not_found',
				__( 'Exercise not found.', 'tvs-virtual-sports' ),
				array( 'status' => 404 )
			);
		}

	// Get taxonomy terms (direct query since taxonomies may not be registered yet in REST context)
	global $wpdb;
	
	$category_names = $wpdb->get_col( $wpdb->prepare(
		"SELECT t.name FROM {$wpdb->terms} t
		INNER JOIN {$wpdb->term_taxonomy} tt ON t.term_id = tt.term_id
		INNER JOIN {$wpdb->term_relationships} tr ON tt.term_taxonomy_id = tr.term_taxonomy_id
		WHERE tr.object_id = %d AND tt.taxonomy = %s",
		$exercise_id,
		'exercise_category'
	) );
	
	$type_names = $wpdb->get_col( $wpdb->prepare(
		"SELECT t.name FROM {$wpdb->terms} t
		INNER JOIN {$wpdb->term_taxonomy} tt ON t.term_id = tt.term_id
		INNER JOIN {$wpdb->term_relationships} tr ON tt.term_taxonomy_id = tr.term_taxonomy_id
		WHERE tr.object_id = %d AND tt.taxonomy = %s",
		$exercise_id,
		'exercise_type'
	) );

	$data = array(
		'id'             => $exercise_id,
		'name'           => $post->post_title,
		'description'    => $post->post_content,
		'excerpt'        => $post->post_excerpt,
		'category'       => ! empty( $category_names ) ? $category_names[0] : '',
		'categories'     => $category_names,
		'type'           => ! empty( $type_names ) ? $type_names[0] : '',
		'types'          => $type_names,
			'equipment'      => get_post_meta( $exercise_id, '_tvs_equipment', true ),
			'muscle_groups'  => get_post_meta( $exercise_id, '_tvs_muscle_groups', true ),
			'difficulty'     => get_post_meta( $exercise_id, '_tvs_difficulty', true ),
			'default_metric' => get_post_meta( $exercise_id, '_tvs_default_metric_type', true ) ?: 'reps',
			'video_url'      => get_post_meta( $exercise_id, '_tvs_video_url', true ),
			'animation_url'  => get_post_meta( $exercise_id, '_tvs_animation_url', true ),
			'thumbnail'      => get_the_post_thumbnail_url( $exercise_id, 'medium' ),
		);

		return rest_ensure_response(
			array(
				'success' => true,
				'exercise' => $data,
			)
		);
	}
}

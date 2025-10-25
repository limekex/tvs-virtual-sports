<?php
/**
 * REST API endpoints under namespace tvs/v1
 */
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class TVS_REST {
    public function __construct() {
        add_action( 'rest_api_init', array( $this, 'register_routes' ) );
    }

    public function register_routes() {
        $ns = 'tvs/v1';

        // /tvs/v1/routes (LIST)
        register_rest_route( $ns, '/routes', array(
            'methods'             => 'GET',
            'callback'            => array( $this, 'get_routes' ),
            'permission_callback' => '__return_true',
            'args' => array(
                'per_page' => array(
                    'description' => 'Items per page',
                    'type'        => 'integer',
                    'default'     => 20,
                    'minimum'     => 1,
                    'maximum'     => 50,
                ),
                'page' => array(
                    'description' => 'Page number',
                    'type'        => 'integer',
                    'default'     => 1,
                    'minimum'     => 1,
                ),
                'search' => array(
                    'description' => 'Search term',
                    'type'        => 'string',
                    'default'     => '',
                ),
                'region' => array(
                    'description' => 'Region slug',
                    'type'        => 'string',
                    'default'     => '',
                ),
            ),
        ) );

        // /tvs/v1/routes/{id} (GET ONE)
        register_rest_route( $ns, '/routes/(?P<id>\d+)', array(
            'methods'             => 'GET',
            'callback'            => array( $this, 'get_route' ),
            'permission_callback' => '__return_true',
            'args' => array(
                'id' => array(
                    'description' => 'Route ID',
                    'type'        => 'integer',
                    'required'    => true,
                    'minimum'     => 1,
                ),
            ),
        ) );

        register_rest_route( $ns, '/activities', array(
            'methods' => 'POST',
            'callback' => array( $this, 'create_activity' ),
            'permission_callback' => array( $this, 'permissions_for_activities' ),
            'args' => array(),
        ) );

        register_rest_route( $ns, '/activities/me', array(
            'methods' => 'GET',
            'callback' => array( $this, 'get_activities_me' ),
            'permission_callback' => array( $this, 'permissions_for_activities' ),
        ) );

        register_rest_route( $ns, '/strava/connect', array(
            'methods' => 'POST',
            'callback' => array( $this, 'strava_connect' ),
            'permission_callback' => function() { return is_user_logged_in(); },
        ) );

        register_rest_route( $ns, '/activities/(?P<id>\d+)/strava', array(
            'methods' => 'POST',
            'callback' => array( $this, 'activities_upload_strava' ),
            'permission_callback' => array( $this, 'permissions_for_activities' ),
            'args' => array( 'id' => array( 'validate_callback' => 'is_numeric' ) ),
        ) );
    }

 /*    public function get_routes( $request ) {
        $args = array(
            'post_type' => 'tvs_route',
            'posts_per_page' => 20,
        );
        $q = new WP_Query( $args );
        $out = array();
        while ( $q->have_posts() ) {
            $q->the_post();
            $id = get_the_ID();
            $out[] = $this->prepare_route_response( $id );
        }
        wp_reset_postdata();
        return rest_ensure_response( $out );
    } */

        public function get_routes( $request ) {
    $per_page = max( 1, min( 50, (int) $request->get_param( 'per_page' ) ?: 20 ) );
    $paged    = max( 1, (int) $request->get_param( 'page' ) ?: 1 );
    $search   = (string) $request->get_param( 'search' );
    $region   = (string) $request->get_param( 'region' );

    $tax_query = array();
    if ( $region ) {
        $tax_query[] = array(
            'taxonomy' => 'tvs_region',
            'field'    => 'slug',
            'terms'    => $region,
        );
    }

    $args = array(
        'post_type'      => 'tvs_route',
        'posts_per_page' => $per_page,
        'paged'          => $paged,
        's'              => $search,
        'tax_query'      => $tax_query ?: null,
        'no_found_rows'  => false,
    );

    $q   = new WP_Query( $args );
    $out = array();
    while ( $q->have_posts() ) {
        $q->the_post();
        $out[] = $this->prepare_route_response( get_the_ID() );
    }
    wp_reset_postdata();

    return rest_ensure_response( array(
        'items'      => $out,
        'total'      => (int) $q->found_posts,
        'totalPages' => (int) $q->max_num_pages,
        'page'       => $paged,
        'perPage'    => $per_page,
    ) );
}

    public function get_route( $request ) {
        $id = (int) $request['id'];
        if ( get_post_type( $id ) !== 'tvs_route' ) {
            return new WP_Error( 'not_found', 'Route not found', array( 'status' => 404 ) );
        }
        return rest_ensure_response( $this->prepare_route_response( $id ) );
    }

 /*    protected function prepare_route_response( $post_id ) {
        $post = get_post( $post_id );
        $meta = array();
        foreach ( tvs_route_meta_keys() as $k ) {
            $meta[ $k ] = get_post_meta( $post_id, $k, true );
        }
        $regions = wp_get_post_terms( $post_id, 'tvs_region', array( 'fields' => 'names' ) );
        return array(
            'id' => $post_id,
            'title' => get_the_title( $post_id ),
            'content' => apply_filters( 'the_content', $post->post_content ),
            'meta' => $meta,
            'regions' => $regions,
        );
    } */
   protected function prepare_route_response( $post_id ) {
    $post = get_post( $post_id );
    if ( ! $post ) {
        return new WP_Error( 'not_found', 'Route not found', array( 'status' => 404 ) );
    }

    // Meta keys – bruk helper hvis den finnes, ellers safe fallback
    if ( function_exists( 'tvs_route_meta_keys' ) ) {
        $keys = (array) tvs_route_meta_keys();
    } else {
        $keys = array( 'distance_m', 'elevation_m', 'gpx_url', 'video_url', 'duration_s' );
    }

    $meta = array();
    foreach ( $keys as $k ) {
        $meta[ $k ] = get_post_meta( $post_id, $k, true );
    }

    $regions  = wp_get_post_terms( $post_id, 'tvs_region', array( 'fields' => 'names' ) );
    $types    = wp_get_post_terms( $post_id, 'tvs_activity_type', array( 'fields' => 'names' ) );
    $thumb_id = get_post_thumbnail_id( $post_id );
    $image    = $thumb_id ? wp_get_attachment_image_url( $thumb_id, 'large' ) : null;

    return array(
        'id'        => (int) $post_id,
        'title'     => get_the_title( $post_id ),
        'content'   => apply_filters( 'the_content', $post->post_content ),
        'excerpt'   => get_the_excerpt( $post_id ),
        'link'      => get_permalink( $post_id ),
        'image'     => $image,
        'meta'      => $meta,
        'regions'   => is_wp_error( $regions ) ? array() : (array) $regions,
        'types'     => is_wp_error( $types ) ? array() : (array) $types,
        'modified'  => get_post_modified_time( 'c', true, $post ),
        'date'      => get_post_time( 'c', true,   $post ),
        // hint for klienter
        'schema'    => array(
            'distance_m' => 'number',
            'elevation_m'=> 'number',
            'duration_s' => 'number',
            'gpx_url'    => 'url',
            'video_url'  => 'url',
        ),
    );
}


    public function get_route_payload( int $id ) {
        if ( get_post_type( $id ) !== 'tvs_route' ) {
            return new WP_Error( 'not_found', 'Route not found', array( 'status' => 404 ) );
        }
        return $this->prepare_route_response( $id );
    }

    public function create_activity( $request ) {
        $user_id = get_current_user_id();
        if ( ! $user_id ) {
            return new WP_Error( 'forbidden', 'Authentication required', array( 'status' => 401 ) );
        }

        $data = $request->get_json_params();
        // Basic validation
        if ( empty( $data['route_id'] ) ) {
            return new WP_Error( 'invalid', 'route_id required', array( 'status' => 400 ) );
        }

        $postarr = array(
            'post_title' => sprintf( 'Activity: %s by %d', intval( $data['route_id'] ), $user_id ),
            'post_type' => 'tvs_activity',
            'post_status' => 'publish',
            'post_author' => $user_id,
        );

        $post_id = wp_insert_post( $postarr );
        if ( is_wp_error( $post_id ) ) {
            return $post_id;
        }

        // Save meta
        $keys = array('route_id','started_at','ended_at','duration_s','distance_m','avg_hr','max_hr','perceived_exertion','synced_strava','strava_activity_id');
        foreach ( $keys as $k ) {
            if ( isset( $data[ $k ] ) ) {
                update_post_meta( $post_id, $k, sanitize_text_field( $data[ $k ] ) );
            }
        }

        return rest_ensure_response( array( 'id' => $post_id ) );
    }

    public function get_activities_me( $request ) {
        $user_id = get_current_user_id();
        if ( ! $user_id ) {
            return new WP_Error( 'forbidden', 'Authentication required', array( 'status' => 401 ) );
        }
        $args = array(
            'post_type' => 'tvs_activity',
            'author' => $user_id,
            'posts_per_page' => 50,
        );
        $q = new WP_Query( $args );
        $out = array();
        while ( $q->have_posts() ) {
            $q->the_post();
            $id = get_the_ID();
            $out[] = array(
                'id' => $id,
                'meta' => get_post_meta( $id ),
            );
        }
        wp_reset_postdata();
        return rest_ensure_response( $out );
    }

    public function strava_connect( $request ) {
        $user_id = get_current_user_id();
        $params = $request->get_json_params();
        if ( empty( $params['code'] ) ) {
            return new WP_Error( 'invalid', 'code required', array( 'status' => 400 ) );
        }

        $strava = new TVS_Strava();
        $res = $strava->exchange_code_for_token( $params['code'] );
        if ( is_wp_error( $res ) ) {
            return $res;
        }

        // Store tokens in user meta as tvs_strava (per issue #3)
        if ( isset( $res['access_token'] ) && isset( $res['refresh_token'] ) ) {
            $tokens = array(
                'access'     => $res['access_token'],
                'refresh'    => $res['refresh_token'],
                'expires_at' => isset($res['expires_at']) ? $res['expires_at'] : null,
                'scope'      => isset($res['scope']) ? $res['scope'] : null,
                'athlete'    => isset($res['athlete']) ? $res['athlete'] : null,
            );
            update_user_meta( $user_id, 'tvs_strava', $tokens );
            return rest_ensure_response( $tokens );
        }
        return new WP_Error( 'invalid_response', 'Missing tokens from Strava', array( 'status' => 500 ) );
    }

    public function activities_upload_strava( $request ) {
        $id = intval( $request['id'] );
        $post = get_post( $id );
        if ( ! $post || $post->post_type !== 'tvs_activity' ) {
            return new WP_Error( 'not_found', 'Activity not found', array( 'status' => 404 ) );
        }
        $user_id = get_current_user_id();
        if ( $user_id !== (int) $post->post_author ) {
            return new WP_Error( 'forbidden', 'You do not own this activity', array( 'status' => 403 ) );
        }

        $strava = new TVS_Strava();
        $res = $strava->create_activity( $user_id, $id );
        if ( is_wp_error( $res ) ) {
            return $res;
        }

        // Mark activity as synced
        update_post_meta( $id, 'synced_strava', 1 );
        if ( isset( $res['id'] ) ) {
            update_post_meta( $id, 'strava_activity_id', $res['id'] );
        }

        return rest_ensure_response( $res );
    }

    public function permissions_for_activities() {
        return is_user_logged_in();
    }
}

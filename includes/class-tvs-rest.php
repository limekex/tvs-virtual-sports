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

        register_rest_route( $ns, '/routes', array(
            'methods' => 'GET',
            'callback' => array( $this, 'get_routes' ),
            'permission_callback' => '__return_true',
        ) );

        register_rest_route( $ns, '/routes/(?P<id>\d+)', array(
            'methods' => 'GET',
            'callback' => array( $this, 'get_route' ),
            'permission_callback' => '__return_true',
            'args' => array(
                'id' => array( 'validate_callback' => 'is_numeric' ),
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

    public function get_routes( $request ) {
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
    }

    public function get_route( $request ) {
        $id = (int) $request['id'];
        if ( get_post_type( $id ) !== 'tvs_route' ) {
            return new WP_Error( 'not_found', 'Route not found', array( 'status' => 404 ) );
        }
        return rest_ensure_response( $this->prepare_route_response( $id ) );
    }

    protected function prepare_route_response( $post_id ) {
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

        // Store tokens in user meta
        if ( isset( $res['access_token'] ) ) {
            update_user_meta( $user_id, 'tvs_strava_token', $res );
        }
        return rest_ensure_response( $res );
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

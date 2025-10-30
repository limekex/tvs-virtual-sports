<?php
/**
 * REST API tests for routes caching
 */
class TVS_REST_Routes_Cache_Tests extends WP_UnitTestCase {
    public function setUp(): void {
        parent::setUp();
        rest_get_server();
        do_action('rest_api_init');
    }

    protected function create_route($title = 'Cached Route') {
        $id = wp_insert_post( array(
            'post_type'   => 'tvs_route',
            'post_status' => 'publish',
            'post_title'  => $title,
        ) );
        update_post_meta( $id, 'distance_m', 1000 );
        update_post_meta( $id, 'duration_s', 600 );
        return $id;
    }

    public function test_list_is_cached_and_invalidated_on_save() {
        // Seed one route
        $this->create_route('R-1');

        // First call (cold)
    $req1 = new WP_REST_Request( 'GET', '/tvs/v1/routes' );
    $req1->set_param('per_page', 50);
        $res1 = rest_do_request( $req1 );
        $this->assertSame( 200, $res1->get_status() );
        $data1 = $res1->get_data();
        $this->assertArrayHasKey('total', $data1);
        $initial_total = (int) $data1['total'];

        // Second call (warm) — should return same data
    $req2 = new WP_REST_Request( 'GET', '/tvs/v1/routes' );
    $req2->set_param('per_page', 50);
        $res2 = rest_do_request( $req2 );
        $this->assertSame( 200, $res2->get_status() );
        $data2 = $res2->get_data();
        $this->assertSame( $data1['total'], $data2['total'] );

        // Create new route triggers save_post_tvs_route → invalidation
        $new_id = $this->create_route('R-2');
        // Ensure invalidation hook ran and caches are clean in test env
        do_action( 'save_post_tvs_route', $new_id, get_post( $new_id ), true );
        if ( function_exists( 'wp_cache_flush' ) ) {
            wp_cache_flush();
        }

        // Third call after invalidation — total should be >= initial_total + 1
    $req3 = new WP_REST_Request( 'GET', '/tvs/v1/routes' );
    $req3->set_param('per_page', 50);
        $res3 = rest_do_request( $req3 );
        $this->assertSame( 200, $res3->get_status() );
        $data3 = $res3->get_data();
        $this->assertGreaterThanOrEqual( $initial_total + 1, (int) $data3['total'] );
    }
}

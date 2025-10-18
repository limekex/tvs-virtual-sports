<?php
use PHPUnit\Framework\TestCase;

class TVS_REST_Test extends WP_UnitTestCase {
    public function test_get_routes_returns_array() {
        // Ensure at least one route exists
        $route_id = $this->factory->post->create( array( 'post_type' => 'tvs_route', 'post_title' => 'Test Route' ) );

        $response = rest_do_request( new WP_REST_Request( 'GET', '/tvs/v1/routes' ) );
        $this->assertEquals( 200, $response->get_status() );
        $data = $response->get_data();
        $this->assertIsArray( $data );
    }

    public function test_create_activity_requires_auth() {
        $req = new WP_REST_Request( 'POST', '/tvs/v1/activities' );
        $req->set_body_params( array( 'route_id' => 123 ) );
        $response = rest_do_request( $req );
        $this->assertEquals( 401, $response->get_status() );
    }
}

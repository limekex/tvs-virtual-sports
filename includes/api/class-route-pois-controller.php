<?php
/**
 * REST API Controller for Route Points of Interest
 *
 * @package TVS_Virtual_Sports
 */

class TVS_Route_POIs_Controller extends WP_REST_Controller {

    /**
     * Register the routes for PoIs
     */
    public function register_routes() {
        $namespace = 'tvs/v1';
        $base = 'routes/(?P<route_id>[\d]+)/pois';

        // GET /routes/{id}/pois - List all PoIs for a route
        register_rest_route($namespace, '/' . $base, array(
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array($this, 'get_pois'),
                'permission_callback' => array($this, 'get_pois_permissions_check'),
                'args'                => array(
                    'route_id' => array(
                        'required'          => true,
                        'type'              => 'integer',
                        'sanitize_callback' => 'absint',
                    ),
                ),
            ),
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array($this, 'create_poi'),
                'permission_callback' => array($this, 'create_poi_permissions_check'),
                'args'                => $this->get_poi_schema(),
            ),
        ));

        // GET/PUT/DELETE /routes/{id}/pois/{poi_id} - Single PoI operations
        register_rest_route($namespace, '/' . $base . '/(?P<poi_id>[a-zA-Z0-9_-]+)', array(
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array($this, 'get_poi'),
                'permission_callback' => array($this, 'get_pois_permissions_check'),
            ),
            array(
                'methods'             => WP_REST_Server::EDITABLE,
                'callback'            => array($this, 'update_poi'),
                'permission_callback' => array($this, 'update_poi_permissions_check'),
                'args'                => $this->get_poi_schema(),
            ),
            array(
                'methods'             => WP_REST_Server::DELETABLE,
                'callback'            => array($this, 'delete_poi'),
                'permission_callback' => array($this, 'delete_poi_permissions_check'),
            ),
        ));
    }

    /**
     * Get all PoIs for a route
     */
    public function get_pois($request) {
        $route_id = $request->get_param('route_id');
        
        // Verify route exists
        $route = get_post($route_id);
        if (!$route || $route->post_type !== 'tvs_route') {
            return new WP_Error('route_not_found', 'Route not found', array('status' => 404));
        }

        $pois = get_post_meta($route_id, '_route_pois', true);
        if (!$pois || !is_array($pois)) {
            $pois = array();
        }

        // Add image URLs to response
        foreach ($pois as &$poi) {
            if (!empty($poi['image_id'])) {
                $poi['image_url'] = wp_get_attachment_url($poi['image_id']);
                $poi['image_thumbnail'] = wp_get_attachment_image_url($poi['image_id'], 'thumbnail');
            }
            // Ensure custom_icon_url is included if exists
            if (!empty($poi['custom_icon_id'])) {
                $poi['custom_icon_url'] = wp_get_attachment_url($poi['custom_icon_id']);
            }
        }

        return rest_ensure_response($pois);
    }

    /**
     * Get a single PoI
     */
    public function get_poi($request) {
        $route_id = $request->get_param('route_id');
        $poi_id = $request->get_param('poi_id');

        $pois = get_post_meta($route_id, '_route_pois', true);
        if (!$pois || !is_array($pois)) {
            return new WP_Error('poi_not_found', 'PoI not found', array('status' => 404));
        }

        // Find PoI by ID
        foreach ($pois as $poi) {
            if ($poi['id'] === $poi_id) {
                // Add image URLs
                if (!empty($poi['image_id'])) {
                    $poi['image_url'] = wp_get_attachment_url($poi['image_id']);
                    $poi['image_thumbnail'] = wp_get_attachment_image_url($poi['image_id'], 'thumbnail');
                }
                if (!empty($poi['custom_icon_id'])) {
                    $poi['custom_icon_url'] = wp_get_attachment_url($poi['custom_icon_id']);
                }
                return rest_ensure_response($poi);
            }
        }

        return new WP_Error('poi_not_found', 'PoI not found', array('status' => 404));
    }

    /**
     * Create a new PoI
     */
    public function create_poi($request) {
        $route_id = $request->get_param('route_id');
        
        // Verify route exists
        $route = get_post($route_id);
        if (!$route || $route->post_type !== 'tvs_route') {
            return new WP_Error('route_not_found', 'Route not found', array('status' => 404));
        }

        // Generate unique ID
        $poi_id = 'poi_' . wp_generate_password(12, false);

        // Build PoI data
        $poi = array(
            'id'                  => $poi_id,
            'name'                => sanitize_text_field($request->get_param('name')),
            'description'         => sanitize_textarea_field($request->get_param('description')),
            'lng'                 => floatval($request->get_param('lng')),
            'lat'                 => floatval($request->get_param('lat')),
            'icon'                => sanitize_text_field($request->get_param('icon')), // Icon library name or emoji
            'icon_type'           => sanitize_text_field($request->get_param('icon_type') ?: 'library'), // 'library' or 'custom'
            'color'               => sanitize_hex_color($request->get_param('color') ?: '#2563eb'),
            'image_id'            => absint($request->get_param('image_id') ?: 0),
            'custom_icon_id'      => absint($request->get_param('custom_icon_id') ?: 0),
            'trigger_distance_m'  => absint($request->get_param('trigger_distance_m') ?: 150),
            'hide_distance_m'     => absint($request->get_param('hide_distance_m') ?: 100),
        );

        // Get existing PoIs
        $pois = get_post_meta($route_id, '_route_pois', true);
        if (!is_array($pois)) {
            $pois = array();
        }

        // Add new PoI
        $pois[] = $poi;

        // Save
        update_post_meta($route_id, '_route_pois', $pois);

        // Add URLs to response
        if ($poi['image_id']) {
            $poi['image_url'] = wp_get_attachment_url($poi['image_id']);
            $poi['image_thumbnail'] = wp_get_attachment_image_url($poi['image_id'], 'thumbnail');
        }
        if ($poi['custom_icon_id']) {
            $poi['custom_icon_url'] = wp_get_attachment_url($poi['custom_icon_id']);
        }

        return rest_ensure_response($poi);
    }

    /**
     * Update a PoI
     */
    public function update_poi($request) {
        $route_id = $request->get_param('route_id');
        $poi_id = $request->get_param('poi_id');

        $pois = get_post_meta($route_id, '_route_pois', true);
        if (!is_array($pois)) {
            return new WP_Error('poi_not_found', 'PoI not found', array('status' => 404));
        }

        // Find and update PoI
        $found = false;
        foreach ($pois as $index => &$poi) {
            if ($poi['id'] === $poi_id) {
                $found = true;
                // Update fields
                if ($request->has_param('name')) {
                    $poi['name'] = sanitize_text_field($request->get_param('name'));
                }
                if ($request->has_param('description')) {
                    $poi['description'] = sanitize_textarea_field($request->get_param('description'));
                }
                if ($request->has_param('lng')) {
                    $poi['lng'] = floatval($request->get_param('lng'));
                }
                if ($request->has_param('lat')) {
                    $poi['lat'] = floatval($request->get_param('lat'));
                }
                if ($request->has_param('icon')) {
                    $poi['icon'] = sanitize_text_field($request->get_param('icon'));
                }
                if ($request->has_param('icon_type')) {
                    $poi['icon_type'] = sanitize_text_field($request->get_param('icon_type'));
                }
                if ($request->has_param('color')) {
                    $poi['color'] = sanitize_hex_color($request->get_param('color'));
                }
                if ($request->has_param('image_id')) {
                    $poi['image_id'] = absint($request->get_param('image_id'));
                }
                if ($request->has_param('custom_icon_id')) {
                    $poi['custom_icon_id'] = absint($request->get_param('custom_icon_id'));
                }
                if ($request->has_param('trigger_distance_m')) {
                    $poi['trigger_distance_m'] = absint($request->get_param('trigger_distance_m'));
                }
                if ($request->has_param('hide_distance_m')) {
                    $poi['hide_distance_m'] = absint($request->get_param('hide_distance_m'));
                }

                // Add URLs to response
                if (!empty($poi['image_id'])) {
                    $poi['image_url'] = wp_get_attachment_url($poi['image_id']);
                    $poi['image_thumbnail'] = wp_get_attachment_image_url($poi['image_id'], 'thumbnail');
                }
                if (!empty($poi['custom_icon_id'])) {
                    $poi['custom_icon_url'] = wp_get_attachment_url($poi['custom_icon_id']);
                }

                // Save
                update_post_meta($route_id, '_route_pois', $pois);
                return rest_ensure_response($poi);
            }
        }

        if (!$found) {
            return new WP_Error('poi_not_found', 'PoI not found', array('status' => 404));
        }
    }

    /**
     * Delete a PoI
     */
    public function delete_poi($request) {
        $route_id = $request->get_param('route_id');
        $poi_id = $request->get_param('poi_id');

        $pois = get_post_meta($route_id, '_route_pois', true);
        if (!is_array($pois)) {
            return new WP_Error('poi_not_found', 'PoI not found', array('status' => 404));
        }

        // Find and remove PoI
        $found = false;
        foreach ($pois as $index => $poi) {
            if ($poi['id'] === $poi_id) {
                $found = true;
                unset($pois[$index]);
                break;
            }
        }

        if (!$found) {
            return new WP_Error('poi_not_found', 'PoI not found', array('status' => 404));
        }

        // Re-index array
        $pois = array_values($pois);

        // Save
        update_post_meta($route_id, '_route_pois', $pois);

        return rest_ensure_response(array('deleted' => true, 'id' => $poi_id));
    }

    /**
     * Permissions check for getting PoIs (public)
     */
    public function get_pois_permissions_check($request) {
        return true; // PoIs are public, anyone can view
    }

    /**
     * Permissions check for creating PoI
     */
    public function create_poi_permissions_check($request) {
        return current_user_can('edit_posts');
    }

    /**
     * Permissions check for updating PoI
     */
    public function update_poi_permissions_check($request) {
        return current_user_can('edit_posts');
    }

    /**
     * Permissions check for deleting PoI
     */
    public function delete_poi_permissions_check($request) {
        return current_user_can('delete_posts');
    }

    /**
     * Get PoI schema for validation
     */
    public function get_poi_schema() {
        return array(
            'name' => array(
                'type'              => 'string',
                'required'          => true,
                'sanitize_callback' => 'sanitize_text_field',
            ),
            'description' => array(
                'type'              => 'string',
                'required'          => false,
                'sanitize_callback' => 'sanitize_textarea_field',
            ),
            'lng' => array(
                'type'     => 'number',
                'required' => true,
            ),
            'lat' => array(
                'type'     => 'number',
                'required' => true,
            ),
            'icon' => array(
                'type'              => 'string',
                'required'          => false,
                'sanitize_callback' => 'sanitize_text_field',
            ),
            'icon_type' => array(
                'type'              => 'string',
                'required'          => false,
                'enum'              => array('library', 'custom'),
                'default'           => 'library',
            ),
            'image_id' => array(
                'type'     => 'integer',
                'required' => false,
            ),
            'custom_icon_id' => array(
                'type'     => 'integer',
                'required' => false,
            ),
            'trigger_distance_m' => array(
                'type'    => 'integer',
                'default' => 150,
            ),
            'hide_distance_m' => array(
                'type'    => 'integer',
                'default' => 100,
            ),
        );
    }
}

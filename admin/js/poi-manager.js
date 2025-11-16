/**
 * PoI Manager for Route Admin
 * Handles interactive map, icon selector, and CRUD operations
 */

(function($) {
    'use strict';

    let map = null;
    let marker = null;
    let routeLine = null;
    let currentPoiId = null;
    let isEditMode = false;
    let mediaUploader = null;
    let svgUploader = null;

    // Initialize when DOM is ready
    $(document).ready(function() {
        if (!window.tvsPoiData) {
            console.error('tvsPoiData not found');
            return;
        }

        if (!window.tvsPoiData.mapboxToken) {
            console.warn('Mapbox token missing');
            return;
        }

        initEventListeners();
    });

    /**
     * Initialize all event listeners
     */
    function initEventListeners() {
        // Add PoI button
        $('#tvs-add-poi-btn').on('click', openAddModal);

        // Edit PoI button
        $(document).on('click', '.tvs-edit-poi', handleEditPoi);

        // Delete PoI button
        $(document).on('click', '.tvs-delete-poi', handleDeletePoi);

        // Modal close
        $('.tvs-poi-modal-close, #tvs-poi-cancel-btn').on('click', closeModal);

        // Save PoI button
        $('#tvs-poi-save-btn').on('click', handleSavePoi);

        // Icon tab switching
        $('.tvs-icon-tab').on('click', handleIconTabSwitch);

        // Icon selection
        $(document).on('click', '.tvs-icon-option', handleIconSelect);

        // Image upload
        $('#tvs-upload-image-btn').on('click', handleImageUpload);

        // SVG upload
        $('#tvs-upload-svg-btn').on('click', handleSvgUpload);

        // Color selection
        $(document).on('click', '.tvs-color-option', handleColorSelect);

        // Close modal on outside click
        $('.tvs-poi-modal').on('click', function(e) {
            if ($(e.target).hasClass('tvs-poi-modal')) {
                closeModal();
            }
        });
    }

    /**
     * Handle color selection
     */
    function handleColorSelect(e) {
        const color = $(e.currentTarget).data('color');
        
        // Deselect all
        $('.tvs-color-option').removeClass('selected');
        
        // Select this one
        $(e.currentTarget).addClass('selected');
        
        // Update hidden field
        $('#poi-color').val(color);
        
        // Update marker color if exists
        if (marker) {
            const el = marker.getElement();
            el.style.backgroundColor = color;
        }
    }

    /**
     * Open Add PoI modal
     */
    function openAddModal() {
        isEditMode = false;
        currentPoiId = null;
        $('#tvs-poi-modal-title').text('Add Point of Interest');
        resetForm();
        showModal();
        initializeMap();
    }

    /**
     * Handle Edit PoI
     */
    function handleEditPoi(e) {
        const poiId = $(e.currentTarget).data('poi-id');
        isEditMode = true;
        currentPoiId = poiId;
        $('#tvs-poi-modal-title').text('Edit Point of Interest');
        
        // Fetch PoI data
        $.ajax({
            url: window.tvsPoiData.apiUrl + '/' + poiId,
            method: 'GET',
            beforeSend: function(xhr) {
                xhr.setRequestHeader('X-WP-Nonce', window.tvsPoiData.nonce);
            },
            success: function(poi) {
                populateForm(poi);
                showModal();
                initializeMap(poi.lng, poi.lat);
            },
            error: function(xhr) {
                alert('Failed to load PoI data: ' + (xhr.responseJSON?.message || 'Unknown error'));
            }
        });
    }

    /**
     * Handle Delete PoI
     */
    function handleDeletePoi(e) {
        const poiId = $(e.currentTarget).data('poi-id');
        
        if (!confirm('Are you sure you want to delete this Point of Interest?')) {
            return;
        }

        $.ajax({
            url: window.tvsPoiData.apiUrl + '/' + poiId,
            method: 'DELETE',
            beforeSend: function(xhr) {
                xhr.setRequestHeader('X-WP-Nonce', window.tvsPoiData.nonce);
            },
            success: function() {
                // Remove from list
                $(`.tvs-poi-item[data-poi-id="${poiId}"]`).fadeOut(300, function() {
                    $(this).remove();
                    
                    // Show "no pois" message if list is empty
                    if ($('.tvs-poi-item').length === 0) {
                        $('#tvs-poi-list').html('<p class="tvs-no-pois">No points of interest yet. Click "Add Point of Interest" to get started.</p>');
                    }
                });
            },
            error: function(xhr) {
                alert('Failed to delete PoI: ' + (xhr.responseJSON?.message || 'Unknown error'));
            }
        });
    }

    /**
     * Handle Save PoI
     */
    function handleSavePoi() {
        const data = {
            name: $('#poi-name').val(),
            description: $('#poi-description').val(),
            lng: parseFloat($('#poi-lng').val()),
            lat: parseFloat($('#poi-lat').val()),
            icon: $('#poi-icon').val(),
            icon_type: $('#poi-icon-type').val(),
            color: $('#poi-color').val() || '#2563eb',
            image_id: parseInt($('#poi-image-id').val()) || 0,
            custom_icon_id: parseInt($('#poi-custom-icon-id').val()) || 0,
            trigger_distance_m: parseInt($('#poi-trigger-distance').val()) || 150,
            hide_distance_m: parseInt($('#poi-hide-distance').val()) || 100
        };

        // Validation
        if (!data.name) {
            alert('Please enter a name for the PoI');
            return;
        }

        if (!data.lng || !data.lat) {
            alert('Please click on the map to place the PoI marker');
            return;
        }

        const url = isEditMode 
            ? window.tvsPoiData.apiUrl + '/' + currentPoiId
            : window.tvsPoiData.apiUrl;

        const method = isEditMode ? 'PUT' : 'POST';

        $.ajax({
            url: url,
            method: method,
            data: JSON.stringify(data),
            contentType: 'application/json',
            beforeSend: function(xhr) {
                xhr.setRequestHeader('X-WP-Nonce', window.tvsPoiData.nonce);
            },
            success: function(poi) {
                if (isEditMode) {
                    // Update existing item in list
                    updatePoiInList(poi);
                } else {
                    // Add new item to list
                    addPoiToList(poi);
                }
                closeModal();
            },
            error: function(xhr) {
                alert('Failed to save PoI: ' + (xhr.responseJSON?.message || 'Unknown error'));
            }
        });
    }

    /**
     * Initialize Mapbox map
     */
    function initializeMap(lng = null, lat = null) {
        if (map) {
            map.remove();
        }

        if (!window.mapboxgl || !window.tvsPoiData.mapboxToken) {
            return;
        }

        mapboxgl.accessToken = window.tvsPoiData.mapboxToken;

        // Default center (will be overridden when route loads)
        const center = [lng || 10.7522, lat || 59.9104];

        map = new mapboxgl.Map({
            container: 'tvs-poi-map',
            style: 'mapbox://styles/mapbox/satellite-streets-v12',
            center: center,
            zoom: 14,
            pitch: 0
        });

        map.on('load', function() {
            // Load route GPX if available
            if (window.tvsPoiData.gpxUrl) {
                loadRouteGpx();
            }

            // If editing, add marker at current position
            if (lng && lat) {
                addMarker(lng, lat);
            }
        });

        // Click to place marker
        map.on('click', function(e) {
            const { lng, lat } = e.lngLat;
            addMarker(lng, lat);
            updateCoordinates(lng, lat);
        });
    }

    /**
     * Load route GPX data and draw line
     */
    function loadRouteGpx() {
        $.ajax({
            url: `/wp-json/tvs/v1/routes/${window.tvsPoiData.routeId}/gpx-data`,
            method: 'GET',
            success: function(gpxData) {
                if (gpxData.points && gpxData.points.length > 0) {
                    const coordinates = gpxData.points.map(p => [p.lng, p.lat]);

                    // Add route line
                    map.addSource('route', {
                        type: 'geojson',
                        data: {
                            type: 'Feature',
                            properties: {},
                            geometry: {
                                type: 'LineString',
                                coordinates: coordinates
                            }
                        }
                    });

                    map.addLayer({
                        id: 'route-line',
                        type: 'line',
                        source: 'route',
                        layout: {
                            'line-join': 'round',
                            'line-cap': 'round'
                        },
                        paint: {
                            'line-color': '#ff0000',
                            'line-width': 3,
                            'line-opacity': 0.8
                        }
                    });

                    // Fit bounds to route
                    const bounds = coordinates.reduce(function(bounds, coord) {
                        return bounds.extend(coord);
                    }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

                    map.fitBounds(bounds, { padding: 50 });
                }
            },
            error: function() {
                console.warn('Failed to load GPX data for route');
            }
        });
    }

    /**
     * Add or update marker on map
     */
    function addMarker(lng, lat) {
        if (marker) {
            marker.remove();
        }

        const el = document.createElement('div');
        el.className = 'tvs-poi-marker';
        el.style.width = '30px';
        el.style.height = '30px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = $('#poi-color').val() || '#2563eb';
        el.style.border = '3px solid white';
        el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        el.style.cursor = 'grab';

        marker = new mapboxgl.Marker({
            element: el,
            draggable: true
        })
            .setLngLat([lng, lat])
            .addTo(map);

        // Update coordinates when marker is dragged
        marker.on('dragend', function() {
            const lngLat = marker.getLngLat();
            updateCoordinates(lngLat.lng, lngLat.lat);
        });
    }

    /**
     * Update coordinate display and hidden fields
     */
    function updateCoordinates(lng, lat) {
        $('#poi-lng').val(lng.toFixed(6));
        $('#poi-lat').val(lat.toFixed(6));
        $('#poi-lng-display').text(lng.toFixed(6));
        $('#poi-lat-display').text(lat.toFixed(6));
    }

    /**
     * Handle icon tab switching
     */
    function handleIconTabSwitch(e) {
        const tab = $(e.currentTarget).data('tab');
        
        // Update tabs
        $('.tvs-icon-tab').removeClass('active');
        $(e.currentTarget).addClass('active');

        // Update content
        $('.tvs-icon-tab-content').removeClass('active');
        $('#tvs-icon-' + tab).addClass('active');

        // Update icon type
        $('#poi-icon-type').val(tab === 'custom' ? 'custom' : 'library');
    }

    /**
     * Handle icon selection from library
     */
    function handleIconSelect(e) {
        const icon = $(e.currentTarget).data('icon');
        
        // Deselect all
        $('.tvs-icon-option').removeClass('selected');
        
        // Select this one
        $(e.currentTarget).addClass('selected');
        
        // Update hidden field
        $('#poi-icon').val(icon);
        $('#poi-icon-type').val('library');
    }

    /**
     * Handle image upload
     */
    function handleImageUpload(e) {
        e.preventDefault();

        // If media uploader exists, open it
        if (mediaUploader) {
            mediaUploader.open();
            return;
        }

        // Create media uploader
        mediaUploader = wp.media({
            title: 'Select PoI Image',
            button: {
                text: 'Use this image'
            },
            multiple: false,
            library: {
                type: 'image'
            }
        });

        // When image is selected
        mediaUploader.on('select', function() {
            const attachment = mediaUploader.state().get('selection').first().toJSON();
            $('#poi-image-id').val(attachment.id);
            
            // Show preview
            const preview = `<img src="${attachment.url}" style="max-width: 200px; border-radius: 4px;" />
                            <button type="button" class="button button-small" id="remove-image-btn" style="display: block; margin-top: 8px;">Remove</button>`;
            $('#tvs-image-preview').html(preview);
        });

        mediaUploader.open();
    }

    /**
     * Handle custom SVG upload
     */
    function handleSvgUpload(e) {
        e.preventDefault();

        // If SVG uploader exists, open it
        if (svgUploader) {
            svgUploader.open();
            return;
        }

        // Create SVG uploader
        svgUploader = wp.media({
            title: 'Select Custom SVG Icon',
            button: {
                text: 'Use this icon'
            },
            multiple: false,
            library: {
                type: 'image/svg+xml'
            }
        });

        // When SVG is selected
        svgUploader.on('select', function() {
            const attachment = svgUploader.state().get('selection').first().toJSON();
            $('#poi-custom-icon-id').val(attachment.id);
            $('#poi-icon-type').val('custom');
            
            // Show preview
            const preview = `<img src="${attachment.url}" style="max-width: 60px; height: 60px;" />
                            <button type="button" class="button button-small" id="remove-svg-btn" style="display: block; margin-top: 8px;">Remove</button>`;
            $('#tvs-custom-icon-preview').html(preview);
        });

        svgUploader.open();
    }

    /**
     * Remove image preview
     */
    $(document).on('click', '#remove-image-btn', function() {
        $('#poi-image-id').val('');
        $('#tvs-image-preview').html('');
    });

    /**
     * Remove SVG preview
     */
    $(document).on('click', '#remove-svg-btn', function() {
        $('#poi-custom-icon-id').val('');
        $('#tvs-custom-icon-preview').html('');
    });

    /**
     * Show modal
     */
    function showModal() {
        // Move modal to body if not already there
        const $modal = $('.tvs-poi-modal');
        if ($modal.parent().attr('id') !== 'wpwrap') {
            $modal.appendTo('body');
        }
        
        $modal.fadeIn(200);
        $('body').css('overflow', 'hidden');
    }

    /**
     * Close modal
     */
    function closeModal() {
        $('.tvs-poi-modal').fadeOut(200, function() {
            if (map) {
                map.remove();
                map = null;
            }
            if (marker) {
                marker = null;
            }
        });
        $('body').css('overflow', '');
    }

    /**
     * Reset form
     */
    function resetForm() {
        $('#poi-name').val('');
        $('#poi-description').val('');
        $('#poi-lng').val('');
        $('#poi-lat').val('');
        $('#poi-lng-display').text('--');
        $('#poi-lat-display').text('--');
        $('#poi-icon').val('FaLandmark');
        $('#poi-icon-type').val('library');
        $('#poi-image-id').val('');
        $('#poi-custom-icon-id').val('');
        $('#poi-trigger-distance').val(150);
        $('#poi-hide-distance').val(100);
        $('#tvs-image-preview').html('');
        $('#tvs-custom-icon-preview').html('');
        $('.tvs-icon-option').removeClass('selected');
        $('.tvs-icon-option[data-icon="FaLandmark"]').addClass('selected');
        $('.tvs-icon-tab').removeClass('active');
        $('.tvs-icon-tab[data-tab="library"]').addClass('active');
        $('.tvs-icon-tab-content').removeClass('active');
        $('#tvs-icon-library').addClass('active');
    }

    /**
     * Populate form with PoI data
     */
    function populateForm(poi) {
        $('#poi-id').val(poi.id);
        $('#poi-name').val(poi.name);
        $('#poi-description').val(poi.description || '');
        $('#poi-lng').val(poi.lng);
        $('#poi-lat').val(poi.lat);
        $('#poi-lng-display').text(poi.lng.toFixed(6));
        $('#poi-lat-display').text(poi.lat.toFixed(6));
        $('#poi-icon').val(poi.icon);
        $('#poi-icon-type').val(poi.icon_type || 'library');
        $('#poi-image-id').val(poi.image_id || '');
        $('#poi-custom-icon-id').val(poi.custom_icon_id || '');
        $('#poi-trigger-distance').val(poi.trigger_distance_m || 150);
        $('#poi-hide-distance').val(poi.hide_distance_m || 100);

        // Icon selection
        $('.tvs-icon-option').removeClass('selected');
        if (poi.icon_type === 'custom') {
            $('.tvs-icon-tab[data-tab="custom"]').click();
            if (poi.custom_icon_url) {
                $('#tvs-custom-icon-preview').html(`<img src="${poi.custom_icon_url}" style="max-width: 60px; height: 60px;" />`);
            }
        } else {
            $(`.tvs-icon-option[data-icon="${poi.icon}"]`).addClass('selected');
        }

        // Image preview
        if (poi.image_thumbnail) {
            $('#tvs-image-preview').html(`<img src="${poi.image_thumbnail}" style="max-width: 200px; border-radius: 4px;" />
                                          <button type="button" class="button button-small" id="remove-image-btn" style="display: block; margin-top: 8px;">Remove</button>`);
        }
    }

    /**
     * Add PoI to list
     */
    function addPoiToList(poi) {
        // Remove "no pois" message
        $('.tvs-no-pois').remove();

        const thumbnail = poi.image_thumbnail 
            ? `<div class="poi-thumbnail"><img src="${poi.image_thumbnail}" alt=""></div>`
            : '';

        const item = `
            <div class="tvs-poi-item" data-poi-id="${poi.id}">
                ${thumbnail}
                <div class="poi-info">
                    <div class="poi-name">
                        <span class="poi-icon">${poi.icon || '📍'}</span>
                        <strong>${poi.name}</strong>
                    </div>
                    <div class="poi-meta">
                        <span>Trigger: ${poi.trigger_distance_m}m</span>
                        <span class="poi-coords">Lng: ${poi.lng.toFixed(6)}, Lat: ${poi.lat.toFixed(6)}</span>
                    </div>
                </div>
                <div class="poi-actions">
                    <button type="button" class="button button-small tvs-edit-poi" data-poi-id="${poi.id}">Edit</button>
                    <button type="button" class="button button-small button-link-delete tvs-delete-poi" data-poi-id="${poi.id}">Delete</button>
                </div>
            </div>
        `;

        $('#tvs-poi-list').append(item);
    }

    /**
     * Update PoI in list
     */
    function updatePoiInList(poi) {
        const $item = $(`.tvs-poi-item[data-poi-id="${poi.id}"]`);
        
        const thumbnail = poi.image_thumbnail 
            ? `<div class="poi-thumbnail"><img src="${poi.image_thumbnail}" alt=""></div>`
            : '';

        const html = `
            ${thumbnail}
            <div class="poi-info">
                <div class="poi-name">
                    <span class="poi-icon">${poi.icon || '📍'}</span>
                    <strong>${poi.name}</strong>
                </div>
                <div class="poi-meta">
                    <span>Trigger: ${poi.trigger_distance_m}m</span>
                    <span class="poi-coords">Lng: ${poi.lng.toFixed(6)}, Lat: ${poi.lat.toFixed(6)}</span>
                </div>
            </div>
            <div class="poi-actions">
                <button type="button" class="button button-small tvs-edit-poi" data-poi-id="${poi.id}">Edit</button>
                <button type="button" class="button button-small button-link-delete tvs-delete-poi" data-poi-id="${poi.id}">Delete</button>
            </div>
        `;

        $item.html(html);
    }

})(jQuery);

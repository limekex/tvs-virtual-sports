import { React } from '../utils/reactMount.js';
import { RiPlayCircleLine, RiPauseCircleLine, RiRestartLine, RiZoomInLine, RiZoomOutLine, RiEyeLine, RiEyeOffLine, RiFullscreenLine } from 'react-icons/ri';

export default function VirtualTraining({ routeData, routeId }) {
  const { useEffect, useState, useRef, createElement: h } = React;
  
  // State
  const [isWelcome, setIsWelcome] = useState(true);
  const [speed, setSpeed] = useState(12);
  const [isPlaying, setIsPlaying] = useState(false);
  const [followMode, setFollowMode] = useState(true);
  const [showRouteLine, setShowRouteLine] = useState(true);
  const [activePoI, setActivePoI] = useState(null);
  const [currentDistanceKm, setCurrentDistanceKm] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Refs
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const timelineRef = useRef(null);
  const completedLineRef = useRef(null);
  const fullLineRef = useRef(null);
  const animationFrameRef = useRef(null);
  
  // Points of Interest (demo data - later from WordPress)
  const poisData = [
    {
      id: 'poi-1',
      name: 'Oslo Sentralstasjon',
      description: 'Norges største jernbanestasjon, åpnet i 1980.',
      triggerDistanceMeters: 150,
      hideDistanceMeters: 100,
      lng: 10.7522,
      lat: 59.9111,
      icon: '🚂'
    },
    {
      id: 'poi-2',
      name: 'Operaen',
      description: 'Den Norske Opera & Ballett, ikonisk marmorbygg ved fjorden.',
      triggerDistanceMeters: 150,
      hideDistanceMeters: 100,
      lng: 10.7531,
      lat: 59.9075,
      icon: '🎭'
    },
    {
      id: 'poi-3',
      name: 'Akershus Festning',
      description: 'Middelalderborg fra 1299, med fantastisk utsikt over Oslofjorden.',
      triggerDistanceMeters: 150,
      hideDistanceMeters: 100,
      lng: 10.7364,
      lat: 59.9078,
      icon: '🏰'
    }
  ];

  // Get GPX data from route meta
  const gpxUrl = routeData?.meta?.gpx_url || '';
  const routeTitle = routeData?.title || 'Route';
  
  // Calculate route info
  const routeDistanceKm = routeData?.meta?.distance_km || 0;
  const durationMinutes = routeDistanceKm > 0 && speed > 0 
    ? Math.round((routeDistanceKm / speed) * 60) 
    : 0;
  
  // Haversine distance calculation
  function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  // Calculate distance to a specific point
  function calculateDistanceToPoint(poiLng, poiLat, points, currentIndex) {
    if (!points || points.length === 0) return 0;
    
    let closestIndex = 0;
    let closestDistance = Infinity;
    
    // Find closest GPS point to PoI
    points.forEach((point, index) => {
      const dist = haversineDistance(point.lat, point.lng, poiLat, poiLng);
      if (dist < closestDistance) {
        closestDistance = dist;
        closestIndex = index;
      }
    });
    
    // Calculate cumulative distance to that point
    let cumulativeDistance = 0;
    for (let i = 0; i < closestIndex && i < points.length - 1; i++) {
      cumulativeDistance += haversineDistance(
        points[i].lat, points[i].lng,
        points[i + 1].lat, points[i + 1].lng
      );
    }
    
    return cumulativeDistance;
  }
  
  // Load GPX data and initialize map
  useEffect(() => {
    if (!gpxUrl || !window.mapboxgl) return;
    
    (async () => {
      try {
        // Fetch GPX data from REST endpoint
        const response = await fetch(`/wp-json/tvs/v1/routes/${routeId}/gpx-data`);
        const gpxData = await response.json();
        
        if (!gpxData.points || gpxData.points.length === 0) {
          console.error('No GPS points in GPX data');
          return;
        }
        
        // Initialize Mapbox
        window.mapboxgl.accessToken = 'pk.eyJ1IjoibGltZWtleCIsImEiOiJjbTN4emN4NDUwY2o2MmtzOXRrb2w5YmNxIn0.rJ0YZqV7mDmx5I3rpglXvg';
        
        const map = new window.mapboxgl.Map({
          container: mapRef.current,
          style: 'mapbox://styles/mapbox/satellite-streets-v12',
          center: [gpxData.points[0].lng, gpxData.points[0].lat],
          zoom: 14,
          pitch: 60,
          bearing: 0
        });
        
        mapInstanceRef.current = map;
        
        map.on('load', () => {
          // Add full route line (gray)
          const routeCoordinates = gpxData.points.map(p => [p.lng, p.lat]);
          
          map.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: routeCoordinates
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
              'line-color': '#888',
              'line-width': 6,
              'line-opacity': 0.7
            }
          });
          
          fullLineRef.current = 'route-line';
          
          // Add completed route line (green)
          map.addSource('completed-route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: [[gpxData.points[0].lng, gpxData.points[0].lat]]
              }
            }
          });
          
          map.addLayer({
            id: 'completed-route-line',
            type: 'line',
            source: 'completed-route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#00ff00',
              'line-width': 6,
              'line-opacity': 0.95
            }
          });
          
          completedLineRef.current = 'completed-route-line';
          
          // Add marker
          const el = document.createElement('div');
          el.className = 'virtual-training-marker';
          el.style.width = '20px';
          el.style.height = '20px';
          el.style.borderRadius = '50%';
          el.style.backgroundColor = '#ff0000';
          el.style.border = '3px solid white';
          el.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
          
          const marker = new window.mapboxgl.Marker(el)
            .setLngLat([gpxData.points[0].lng, gpxData.points[0].lat])
            .addTo(map);
          
          markerRef.current = marker;
          
          // Add PoI markers
          poisData.forEach(poi => {
            const poiEl = document.createElement('div');
            poiEl.className = 'poi-marker';
            poiEl.style.width = '40px';
            poiEl.style.height = '40px';
            poiEl.style.borderRadius = '50%';
            poiEl.style.backgroundColor = '#8b5cf6';
            poiEl.style.border = '3px solid white';
            poiEl.style.display = 'flex';
            poiEl.style.alignItems = 'center';
            poiEl.style.justifyContent = 'center';
            poiEl.style.fontSize = '20px';
            poiEl.style.cursor = 'pointer';
            poiEl.innerHTML = poi.icon;
            
            new window.mapboxgl.Marker(poiEl)
              .setLngLat([poi.lng, poi.lat])
              .addTo(map);
          });
          
          // Setup GSAP timeline
          if (window.gsap) {
            const durationSeconds = (gpxData.distance_km / speed) * 3600;
            const pointDuration = durationSeconds / gpxData.points.length;
            
            const timeline = window.gsap.timeline({
              paused: true,
              onUpdate: () => {
                const progress = timeline.progress();
                const currentIndex = Math.floor(progress * (gpxData.points.length - 1));
                const currentPoint = gpxData.points[currentIndex];
                
                if (currentPoint && markerRef.current) {
                  // Update marker position
                  markerRef.current.setLngLat([currentPoint.lng, currentPoint.lat]);
                  
                  // Update camera if following
                  if (followMode && mapInstanceRef.current) {
                    mapInstanceRef.current.jumpTo({
                      center: [currentPoint.lng, currentPoint.lat]
                    });
                  }
                  
                  // Update completed route line
                  const completedCoords = gpxData.points
                    .slice(0, currentIndex + 1)
                    .map(p => [p.lng, p.lat]);
                  
                  if (completedCoords.length > 0 && mapInstanceRef.current) {
                    mapInstanceRef.current.getSource('completed-route')?.setData({
                      type: 'Feature',
                      properties: {},
                      geometry: {
                        type: 'LineString',
                        coordinates: completedCoords
                      }
                    });
                  }
                  
                  // Calculate current distance
                  let distanceSum = 0;
                  for (let i = 0; i < currentIndex && i < gpxData.points.length - 1; i++) {
                    distanceSum += haversineDistance(
                      gpxData.points[i].lat, gpxData.points[i].lng,
                      gpxData.points[i + 1].lat, gpxData.points[i + 1].lng
                    );
                  }
                  setCurrentDistanceKm(distanceSum);
                  setElapsedTime(timeline.time());
                  
                  // Check PoI proximity
                  poisData.forEach(poi => {
                    const poiDistanceKm = calculateDistanceToPoint(poi.lng, poi.lat, gpxData.points, currentIndex);
                    const triggerDistanceKm = (poi.triggerDistanceMeters || 150) / 1000;
                    const hideDistanceKm = (poi.hideDistanceMeters || 100) / 1000;
                    
                    if (distanceSum >= (poiDistanceKm - triggerDistanceKm) && 
                        distanceSum <= (poiDistanceKm + hideDistanceKm)) {
                      if (activePoI?.id !== poi.id) {
                        setActivePoI(poi);
                      }
                    } else if (activePoI?.id === poi.id && distanceSum > (poiDistanceKm + hideDistanceKm)) {
                      setActivePoI(null);
                    }
                  });
                }
              }
            });
            
            // Add keyframes for each point
            gpxData.points.forEach((point, index) => {
              timeline.to({}, {
                duration: pointDuration,
                ease: 'none'
              });
            });
            
            timelineRef.current = timeline;
          }
        });
        
      } catch (error) {
        console.error('Failed to load GPX data:', error);
      }
    })();
    
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }
      if (timelineRef.current) {
        timelineRef.current.kill();
      }
    };
  }, [gpxUrl, routeId]);
  
  // Control functions
  function startTraining() {
    setIsWelcome(false);
    setIsPlaying(true);
    if (timelineRef.current) {
      timelineRef.current.play();
    }
  }
  
  function togglePlay() {
    if (!timelineRef.current) return;
    
    if (isPlaying) {
      timelineRef.current.pause();
    } else {
      timelineRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }
  
  function restart() {
    if (!timelineRef.current) return;
    timelineRef.current.restart();
    setIsPlaying(true);
    setCurrentDistanceKm(0);
    setElapsedTime(0);
    setActivePoI(null);
  }
  
  function zoomIn() {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  }
  
  function zoomOut() {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  }
  
  function toggleRouteLine() {
    if (!mapInstanceRef.current || !fullLineRef.current) return;
    
    const newVisibility = showRouteLine ? 'none' : 'visible';
    mapInstanceRef.current.setLayoutProperty('route-line', 'visibility', newVisibility);
    setShowRouteLine(!showRouteLine);
  }
  
  function enterFullscreen() {
    const container = document.querySelector('.tvs-virtual-training');
    if (container && container.requestFullscreen) {
      container.requestFullscreen();
    }
  }
  
  // Format time helper
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  
  // Welcome screen
  if (isWelcome) {
    return h('div', { className: 'tvs-virtual-training tvs-virtual-training--welcome' },
      h('div', { className: 'virtual-training-welcome' },
        h('h2', null, routeTitle),
        h('div', { className: 'welcome-stats' },
          h('div', { className: 'stat' },
            h('span', { className: 'stat-label' }, 'Distance'),
            h('span', { className: 'stat-value' }, `${routeDistanceKm.toFixed(2)} km`)
          ),
          h('div', { className: 'stat' },
            h('span', { className: 'stat-label' }, 'Duration'),
            h('span', { className: 'stat-value' }, `${durationMinutes} min`)
          )
        ),
        h('div', { className: 'speed-input' },
          h('label', null, 'Your Speed (km/h)'),
          h('input', {
            type: 'number',
            value: speed,
            onChange: (e) => setSpeed(Number(e.target.value) || 12),
            min: 1,
            max: 50,
            step: 0.5
          })
        ),
        h('button', {
          className: 'tvs-btn tvs-btn--primary',
          onClick: startTraining
        }, 'Start Training')
      )
    );
  }
  
  // Training screen
  return h('div', { className: 'tvs-virtual-training' },
    // Map container
    h('div', {
      ref: mapRef,
      className: 'virtual-training-map',
      style: { width: '100%', height: '70vh' }
    }),
    
    // Stats overlay
    h('div', { className: 'training-stats' },
      h('div', { className: 'stat-item' },
        h('span', { className: 'stat-label' }, 'Distance'),
        h('span', { className: 'stat-value' }, `${currentDistanceKm.toFixed(2)} / ${routeDistanceKm.toFixed(2)} km`)
      ),
      h('div', { className: 'stat-item' },
        h('span', { className: 'stat-label' }, 'Time'),
        h('span', { className: 'stat-value' }, `${formatTime(elapsedTime)} / ${formatTime(durationMinutes * 60)}`)
      ),
      h('div', { className: 'stat-item' },
        h('span', { className: 'stat-label' }, 'Speed'),
        h('span', { className: 'stat-value' }, `${speed} km/h`)
      )
    ),
    
    // PoI popup
    activePoI && h('div', { className: 'poi-popup' },
      h('div', { className: 'poi-icon' }, activePoI.icon),
      h('h3', null, activePoI.name),
      h('p', null, activePoI.description)
    ),
    
    // Controls
    h('div', { className: 'training-controls' },
      h('button', {
        className: 'control-btn',
        onClick: togglePlay,
        title: isPlaying ? 'Pause' : 'Play'
      }, h(isPlaying ? RiPauseCircleLine : RiPlayCircleLine, { size: 32 })),
      
      h('button', {
        className: 'control-btn',
        onClick: restart,
        title: 'Restart'
      }, h(RiRestartLine, { size: 24 })),
      
      h('button', {
        className: 'control-btn',
        onClick: zoomIn,
        title: 'Zoom In'
      }, h(RiZoomInLine, { size: 24 })),
      
      h('button', {
        className: 'control-btn',
        onClick: zoomOut,
        title: 'Zoom Out'
      }, h(RiZoomOutLine, { size: 24 })),
      
      h('button', {
        className: `control-btn ${followMode ? 'active' : ''}`,
        onClick: () => setFollowMode(!followMode),
        title: followMode ? 'Disable Follow' : 'Enable Follow'
      }, h(followMode ? RiEyeLine : RiEyeOffLine, { size: 24 })),
      
      h('button', {
        className: `control-btn ${showRouteLine ? 'active' : ''}`,
        onClick: toggleRouteLine,
        title: showRouteLine ? 'Hide Route Line' : 'Show Route Line'
      }, 'Route'),
      
      h('button', {
        className: 'control-btn',
        onClick: enterFullscreen,
        title: 'Fullscreen'
      }, h(RiFullscreenLine, { size: 24 }))
    )
  );
}

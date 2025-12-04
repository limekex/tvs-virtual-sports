import { React } from '../utils/reactMount.js';
import { DEBUG, log } from '../utils/debug.js';
import { RiPlayCircleLine, RiPauseCircleLine, RiRestartLine, RiZoomInLine, RiZoomOutLine, RiVideoOnLine, RiVideoOffLine, RiFullscreenLine, RiFullscreenExitLine, RiAddLine, RiSubtractLine, RiCompassLine, RiCompass3Fill, RiArrowUpSLine, RiArrowDownSLine } from 'react-icons/ri';
import { FaRoute } from 'react-icons/fa';
import { AiOutlineSave } from 'react-icons/ai';

// Icon library mapping (same as backend)
const ICON_LIBRARY = {
  'FaLandmark': '🏛️',
  'FaTheaterMasks': '🎭',
  'FaFortAwesome': '🏰',
  'FaChurch': '⛪',
  'FaTrain': '🚉',
  'FaTree': '🌳',
  'FaMountain': '🏔️',
  'FaWater': '💧',
  'FaBridge': '🌉',
  'FaMonument': '🗿',
  'FaUniversity': '🎓',
  'FaHospital': '🏥',
  'FaStore': '🏪',
  'FaCoffee': '☕',
  'FaCamera': '📷',
};

export default function VirtualTraining({ routeData, routeId }) {
  const { useEffect, useState, useRef, createElement: h } = React;
  
  // Get Mapbox settings from WordPress
  const mapboxSettings = window.TVS_SETTINGS?.mapbox || {};
  
  const {
    accessToken: configAccessToken = '',
    style: configMapStyle = 'mapbox://styles/mapbox/satellite-streets-v12',
    initialZoom: configInitialZoom = 14,
    flyToZoom: configFlyToZoom = 16,
    minZoom: configMinZoom = 10,
    maxZoom: configMaxZoom = 18,
    pitch: configPitch = 60,
    bearing: configBearing = 0,
    defaultSpeed: configDefaultSpeed = 1.0,
    cameraOffset: configCameraOffset = 0.0002,
    smoothFactor: configSmoothFactor = 0.7,
    markerColor: configMarkerColor = '#ff0000',
    routeColor: configRouteColor = '#ec4899',
    routeWidth: configRouteWidth = 6,
    terrainEnabled: configTerrainEnabled = false,
    terrainExaggeration: configTerrainExaggeration = 1.5,
    buildings3dEnabled: configBuildings3dEnabled = false
  } = mapboxSettings;
  
  // Debug mode check (URL parameter)
  const isDebugMode = new URLSearchParams(window.location.search).get('debug') === '1';
  
  // Debug logger - only logs if debug=1 in URL
  const debugLog = (...args) => {
    if (isDebugMode) {
      console.log('[VirtualTraining]', ...args);
    }
  };
  
  // Flash message helper
  function showFlash(message, type = 'success') {
    if (typeof window.tvsFlash === 'function') {
      window.tvsFlash(message, type);
    }
  }
  
  // State
  const [isWelcome, setIsWelcome] = useState(true);
  const [speed, setSpeed] = useState(12);
  const [isPlaying, setIsPlaying] = useState(false);
  const [followMode, setFollowMode] = useState(true);
  const [rotateWithDirection, setRotateWithDirection] = useState(true);
  const [showRouteLine, setShowRouteLine] = useState(true);
  const [activePoI, setActivePoI] = useState(null);
  const [currentDistanceKm, setCurrentDistanceKm] = useState(0);
  const [currentElevation, setCurrentElevation] = useState(0);
  const [currentGradient, setCurrentGradient] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [estimatedTotalTime, setEstimatedTotalTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [actualDistance, setActualDistance] = useState('');
  const [actualTime, setActualTime] = useState('');
  const [activityNotes, setActivityNotes] = useState('');
  const [activityRating, setActivityRating] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [activityType, setActivityType] = useState('Run'); // 'Walk', 'Run', or 'Ride'
  const [statsMinimized, setStatsMinimized] = useState(false); // Toggle stats panel size
  const [controlsHidden, setControlsHidden] = useState(false); // Auto-hide controls
  
  // Refs
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const timelineRef = useRef(null);
  const completedLineRef = useRef(null);
  const fullLineRef = useRef(null);
  const animationFrameRef = useRef(null);
  const followModeRef = useRef(followMode); // Track follow mode without triggering re-render
  const rotateWithDirectionRef = useRef(rotateWithDirection); // Track rotation mode
  const currentSpeedRef = useRef(speed); // Track current speed for calculations
  const initialSpeedRef = useRef(null); // Track initial speed for timeScale calculations
  const realStartTimeRef = useRef(null); // Real clock start time (Date.now())
  const pauseStartTimeRef = useRef(null); // When pause started
  const totalPausedTimeRef = useRef(0); // Total accumulated pause time in ms
  const cachedGpxDataRef = useRef(null); // Cache GPX data to avoid re-fetching
  const activePoIRef = useRef(null); // Track active PoI for proper closure
  const poiHideTimeoutRef = useRef(null); // Track hide animation timeout
  const lastBearingRef = useRef(null); // Track last bearing for smooth rotation
  const elevationCanvasRef = useRef(null); // Canvas for elevation chart
  const elevationMarkerRef = useRef(null); // Marker for current position on chart
  const wakeLockRef = useRef(null); // Wake Lock for keeping screen awake
  
  // Points of Interest state
  const [poisData, setPoisData] = useState([]);
  const [isPoIHiding, setIsPoIHiding] = useState(false);
  
  // Helper to update activePoI (both state and ref)
  const updateActivePoI = (poi) => {
    // Clear any pending hide timeout
    if (poiHideTimeoutRef.current) {
      clearTimeout(poiHideTimeoutRef.current);
      poiHideTimeoutRef.current = null;
    }
    
    if (poi === null && activePoIRef.current !== null) {
      // Trigger hide animation
      setIsPoIHiding(true);
      // Wait for animation to complete before actually hiding
      poiHideTimeoutRef.current = setTimeout(() => {
        activePoIRef.current = null;
        setActivePoI(null);
        setIsPoIHiding(false);
      }, 300); // Match animation duration
    } else {
      // Show immediately
      setIsPoIHiding(false);
      activePoIRef.current = poi;
      setActivePoI(poi);
    }
  };

  // Get GPX data from route meta
  const gpxUrl = routeData?.meta?.gpx_url || '';
  const routeTitle = routeData?.title || 'Route';
  const mapboxToken = routeData?.mapbox_token || '';
  
  // Calculate route info (use GPX if available)
  const [gpxDistanceKm, setGpxDistanceKm] = useState(0);
  const routeDistanceKm = gpxDistanceKm > 0 ? gpxDistanceKm : (routeData?.meta?.distance_km || 0);
  const durationMinutes = routeDistanceKm > 0 && speed > 0 
    ? Math.round((routeDistanceKm / speed) * 60) 
    : 0;
  
  // Update refs when values change
  useEffect(() => {
    followModeRef.current = followMode;
  }, [followMode]);
  
  useEffect(() => {
    rotateWithDirectionRef.current = rotateWithDirection;
  }, [rotateWithDirection]);
  
  useEffect(() => {
    currentSpeedRef.current = speed;
  }, [speed]);
  
  // Debug: Log TVS_SETTINGS on mount only (runs once)
  useEffect(() => {
    if (isDebugMode) {
      console.log('🌍 window.TVS_SETTINGS:', window.TVS_SETTINGS);
      console.log('📦 window.TVS_SETTINGS.mapbox:', window.TVS_SETTINGS?.mapbox);
      console.log('📊 mapboxSettings object:', mapboxSettings);
      console.log('🔧 Mapbox Settings:', {
        hasSettings: !!window.TVS_SETTINGS?.mapbox,
        style: configMapStyle,
        initialZoom: configInitialZoom,
        pitch: configPitch,
        terrainEnabled: configTerrainEnabled,
        terrainExaggeration: configTerrainExaggeration,
        markerColor: configMarkerColor,
        routeColor: configRouteColor,
        routeWidth: configRouteWidth
      });
    }
  }, []); // Empty dependency array = runs only once on mount
  
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
  
  // Calculate bearing (direction) between two points
  function calculateBearing(lat1, lng1, lat2, lng2) {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
              Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng);
    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360; // Normalize to 0-360
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
  
  // Load GPX distance early (before map initialization)
  useEffect(() => {
    if (!routeId || cachedGpxDataRef.current) return; // Skip if already loaded
    
    (async () => {
      try {
        debugLog('📊 Pre-loading route distance for routeId:', routeId);
        const response = await fetch(`/wp-json/tvs/v1/routes/${routeId}/gpx-data`);
        
        if (!response.ok) {
          console.error('❌ Failed to pre-fetch GPX data:', response.status, response.statusText);
          return;
        }
        
        const gpxData = await response.json();
        
        if (!gpxData.points || gpxData.points.length === 0) {
          console.error('❌ No GPS points in GPX data');
          return;
        }
        
        // Cache the data
        cachedGpxDataRef.current = gpxData;
        
        // Calculate total distance
        let totalDist = 0;
        for (let i = 0; i < gpxData.points.length - 1; i++) {
          totalDist += haversineDistance(
            gpxData.points[i].lat, gpxData.points[i].lng,
            gpxData.points[i + 1].lat, gpxData.points[i + 1].lng
          );
        }
        debugLog('✅ Pre-calculated distance:', totalDist.toFixed(2), 'km');
        setGpxDistanceKm(totalDist);
      } catch (error) {
        console.error('❌ Failed to pre-load distance:', error);
      }
    })();
  }, [routeId]);
  
  // Load Points of Interest from API
  useEffect(() => {
    if (!routeId) return;
    
    debugLog('📍 Fetching PoI data...');
    
    (async () => {
      try {
        const response = await fetch(`/wp-json/tvs/v1/routes/${routeId}/pois`);
        
        if (!response.ok) {
          debugLog('⚠️ No PoI data available:', response.status);
          return;
        }
        
        const pois = await response.json();
        debugLog('✅ Loaded PoIs:', pois.length, 'items');
        
        // Transform API data to match expected format
        const transformedPois = pois.map(poi => ({
          id: poi.id,
          name: poi.name,
          description: poi.description || '',
          triggerDistanceMeters: poi.trigger_distance_m || 150,
          hideDistanceMeters: poi.hide_distance_m || 100,
          lng: poi.lng,
          lat: poi.lat,
          icon: poi.icon || '📍',
          color: poi.color || '#8b5cf6',
          imageUrl: poi.image_url || null,
          imageThumbnail: poi.image_thumbnail || null,
          customIconUrl: poi.custom_icon_url || null,
          iconType: poi.icon_type || 'library'
        }));
        
        setPoisData(transformedPois);
      } catch (error) {
        console.error('❌ Failed to load PoI data:', error);
      }
    })();
  }, [routeId]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (poiHideTimeoutRef.current) {
        clearTimeout(poiHideTimeoutRef.current);
      }
    };
  }, []);
  
  // Draw elevation chart
  useEffect(() => {
    if (!elevationCanvasRef.current || !cachedGpxDataRef.current?.points) {
      if (isDebugMode) {
        console.log('Elevation chart: missing canvas or GPX data', {
          hasCanvas: !!elevationCanvasRef.current,
          hasGpxData: !!cachedGpxDataRef.current,
          hasPoints: !!cachedGpxDataRef.current?.points
        });
      }
      return;
    }
    
    const canvas = elevationCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const points = cachedGpxDataRef.current.points;
    
    if (isDebugMode) {
      console.log('Drawing elevation chart with', points.length, 'points');
    }
    
    // Set canvas size
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Extract elevations
    const elevations = points.map(p => p.ele || 0).filter(e => e > 0);
    if (elevations.length === 0) {
      if (isDebugMode) {
        console.log('No elevation data found in GPX points');
      }
      return;
    }
    
    if (isDebugMode) {
      console.log('Elevation range:', Math.min(...elevations), '-', Math.max(...elevations));
    }
    
    const minEle = Math.min(...elevations);
    const maxEle = Math.max(...elevations);
    const eleRange = maxEle - minEle;
    
    if (eleRange === 0) {
      if (isDebugMode) {
        console.log('Elevation range is 0, cannot draw chart');
      }
      return;
    }
    
    // Draw elevation profile
    ctx.beginPath();
    ctx.strokeStyle = '#667eea';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(102, 126, 234, 0.2)';
    
    points.forEach((point, index) => {
      if (!point.ele) return;
      
      const x = (index / (points.length - 1)) * width;
      const y = height - ((point.ele - minEle) / eleRange) * height;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    // Fill area under curve
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();
    
    // Draw line
    ctx.beginPath();
    points.forEach((point, index) => {
      if (!point.ele) return;
      
      const x = (index / (points.length - 1)) * width;
      const y = height - ((point.ele - minEle) / eleRange) * height;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    
    if (isDebugMode) {
      console.log('Elevation chart drawn successfully');
    }
    
  }, [isWelcome]);
  
  // Load GPX data and initialize map
  useEffect(() => {
    // Only initialize when welcome screen is hidden
    if (isWelcome) return;
    
    if (!gpxUrl || !window.mapboxgl || !mapRef.current || !mapboxToken) {
      debugLog('⏳ Waiting for map initialization:', {
        gpxUrl: !!gpxUrl,
        mapboxgl: !!window.mapboxgl,
        mapRef: !!mapRef.current,
        mapboxToken: !!mapboxToken,
        isWelcome
      });
      return;
    }
    
    debugLog('🗺️ Initializing map...');
    
    (async () => {
      try {
        // Use cached GPX data if available, otherwise fetch
        let gpxData = cachedGpxDataRef.current;
        
        if (!gpxData) {
          debugLog('📥 Fetching GPX data from REST endpoint...');
          const response = await fetch(`/wp-json/tvs/v1/routes/${routeId}/gpx-data`);
          
          if (!response.ok) {
            console.error('❌ Failed to fetch GPX data:', response.status, response.statusText);
            showFlash('Failed to load route data. Please refresh the page.', 'error');
            return;
          }
          
          gpxData = await response.json();
          cachedGpxDataRef.current = gpxData;
        } else {
          debugLog('♻️ Using cached GPX data');
        }
        
        debugLog('📦 GPX data ready:', {
          points: gpxData.points?.length,
          first: gpxData.points?.[0],
          last: gpxData.points?.[gpxData.points?.length - 1],
          gpxUrl
        });
        
        if (!gpxData.points || gpxData.points.length === 0) {
          console.error('❌ No GPS points in GPX data');
          showFlash('No GPS data found for this route.', 'error');
          return;
        }

        // Ensure distance is calculated (should already be done in pre-load)
        if (gpxDistanceKm === 0) {
          let totalDist = 0;
          for (let i = 0; i < gpxData.points.length - 1; i++) {
            totalDist += haversineDistance(
              gpxData.points[i].lat, gpxData.points[i].lng,
              gpxData.points[i + 1].lat, gpxData.points[i + 1].lng
            );
          }
          debugLog('✅ Calculated distance during map init:', totalDist.toFixed(2), 'km');
          setGpxDistanceKm(totalDist);
        }
        
        // Initialize Mapbox with token from WordPress settings
        window.mapboxgl.accessToken = mapboxToken || configAccessToken;
        
        const map = new window.mapboxgl.Map({
          container: mapRef.current,
          style: configMapStyle,
          center: [gpxData.points[0].lng, gpxData.points[0].lat],
          zoom: configInitialZoom,
          pitch: configPitch,
          bearing: configBearing,
          minZoom: configMinZoom,
          maxZoom: configMaxZoom
        });
        
        mapInstanceRef.current = map;
        
        map.on('load', () => {
          debugLog('🛠️ Map loaded, attempting to create GSAP timeline...');
          
          // Enable 3D terrain if configured
          if (configTerrainEnabled) {
            debugLog('🏔️ Enabling 3D terrain with exaggeration:', configTerrainExaggeration);
            map.addSource('mapbox-dem', {
              type: 'raster-dem',
              url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
              tileSize: 512,
              maxzoom: 14
            });
            map.setTerrain({ 
              source: 'mapbox-dem', 
              exaggeration: configTerrainExaggeration 
            });
          }
          
          // Enable 3D buildings if configured
          if (configBuildings3dEnabled) {
            debugLog('🏢 Enabling 3D buildings');
            const layers = map.getStyle().layers;
            const labelLayerId = layers.find(
              layer => layer.type === 'symbol' && layer.layout['text-field']
            )?.id;
            
            map.addLayer({
              'id': '3d-buildings',
              'source': 'composite',
              'source-layer': 'building',
              'filter': ['==', 'extrude', 'true'],
              'type': 'fill-extrusion',
              'minzoom': 15,
              'paint': {
                'fill-extrusion-color': '#aaa',
                'fill-extrusion-height': ['get', 'height'],
                'fill-extrusion-base': ['get', 'min_height'],
                'fill-extrusion-opacity': 0.6
              }
            }, labelLayerId);
          }
          
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
              'line-color': configRouteColor,
              'line-width': configRouteWidth,
              'line-opacity': 1.0
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
              'line-color': '#84cc16', // --tvs-color-neon-lime (always green for completed)
              'line-width': configRouteWidth,
              'line-opacity': 1.0
            }
          });
          
          completedLineRef.current = 'completed-route-line';
          
          // Add marker
          const el = document.createElement('div');
          el.className = 'virtual-training-marker';
          el.style.width = '20px';
          el.style.height = '20px';
          el.style.borderRadius = '50%';
          el.style.backgroundColor = configMarkerColor;
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
            poiEl.style.backgroundColor = poi.color || '#8b5cf6';
            poiEl.style.border = '3px solid white';
            poiEl.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
            poiEl.style.display = 'flex';
            poiEl.style.alignItems = 'center';
            poiEl.style.justifyContent = 'center';
            poiEl.style.cursor = 'pointer';
            
            // Handle custom SVG icons
            if (poi.iconType === 'custom' && poi.customIconUrl) {
              poiEl.style.fontSize = '0';
              poiEl.style.padding = '6px';
              
              const img = document.createElement('img');
              img.src = poi.customIconUrl;
              img.style.width = '100%';
              img.style.height = '100%';
              img.style.objectFit = 'contain';
              img.style.filter = 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))';
              poiEl.appendChild(img);
            } else {
              // Use library icon (convert name to emoji)
              const emoji = ICON_LIBRARY[poi.icon] || poi.icon || '📍';
              poiEl.style.fontSize = '20px';
              poiEl.style.textShadow = '0 1px 2px rgba(0,0,0,0.3)';
              poiEl.innerHTML = emoji;
            }
            
            new window.mapboxgl.Marker(poiEl)
              .setLngLat([poi.lng, poi.lat])
              .addTo(map);
          });
          
          // Setup GSAP timeline
          if (window.gsap) {
            if (!gpxData.points || gpxData.points.length < 2) {
              console.warn('❌ Not enough route points for animation!');
            } else {
              debugLog('✅ Enough route points, initializing smooth timeline...', gpxData.points.length);
            }
            const durationSeconds = (gpxData.distance_km / speed) * 3600;
            debugLog('🕒 Timeline duration (s):', durationSeconds);
            
            // Build cumulative distance array for distance-based animation
            const cumulativeDistances = [0];
            for (let i = 1; i < gpxData.points.length; i++) {
              const segmentDist = haversineDistance(
                gpxData.points[i-1].lat, gpxData.points[i-1].lng,
                gpxData.points[i].lat, gpxData.points[i].lng
              );
              cumulativeDistances.push(cumulativeDistances[i-1] + segmentDist);
            }
            const totalDistance = cumulativeDistances[cumulativeDistances.length - 1];
            debugLog('📏 Total distance from points:', totalDistance.toFixed(3), 'km');
            
            // Interpoler smooth animasjon mellom punkter basert på AVSTAND
            const markerPos = { lng: gpxData.points[0].lng, lat: gpxData.points[0].lat };
            const cameraRotation = { bearing: 0 }; // Separate object for smooth bearing animation
            const timeline = window.gsap.timeline({
              paused: true,
              onUpdate: () => {
                // Calculate current distance based on timeline progress
                const currentDist = timeline.progress() * totalDistance;
                
                // Find which segment we're in based on cumulative distance
                let idx = 0;
                for (let i = 0; i < cumulativeDistances.length - 1; i++) {
                  if (currentDist >= cumulativeDistances[i] && currentDist <= cumulativeDistances[i + 1]) {
                    idx = i;
                    break;
                  }
                }
                
                // Calculate fraction within this segment based on distance
                let frac = 0;
                if (idx < cumulativeDistances.length - 1) {
                  const segmentStartDist = cumulativeDistances[idx];
                  const segmentEndDist = cumulativeDistances[idx + 1];
                  const segmentLength = segmentEndDist - segmentStartDist;
                  if (segmentLength > 0) {
                    frac = (currentDist - segmentStartDist) / segmentLength;
                  }
                }
                let lng, lat;
                if (idx < gpxData.points.length - 1) {
                  // Lineær interpolasjon mellom idx og idx+1
                  lng = gpxData.points[idx].lng + (gpxData.points[idx+1].lng - gpxData.points[idx].lng) * frac;
                  lat = gpxData.points[idx].lat + (gpxData.points[idx+1].lat - gpxData.points[idx].lat) * frac;
                } else {
                  lng = gpxData.points[gpxData.points.length-1].lng;
                  lat = gpxData.points[gpxData.points.length-1].lat;
                }
                if (markerRef.current) {
                  markerRef.current.setLngLat([lng, lat]);
                }
                
                // Calculate dynamic bearing from current position to look-ahead position
                if (rotateWithDirectionRef.current && idx < gpxData.points.length - 1) {
                  // Look ahead in distance (20 meters)
                  const lookAheadDistanceKm = 0.02; // 20 meters
                  const targetDist = Math.min(currentDist + lookAheadDistanceKm, totalDistance);
                  
                  // Find look-ahead position
                  let lookAheadIdx = idx;
                  for (let i = idx; i < cumulativeDistances.length - 1; i++) {
                    if (targetDist >= cumulativeDistances[i] && targetDist <= cumulativeDistances[i + 1]) {
                      lookAheadIdx = i;
                      break;
                    }
                  }
                  
                  let lookAheadFrac = 0;
                  if (lookAheadIdx < cumulativeDistances.length - 1) {
                    const segmentStartDist = cumulativeDistances[lookAheadIdx];
                    const segmentEndDist = cumulativeDistances[lookAheadIdx + 1];
                    const segmentLength = segmentEndDist - segmentStartDist;
                    if (segmentLength > 0) {
                      lookAheadFrac = (targetDist - segmentStartDist) / segmentLength;
                    }
                  }
                  
                  let lookAheadLng, lookAheadLat;
                  if (lookAheadIdx < gpxData.points.length - 1) {
                    lookAheadLng = gpxData.points[lookAheadIdx].lng + 
                      (gpxData.points[lookAheadIdx+1].lng - gpxData.points[lookAheadIdx].lng) * lookAheadFrac;
                    lookAheadLat = gpxData.points[lookAheadIdx].lat + 
                      (gpxData.points[lookAheadIdx+1].lat - gpxData.points[lookAheadIdx].lat) * lookAheadFrac;
                  } else {
                    lookAheadLng = gpxData.points[gpxData.points.length-1].lng;
                    lookAheadLat = gpxData.points[gpxData.points.length-1].lat;
                  }
                  
                  // Calculate bearing from current to look-ahead
                  let newBearing = calculateBearing(lat, lng, lookAheadLat, lookAheadLng);
                  
                  // Smooth bearing with wrapping prevention
                  if (lastBearingRef.current !== null) {
                    let diff = newBearing - lastBearingRef.current;
                    if (diff > 180) diff -= 360;
                    if (diff < -180) diff += 360;
                    newBearing = lastBearingRef.current + diff * 0.15; // Smooth interpolation
                  }
                  
                  cameraRotation.bearing = newBearing;
                  lastBearingRef.current = newBearing;
                }
                
                // Update camera if following
                if (followModeRef.current && mapInstanceRef.current) {
                  mapInstanceRef.current.jumpTo({ 
                    center: [lng, lat],
                    bearing: rotateWithDirectionRef.current ? cameraRotation.bearing : 0
                  });
                }
                // Update completed route line
                const completedCoords = gpxData.points.slice(0, idx + 1).map(p => [p.lng, p.lat]);
                completedCoords.push([lng, lat]);
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
                // Use the distance we already calculated
                setCurrentDistanceKm(currentDist);
                
                // Update elevation marker position directly (smooth animation)
                if (elevationMarkerRef.current && totalDistance > 0) {
                  const progress = (currentDist / totalDistance) * 100;
                  elevationMarkerRef.current.style.left = `${progress}%`;
                  if (isDebugMode && Math.random() < 0.01) { // Log occasionally in debug mode
                    console.log('Marker position:', progress.toFixed(2) + '%');
                  }
                }
                
                // Calculate elevation and gradient
                if (gpxData.points[idx]?.ele !== undefined) {
                  let ele = gpxData.points[idx].ele;
                  if (idx < gpxData.points.length - 1 && gpxData.points[idx+1]?.ele !== undefined) {
                    // Interpolate elevation
                    ele = gpxData.points[idx].ele + (gpxData.points[idx+1].ele - gpxData.points[idx].ele) * frac;
                  }
                  setCurrentElevation(Math.round(ele));
                  
                  // Calculate average gradient over next 200m (smoother for treadmill adjustment)
                  const gradientDistanceKm = 0.2; // 200 meters
                  const targetGradientDist = Math.min(currentDist + gradientDistanceKm, totalDistance);
                  
                  // Collect all elevation changes over the distance
                  let totalElevationChange = 0;
                  let samplesCount = 0;
                  
                  for (let i = idx; i < gpxData.points.length - 1; i++) {
                    const segmentStart = cumulativeDistances[i];
                    const segmentEnd = cumulativeDistances[i + 1];
                    
                    // Stop if we've passed target distance
                    if (segmentStart > targetGradientDist) break;
                    
                    // Include this segment if it's within our range
                    if (segmentEnd <= targetGradientDist && gpxData.points[i]?.ele !== undefined && gpxData.points[i+1]?.ele !== undefined) {
                      totalElevationChange += gpxData.points[i + 1].ele - gpxData.points[i].ele;
                      samplesCount++;
                    }
                  }
                  
                  if (samplesCount > 0) {
                    const horizontalDistance = (targetGradientDist - currentDist) * 1000; // Convert to meters
                    if (horizontalDistance > 0) {
                      const gradient = (totalElevationChange / horizontalDistance) * 100;
                      setCurrentGradient(Math.round(gradient)); // Round to whole number
                    }
                  }
                }
                
                // Calculate real elapsed time (wall clock time, not animation time)
                let realElapsedSeconds = 0;
                if (realStartTimeRef.current) {
                  const realElapsedMs = Date.now() - realStartTimeRef.current - totalPausedTimeRef.current;
                  realElapsedSeconds = realElapsedMs / 1000;
                  setElapsedTime(realElapsedSeconds);
                }
                
                // Calculate estimated total time based on remaining distance and current speed
                const remainingDistanceKm = totalDistance - currentDist;
                const currentSpeed = currentSpeedRef.current;
                if (currentSpeed > 0) {
                  const remainingTimeSeconds = (remainingDistanceKm / currentSpeed) * 3600;
                  const estimatedTotal = realElapsedSeconds + remainingTimeSeconds;
                  setEstimatedTotalTime(estimatedTotal);
                }
                
                // Check PoI proximity
                poisData.forEach(poi => {
                  const poiDistanceKm = calculateDistanceToPoint(poi.lng, poi.lat, gpxData.points, idx);
                  const triggerDistanceKm = (poi.triggerDistanceMeters || 150) / 1000;
                  const hideDistanceKm = (poi.hideDistanceMeters || 100) / 1000;
                  
                  const isInTriggerRange = currentDist >= (poiDistanceKm - triggerDistanceKm) && currentDist <= poiDistanceKm;
                  const isInHideRange = currentDist > poiDistanceKm && currentDist <= (poiDistanceKm + hideDistanceKm);
                  const isPastHideDistance = currentDist > (poiDistanceKm + hideDistanceKm);
                  
                  // Show when in range (approaching or passed but within hide distance)
                  if (isInTriggerRange || isInHideRange) {
                    if (activePoIRef.current?.id !== poi.id) {
                      debugLog('✅ Showing PoI:', poi.name, {
                        currentDist: currentDist.toFixed(2),
                        poiDist: poiDistanceKm.toFixed(2),
                        phase: isInTriggerRange ? 'approaching' : 'passed',
                        triggerRange: `${(poiDistanceKm - triggerDistanceKm).toFixed(2)} - ${poiDistanceKm.toFixed(2)}`,
                        hideRange: `${poiDistanceKm.toFixed(2)} - ${(poiDistanceKm + hideDistanceKm).toFixed(2)}`
                      });
                      updateActivePoI(poi);
                    }
                  }
                  // Hide when past hide distance
                  else if (activePoIRef.current?.id === poi.id && isPastHideDistance) {
                    debugLog('❌ Hiding PoI:', poi.name, {
                      currentDist: currentDist.toFixed(2),
                      poiDist: poiDistanceKm.toFixed(2),
                      hideThreshold: (poiDistanceKm + hideDistanceKm).toFixed(2)
                    });
                    updateActivePoI(null);
                  }
                });
              }
            });
            
            // Animate marker position
            timeline.to(markerPos, {
              lng: gpxData.points[gpxData.points.length-1].lng,
              lat: gpxData.points[gpxData.points.length-1].lat,
              duration: durationSeconds,
              ease: 'none'
            }, 0); // Start at time 0
            
            timelineRef.current = timeline;
            initialSpeedRef.current = speed; // Store initial speed for timeScale calculations
            debugLog('🎬 GSAP smooth timeline created:', { keyframes: 1 });
            debugLog('📍 timelineRef.current set:', !!timelineRef.current);
            debugLog('⚡ Initial speed stored:', speed);
          }
        });
        
      } catch (error) {
        console.error('❌ Failed to load GPX data:', error);
        showFlash('Error loading route data: ' + error.message, 'error');
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
  }, [gpxUrl, routeId, mapboxToken, isWelcome]); // Removed speed and followMode from dependencies
  
  // Control functions
  function startTraining() {
    debugLog('▶️ Start Training clicked');
    debugLog('  - Timeline exists:', !!timelineRef.current);
    debugLog('  - Map exists:', !!mapInstanceRef.current);
    debugLog('  - Marker exists:', !!markerRef.current);
    debugLog('  - GSAP available:', !!window.gsap);
    setIsWelcome(false);
    // Initialize estimated total time based on initial speed
    const initialEstimate = (routeDistanceKm / speed) * 3600;
    setEstimatedTotalTime(initialEstimate);
    
    // Trigger first play with flyTo animation
    setTimeout(() => {
      if (timelineRef.current) {
        togglePlay();
      }
    }, 100); // Small delay to ensure state is updated
  }
  
  function togglePlay() {
    if (!timelineRef.current) return;
    
    if (isPlaying) {
      // Pausing
      timelineRef.current.pause();
      pauseStartTimeRef.current = Date.now(); // Record when we paused
      releaseWakeLock(); // Release wake lock when pausing
      showFlash('Activity paused');
    } else {
      // Playing/Resuming
      requestWakeLock(); // Request wake lock when starting/resuming
      
      if (!realStartTimeRef.current) {
        // First play - start the clock and zoom animation
        realStartTimeRef.current = Date.now();
        totalPausedTimeRef.current = 0;
        showFlash('Activity started');
        
        // Smooth zoom in animation on first play
        debugLog('🎬 First play detected, preparing flyTo...');
        debugLog('  - Map instance:', !!mapInstanceRef.current);
        debugLog('  - Marker:', !!markerRef.current);
        debugLog('  - Timeline:', !!timelineRef.current);
        
        if (mapInstanceRef.current && markerRef.current && timelineRef.current) {
          const startCoords = markerRef.current.getLngLat();
          debugLog('✈️ Starting flyTo animation (2s):', { 
            lng: startCoords.lng, 
            lat: startCoords.lat, 
            zoom: configInitialZoom + 2, // Zoom in slightly from initial
            currentZoom: mapInstanceRef.current.getZoom()
          });
          
          // Pause timeline during flyTo to avoid conflict
          timelineRef.current.pause();
          
          mapInstanceRef.current.flyTo({
            center: [startCoords.lng, startCoords.lat],
            zoom: configFlyToZoom,
            pitch: configPitch,
            duration: 2000,
            essential: true
          });
          
          // Start timeline after flyTo completes (2000ms + small buffer)
          setTimeout(() => {
            if (timelineRef.current) {
              debugLog('▶️ Starting timeline after flyTo complete');
              timelineRef.current.play();
            }
          }, 2100);
        } else {
          console.warn('⚠️ Cannot execute flyTo - waiting for map/marker/timeline...');
          // Fallback: start timeline immediately if flyTo can't run
          if (timelineRef.current) {
            timelineRef.current.play();
          }
        }
      } else {
        // Resuming from pause or regular play (not first time)
        if (pauseStartTimeRef.current) {
          // Accumulate pause time
          const pauseDuration = Date.now() - pauseStartTimeRef.current;
          totalPausedTimeRef.current += pauseDuration;
          pauseStartTimeRef.current = null;
          showFlash('Activity resumed');
        }
        // Start timeline immediately (no flyTo for resume/subsequent plays)
        timelineRef.current.play();
      }
    }
    setIsPlaying(!isPlaying);
  }
  
  function restart() {
    if (!timelineRef.current) return;
    timelineRef.current.restart();
    setIsPlaying(true);
    setCurrentDistanceKm(0);
    setElapsedTime(0);
    updateActivePoI(null);
    // Reset real time tracking
    realStartTimeRef.current = Date.now();
    pauseStartTimeRef.current = null;
    totalPausedTimeRef.current = 0;
    // Reset estimated time based on current speed
    const initialEstimate = (routeDistanceKm / currentSpeedRef.current) * 3600;
    setEstimatedTotalTime(initialEstimate);
    showFlash('Activity restarted');
  }
  
  function zoomIn() {
    if (mapInstanceRef.current) {
      // Temporarily disable follow mode for zoom
      const wasFollowing = followModeRef.current;
      followModeRef.current = false;
      mapInstanceRef.current.zoomIn();
      // Re-enable after a short delay
      setTimeout(() => {
        followModeRef.current = wasFollowing;
      }, 100);
    }
  }
  
  function zoomOut() {
    if (mapInstanceRef.current) {
      // Temporarily disable follow mode for zoom
      const wasFollowing = followModeRef.current;
      followModeRef.current = false;
      mapInstanceRef.current.zoomOut();
      // Re-enable after a short delay
      setTimeout(() => {
        followModeRef.current = wasFollowing;
      }, 100);
    }
  }
  
  function increaseSpeed() {
    const newSpeed = Math.min(speed + 1, 50);
    setSpeed(newSpeed);
    // Update timeline timeScale if timeline exists and is created
    if (timelineRef.current && initialSpeedRef.current) {
      // Calculate timeScale relative to initial speed, not previous speed
      const timeScale = newSpeed / initialSpeedRef.current;
      timelineRef.current.timeScale(timeScale);
      debugLog(`⚡ Speed increased to ${newSpeed} km/h (timeScale: ${timeScale.toFixed(2)})`);
      showFlash(`Speed increased to ${newSpeed} km/h`, 'success');
    }
  }
  
  function decreaseSpeed() {
    const newSpeed = Math.max(speed - 1, 1);
    setSpeed(newSpeed);
    // Update timeline timeScale if timeline exists and is created
    if (timelineRef.current && initialSpeedRef.current) {
      // Calculate timeScale relative to initial speed, not previous speed
      const timeScale = newSpeed / initialSpeedRef.current;
      timelineRef.current.timeScale(timeScale);
      debugLog(`⚡ Speed decreased to ${newSpeed} km/h (timeScale: ${timeScale.toFixed(2)})`);
      showFlash(`Speed decreased to ${newSpeed} km/h`, 'warning');
    }
  }
  
  function toggleRouteLine() {
    if (!mapInstanceRef.current || !fullLineRef.current) return;
    
    const newVisibility = showRouteLine ? 'none' : 'visible';
    mapInstanceRef.current.setLayoutProperty('route-line', 'visibility', newVisibility);
    setShowRouteLine(!showRouteLine);
  }
  
  function openSaveModal() {
    // Pre-fill with app values as defaults
    setActualDistance(currentDistanceKm.toFixed(3)); // 3 decimals for precision
    // Format time as MM:SS or H:MM:SS
    const totalSeconds = Math.round(elapsedTime);
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    // Use H:MM:SS if over 1 hour, otherwise MM:SS
    if (hours > 0) {
      setActualTime(`${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    } else {
      setActualTime(`${mins}:${secs.toString().padStart(2, '0')}`);
    }
    
    setShowSaveModal(true);
    // Pause if playing
    if (isPlaying && timelineRef.current) {
      timelineRef.current.pause();
      pauseStartTimeRef.current = Date.now();
      setIsPlaying(false);
    }
  }
  
  async function saveActivity() {
    if (!actualDistance || !actualTime) {
      showFlash('Please enter both distance and time', 'error');
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Parse distance (supports decimals like 8.234 km)
      const distanceM = parseFloat(actualDistance) * 1000; // Convert km to meters
      
      // Parse time (supports H:MM:SS, MM:SS format or just seconds)
      let durationS;
      if (actualTime.includes(':')) {
        const parts = actualTime.split(':').map(s => parseInt(s.trim()) || 0);
        if (parts.length === 3) {
          // H:MM:SS format
          const [hours, mins, secs] = parts;
          durationS = hours * 3600 + mins * 60 + secs;
        } else if (parts.length === 2) {
          // MM:SS format
          const [mins, secs] = parts;
          durationS = mins * 60 + secs;
        } else {
          // Invalid format
          durationS = 0;
        }
      } else {
        // If just a number, treat as total seconds
        durationS = parseInt(actualTime) || 0;
      }
      
      if (distanceM <= 0 || durationS <= 0) {
        showFlash('Distance and time must be greater than zero', 'error');
        setIsSaving(false);
        return;
      }
      
      const now = new Date().toISOString();
      
      const payload = {
        route_id: routeId,
        route_name: routeTitle,
        activity_date: now,
        started_at: now,
        ended_at: now,
        duration_s: durationS,
        distance_m: distanceM,
        visibility: 'private',
        activity_type: activityType,
        is_virtual: true, // Mark as virtual for Strava sync
        source: 'virtual' // Virtual route training
      };
      
      // Add notes and rating if provided
      if (activityNotes) {
        payload.notes = activityNotes;
      }
      if (activityRating > 0) {
        payload.rating = activityRating;
      }
      
      const response = await fetch('/wp-json/tvs/v1/activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': window.TVS_SETTINGS?.nonce || ''
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to save activity');
      }
      
      const result = await response.json();
      debugLog('✅ Activity saved:', result);
      
      // Close modal and reset training
      setShowSaveModal(false);
      setIsSaving(false);
      
      // Reset everything
      if (timelineRef.current) {
        timelineRef.current.pause();
        timelineRef.current.progress(0);
      }
      setIsWelcome(true);
      setIsPlaying(false);
      releaseWakeLock(); // Release wake lock after saving
      setCurrentDistanceKm(0);
      setElapsedTime(0);
      setEstimatedTotalTime(0);
      updateActivePoI(null);
      realStartTimeRef.current = null;
      pauseStartTimeRef.current = null;
      totalPausedTimeRef.current = 0;
      
      showFlash('Activity saved successfully! 🎉', 'success');
      
      // Notify My Activities widget to refresh
      window.dispatchEvent(new CustomEvent('tvs:activity-updated'));
      
    } catch (error) {
      console.error('Failed to save activity:', error);
      showFlash('Failed to save activity: ' + (error?.message || 'Unknown error'), 'error');
      setIsSaving(false);
    }
  }
  
  function toggleFullscreen() {
    const container = document.querySelector('.tvs-virtual-training');
    if (!container) return;
    
    if (!isFullscreen) {
      if (container.requestFullscreen) {
        container.requestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  }
  
  // Listen for fullscreen changes
  useEffect(() => {
    function handleFullscreenChange() {
      const newFullscreenState = !!document.fullscreenElement;
      setIsFullscreen(newFullscreenState);
      
      // Force map resize after fullscreen change
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.resize();
        }
      }, 100);
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);
  
  // Trigger map resize when isFullscreen changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      // Multiple resize attempts to ensure it takes effect
      setTimeout(() => mapInstanceRef.current.resize(), 50);
      setTimeout(() => mapInstanceRef.current.resize(), 150);
      setTimeout(() => mapInstanceRef.current.resize(), 300);
    }
  }, [isFullscreen]);
  
  // Keyboard shortcut for fullscreen (F key)
  useEffect(() => {
    function handleKeyPress(e) {
      if (e.key === 'f' || e.key === 'F') {
        if (!isWelcome) {
          toggleFullscreen();
        }
      }
    }
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isWelcome, isFullscreen]);
  
  // Wake Lock helpers
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        if (DEBUG) log('Wake Lock activated');
      }
    } catch (err) {
      if (DEBUG) log('Wake Lock error:', err);
    }
  };

  const releaseWakeLock = async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        if (DEBUG) log('Wake Lock released');
      }
    } catch (err) {
      if (DEBUG) log('Wake Lock release error:', err);
    }
  };
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      releaseWakeLock();
    };
  }, []);
  
  // Format time helper
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  
  // Welcome screen
  if (isWelcome) {
    // Show error if Mapbox token is missing
    if (!mapboxToken) {
      return h('div', { className: 'tvs-virtual-training tvs-virtual-training--welcome' },
        h('div', { className: 'virtual-training-welcome' },
          h('h2', null, '⚠️ Configuration Required'),
          h('p', { style: { color: '#e53e3e', marginBottom: '1rem' } }, 
            'Mapbox access token is missing. Please configure it in TVS Settings.'
          ),
          h('p', null,
            'Administrators: Go to TVS → Settings and add your Mapbox token.'
          )
        )
      );
    }

    return h('div', { className: 'tvs-virtual-training tvs-virtual-training--welcome' },
      h('div', { className: 'tvs-panel tvs-welcome-panel' },
        h('h2', { className: 'tvs-welcome-title' }, routeTitle),
        
        // Route info cards
        h('div', { className: 'tvs-welcome-stats' },
          h('div', { className: 'tvs-stat-card' },
            h('span', { className: 'tvs-stat-label' }, 'Distance'),
            h('span', { className: 'tvs-stat-value' }, 
              routeDistanceKm > 0 ? `${routeDistanceKm.toFixed(2)} km` : 'Loading...'
            )
          ),
          h('div', { className: 'tvs-stat-card' },
            h('span', { className: 'tvs-stat-label' }, 'Est. Duration'),
            h('span', { className: 'tvs-stat-value' }, 
              durationMinutes > 0 ? `${durationMinutes} min` : '--'
            )
          )
        ),
        
        // Speed input with better styling
        h('div', { className: 'tvs-speed-section' },
          h('label', { className: 'tvs-speed-label' }, 
            h('span', { className: 'tvs-speed-title' }, 'Set your initial speed'),
            h('span', { className: 'tvs-speed-hint' }, 'You can increase/decrease during the activity according to your treadmill speed')
          ),
          h('div', { className: 'tvs-speed-input-group' },
            h('input', {
              type: 'number',
              className: 'tvs-input tvs-speed-input',
              value: speed,
              onChange: (e) => setSpeed(Number(e.target.value) || 12),
              min: 1,
              max: 50,
              step: 0.5
            }),
            h('span', { className: 'tvs-speed-unit' }, 'km/h')
          )
        ),
        
        h('button', {
          className: 'tvs-btn tvs-btn--primary tvs-welcome-btn',
          onClick: startTraining,
          disabled: routeDistanceKm <= 0
        }, routeDistanceKm > 0 ? 'Start Training' : 'Loading route data...')
      )
    );
  }
  
  // Training screen
  return h('div', { className: `tvs-virtual-training ${isFullscreen ? 'tvs-virtual-training--fullscreen' : ''}` },
    // Map container (full bleed only in fullscreen)
    h('div', {
      ref: mapRef,
      className: 'virtual-training-map',
      style: { 
        width: isFullscreen ? '100vw' : '100%', 
        height: isFullscreen ? '100vh' : '70vh',
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? 0 : 'auto',
        left: isFullscreen ? 0 : 'auto',
        zIndex: isFullscreen ? 1 : 'auto'
      }
    }),

    // Stats overlay with minimize toggle
    h('div', { 
      className: `training-stats ${statsMinimized ? 'training-stats--minimized' : ''}`,
      onClick: () => setStatsMinimized(!statsMinimized), // Toggle on click
      title: statsMinimized ? 'Click to expand' : 'Click to minimize'
    },
      // Minimize indicator icon
      h('div', { className: 'stats-toggle-icon' },
        h(statsMinimized ? RiArrowDownSLine : RiArrowUpSLine, { size: 16 })
      ),
      
      // Minimized view: Only Distance and Time
      statsMinimized ? [
        h('div', { key: 'distance', className: 'stat-item' },
          h('span', { className: 'stat-label' }, 'Distance'),
          h('span', { className: 'stat-value' }, `${
            isWelcome ? '0.00' : currentDistanceKm.toFixed(2)
          }/${routeDistanceKm.toFixed(2)} km`)
        ),
        h('div', { key: 'time', className: 'stat-item' },
          h('span', { className: 'stat-label' }, 'Time'),
          h('span', { className: 'stat-value' }, `${
            isWelcome ? '0:00' : formatTime(elapsedTime)
          }/${isWelcome ? formatTime(durationMinutes * 60) : formatTime(estimatedTotalTime)}`)
        )
      ] : [
        // Full view: All stats + elevation chart
        h('div', { key: 'distance', className: 'stat-item' },
          h('span', { className: 'stat-label' }, 'Distance'),
          h('span', { className: 'stat-value' }, `${
            isWelcome ? '0.00' : currentDistanceKm.toFixed(2)
          } / ${routeDistanceKm.toFixed(2)} km`)
        ),
        h('div', { key: 'time', className: 'stat-item' },
          h('span', { className: 'stat-label' }, 'Time'),
          h('span', { className: 'stat-value' }, `${
            isWelcome ? '0:00' : formatTime(elapsedTime)
          } / ${isWelcome ? formatTime(durationMinutes * 60) : formatTime(estimatedTotalTime)}`)
        ),
        h('div', { key: 'speed', className: 'stat-item' },
          h('span', { className: 'stat-label' }, 'Speed'),
          h('span', { className: 'stat-value' }, `${speed} km/h`)
        ),
        h('div', { key: 'elevation', className: 'stat-item' },
          h('span', { className: 'stat-label' }, 'Elevation'),
          h('span', { className: 'stat-value' }, `${currentElevation} m`)
        ),
        h('div', { key: 'gradient', className: 'stat-item' },
          h('span', { className: 'stat-label' }, 'Gradient'),
          h('span', { 
            className: 'stat-value',
            style: { 
              color: currentGradient > 0 ? '#f56565' : currentGradient < 0 ? '#48bb78' : 'white'
            }
          }, `${currentGradient > 0 ? '+' : ''}${currentGradient}%`)
        ),
        
        // Elevation chart
        h('div', { key: 'chart', className: 'elevation-chart-container' },
          h('canvas', {
            ref: elevationCanvasRef,
            className: 'elevation-chart',
            width: 300,
            height: 80
          }),
          h('div', {
            ref: elevationMarkerRef,
            className: 'elevation-marker',
            style: {
              left: '0%'
            }
          })
        )
      ]
    ),

    // Overlay: Push play to start
    (!isPlaying && !isWelcome) ? h('div', { 
      className: 'training-overlay-start',
      onClick: togglePlay
    },
      h('div', { className: 'overlay-content' },
        h('button', { 
          className: 'overlay-play-btn',
          onClick: togglePlay
        }, h(RiPlayCircleLine, { size: 64 })),
        h('div', { style: { fontSize: 20, fontWeight: 600, marginTop: 16 } }, 'Push play to start')
      )
    ) : null,
    
    // PoI popup
    activePoI ? h('div', { 
      className: `poi-popup tvs-panel tvs-panel--elevated${isPoIHiding ? ' poi-popup--hiding' : ''}` 
    },
      activePoI.imageThumbnail ? h('div', { className: 'poi-image' },
        h('img', { src: activePoI.imageThumbnail, alt: activePoI.name })
      ) : null,
      h('div', { className: 'poi-content' },
        h('div', { className: 'poi-header' },
          (activePoI.iconType === 'custom' && activePoI.customIconUrl)
            ? h('div', { 
                className: 'poi-icon poi-icon-custom',
                style: { backgroundColor: activePoI.color || '#8b5cf6' }
              },
                h('img', { src: activePoI.customIconUrl, alt: 'Icon', style: { width: '100%', height: '100%', objectFit: 'contain', filter: 'brightness(0) invert(1)' } })
              )
            : h('div', { 
                className: 'poi-icon',
                style: { backgroundColor: activePoI.color || '#8b5cf6' }
              }, ICON_LIBRARY[activePoI.icon] || activePoI.icon || '📍'),
          h('h3', { className: 'poi-title' }, activePoI.name)
        ),
        activePoI.description ? h('p', { className: 'poi-description' }, activePoI.description) : null
      )
    ) : null,
    
    // Controls with show/hide toggle
    h('div', { 
      className: `training-controls ${controlsHidden ? 'training-controls--hidden' : ''}` 
    },
      // 1. Play / pause
      h('button', {
        className: 'control-btn',
        onClick: togglePlay,
        title: isPlaying ? 'Pause' : 'Play'
      }, h(isPlaying ? RiPauseCircleLine : RiPlayCircleLine, { size: 24 })),
      
      // 2. Minus speed
      h('button', {
        className: 'control-btn',
        onClick: decreaseSpeed,
        title: 'Decrease Speed'
      }, h(RiSubtractLine, { size: 24 })),
      
      // 3. Plus speed
      h('button', {
        className: 'control-btn',
        onClick: increaseSpeed,
        title: 'Increase Speed'
      }, h(RiAddLine, { size: 24 })),
      
      // 4. Zoom out
      h('button', {
        className: 'control-btn',
        onClick: zoomOut,
        title: 'Zoom Out'
      }, h(RiZoomOutLine, { size: 24 })),
      
      // 5. Zoom in
      h('button', {
        className: 'control-btn',
        onClick: zoomIn,
        title: 'Zoom In'
      }, h(RiZoomInLine, { size: 24 })),
      
      // 6. Camera follow
      h('button', {
        className: `control-btn ${followMode ? 'active' : ''}`,
        onClick: () => setFollowMode(!followMode),
        title: followMode ? 'Camera Follow On' : 'Camera Follow Off'
      }, h(followMode ? RiVideoOnLine : RiVideoOffLine, { size: 24 })),
      
      // 7. Compass mode
      h('button', {
        className: `control-btn ${rotateWithDirection ? 'active' : ''}`,
        onClick: () => setRotateWithDirection(!rotateWithDirection),
        title: rotateWithDirection ? 'Compass Mode On' : 'Compass Mode Off',
        disabled: !followMode
      }, h(rotateWithDirection ? RiCompass3Fill : RiCompassLine, { size: 24 })),
      
      // 8. Hide route line
      h('button', {
        className: `control-btn ${showRouteLine ? 'active' : ''}`,
        onClick: toggleRouteLine,
        title: showRouteLine ? 'Hide Route Line' : 'Show Route Line'
      }, h(FaRoute, { size: 20 })),
      
      // 9. Restart
      h('button', {
        className: 'control-btn',
        onClick: restart,
        title: 'Restart'
      }, h(RiRestartLine, { size: 24 })),
      
      // 10. Save activity
      h('button', {
        className: 'control-btn save-btn',
        onClick: openSaveModal,
        title: 'Save Activity',
        disabled: isWelcome || currentDistanceKm < 0.1
      }, h(AiOutlineSave, { size: 24 })),
      
      // 11. Full screen
      h('button', {
        className: 'control-btn',
        onClick: toggleFullscreen,
        title: isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'
      }, h(isFullscreen ? RiFullscreenExitLine : RiFullscreenLine, { size: 24 }))
    ),
    
    // Controls toggle button (when hidden) - only show after welcome
    !isWelcome && controlsHidden ? h('div', {
      className: 'controls-toggle-btn',
      onClick: () => setControlsHidden(false),
      title: 'Show Controls'
    }, h(RiArrowUpSLine, { size: 28 })) : null,
    
    // Hide controls button (when visible) - only show after welcome
    !isWelcome && !controlsHidden ? h('div', {
      className: 'controls-hide-btn',
      onClick: () => setControlsHidden(true),
      title: 'Hide Controls'
    }, h(RiArrowDownSLine, { size: 20 })) : null,
    
    // Save Activity Modal
    showSaveModal ? h('div', { className: 'save-modal-overlay', onClick: () => setShowSaveModal(false) },
      h('div', { className: 'save-modal', onClick: (e) => e.stopPropagation() },
        h('h3', null, '💾 Save Activity'),
        h('p', null, `Enter actual data from your ${activityType === 'Ride' ? 'bike/trainer' : 'treadmill'}:`),
        
        // Activity Type Selector
        h('div', { className: 'modal-field' },
          h('label', null, 'Activity Type'),
          h('div', { className: 'activity-type-selector', style: { display: 'flex', gap: '8px', marginTop: '8px' } },
            ['Walk', 'Run', 'Ride'].map(type => 
              h('button', {
                key: type,
                type: 'button',
                className: `activity-type-btn ${activityType === type ? 'active' : ''}`,
                onClick: () => setActivityType(type),
                style: {
                  flex: 1,
                  padding: '12px',
                  border: activityType === type ? '2px solid #3b82f6' : '2px solid #e5e7eb',
                  borderRadius: '8px',
                  background: activityType === type ? '#eff6ff' : 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.2s'
                }
              }, [
                h('span', { key: 'icon', style: { fontSize: '24px' } }, 
                  type === 'Walk' ? '🚶' : type === 'Run' ? '🏃' : '🚴'
                ),
                h('span', { key: 'label', style: { fontSize: '14px', fontWeight: activityType === type ? '600' : '400' } }, type)
              ])
            )
          )
        ),
        
        // Distance and Time in one row
        h('div', { className: 'modal-fields-row' },
          h('div', { className: 'modal-field' },
            h('label', null, 'Distance (km)'),
            h('input', {
              type: 'text',
              value: actualDistance,
              onChange: (e) => setActualDistance(e.target.value),
              placeholder: '8.234'
            }),
            h('small', null, 'e.g., 8.234 km')
          ),
          
          h('div', { className: 'modal-field' },
            h('label', null, 'Time'),
            h('input', {
              type: 'text',
              value: actualTime,
              onChange: (e) => setActualTime(e.target.value),
              placeholder: '1:23:45'
            }),
            h('small', null, 'H:MM:SS or MM:SS')
          )
        ),
        
        // Notes field
        h('div', { className: 'modal-field' },
          h('label', null, 'Notes (optional)'),
          h('textarea', {
            value: activityNotes,
            onChange: (e) => setActivityNotes(e.target.value),
            placeholder: 'How did the activity feel? Any observations?',
            rows: 2
          })
        ),
        
        // Rating field
        h('div', { className: 'modal-field' },
          h('label', null, 'Rate Your Activity (1-10, optional)'),
          h('div', { className: 'tvs-rating-scale' },
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(rating => 
              h('button', {
                key: rating,
                type: 'button',
                onClick: () => setActivityRating(rating),
                className: `tvs-rating-btn ${activityRating === rating ? 'tvs-rating-btn--active' : ''}`
              }, rating)
            )
          ),
          activityRating > 0 ? h('div', { className: 'tvs-rating-label' },
            activityRating <= 3 ? 'Challenging' : activityRating <= 6 ? 'Moderate' : activityRating <= 8 ? 'Good' : 'Excellent'
          ) : null
        ),
        
        h('div', { className: 'modal-buttons' },
          h('button', {
            className: 'btn-secondary',
            onClick: () => setShowSaveModal(false),
            disabled: isSaving
          }, 'Cancel'),
          
          h('button', {
            className: 'btn-primary',
            onClick: saveActivity,
            disabled: isSaving
          }, isSaving ? 'Saving...' : 'Save Activity')
        )
      )
    ) : null
  );
}

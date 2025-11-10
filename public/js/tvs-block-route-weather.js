/**
 * TVS Route Weather Block - Frontend async loader
 */
console.log('[TVS Weather] Script loaded!', typeof TVS_SETTINGS);

(function() {
    'use strict';

    // Helper function to escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function initWeatherBlock(container) {
        const routeId = container.dataset.routeId;
        const title = container.dataset.title || 'Weather Conditions';
        const date = container.dataset.date || '';
        const time = container.dataset.time || '12:00';
        const lat = container.dataset.lat || '0';
        const lng = container.dataset.lng || '0';
        const maxDistance = container.dataset.maxDistance || '50';
        const debug = container.dataset.debug === '1';

        console.log('[TVS Weather] Init:', { routeId, title, maxDistance });

        // Build API URL
        const params = new URLSearchParams();
        if (date) params.append('date', date);
        if (time) params.append('time', time);
        if (lat !== '0') params.append('lat', lat);
        if (lng !== '0') params.append('lng', lng);
        if (maxDistance) params.append('maxDistance', maxDistance);

        const apiUrl = `${TVS_SETTINGS.restRoot}tvs/v1/routes/${routeId}/weather?${params.toString()}`;

        if (debug) {
            console.log('[TVS Weather] Fetching:', apiUrl);
        }

        // Fetch weather data
        fetch(apiUrl, {
            headers: {
                'X-WP-Nonce': TVS_SETTINGS.nonce
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response.json();
        })
        .then(result => {
            if (debug) {
                console.log('[TVS Weather] Response:', result);
            }

            if (!result.data) {
                throw new Error('No weather data in response');
            }

            renderWeather(container, result.data, debug, title);
        })
        .catch(error => {
            console.error('[TVS Weather] Error:', error);
            renderError(container, error.message, title);
        });
    }

    function renderWeather(container, weather, debug, title) {
        // Use title from container if not passed (for backwards compatibility)
        if (!title) {
            title = container.dataset.title || 'Weather Conditions';
        }
        
        console.log('[TVS Weather] Rendering with title:', title);
        
        const temp = weather.temperature !== null ? Math.round(weather.temperature * 10) / 10 : null;
        const windSpeed = weather.wind_speed !== null ? Math.round(weather.wind_speed * 10) / 10 : null;
        const windDir = weather.wind_direction !== null ? parseInt(weather.wind_direction) : null;
        const humidity = weather.humidity !== null ? Math.round(weather.humidity) : null;
        const weatherCode = weather.weather_code !== null ? parseInt(weather.weather_code) : null;

        // Get weather info
        const weatherInfo = weatherCode !== null ? getWeatherInfo(weatherCode) : null;

        let html = '';

        // Title
        if (title) {
            html += `<h3 class="tvs-weather-title">${escapeHtml(title)}</h3>`;
        }

        // Debug info
        if (debug) {
            html += `
                <details style="margin-bottom: 16px; padding: 12px; background: #f0f0f0; border-radius: 4px;">
                    <summary style="cursor: pointer; font-weight: 600;">🐛 Debug Info</summary>
                    <pre style="margin-top: 8px; font-size: 11px; overflow: auto;">${escapeHtml(JSON.stringify(weather, null, 2))}</pre>
                </details>
            `;
        }

        // Weather condition
        if (weatherInfo) {
            const iconUrl = `${TVS_SETTINGS.pluginUrl}/assets/weather-icons/${weatherInfo.icon}`;
            html += `
                <div class="tvs-weather-condition">
                    <img src="${escapeHtml(iconUrl)}" 
                         alt="${escapeHtml(weatherInfo.text)}" 
                         class="tvs-weather-icon-svg"
                         width="56" 
                         height="56">
                    <div class="tvs-weather-condition-text">
                        <span class="tvs-weather-text">${escapeHtml(weatherInfo.text)}</span>
                        ${weather.weather_code_station ? `
                            <span class="tvs-weather-source">
                                Conditions from ${escapeHtml(weather.weather_code_station)} (${weather.weather_code_distance_km} km)
                            </span>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        // Temperature and wind
        html += '<div class="tvs-weather-card">';
        
        if (temp !== null) {
            html += `
                <div class="tvs-weather-item tvs-weather-temp">
                    <svg class="tvs-weather-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>
                    </svg>
                    <span class="tvs-weather-value">${temp}°C</span>
                </div>
            `;
        }

        if (windSpeed !== null) {
            html += `
                <div class="tvs-weather-item tvs-weather-wind">
                    <svg class="tvs-weather-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/>
                    </svg>
                    <span class="tvs-weather-value">${windSpeed} m/s</span>
                    ${windDir !== null ? `<span class="tvs-weather-dir" style="transform: rotate(${windDir}deg)">↓</span>` : ''}
                </div>
            `;
        }

        html += '</div>';

        // Station info
        if (weather.nearest_station_name && weather.reference_time) {
            const dt = new Date(weather.reference_time);
            const formattedDate = dt.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const formattedTime = dt.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
            
            html += `
                <p class="tvs-weather-station">
                    Temperature from <strong>${escapeHtml(weather.temperature_source || weather.nearest_station_name)}</strong> 
                    (${weather.temperature_distance_km || weather.nearest_distance_km} km) 
                    at ${formattedDate} ${formattedTime}
                </p>
            `;
        }

        // Credit
        html += `
            <p class="tvs-weather-credit">
                <small>Weather data by <a href="https://yr.no" target="_blank" rel="noopener">yr.no</a></small>
            </p>
        `;

        console.log('[TVS Weather] Final HTML length:', html.length, 'First 200 chars:', html.substring(0, 200));
        
        container.innerHTML = html;
        container.classList.remove('tvs-weather-loading');
    }

    function renderError(container, message, title) {
        if (!title) {
            title = container.dataset.title || 'Weather Conditions';
        }
        
        let html = '';
        if (title) {
            html += `<h3 class="tvs-weather-title">${escapeHtml(title)}</h3>`;
        }
        
        html += `
            <div class="tvs-notice tvs-notice--error">
                <p><strong>Failed to load weather data:</strong> ${escapeHtml(message)}</p>
            </div>
        `;
        
        container.innerHTML = html;
        container.classList.remove('tvs-weather-loading');
    }

    function getWeatherInfo(code) {
        // Simplified weather code mapping (matches PHP helper)
        const weatherMap = {
            0: { text: 'Clear sky', icon: 'clearsky_day.svg' },
            1: { text: 'Fair', icon: 'fair_day.svg' },
            2: { text: 'Fair', icon: 'fair_day.svg' },
            3: { text: 'Partly cloudy', icon: 'partlycloudy_day.svg' },
            4: { text: 'Partly cloudy', icon: 'partlycloudy_day.svg' },
            5: { text: 'Haze', icon: 'fog.svg' },
            10: { text: 'Mist', icon: 'fog.svg' },
            11: { text: 'Mist', icon: 'fog.svg' },
            12: { text: 'Mist', icon: 'fog.svg' },
            15: { text: 'Fog', icon: 'fog.svg' },
            20: { text: 'Recent rain', icon: 'lightrain.svg' },
            25: { text: 'Recent rain', icon: 'lightrain.svg' },
            26: { text: 'Recent snow', icon: 'lightsnow.svg' },
            40: { text: 'Fog', icon: 'fog.svg' },
            50: { text: 'Light drizzle', icon: 'lightrain.svg' },
            51: { text: 'Light drizzle', icon: 'lightrain.svg' },
            53: { text: 'Drizzle', icon: 'rain.svg' },
            55: { text: 'Drizzle', icon: 'rain.svg' },
            56: { text: 'Freezing drizzle', icon: 'rain.svg' },
            60: { text: 'Light rain', icon: 'lightrain.svg' },
            61: { text: 'Light rain', icon: 'lightrain.svg' },
            63: { text: 'Rain', icon: 'rain.svg' },
            65: { text: 'Rain', icon: 'rain.svg' },
            66: { text: 'Freezing rain', icon: 'rain.svg' },
            70: { text: 'Light snow', icon: 'lightsnow.svg' },
            71: { text: 'Light snow', icon: 'lightsnow.svg' },
            73: { text: 'Snow', icon: 'snow.svg' },
            75: { text: 'Snow', icon: 'snow.svg' },
            77: { text: 'Snow grains', icon: 'heavysnow.svg' },
            80: { text: 'Rain showers', icon: 'lightrain.svg' },
            81: { text: 'Rain showers', icon: 'lightrain.svg' },
            83: { text: 'Sleet showers', icon: 'lightsnow.svg' },
            85: { text: 'Sleet showers', icon: 'lightsnow.svg' },
            86: { text: 'Snow showers', icon: 'snow.svg' },
            90: { text: 'Thunderstorm', icon: 'lightrainandthunder.svg' },
            95: { text: 'Thunderstorm', icon: 'lightrainandthunder.svg' },
            96: { text: 'Thunderstorm with hail', icon: 'rainandthunder.svg' },
            99: { text: 'Heavy thunderstorm', icon: 'rainandthunder.svg' }
        };

        return weatherMap[code] || { text: 'Unknown', icon: 'cloudy.svg' };
    }

    // Initialize all weather blocks on page load
    function init() {
        const blocks = document.querySelectorAll('.tvs-route-weather[data-route-id]');
        blocks.forEach(block => {
            if (!block.classList.contains('tvs-weather-initialized')) {
                block.classList.add('tvs-weather-initialized');
                initWeatherBlock(block);
            }
        });
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Re-run when new blocks are added (for dynamic content)
    if (window.MutationObserver) {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === 1) {
                        const blocks = node.querySelectorAll ? node.querySelectorAll('.tvs-route-weather[data-route-id]') : [];
                        blocks.forEach(block => {
                            if (!block.classList.contains('tvs-weather-initialized')) {
                                block.classList.add('tvs-weather-initialized');
                                initWeatherBlock(block);
                            }
                        });
                    }
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
})();

import { mountReact, React } from './utils/reactMount.js';
import { DEBUG, log } from './utils/debug.js';
import App from './app.js';
// Note: MyActivitiesStandalone is now mounted by a dedicated block script.

// Enable dev overlay via backtick by setting a flag and reloading when not already in debug
if (!DEBUG) {
  document.addEventListener('keydown', (ev) => {
    if (ev.key === '`') {
      try {
        localStorage.setItem('tvsDev', '1');
      } catch (_) {}
      location.reload();
    }
  });
}

function boot() {
  const mount = document.getElementById('tvs-app-root');
  if (mount) {
    const inline = window.tvs_route_payload || null;
    const routeId = mount.getAttribute('data-route-id') || (inline && inline.id);
    log('🚀 Boot Debug:');
    log('  - Mount element:', !!mount);
    log('  - Route ID:', routeId);
    log('  - window.tvs_route_payload:', window.tvs_route_payload);
    log('  - Inline payload:', inline);
    log('Boot → routeId:', routeId, 'inline payload:', !!inline);
    mountReact(App, { initialData: inline, routeId }, mount);
  }

  // My Activities blocks are mounted by the block-specific bundle
}

// Toggle tvsdebug URL via backtick when not already in debug mode
if (DEBUG) {
  log('Debug mode enabled.');
} else {
  document.addEventListener('keydown', function (ev) {
    if (ev.key === '`') {
      const url = new URL(location.href);
      url.searchParams.set('tvsdebug', '1');
      location.href = url.toString();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

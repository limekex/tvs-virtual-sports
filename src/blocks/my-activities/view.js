import { mountReact, React } from '../../utils/reactMount.js';
import { DEBUG, log } from '../../utils/debug.js';
import MyActivitiesStandalone from '../../components/MyActivitiesStandalone.js';

function mountAll() {
  const nodes = document.querySelectorAll('.tvs-my-activities-block');
  nodes.forEach((node, idx) => {
    if (!node.__tvsMounted) {
      const id = node.id || `tvs-my-activities-${idx}`;
      if (!node.id) node.id = id;
      if (DEBUG) log('Mounting MyActivities block (view.js) on:', id);
  // Read server-provided attributes from data-*
  const routeId = parseInt(node.getAttribute('data-route-id') || '0', 10) || 0;
  const limit = parseInt(node.getAttribute('data-limit') || '5', 10) || 5;
  const title = node.getAttribute('data-title') || '';
  mountReact(MyActivitiesStandalone, { React, routeId, limit, title }, node);
      node.__tvsMounted = true;
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountAll);
} else {
  mountAll();
}

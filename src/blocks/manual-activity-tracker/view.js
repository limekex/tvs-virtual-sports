import { mountReact, React } from '../../utils/reactMount.js';
import { DEBUG, log } from '../../utils/debug.js';
import ManualActivityTracker from '../../components/ManualActivityTracker.js';

function mountAll() {
  const nodes = document.querySelectorAll('.tvs-manual-activity-tracker');
  nodes.forEach((node, idx) => {
    if (!node.__tvsMounted) {
      const id = node.id || `tvs-manual-tracker-${idx}`;
      if (!node.id) node.id = id;
      if (DEBUG) log('Mounting ManualActivityTracker block (view.js) on:', id);

      // Read server-provided attributes from data-*
      const title = node.getAttribute('data-title') || 'Start Activity';
      const showTypeSelector = node.getAttribute('data-show-type-selector') === '1';
      const allowedTypesRaw = node.getAttribute('data-allowed-types') || '[]';
      const allowedTypes = JSON.parse(allowedTypesRaw);
      const autoStart = node.getAttribute('data-auto-start') === '1';
      const defaultType = node.getAttribute('data-default-type') || 'Run';

      mountReact(
        ManualActivityTracker,
        {
          React,
          title,
          showTypeSelector,
          allowedTypes,
          autoStart,
          defaultType,
        },
        node
      );
      node.__tvsMounted = true;
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountAll);
} else {
  mountAll();
}

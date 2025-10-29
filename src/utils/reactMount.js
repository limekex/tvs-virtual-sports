// React mount helper paired to the active renderer
import { log, err } from './debug.js';

const hasWindowReact = !!(window.React && window.ReactDOM);
const hasWpElement = !!(window.wp && window.wp.element);
const wpEl = hasWpElement ? window.wp.element : {};
const React = hasWindowReact ? window.React : (wpEl || {});
const ReactDOM = hasWindowReact ? window.ReactDOM : (wpEl || null);

// Track mounted roots to safely unmount/re-mount
const tvsRoots = new WeakMap();
const hasCreateRoot =
  (ReactDOM && typeof ReactDOM.createRoot === 'function') ||
  (wpEl && typeof wpEl.createRoot === 'function');

export function mountReact(Component, props, node) {
  try {
    const existingRoot = tvsRoots.get(node);
    if (existingRoot && typeof existingRoot.unmount === 'function') {
      existingRoot.unmount();
      tvsRoots.delete(node);
    } else if (ReactDOM && typeof ReactDOM.unmountComponentAtNode === 'function') {
      ReactDOM.unmountComponentAtNode(node);
    }

    if (hasCreateRoot) {
      const createRoot = (ReactDOM && ReactDOM.createRoot) || (wpEl && wpEl.createRoot);
      const root = createRoot(node);
      tvsRoots.set(node, root);
      root.render(React.createElement(Component, props));
      return;
    }

    const legacyRender = (ReactDOM && ReactDOM.render) || (wpEl && wpEl.render);
    if (legacyRender) {
      legacyRender(React.createElement(Component, props), node);
      return;
    }
    err('Ingen render-funksjon tilgjengelig.');
  } catch (e) {
    err('Mount feilet:', e);
  }
}

export { React, ReactDOM, wpEl };

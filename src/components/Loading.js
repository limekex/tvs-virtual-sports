import { React } from '../utils/reactMount.js';

export default function Loading() {
  const h = React.createElement;
  return h(
    'div',
    { className: 'tvs-loading', role: 'status', 'aria-live': 'polite' },
    h(
      'svg',
      { viewBox: '0 0 64 64', className: 'tvs-runner', 'aria-hidden': 'true' },
      h('line', { x1: 4, y1: 60, x2: 60, y2: 60, stroke: '#bbb', strokeWidth: 2, className: 'track' }),
      h('circle', { cx: 26, cy: 12, r: 5, fill: 'none', stroke: '#111', strokeWidth: 2 }),
      h('line', { x1: 26, y1: 17, x2: 26, y2: 35, stroke: '#111', strokeWidth: 2 }),
      h('line', { x1: 26, y1: 22, x2: 40, y2: 18, stroke: '#111', strokeWidth: 2, className: 'arm front', style: { transformOrigin: '26px 22px' } }),
      h('line', { x1: 26, y1: 22, x2: 12, y2: 26, stroke: '#111', strokeWidth: 2, className: 'arm back', style: { transformOrigin: '26px 22px' } }),
      h('line', { x1: 26, y1: 35, x2: 40, y2: 48, stroke: '#111', strokeWidth: 2, className: 'leg front', style: { transformOrigin: '26px 35px' } }),
      h('line', { x1: 26, y1: 35, x2: 16, y2: 54, stroke: '#111', strokeWidth: 2, className: 'leg back', style: { transformOrigin: '26px 35px' } })
    ),
    h(
      'div',
      null,
      h('div', { className: 'tvs-skel line' }),
      h('div', { className: 'tvs-skel line sm' }),
      h('div', null,
        h('span', { className: 'tvs-skel block' }),
        h('span', { className: 'tvs-skel block' }),
        h('span', { className: 'tvs-skel block' })
      )
    )
  );
}

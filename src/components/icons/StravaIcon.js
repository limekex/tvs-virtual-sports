export default function StravaIcon({ React, size = 16, className }) {
  const { createElement: h } = React;
  return h(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      'aria-hidden': 'true',
      focusable: 'false',
      className,
      fill: 'currentColor',
    },
    // Stylized dual-triangle mark inspired by activity peaks (not the exact proprietary path)
    h('path', { d: 'M12 2l5.5 9h-3.5L12 6l-2 5H6.5L12 2z' }),
    h('path', { d: 'M16 13l3 5h-2l-1-2-1 2h-2l3-5z' })
  );
}

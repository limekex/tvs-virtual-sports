export default function ProgressBar({ React, currentTime, duration }) {
  const h = React.createElement;
  const mins = Math.floor(currentTime / 60);
  const secs = Math.floor(currentTime % 60);
  const fmt = (m, s) => m + ':' + (s < 10 ? '0' : '') + s;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return h(
    'div',
    { className: 'tvs-progress' },
    h(
      'div',
      { className: 'tvs-progress__bar' },
      h('div', {
        className: 'tvs-progress__fill',
        style: { width: Math.min(progress, 100) + '%' },
      })
    ),
    h('div', { className: 'tvs-progress__time' }, fmt(mins, secs) + ' / ' + fmt(Math.floor(duration / 60), Math.floor(duration % 60)))
  );
}

export default function DevOverlay({ React, routeId, lastStatus, lastError, currentTime, duration }) {
  const { useEffect, useRef, useState, createElement: h } = React;

  function useFPS(React) {
    const { useEffect, useRef, useState } = React;
    const [fps, setFps] = useState(0);
    const lastTime = useRef(performance.now());
    const frames = useRef(0);

    useEffect(() => {
      let raf;
      const tick = (t) => {
        frames.current += 1;
        if (t - lastTime.current >= 1000) {
          setFps(frames.current);
          frames.current = 0;
          lastTime.current = t;
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, []);
    return fps;
  }

  const fps = useFPS(React);
  const boxRef = useRef(null);
  const [min, setMin] = useState(false);
  const [pos, setPos] = useState({ x: 16, y: 16 });

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    let sx, sy, ox, oy, moving = false;

    function onDown(e) {
      const header = e.target.closest('.tvs-dev__header');
      if (!header) return;
      moving = true;
      sx = e.clientX; sy = e.clientY; ox = pos.x; oy = pos.y;
      e.preventDefault();
    }
    function onMove(e) { if (!moving) return; setPos({ x: ox + (e.clientX - sx), y: oy + (e.clientY - sy) }); }
    function onUp() { moving = false; }

    window.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [pos]);

  const progress = duration > 0 ? ((currentTime / duration) * 100).toFixed(1) : '0.0';

  const data = {
    env: window.TVS_SETTINGS?.env,
    version: window.TVS_SETTINGS?.version,
    restRoot: window.TVS_SETTINGS?.restRoot,
    user: window.TVS_SETTINGS?.user,
    routeId,
    lastStatus: lastStatus || 'idle',
    lastError: lastError ? String(lastError) : null,
    currentTime: currentTime ? currentTime.toFixed(1) : '0.0',
    duration: duration || 0,
    progress: progress + '%',
    fps,
  };

  function row(label, value, isErr) {
    return h('div', { className: 'tvs-dev__row' },
      h('span', null, label),
      h('code', { className: isErr ? 'tvs-dev__err' : '' }, value)
    );
  }

  function copy() {
    navigator.clipboard
      .writeText(
        JSON.stringify({ ...data, time: new Date().toISOString() }, null, 2)
      )
      .catch(console.error);
  }

  return h('div', { ref: boxRef, className: `tvs-dev ${min ? 'is-min' : ''}`, style: { left: pos.x + 'px', top: pos.y + 'px' } },
    h('div', { className: 'tvs-dev__header' },
      h('strong', null, 'TVS Dev'),
      h('div', { className: 'tvs-dev__spacer' }),
      h('span', { className: 'tvs-dev__pill' }, data.env || 'n/a'),
      h('button', { className: 'tvs-dev__btn', onClick: () => setMin(!min), 'aria-label': 'Minimize' }, '▁')
    ),
    h('div', { className: 'tvs-dev__body' },
      row('Route', data.routeId ?? 'n/a'),
      row('User', data.user ?? 'guest'),
      row('REST', data.restRoot ?? 'n/a'),
      row('Status', data.lastStatus),
      data.lastError ? row('Error', data.lastError, true) : null,
      row('Duration', data.duration + 's'),
      row('Current', data.currentTime + 's'),
      row('Progress', data.progress),
      row('FPS', String(data.fps)),
      h('div', { className: 'tvs-dev__actions' },
        h('button', { onClick: copy, className: 'tvs-dev__btn' }, 'Copy debug'),
        h('button', { onClick: () => { localStorage.setItem('tvsDev', '0'); location.reload(); }, className: 'tvs-dev__btn tvs-dev__btn--ghost' }, 'Disable')
      )
    )
  );
}

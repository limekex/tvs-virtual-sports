import { mountReact, React } from '../../utils/reactMount.js';

function Sparkline({ React, data, showDistance, showPace, showCumulative }){
  const { createElement: h, useEffect, useRef, useState } = React;
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const guideRef = useRef(null);
  const dotRef = useRef(null);
  const tipRef = useRef(null);
  const ptsRef = useRef([]);
  const itemsRef = useRef([]);
  const [legendReady, setLegendReady] = useState(false);

  useEffect(() => {
    function draw(){
      const c = canvasRef.current; const wrap = wrapRef.current; if(!c || !wrap) return;
      const rect = wrap.getBoundingClientRect();
      const cssW = Math.max(40, Math.floor(rect.width));
      const cssH = Math.max(40, Math.floor(rect.height));
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.floor(cssW * ratio);
      c.height = Math.floor(cssH * ratio);
      c.style.width = cssW + 'px';
      c.style.height = cssH + 'px';
      const ctx = c.getContext('2d');
      ctx.setTransform(1,0,0,1,0,0);
      ctx.scale(ratio, ratio);
      ctx.clearRect(0,0,cssW,cssH);

      const items = (data && data.items ? data.items.slice().sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0) : null);
      itemsRef.current = items || [];
      const counts = (items ? items.map(it => it.count||0) : Array.from({length:20},()=>Math.floor(Math.random()*5)));
      const dists = (items ? items.map(it => it.distance_km||0) : Array(counts.length).fill(0));
      const paces = (items ? items.map(it => (typeof it.avg_pace_s_per_km === 'number' ? it.avg_pace_s_per_km : 0)) : Array(counts.length).fill(0));

      // Simple moving average smoothing (7 samples)
      function smooth(arr, w=7){
        if(!arr || arr.length===0) return arr;
        const out = new Array(arr.length).fill(0);
        const half = Math.floor(w/2);
        for(let i=0;i<arr.length;i++){
          let sum=0, n=0;
          for(let j=i-half;j<=i+half;j++){
            if(j>=0 && j<arr.length){ sum += arr[j]; n++; }
          }
          out[i] = n ? sum/n : arr[i];
        }
        return out;
      }

      const distsSm = smooth(dists);
      const pacesSm = smooth(paces);

      const maxCount = Math.max(1, ...counts);
      const maxDist  = Math.max(1, ...distsSm);
      const maxPace  = Math.max(1, ...pacesSm);
      const minPace  = Math.min(...pacesSm.filter(v=>v>0)) || 0;

      function seriesToPoints(vals){
        return vals.map((v, i) => {
          const denom = Math.max(1, vals.length - 1);
          const x = (i/denom) * (cssW-4) + 2;
          const y = (1-(v/Math.max(1, Math.max(...vals)))) * (cssH-6) + 3;
          const d = items && items[i] ? items[i].date : null;
          return { x, y, v, i, date: d };
        });
      }
      const countPts = seriesToPoints(counts);
      const distPts  = seriesToPoints(distsSm);

      // Pace mapped to its own scale (right axis semantics)
      function paceToPoints(vals){
        const vmin = minPace;
        const vmax = Math.max(vmin+1, maxPace);
        return vals.map((v,i)=>{
          const denom = Math.max(1, vals.length - 1);
          const x = (i/denom) * (cssW-4) + 2;
          const norm = (v - vmin) / (vmax - vmin);
          const y = (norm) * (cssH-6) + 3; // higher pace (slower) lower visually
          const d = items && items[i] ? items[i].date : null;
          return { x, y, v, i, date: d };
        });
      }
      const pacePts = paceToPoints(pacesSm);

      // Cumulative distance from raw daily distance
      let cum=0; const cumArr = dists.map(v=>{ cum+=v; return cum; });
      const cumPts = seriesToPoints(cumArr);
      ptsRef.current = countPts; // use counts to drive hover dot

      // Draw counts (blue)
      ctx.strokeStyle = '#0ea5e9';
      ctx.lineWidth = 2;
      ctx.beginPath();
      countPts.forEach((p,i)=>{ if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); });
      ctx.stroke();

      // Draw distance (green) when available
      if (showDistance && items && maxDist > 0) {
        ctx.strokeStyle = '#16a34a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        distPts.forEach((p,i)=>{ if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); });
        ctx.stroke();
      }

      // Draw pace (orange) with dashed stroke
      if (showPace && items && maxPace > 0) {
        ctx.strokeStyle = '#f59e0b';
        ctx.setLineDash([4,3]);
        ctx.beginPath();
        pacePts.forEach((p,i)=>{ if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); });
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw cumulative distance (purple)
      if (showCumulative && items && cumArr[cumArr.length-1] > 0) {
        ctx.strokeStyle = '#8b5cf6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        cumPts.forEach((p,i)=>{ if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); });
        ctx.stroke();
      }

      setLegendReady(true);
    }

    draw();
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [data]);

  useEffect(() => {
    const wrap = wrapRef.current; if(!wrap) return;
    const guide = guideRef.current, dot = dotRef.current, tip = tipRef.current;
    function nearestIdx(clientX){
      const rect = wrap.getBoundingClientRect();
      const x = clientX - rect.left;
      let best = 0, bestDist = Infinity;
      ptsRef.current.forEach((p, i) => { const d = Math.abs(p.x - x); if(d < bestDist){ best = i; bestDist = d; } });
      return best;
    }
    function showAt(i){
      const p = ptsRef.current[i]; if(!p) return;
      const item = itemsRef.current[i];
      guide.style.left = p.x + 'px';
      guide.style.display = 'block';
      dot.style.left = p.x + 'px';
      dot.style.top = p.y + 'px';
      dot.style.display = 'block';
      const distTxt = (item && typeof item.distance_km === 'number') ? `, ${item.distance_km.toFixed(1)} km` : '';
      const paceTxt = (item && typeof item.avg_pace_s_per_km === 'number') ? `, ${new Date(item.avg_pace_s_per_km*1000).toISOString().substr(14,5)}/km` : '';
      tip.textContent = p.date ? `${p.date}: ${p.v}${distTxt}${paceTxt}` : String(p.v);
      tip.style.left = p.x + 'px';
      tip.style.top = (p.y - 8) + 'px';
      tip.style.display = 'block';
    }
    function hide(){ guide.style.display='none'; dot.style.display='none'; tip.style.display='none'; }
    function onMove(e){ const t = e.touches && e.touches[0] ? e.touches[0] : e; const i = nearestIdx(t.clientX); showAt(i); }
    function onLeave(){ hide(); }
    wrap.addEventListener('mousemove', onMove);
    wrap.addEventListener('mouseleave', onLeave);
    wrap.addEventListener('touchstart', onMove, { passive: true });
    wrap.addEventListener('touchmove', onMove, { passive: true });
    wrap.addEventListener('touchend', onLeave);
    return () => {
      wrap.removeEventListener('mousemove', onMove);
      wrap.removeEventListener('mouseleave', onLeave);
      wrap.removeEventListener('touchstart', onMove);
      wrap.removeEventListener('touchmove', onMove);
      wrap.removeEventListener('touchend', onLeave);
    };
  }, []);

  return h('div', { ref: wrapRef, className: 'tvs-sparkline' },
    h('canvas', { ref: canvasRef, width: 220, height: 40 }),
    h('div', { ref: guideRef, className: 'tvs-sparkline__guide', style: { display: 'none' }, 'aria-hidden':'true' }),
    h('div', { ref: dotRef, className: 'tvs-sparkline__dot', style: { display: 'none' }, 'aria-hidden':'true' }),
    h('div', { ref: tipRef, className: 'tvs-sparkline__tooltip', style: { display: 'none' } }),
    legendReady ? h('div', { className: 'tvs-spark-legend', 'aria-hidden':'true' },
      h('span', { className: 'tvs-spark-legend__swatch', style: { background: '#0ea5e9' } }), h('span', null, 'Count'),
      (showDistance ? h(React.Fragment, null,
        h('span', { className: 'tvs-spark-legend__swatch', style: { background: '#16a34a' } }), h('span', null, 'KM')
      ) : null),
      (showPace ? h(React.Fragment, null,
        h('span', { className: 'tvs-spark-legend__swatch', style: { background: '#f59e0b' } }), h('span', null, 'Pace')
      ) : null),
      (showCumulative ? h(React.Fragment, null,
        h('span', { className: 'tvs-spark-legend__swatch', style: { background: '#8b5cf6' } }), h('span', null, 'Cum KM')
      ) : null)
    ) : null
  );
}

function CalendarHeatmap({ React, data }){
  const { createElement: h, useMemo, useRef, useEffect, useState } = React;
  // Hooks must be declared before any conditional return
  const gridRef = useRef(null);
  const guideRef = useRef(null);
  const tipRef = useRef(null);
  const centersRef = useRef([]);

  const items = useMemo(() => {
    const arr = (data && data.items) || [];
    // Ensure ascending sort by date to be robust regardless of API order
    return arr.slice().sort((a,b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }, [data]);
  const map = useMemo(() => {
    const m = new Map();
    items.forEach(it => m.set(it.date, it.count));
    return m;
  }, [items]);
  // Build date range covering all items (last N days, returned by API)
  const dates = items.map(it => it.date);
  if(dates.length === 0){
    // Render a small 4-week placeholder grid so calendar is always visible
    const cols = 4, rows = 7;
    return h('div', { className: 'tvs-heatmap-wrap tvs-heatmap--interactive' },
      h('div', { className: 'tvs-heatmap-header', style: { gridTemplateColumns: `repeat(${cols}, 10px)` } },
        Array.from({length:cols}, (_,i)=>h('span',{key:i,className:'tvs-heatmap-header__label'},''))
      ),
      h('div', { role:'grid', className:'tvs-heatmap-grid', style:{ gridTemplateColumns: `repeat(${cols}, 10px)` } },
        Array.from({length: cols*rows}, (_,idx) => h('button', {
          key: idx,
          className: 'tvs-heatmap__cell lv-0',
          role: 'gridcell',
          title: 'No activity',
          'aria-label': 'No activity',
          tabIndex: 0
        }))
      ),
      h('div', { className:'tvs-text-muted' }, 'No data')
    );
  }
  const start = new Date(dates[0]+'T00:00:00Z');
  const end = new Date(dates[dates.length-1]+'T00:00:00Z');
  // Align to Monday as first row
  const startDay = (start.getUTCDay()+6)%7; // 0=Mon..6=Sun
  const alignedStart = new Date(start); alignedStart.setUTCDate(start.getUTCDate() - startDay);
  const days = [];
  for(let d = new Date(alignedStart); d <= end; d.setUTCDate(d.getUTCDate()+1)){
    const iso = d.toISOString().slice(0,10);
    days.push({ iso, weekday: (d.getUTCDay()+6)%7, date: new Date(d) });
  }
  const weeks = [];
  for(let i=0;i<days.length;i+=7){ weeks.push(days.slice(i,i+7)); }
  const counts = items.map(it => it.count);
  const max = Math.max(1, ...counts);
  useEffect(() => {
    const el = gridRef.current; if(!el) return;
    function onKey(e){
      const tgt = document.activeElement;
      if(!tgt || !tgt.dataset || !tgt.dataset.idx) return;
      const idx = parseInt(tgt.dataset.idx,10);
      let next = null;
      if(e.key === 'ArrowRight') next = idx + 7; // next week same weekday
      else if(e.key === 'ArrowLeft') next = idx - 7;
      else if(e.key === 'ArrowDown') next = idx + 1;
      else if(e.key === 'ArrowUp') next = idx - 1;
      if(next != null){
        const nextEl = el.querySelector('[data-idx="'+next+'"]');
        if(nextEl){ nextEl.focus(); e.preventDefault(); }
      }
    }
    el.addEventListener('keydown', onKey);
    // Precompute column centers for pointer guide
    const gridRect = el.getBoundingClientRect();
    const firstRowCells = el.querySelectorAll('.tvs-heatmap__cell[data-row="0"]');
    centersRef.current = Array.from(firstRowCells).map(c => {
      const r = c.getBoundingClientRect();
      return (r.left - gridRect.left) + r.width/2;
    });

    function setGuideForCol(col){
      const g = guideRef.current; if(!g) return;
      const center = centersRef.current[col];
      if(center == null) return;
      g.style.left = center + 'px';
      g.style.display = 'block';
    }
    function hideGuide(){ const g = guideRef.current; if(g) g.style.display = 'none'; }
    function showTipForCell(cell){
      const tip = tipRef.current; if(!tip || !cell) return;
      const cellRect = cell.getBoundingClientRect();
      const gridRect2 = el.getBoundingClientRect();
      const iso = cell.getAttribute('data-date');
      const cnt = parseInt(cell.getAttribute('data-count')||'0',10);
      tip.textContent = `${iso}: ${cnt}`;
      tip.style.left = (cellRect.left - gridRect2.left + cellRect.width/2) + 'px';
      tip.style.top = (cellRect.top - gridRect2.top - 8) + 'px';
      tip.style.display = 'block';
      setGuideForCol(parseInt(cell.getAttribute('data-col'),10)||0);
    }
    function hideTip(){ const t = tipRef.current; if(t) t.style.display = 'none'; }
    function onMouseMove(e){
      const tgt = e.target && e.target.closest && e.target.closest('.tvs-heatmap__cell');
      if(tgt){ showTipForCell(tgt); return; }
      // Not over a cell: move guide to nearest column, hide tooltip
      hideTip();
      const x = e.clientX - el.getBoundingClientRect().left;
      if(centersRef.current && centersRef.current.length){
        let bestIdx = 0, bestDist = Infinity;
        centersRef.current.forEach((cx, i) => { const d = Math.abs(cx - x); if(d < bestDist){ bestDist = d; bestIdx = i; } });
        setGuideForCol(bestIdx);
      }
    }
    function onMouseLeave(){ hideGuide(); hideTip(); }
    function onFocus(e){ const tgt = e.target && e.target.closest('.tvs-heatmap__cell'); if(tgt) showTipForCell(tgt); }
    function onBlur(){ hideTip(); hideGuide(); }

    el.addEventListener('mousemove', onMouseMove);
    el.addEventListener('mouseleave', onMouseLeave);
    el.addEventListener('focusin', onFocus);
    el.addEventListener('focusout', onBlur);
    return () => {
      el.removeEventListener('keydown', onKey);
      el.removeEventListener('mousemove', onMouseMove);
      el.removeEventListener('mouseleave', onMouseLeave);
      el.removeEventListener('focusin', onFocus);
      el.removeEventListener('focusout', onBlur);
    };
  }, [weeks.length]);

  // Month labels (for first day of month columns)
  const monthLabels = weeks.map((w,i) => {
    const d = w[0] && w[0].date;
    if(!d) return '';
    const day = d.getUTCDate();
    return day <= 7 ? d.toLocaleString(undefined,{ month:'short' }) : '';
  });

  return h('div', { className: 'tvs-heatmap-wrap tvs-heatmap--interactive' },
    h('div', {
      className: 'tvs-heatmap-header',
      style: { gridTemplateColumns: `repeat(${weeks.length}, 10px)` }
    }, monthLabels.map((lbl,i) => h('span', { key:i, className:'tvs-heatmap-header__label' }, lbl))),
    h('div', {
      ref: gridRef,
      role: 'grid',
      className: 'tvs-heatmap-grid',
      style: { gridTemplateColumns: `repeat(${weeks.length}, 10px)` }
    }, [
      ...weeks.flatMap((w, col) => w.map((day, row) => {
      const cnt = map.get(day.iso) || 0;
      const level = max ? Math.ceil((cnt/max)*4) : 0;
      const title = `${day.iso}: ${cnt} activity${cnt===1?'':'ies'}`;
      const flatIdx = col*7 + row;
      return h('button', {
        key: `${col}:${row}`,
        className: `tvs-heatmap__cell lv-${level}`,
        title,
        'aria-label': title,
        role: 'gridcell',
        tabIndex: 0,
        'data-idx': flatIdx,
        'data-col': col,
        'data-row': row,
        'data-date': day.iso,
        'data-count': cnt
      });
    })),
      h('div', { ref: guideRef, className: 'tvs-heatmap__guide', 'aria-hidden': 'true' }),
      h('div', { ref: tipRef, className: 'tvs-heatmap__tooltip', style: { display: 'none' } })
    ])
  );
}

function ActivityHeatmap({ React, title, type, routeId, showDistance, showPace, showCumulative }){
  const { createElement: h, useEffect, useState } = React;
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [days, setDays] = useState(180); // allow 7/30/365 via UI for sparkline
  const isLoggedIn = !!(window.TVS_SETTINGS?.user);

  useEffect(() => {
    if (!isLoggedIn) {
      // Generate demo data for logged-out users
      const demoItems = Array.from({ length: days > 90 ? 180 : days }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (days > 90 ? 180 : days) + i);
        return {
          date: date.toISOString().slice(0, 10),
          count: Math.floor(Math.random() * 3),
          distance_km: Math.random() * 10,
          avg_pace_s_per_km: 300 + Math.random() * 120
        };
      });
      setData({ items: demoItems });
      return;
    }

    let cancelled = false;
    async function load(){
      try{
        const root = (window.TVS_SETTINGS && TVS_SETTINGS.restRoot) || '/wp-json/';
        const qs = new URLSearchParams();
        if(routeId) qs.set('route_id', String(routeId));
        qs.set('days', String(days));
        const url = `${root.replace(/\/$/,'')}/tvs/v1/activities/aggregate?${qs.toString()}`;
        const res = await fetch(url, { headers: { 'X-WP-Nonce': (window.TVS_SETTINGS && TVS_SETTINGS.nonce) || '' } });
        if(!res.ok) throw new Error('HTTP '+res.status);
        const json = await res.json();
        if(!cancelled) setData(json);
      }catch(e){ if(!cancelled) setErr(e.message||'Failed'); }
    }
    load();
    return () => { cancelled = true; };
  }, [routeId, days, isLoggedIn]);

  if (!isLoggedIn) {
    return h('div', { className: 'tvs-panel' },
      h('h3', { className: 'tvs-activities-title' }, title || 'Activity Heatmap'),
      (type === 'sparkline') ? h('div', { className: 'tvs-mini-seg' },
        h('button', { className: days===7?'is-active':'', onClick: () => setDays(7), disabled: true }, '1w'),
        h('button', { className: days===30?'is-active':'', onClick: () => setDays(30), disabled: true }, '1m'),
        h('button', { className: days===365?'is-active':'', onClick: () => setDays(365), disabled: true }, '1y')
      ) : null,
      h('div', { style: { opacity: 0.5, pointerEvents: 'none' } },
        type === 'calendar' ? h(CalendarHeatmap, { React, data }) : h(Sparkline, { React, data, showDistance, showPace, showCumulative })
      ),
      h('div', { className: 'tvs-activities-footer' },
        h('div', { className: 'tvs-text-muted', style: { marginBottom: '0.5rem' } }, 'Sign in to see your activity heatmap.'),
        h('div', null,
          h('a', { href: '/login', className: 'tvs-link', style: { marginRight: 12 } }, 'Log in'),
          h('a', { href: '/register', className: 'tvs-link' }, 'Register')
        )
      )
    );
  }

  return h('div', { className: 'tvs-panel' },
    h('h3', { className: 'tvs-activities-title' }, title || 'Activity Heatmap'),
    (type === 'sparkline') ? h('div', { className: 'tvs-mini-seg' },
      h('button', { className: days===7?'is-active':'', onClick: () => setDays(7) }, '1w'),
      h('button', { className: days===30?'is-active':'', onClick: () => setDays(30) }, '1m'),
      h('button', { className: days===365?'is-active':'', onClick: () => setDays(365) }, '1y')
    ) : null,
    (!data && !err) ? h('div', { className: 'tvs-text-muted', style: { marginBottom: '0.5rem' } }, 'Loading…') : null,
    err ? h('div', { className: 'tvs-text-danger' }, String(err)) : null,
    data ? (type === 'calendar' ? h(CalendarHeatmap, { React, data }) : h(Sparkline, { React, data, showDistance, showPace, showCumulative })) : null
  );
}

function mountAll(){
  const nodes = document.querySelectorAll('.tvs-activity-heatmap-block');
  nodes.forEach((node, idx) => {
    if(node.__tvsMounted) return;
    const title = node.getAttribute('data-title') || '';
    const type  = node.getAttribute('data-type') || 'sparkline';
    const routeId = parseInt(node.getAttribute('data-route-id')||'0',10) || 0;
    const showDistance   = node.getAttribute('data-show-distance') === '1';
    const showPace       = node.getAttribute('data-show-pace') === '1';
    const showCumulative = node.getAttribute('data-show-cumulative') === '1';
    mountReact(ActivityHeatmap, { React, title, type, routeId, showDistance, showPace, showCumulative }, node);
    node.__tvsMounted = true;
  });
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', mountAll);
}else{ mountAll(); }

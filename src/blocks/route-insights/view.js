import { mountReact, React } from '../../utils/reactMount.js';

function fmtDuration(seconds){
  const s = Math.max(0, Math.floor(seconds||0));
  const h = Math.floor(s/3600);
  const m = Math.floor((s%3600)/60);
  const r = s%60;
  if(h>0) return `${h}:${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`;
  return `${m}:${String(r).padStart(2,'0')}`;
}

function ElevationSparkline({ React, routeId }){
  const { createElement: h, useEffect, useRef, useState } = React;
  const canvasRef = useRef(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    if(!routeId) return;
    let cancelled = false;
    async function run(){
      try{
        // Use REST API to get GPX data (avoids SSL issues with direct file URLs)
        const root = (window.TVS_SETTINGS && TVS_SETTINGS.restRoot) || '/wp-json/';
        const url = `${root.replace(/\/$/,'')}/tvs/v1/routes/${encodeURIComponent(routeId)}/gpx-data`;
        const res = await fetch(url);
        if(!res.ok) throw new Error('HTTP '+res.status);
        const gpxData = await res.json();
        if(cancelled) return;

        // Extract elevation values from parsed GPX data
        const vals = (gpxData.points || [])
          .map(p => p.ele)
          .filter(v => Number.isFinite(v));

        const c = canvasRef.current; if(!c) return;
        const ctx = c.getContext('2d');
        const w = c.width = 260, hgt = c.height = 50;
        ctx.clearRect(0,0,w,hgt);
        if(vals.length < 2){
          setErr('No elevation data');
          return;
        }
        const min = Math.min(...vals), max = Math.max(...vals);
        const rng = Math.max(1, max - min);
        ctx.strokeStyle = '#0ea5e9'; ctx.lineWidth = 2; ctx.beginPath();
        vals.forEach((v, i) => {
          const x = (i/(vals.length-1)) * (w-4) + 2;
          const y = (1-((v-min)/rng)) * (hgt-6) + 3;
          if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        });
        ctx.stroke();
      }catch(e){ if(!cancelled) setErr(e.message||'Failed'); }
    }
    run();
    return () => { cancelled = true; };
  }, [routeId]);
  return h('div', null,
    h('canvas', { ref: canvasRef, width: 260, height: 50, style: { maxWidth:'100%', display:'block' }}),
    err ? h('div', { className: 'tvs-text-muted', style:{fontSize:'.85em'} }, String(err)) : null
  );
}

function RouteInsights({ React, title, showElevation, showSurface, showEta, showMapsLink, routeId }){
  const { createElement: h, useEffect, useState } = React;
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    let cancelled = false;
    async function load(){
      if(!routeId){ setErr('No route selected.'); return; }
      try{
        const root = (window.TVS_SETTINGS && TVS_SETTINGS.restRoot) || '/wp-json/';
        const url = `${root.replace(/\/$/,'')}/tvs/v1/routes/${encodeURIComponent(routeId)}/insights`;
        const res = await fetch(url);
        if(!res.ok) throw new Error('HTTP '+res.status);
        const json = await res.json();
        if(!cancelled) setData(json);
      }catch(e){ if(!cancelled) setErr(e.message||'Failed'); }
    }
    load();
    return () => { cancelled = true; };
  }, [routeId]);

  const items = [];
  const meta = (data && data.meta) || {};
  if(showElevation){
    const dist = meta.distance_m ? `${(meta.distance_m/1000).toFixed(2)} km` : null;
    const head = `Distance: ${dist || '—'} • Elevation: ${meta.elevation_m?Math.round(meta.elevation_m)+' m':'—'}`;
    items.push(h('div', null, head, routeId ? h(ElevationSparkline, { React, routeId }) : null));
  }
  if(showSurface){ items.push(`Surface: ${meta.surface || '—'}`); }
  if(showEta){
    const eta = data && data.computed && data.computed.eta_s ? fmtDuration(data.computed.eta_s) : '—';
    items.push(`Estimated time: ${eta}`);
  }
  if(showMapsLink){
    const href = data && data.maps_url;
    items.push(href ? h('a', { href, target:'_blank', rel:'noopener noreferrer' }, 'Open in Google Maps (midpoint)') : 'Open in Google Maps (—)');
  }

  return h('div', { className: 'tvs-panel' },
    h('h3', { className: 'tvs-activities-title' }, title || 'Route Insights'),
    (!data && !err) ? h('div', { className: 'tvs-text-muted' }, 'Loading…') : null,
    err ? h('div', { className: 'tvs-text-danger' }, String(err)) : null,
    h('ul', { className: 'tvs-list' }, items.map((it,i) => h('li', { key:i }, it)))
  );
}

function mountAll(){
  const nodes = document.querySelectorAll('.tvs-route-insights-block');
  nodes.forEach((node, idx) => {
    if(node.__tvsMounted) return;
    const title = node.getAttribute('data-title') || '';
    const showElevation = node.getAttribute('data-show-elevation') === '1';
    const showSurface   = node.getAttribute('data-show-surface') === '1';
    const showEta       = node.getAttribute('data-show-eta') === '1';
    const showMapsLink  = node.getAttribute('data-show-maps-link') === '1';
    const routeId = parseInt(node.getAttribute('data-route-id')||'0',10) || 0;
    mountReact(RouteInsights, { React, title, showElevation, showSurface, showEta, showMapsLink, routeId }, node);
    node.__tvsMounted = true;
  });
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', mountAll);
}else{ mountAll(); }

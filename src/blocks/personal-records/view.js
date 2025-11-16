import { mountReact, React } from '../../utils/reactMount.js';

function fmtDuration(seconds){
  const s = Math.max(0, Math.floor(seconds||0));
  const m = Math.floor(s/60); const r = s%60;
  return `${m}:${String(r).padStart(2,'0')}`;
}

function PersonalRecords({ React, title, showBestTime, showAvgPace, showAvgTempo, showMostRecent, routeId }){
  const { createElement: h, useEffect, useState } = React;
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const isLoggedIn = !!(window.TVS_SETTINGS?.user);

  useEffect(() => {
    if (!isLoggedIn) {
      setData(null);
      return;
    }
    let cancelled = false;
    async function load(){
      try{
        const root = (window.TVS_SETTINGS && TVS_SETTINGS.restRoot) || '/wp-json/';
        const qs = new URLSearchParams();
        if(routeId) qs.set('route_id', String(routeId));
        const url = `${root.replace(/\/$/,'')}/tvs/v1/activities/stats?${qs.toString()}`;
        const res = await fetch(url, { headers: { 'X-WP-Nonce': (window.TVS_SETTINGS && TVS_SETTINGS.nonce) || '' } });
        if(!res.ok) throw new Error('HTTP '+res.status);
        const json = await res.json();
        if(!cancelled) setData(json);
      }catch(e){ if(!cancelled) setErr(e.message||'Failed'); }
    }
    load();
    return () => { cancelled = true; };
  }, [routeId, isLoggedIn]);

  if (!isLoggedIn) {
    const demoItems = [];
    if (showBestTime) demoItems.push('Best time: 8:45');
    if (showAvgPace) demoItems.push('Average pace: 5:30/km');
    if (showAvgTempo) demoItems.push('Average speed: 10.9 km/h');
    if (showMostRecent) demoItems.push('Most recent: 10:12');

    return h('div', { className: 'tvs-panel' },
      h('h3', { className: 'tvs-activities-title' }, title || 'Personal Records'),
      h('ul', { className: 'tvs-list', style: { opacity: 0.5 } }, 
        demoItems.map((it, i) => h('li', { key: i }, it))
      ),
      h('div', { className: 'tvs-activities-footer' },
        h('div', { className: 'tvs-text-muted', style: { marginBottom: '0.5rem' } }, 'Sign in to see your personal records.'),
        h('div', null,
          h('a', { href: '/login', className: 'tvs-link', style: { marginRight: 12 } }, 'Log in'),
          h('a', { href: '/register', className: 'tvs-link' }, 'Register')
        )
      )
    );
  }

  const items = [];
  if(showBestTime){
    const t = data && data.best && data.best.duration_s ? fmtDuration(data.best.duration_s) : '—';
    const link = data && data.best && data.best.permalink;
    items.push(h('span', null, 'Best time: ', link ? h('a', { href: link }, t) : t));
  }
  if(showAvgPace){
    const p = data && data.avg && data.avg.pace_text ? data.avg.pace_text : '—';
    items.push('Average pace: ' + p);
  }
  if(showAvgTempo){
    const s = data && data.avg && data.avg.speed_kmh ? `${data.avg.speed_kmh} km/h` : '—';
    items.push('Average speed: ' + s);
  }
  if(showMostRecent){
    const r = data && data.recent;
    const label = r && r.duration_s ? fmtDuration(r.duration_s) : '—';
    items.push(h('span', null, 'Most recent: ', r && r.permalink ? h('a', { href:r.permalink }, label) : label));
  }

  return h('div', { className: 'tvs-panel' },
    h('h3', { className: 'tvs-activities-title' }, title || 'Personal Records'),
    (!data && !err) ? h('div', { className: 'tvs-text-muted' }, 'Loading…') : null,
    err ? h('div', { className: 'tvs-text-danger' }, String(err)) : null,
    h('ul', { className: 'tvs-list' }, items.map((it,i) => h('li', { key:i }, it)))
  );
}

function mountAll(){
  const nodes = document.querySelectorAll('.tvs-personal-records-block');
  nodes.forEach((node, idx) => {
    if(node.__tvsMounted) return;
    const title = node.getAttribute('data-title') || '';
    const showBestTime = node.getAttribute('data-show-best') === '1';
    const showAvgPace = node.getAttribute('data-show-avg-pace') === '1';
    const showAvgTempo = node.getAttribute('data-show-avg-tempo') === '1';
    const showMostRecent = node.getAttribute('data-show-recent') === '1';
    const routeId = parseInt(node.getAttribute('data-route-id')||'0',10) || 0;
    mountReact(PersonalRecords, { React, title, showBestTime, showAvgPace, showAvgTempo, showMostRecent, routeId }, node);
    node.__tvsMounted = true;
  });
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', mountAll);
}else{ mountAll(); }

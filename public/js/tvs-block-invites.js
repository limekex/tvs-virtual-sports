(function(){
  const S = window.TVS_SETTINGS || {};
  const rest = S.restRoot || '/wp-json/';
  const nonce = S.nonce || '';

  function el(tag, cls, text){ const e = document.createElement(tag); if(cls) e.className = cls; if(text) e.textContent = text; return e; }
  function qs(sel, root){ return (root||document).querySelector(sel); }
  function fmtDate(s){ try { return new Date(s).toLocaleString(); } catch { return s||''; } }
  async function copy(text, onSuccess, onFail){
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        if (onSuccess) onSuccess();
        return true;
      }
    } catch(e) {
      // fall through to legacy
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'absolute';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) { if (onSuccess) onSuccess(); return true; }
    } catch(e2) {}
    if (onFail) onFail();
    return false;
  }

  async function getJSON(url, opts){
    const r = await fetch(url, { ...(opts||{}), headers: { 'X-WP-Nonce': nonce, ...(opts&&opts.headers||{}) } });
    const t = await r.text(); let data; try { data = JSON.parse(t); } catch { data = t; }
    return { ok: r.ok, status: r.status, data };
  }

  function render(container){
    container.innerHTML = '';
  const wrap = el('div','tvs-app tvs-invites tvs-card tvs-glass');
  const actions = el('div','tvs-invites-actions tvs-btns');
  const email = el('input','tvs-input'); email.type='email'; email.placeholder='Invitee email (optional)'; email.style.marginRight='8px'; email.autocomplete='off';
  const btn = el('button','tvs-btn tvs-btn--outline','Create code');
  actions.appendChild(email); actions.appendChild(btn);
  const status = el('div','tvs-invites-status'); status.style.marginTop = '8px';
  const list = el('div','tvs-invites-list'); list.style.marginTop='12px';
    wrap.appendChild(actions); wrap.appendChild(status); wrap.appendChild(list);
    container.appendChild(wrap);

    async function refresh(){
      list.textContent = 'Loading invites…';
      const res = await getJSON(rest + 'tvs/v1/invites/mine');
      if (!res.ok){ list.textContent = 'Failed to load invites ('+res.status+')'; return; }
      const items = (res.data && res.data.items) || [];
      if (!items.length){ list.innerHTML = '<em>No invites yet.</em>'; return; }
  const table = el('table','widefat tvs-table');
  table.style.width = '100%';
      const thead = el('thead'); const trh=el('tr');
      ['ID','Email','Hint','Status','Created','Used by','Used at',''].forEach(h=>{ const th=el('th'); th.textContent=h; trh.appendChild(th); });
      thead.appendChild(trh); table.appendChild(thead);
      const tbody = el('tbody');
      items.forEach(it=>{
        const tr = el('tr');
        const statusTxt = it.status==='available' ? 'Available' : (it.status==='used' ? 'Used' : 'Inactive');
        const tdId=el('td',null,String(it.id));
        const tdEmail=el('td',null,it.email||'');
        const tdHint=el('td',null,it.hint||'');
        const tdStatus=el('td',null,statusTxt);
        const tdCreated=el('td',null,fmtDate(it.created_at));
        const tdUsedBy=el('td',null,it.used_by?('#'+it.used_by):'');
  const tdUsedAt=el('td',null, it.used_at ? fmtDate(it.used_at) : 'Not used yet');
        const tdAct = el('td');
        if (it.status==='available'){
          const deact = el('button','tvs-btn tvs-btn--outline','Deactivate');
          deact.addEventListener('click', async ()=>{
            const resp = await getJSON(rest + 'tvs/v1/invites/'+it.id+'/deactivate', { method:'POST' });
            if (resp.ok){ refresh(); }
            else { status.textContent = 'Deactivate failed ('+resp.status+')'; }
          });
          tdAct.appendChild(deact);
        }
        tr.appendChild(tdId); tr.appendChild(tdEmail); tr.appendChild(tdHint); tr.appendChild(tdStatus); tr.appendChild(tdCreated); tr.appendChild(tdUsedBy); tr.appendChild(tdUsedAt); tr.appendChild(tdAct);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      list.innerHTML = ''; list.appendChild(table);
    }

    btn.addEventListener('click', async ()=>{
      status.textContent = 'Creating…';
      const payload = { count: 1 };
      const eml = (email.value||'').trim();
      if (eml) payload.email = eml;
      const res = await getJSON(rest + 'tvs/v1/invites/create', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok){ status.textContent = 'Failed ('+res.status+')'; return; }
      const created = (res.data && res.data.created) || [];
      if (!created.length){ status.textContent = 'No code created'; return; }
      const code = created[0].code; status.textContent = 'Invite code created — copy now (shown only once)';
      const box = el('div'); box.style.marginTop='8px';
      const pre = el('code','tvs-code',code);
      const cbtn = el('button','tvs-btn tvs-btn--outline', 'Copy');
      cbtn.style.marginLeft='8px';
      cbtn.addEventListener('click',()=> {
        const old = cbtn.textContent;
        copy(code, () => {
          cbtn.textContent = 'Copied';
          cbtn.disabled = true;
          setTimeout(()=>{ cbtn.textContent = old; cbtn.disabled = false; }, 1500);
        });
      });
      box.appendChild(pre); box.appendChild(cbtn);
      // Insert above the list so refresh() doesn't wipe it
      wrap.insertBefore(box, list);
      refresh();
    });

    refresh();
  }

  function boot(){
    document.querySelectorAll('.tvs-invite-friends-block').forEach(function(node){
      if (!node.__tvsInvitesInit){ node.__tvsInvitesInit = true; render(node); }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // In block editor, nodes may appear dynamically; observe and initialize
  try {
    const mo = new MutationObserver(function(muts){
      for (const m of muts){
        if (m.type === 'childList') { boot(); }
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch(e){}
})();

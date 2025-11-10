/* TVS Flash Notification System (global)
   Usage: window.tvsFlash(message, type)
   type: 'success' (default, green), 'error' (red)
*/
(function(){
  if (window.tvsFlash) return; // Prevent double-init
  window.tvsFlash = function(message, type) {
    type = type === 'error' ? 'error' : 'success';
    var container = document.getElementById('tvs-flash-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'tvs-flash-container';
      container.style.position = 'fixed';
      container.style.top = '24px';
      container.style.right = '24px';
      container.style.zIndex = '999999';
      container.style.pointerEvents = 'none';
      document.body.appendChild(container);
    }
    var el = document.createElement('div');
    el.className = 'tvs-flash tvs-flash-' + type;
    el.textContent = message;
    el.style.cssText =
      'background:' + (type==='error' ? '#ef4444' : '#10b981') +
      ';color:#fff;padding:12px 24px;margin-bottom:12px;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,.12);font-size:1rem;font-weight:500;opacity:0;transform:translateY(-1rem);transition:all .4s cubic-bezier(.4,0,.2,1);pointer-events:auto;';
    container.appendChild(el);
    setTimeout(function(){
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, 10);
    setTimeout(function(){
      el.style.opacity = '0';
      el.style.transform = 'translateY(-0.5rem)';
      setTimeout(function(){
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 400);
    }, 3000);
  };
})();

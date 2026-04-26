/**
 * Medico PWA — client-side controller
 * Handles: SW registration, install banner, online/offline indicator, SW update prompt
 */
(function () {
  'use strict';

  // ── Service Worker registration ───────────────────────────────────────────
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(reg => {
          console.log('[PWA] SW registered, scope:', reg.scope);

          // Listen for SW updates
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                showUpdateBanner(newWorker);
              }
            });
          });
        })
        .catch(err => console.warn('[PWA] SW registration failed:', err));

      // Page reload after SW takes control
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) { refreshing = true; window.location.reload(); }
      });
    });
  }

  // ── Install prompt (Add to Home Screen) ───────────────────────────────────
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;

    // Show custom install button after 3 s, only once per session
    if (!sessionStorage.getItem('pwa-install-dismissed')) {
      setTimeout(showInstallBanner, 3000);
    }
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideInstallBanner();
    console.log('[PWA] App installed');
  });

  // ── Online / Offline indicator ────────────────────────────────────────────
  function updateOnlineStatus() {
    const bar = getOrCreate('pwa-offline-bar', () => {
      const el = document.createElement('div');
      el.id = 'pwa-offline-bar';
      el.style.cssText = [
        'position:fixed', 'bottom:0', 'left:0', 'right:0',
        'padding:8px 16px', 'font-size:13px', 'font-weight:600',
        'text-align:center', 'z-index:9999',
        'transform:translateY(100%)',
        'transition:transform .3s ease',
        'display:flex', 'align-items:center', 'justify-content:center', 'gap:8px'
      ].join(';');
      document.body.appendChild(el);
      return el;
    });

    if (!navigator.onLine) {
      bar.style.background = '#1e293b';
      bar.style.color = '#f1f5f9';
      bar.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:#ef4444;display:inline-block"></span> You are offline — showing cached data';
      bar.style.transform = 'translateY(0)';
    } else {
      bar.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:#22c55e;display:inline-block"></span> Back online';
      bar.style.background = '#064e3b';
      bar.style.color = '#d1fae5';
      bar.style.transform = 'translateY(0)';
      setTimeout(() => { bar.style.transform = 'translateY(100%)'; }, 2500);
    }
  }

  window.addEventListener('online',  updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  // ── Install Banner ────────────────────────────────────────────────────────
  function showInstallBanner() {
    if (!deferredPrompt) return;

    const banner = getOrCreate('pwa-install-banner', () => {
      const el = document.createElement('div');
      el.id = 'pwa-install-banner';
      el.style.cssText = [
        'position:fixed', 'bottom:16px', 'left:16px', 'right:16px',
        'background:#0f172a', 'border:1px solid #334155',
        'border-radius:16px', 'padding:16px',
        'display:flex', 'align-items:center', 'gap:12px',
        'z-index:9998', 'box-shadow:0 8px 32px rgba(0,0,0,0.5)',
        'animation:slideUp .3s ease'
      ].join(';');
      el.innerHTML = `
        <style>@keyframes slideUp{from{transform:translateY(120%)}to{transform:translateY(0)}}</style>
        <div style="width:40px;height:40px;background:#0284c7;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12h15m-7.5-7.5v15"/>
          </svg>
        </div>
        <div style="flex:1;min-width:0">
          <p style="color:#f1f5f9;font-size:14px;font-weight:700;margin:0 0 2px">Install Medico</p>
          <p style="color:#94a3b8;font-size:12px;margin:0">Add to home screen for quick access</p>
        </div>
        <button id="pwa-install-btn" style="background:#0284c7;color:white;border:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;flex-shrink:0">Install</button>
        <button id="pwa-dismiss-btn" style="background:transparent;border:none;color:#64748b;cursor:pointer;font-size:18px;line-height:1;flex-shrink:0">&times;</button>
      `;
      document.body.appendChild(el);
      return el;
    });

    document.getElementById('pwa-install-btn').onclick = async () => {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('[PWA] Install outcome:', outcome);
      deferredPrompt = null;
      hideInstallBanner();
    };
    document.getElementById('pwa-dismiss-btn').onclick = () => {
      sessionStorage.setItem('pwa-install-dismissed', '1');
      hideInstallBanner();
    };
  }

  function hideInstallBanner() {
    const el = document.getElementById('pwa-install-banner');
    if (el) { el.style.transform = 'translateY(120%)'; setTimeout(() => el.remove(), 300); }
  }

  // ── Update Banner ─────────────────────────────────────────────────────────
  function showUpdateBanner(newWorker) {
    const banner = getOrCreate('pwa-update-banner', () => {
      const el = document.createElement('div');
      el.id = 'pwa-update-banner';
      el.style.cssText = [
        'position:fixed', 'top:16px', 'left:50%', 'transform:translateX(-50%)',
        'background:#0f172a', 'border:1px solid #0284c7',
        'border-radius:12px', 'padding:12px 20px',
        'display:flex', 'align-items:center', 'gap:12px',
        'z-index:9999', 'box-shadow:0 4px 20px rgba(0,0,0,0.4)',
        'white-space:nowrap'
      ].join(';');
      el.innerHTML = `
        <span style="color:#7dd3fc;font-size:13px;font-weight:600">Update available</span>
        <button id="pwa-update-btn" style="background:#0284c7;color:white;border:none;border-radius:6px;padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer">Refresh</button>
        <button id="pwa-update-dismiss" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:16px">&times;</button>
      `;
      document.body.appendChild(el);
      return el;
    });

    document.getElementById('pwa-update-btn').onclick = () => {
      newWorker.postMessage({ type: 'SKIP_WAITING' });
    };
    document.getElementById('pwa-update-dismiss').onclick = () => banner.remove();
  }

  // ── Util ──────────────────────────────────────────────────────────────────
  function getOrCreate(id, factory) {
    return document.getElementById(id) || factory();
  }

})();

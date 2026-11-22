const BOOT_COPY = {
    en: {
        title: 'Page updated — Reload',
        body: 'This page was updated while it was open. Reload to continue.',
        reload: 'Reload',
        home: 'Go to home',
    },
    ar: {
        title: 'تم تحديث الصفحة — أعد التحميل',
        body: 'حُدّثت هذه الصفحة أثناء فتحها. أعد التحميل للمتابعة.',
        reload: 'إعادة التحميل',
        home: 'الذهاب إلى الرئيسية',
    },
};

export function bootLocale() {
    try {
        const loc =
            typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : 'en';
        return String(loc || 'en').toLowerCase().startsWith('ar') ? 'ar' : 'en';
    } catch {
        return 'en';
    }
}

export function bootCopy() {
    return BOOT_COPY[bootLocale()];
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Fills #root when React never mounts (module evaluation errors). */
export function paintBootError(error, rootEl) {
    const root =
        rootEl
        || (typeof document !== 'undefined' ? document.getElementById('root') : null);
    if (!root) return false;
    const copy = bootCopy();
    const isRtl = bootLocale() === 'ar';
    const msg = escapeHtml(error?.message || error || 'Unknown error');
    root.innerHTML = `<div data-boot-error="1" style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#f8fafc;font-family:system-ui,sans-serif;direction:${isRtl ? 'rtl' : 'ltr'}">
      <div style="max-width:520px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;box-shadow:0 8px 24px rgba(15,23,42,0.08)">
        <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a">${copy.title}</h1>
        <p style="margin:0 0 16px;color:#64748b;line-height:1.5">${copy.body}</p>
        <pre style="margin:0;padding:12px;background:#fef2f2;color:#991b1b;border-radius:8px;font-size:12px;white-space:pre-wrap">${msg}</pre>
        <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
          <button type="button" data-boot-reload="1" style="padding:10px 16px;border:none;border-radius:8px;background:#FFD600;font-weight:700;cursor:pointer">${copy.reload}</button>
          <button type="button" data-boot-home="1" style="padding:10px 16px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;font-weight:600;cursor:pointer">${copy.home}</button>
        </div>
      </div>
    </div>`;
    const reloadBtn = typeof root.querySelector === 'function'
        ? root.querySelector('[data-boot-reload]')
        : null;
    const homeBtn = typeof root.querySelector === 'function'
        ? root.querySelector('[data-boot-home]')
        : null;
    if (reloadBtn) {
        reloadBtn.onclick = () => {
            try { sessionStorage.removeItem('filter_chunk_reload'); } catch { /* ignore */ }
            window.location.reload();
        };
    }
    if (homeBtn) {
        homeBtn.onclick = () => {
            try { sessionStorage.removeItem('filter_chunk_reload'); } catch { /* ignore */ }
            window.location.assign('/');
        };
    }
    return true;
}

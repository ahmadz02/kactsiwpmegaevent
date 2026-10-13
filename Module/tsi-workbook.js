/* =========================================================
   TSI e-Workbook — shared storage, toolbar & print header
   ---------------------------------------------------------
   - Profile (Bahagian 1, Wealth Creation) is shared by every card.
   - Each card saves its own inputs with [Save Data].
   - Everything stays in this device's localStorage until
     the participant presses [Padam Data].
   - The saved profile is printed at the top of every card's
     printout (it is never shown on screen).
   ========================================================= */
(function () {
  'use strict';

  var PROFILE_KEY = 'tsiwp-profile-v1';
  var PAGE_PREFIX = 'tsiwp-page-v1:';
  // Every key this app writes, including modules that saved data before this file existed.
  var OWNED_PREFIXES = ['tsiwp-', 'tsi-investment-workbook:'];
  var OWNED_KEYS = ['tsiInvestmentGoalsV1', 'tsiInvestmentGoalReflectionV1'];

  var pageCfg = null;

  /* ---------------- storage ---------------- */
  function readJSON(key) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }

  function getProfile() { return readJSON(PROFILE_KEY); }
  function saveProfile(profile) {
    profile.savedAt = new Date().toISOString();
    return writeJSON(PROFILE_KEY, profile);
  }
  function getPage(id) { return readJSON(PAGE_PREFIX + id); }
  function savePage(id, data) {
    data.savedAt = new Date().toISOString();
    return writeJSON(PAGE_PREFIX + id, data);
  }

  function clearAll() {
    try {
      var doomed = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        var owned = OWNED_KEYS.indexOf(k) !== -1 || OWNED_PREFIXES.some(function (p) { return k.indexOf(p) === 0; });
        if (owned) doomed.push(k);
      }
      doomed.forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) {}
  }

  /* ---------------- phone (Malaysian mobile) ---------------- */
  // Accepts 012-3456789, 012 345 6789, +6012..., 6012...; returns "01X-XXXXXXX(X)" or null.
  function formatPhone(raw) {
    var d = String(raw || '').replace(/[\s-]/g, '');
    if (d.indexOf('+6') === 0) d = d.slice(2);
    else if (d.indexOf('601') === 0) d = d.slice(1);
    if (!/^01\d{8,9}$/.test(d)) return null;
    return d.slice(0, 3) + '-' + d.slice(3);
  }

  /* ---------------- generic form fields ---------------- */
  function fieldKey(el) {
    if (el.type === 'radio') return el.name ? 'radio:' + el.name : null;
    return el.id || null;
  }

  function collectFields(root) {
    var out = {};
    root.querySelectorAll('input, select, textarea').forEach(function (el) {
      if (el.closest('.tsi-toolbar') || el.readOnly) return;
      if (el.type === 'button' || el.type === 'submit' || el.type === 'reset') return;
      var key = fieldKey(el);
      if (!key) return;
      if (el.type === 'radio') { if (el.checked) out[key] = el.value; }
      else if (el.type === 'checkbox') out[key] = el.checked;
      else out[key] = el.value;
    });
    return out;
  }

  function restoreFields(root, saved) {
    Object.keys(saved).forEach(function (key) {
      var el = null;
      if (key.indexOf('radio:') === 0) {
        var name = key.slice(6);
        root.querySelectorAll('input[type="radio"]').forEach(function (r) {
          if (r.name === name && r.value === saved[key]) el = r;
        });
        if (el) el.checked = true;
      } else {
        el = document.getElementById(key);
        if (!el || !root.contains(el)) return;
        if (el.type === 'checkbox') el.checked = !!saved[key];
        else el.value = saved[key];
      }
      if (!el) return;
      // Let the page's own listeners recalculate as if the participant typed it.
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  /* ---------------- styles ---------------- */
  var CSS = [
    '[data-tsi-toolbar]{margin-top:24px;}',
    '.tsi-toolbar{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:8px;font-family:"Plus Jakarta Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}',
    '.tsi-status{flex:1 1 auto;min-width:0;font-size:12px;color:#64748B;}',
    '.tsi-status.ok{color:#047857;font-weight:600;}',
    '.tsi-status.err{color:#B42318;font-weight:600;}',
    '.tsi-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:auto;min-height:40px;padding:9px 16px;border-radius:10px;font-family:inherit;font-size:13.5px;font-weight:700;line-height:1.2;cursor:pointer;transition:background-color .2s,color .2s,border-color .2s;}',
    '.tsi-btn svg{width:16px;height:16px;flex:none;}',
    '.tsi-btn-gold{background:#C5A059;color:#0A2240;border:1px solid #C5A059;}',
    '.tsi-btn-gold:hover{background:#D4AF37;border-color:#D4AF37;}',
    '.tsi-btn-navy{background:#0A2240;color:#C5A059;border:1px solid #0A2240;}',
    '.tsi-btn-navy:hover{background:#11335C;color:#fff;}',
    '.tsi-btn-ghost{background:#fff;color:#B42318;border:1px solid #F1B8B2;}',
    '.tsi-btn-ghost:hover{background:#FEF3F2;}',
    '.tsi-btn:focus-visible{outline:3px solid rgba(197,160,89,.45);outline-offset:2px;}',
    '.tsi-btn{white-space:nowrap;}',
    '@media (max-width:560px){.tsi-status{flex-basis:100%;order:2;text-align:center;}.tsi-btn{flex:1 1 0;padding:9px 8px;font-size:12.5px;}}',
    '@media (max-width:420px){.tsi-btn svg{display:none;}}',
    '#tsi-print-profile{display:none;}',
    '@media print{',
    '  .tsi-noprint,.tsi-toolbar,[data-tsi-toolbar]{display:none !important;}',
    // The portal header (logo bar) is for the screen only.
    '  body > header,.workbook-root > header{display:none !important;}',
    '  #tsi-print-profile:not(.tsi-empty){display:block !important;margin:0 0 14px;padding:10px 14px;border:1.5px solid #C5A059;border-left-width:6px;border-radius:8px;font-family:"Plus Jakarta Sans",Arial,sans-serif;color:#0A2240;background:#fff;break-inside:avoid;}',
    '  #tsi-print-profile .tsi-pp-kicker{font-size:9px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#8A6D2F;}',
    '  #tsi-print-profile .tsi-pp-name{font-size:16px;font-weight:800;margin-top:2px;text-transform:uppercase;}',
    '  #tsi-print-profile .tsi-pp-meta{font-size:11px;margin-top:3px;color:#1E293B;}',
    '}'
  ].join('\n');

  function injectStyles() {
    if (document.getElementById('tsi-workbook-css')) return;
    var style = document.createElement('style');
    style.id = 'tsi-workbook-css';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  /* ---------------- print header ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function ensurePrintHeader() {
    if (document.getElementById('tsi-print-profile')) return;
    var box = document.createElement('div');
    box.id = 'tsi-print-profile';
    box.className = 'tsi-empty';
    document.body.insertBefore(box, document.body.firstChild);
  }

  function renderPrintHeader() {
    var box = document.getElementById('tsi-print-profile');
    if (!box) return;
    var p = getProfile();
    if (!p || !p.name) { box.innerHTML = ''; box.classList.add('tsi-empty'); return; }
    var today = new Date().toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' });
    var meta = [];
    if (p.age) meta.push('Umur: ' + esc(p.age) + ' tahun');
    if (p.marital) meta.push('Status: ' + esc(p.marital));
    if (p.phone) meta.push('No. Telefon: ' + esc(p.phone));
    meta.push('Tarikh Cetak: ' + esc(today));
    box.innerHTML =
      (pageCfg && pageCfg.title ? '<div class="tsi-pp-kicker">' + esc(pageCfg.title) + '</div>' : '') +
      '<div class="tsi-pp-name">' + esc(p.name) + '</div>' +
      '<div class="tsi-pp-meta">' + meta.join(' &nbsp;&bull;&nbsp; ') + '</div>';
    box.classList.remove('tsi-empty');
  }

  /* ---------------- toolbar ---------------- */
  var ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
  var ICON_SAVE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></svg>';
  var ICON_PRINT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>';

  function mountToolbar(host) {
    host.innerHTML =
      '<div class="tsi-toolbar tsi-noprint">' +
        '<span class="tsi-status" role="status" aria-live="polite"></span>' +
        '<button type="button" class="tsi-btn tsi-btn-ghost" data-tsi="clear">' + ICON_TRASH + '<span>Padam Data</span></button>' +
        '<button type="button" class="tsi-btn tsi-btn-navy" data-tsi="save">' + ICON_SAVE + '<span>Save Data</span></button>' +
        '<button type="button" class="tsi-btn tsi-btn-gold" data-tsi="print">' + ICON_PRINT + '<span>Cetak PDF</span></button>' +
      '</div>';
    host.querySelector('[data-tsi="clear"]').addEventListener('click', clearData);
    host.querySelector('[data-tsi="save"]').addEventListener('click', saveData);
    host.querySelector('[data-tsi="print"]').addEventListener('click', printPage);
  }

  function setStatus(msg, kind) {
    document.querySelectorAll('.tsi-status').forEach(function (el) {
      el.textContent = msg;
      el.className = 'tsi-status' + (kind ? ' ' + kind : '');
    });
    if (msg) setTimeout(function () {
      document.querySelectorAll('.tsi-status').forEach(function (el) { if (el.textContent === msg) { el.textContent = ''; el.className = 'tsi-status'; } });
    }, 6000);
  }

  function saveData() {
    var cfg = pageCfg;
    if (cfg.validate) {
      var problem = cfg.validate();
      if (problem) { setStatus(problem, 'err'); alert(problem); return; }
    }
    var ok = cfg.save
      ? cfg.save()
      : savePage(cfg.id, { fields: cfg.root ? collectFields(cfg.root) : {}, extra: cfg.collect ? cfg.collect() : null });
    if (ok) {
      var t = new Date().toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
      setStatus('Data disimpan dalam peranti ini (' + t + ').', 'ok');
      renderPrintHeader();
    } else {
      setStatus('Peranti ini tidak membenarkan simpanan. Cuba pelayar lain atau matikan mod private.', 'err');
    }
  }

  function printPage() {
    if (pageCfg.printHeader !== false && !(getProfile() || {}).name) {
      var go = confirm('Maklumat peribadi belum disimpan.\n\nSila isi Bahagian 1 di kad Wealth Creation dan tekan Save Data supaya nama anda dicetak.\n\nCetak tanpa maklumat peribadi?');
      if (!go) return;
    }
    window.print();
  }

  function clearData() {
    var sure = confirm('Padam semua data yang disimpan dalam peranti ini?\n\nIni termasuk maklumat peribadi dan data SEMUA kad. Tindakan ini tidak boleh dibatalkan.');
    if (!sure) return;
    clearAll();
    location.reload();
  }

  /* ---------------- page setup ----------------
     cfg = {
       id:          storage id for this card
       title:       card name shown on the printed header
       root:        element whose inputs are saved automatically (optional)
       collect():   extra state to save alongside the fields (optional)
       restore(extra, saved): rebuild extra state on load (optional)
       save():      replaces the default save; return true on success (optional)
       validate():  return an error message to block saving (optional)
       beforePrint(): refresh anything that must be current on paper (optional)
       printHeader: false to skip the profile header (card prints its own)
     }
  */
  function initPage(cfg) {
    pageCfg = cfg;
    injectStyles();
    if (cfg.printHeader !== false) ensurePrintHeader();
    document.querySelectorAll('[data-tsi-toolbar]').forEach(mountToolbar);

    var saved = getPage(cfg.id);
    if (saved) {
      if (cfg.root && saved.fields) restoreFields(cfg.root, saved.fields);
      if (cfg.restore) cfg.restore(saved.extra, saved);
    }

    window.addEventListener('beforeprint', function () {
      if (cfg.beforePrint) cfg.beforePrint();
      renderPrintHeader();
    });
    renderPrintHeader();
    return saved;
  }

  window.TSIWorkbook = {
    initPage: initPage,
    getProfile: getProfile,
    saveProfile: saveProfile,
    getPage: getPage,
    savePage: savePage,
    formatPhone: formatPhone,
    print: printPage
  };
})();

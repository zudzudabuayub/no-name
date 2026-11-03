// Общие помощники интерфейса: иконки, окна, уведомления, копирование.

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>',
  video: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3z"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="m12 7.5 3.8 2.8-1.4 4.5H9.6l-1.4-4.5z"/><path d="M12 7.5V3.2M15.8 10.3l4-1.4M14.4 14.8l2.6 3.6M9.6 14.8 7 18.4M8.2 10.3l-4-1.4"/>',
  notes: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M9 12h7M9 16h5"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 8.7-8.7"/><path d="m16 7 3 3"/><path d="m13.5 9.5 2 2"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>',
  sliders: '<path d="M4 6h9M19 6h1M4 12h3M13 12h7M4 18h11M21 18h-1"/><circle cx="16" cy="6" r="2.5"/><circle cx="10" cy="12" r="2.5"/><circle cx="18" cy="18" r="2.5"/>',
  lock: '<rect x="4" y="10.5" width="16" height="10.5" rx="2.5"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  pin: '<path d="M9 4h6l-1 5 4 4H6l4-4z"/><path d="M12 13v7"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
  paste: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 11h6M9 15h4"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>',
  play: '<path d="M8 5v14l11-7z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 20h16"/>',
  upload: '<path d="M12 20V8"/><path d="m7 13 5-5 5 5"/><path d="M4 4h16"/>',
  wand: '<path d="M4 20 15 9"/><path d="m14 3 1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/><path d="m19 11 .7 1.3L21 13l-1.3.7L19 15l-.7-1.3L17 13l1.3-.7z"/>',
  shield: '<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"/><path d="m9 12 2 2 4-4"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.4"/><path d="M12 17h.01"/>',
  dots: '<path d="M5 12h.01M12 12h.01M19 12h.01"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="m7 9 3 3-3 3M13 15h4"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  question: '<path d="M8 4h8a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-3l-4 4v-4H8a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z"/><path d="M10.2 8.6a1.9 1.9 0 1 1 2.6 1.8c-.5.2-.8.6-.8 1.1"/><path d="M12 13.6h.01"/>',
  ticket: '<path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z"/><path d="M10 7v10" stroke-dasharray="2 2"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
};

export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Возвращает нормальный http(s)-адрес или пустую строку. Защищает от javascript: и т.п. */
export function safeUrl(input) {
  let s = String(input || '').trim();
  if (!s) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : '';
  } catch {
    return '';
  }
}

export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function hue(str) {
  let h = 0;
  for (const ch of String(str)) h = (h * 31 + ch.codePointAt(0)) % 360;
  return h;
}

export function letter(str) {
  const s = String(str || '?').trim();
  return (s.match(/[\p{L}\p{N}]/u) || ['?'])[0].toUpperCase();
}

/** Значок сайта с запасным вариантом — первой буквой названия. */
export function favicon(url, title) {
  const host = hostOf(url);
  const l = esc(letter(title || host));
  const img = host ? `<img src="https://icons.duckduckgo.com/ip3/${esc(host)}.ico" alt="" loading="lazy" referrerpolicy="no-referrer">` : '';
  return `<span class="fav" style="--h:${hue(host || title)}" data-l="${l}">${img}</span>`;
}

/** Убирает «сломанные» значки, чтобы показать букву. */
export function bindFavicons(root) {
  $$('.fav img', root).forEach((img) => {
    const kill = () => img.remove();
    const check = () => { if (img.naturalWidth < 8) kill(); else img.classList.add('ok'); };
    if (img.complete) {
      if (img.naturalWidth === 0) kill(); else check();
    } else {
      img.addEventListener('error', kill, { once: true });
      img.addEventListener('load', check, { once: true });
    }
  });
}

export function linkify(escaped) {
  return escaped.replace(/https?:\/\/[^\s<"']+/g, (m) => {
    const trail = m.match(/[.,;:!?)]+$/);
    const url = trail ? m.slice(0, -trail[0].length) : m;
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>${trail ? trail[0] : ''}`;
  });
}

const dateFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });
const dateFmtY = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

export function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'сегодня, ' + timeFmt.format(d);
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'вчера, ' + timeFmt.format(d);
  return (d.getFullYear() === now.getFullYear() ? dateFmt : dateFmtY).format(d);
}

export function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export function toast(msg, type = '') {
  const box = document.getElementById('toasts');
  if (!box) return;
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  box.append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 2600);
}

export async function copyText(text, label = 'Скопировано') {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.append(ta);
    ta.select();
    try { document.execCommand('copy'); } catch { /* ignore */ }
    ta.remove();
  }
  if (label) toast(label, 'success');
}

export async function pasteText() {
  try {
    return await navigator.clipboard.readText();
  } catch {
    toast('Браузер не дал доступ к буферу. Вставьте вручную (долгое нажатие → Вставить)', 'error');
    return '';
  }
}

/**
 * Модальное окно с формой.
 * onSubmit(form, dialog) — вернуть false, чтобы окно не закрылось.
 */
export function modal({ title, body, submit = 'Сохранить', cancel = 'Отмена', danger = false, extra = '', onSubmit, onOpen, wide = false }) {
  const d = document.createElement('dialog');
  d.className = 'modal' + (wide ? ' wide' : '');
  d.innerHTML = `<form class="modal-form" novalidate>
    <header class="modal-head"><h2>${esc(title)}</h2>
      <button type="button" class="btn icon ghost" data-close aria-label="Закрыть">${icon('x')}</button></header>
    <div class="modal-body">${body}</div>
    <footer class="modal-foot">${extra}<span class="spacer"></span>
      ${cancel ? `<button type="button" class="btn ghost" data-close>${esc(cancel)}</button>` : ''}
      ${submit ? `<button type="submit" class="btn ${danger ? 'danger' : 'primary'}">${esc(submit)}</button>` : ''}
    </footer>
  </form>`;
  document.body.append(d);
  const form = d.querySelector('form');
  const close = () => d.close();
  d.addEventListener('close', () => d.remove());
  $$('[data-close]', d).forEach((b) => b.addEventListener('click', close));
  let downOnBackdrop = false;
  d.addEventListener('pointerdown', (e) => { downOnBackdrop = e.target === d; });
  d.addEventListener('click', (e) => { if (e.target === d && downOnBackdrop) close(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!onSubmit) return close();
    const btn = form.querySelector('[type=submit]');
    if (btn) btn.disabled = true;
    try {
      const r = await onSubmit(form, d);
      if (r !== false) close();
    } catch (err) {
      console.error(err);
      toast(err.message || String(err), 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  });
  d.showModal();
  onOpen?.(form, d);
  return d;
}

export function confirmBox(text, { title = 'Вы уверены?', ok = 'Удалить', danger = true } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const d = modal({
      title,
      body: `<p>${esc(text)}</p>`,
      submit: ok,
      danger,
      onSubmit: () => { done = true; resolve(true); },
    });
    d.addEventListener('close', () => { if (!done) resolve(false); });
  });
}

export function setError(form, msg) {
  let el = form.querySelector('.form-error');
  if (!el) {
    el = document.createElement('p');
    el.className = 'form-error';
    el.setAttribute('role', 'alert');
    const body = form.querySelector('.modal-body') || form;
    body.append(el);
  }
  el.textContent = msg || '';
  el.hidden = !msg;
  if (msg) {
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  }
}

export function download(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export function pickFile(accept = '.json,application/json') {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', async () => {
      const f = input.files && input.files[0];
      resolve(f ? await f.text() : null);
    });
    input.click();
  });
}

/** Поле пароля с кнопкой «показать». */
export function passwordField({ name, label, value = '', placeholder = '', autocomplete = 'current-password', extraBtn = '' }) {
  return `<label class="field"><span>${esc(label)}</span>
    <div class="input-group">
      <input class="input" type="password" name="${name}" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="${autocomplete}" spellcheck="false" autocapitalize="off">
      <button type="button" class="btn icon ghost" data-toggle-pw aria-label="Показать пароль">${icon('eye')}</button>${extraBtn}
    </div></label>`;
}

export function bindPasswordToggles(root) {
  $$('[data-toggle-pw]', root).forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = btn.parentElement.querySelector('input');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = icon(show ? 'eyeOff' : 'eye');
      btn.setAttribute('aria-label', show ? 'Скрыть пароль' : 'Показать пароль');
    });
  });
}

export function strengthBar() {
  return '<div class="strength" data-score="0"><i></i><i></i><i></i><i></i><span></span></div>';
}

export function updateStrength(el, { score, label }) {
  if (!el) return;
  el.dataset.score = score;
  el.querySelector('span').textContent = label;
}

export function debounce(fn, ms = 200) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

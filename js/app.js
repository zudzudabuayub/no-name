// Точка входа: выбор экрана, меню, переходы между разделами, автоблокировка.

import * as vault from './vault.js';
import { showLogin, showRegister } from './auth.js';
import { APP_NAME } from './defaults.js';
import { $, $$, esc, icon, toast } from './ui.js';
import * as home from './pages/home.js';
import * as video from './pages/video.js';
import * as football from './pages/football.js';
import * as notes from './pages/notes.js';
import * as passwords from './pages/passwords.js';
import * as links from './pages/links.js';
import * as settings from './pages/settings.js';

const PAGES = { home, video, football, notes, passwords, links, settings };

export const NAV = [
  { id: 'home', label: 'Главная', icon: 'home' },
  { id: 'video', label: 'Видео', icon: 'video' },
  { id: 'football', label: 'Футбол', icon: 'ball' },
  { id: 'notes', label: 'Заметки', icon: 'notes' },
  { id: 'passwords', label: 'Пароли', icon: 'key' },
  { id: 'links', label: 'Ссылки', icon: 'link' },
  { id: 'settings', label: 'Настройки', icon: 'sliders' },
];

const root = document.getElementById('root');
let cleanup = null;
let lockTimer = null;
let lastActive = Date.now();
let lastTouch = 0;
let inApp = false;

function renderShell() {
  const navLinks = (cls) => NAV.map((n) => `<a href="#/${n.id}" data-nav="${n.id}" class="${cls}" style="--c:var(--c-${n.id})">
      ${icon(n.icon)}<span>${esc(n.label)}</span></a>`).join('');
  root.innerHTML = `<div class="app">
    <aside class="sidebar">
      <a class="brand" href="#/home"><img src="icon.svg" alt="" width="32" height="32"><span>${esc(APP_NAME)}</span></a>
      <nav class="side-nav" aria-label="Разделы">${navLinks('side-link')}</nav>
      <button class="side-link lock-btn" id="lock-side">${icon('lock')}<span>Заблокировать</span></button>
    </aside>
    <div class="main">
      <header class="topbar">
        <a class="brand mobile-only" href="#/home"><img src="icon.svg" alt="" width="28" height="28"></a>
        <h1 id="page-title"></h1>
        <div class="top-actions">
          <a class="btn icon ghost mobile-only" href="#/settings" aria-label="Настройки">${icon('sliders')}</a>
          <button class="btn icon ghost" id="lock-top" aria-label="Заблокировать" title="Заблокировать">${icon('lock')}</button>
        </div>
      </header>
      <main id="view" class="view" tabindex="-1"></main>
    </div>
    <nav class="bottom-nav" aria-label="Разделы">${navLinks('bottom-link')}</nav>
  </div>`;
  $('#lock-side').addEventListener('click', () => lockApp(true));
  $('#lock-top').addEventListener('click', () => lockApp(true));
}

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  return { id: PAGES[path] ? path : 'home', params: new URLSearchParams(qs || '') };
}

function route() {
  if (!inApp) return;
  const { id, params } = parseHash();
  if (typeof cleanup === 'function') { try { cleanup(); } catch { /* ignore */ } }
  cleanup = null;
  $$('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === id));
  const page = PAGES[id];
  $('#page-title').textContent = page.title;
  document.title = `${page.title} — ${APP_NAME}`;
  const view = $('#view');
  view.innerHTML = '';
  view.dataset.page = id;
  window.scrollTo(0, 0);
  const ctx = {
    data: vault.getData(),
    params,
    save: () => vault.save().catch((e) => toast('Не удалось сохранить: ' + e.message, 'error')),
    go: (h) => { location.hash = h; },
    lock: () => lockApp(true),
    reload: route,
  };
  cleanup = page.render(view, ctx) || null;
}

function enterApp() {
  inApp = true;
  renderShell();
  route();
  startAutoLock();
}

export function lockApp(manual = false) {
  inApp = false;
  if (typeof cleanup === 'function') { try { cleanup(); } catch { /* ignore */ } }
  cleanup = null;
  stopAutoLock();
  $$('dialog').forEach((d) => d.close());
  vault.lock();
  document.title = APP_NAME;
  showLogin(root, enterApp);
  if (!manual) toast('Сайт заблокирован из-за бездействия');
}

// ---------- Автоблокировка ----------

function onActivity() {
  lastActive = Date.now();
  if (lastActive - lastTouch > 15000) {
    lastTouch = lastActive;
    vault.markActive();
  }
}

function checkLock() {
  if (!inApp) return;
  const min = Number(vault.getData()?.settings?.autoLock) || 0;
  if (min > 0 && Date.now() - lastActive > min * 60000) lockApp(false);
}

function startAutoLock() {
  lastActive = Date.now();
  stopAutoLock();
  lockTimer = setInterval(checkLock, 15000);
}

function stopAutoLock() {
  if (lockTimer) clearInterval(lockTimer);
  lockTimer = null;
}

['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkLock(); });
window.addEventListener('hashchange', route);

// Изменения из другой вкладки
window.addEventListener('storage', async (e) => {
  if (e.key !== vault.STORE_KEY || !inApp) return;
  if (!e.newValue) return lockApp(true);
  const ok = await vault.reload();
  if (!ok) return lockApp(true);
  if (!$('dialog[open]')) route();
});

// ---------- Старт ----------

async function start() {
  if (await vault.restoreSession()) return enterApp();
  if (vault.hasVault()) showLogin(root, enterApp);
  else showRegister(root, enterApp);
}

start().catch((e) => {
  console.error(e);
  root.innerHTML = `<div class="fatal"><h1>Что-то пошло не так</h1><p>${esc(e.message)}</p></div>`;
});

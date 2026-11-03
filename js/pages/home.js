import { $, esc, icon, safeUrl, hostOf, favicon, bindFavicons, plural, debounce } from '../ui.js';
import { CATS, noteProgress, previewText } from './notes.js';

export const title = 'Главная';

const TILES = [
  { id: 'video', icon: 'video', title: 'Скачать видео', sub: () => 'YouTube, Instagram, TikTok…' },
  { id: 'football', icon: 'ball', title: 'Футбол', sub: () => 'Обзоры, счёт, где смотреть' },
  { id: 'notes', icon: 'notes', title: 'Заметки', sub: (d) => count(d.notes.length, 'заметка', 'заметки', 'заметок') },
  { id: 'passwords', icon: 'key', title: 'Пароли', sub: (d) => count(d.passwords.length, 'пароль', 'пароля', 'паролей') },
  { id: 'links', icon: 'link', title: 'Ссылки', sub: (d) => count(d.links.length, 'ссылка', 'ссылки', 'ссылок') },
];

function count(n, a, b, c) {
  return n ? `${n} ${plural(n, a, b, c)}` : 'Пока пусто';
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

export function render(view, ctx) {
  const d = ctx.data;
  const pinned = d.notes.filter((n) => n.pinned).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4);
  const favs = d.links.filter((l) => l.fav).slice(0, 12);

  view.innerHTML = `
    <section class="hero">
      <div>
        <p class="muted" id="today"></p>
        <h2>${greeting()}, ${esc(d.profile.username)}!</h2>
      </div>
      <div class="clock" id="clock"></div>
    </section>

    <section class="card">
      <label class="search big">${icon('search')}
        <input id="gsearch" type="search" placeholder="Поиск по заметкам, паролям и ссылкам…" autocomplete="off" aria-label="Поиск"></label>
      <div id="gresults" class="gresults"></div>
    </section>

    <section class="card quick" style="--c:var(--c-video)">
      <h3>${icon('download')} Скачать видео</h3>
      <form id="qv" class="row nowrap" novalidate>
        <input class="input" name="u" type="url" inputmode="url" placeholder="Вставьте ссылку на видео" autocomplete="off" aria-label="Ссылка на видео">
        <button class="btn primary">Далее</button>
      </form>
    </section>

    <section class="tiles">
      ${TILES.map((t) => `<a class="tile" href="#/${t.id}" style="--c:var(--c-${t.id})">
        <span class="tile-icon">${icon(t.icon)}</span>
        <span class="tile-text"><b>${esc(t.title)}</b><small>${esc(t.sub(d))}</small></span>
        ${icon('chevron', 'tile-arrow')}
      </a>`).join('')}
    </section>

    ${pinned.length ? `<section>
      <div class="sec-head"><h3>Закреплённые заметки</h3><a href="#/notes" class="btn link sm">Все заметки</a></div>
      <div class="mini-notes">${pinned.map((n) => {
        const p = noteProgress(n.body);
        const c = CATS[n.category] || CATS.note;
        return `<a class="mini-note" href="#/notes?open=${esc(n.id)}" style="--c:${c.color}">
          <span class="badge">${esc(c.label)}</span>
          <b>${esc(n.title || 'Без названия')}</b>
          <small>${esc(previewText(n.body, 90))}</small>
          ${p.total ? `<span class="progress"><i style="width:${Math.round((p.done / p.total) * 100)}%"></i></span>` : ''}
        </a>`;
      }).join('')}</div>
    </section>` : ''}

    ${favs.length ? `<section>
      <div class="sec-head"><h3>Избранные ссылки</h3><a href="#/links" class="btn link sm">Все ссылки</a></div>
      <div class="fav-links">${favs.map((l) => {
        const url = safeUrl(l.url);
        return url ? `<a class="fav-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="${esc(hostOf(url))}">
          ${favicon(url, l.title)}<span>${esc(l.title)}</span></a>` : '';
      }).join('')}</div>
    </section>` : ''}
  `;
  bindFavicons(view);

  // Часы
  const clock = $('#clock', view);
  const today = $('#today', view);
  const dateFmt = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  const timeFmt = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const tick = () => {
    const now = new Date();
    clock.textContent = timeFmt.format(now);
    const t = dateFmt.format(now);
    today.textContent = t[0].toUpperCase() + t.slice(1);
  };
  tick();
  const timer = setInterval(tick, 10000);

  // Быстрая ссылка на видео
  $('#qv', view).addEventListener('submit', (e) => {
    e.preventDefault();
    const u = e.target.elements.u.value.trim();
    ctx.go('#/video' + (u ? '?u=' + encodeURIComponent(u) : ''));
  });

  // Общий поиск
  const out = $('#gresults', view);
  const search = debounce((q) => {
    q = q.trim().toLowerCase();
    if (!q) { out.innerHTML = ''; return; }
    const has = (...fields) => fields.some((f) => String(f || '').toLowerCase().includes(q));
    const groups = [
      {
        name: 'Заметки', icon: 'notes', page: 'notes',
        items: d.notes.filter((n) => has(n.title, n.body)).slice(0, 5)
          .map((n) => ({ t: n.title || 'Без названия', s: previewText(n.body, 60), href: `#/notes?open=${n.id}` })),
      },
      {
        name: 'Пароли', icon: 'key', page: 'passwords',
        items: d.passwords.filter((p) => has(p.title, p.url, p.login, p.note)).slice(0, 5)
          .map((p) => ({ t: p.title, s: p.login, href: `#/passwords?open=${p.id}` })),
      },
      {
        name: 'Ссылки', icon: 'link', page: 'links',
        items: d.links.filter((l) => has(l.title, l.url, l.category)).slice(0, 5)
          .map((l) => ({ t: l.title, s: hostOf(safeUrl(l.url)), href: safeUrl(l.url), ext: true })),
      },
    ].filter((g) => g.items.length);
    out.innerHTML = groups.length ? groups.map((g) => `<div class="g-group">
        <h4 style="--c:var(--c-${g.page})">${icon(g.icon)} ${g.name}</h4>
        ${g.items.map((it) => `<a href="${esc(it.href)}" ${it.ext ? 'target="_blank" rel="noopener noreferrer"' : ''}>
          <b>${esc(it.t)}</b><small>${esc(it.s || '')}</small></a>`).join('')}
      </div>`).join('') : '<p class="muted empty-small">Ничего не найдено</p>';
  }, 120);
  $('#gsearch', view).addEventListener('input', (e) => search(e.target.value));

  return () => clearInterval(timer);
}

import { $, esc, icon, uid, safeUrl, hostOf, favicon, bindFavicons, modal, confirmBox, toast } from '../ui.js';
import { linkEditor } from './links.js';

export const title = 'Футбол';

const GROUPS = {
  watch: { title: 'Где смотреть', sub: 'Официальные трансляции и обзоры' },
  scores: { title: 'Счёт и новости', sub: 'Live-результаты, таблицы, расписание' },
};

/** Превращает ссылку YouTube/Rutube в адрес встроенного плеера. */
export function embedOf(raw) {
  const url = safeUrl(raw);
  if (!url) return null;
  const u = new URL(url);
  const host = u.hostname.replace(/^(www\.|m\.|music\.)/, '');
  let id = null;
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (/(^|\.)youtube(-nocookie)?\.com$/.test(host)) {
    id = u.searchParams.get('v');
    const m = u.pathname.match(/^\/(shorts|live|embed|v)\/([\w-]{6,})/);
    if (!id && m) id = m[2];
  }
  if (id && /^[\w-]{6,20}$/.test(id)) {
    const t = u.searchParams.get('t') || u.searchParams.get('start');
    const start = t ? parseInt(String(t).replace(/s$/, ''), 10) : 0;
    return {
      kind: 'youtube',
      id,
      src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0${start ? '&start=' + start : ''}`,
      thumb: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
      page: `https://www.youtube.com/watch?v=${id}`,
    };
  }
  if (host === 'rutube.ru') {
    const m = u.pathname.match(/^\/(?:video|play\/embed|shorts)\/([a-f0-9]{16,40})/i);
    if (m) {
      return { kind: 'rutube', id: m[1], src: `https://rutube.ru/play/embed/${m[1]}`, thumb: '', page: `https://rutube.ru/video/${m[1]}/` };
    }
  }
  return null;
}

export function render(view, ctx) {
  const fb = ctx.data.football;
  let current = null;

  view.innerHTML = `
    <section class="card" style="--c:var(--c-football)">
      <h3>${icon('play')} Смотреть видео</h3>
      <form id="fb-play" class="row nowrap" novalidate>
        <input class="input" name="u" type="url" inputmode="url" placeholder="Ссылка на YouTube или Rutube" autocomplete="off" aria-label="Ссылка на видео">
        <button class="btn primary">Смотреть</button>
      </form>
      <div id="player"></div>
    </section>

    <section class="card" style="--c:var(--c-football)">
      <h3>${icon('search')} Найти обзор матча</h3>
      <form id="fb-search" class="row nowrap" novalidate>
        <input class="input" name="q" placeholder="Например: Реал Барселона" autocomplete="off" aria-label="Команды или матч">
        <button class="btn">На YouTube</button>
      </form>
      <div class="chips quick-q">${['Обзор матча', 'Лига чемпионов', 'АПЛ', 'Ла Лига', 'Голы недели'].map((q) => `<button class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
    </section>

    <div id="fb-groups"></div>

    <section class="card" id="fb-saved"></section>
    <p class="legal">Здесь только официальные и бесплатные источники. Добавить свои сайты можно кнопкой «+».</p>`;

  const player = $('#player', view);

  function play(e, titleText) {
    current = e;
    player.innerHTML = `<div class="player"><iframe src="${esc(e.src)}" title="${esc(titleText || 'Видео')}"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
      <div class="row">
        <button class="btn sm" id="pl-save">${icon('star')} В избранное</button>
        <a class="btn sm ghost" href="${esc(e.page)}" target="_blank" rel="noopener noreferrer">${icon('external')} Открыть на сайте</a>
        <button class="btn sm ghost" id="pl-close">${icon('x')} Закрыть</button>
      </div>`;
    $('#pl-close', player).addEventListener('click', () => { player.innerHTML = ''; current = null; });
    $('#pl-save', player).addEventListener('click', () => saveVideo(current));
    player.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function saveVideo(e) {
    if (fb.videos.some((v) => embedOf(v.url)?.id === e.id)) { toast('Уже в избранном'); return; }
    modal({
      title: 'Сохранить видео',
      submit: 'Сохранить',
      body: `<label class="field"><span>Название</span>
        <input class="input" name="t" maxlength="100" placeholder="Например: Реал — Барселона, обзор"></label>`,
      onOpen: (form) => form.elements.t.focus(),
      async onSubmit(form) {
        fb.videos.unshift({ id: uid(), title: form.elements.t.value.trim() || 'Видео', url: e.page, at: Date.now() });
        await ctx.save();
        toast('Сохранено', 'success');
        drawSaved();
      },
    });
  }

  $('#fb-play', view).addEventListener('submit', (ev) => {
    ev.preventDefault();
    const raw = ev.target.elements.u.value.trim();
    const e = embedOf(raw);
    if (e) play(e);
    else if (safeUrl(raw)) {
      toast('Это не YouTube/Rutube — открываю в новой вкладке');
      window.open(safeUrl(raw), '_blank', 'noopener');
    } else toast('Вставьте ссылку на видео', 'error');
  });

  const ytSearch = (q) => window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(q), '_blank', 'noopener');
  $('#fb-search', view).addEventListener('submit', (ev) => {
    ev.preventDefault();
    const q = ev.target.elements.q.value.trim();
    ytSearch(q ? `обзор матча ${q}` : 'обзор матча');
  });
  view.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => ytSearch(b.dataset.q)));

  function drawGroups() {
    $('#fb-groups', view).innerHTML = Object.entries(GROUPS).map(([g, info]) => {
      const ls = fb.links.filter((l) => l.group === g);
      return `<section class="link-group">
        <div class="sec-head"><div><h3 class="group-title">${esc(info.title)}</h3><small class="muted">${esc(info.sub)}</small></div>
          <button class="btn icon sm" data-add="${g}" aria-label="Добавить">${icon('plus')}</button></div>
        <div class="link-grid">${ls.map((l) => {
          const url = safeUrl(l.url);
          return `<div class="link-tile" data-id="${esc(l.id)}">
            <a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${favicon(url, l.title)}
              <span class="lt-text"><b>${esc(l.title)}</b><small>${esc(hostOf(url))}</small></span></a>
            <button class="btn icon ghost sm" data-edit aria-label="Изменить">${icon('dots')}</button>
          </div>`;
        }).join('') || '<p class="muted small">Пусто</p>'}</div>
      </section>`;
    }).join('');
    bindFavicons($('#fb-groups', view));
  }

  $('#fb-groups', view).addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    const ed = e.target.closest('[data-edit]');
    if (!add && !ed) return;
    const link = ed ? fb.links.find((l) => l.id === ed.closest('.link-tile').dataset.id) : null;
    const group = add ? add.dataset.add : link.group;
    linkEditor({
      link,
      categoryField: false,
      withFav: false,
      async onSave(vals, existing) {
        if (existing) Object.assign(existing, { title: vals.title, url: vals.url });
        else fb.links.push({ id: uid(), group, title: vals.title, url: vals.url });
        await ctx.save();
        drawGroups();
      },
      async onDelete(existing) {
        fb.links = fb.links.filter((l) => l.id !== existing.id);
        await ctx.save();
        drawGroups();
      },
    });
  });

  function drawSaved() {
    const box = $('#fb-saved', view);
    box.innerHTML = `<div class="sec-head"><h3>${icon('star')} Избранные видео</h3></div>
      ${fb.videos.length ? `<div class="videos">${fb.videos.map((v) => {
        const e = embedOf(v.url);
        return `<div class="video" data-id="${esc(v.id)}">
          <button class="video-thumb" data-play aria-label="Смотреть">${e && e.thumb ? `<img src="${esc(e.thumb)}" alt="" loading="lazy">` : ''}<span>${icon('play')}</span></button>
          <div class="video-meta"><b>${esc(v.title)}</b>
            <button class="btn icon ghost sm" data-del aria-label="Удалить">${icon('trash')}</button></div>
        </div>`;
      }).join('')}</div>` : '<p class="muted small">Нажмите «В избранное» под видео, чтобы сохранить его здесь.</p>'}`;
  }

  $('#fb-saved', view).addEventListener('click', async (e) => {
    const card = e.target.closest('.video');
    if (!card) return;
    const v = fb.videos.find((x) => x.id === card.dataset.id);
    if (!v) return;
    if (e.target.closest('[data-play]')) {
      const em = embedOf(v.url);
      if (em) play(em, v.title);
    } else if (e.target.closest('[data-del]')) {
      if (!(await confirmBox(`Убрать «${v.title}» из избранного?`, { ok: 'Убрать' }))) return;
      fb.videos = fb.videos.filter((x) => x.id !== v.id);
      await ctx.save();
      drawSaved();
    }
  });

  drawGroups();
  drawSaved();
}

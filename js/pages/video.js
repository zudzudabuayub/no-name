import { $, $$, esc, icon, uid, safeUrl, hostOf, modal, confirmBox, toast, copyText, pasteText, fmtDate, debounce } from '../ui.js';
import { api, fileUrl, hasServer, serverModal } from '../server.js';

const QUALITY_LABELS = { best: 'Максимум', 1080: '1080p', 720: '720p', 480: '480p', 360: '360p', audio: 'Только звук MP3' };

function fmtDuration(sec) {
  if (!sec) return '';
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
}

function fmtSize(bytes) {
  if (!bytes) return '';
  const mb = bytes / 1048576;
  return mb >= 1024 ? (mb / 1024).toFixed(1) + ' ГБ' : mb >= 10 ? Math.round(mb) + ' МБ' : mb.toFixed(1) + ' МБ';
}

/** Какие варианты качества показать для видео с такими разрешениями. */
function qualityOptions(info) {
  if (!info.has_video) return ['audio'];
  const max = info.heights[0] || 0;
  const opts = [];
  if (!max || max > 1080) opts.push('best');
  for (const h of [1080, 720, 480, 360]) if (max && max >= h) opts.push(String(h));
  if (max && max < 360) opts.push('best');
  opts.push('audio');
  return opts;
}

export const title = 'Скачать видео';

export const PLATFORMS = [
  { id: 'youtube', name: 'YouTube', color: '#ff0033', re: /(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/ },
  { id: 'instagram', name: 'Instagram', color: '#e1306c', re: /(^|\.)instagram\.com$/ },
  { id: 'tiktok', name: 'TikTok', color: '#00c2c7', re: /(^|\.)tiktok\.com$/ },
  { id: 'facebook', name: 'Facebook', color: '#1877f2', re: /(^|\.)(facebook\.com|fb\.watch|fb\.com)$/ },
  { id: 'twitter', name: 'X / Twitter', color: '#64748b', re: /(^|\.)(twitter\.com|x\.com)$/ },
  { id: 'vk', name: 'VK', color: '#0077ff', re: /(^|\.)(vk\.com|vk\.ru|vkvideo\.ru)$/ },
  { id: 'ok', name: 'Одноклассники', color: '#ee8208', re: /(^|\.)ok\.ru$/ },
  { id: 'rutube', name: 'Rutube', color: '#14191f', re: /(^|\.)rutube\.ru$/ },
  { id: 'pinterest', name: 'Pinterest', color: '#e60023', re: /(^|\.)(pinterest\.[a-z.]+|pin\.it)$/ },
  { id: 'reddit', name: 'Reddit', color: '#ff4500', re: /(^|\.)(reddit\.com|redd\.it)$/ },
  { id: 'vimeo', name: 'Vimeo', color: '#1ab7ea', re: /(^|\.)vimeo\.com$/ },
  { id: 'twitch', name: 'Twitch', color: '#9146ff', re: /(^|\.)twitch\.tv$/ },
  { id: 'soundcloud', name: 'SoundCloud', color: '#ff5500', re: /(^|\.)soundcloud\.com$/ },
  { id: 'dailymotion', name: 'Dailymotion', color: '#0d0d0d', re: /(^|\.)(dailymotion\.com|dai\.ly)$/ },
  { id: 'threads', name: 'Threads', color: '#555', re: /(^|\.)(threads\.net|threads\.com)$/ },
  { id: 'snapchat', name: 'Snapchat', color: '#e6c800', re: /(^|\.)snapchat\.com$/ },
  { id: 'likee', name: 'Likee', color: '#ff3b6b', re: /(^|\.)likee\.(video|com)$/ },
];

export function detect(url) {
  const host = hostOf(url);
  return PLATFORMS.find((p) => p.re.test(host)) || null;
}

const FORMATS = [
  { id: 'best', label: 'Лучшее качество', args: '' },
  { id: '1080', label: '1080p MP4', args: '-S "res:1080,ext:mp4:m4a" --merge-output-format mp4 ' },
  { id: '720', label: '720p MP4', args: '-S "res:720,ext:mp4:m4a" --merge-output-format mp4 ' },
  { id: 'mp3', label: 'Только звук MP3', args: '-x --audio-format mp3 ' },
];

function command(url, fmt) {
  const f = FORMATS.find((x) => x.id === fmt) || FORMATS[0];
  return `yt-dlp --no-playlist ${f.args}"${url}"`;
}

function serviceHref(svc, url) {
  return svc.url.includes('{url}') ? svc.url.split('{url}').join(encodeURIComponent(url)) : svc.url;
}

function matches(svc, platform) {
  return svc.platforms.includes('all') || (platform && svc.platforms.includes(platform.id));
}

export function render(view, ctx) {
  const dl = ctx.data.downloads;
  let url = '';
  let fmt = 'best';
  try { fmt = localStorage.getItem('moi-sait:fmt') || 'best'; } catch { /* ignore */ }

  view.innerHTML = `
    <section class="card dl-card">
      <p class="muted">Вставьте ссылку на видео — сайт определит платформу и покажет, как его скачать.</p>
      <div class="dl-input">
        <label class="search big">${icon('link')}
          <input id="dl-url" type="url" inputmode="url" placeholder="https://www.youtube.com/watch?v=…" autocomplete="off" aria-label="Ссылка на видео"></label>
        <button type="button" class="btn" id="dl-paste">${icon('paste')}<span>Вставить</span></button>
      </div>
      <div class="pf-list">${PLATFORMS.slice(0, 10).map((p) => `<span class="pf-dot" style="--pf:${p.color}">${esc(p.name)}</span>`).join('')}<span class="muted small">и ещё 1000+ сайтов</span></div>
    </section>

    <div id="dl-here"></div>
    <div id="dl-result"></div>

    <section class="card" id="srv-card"></section>

    <section class="card">
      <div class="sec-head"><h3>${icon('external')} Сторонние сервисы</h3>
        <button class="btn sm" id="svc-add">${icon('plus')} Добавить</button></div>
      <div id="svc-list" class="svc-list"></div>
      <p class="hint">В адресе сервиса можно написать <span class="mono">{url}</span> — туда подставится ссылка на видео.
        Сторонние сайты могут показывать рекламу: ничего не устанавливайте с них и не вводите пароли.</p>
    </section>

    <section class="card" id="hist-card"></section>

    <p class="legal">Скачивайте только своё видео или то, что разрешено автором, — для личного просмотра.</p>`;

  const input = $('#dl-url', view);
  const result = $('#dl-result', view);
  const here = $('#dl-here', view);
  let alive = true;
  let infoToken = 0;
  let pollTimer = null;

  function stopPoll() { if (pollTimer) clearTimeout(pollTimer); pollTimer = null; }

  // ---------- Скачивание прямо здесь (через ваш сервер) ----------

  function drawServerCard() {
    const card = $('#srv-card', view);
    const s = dl.server || {};
    card.innerHTML = s.url
      ? `<div class="sec-head"><h3>${icon('shield')} Ваш сервер скачивания</h3>
          <button class="btn sm ghost" id="srv-edit">${icon('edit')} Изменить</button></div>
         <p class="muted small ellipsis">Подключён: <span class="mono">${esc(s.url)}</span></p>`
      : `<div class="sec-head"><h3>${icon('download')} Скачивать прямо здесь</h3></div>
         <p class="muted">Подключите свой бесплатный сервер (как в nova-downloader) — и видео будет скачиваться
           прямо с этого сайта, без сторонних сервисов и рекламы.</p>
         <button class="btn primary" id="srv-edit">${icon('plus')} Подключить сервер</button>`;
    $('#srv-edit', card).addEventListener('click', () => serverModal(ctx, () => { drawServerCard(); drawResult(true); }));
  }

  async function drawHere(u, p) {
    stopPoll();
    const token = ++infoToken;
    here.innerHTML = `<section class="card here" style="--pf:${p ? p.color : 'var(--accent)'}">
      <div class="here-loading"><span class="spinner"></span><span id="here-msg">Получаю информацию о видео…</span></div>
    </section>`;
    let info;
    try {
      info = await api(ctx.data, '/api/info', {
        body: { url: u },
        timeout: 120000,
        onSlow: () => { const m = $('#here-msg', here); if (m) m.textContent = 'Сервер просыпается (бесплатный хостинг засыпает без дела) — до минуты…'; },
      });
    } catch (e) {
      if (token !== infoToken || !alive) return;
      here.innerHTML = `<section class="card here" style="--pf:${p ? p.color : 'var(--accent)'}">
        <p class="form-error">${esc(e.message)}</p>
        <div class="row"><button class="btn sm" id="here-retry">${icon('refresh')} Повторить</button>
        ${e.status === 401 || e.status === 0 ? `<button class="btn sm ghost" id="here-srv">${icon('edit')} Настройки сервера</button>` : ''}</div>
      </section>`;
      $('#here-retry', here).addEventListener('click', () => drawHere(u, p));
      $('#here-srv', here)?.addEventListener('click', () => serverModal(ctx, () => { drawServerCard(); drawResult(true); }));
      return;
    }
    if (token !== infoToken || !alive) return;

    const opts = qualityOptions(info);
    const saved = dl.quality || '720';
    const chosen = opts.includes(saved) ? saved : (opts.find((o) => o !== 'best' && o !== 'audio' && Number(o) <= 720) || opts[0]);
    const meta = [info.uploader, fmtDuration(info.duration)].filter(Boolean).join(' · ');
    here.innerHTML = `<section class="card here" style="--pf:${p ? p.color : 'var(--accent)'}">
      <div class="here-head">
        ${info.thumbnail && safeUrl(info.thumbnail) ? `<img class="here-thumb" src="${esc(safeUrl(info.thumbnail))}" alt="" referrerpolicy="no-referrer">` : `<div class="here-thumb ph">${icon('video')}</div>`}
        <div class="here-info">
          <span class="pf-badge">${esc(p ? p.name : (info.platform || hostOf(u)))}</span>
          <h3>${esc(info.title)}</h3>
          ${meta ? `<small class="muted">${esc(meta)}</small>` : ''}
        </div>
      </div>
      <div class="seg" role="radiogroup" aria-label="Качество">${opts.map((o) => `<label><input type="radio" name="q" value="${o}" ${o === chosen ? 'checked' : ''}><span>${esc(o === 'best' && info.heights[0] ? `Максимум (${info.heights[0]}p)` : QUALITY_LABELS[o])}</span></label>`).join('')}</div>
      <button class="btn primary lg block" id="here-go">${icon('download')} Скачать</button>
      <div id="job"></div>
    </section>`;
    $$('img.here-thumb', here).forEach((img) => img.addEventListener('error', () => img.replaceWith(Object.assign(document.createElement('div'), { className: 'here-thumb ph' })), { once: true }));
    $('#here-go', here).addEventListener('click', () => {
      const q = $('input[name=q]:checked', here)?.value || chosen;
      if (dl.quality !== q) { dl.quality = q; ctx.save(); }
      startJob(u, p, q, info);
    });
  }

  async function startJob(u, p, q, info) {
    stopPoll();
    const box = $('#job', here);
    const go = $('#here-go', here);
    go.disabled = true;
    box.innerHTML = `<div class="job"><div class="job-text"><span class="spinner"></span><span id="job-msg">Отправляю на сервер…</span></div>
      <span class="progress big"><i id="job-bar" style="width:0%"></i></span></div>`;
    addHistory(u, p);
    let id;
    try {
      ({ id } = await api(ctx.data, '/api/jobs', { body: { url: u, quality: q }, timeout: 60000 }));
    } catch (e) {
      go.disabled = false;
      box.innerHTML = `<p class="form-error">${esc(e.message)}</p>`;
      return;
    }
    const poll = async () => {
      if (!alive) return;
      let s;
      try {
        s = await api(ctx.data, '/api/jobs/' + id, { timeout: 30000 });
      } catch (e) {
        if (!alive) return;
        pollTimer = setTimeout(poll, 2500);
        return;
      }
      if (!alive || !$('#job-msg', box)) return;
      const bar = $('#job-bar', box);
      const msg = $('#job-msg', box);
      if (s.status === 'queued') msg.textContent = 'В очереди…';
      else if (s.status === 'downloading') {
        const extra = [s.speed ? fmtSize(s.speed) + '/с' : '', s.eta ? `осталось ${fmtDuration(s.eta)}` : ''].filter(Boolean).join(' · ');
        msg.textContent = `Сервер скачивает видео… ${Math.round(s.progress || 0)}%${extra ? ' · ' + extra : ''}`;
      } else if (s.status === 'processing') msg.textContent = q === 'audio' ? 'Делаю MP3…' : 'Склеиваю видео и звук…';
      bar.style.width = (s.progress || 0) + '%';
      if (s.status === 'done') return showDone(id, s, q, info);
      if (s.status === 'error') {
        go.disabled = false;
        box.innerHTML = `<p class="form-error">${esc(s.error || 'Ошибка')}</p>`;
        return;
      }
      pollTimer = setTimeout(poll, 1000);
    };
    poll();
  }

  function showDone(id, s, q, info) {
    const box = $('#job', here);
    const go = $('#here-go', here);
    go.disabled = false;
    go.innerHTML = `${icon('refresh')} Скачать в другом качестве`;
    go.classList.remove('primary');
    const inline = fileUrl(ctx.data, id, true);
    box.innerHTML = `<div class="job-done">
      ${q === 'audio'
        ? `<audio controls preload="metadata" src="${esc(inline)}"></audio>`
        : `<video controls playsinline preload="metadata" src="${esc(inline)}" ${info.thumbnail && safeUrl(info.thumbnail) ? `poster="${esc(safeUrl(info.thumbnail))}"` : ''}></video>`}
      <a class="btn primary lg block" href="${esc(fileUrl(ctx.data, id))}" download="${esc(s.filename || '')}">${icon('download')} Сохранить на устройство${s.size ? ` (${fmtSize(s.size)})` : ''}</a>
      <p class="hint">${icon('check')} Готово: <b>${esc(s.filename || '')}</b>. Файл хранится на сервере 20 минут.</p>
    </div>`;
    toast('Видео готово', 'success');
  }

  function addHistory(u, platform) {
    if (!dl.saveHistory) return;
    dl.history = [{ url: u, platform: platform?.id || '', at: Date.now() }, ...dl.history.filter((h) => h.url !== u)].slice(0, 30);
    ctx.save();
    drawHistory();
  }

  let lastDrawn = null;
  function drawResult(force) {
    const raw = input.value.trim();
    // вставка и ввод срабатывают оба — не запрашиваем сервер дважды для той же ссылки
    if (force !== true && raw === lastDrawn) return;
    lastDrawn = raw;
    stopPoll();
    infoToken++;
    if (!raw) { result.innerHTML = ''; here.innerHTML = ''; url = ''; return; }
    url = safeUrl(raw);
    if (!url || !hostOf(url).includes('.')) {
      here.innerHTML = '';
      result.innerHTML = '<section class="card"><p class="form-error">Это не похоже на ссылку. Скопируйте адрес видео через «Поделиться → Копировать ссылку».</p></section>';
      return;
    }
    const p = detect(url);
    const svcs = dl.services.filter((s) => matches(s, p));
    const viaServer = hasServer(ctx.data);
    if (viaServer) drawHere(url, p);
    else here.innerHTML = '';
    result.innerHTML = `<${viaServer ? 'details' : 'section'} class="card result ${viaServer ? 'other-ways' : ''}" style="--pf:${p ? p.color : 'var(--accent)'}">
      ${viaServer ? '<summary>Другие способы скачать</summary>' : `<div class="result-head">
        <span class="pf-badge">${esc(p ? p.name : hostOf(url))}</span>
        <a class="ellipsis muted small" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>
      </div>`}

      <h4>1. Скачать онлайн</h4>
      ${svcs.length ? `<div class="svc-buttons">${svcs.map((s) => `<a class="svc-btn" data-svc="${esc(s.id)}" href="${esc(serviceHref(s, url))}" target="_blank" rel="noopener noreferrer">
          <b>${esc(s.name)} ${icon('external')}</b><small>${esc(s.note || (s.url.includes('{url}') ? 'Ссылка подставится сама' : 'Ссылку нужно вставить'))}</small></a>`).join('')}</div>`
        : '<p class="muted">Нет сервисов для этой платформы. Добавьте свой ниже или используйте yt-dlp.</p>'}
      <p class="hint">${icon('help')} При нажатии ссылка копируется. Если сайт не подставил её сам — вставьте в поле на сайте (долгое нажатие → «Вставить»).</p>

      <h4>2. Через программу yt-dlp <span class="muted small">(лучшее качество, на компьютере)</span></h4>
      <div class="seg small" role="radiogroup">${FORMATS.map((f) => `<label><input type="radio" name="fmt" value="${f.id}" ${f.id === fmt ? 'checked' : ''}><span>${esc(f.label)}</span></label>`).join('')}</div>
      <div class="cmd"><code id="cmd">${esc(command(url, fmt))}</code>
        <button class="btn icon ghost" id="cmd-copy" aria-label="Копировать команду">${icon('copy')}</button></div>
      <details class="howto">
        <summary>Как установить yt-dlp?</summary>
        <ul>
          <li><b>Windows:</b> откройте «Терминал» и выполните <span class="mono">winget install yt-dlp.yt-dlp Gyan.FFmpeg</span></li>
          <li><b>macOS:</b> <span class="mono">brew install yt-dlp ffmpeg</span></li>
          <li><b>Linux:</b> <span class="mono">pipx install yt-dlp</span> и ffmpeg из пакетов системы</li>
          <li><b>Android:</b> приложение <a href="https://github.com/JunkFood02/Seal" target="_blank" rel="noopener noreferrer">Seal</a> (бесплатное, на основе yt-dlp) — просто «Поделиться» видео в Seal.</li>
        </ul>
        <p class="muted small">Потом вставьте команду в терминал — видео сохранится в текущую папку. Если YouTube перестал скачиваться — обновите: <span class="mono">yt-dlp -U</span>.</p>
      </details>
    </${viaServer ? 'details' : 'section'}>`;

    $$('[data-svc]', result).forEach((a) => a.addEventListener('click', () => { copyText(url, ''); addHistory(url, p); }));
    $$('input[name=fmt]', result).forEach((r) => r.addEventListener('change', () => {
      fmt = r.value;
      try { localStorage.setItem('moi-sait:fmt', fmt); } catch { /* ignore */ }
      $('#cmd', result).textContent = command(url, fmt);
    }));
    $('#cmd-copy', result).addEventListener('click', () => { copyText(command(url, fmt), 'Команда скопирована'); addHistory(url, p); });
  }

  function drawServices() {
    $('#svc-list', view).innerHTML = dl.services.map((s) => `<div class="svc-row" data-id="${esc(s.id)}">
      <div><b>${esc(s.name)}</b><small class="muted">${esc(s.platforms.includes('all') ? 'Все платформы' : s.platforms.map((id) => PLATFORMS.find((p) => p.id === id)?.name || id).join(', '))}</small></div>
      <button class="btn icon ghost sm" data-act="edit" aria-label="Изменить">${icon('edit')}</button>
    </div>`).join('') || '<p class="muted">Сервисов нет.</p>';
  }

  function drawHistory() {
    const card = $('#hist-card', view);
    const items = dl.history;
    card.innerHTML = `<div class="sec-head"><h3>${icon('history')} Недавние ссылки</h3>
        ${items.length ? '<button class="btn sm ghost" id="h-clear">Очистить</button>' : ''}</div>
      ${items.length ? `<div class="hist">${items.map((h, i) => {
        const p = PLATFORMS.find((x) => x.id === h.platform);
        return `<div class="hist-row"><span class="pf-dot" style="--pf:${p ? p.color : 'var(--muted)'}">${esc(p ? p.name : hostOf(h.url))}</span>
          <button class="ellipsis link-like" data-i="${i}">${esc(h.url)}</button><small class="muted">${esc(fmtDate(h.at))}</small></div>`;
      }).join('')}</div>` : `<p class="muted small">${dl.saveHistory ? 'Здесь появятся ссылки, которые вы скачивали.' : 'История выключена.'}</p>`}
      <label class="check-line small"><input type="checkbox" id="h-save" ${dl.saveHistory ? 'checked' : ''}> Сохранять историю</label>`;
    $('#h-clear', card)?.addEventListener('click', async () => {
      if (!(await confirmBox('Очистить историю ссылок?', { ok: 'Очистить' }))) return;
      dl.history = [];
      await ctx.save();
      drawHistory();
    });
    $('#h-save', card).addEventListener('change', async (e) => {
      dl.saveHistory = e.target.checked;
      if (!dl.saveHistory) dl.history = [];
      await ctx.save();
      drawHistory();
    });
    card.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => {
      input.value = items[Number(b.dataset.i)].url;
      drawResult(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }));
  }

  function editService(svc) {
    const isNew = !svc;
    const s = svc || { name: '', url: '', platforms: ['all'], note: '' };
    const all = s.platforms.includes('all');
    modal({
      title: isNew ? 'Новый сервис' : 'Изменить сервис',
      extra: isNew ? '' : `<button type="button" class="btn ghost danger-text" data-del>${icon('trash')} Удалить</button>`,
      body: `
        <label class="field"><span>Название</span><input class="input" name="name" maxlength="40" value="${esc(s.name)}"></label>
        <label class="field"><span>Адрес</span><input class="input mono" name="url" value="${esc(s.url)}" placeholder="https://example.com/?url={url}"></label>
        <p class="hint">Если сайт принимает ссылку в адресе, напишите на её месте <span class="mono">{url}</span>.</p>
        <label class="field"><span>Подпись <em>(необязательно)</em></span><input class="input" name="note" maxlength="80" value="${esc(s.note || '')}"></label>
        <label class="check-line"><input type="checkbox" name="all" ${all ? 'checked' : ''}> Для всех платформ</label>
        <div class="pf-checks ${all ? 'hidden' : ''}">${PLATFORMS.map((p) => `<label class="check-line small"><input type="checkbox" name="pf" value="${p.id}" ${s.platforms.includes(p.id) ? 'checked' : ''}> ${esc(p.name)}</label>`).join('')}</div>`,
      onOpen(form, dlg) {
        form.elements.all.addEventListener('change', () => $('.pf-checks', form).classList.toggle('hidden', form.elements.all.checked));
        $('[data-del]', form)?.addEventListener('click', async () => {
          if (!(await confirmBox(`Удалить сервис «${s.name}»?`))) return;
          dl.services = dl.services.filter((x) => x.id !== svc.id);
          await ctx.save();
          dlg.close();
          drawServices();
          drawResult(true);
        });
        form.elements.name.focus();
      },
      async onSubmit(form) {
        const name = form.elements.name.value.trim();
        const u = form.elements.url.value.trim();
        if (!name) { toast('Укажите название', 'error'); return false; }
        if (!safeUrl(u.split('{url}').join('x'))) { toast('Неверный адрес', 'error'); return false; }
        const platforms = form.elements.all.checked ? ['all'] : $$('input[name=pf]:checked', form).map((c) => c.value);
        if (!platforms.length) { toast('Выберите хотя бы одну платформу', 'error'); return false; }
        const target = svc || { id: uid() };
        Object.assign(target, { name, url: safeUrl(u.split('{url}').join('__URL__')).split('__URL__').join('{url}'), platforms, note: form.elements.note.value.trim() });
        if (isNew) dl.services.push(target);
        await ctx.save();
        drawServices();
        drawResult(true);
      },
    });
  }

  input.addEventListener('input', debounce(drawResult, 500));
  input.addEventListener('paste', () => setTimeout(drawResult, 0));
  $('#dl-paste', view).addEventListener('click', async () => {
    const t = await pasteText();
    if (t) { input.value = t.trim(); drawResult(true); }
  });
  $('#svc-add', view).addEventListener('click', () => editService());
  $('#svc-list', view).addEventListener('click', (e) => {
    const row = e.target.closest('.svc-row');
    if (row && e.target.closest('[data-act]')) editService(dl.services.find((s) => s.id === row.dataset.id));
  });

  drawServerCard();
  drawServices();
  drawHistory();
  const initial = ctx.params.get('u');
  if (initial) {
    input.value = initial;
    drawResult(true);
    history.replaceState(null, '', '#/video');
  } else {
    input.focus();
  }
  return () => { alive = false; stopPoll(); };
}

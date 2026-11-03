import { $, $$, esc, icon, uid, safeUrl, hostOf, modal, confirmBox, toast, copyText, pasteText, fmtDate, debounce } from '../ui.js';

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

    <div id="dl-result"></div>

    <section class="card">
      <div class="sec-head"><h3>${icon('download')} Сервисы для скачивания</h3>
        <button class="btn sm" id="svc-add">${icon('plus')} Добавить</button></div>
      <div id="svc-list" class="svc-list"></div>
      <p class="hint">В адресе сервиса можно написать <span class="mono">{url}</span> — туда подставится ссылка на видео.
        Сторонние сайты могут показывать рекламу: ничего не устанавливайте с них и не вводите пароли.</p>
    </section>

    <section class="card" id="hist-card"></section>

    <p class="legal">Скачивайте только своё видео или то, что разрешено автором, — для личного просмотра.</p>`;

  const input = $('#dl-url', view);
  const result = $('#dl-result', view);

  function addHistory(u, platform) {
    if (!dl.saveHistory) return;
    dl.history = [{ url: u, platform: platform?.id || '', at: Date.now() }, ...dl.history.filter((h) => h.url !== u)].slice(0, 30);
    ctx.save();
    drawHistory();
  }

  function drawResult() {
    const raw = input.value.trim();
    if (!raw) { result.innerHTML = ''; url = ''; return; }
    url = safeUrl(raw);
    if (!url || !hostOf(url).includes('.')) {
      result.innerHTML = '<section class="card"><p class="form-error">Это не похоже на ссылку. Скопируйте адрес видео через «Поделиться → Копировать ссылку».</p></section>';
      return;
    }
    const p = detect(url);
    const svcs = dl.services.filter((s) => matches(s, p));
    result.innerHTML = `<section class="card result" style="--pf:${p ? p.color : 'var(--accent)'}">
      <div class="result-head">
        <span class="pf-badge">${esc(p ? p.name : hostOf(url))}</span>
        <a class="ellipsis muted small" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>
      </div>

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
    </section>`;

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
      drawResult();
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
          drawResult();
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
        drawResult();
      },
    });
  }

  input.addEventListener('input', debounce(drawResult, 250));
  input.addEventListener('paste', () => setTimeout(drawResult, 0));
  $('#dl-paste', view).addEventListener('click', async () => {
    const t = await pasteText();
    if (t) { input.value = t.trim(); drawResult(); }
  });
  $('#svc-add', view).addEventListener('click', () => editService());
  $('#svc-list', view).addEventListener('click', (e) => {
    const row = e.target.closest('.svc-row');
    if (row && e.target.closest('[data-act]')) editService(dl.services.find((s) => s.id === row.dataset.id));
  });

  drawServices();
  drawHistory();
  const initial = ctx.params.get('u');
  if (initial) {
    input.value = initial;
    drawResult();
    history.replaceState(null, '', '#/video');
  } else {
    input.focus();
  }
}

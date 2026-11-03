// Связь с вашим сервером скачивания (папка server/ в репозитории).

import { $, esc, icon, modal, setError, toast, safeUrl } from './ui.js';

export function getServer(data) {
  const s = data.downloads.server || {};
  return { url: (s.url || '').replace(/\/+$/, ''), key: s.key || '' };
}

export const hasServer = (data) => !!getServer(data).url;

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

/** Запрос к серверу. onSlow вызывается, если сервер долго «просыпается». */
export async function api(data, path, { body, timeout = 90000, onSlow } = {}) {
  const { url, key } = getServer(data);
  if (!url) throw new ApiError('Сервер не подключён', 0);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  const slow = onSlow ? setTimeout(onSlow, 4000) : null;
  try {
    const res = await fetch(url + path, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(key ? { 'X-Access-Key': key } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
      cache: 'no-store',
    });
    let json = {};
    try { json = await res.json(); } catch { /* пустой ответ */ }
    if (!res.ok) throw new ApiError(json.error || `Ошибка сервера (${res.status})`, res.status);
    return json;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e.name === 'AbortError') throw new ApiError('Сервер не ответил вовремя. Попробуйте ещё раз.', 0);
    throw new ApiError('Не удалось связаться с сервером. Проверьте адрес и что сервер запущен.', 0);
  } finally {
    clearTimeout(timer);
    if (slow) clearTimeout(slow);
  }
}

export function fileUrl(data, jobId, inline = false) {
  const { url, key } = getServer(data);
  const q = new URLSearchParams();
  if (key) q.set('key', key);
  if (inline) q.set('inline', '1');
  return `${url}/api/jobs/${encodeURIComponent(jobId)}/file?${q}`;
}

/** Проверка: сервер отвечает и ключ подходит. */
export async function testServer(data, onSlow) {
  const h = await api(data, '/api/health', { timeout: 90000, onSlow });
  try {
    await api(data, '/api/info', { body: { url: '' }, timeout: 20000 });
  } catch (e) {
    if (e.status === 401) throw new ApiError('Сервер работает, но ключ доступа неверный', 401);
    if (e.status !== 400) throw e;
  }
  return h;
}

/** Окно подключения сервера. */
export function serverModal(ctx, onDone) {
  const cur = getServer(ctx.data);
  modal({
    title: 'Сервер для скачивания',
    wide: true,
    submit: 'Проверить и сохранить',
    body: `
      <p class="muted">Чтобы скачивать прямо с этого сайта, нужен ваш собственный маленький сервер —
        он делает то же, что nova-downloader: запускает yt-dlp и отдаёт готовый файл.
        Бесплатно разместить его можно на Render за 5 минут.</p>
      <details class="howto" ${cur.url ? '' : 'open'}>
        <summary>Как запустить сервер (один раз)</summary>
        <ol class="steps">
          <li>Зарегистрируйтесь на <a href="https://render.com" target="_blank" rel="noopener noreferrer">render.com</a> через GitHub.</li>
          <li>Откройте <a href="https://render.com/deploy?repo=https://github.com/zudzudabuayub/no-name" target="_blank" rel="noopener noreferrer">эту ссылку</a> и нажмите <b>Deploy</b> — Render сам соберёт сервер из папки <span class="mono">server</span>.</li>
          <li>Когда появится зелёное <b>Live</b>, скопируйте адрес вида <span class="mono">https://….onrender.com</span>.</li>
          <li>Во вкладке <b>Environment</b> скопируйте значение <span class="mono">ACCESS_KEY</span> — это ключ.</li>
          <li>Вставьте адрес и ключ ниже.</li>
        </ol>
        <p class="hint">Подробная инструкция и другие способы (например, на своём компьютере) — в README репозитория.</p>
      </details>
      <label class="field"><span>Адрес сервера</span>
        <input class="input mono" name="url" type="url" inputmode="url" value="${esc(cur.url)}" placeholder="https://moi-sait-downloader.onrender.com" autocomplete="off" spellcheck="false"></label>
      <label class="field"><span>Ключ доступа (ACCESS_KEY)</span>
        <input class="input mono" name="key" value="${esc(cur.key)}" autocomplete="off" spellcheck="false" autocapitalize="off"></label>
      <p class="status-line hidden" id="srv-status"></p>`,
    extra: cur.url ? `<button type="button" class="btn ghost danger-text" data-off>${icon('x')} Отключить</button>` : '',
    onOpen(form, dlg) {
      form.elements.url.focus();
      $('[data-off]', form)?.addEventListener('click', async () => {
        ctx.data.downloads.server = { url: '', key: '' };
        await ctx.save();
        dlg.close();
        toast('Сервер отключён');
        onDone?.();
      });
    },
    async onSubmit(form) {
      const raw = form.elements.url.value.trim();
      const url = safeUrl(raw);
      if (!url) { setError(form, 'Введите адрес сервера'); return false; }
      const u = new URL(url);
      const local = ['localhost', '127.0.0.1'].includes(u.hostname);
      if (u.protocol === 'http:' && !local) { setError(form, 'Нужен адрес с https:// (http работает только для localhost)'); return false; }
      const status = $('#srv-status', form);
      status.classList.remove('hidden');
      status.innerHTML = `<span class="spinner"></span> Проверяю сервер…`;
      setError(form, '');
      const candidate = { downloads: { server: { url: u.origin + u.pathname.replace(/\/+$/, ''), key: form.elements.key.value.trim() } } };
      try {
        const h = await testServer(candidate, () => {
          status.innerHTML = '<span class="spinner"></span> Сервер просыпается — бесплатный хостинг засыпает без дела. Это займёт до минуты…';
        });
        ctx.data.downloads.server = candidate.downloads.server;
        await ctx.save();
        toast(`Сервер подключён (yt-dlp ${h.yt_dlp || ''})`, 'success');
        onDone?.();
      } catch (e) {
        status.classList.add('hidden');
        setError(form, e.message);
        return false;
      }
    },
  });
}

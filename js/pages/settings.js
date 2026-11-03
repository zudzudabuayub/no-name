import * as vault from '../vault.js';
import { strength } from '../crypto.js';
import { APP_NAME } from '../defaults.js';
import { questionsHTML, bindQuestions, readQuestions } from '../questions.js';
import { codeBlock, bindCodeBlock } from '../auth.js';
import { serverModal, getServer } from '../server.js';
import {
  $, esc, icon, modal, toast, download, pickFile, confirmBox, setError,
  passwordField, bindPasswordToggles, strengthBar, updateStrength,
} from '../ui.js';

export const title = 'Настройки';

const THEME_KEY = 'moi-sait:theme';

export function applyTheme(t) {
  if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  const dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#0e1015' : '#f4f5f9');
}

function currentTheme() {
  try { return localStorage.getItem(THEME_KEY) || 'auto'; } catch { return 'auto'; }
}

/** Спросить текущий пароль перед важным действием. */
function withPassword(titleText, then) {
  modal({
    title: titleText,
    submit: 'Продолжить',
    body: `<p class="muted">Для безопасности введите текущий пароль.</p>${passwordField({ name: 'pw', label: 'Текущий пароль' })}`,
    onOpen(form) { bindPasswordToggles(form); form.elements.pw.focus(); },
    async onSubmit(form) {
      if (!(await vault.verifyPassword(form.elements.pw.value))) {
        setError(form, 'Неверный пароль');
        return false;
      }
      setTimeout(then, 50);
    },
  });
}

export function render(view, ctx) {
  const d = ctx.data;
  const m = vault.meta();

  view.innerHTML = `
    <div class="settings">
      <section class="card">
        <h3>${icon('lock')} Вход</h3>
        <div class="kv"><span>Логин</span><b class="mono">${esc(d.profile.username)}</b></div>
        <div class="kv"><span>Подсказка</span>${m.hint ? `<span>${esc(m.hint)}</span>` : '<span class="muted">не задана</span>'}</div>
        <div class="row">
          <button class="btn" id="s-cred">${icon('edit')} Сменить логин или пароль</button>
          <button class="btn ghost" id="s-hint">Изменить подсказку</button>
        </div>
      </section>

      <section class="card">
        <h3>${icon('help')} Восстановление доступа</h3>
        <p class="muted small">Если забудете логин или пароль, войти можно: по подсказке, ответив на 2 из 3 секретных вопросов, или по коду восстановления.</p>
        <ol class="q-list">${m.questions.map((q) => `<li>${esc(q)}</li>`).join('')}</ol>
        <div class="row">
          <button class="btn" id="s-q">${icon('question')} Изменить вопросы</button>
          <button class="btn" id="s-code">${icon('ticket')} Новый код восстановления</button>
        </div>
      </section>

      <section class="card">
        <h3>${icon('server')} Сервер для скачивания</h3>
        ${getServer(d).url
          ? `<div class="kv"><span>Адрес</span><b class="mono ellipsis">${esc(getServer(d).url)}</b></div>`
          : '<p class="muted small">Не подключён. С ним видео скачиваются прямо с этого сайта, без сторонних сервисов.</p>'}
        <button class="btn" id="s-server">${icon(getServer(d).url ? 'edit' : 'plus')} ${getServer(d).url ? 'Изменить' : 'Подключить сервер'}</button>
      </section>

      <section class="card">
        <h3>${icon('shield')} Безопасность</h3>
        <label class="field inline"><span>Автоблокировка, если не пользоваться</span>
          <select class="input" id="s-lock">
            ${[[5, '5 минут'], [15, '15 минут'], [30, '30 минут'], [60, '1 час'], [240, '4 часа'], [0, 'Никогда']]
              .map(([v, l]) => `<option value="${v}" ${Number(d.settings.autoLock) === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select></label>
        <p class="hint">После закрытия вкладки нужно будет снова ввести пароль.</p>
        <button class="btn" id="s-lock-now">${icon('lock')} Заблокировать сейчас</button>
      </section>

      <section class="card">
        <h3>${icon('sun')} Оформление</h3>
        <div class="seg" role="radiogroup" aria-label="Тема">
          ${[['auto', 'Как в системе'], ['dark', 'Тёмная'], ['light', 'Светлая']]
            .map(([v, l]) => `<label><input type="radio" name="theme" value="${v}" ${currentTheme() === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}
        </div>
      </section>

      <section class="card">
        <h3>${icon('download')} Резервная копия</h3>
        <p class="muted small">Данные хранятся только в этом браузере. Чтобы не потерять их или перенести на телефон/другой компьютер —
          скачайте копию и загрузите её там. Копия зашифрована: открыть её можно только вашим логином и паролем
          (или ответами на вопросы / кодом).</p>
        <div class="row">
          <button class="btn primary" id="s-export">${icon('download')} Скачать копию</button>
          <button class="btn" id="s-import">${icon('upload')} Загрузить копию</button>
        </div>
        <p class="hint">Совет: делайте копию раз в неделю и храните её, например, в облаке или на флешке.</p>
      </section>

      <section class="card danger-card">
        <h3>${icon('trash')} Удаление</h3>
        <p class="muted small">Удалит все заметки, пароли и ссылки с этого устройства. Отменить нельзя.</p>
        <button class="btn danger" id="s-wipe">Удалить все данные</button>
      </section>

      <section class="card about">
        <h3>${icon('shield')} Как это работает</h3>
        <ul class="small muted">
          <li>Никаких аккаунтов, почты и серверов: сайт работает прямо в браузере.</li>
          <li>Всё шифруется алгоритмом AES-256. Ключ получается из логина и пароля (PBKDF2, 250 000 повторов).</li>
          <li>Пароль нигде не сохраняется — даже владелец сайта не сможет прочитать ваши данные.</li>
          <li>Ответы на вопросы и код восстановления — это запасные ключи к тем же данным.</li>
        </ul>
        <p class="small muted">${esc(APP_NAME)} · создано ${new Date(m.createdAt).toLocaleDateString('ru-RU')}</p>
      </section>
    </div>`;

  // Логин и пароль
  $('#s-cred', view).addEventListener('click', () => withPassword('Сменить логин или пароль', () => {
    modal({
      title: 'Новый логин и пароль',
      body: `
        <label class="field"><span>Логин</span>
          <input class="input" name="user" value="${esc(d.profile.username)}" maxlength="60" autocomplete="username" autocapitalize="off" spellcheck="false"></label>
        ${passwordField({ name: 'pw', label: 'Новый пароль', autocomplete: 'new-password' })}
        ${strengthBar()}
        ${passwordField({ name: 'pw2', label: 'Повторите пароль', autocomplete: 'new-password' })}
        <label class="field"><span>Подсказка <em>(необязательно)</em></span>
          <input class="input" name="hint" maxlength="120" value="${esc(vault.meta().hint)}"></label>`,
      onOpen(form) {
        bindPasswordToggles(form);
        const bar = $('.strength', form);
        form.elements.pw.addEventListener('input', () => updateStrength(bar, strength(form.elements.pw.value)));
        form.elements.pw.focus();
      },
      async onSubmit(form) {
        const user = form.elements.user.value.trim();
        const pw = form.elements.pw.value;
        const hint = form.elements.hint.value.trim();
        if (user.length < 2) { setError(form, 'Логин слишком короткий'); return false; }
        if (pw.length < 6) { setError(form, 'Пароль должен быть не короче 6 символов'); return false; }
        if (pw !== form.elements.pw2.value) { setError(form, 'Пароли не совпадают'); return false; }
        if (hint && hint.toLowerCase().includes(pw.toLowerCase())) { setError(form, 'Подсказка не должна содержать пароль'); return false; }
        await vault.setCredentials({ username: user, password: pw, hint });
        toast('Логин и пароль изменены', 'success');
        ctx.reload();
      },
    });
  }));

  $('#s-hint', view).addEventListener('click', () => {
    modal({
      title: 'Подсказка к паролю',
      body: `<label class="field"><span>Подсказка</span>
        <input class="input" name="hint" maxlength="120" value="${esc(vault.meta().hint)}" placeholder="Не пишите сам пароль"></label>
        <p class="hint">Её увидит любой, кто откроет сайт на этом устройстве.</p>`,
      onOpen: (form) => form.elements.hint.focus(),
      async onSubmit(form) {
        const hint = form.elements.hint.value.trim();
        await vault.setHint(hint);
        toast('Подсказка сохранена', 'success');
        ctx.reload();
      },
    });
  });

  // Секретные вопросы
  $('#s-q', view).addEventListener('click', () => withPassword('Изменить секретные вопросы', () => {
    modal({
      title: 'Секретные вопросы',
      wide: true,
      body: `<p class="hint">Для восстановления нужно будет ответить на любые 2 из 3. Старые ответы перестанут работать.</p>
        ${questionsHTML(vault.meta().questions)}`,
      onOpen(form) { bindQuestions(form); form.elements.qa0.focus(); },
      async onSubmit(form) {
        let q;
        try { q = readQuestions(form); } catch (e) { setError(form, e.message); return false; }
        await vault.setQuestions(q);
        toast('Вопросы обновлены', 'success');
        ctx.reload();
      },
    });
  }));

  // Новый код
  $('#s-code', view).addEventListener('click', () => withPassword('Новый код восстановления', async () => {
    const code = await vault.newRecoveryCode();
    modal({
      title: 'Новый код восстановления',
      submit: 'Готово',
      cancel: '',
      body: `<p class="muted">Старый код больше не работает. Сохраните новый:</p>${codeBlock(code)}`,
      onOpen: (form) => bindCodeBlock(form, code),
    });
  }));

  $('#s-server', view).addEventListener('click', () => serverModal(ctx, () => ctx.reload()));

  // Безопасность
  $('#s-lock', view).addEventListener('change', async (e) => {
    d.settings.autoLock = Number(e.target.value);
    await ctx.save();
    toast('Сохранено', 'success');
  });
  $('#s-lock-now', view).addEventListener('click', () => ctx.lock());

  // Тема
  view.querySelectorAll('input[name=theme]').forEach((r) => r.addEventListener('change', () => {
    try { localStorage.setItem(THEME_KEY, r.value); } catch { /* ignore */ }
    applyTheme(r.value);
  }));

  // Резервная копия
  $('#s-export', view).addEventListener('click', async () => {
    await ctx.save();
    const date = new Date().toISOString().slice(0, 10);
    download(`moi-sait-backup-${date}.json`, vault.exportBackup());
    toast('Копия скачана', 'success');
  });
  $('#s-import', view).addEventListener('click', async () => {
    const text = await pickFile();
    if (!text) return;
    const ok = await confirmBox('Текущие данные будут заменены данными из копии. После этого войдите логином и паролем из копии.', { ok: 'Заменить' });
    if (!ok) return;
    try {
      vault.importBackup(text);
      toast('Копия загружена', 'success');
      ctx.lock();
    } catch (e) {
      toast(e.message, 'error');
    }
  });

  // Удаление
  $('#s-wipe', view).addEventListener('click', () => {
    modal({
      title: 'Удалить все данные?',
      danger: true,
      submit: 'Удалить навсегда',
      body: `<p>Это удалит все заметки, пароли и ссылки на этом устройстве. Сначала можно скачать резервную копию.</p>
        <label class="field"><span>Напишите <b>УДАЛИТЬ</b> для подтверждения</span><input class="input" name="c" autocomplete="off"></label>`,
      onOpen: (form) => form.elements.c.focus(),
      async onSubmit(form) {
        if (form.elements.c.value.trim().toUpperCase() !== 'УДАЛИТЬ') { setError(form, 'Напишите УДАЛИТЬ'); return false; }
        vault.wipe();
        location.hash = '';
        location.reload();
      },
    });
  });
}

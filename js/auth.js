// Экраны входа: регистрация, вход, восстановление доступа.

import * as vault from './vault.js';
import { strength } from './crypto.js';
import { APP_NAME } from './defaults.js';
import { questionsHTML, bindQuestions, readQuestions } from './questions.js';
import {
  $, $$, esc, icon, toast, copyText, download, pickFile, confirmBox, setError,
  passwordField, bindPasswordToggles, strengthBar, updateStrength,
} from './ui.js';

let root;
let onDone;

function frame(inner, { wide = false } = {}) {
  root.innerHTML = `<div class="auth">
    <div class="auth-bg" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="auth-card ${wide ? 'wide' : ''}">
      <div class="auth-brand"><img src="icon.svg" alt="" width="44" height="44"><span>${esc(APP_NAME)}</span></div>
      ${inner}
    </div>
  </div>`;
  bindPasswordToggles(root);
  return $('.auth-card', root);
}

function busy(btn, on, text) {
  if (on) {
    btn.dataset.text = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span>${esc(text || 'Подождите…')}`;
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.text || btn.textContent;
  }
}

function waitText(ms) {
  const s = Math.ceil(ms / 1000);
  return `Слишком много попыток. Подождите ${s} сек.`;
}

async function importFlow() {
  const text = await pickFile();
  if (!text) return;
  if (vault.hasVault()) {
    const ok = await confirmBox('Текущие данные на этом устройстве будут заменены данными из резервной копии.', { ok: 'Заменить' });
    if (!ok) return;
  }
  try {
    vault.importBackup(text);
    toast('Резервная копия загружена. Войдите своим логином и паролем.', 'success');
    showLogin(root, onDone);
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ---------- Регистрация ----------

export function showRegister(r, done) {
  root = r; onDone = done;
  const card = frame(`
    <h1>Создайте вход</h1>
    <p class="muted">Без почты и телефона. Всё хранится только у вас в браузере в зашифрованном виде.</p>
    <form id="reg" class="stack" novalidate autocomplete="off">
      <label class="field"><span>Логин</span>
        <input class="input" name="user" maxlength="60" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="Например: ayub" required></label>
      ${passwordField({ name: 'pw', label: 'Пароль', autocomplete: 'new-password', placeholder: 'Минимум 6 символов' })}
      ${strengthBar()}
      ${passwordField({ name: 'pw2', label: 'Повторите пароль', autocomplete: 'new-password' })}
      <label class="field"><span>Подсказка к паролю <em>(необязательно)</em></span>
        <input class="input" name="hint" maxlength="120" placeholder="Например: кличка кота + год"></label>
      <p class="hint">${icon('help')} Подсказку увидит любой, кто откроет сайт на этом устройстве. Не пишите в ней сам пароль.</p>

      <div class="divider"><span>Секретные вопросы</span></div>
      <p class="hint">Если забудете логин или пароль — достаточно правильно ответить на <b>любые 2 из 3</b> вопросов.
        Регистр букв и лишние пробелы не важны.</p>
      ${questionsHTML()}
      <button class="btn primary block lg" type="submit">Создать и войти</button>
    </form>
    <div class="auth-alt">
      <span>Уже пользовались сайтом на другом устройстве?</span>
      <button class="btn ghost sm" id="import">${icon('upload')} Загрузить резервную копию</button>
    </div>`, { wide: true });

  const form = $('#reg', card);
  bindQuestions(form);
  const bar = $('.strength', card);
  form.elements.pw.addEventListener('input', () => updateStrength(bar, strength(form.elements.pw.value)));
  $('#import', card).addEventListener('click', importFlow);
  form.elements.user.focus();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = form.elements.user.value.trim();
    const pw = form.elements.pw.value;
    const pw2 = form.elements.pw2.value;
    const hint = form.elements.hint.value.trim();
    let questions;
    try {
      if (user.length < 2) throw new Error('Логин должен быть не короче 2 символов');
      if (pw.length < 6) throw new Error('Пароль должен быть не короче 6 символов');
      if (pw !== pw2) throw new Error('Пароли не совпадают');
      if (hint && hint.toLowerCase().includes(pw.toLowerCase())) throw new Error('Подсказка не должна содержать сам пароль');
      questions = readQuestions(form);
    } catch (err) {
      return setError(form, err.message);
    }
    setError(form, '');
    const btn = form.querySelector('[type=submit]');
    busy(btn, true, 'Шифруем…');
    try {
      const code = await vault.register({ username: user, password: pw, hint, questions });
      showCode(code, () => onDone());
    } catch (err) {
      console.error(err);
      busy(btn, false);
      setError(form, 'Не удалось создать: ' + err.message);
    }
  });
}

// ---------- Код восстановления ----------

export function codeBlock(code) {
  return `<div class="code-box">
      <code id="rc">${esc(code)}</code>
      <div class="row center">
        <button type="button" class="btn sm" id="rc-copy">${icon('copy')} Копировать</button>
        <button type="button" class="btn sm" id="rc-save">${icon('download')} Скачать .txt</button>
      </div>
    </div>`;
}

export function bindCodeBlock(scope, code) {
  $('#rc-copy', scope).addEventListener('click', () => copyText(code, 'Код скопирован'));
  $('#rc-save', scope).addEventListener('click', () => download(
    'kod-vosstanovleniya.txt',
    `${APP_NAME} — код восстановления\n\n${code}\n\nС этим кодом можно войти, если забыли логин и пароль.\nХраните его в надёжном месте.\n`,
    'text/plain;charset=utf-8',
  ));
}

function showCode(code, next) {
  const card = frame(`
    <div class="big-icon ok">${icon('shield')}</div>
    <h1>Ваш код восстановления</h1>
    <p class="muted">Это запасной ключ. С ним можно войти, даже если забыли и логин, и пароль, и ответы на вопросы.
      Запишите его на бумаге или сохраните файлом.</p>
    ${codeBlock(code)}
    <label class="check-line"><input type="checkbox" id="saved"> Я сохранил(а) код</label>
    <button class="btn primary block lg" id="go" disabled>Перейти на сайт</button>`);
  bindCodeBlock(card, code);
  const cb = $('#saved', card);
  const go = $('#go', card);
  cb.addEventListener('change', () => { go.disabled = !cb.checked; });
  go.addEventListener('click', next);
}

// ---------- Вход ----------

export function showLogin(r, done) {
  root = r; onDone = done;
  const card = frame(`
    <h1>С возвращением!</h1>
    <p class="muted">Введите логин и пароль.</p>
    <form id="login" class="stack" novalidate>
      <label class="field"><span>Логин</span>
        <input class="input" name="user" autocomplete="username" autocapitalize="off" spellcheck="false" required></label>
      ${passwordField({ name: 'pw', label: 'Пароль' })}
      <button class="btn primary block lg" type="submit">Войти</button>
    </form>
    <button class="btn link block" id="forgot">${icon('help')} Забыли логин или пароль?</button>
    <div class="auth-alt">
      <button class="btn ghost sm" id="import">${icon('upload')} Загрузить резервную копию</button>
    </div>`);

  const form = $('#login', card);
  form.elements.user.focus();
  $('#forgot', card).addEventListener('click', () => showRecovery());
  $('#import', card).addEventListener('click', importFlow);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const wait = vault.throttleWait();
    if (wait) return setError(form, waitText(wait));
    const user = form.elements.user.value;
    const pw = form.elements.pw.value;
    if (!user.trim() || !pw) return setError(form, 'Введите логин и пароль');
    const btn = form.querySelector('[type=submit]');
    busy(btn, true, 'Проверяем…');
    const ok = await vault.login(user, pw);
    if (ok) {
      vault.clearFails();
      onDone();
    } else {
      busy(btn, false);
      vault.registerFail();
      form.elements.pw.value = '';
      form.elements.pw.focus();
      const w = vault.throttleWait();
      setError(form, w ? waitText(w) : 'Неверный логин или пароль. Нажмите «Забыли логин или пароль?», чтобы увидеть подсказки.');
    }
  });
}

// ---------- Восстановление ----------

function showRecovery(tab = 'hints') {
  const m = vault.meta();
  const card = frame(`
    <button class="btn ghost sm back" id="back">${icon('back')} Ко входу</button>
    <h1>Восстановление доступа</h1>
    <p class="muted">Выберите способ. Хватит любого из них.</p>
    <div class="tabs" role="tablist">
      <button role="tab" data-tab="hints">${icon('bulb')} Подсказки</button>
      <button role="tab" data-tab="questions">${icon('question')} Вопросы</button>
      <button role="tab" data-tab="code">${icon('ticket')} Код</button>
    </div>

    <section data-panel="hints" class="stack">
      <div class="hint-card">
        <span class="label">Ваш логин</span>
        <b class="mono">${esc(m.userMask)}</b>
        <small class="muted">начинается на «${esc(m.userMask[0])}», всего ${m.userLen} симв.</small>
      </div>
      <div class="hint-card">
        <span class="label">Подсказка к паролю</span>
        ${m.hint ? `<b>${esc(m.hint)}</b>` : '<span class="muted">Подсказка не задана</span>'}
      </div>
      <p class="hint">Вспомнили? Вернитесь ко входу. Если нет — ответьте на вопросы или введите код восстановления.</p>
      <div class="row">
        <button class="btn primary" id="to-login">Попробовать войти</button>
        <button class="btn" data-goto="questions">Ответить на вопросы</button>
      </div>
    </section>

    <section data-panel="questions" class="hidden">
      <form id="qa" class="stack" novalidate autocomplete="off">
        <p class="hint">Ответьте хотя бы на <b>2 из 3</b> вопросов. Регистр букв не важен.</p>
        ${m.questions.map((q, i) => `<label class="field"><span>${esc(q)}</span>
          <input class="input" name="a${i}" autocomplete="off" spellcheck="false" maxlength="120"></label>`).join('')}
        <button class="btn primary block lg" type="submit">Проверить ответы</button>
      </form>
    </section>

    <section data-panel="code" class="hidden">
      <form id="cf" class="stack" novalidate autocomplete="off">
        <p class="hint">Код вы получили при создании входа: 16 символов вида <span class="mono">ABCD-EFGH-JKMN-PQRS</span>.</p>
        <label class="field"><span>Код восстановления</span>
          <input class="input mono upper" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="24" placeholder="XXXX-XXXX-XXXX-XXXX"></label>
        <button class="btn primary block lg" type="submit">Войти по коду</button>
      </form>
    </section>

    <details class="danger-zone">
      <summary>Ничего не помогает?</summary>
      <p class="hint">Можно удалить все данные на этом устройстве и начать заново. Восстановить их потом будет нельзя
        (если нет резервной копии).</p>
      <button class="btn danger sm" id="wipe">${icon('trash')} Удалить всё и начать заново</button>
    </details>`, { wide: true });

  const select = (name) => {
    $$('[data-tab]', card).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    $$('[data-panel]', card).forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== name));
    const first = $(`[data-panel="${name}"] input`, card);
    if (first) first.focus();
  };
  $$('[data-tab]', card).forEach((b) => b.addEventListener('click', () => select(b.dataset.tab)));
  $$('[data-goto]', card).forEach((b) => b.addEventListener('click', () => select(b.dataset.goto)));
  select(tab);

  $('#back', card).addEventListener('click', () => showLogin(root, onDone));
  $('#to-login', card).addEventListener('click', () => showLogin(root, onDone));

  const qa = $('#qa', card);
  qa.addEventListener('submit', async (e) => {
    e.preventDefault();
    const wait = vault.throttleWait();
    if (wait) return setError(qa, waitText(wait));
    const answers = [0, 1, 2].map((i) => qa.elements['a' + i].value);
    if (answers.filter((a) => a.trim()).length < 2) return setError(qa, 'Ответьте хотя бы на 2 вопроса');
    const btn = qa.querySelector('[type=submit]');
    busy(btn, true, 'Проверяем…');
    if (await vault.recoverWithAnswers(answers)) {
      vault.clearFails();
      showReset('вопросы');
    } else {
      busy(btn, false);
      vault.registerFail();
      const w = vault.throttleWait();
      setError(qa, w ? waitText(w) : 'Ответы не подошли. Попробуйте другие варианты написания или ответьте на третий вопрос.');
    }
  });

  const cf = $('#cf', card);
  cf.addEventListener('submit', async (e) => {
    e.preventDefault();
    const wait = vault.throttleWait();
    if (wait) return setError(cf, waitText(wait));
    const btn = cf.querySelector('[type=submit]');
    busy(btn, true, 'Проверяем…');
    if (await vault.recoverWithCode(cf.elements.code.value)) {
      vault.clearFails();
      showReset('код');
    } else {
      busy(btn, false);
      vault.registerFail();
      const w = vault.throttleWait();
      setError(cf, w ? waitText(w) : 'Код не подошёл. Проверьте, что ввели все 16 символов.');
    }
  });

  $('#wipe', card).addEventListener('click', async () => {
    const ok = await confirmBox('Все заметки, пароли и ссылки на этом устройстве будут удалены навсегда.', { ok: 'Удалить всё' });
    if (!ok) return;
    vault.wipe();
    toast('Данные удалены');
    showRegister(root, onDone);
  });
}

// ---------- Новый пароль после восстановления ----------

function showReset(method) {
  const d = vault.getData();
  const m = vault.meta();
  const card = frame(`
    <div class="big-icon ok">${icon('check')}</div>
    <h1>Доступ восстановлен</h1>
    <p class="muted">Вы вошли через ${esc(method)}. Ваш логин: <b class="mono">${esc(d.profile.username)}</b></p>
    <form id="reset" class="stack" novalidate>
      <p class="hint">Придумайте новый пароль, чтобы в следующий раз войти обычным способом.</p>
      <label class="field"><span>Логин</span>
        <input class="input" name="user" value="${esc(d.profile.username)}" maxlength="60" autocomplete="username" autocapitalize="off" spellcheck="false"></label>
      ${passwordField({ name: 'pw', label: 'Новый пароль', autocomplete: 'new-password' })}
      ${strengthBar()}
      ${passwordField({ name: 'pw2', label: 'Повторите пароль', autocomplete: 'new-password' })}
      <label class="field"><span>Подсказка к паролю <em>(необязательно)</em></span>
        <input class="input" name="hint" maxlength="120" value="${esc(m.hint)}"></label>
      <button class="btn primary block lg" type="submit">Сохранить и войти</button>
    </form>
    <button class="btn link block" id="skip">Я вспомнил(а) пароль — войти без смены</button>`);

  const form = $('#reset', card);
  const bar = $('.strength', card);
  form.elements.pw.addEventListener('input', () => updateStrength(bar, strength(form.elements.pw.value)));
  form.elements.pw.focus();
  $('#skip', card).addEventListener('click', () => onDone());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = form.elements.user.value.trim();
    const pw = form.elements.pw.value;
    const hint = form.elements.hint.value.trim();
    if (user.length < 2) return setError(form, 'Логин должен быть не короче 2 символов');
    if (pw.length < 6) return setError(form, 'Пароль должен быть не короче 6 символов');
    if (pw !== form.elements.pw2.value) return setError(form, 'Пароли не совпадают');
    if (hint && hint.toLowerCase().includes(pw.toLowerCase())) return setError(form, 'Подсказка не должна содержать сам пароль');
    const btn = form.querySelector('[type=submit]');
    busy(btn, true, 'Сохраняем…');
    try {
      await vault.setCredentials({ username: user, password: pw, hint });
      toast('Новый пароль сохранён', 'success');
      onDone();
    } catch (err) {
      busy(btn, false);
      setError(form, err.message);
    }
  });
}

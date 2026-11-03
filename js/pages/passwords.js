import {
  $, esc, icon, uid, fmtDate, safeUrl, hostOf, hue, letter, modal, confirmBox, toast, copyText, debounce,
  passwordField, bindPasswordToggles, strengthBar, updateStrength,
} from '../ui.js';
import { genPassword, strength } from '../crypto.js';

export const title = 'Пароли';

const GEN_KEY = 'moi-sait:gen';

function genOptions() {
  try { return { length: 16, lower: true, upper: true, digits: true, symbols: true, ...JSON.parse(localStorage.getItem(GEN_KEY)) }; } catch { return { length: 16, lower: true, upper: true, digits: true, symbols: true }; }
}

/** Окно генератора паролей. onUse(password) — если нужно подставить в поле. */
export function openGenerator(onUse) {
  const o = genOptions();
  modal({
    title: 'Генератор паролей',
    submit: onUse ? 'Использовать' : 'Копировать',
    body: `
      <div class="gen-out"><code id="g-out"></code>
        <button type="button" class="btn icon ghost" id="g-re" aria-label="Другой пароль">${icon('refresh')}</button></div>
      ${strengthBar()}
      <label class="field"><span>Длина: <b id="g-len">${o.length}</b></span>
        <input type="range" name="length" min="6" max="48" value="${o.length}"></label>
      <div class="opts">
        <label class="check-line"><input type="checkbox" name="lower" ${o.lower ? 'checked' : ''}> строчные a-z</label>
        <label class="check-line"><input type="checkbox" name="upper" ${o.upper ? 'checked' : ''}> заглавные A-Z</label>
        <label class="check-line"><input type="checkbox" name="digits" ${o.digits ? 'checked' : ''}> цифры 0-9</label>
        <label class="check-line"><input type="checkbox" name="symbols" ${o.symbols ? 'checked' : ''}> символы !@#</label>
      </div>`,
    onOpen(form) {
      const out = $('#g-out', form);
      const bar = $('.strength', form);
      const regen = () => {
        const opts = {
          length: Number(form.elements.length.value),
          lower: form.elements.lower.checked,
          upper: form.elements.upper.checked,
          digits: form.elements.digits.checked,
          symbols: form.elements.symbols.checked,
        };
        try { localStorage.setItem(GEN_KEY, JSON.stringify(opts)); } catch { /* ignore */ }
        $('#g-len', form).textContent = opts.length;
        out.textContent = genPassword(opts);
        updateStrength(bar, strength(out.textContent));
      };
      form.addEventListener('input', regen);
      $('#g-re', form).addEventListener('click', regen);
      regen();
    },
    async onSubmit(form) {
      const pw = $('#g-out', form).textContent;
      if (onUse) onUse(pw);
      else await copyText(pw, 'Пароль скопирован');
    },
  });
}

export function render(view, ctx) {
  const d = ctx.data;
  let query = ctx.params.get('q') || '';
  const open = new Set();
  const shown = new Set();
  const openId = ctx.params.get('open');
  if (openId) { open.add(openId); history.replaceState(null, '', '#/passwords'); }

  view.innerHTML = `
    <div class="toolbar">
      <label class="search">${icon('search')}<input id="p-search" type="search" placeholder="Поиск по сайту или логину" value="${esc(query)}" aria-label="Поиск паролей"></label>
      <button class="btn" id="p-gen" title="Генератор паролей">${icon('wand')}<span>Генератор</span></button>
      <button class="btn primary" id="p-add">${icon('plus')}<span>Добавить</span></button>
    </div>
    <p class="hint secure-note">${icon('shield')} Пароли зашифрованы вашим паролем и хранятся только в этом браузере.</p>
    <div id="p-list" class="pw-list"></div>`;

  const list = $('#p-list', view);

  function draw() {
    const q = query.trim().toLowerCase();
    const items = d.passwords
      .filter((p) => !q || [p.title, p.url, p.login, p.note].some((f) => String(f || '').toLowerCase().includes(q)))
      .sort((a, b) => a.title.localeCompare(b.title, 'ru'));

    if (!items.length) {
      list.innerHTML = `<div class="empty">
        ${icon('key', 'empty-icon')}
        <h3>${d.passwords.length ? 'Ничего не найдено' : 'Сохраните первый пароль'}</h3>
        <p class="muted">${d.passwords.length ? 'Попробуйте другой запрос.' : 'Логины и пароли от сайтов, приложений, Wi-Fi — всё в одном месте.'}</p>
        ${d.passwords.length ? '' : `<button class="btn primary" data-new>${icon('plus')} Добавить пароль</button>`}
      </div>`;
      $('[data-new]', list)?.addEventListener('click', () => edit());
      return;
    }

    list.innerHTML = items.map((p) => {
      const url = safeUrl(p.url);
      const isOpen = open.has(p.id);
      const isShown = shown.has(p.id);
      return `<article class="pw ${isOpen ? 'open' : ''}" data-id="${esc(p.id)}">
        <div class="pw-row">
          <button class="pw-main" data-act="toggle" aria-expanded="${isOpen}">
            <span class="avatar" style="--h:${hue(p.title)}">${esc(letter(p.title))}</span>
            <span class="pw-text"><b>${esc(p.title)}</b><small>${esc(p.login || hostOf(url) || '—')}</small></span>
          </button>
          <div class="pw-actions">
            ${p.login ? `<button class="btn icon ghost" data-act="copy-login" title="Копировать логин" aria-label="Копировать логин">${icon('copy')}</button>` : ''}
            <button class="btn icon ghost accent" data-act="copy-pw" title="Копировать пароль" aria-label="Копировать пароль">${icon('key')}</button>
          </div>
        </div>
        ${isOpen ? `<div class="pw-details">
          ${url ? `<div class="kv"><span>Сайт</span><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(hostOf(url))} ${icon('external')}</a></div>` : ''}
          ${p.login ? `<div class="kv"><span>Логин</span><b class="mono sel">${esc(p.login)}</b></div>` : ''}
          <div class="kv"><span>Пароль</span>
            <b class="mono sel pw-value">${isShown ? esc(p.password) : '•'.repeat(Math.min(12, p.password.length || 8))}</b>
            <button class="btn icon ghost sm" data-act="show" aria-label="${isShown ? 'Скрыть' : 'Показать'}">${icon(isShown ? 'eyeOff' : 'eye')}</button>
          </div>
          ${p.note ? `<div class="kv"><span>Заметка</span><p class="pre">${esc(p.note)}</p></div>` : ''}
          <div class="kv"><span>Изменён</span><small class="muted">${esc(fmtDate(p.updatedAt))}</small></div>
          <div class="row end">
            <button class="btn sm ghost danger-text" data-act="delete">${icon('trash')} Удалить</button>
            <button class="btn sm" data-act="edit">${icon('edit')} Изменить</button>
          </div>
        </div>` : ''}
      </article>`;
    }).join('');
  }

  list.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const card = btn.closest('.pw');
    const p = d.passwords.find((x) => x.id === card?.dataset.id);
    if (!p) return;
    switch (btn.dataset.act) {
      case 'toggle': open.has(p.id) ? open.delete(p.id) : open.add(p.id); shown.delete(p.id); draw(); break;
      case 'show': shown.has(p.id) ? shown.delete(p.id) : shown.add(p.id); draw(); break;
      case 'copy-login': copyText(p.login, 'Логин скопирован'); break;
      case 'copy-pw': copyText(p.password, 'Пароль скопирован'); break;
      case 'edit': edit(p); break;
      case 'delete':
        if (await confirmBox(`Удалить пароль «${p.title}»?`)) {
          d.passwords = d.passwords.filter((x) => x.id !== p.id);
          await ctx.save();
          toast('Удалено');
          draw();
        }
        break;
      default:
    }
  });

  $('#p-search', view).addEventListener('input', debounce((e) => { query = e.target.value; draw(); }, 100));
  $('#p-add', view).addEventListener('click', () => edit());
  $('#p-gen', view).addEventListener('click', () => openGenerator());

  function edit(entry) {
    const isNew = !entry;
    const p = entry || { title: '', url: '', login: '', password: '', note: '' };
    modal({
      title: isNew ? 'Новый пароль' : 'Изменить пароль',
      body: `
        <label class="field"><span>Название</span>
          <input class="input" name="title" maxlength="100" value="${esc(p.title)}" placeholder="Например: Instagram"></label>
        <label class="field"><span>Сайт <em>(необязательно)</em></span>
          <input class="input" name="url" type="url" inputmode="url" value="${esc(p.url)}" placeholder="instagram.com" autocomplete="off"></label>
        <label class="field"><span>Логин, почта или телефон</span>
          <input class="input" name="login" value="${esc(p.login)}" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
        ${passwordField({ name: 'password', label: 'Пароль', value: p.password, autocomplete: 'new-password',
          extraBtn: `<button type="button" class="btn icon ghost" data-gen aria-label="Сгенерировать" title="Сгенерировать">${icon('wand')}</button>` })}
        ${strengthBar()}
        <label class="field"><span>Заметка <em>(необязательно)</em></span>
          <textarea class="input" name="note" rows="3" maxlength="2000" placeholder="Секретный вопрос, PIN, резервные коды…">${esc(p.note)}</textarea></label>`,
      onOpen(form) {
        bindPasswordToggles(form);
        const bar = $('.strength', form);
        const pw = form.elements.password;
        const upd = () => updateStrength(bar, strength(pw.value));
        pw.addEventListener('input', upd);
        upd();
        $('[data-gen]', form).addEventListener('click', () => {
          pw.value = genPassword(genOptions());
          pw.type = 'text';
          upd();
        });
        form.elements.title.focus();
      },
      async onSubmit(form) {
        const t = form.elements.title.value.trim() || hostOf(safeUrl(form.elements.url.value));
        const password = form.elements.password.value;
        if (!t) { toast('Укажите название', 'error'); return false; }
        if (!password) { toast('Введите пароль', 'error'); return false; }
        const now = Date.now();
        const target = entry || { id: uid(), createdAt: now };
        Object.assign(target, {
          title: t,
          url: form.elements.url.value.trim(),
          login: form.elements.login.value.trim(),
          password,
          note: form.elements.note.value.trim(),
          updatedAt: now,
        });
        if (isNew) d.passwords.push(target);
        open.add(target.id);
        await ctx.save();
        toast('Сохранено', 'success');
        draw();
      },
    });
  }

  draw();
}

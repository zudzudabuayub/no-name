import { $, $$, esc, icon, uid, fmtDate, linkify, modal, confirmBox, toast, debounce } from '../ui.js';

export const title = 'Заметки';

export const CATS = {
  note: { label: 'Заметка', plural: 'Заметки', color: '#64748b' },
  plan: { label: 'План', plural: 'Планы', color: '#3b82f6' },
  idea: { label: 'Идея', plural: 'Идеи', color: '#f59e0b' },
  task: { label: 'Задача', plural: 'Задачи', color: '#22c55e' },
};

// Строка «[ ] текст» или «- [x] текст» — пункт списка с галочкой
const CHECK_RE = /^(\s*(?:[-*•]\s*)?)\[( |x|х)\](\s?)(.*)$/i;

export function noteProgress(body) {
  let total = 0, done = 0;
  for (const ln of String(body || '').split('\n')) {
    const m = ln.match(CHECK_RE);
    if (m) { total++; if (m[2] !== ' ') done++; }
  }
  return { total, done };
}

export function previewText(body, max = 120) {
  const s = String(body || '').replace(CHECK_RE, '$4').replace(/\[( |x|х)\]\s?/gi, '').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function renderBody(body, maxLines = 14) {
  const lines = String(body || '').split('\n');
  const shown = lines.slice(0, maxLines);
  let html = shown.map((ln, i) => {
    const m = ln.match(CHECK_RE);
    if (m) {
      const done = m[2] !== ' ';
      return `<label class="check ${done ? 'done' : ''}"><input type="checkbox" data-line="${i}" ${done ? 'checked' : ''}><span>${linkify(esc(m[4]))}</span></label>`;
    }
    return ln.trim() ? `<p>${linkify(esc(ln))}</p>` : '<p class="gap"></p>';
  }).join('');
  if (lines.length > maxLines) html += '<p class="more muted">…</p>';
  return html;
}

function toggleLine(body, index) {
  const lines = body.split('\n');
  const m = lines[index]?.match(CHECK_RE);
  if (!m) return body;
  lines[index] = `${m[1]}[${m[2] === ' ' ? 'x' : ' '}]${m[3] || ' '}${m[4]}`;
  return lines.join('\n');
}

export function render(view, ctx) {
  const d = ctx.data;
  let filter = 'all';
  let query = ctx.params.get('q') || '';

  view.innerHTML = `
    <div class="toolbar">
      <label class="search">${icon('search')}<input id="n-search" type="search" placeholder="Поиск заметок" value="${esc(query)}" aria-label="Поиск заметок"></label>
      <button class="btn primary" id="n-add">${icon('plus')}<span>Новая</span></button>
    </div>
    <div class="chips" id="n-chips" role="tablist"></div>
    <div id="n-list" class="notes-grid"></div>`;

  const list = $('#n-list', view);
  const chips = $('#n-chips', view);

  function draw() {
    const counts = { all: d.notes.length };
    for (const k of Object.keys(CATS)) counts[k] = d.notes.filter((n) => n.category === k).length;
    chips.innerHTML = [['all', 'Все'], ...Object.entries(CATS).map(([k, c]) => [k, c.plural])]
      .map(([k, label]) => `<button class="chip ${filter === k ? 'active' : ''}" data-f="${k}" ${CATS[k] ? `style="--c:${CATS[k].color}"` : ''}>
        ${esc(label)} <span>${counts[k]}</span></button>`).join('');

    const q = query.trim().toLowerCase();
    const items = d.notes
      .filter((n) => filter === 'all' || n.category === filter)
      .filter((n) => !q || (n.title + ' ' + n.body).toLowerCase().includes(q))
      .sort((a, b) => (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt));

    if (!items.length) {
      list.innerHTML = `<div class="empty">
        ${icon('notes', 'empty-icon')}
        <h3>${d.notes.length ? 'Ничего не найдено' : 'Здесь будут ваши заметки'}</h3>
        <p class="muted">${d.notes.length ? 'Попробуйте другой запрос.' : 'Записывайте планы, идеи и задачи. Строки вида <span class="mono">[ ] купить хлеб</span> станут галочками.'}</p>
        ${d.notes.length ? '' : `<button class="btn primary" data-new>${icon('plus')} Создать заметку</button>`}
      </div>`;
      $('[data-new]', list)?.addEventListener('click', () => edit());
      return;
    }

    list.innerHTML = items.map((n) => {
      const c = CATS[n.category] || CATS.note;
      const p = noteProgress(n.body);
      return `<article class="note" data-id="${esc(n.id)}" style="--c:${c.color}" tabindex="0">
        <header>
          <span class="badge">${esc(c.label)}</span>
          ${n.pinned ? `<span class="pinned" title="Закреплено">${icon('pin')}</span>` : ''}
        </header>
        ${n.title ? `<h3>${esc(n.title)}</h3>` : ''}
        <div class="note-body">${renderBody(n.body)}</div>
        <footer>
          <small class="muted">${esc(fmtDate(n.updatedAt))}</small>
          ${p.total ? `<small class="muted">${p.done}/${p.total}</small><span class="progress"><i style="width:${Math.round((p.done / p.total) * 100)}%"></i></span>` : ''}
        </footer>
      </article>`;
    }).join('');
  }

  chips.addEventListener('click', (e) => {
    const b = e.target.closest('[data-f]');
    if (!b) return;
    filter = b.dataset.f;
    draw();
  });

  list.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    const cb = e.target.closest('input[type=checkbox]');
    const card = e.target.closest('.note');
    if (!card) return;
    const note = d.notes.find((n) => n.id === card.dataset.id);
    if (!note) return;
    if (cb) {
      note.body = toggleLine(note.body, Number(cb.dataset.line));
      note.updatedAt = Date.now();
      ctx.save();
      draw();
      return;
    }
    if (e.target.closest('label.check')) return;
    edit(note);
  });
  list.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.target.tagName === 'INPUT') return;
    const card = e.target.closest('.note');
    const note = card && d.notes.find((n) => n.id === card.dataset.id);
    if (note) edit(note);
  });

  $('#n-search', view).addEventListener('input', debounce((e) => { query = e.target.value; draw(); }, 100));
  $('#n-add', view).addEventListener('click', () => edit());

  function edit(note) {
    const isNew = !note;
    const n = note || { category: filter !== 'all' ? filter : 'note', title: '', body: '', pinned: false };
    modal({
      title: isNew ? 'Новая заметка' : 'Заметка',
      wide: true,
      submit: 'Сохранить',
      extra: isNew ? '' : `<button type="button" class="btn ghost danger-text" data-del>${icon('trash')} Удалить</button>`,
      body: `
        <input class="input title-input" name="title" maxlength="200" placeholder="Название" value="${esc(n.title)}" aria-label="Название">
        <div class="seg" role="radiogroup" aria-label="Тип">
          ${Object.entries(CATS).map(([k, c]) => `<label style="--c:${c.color}"><input type="radio" name="cat" value="${k}" ${n.category === k ? 'checked' : ''}><span>${esc(c.label)}</span></label>`).join('')}
        </div>
        <textarea class="input" name="body" rows="11" placeholder="Текст заметки…" aria-label="Текст">${esc(n.body)}</textarea>
        <div class="row between">
          <button type="button" class="btn sm" data-check>${icon('check')} Пункт списка</button>
          <label class="check-line"><input type="checkbox" name="pinned" ${n.pinned ? 'checked' : ''}> ${icon('pin')} Закрепить</label>
        </div>`,
      onOpen(form, dlg) {
        const ta = form.elements.body;
        const addItem = () => {
          const pos = ta.selectionStart ?? ta.value.length;
          const before = ta.value.slice(0, pos);
          const prefix = before && !before.endsWith('\n') ? '\n' : '';
          const ins = prefix + '[ ] ';
          ta.setRangeText(ins, pos, ta.selectionEnd ?? pos, 'end');
          ta.focus();
        };
        $('[data-check]', form).addEventListener('click', addItem);
        // Enter в строке-пункте продолжает список
        ta.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter' || e.shiftKey) return;
          const pos = ta.selectionStart;
          const lineStart = ta.value.lastIndexOf('\n', pos - 1) + 1;
          const line = ta.value.slice(lineStart, pos);
          const m = line.match(CHECK_RE);
          if (!m) return;
          e.preventDefault();
          if (!m[4].trim()) { ta.setRangeText('', lineStart, pos, 'end'); return; }
          ta.setRangeText('\n' + m[1] + '[ ] ', pos, ta.selectionEnd, 'end');
        });
        $$('input[name=cat]', form).forEach((r) => r.addEventListener('change', () => {
          if ((r.value === 'task' || r.value === 'plan') && !ta.value.trim()) { ta.value = '[ ] '; ta.focus(); }
        }));
        $('[data-del]', form)?.addEventListener('click', async () => {
          if (!(await confirmBox('Заметка будет удалена.'))) return;
          d.notes = d.notes.filter((x) => x.id !== note.id);
          ctx.data.notes = d.notes;
          await ctx.save();
          dlg.close();
          toast('Заметка удалена');
          draw();
        });
        (isNew ? form.elements.title : ta).focus();
      },
      async onSubmit(form) {
        const titleV = form.elements.title.value.trim();
        const body = form.elements.body.value.replace(/\s+$/, '');
        if (!titleV && !body.trim()) { toast('Заметка пустая', 'error'); return false; }
        const now = Date.now();
        const target = note || { id: uid(), createdAt: now };
        Object.assign(target, {
          title: titleV,
          body,
          category: form.elements.cat.value || 'note',
          pinned: form.elements.pinned.checked,
          updatedAt: now,
        });
        if (isNew) d.notes.push(target);
        await ctx.save();
        toast(isNew ? 'Заметка создана' : 'Сохранено', 'success');
        draw();
      },
    });
  }

  draw();
  const openId = ctx.params.get('open');
  if (openId) {
    const n = d.notes.find((x) => x.id === openId);
    if (n) edit(n);
    history.replaceState(null, '', '#/notes');
  }
}

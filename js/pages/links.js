import { $, esc, icon, uid, safeUrl, hostOf, favicon, bindFavicons, modal, confirmBox, toast, debounce } from '../ui.js';

export const title = 'Ссылки';

/** Общее окно добавления/изменения ссылки (используется и в разделе «Футбол»). */
export function linkEditor({ link, categories = [], categoryLabel = 'Категория', categoryField = true, onSave, onDelete, withFav = true }) {
  const isNew = !link;
  const l = link || { title: '', url: '', category: categories[0] || '', fav: false };
  modal({
    title: isNew ? 'Новая ссылка' : 'Изменить ссылку',
    extra: !isNew && onDelete ? `<button type="button" class="btn ghost danger-text" data-del>${icon('trash')} Удалить</button>` : '',
    body: `
      <label class="field"><span>Адрес</span>
        <input class="input" name="url" type="url" inputmode="url" value="${esc(l.url)}" placeholder="https://…" autocomplete="off" required></label>
      <label class="field"><span>Название</span>
        <input class="input" name="title" maxlength="80" value="${esc(l.title)}" placeholder="Можно не заполнять"></label>
      ${categoryField ? `<label class="field"><span>${esc(categoryLabel)}</span>
        <input class="input" name="category" maxlength="40" value="${esc(l.category || '')}" list="cat-list" placeholder="Например: Учёба">
        <datalist id="cat-list">${categories.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></label>` : ''}
      ${withFav ? `<label class="check-line"><input type="checkbox" name="fav" ${l.fav ? 'checked' : ''}> ${icon('star')} В избранное (видно на главной)</label>` : ''}`,
    onOpen(form, dlg) {
      form.elements.url.focus();
      $('[data-del]', form)?.addEventListener('click', async () => {
        if (!(await confirmBox(`Удалить ссылку «${l.title}»?`))) return;
        await onDelete(link);
        dlg.close();
      });
    },
    async onSubmit(form) {
      const url = safeUrl(form.elements.url.value);
      if (!url) { toast('Неверный адрес ссылки', 'error'); return false; }
      const host = hostOf(url);
      const t = form.elements.title.value.trim() || (host ? host[0].toUpperCase() + host.slice(1) : url);
      await onSave({
        title: t,
        url,
        category: categoryField ? (form.elements.category.value.trim() || 'Разное') : undefined,
        fav: withFav ? form.elements.fav.checked : undefined,
      }, link);
    },
  });
}

export function render(view, ctx) {
  const d = ctx.data;
  let query = ctx.params.get('q') || '';

  view.innerHTML = `
    <div class="toolbar">
      <label class="search">${icon('search')}<input id="l-search" type="search" placeholder="Поиск ссылок" value="${esc(query)}" aria-label="Поиск ссылок"></label>
      <button class="btn primary" id="l-add">${icon('plus')}<span>Ссылка</span></button>
    </div>
    <div id="l-list"></div>`;

  const list = $('#l-list', view);
  const categories = () => [...new Set(d.links.map((l) => l.category || 'Разное'))];

  function draw() {
    const q = query.trim().toLowerCase();
    const items = d.links.filter((l) => !q || [l.title, l.url, l.category].some((f) => String(f || '').toLowerCase().includes(q)));
    if (!items.length) {
      list.innerHTML = `<div class="empty">${icon('link', 'empty-icon')}
        <h3>${d.links.length ? 'Ничего не найдено' : 'Нет ссылок'}</h3>
        <p class="muted">Сохраняйте любимые сайты, чтобы открывать их в одно касание.</p>
        ${d.links.length ? '' : `<button class="btn primary" data-new>${icon('plus')} Добавить ссылку</button>`}</div>`;
      $('[data-new]', list)?.addEventListener('click', () => edit());
      return;
    }
    const groups = new Map();
    for (const l of items) {
      const c = l.category || 'Разное';
      if (!groups.has(c)) groups.set(c, []);
      groups.get(c).push(l);
    }
    list.innerHTML = [...groups].map(([cat, ls]) => `<section class="link-group">
      <h3 class="group-title">${esc(cat)} <span class="muted">${ls.length}</span></h3>
      <div class="link-grid">${ls.map((l) => {
        const url = safeUrl(l.url);
        return `<div class="link-tile" data-id="${esc(l.id)}">
          <a href="${esc(url)}" target="_blank" rel="noopener noreferrer">
            ${favicon(url, l.title)}
            <span class="lt-text"><b>${esc(l.title)}</b><small>${esc(hostOf(url))}</small></span>
          </a>
          <button class="btn icon ghost sm star ${l.fav ? 'on' : ''}" data-act="fav" aria-label="Избранное" title="Избранное">${icon('star')}</button>
          <button class="btn icon ghost sm" data-act="edit" aria-label="Изменить" title="Изменить">${icon('dots')}</button>
        </div>`;
      }).join('')}</div>
    </section>`).join('');
    bindFavicons(list);
  }

  list.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const l = d.links.find((x) => x.id === btn.closest('.link-tile')?.dataset.id);
    if (!l) return;
    if (btn.dataset.act === 'fav') {
      l.fav = !l.fav;
      await ctx.save();
      draw();
    } else edit(l);
  });

  function edit(link) {
    linkEditor({
      link,
      categories: categories(),
      async onSave(vals, existing) {
        if (existing) Object.assign(existing, vals);
        else d.links.push({ id: uid(), createdAt: Date.now(), ...vals });
        await ctx.save();
        toast('Сохранено', 'success');
        draw();
      },
      async onDelete(existing) {
        d.links = d.links.filter((x) => x.id !== existing.id);
        await ctx.save();
        toast('Удалено');
        draw();
      },
    });
  }

  $('#l-search', view).addEventListener('input', debounce((e) => { query = e.target.value; draw(); }, 100));
  $('#l-add', view).addEventListener('click', () => edit());
  draw();
}

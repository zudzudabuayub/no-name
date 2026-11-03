// Секретные вопросы для восстановления доступа.

import { esc, $ } from './ui.js';
import { normAnswer } from './crypto.js';

export const PRESET_QUESTIONS = [
  'Как звали вашего первого питомца?',
  'В каком городе вы родились?',
  'Как зовут вашего лучшего друга детства?',
  'Номер или название вашей первой школы?',
  'Ваша любимая футбольная команда?',
  'Как звали вашего первого учителя?',
  'Ваше любимое блюдо?',
  'Марка вашего первого телефона?',
  'Девичья фамилия вашей мамы?',
];

const DEFAULTS = [0, 1, 2];
const CUSTOM = '__custom';

export function questionsHTML(current = []) {
  return [0, 1, 2].map((i) => {
    const cur = current[i] || PRESET_QUESTIONS[DEFAULTS[i]];
    const isCustom = !PRESET_QUESTIONS.includes(cur);
    const options = PRESET_QUESTIONS.map((q) => `<option ${q === cur ? 'selected' : ''}>${esc(q)}</option>`).join('');
    return `<div class="q-block">
      <label class="field"><span>Вопрос ${i + 1}</span>
        <select class="input" name="qsel${i}">${options}<option value="${CUSTOM}" ${isCustom ? 'selected' : ''}>Свой вопрос…</option></select>
      </label>
      <input class="input q-custom ${isCustom ? '' : 'hidden'}" name="qcustom${i}" maxlength="120" placeholder="Напишите свой вопрос" value="${isCustom ? esc(cur) : ''}">
      <input class="input" name="qa${i}" maxlength="120" placeholder="Ответ" autocomplete="off" spellcheck="false">
    </div>`;
  }).join('');
}

export function bindQuestions(form) {
  [0, 1, 2].forEach((i) => {
    const sel = form.elements['qsel' + i];
    const custom = form.elements['qcustom' + i];
    sel.addEventListener('change', () => {
      const on = sel.value === CUSTOM;
      custom.classList.toggle('hidden', !on);
      if (on) custom.focus();
    });
  });
}

/** Возвращает [{q, a}] или бросает ошибку с понятным текстом. */
export function readQuestions(form) {
  const out = [0, 1, 2].map((i) => {
    const sel = form.elements['qsel' + i].value;
    const q = (sel === CUSTOM ? form.elements['qcustom' + i].value : sel).trim();
    const a = form.elements['qa' + i].value;
    if (!q) throw new Error(`Напишите текст вопроса ${i + 1}`);
    if (normAnswer(a).length < 2) throw new Error(`Ответ на вопрос ${i + 1} слишком короткий`);
    return { q, a };
  });
  if (new Set(out.map((x) => x.q.toLowerCase())).size < 3) throw new Error('Вопросы должны быть разными');
  if (new Set(out.map((x) => normAnswer(x.a))).size < 3) throw new Error('Ответы должны быть разными');
  return out;
}

export function focusFirstAnswer(form) {
  $('[name=qa0]', form)?.focus();
}

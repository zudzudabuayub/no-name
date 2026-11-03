// Хранилище. Все данные лежат в localStorage этого браузера в зашифрованном виде.
//
// Устройство:
//   - случайный «ключ данных» (32 байта) шифрует все заметки, пароли, ссылки;
//   - сам ключ данных хранится в трёх «замках», и открыть его можно любым из них:
//       1) логин + пароль;
//       2) ответы на 2 любых из 3 секретных вопросов;
//       3) код восстановления.
//   Поэтому при смене пароля данные не перешифровываются, а меняется только «замок».

import * as C from './crypto.js';
import { defaultData, migrate } from './defaults.js';

const STORE = 'moi-sait:store';
const SESSION = 'moi-sait:session';
const THROTTLE = 'moi-sait:throttle';
const PAIRS = [[0, 1], [0, 2], [1, 2]];

let dekRaw = null;
let dekKey = null;
let data = null;
let saving = Promise.resolve();

const readStore = () => {
  try { return JSON.parse(localStorage.getItem(STORE)); } catch { return null; }
};
const writeStore = (s) => localStorage.setItem(STORE, JSON.stringify(s));

const credSecret = (u, p) => 'login\u0001' + C.normUser(u) + '\u0001' + p;
const pairSecret = (answers, i, j) => `qa\u0001${i}:${C.normAnswer(answers[i])}\u0001${j}:${C.normAnswer(answers[j])}`;
const codeSecret = (code) => 'code\u0001' + C.normCode(code);

function maskUser(u) {
  const s = String(u).trim();
  if (s.length <= 2) return s[0] + '•';
  return s[0] + '•'.repeat(s.length - 2) + s[s.length - 1];
}

export const SESSION_KEY = SESSION;
export const STORE_KEY = STORE;
export const hasVault = () => !!readStore();
export const isUnlocked = () => !!dekKey;
export const getData = () => data;

export function meta() {
  const s = readStore();
  return s ? s.meta : null;
}

async function setKey(raw) {
  dekRaw = raw;
  dekKey = await C.importDataKey(raw);
}

async function open(raw, store) {
  const key = await C.importDataKey(raw);
  const decoded = await C.decryptJSON(key, store.data);
  dekRaw = raw;
  dekKey = key;
  data = migrate(decoded);
  touchSession();
}

function touchSession() {
  if (!dekRaw) return;
  try {
    sessionStorage.setItem(SESSION, JSON.stringify({ k: C.toB64(dekRaw), t: Date.now() }));
  } catch { /* приватный режим — просто не запоминаем сессию */ }
}

export function markActive() { touchSession(); }

async function buildQaWraps(raw, questions) {
  const answers = questions.map((q) => q.a);
  return Promise.all(PAIRS.map(async ([i, j]) => ({ pair: [i, j], ...(await C.wrap(raw, pairSecret(answers, i, j))) })));
}

/** Регистрация. Возвращает код восстановления. */
export async function register({ username, password, hint, questions }) {
  const raw = C.rand(32);
  const code = C.genRecoveryCode();
  const [pw, qa, cw] = await Promise.all([
    C.wrap(raw, credSecret(username, password)),
    buildQaWraps(raw, questions),
    C.wrap(raw, codeSecret(code)),
  ]);
  await setKey(raw);
  data = defaultData(username.trim());
  const store = {
    v: 1,
    meta: {
      userMask: maskUser(username),
      userLen: username.trim().length,
      hint: hint || '',
      questions: questions.map((q) => q.q),
      createdAt: Date.now(),
    },
    wraps: { pw, qa, code: cw },
    data: await C.encryptJSON(dekKey, data),
  };
  writeStore(store);
  touchSession();
  return code;
}

export async function login(username, password) {
  const s = readStore();
  if (!s) return false;
  try {
    const raw = await C.unwrap(s.wraps.pw, credSecret(username, password));
    await open(raw, s);
    return true;
  } catch {
    return false;
  }
}

/** Восстановление по ответам: достаточно правильно ответить на любые 2 из 3. */
export async function recoverWithAnswers(answers) {
  const s = readStore();
  if (!s) return false;
  for (const w of s.wraps.qa || []) {
    const [i, j] = w.pair;
    if (!C.normAnswer(answers[i]) || !C.normAnswer(answers[j])) continue;
    try {
      const raw = await C.unwrap(w, pairSecret(answers, i, j));
      await open(raw, s);
      return true;
    } catch { /* пробуем следующую пару */ }
  }
  return false;
}

export async function recoverWithCode(code) {
  const s = readStore();
  if (!s || !C.normCode(code)) return false;
  try {
    const raw = await C.unwrap(s.wraps.code, codeSecret(code));
    await open(raw, s);
    return true;
  } catch {
    return false;
  }
}

/** Проверка текущего пароля (для смены настроек). */
export async function verifyPassword(password) {
  const s = readStore();
  if (!s || !data) return false;
  try {
    await C.unwrap(s.wraps.pw, credSecret(data.profile.username, password));
    return true;
  } catch {
    return false;
  }
}

export async function setCredentials({ username, password, hint }) {
  if (!dekRaw) throw new Error('Хранилище заблокировано');
  const s = readStore();
  s.wraps.pw = await C.wrap(dekRaw, credSecret(username, password));
  s.meta.userMask = maskUser(username);
  s.meta.userLen = username.trim().length;
  if (hint !== undefined) s.meta.hint = hint;
  data.profile.username = username.trim();
  s.data = await C.encryptJSON(dekKey, data);
  writeStore(s);
}

export async function setHint(hint) {
  const s = readStore();
  s.meta.hint = hint;
  writeStore(s);
}

export async function setQuestions(questions) {
  if (!dekRaw) throw new Error('Хранилище заблокировано');
  const s = readStore();
  s.wraps.qa = await buildQaWraps(dekRaw, questions);
  s.meta.questions = questions.map((q) => q.q);
  writeStore(s);
}

export async function newRecoveryCode() {
  if (!dekRaw) throw new Error('Хранилище заблокировано');
  const code = C.genRecoveryCode();
  const s = readStore();
  s.wraps.code = await C.wrap(dekRaw, codeSecret(code));
  writeStore(s);
  return code;
}

/** Сохранение. Запросы выстраиваются в очередь, чтобы старая версия не затёрла новую. */
export function save() {
  saving = saving.catch(() => {}).then(async () => {
    if (!dekKey || !data) return;
    const s = readStore();
    if (!s) return;
    s.data = await C.encryptJSON(dekKey, data);
    writeStore(s);
  });
  return saving;
}

/** Перечитать данные (например, если они изменились в другой вкладке). */
export async function reload() {
  const s = readStore();
  if (!s || !dekKey) return false;
  try {
    data = migrate(await C.decryptJSON(dekKey, s.data));
    return true;
  } catch {
    return false;
  }
}

export async function restoreSession() {
  let sess;
  try { sess = JSON.parse(sessionStorage.getItem(SESSION)); } catch { sess = null; }
  const s = readStore();
  if (!sess || !s) return false;
  try {
    await open(C.fromB64(sess.k), s);
  } catch {
    lock();
    return false;
  }
  const min = Number(data.settings.autoLock) || 0;
  if (min > 0 && Date.now() - (sess.t || 0) > min * 60000) {
    lock();
    return false;
  }
  return true;
}

export function lock() {
  dekRaw = null;
  dekKey = null;
  data = null;
  try { sessionStorage.removeItem(SESSION); } catch { /* ignore */ }
}

export function exportBackup() {
  const s = readStore();
  return JSON.stringify({ app: 'moi-sait', version: 1, exportedAt: new Date().toISOString(), store: s }, null, 1);
}

export function importBackup(text) {
  let obj;
  try { obj = JSON.parse(text); } catch { throw new Error('Файл повреждён или это не резервная копия'); }
  const s = obj && obj.store ? obj.store : obj;
  if (!s || !s.wraps || !s.wraps.pw || !s.data || !s.meta) throw new Error('Это не резервная копия этого сайта');
  lock();
  writeStore(s);
}

export function wipe() {
  lock();
  localStorage.removeItem(STORE);
  localStorage.removeItem(THROTTLE);
}

// --- защита от подбора: после 5 ошибок растущая пауза ---

function readThrottle() {
  try { return JSON.parse(localStorage.getItem(THROTTLE)) || { n: 0, until: 0 }; } catch { return { n: 0, until: 0 }; }
}

export function throttleWait() {
  return Math.max(0, readThrottle().until - Date.now());
}

export function registerFail() {
  const t = readThrottle();
  t.n += 1;
  if (t.n >= 5) t.until = Date.now() + Math.min(600, 15 * 2 ** (t.n - 5)) * 1000;
  localStorage.setItem(THROTTLE, JSON.stringify(t));
}

export function clearFails() {
  localStorage.removeItem(THROTTLE);
}

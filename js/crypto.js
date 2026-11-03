// Шифрование. Всё работает в браузере через Web Crypto API:
// ключ из пароля получается через PBKDF2-SHA256, данные шифруются AES-256-GCM.

const te = new TextEncoder();
const td = new TextDecoder();

export const ITERATIONS = 250000;

export const rand = (n) => crypto.getRandomValues(new Uint8Array(n));

export function toB64(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export function fromB64(str) {
  const s = atob(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function deriveKey(secret, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', te.encode(secret), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Зашифровать байты ключом, полученным из секрета (пароль, ответы, код). */
export async function wrap(raw, secret) {
  const salt = rand(16);
  const iv = rand(12);
  const key = await deriveKey(secret, salt, ITERATIONS);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, raw);
  return { salt: toB64(salt), iv: toB64(iv), ct: toB64(ct), iter: ITERATIONS };
}

/** Расшифровать. При неверном секрете бросает исключение. */
export async function unwrap(w, secret) {
  const key = await deriveKey(secret, fromB64(w.salt), w.iter || ITERATIONS);
  const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(w.iv) }, key, fromB64(w.ct));
  return new Uint8Array(raw);
}

export function importDataKey(raw) {
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptJSON(key, obj) {
  const iv = rand(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(obj)));
  return { iv: toB64(iv), ct: toB64(ct) };
}

export async function decryptJSON(key, payload) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(payload.iv) }, key, fromB64(payload.ct));
  return JSON.parse(td.decode(pt));
}

/** Случайное целое 0..max-1 без перекоса. */
export function randomInt(max) {
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
  return buf[0] % max;
}

/** Ответы на секретные вопросы сравниваются без учёта регистра, ё/е, пробелов и знаков. */
export function normAnswer(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[.,!?;:"'«»()\[\]{}\-–—_/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const normUser = (s) => String(s || '').trim().toLowerCase();

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Код восстановления вида ABCD-EFGH-JKMN-PQRS (~79 бит). */
export function genRecoveryCode() {
  let s = '';
  for (let i = 0; i < 16; i++) {
    if (i && i % 4 === 0) s += '-';
    s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return s;
}

export const normCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const SETS = {
  lower: 'abcdefghijkmnopqrstuvwxyz',
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  digits: '23456789',
  symbols: '!@#$%^&*-_=+?',
};

export function genPassword({ length = 16, lower = true, upper = true, digits = true, symbols = true } = {}) {
  const groups = [];
  if (lower) groups.push(SETS.lower);
  if (upper) groups.push(SETS.upper);
  if (digits) groups.push(SETS.digits);
  if (symbols) groups.push(SETS.symbols);
  if (!groups.length) groups.push(SETS.lower);
  const all = groups.join('');
  const chars = groups.map((g) => g[randomInt(g.length)]);
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.slice(0, length).join('');
}

/** Грубая оценка надёжности пароля: 0..4 и подпись. */
export function strength(pw) {
  if (!pw) return { score: 0, label: '' };
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[а-яё]/.test(pw)) pool += 33;
  if (/[А-ЯЁ]/.test(pw)) pool += 33;
  if (/[^a-zA-Z0-9а-яёА-ЯЁ]/.test(pw)) pool += 20;
  let bits = pw.length * Math.log2(Math.max(pool, 2));
  if (/^(.)\1+$/.test(pw) || /^(123|qwe|пароль|password)/i.test(pw)) bits = Math.min(bits, 20);
  if (bits < 36) return { score: 1, label: 'Слабый' };
  if (bits < 60) return { score: 2, label: 'Средний' };
  if (bits < 80) return { score: 3, label: 'Хороший' };
  return { score: 4, label: 'Отличный' };
}

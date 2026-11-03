// Начальные данные. Всё можно поменять прямо на сайте.

const id = () => Math.random().toString(36).slice(2, 10);

export const APP_NAME = 'Мой сайт';

export function defaultServices() {
  return [
    {
      id: id(),
      name: 'cobalt',
      url: 'https://cobalt.tools/?u={url}',
      platforms: ['all'],
      note: 'Без рекламы, открытый код. Ссылка подставится сама.',
    },
    {
      id: id(),
      name: 'SaveFrom',
      url: 'https://savefrom.net/#url={url}',
      platforms: ['youtube', 'instagram', 'tiktok', 'facebook', 'vk', 'ok', 'twitter', 'vimeo', 'dailymotion', 'soundcloud'],
      note: 'Сторонний сайт с рекламой.',
    },
    {
      id: id(),
      name: 'SSSTik',
      url: 'https://ssstik.io/',
      platforms: ['tiktok'],
      note: 'Для TikTok без водяного знака. Ссылку нужно вставить.',
    },
    {
      id: id(),
      name: 'SnapInsta',
      url: 'https://snapinsta.app/',
      platforms: ['instagram'],
      note: 'Для Reels и постов Instagram. Ссылку нужно вставить.',
    },
  ];
}

const yt = (q) => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);

export function defaultFootballLinks() {
  return [
    { id: id(), group: 'watch', title: 'Обзоры матчей', url: yt('обзор матча') },
    { id: id(), group: 'watch', title: 'FIFA+', url: 'https://www.plus.fifa.com/' },
    { id: id(), group: 'watch', title: 'UEFA.tv', url: 'https://www.uefa.tv/' },
    { id: id(), group: 'watch', title: 'MEGOGO', url: 'https://megogo.net/' },
    { id: id(), group: 'scores', title: 'Sofascore', url: 'https://www.sofascore.com/' },
    { id: id(), group: 'scores', title: 'Flashscore', url: 'https://www.flashscore.com/' },
    { id: id(), group: 'scores', title: 'LiveScore', url: 'https://www.livescore.com/' },
    { id: id(), group: 'scores', title: 'Sports.ru', url: 'https://www.sports.ru/football/' },
    { id: id(), group: 'scores', title: 'Чемпионат', url: 'https://www.championat.com/football/' },
    { id: id(), group: 'scores', title: 'ESPN', url: 'https://www.espn.com/soccer/' },
  ];
}

/**
 * Официальные бесплатные спортивные телеканалы государственных телекомпаний —
 * трансляции идут с их собственных серверов. Некоторые работают только в своей стране.
 */
export const DEFAULT_CHANNELS = [
  {
    id: 'tj-futbol',
    name: 'Футбол',
    country: 'Таджикистан',
    url: 'https://live.teleradiocom.tj/8/3m.m3u8',
    note: 'Государственный спортивный канал',
  },
  {
    id: 'kz-qazsport',
    name: 'QazSport',
    country: 'Казахстан',
    url: 'https://qazsporttv-stream.qazcdn.com/qazsporttv/qazsporttv/playlist.m3u8',
    note: 'Работает только в Казахстане',
  },
  {
    id: 'tm-sport',
    name: 'Türkmenistan Sport',
    country: 'Туркменистан',
    url: 'https://alpha.tv.online.tm/hls/ch004.m3u8',
    note: 'Вещает не круглосуточно',
  },
];

export function defaultLinks() {
  const now = Date.now();
  return [
    { id: id(), title: 'YouTube', url: 'https://www.youtube.com/', category: 'Соцсети', fav: true, createdAt: now },
    { id: id(), title: 'Instagram', url: 'https://www.instagram.com/', category: 'Соцсети', fav: true, createdAt: now },
    { id: id(), title: 'TikTok', url: 'https://www.tiktok.com/', category: 'Соцсети', fav: true, createdAt: now },
    { id: id(), title: 'Telegram', url: 'https://web.telegram.org/', category: 'Соцсети', fav: false, createdAt: now },
    { id: id(), title: 'Google', url: 'https://www.google.com/', category: 'Полезное', fav: true, createdAt: now },
    { id: id(), title: 'Переводчик', url: 'https://translate.google.com/', category: 'Полезное', fav: false, createdAt: now },
    { id: id(), title: 'Карты', url: 'https://www.google.com/maps', category: 'Полезное', fav: false, createdAt: now },
    { id: id(), title: 'GitHub', url: 'https://github.com/', category: 'Полезное', fav: false, createdAt: now },
  ];
}

export function defaultData(username) {
  return {
    profile: { username, createdAt: Date.now() },
    notes: [],
    passwords: [],
    links: defaultLinks(),
    football: { links: defaultFootballLinks(), videos: [], channels: [], hiddenChannels: [] },
    downloads: { services: defaultServices(), history: [], saveHistory: true, server: { url: '', key: '' }, quality: '720' },
    settings: { autoLock: 15 },
  };
}

/** Дополняет данные недостающими полями (для будущих версий сайта). */
export function migrate(d) {
  const base = defaultData(d?.profile?.username || '');
  d = d || base;
  d.profile = { ...base.profile, ...d.profile };
  d.notes = Array.isArray(d.notes) ? d.notes : [];
  d.passwords = Array.isArray(d.passwords) ? d.passwords : [];
  d.links = Array.isArray(d.links) ? d.links : base.links;
  d.football = { ...base.football, ...d.football };
  d.downloads = { ...base.downloads, ...d.downloads };
  d.settings = { ...base.settings, ...d.settings };
  return d;
}

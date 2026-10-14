/**
 * 小六壬 · 马前课 —— Egern 小组件
 * 刷新那一刻取系统时间起课：月宫 → 日宫 → 时宫，落宫取时宫
 *
 * env（小组件编辑页添加）：
 *   ZI_ROLLOVER = "1"    子时换日（23:00 后日宫按次日数）
 *   SHOW_MEANING = "0"   大尺寸不显示六神断语全诗
 *
 * 修复记录（2026-10-02）：原 solarToLunar() 在闰月被消费后 isLeap 不复位，
 *   闰月之后每个月都按闰月天数（29/30）计，误差累积错到次年春节前。实测错例：
 *   2023-06-22 端午 → 闰六月初六（应五月初五）；2025-10-06 中秋 → 闰九月十六（应八月十五）；
 *   2026-01-01 → 闰腊月十六（应冬月十三）。已改为「正常月 → 该月闰月副本」两趟推进。
 *   验证：与独立「逐月推进」算法对拍，月边界 4972 天 + 闰月年逐日 2192 天 0 不符，
 *   基准日 16/16（修复前 1164 / 1124 天不符、基准日 11/16）。
 *   同名 Surge 信息面板版见 Surge/Scripts/xiaoliuren-panel.js，内核与本文一致。
 */

const LUNAR_INFO = [
0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,
0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,
0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,
0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,
0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,
0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,
0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6,
0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,
0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x05ac0,0x0ab60,0x096d5,0x092e0,
0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,
0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,
0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,
0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,
0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,
0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06b20,0x1a6c4,0x0aae0,
0x0a2e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,
0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,
0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,
0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a2d0,0x0d150,0x0f252,
0x0d520];

// 六宫：序 1→6 = 大安 留连 速喜 赤口 小吉 空亡
const PALACES = [
  { name: '大安', wuxing: '木', dir: '东方', num: 1,
    short: '诸事安稳，宜守成',
    brief: '事事昌泰，身不动、物未失。宜守成，不宜躁进。',
    ju: '大安事事昌，求财在坤方。失物去不远，宅舍保安康。行人身未动，病者主无妨。将军回田野，仔细更推详。' },
  { name: '留连', wuxing: '水', dir: '北方', num: 2,
    short: '事有反复，宜缓图',
    brief: '事多拖延，反复难决。变数在暗处，急则更滞。',
    ju: '留连事难成，求谋日未明。官事凡不宜，去者未回程。失物南方见，急讨方称心。更须防口舌，人事且和平。' },
  { name: '速喜', wuxing: '火', dir: '南方', num: 3,
    short: '喜讯将至，快办快成',
    brief: '喜讯将至，立见分晓。时机正在手上，迟则失机。',
    ju: '速喜喜来临，求财向南行。失物申未午，逢人路上寻。官事有福德，病者无祸侵。田宅六畜好，出行有吉音。' },
  { name: '赤口', wuxing: '金', dir: '西方', num: 4,
    short: '口舌是非，谨言慎行',
    brief: '口舌是非，争执官非。言多必失，遇冲突冷处理。',
    ju: '赤口主口舌，官非切宜防。失物速速讨，行人有惊慌。六畜多作怪，病者出西方。更须防咒怨，恐染祸灾殃。' },
  { name: '小吉', wuxing: '木', dir: '东方', num: 5,
    short: '和合顺遂，贵人相助',
    brief: '和合顺意，贵人相助。小事必成，宜结不宜断。',
    ju: '小吉最吉昌，路上好商量。阴人来报喜，失物在坤方。行人即便至，交关甚是强。凡事皆和合，病者叩穹苍。' },
  { name: '空亡', wuxing: '土', dir: '中央', num: 6,
    short: '落空无果，静待时机',
    brief: '音信落空，谋事难成。用力皆虚耗，宜静待时机。',
    ju: '空亡事不祥，阴人多乖张。求财无利益，行人有灾殃。失物寻不见，官事有刑伤。病人逢邪祟，斟酌更周详。' },
];

const MONTH_NAMES = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const DAY_NAMES = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十',
  '十一','十二','十三','十四','十五','十六','十七','十八','十九','二十',
  '廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
const ZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const SHICHEN_RANGE = ['23-01','01-03','03-05','05-07','07-09','09-11','11-13','13-15','15-17','17-19','19-21','21-23'];
const POSITION_HINT = ['东南', '正南', '西南', '正西', '东北', '正北'];

// ---------- 农历换算（1900–2100） ----------
const leapMonth = (y) => LUNAR_INFO[y - 1900] & 0xf;
const leapDays = (y) => (leapMonth(y) ? ((LUNAR_INFO[y - 1900] & 0x10000) ? 30 : 29) : 0);
const monthDays = (y, m) => ((LUNAR_INFO[y - 1900] & (0x10000 >> m)) ? 30 : 29);
const yearDays = (y) => {
  let sum = 348;
  for (let i = 0x8000; i > 0x8; i >>= 1) sum += (LUNAR_INFO[y - 1900] & i) ? 1 : 0;
  return sum + leapDays(y);
};

function solarToLunar(y, m, d) {
  let offset = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1900, 0, 31)) / 86400000);
  let ly = 1900;
  for (; ly < 2101 && offset >= yearDays(ly); ly++) offset -= yearDays(ly);
  const leap = leapMonth(ly);
  let lm = 1;
  for (; lm <= 12; lm++) {
    for (let pass = 0; pass < 2; pass++) {
      // 正常月 pass0 → 该月的闰月副本 pass1（只在本月之后出现一次）
      if (pass === 1 && lm !== leap) break;
      const isL = pass === 1;
      const dm = isL ? leapDays(ly) : monthDays(ly, lm);
      if (offset < dm) return { year: ly, month: lm, day: offset + 1, isLeap: isL };
      offset -= dm;
    }
  }
  return { year: ly, month: 12, day: offset + 1, isLeap: false };
}

function cast(date, ziRollover) {
  const ziHour = date.getHours() >= 23 || date.getHours() < 1;
  const dayDate = (ziRollover && ziHour) ? new Date(date.getTime() + 3600000) : date;
  const lunar = solarToLunar(dayDate.getFullYear(), dayDate.getMonth() + 1, dayDate.getDate());
  const zhi = Math.floor(((date.getHours() + 1) % 24) / 2);
  const monthIdx = (lunar.month - 1) % 6;
  const dayIdx = (monthIdx + lunar.day - 1) % 6;
  const hourIdx = (dayIdx + zhi) % 6;
  return { lunar, zhi, monthIdx, dayIdx, hourIdx };
}

function nextShichenTime(now) {
  const next = new Date(now.getTime());
  next.setSeconds(0, 0);
  next.setMinutes(0);
  const h = now.getHours();
  const boundary = h % 2 === 1 ? h : h + 1;
  next.setHours(boundary);
  if (next <= now) next.setHours(boundary + 2);
  return next;
}

/* ============================================================
 * 主屏幕渲染（2026-10-14 视觉改版：借鉴 Hark 仪表盘小组件）
 *  · backgroundGradient 渐变底 + 玻璃面板（与油价/彩票组件同一套观感）
 *  · 六宫圆盘：六个宫位圆标，落宫实心高亮（Hark 的 ball 语法：stack + width/height/borderRadius）
 *  · 三宫来路（月→日→时）压进落宫副栏，不额外占高；大尺寸另有步骤卡 + 断语玻璃面板
 * ============================================================ */
const GLASS = { light: '#FFFFFFA6', dark: '#FFFFFF1A' };
const TXT = {
  primary: { light: '#16161A', dark: '#FFFFFF' },
  secondary: { light: '#4A4A50', dark: '#B6B6BC' },
  tertiary: { light: '#8A8A90', dark: '#7E7E85' },
};
// 六宫色：大安青绿（木·安稳）· 留连蓝（水·拖延）· 速喜橙（火·喜讯）
//        · 赤口红（金·口舌）· 小吉紫（贵人·和合）· 空亡灰蓝（土·落空）
const PAL = {
  大安: { light: '#1E8E5A', dark: '#3FD98A' },
  留连: { light: '#1668C4', dark: '#64A8FF' },
  速喜: { light: '#D9701C', dark: '#FFA35C' },
  赤口: { light: '#C8202A', dark: '#FF6B6B' },
  小吉: { light: '#7A4BC0', dark: '#B98CFF' },
  空亡: { light: '#6E7C8A', dark: '#A3B0BC' },
};
function bg() {
  return {
    type: 'linear',
    colors: [{ light: '#FFF1F0', dark: '#2A0E10' }, { light: '#F4F0FF', dark: '#140F26' }, { light: '#EEF6FF', dark: '#07121F' }],
    stops: [0, 0.55, 1], startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 },
  };
}
const T = (text, size, color, weight = 'regular', extra = {}) =>
  Object.assign({ type: 'text', text: String(text == null ? '' : text), font: { size, weight }, textColor: color, lineLimit: 1, minScale: 0.7 }, extra);
const ICON = (name, color, size = 12) => ({ type: 'image', src: `sf-symbol:${name}`, width: size, height: size, color });
const ROW = (children, extra = {}) => Object.assign({ type: 'stack', direction: 'row', alignItems: 'center', gap: 4, children }, extra);
const COL = (children, extra = {}) => Object.assign({ type: 'stack', direction: 'column', alignItems: 'center', gap: 4, children }, extra);
const glass = (children, extra = {}) =>
  Object.assign({ type: 'stack', direction: 'column', alignItems: 'start', gap: 4, padding: [7, 10], borderRadius: 14, backgroundColor: GLASS, children }, extra);

function errorWidget(e) {
  return {
    type: 'widget', padding: 14, gap: 6, backgroundGradient: bg(),
    children: [
      ICON('exclamationmark.triangle.fill', { light: '#C77700', dark: '#FFD60A' }, 18),
      T('起课失败', 14, TXT.primary, 'semibold'),
      T(String((e && e.message) || e), 10, TXT.secondary, 'regular', { lineLimit: 3, minScale: 0.8 }),
    ],
  };
}

export default async function (ctx) {
  const env = ctx.env || {};
  const ZI_ROLLOVER = (env.ZI_ROLLOVER || '').trim() === '1';
  const SHOW_MEANING = (env.SHOW_MEANING || 'true').trim() !== '0';

  const now = new Date();
  let result;
  try {
    result = cast(now, ZI_ROLLOVER);
  } catch (e) {
    return errorWidget(e);
  }
  const { lunar, zhi, monthIdx, dayIdx, hourIdx } = result;
  const month = PALACES[monthIdx], day = PALACES[dayIdx], hour = PALACES[hourIdx];

  const pcol = (p) => PAL[p.name] || TXT.secondary;
  const tint = (p, a) => { const c = pcol(p); return { light: c.light + a, dark: c.dark + a }; };
  const pad2 = (n) => String(n).padStart(2, '0');
  const clock = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  const lunarStr = `农历${lunar.isLeap ? '闰' : ''}${MONTH_NAMES[lunar.month - 1]}月${DAY_NAMES[lunar.day - 1]}`;
  const path = `月${month.name} › 日${day.name} › 时${hour.name}`;
  const refreshTime = nextShichenTime(now).toISOString();
  const fam = ctx.widgetFamily || 'systemSmall';
  const isSmall = fam === 'systemSmall';
  const isLarge = fam === 'systemLarge' || fam === 'systemExtraLarge';

  // 昼夜图标：昼辰(辰7…酉9)为日，其余为月；refreshAfter 钉在时辰交界，图标随之自然切换
  const dayIcon = (zhi >= 4 && zhi <= 9)
    ? { name: 'sun.max.fill', color: { light: '#C75700', dark: '#FF9F0A' } }
    : { name: 'moon.stars.fill', color: { light: '#C77700', dark: '#FFD60A' } };

  // ---------- 锁屏 ----------
  if (fam === 'accessoryInline') {
    return {
      type: 'widget', refreshAfter: refreshTime,
      children: [T(`小六壬 ${hour.name}·${ZHI[zhi]}时`, 'caption1', pcol(hour), 'semibold')],
    };
  }
  if (fam === 'accessoryCircular') {
    return {
      type: 'widget', refreshAfter: refreshTime, padding: 2, children: [
        T(hour.name, 'headline', pcol(hour), 'heavy', { textAlign: 'center', minScale: 0.55 }),
        T(ZHI[zhi] + '时', 'caption2', TXT.secondary, 'regular', { textAlign: 'center' }),
      ],
    };
  }
  if (fam === 'accessoryRectangular') {
    return {
      type: 'widget', refreshAfter: refreshTime, gap: 2, children: [
        ROW([T(`小六壬 ${hour.name}`, 'headline', pcol(hour), 'bold'), { type: 'spacer' },
          T(`${ZHI[zhi]}时`, 'caption1', TXT.secondary)], { gap: 6 }),
        T(path, 'caption2', TXT.secondary, 'regular', { minScale: 0.65 }),
      ],
    };
  }

  // ---------- 六宫圆盘 ----------
  const ballSize = isSmall ? 20 : isLarge ? 40 : 30;
  const ball = (p) => {
    const active = p.name === hour.name;
    const c = pcol(p);
    const extra = {
      alignItems: 'center', justifyContent: 'center', gap: 0,
      width: ballSize, height: ballSize, borderRadius: ballSize / 2,
      backgroundColor: active ? c : tint(p, isLarge ? '33' : '26'),
    };
    if (!active) { extra.borderWidth = 1; extra.borderColor = tint(p, '55'); }
    return {
      type: 'stack', direction: 'row', ...extra,
      children: [T(p.name, Math.round(ballSize * 0.36), active ? { light: '#FFFFFF', dark: '#0D0D10' } : c, 'semibold',
        { textAlign: 'center', minScale: 0.55 })],
    };
  };
  const discRow = ROW(PALACES.map(ball), { gap: isSmall ? 3 : 6, justifyContent: 'center' });

  // ---------- 三宫步骤（仅大尺寸，空间够时展示来路） ----------
  const stepCell = (label, p, active) => {
    const inner = [
      T(label, 'caption2', active ? TXT.secondary : TXT.tertiary, 'regular', { textAlign: 'center' }),
      T(p.name, active ? 'subheadline' : 'footnote', active ? TXT.primary : pcol(p), active ? 'heavy' : 'semibold',
        { textAlign: 'center', minScale: 0.65 }),
    ];
    if (!active) return COL(inner, { gap: 1 });
    return COL(inner, {
      gap: 1, padding: [3, 7, 3, 7], borderRadius: 9,
      backgroundColor: tint(p, '2E'), borderWidth: 1, borderColor: tint(p, '66'),
    });
  };
  const stepsRow = ROW([
    stepCell('月宫', month, false),
    T('›', 'caption1', TXT.tertiary, 'regular'),
    stepCell('日宫', day, false),
    T('›', 'caption1', TXT.tertiary, 'regular'),
    stepCell('时宫', hour, true),
  ], { gap: 3, justifyContent: 'center' });

  // ---------- 主屏装配 ----------
  const head = ROW([
    ICON(dayIcon.name, dayIcon.color, 13),
    T('小六壬', 'subheadline', TXT.primary, 'bold'),
    { type: 'spacer' },
    T(isSmall ? `${ZHI[zhi]}时` : `${lunarStr} · ${clock}`, 'caption2', TXT.secondary, 'regular',
      { textAlign: 'right', minScale: 0.6 }),
  ]);

  const heroSub = [
    T(`第${hour.num}宫 · ${hour.wuxing} · ${hour.dir}`, isSmall ? 'caption1' : 'footnote', TXT.secondary, 'medium', { minScale: 0.7 }),
  ];
  if (!isSmall) heroSub.push(T(path, 'caption2', TXT.tertiary, 'regular', { minScale: 0.65, lineLimit: 1 }));
  const heroName = T(hour.name, isLarge ? 'largeTitle' : 'title', pcol(hour), 'heavy', { minScale: 0.6 });
  // 小尺寸窄：名称与信息竖排，避免横向被裁
  const heroBlock = isSmall
    ? COL([heroName, ...heroSub], { alignItems: 'start', gap: 2 })
    : ROW([heroName, COL(heroSub, { alignItems: 'start', gap: 0 })], { gap: 7, alignItems: 'center' });

  const children = [head];
  const gap = isSmall ? 4 : 5;
  if (isSmall) {
    children.push({ type: 'spacer' }, discRow, { type: 'spacer' }, heroBlock,
      T(hour.short, 'footnote', TXT.secondary, 'medium', { lineLimit: 2, minScale: 0.72 }));
  } else if (isLarge) {
    const panel = [
      ROW([ICON('text.book.closed.fill', TXT.tertiary, 10), T('落宫断语', 'caption2', TXT.tertiary, 'semibold'),
        { type: 'spacer' }, T('仅供玩味', 'caption2', TXT.tertiary, 'regular')], { gap: 5 }),
      T(hour.brief, 'footnote', TXT.primary, 'medium', { lineLimit: 2, minScale: 0.8 }),
    ];
    if (SHOW_MEANING) panel.push(T(hour.ju, 'caption1', TXT.secondary, 'regular', { lineLimit: 3, minScale: 0.8 }));
    children.push(
      { type: 'spacer' },
      discRow,
      { type: 'spacer', length: 8 },
      stepsRow,
      { type: 'spacer' },
      heroBlock,
      { type: 'spacer', length: 6 },
      glass(panel, { padding: [9, 12], gap: 4 }),
      { type: 'spacer' },
    );
  } else {
    children.push({ type: 'spacer' }, discRow, { type: 'spacer' }, heroBlock,
      T(hour.short, 'footnote', TXT.secondary, 'medium', { lineLimit: 2, minScale: 0.72 }));
  }

  return {
    type: 'widget',
    padding: isSmall ? [12, 13, 12, 13] : [14, 16, 14, 16],
    gap,
    backgroundGradient: bg(),
    refreshAfter: refreshTime,
    children,
  };
}

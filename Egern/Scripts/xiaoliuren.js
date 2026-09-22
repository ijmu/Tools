/**
 * 小六壬 · 马前课 —— Egern 小组件
 * 刷新那一刻取系统时间起课：月宫 → 日宫 → 时宫，落宫取时宫
 *
 * env（小组件编辑页添加）：
 *   ZI_ROLLOVER = "1"    子时换日（23:00 后日宫按次日数）
 *   SHOW_MEANING = "0"   大尺寸不显示六神断语全诗
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
  let isLeap = false;
  let lm = 1;
  for (; lm <= 12; lm++) {
    const dm = isLeap ? leapDays(ly) : monthDays(ly, lm);
    if (offset < dm) break;
    offset -= dm;
    if (lm === leap) isLeap = !isLeap;
  }
  return { year: ly, month: lm, day: offset + 1, isLeap };
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

export default async function (ctx) {
  const ZI_ROLLOVER = (ctx.env.ZI_ROLLOVER || "").trim() === "1";
  const SHOW_MEANING = (ctx.env.SHOW_MEANING || "true").trim() !== "0";

  const now = new Date();
  let result;
  try {
    result = cast(now, ZI_ROLLOVER);
  } catch (e) {
    return {
      type: 'widget',
      padding: 14,
      backgroundColor: { light: '#FFFFFF', dark: '#1C1C1E' },
      children: [{ type: 'text', text: '起课失败: ' + e.message, font: { size: 'caption1' }, textColor: '#FF3B30' }],
    };
  }
  const { lunar, zhi, monthIdx, dayIdx, hourIdx } = result;
  const month = PALACES[monthIdx], day = PALACES[dayIdx], hour = PALACES[hourIdx];

  const pad = (n) => String(n).padStart(2, '0');
  const clock = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const lunarStr = `农历${lunar.isLeap ? '闰' : ''}${MONTH_NAMES[lunar.month - 1]}月${DAY_NAMES[lunar.day - 1]}`;
  const refreshTime = nextShichenTime(now).toISOString();
  const fam = ctx.widgetFamily || 'systemSmall';

  // 颜色：light/dark 自适应（参考油价组件写法）
  const C = {
    bg: { light: '#FFFFFF', dark: '#1C1C1E' },
    card: { light: '#EBEBF0', dark: '#2C2C2E' },
    primary: { light: '#1A1A1A', dark: '#FFFFFF' },
    secondary: { light: '#666666', dark: '#AAAAAA' },
    tertiary: { light: '#999999', dark: '#6E6E73' },
    accent: {
      light: { 大安: '#1E9E43', 留连: '#0A6ED1', 速喜: '#C77700', 赤口: '#D70015', 小吉: '#248A3D', 空亡: '#8E8E93' }[hour.name],
      dark: { 大安: '#34C759', 留连: '#0A84FF', 速喜: '#FF9F0A', 赤口: '#FF453A', 小吉: '#30D158', 空亡: '#98989D' }[hour.name],
    },
  };
  const pColor = (p) => ({
    light: { 大安: '#1E9E43', 留连: '#0A6ED1', 速喜: '#C77700', 赤口: '#D70015', 小吉: '#248A3D', 空亡: '#8E8E93' }[p.name],
    dark: { 大安: '#34C759', 留连: '#0A84FF', 速喜: '#FF9F0A', 赤口: '#FF453A', 小吉: '#30D158', 空亡: '#98989D' }[p.name],
  });

  const isSmall = fam === 'systemSmall';
  const isLarge = fam === 'systemLarge';

  // 昼夜图标：白天太阳 / 夜晚月亮——refreshAfter 钉在时辰交界，图标随之自然切换
  const dayIcon = (() => {
    // 白昼：辰(07)…酉(19)；其余为夜
    if (zhi >= 4 && zhi <= 9) {
      return { name: 'sun.max.fill', color: { light: '#C75700', dark: '#FF9F0A' } };
    }
    return { name: 'moon.stars.fill', color: { light: '#C77700', dark: '#FFD60A' } };
  })();

  // 锁屏内联
  if (fam === 'accessoryInline') {
    return {
      type: 'widget',
      refreshAfter: refreshTime,
      children: [{ type: 'text', text: `小六壬 ${hour.name}·${ZHI[zhi]}时`, font: { size: 'caption1', weight: 'semibold' }, textColor: C.accent, lineLimit: 1 }],
    };
  }
  // 锁屏圆形
  if (fam === 'accessoryCircular') {
    return {
      type: 'widget', refreshAfter: refreshTime, padding: 2,
      children: [
        { type: 'text', text: hour.name, font: { size: 'headline', weight: 'heavy' }, textColor: C.accent, textAlign: 'center', lineLimit: 1, minScale: 0.55 },
        { type: 'text', text: ZHI[zhi] + '时', font: { size: 'caption2' }, textColor: C.secondary, textAlign: 'center' },
      ],
    };
  }
  // 锁屏矩形
  if (fam === 'accessoryRectangular') {
    return {
      type: 'widget', refreshAfter: refreshTime, gap: 2,
      children: [
        { type: 'stack', direction: 'row', alignItems: 'center', gap: 6, children: [
          { type: 'text', text: `小六壬 ${hour.name}`, font: { size: 'headline', weight: 'bold' }, textColor: C.accent, lineLimit: 1 },
          { type: 'spacer' },
          { type: 'text', text: `${ZHI[zhi]}时`, font: { size: 'caption1' }, textColor: C.secondary },
        ]},
        { type: 'text', text: `月${month.name} › 日${day.name} › 时${hour.name}`, font: { size: 'caption2' }, textColor: C.secondary, lineLimit: 1, minScale: 0.7 },
      ],
    };
  }

  // ---------- 主屏幕 ----------
  // 三步行：参宫小字，时宫加底托示「落」
  const stepCell = (label, p, active) => {
    const inner = [
      { type: 'text', text: label, font: { size: 'caption2' }, textColor: active ? C.secondary : C.tertiary, textAlign: 'center', lineLimit: 1 },
      { type: 'text', text: p.name, font: { size: active ? 'subheadline' : 'footnote', weight: active ? 'heavy' : 'semibold' },
        textColor: active ? C.primary : pColor(p), textAlign: 'center', lineLimit: 1, minScale: 0.65 },
    ];
    if (!active) return { type: 'stack', direction: 'column', alignItems: 'center', gap: 1, children: inner };
    return {
      type: 'stack', direction: 'column', alignItems: 'center', gap: 1,
      padding: [3, 7, 3, 7], borderRadius: 8,
      backgroundColor: { light: pColor(p).light + '26', dark: pColor(p).dark + '33' },
      borderWidth: 1, borderColor: { light: pColor(p).light + '55', dark: pColor(p).dark + '66' },
      children: inner,
    };
  };

  const stepsRow = {
    type: 'stack', direction: 'row', alignItems: 'center', gap: 3,
    children: [
      stepCell('月宫', month, false),
      { type: 'text', text: '›', font: { size: 'caption1' }, textColor: C.tertiary },
      stepCell('日宫', day, false),
      { type: 'text', text: '›', font: { size: 'caption1' }, textColor: C.tertiary },
      stepCell('时宫', hour, true),
    ],
  };

  const subLine = isSmall
    ? `${hour.num}·${POSITION_HINT[hourIdx]}`
    : `${hour.num}·${POSITION_HINT[hourIdx]} · ${hour.wuxing} · ${hour.dir}`;

  const children = [
    // header
    { type: 'stack', direction: 'row', alignItems: 'center', gap: 4, children: [
      { type: 'image', src: `sf-symbol:${dayIcon.name}`, width: 13, height: 13, color: dayIcon.color },
      { type: 'text', text: '小六壬', font: { size: 'subheadline', weight: 'bold' }, textColor: C.primary, lineLimit: 1 },
      { type: 'spacer' },
      { type: 'text', text: isSmall ? `${ZHI[zhi]}时` : `${lunarStr} · ${clock}`,
        font: { size: 'caption2' }, textColor: C.secondary, textAlign: 'right', lineLimit: 1, minScale: 0.6 },
    ]},
    { type: 'spacer', length: isLarge ? 6 : 3 },
    stepsRow,
    { type: 'spacer', length: isLarge ? 8 : 4 },
    // 落宫大字 + 副行
    { type: 'stack', direction: 'row', alignItems: 'center', gap: 7, children: [
      { type: 'text', text: hour.name, font: { size: isLarge ? 'largeTitle' : 'title', weight: 'heavy' },
        textColor: C.accent, lineLimit: 1, minScale: 0.6 },
      { type: 'text', text: subLine, font: { size: isSmall ? 'caption1' : 'footnote', weight: 'medium' },
        textColor: C.secondary, lineLimit: 1, minScale: 0.7 },
    ]},
    { type: 'text', text: isSmall ? hour.short : hour.brief,
      font: { size: isSmall ? 'footnote' : 'callout', weight: 'medium' }, textColor: C.primary, lineLimit: 2, minScale: 0.72 },
  ];

  if (isLarge) {
    children.push(
      { type: 'spacer', length: 6 },
      { type: 'text', text: '六神断语', font: { size: 'caption2', weight: 'semibold' }, textColor: C.tertiary },
    );
    if (SHOW_MEANING) {
      children.push({ type: 'text', text: hour.ju, font: { size: 'footnote' }, textColor: C.secondary, lineLimit: 4, minScale: 0.75 });
    }
    children.push({ type: 'spacer' });
  }

  return {
    type: 'widget',
    padding: isSmall ? [12, 13, 12, 13] : [14, 16, 14, 16],
    gap: isSmall ? 4 : 5,
    backgroundColor: C.bg,
    refreshAfter: refreshTime,
    children,
  };
}
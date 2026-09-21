// 小六壬 · 马前课 —— Egern generic 脚本（小组件版）
// 每次小组件刷新时，取「那一刻」的系统时间起课，三步定宫：
//   月宫：正月起大安，二月留连，三月速喜，四月赤口，五月小吉，六月空亡，七月回大安…（循环）
//   日宫：从月宫起初一，顺着数到当日
//   时宫：从日宫起子时，顺着数到当前时辰 → 时宫即断事之宫
//
// 部署：
//   1. 工具 → 脚本 → +，名称 xiaoliuren，类型 generic，文件位置「本地」，文件名 xiaoliuren.js
//   2. 编辑文件，粘贴本文件内容，保存
//   3. 分析 → 左上角 → 小组件画廊 → +，名称任意，脚本选 xiaoliuren
//   4. 主屏幕长按 → + → Egern → 选尺寸 → 长按小组件 → 编辑小组件 → 选该名称
//
// 可选 env（小组件编辑页的 Env 区，或配置文件中 widget.env）：
//   ZI_ROLLOVER = "1" | "true"   开启子时换日（23:00 之后算次日的日宫，传统派常用）
//   SHOW_MEANING = "0"           不显示六神断语长文，只留宫位与简述

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

const PALACES = [
  { name: '大安', wuxing: '木', dir: '东方', num: 1, color: '#34C759',
    short: '诸事安稳，宜守成',
    brief: '事事昌泰，安稳顺遂。身不动、物未失，宜守成不宜躁进。',
    ju: '大安事事昌，求财在坤方。失物去不远，宅舍保安康。行人身未动，病者主无妨。将军回田野，仔细更推详。' },
  { name: '留连', wuxing: '水', dir: '北方', num: 2, color: '#0A84FF',
    short: '事有反复，宜缓图',
    brief: '事多拖延，反复难决。有变数在暗处，急则更滞，宜缓图。',
    ju: '留连事难成，求谋日未明。官事凡不宜，去者未回程。失物南方见，急讨方称心。更须防口舌，人事且和平。' },
  { name: '速喜', wuxing: '火', dir: '南方', num: 3, color: '#FF9F0A',
    short: '喜讯将至，快办快成',
    brief: '喜讯将至，立见分晓。时机正在手上，快办快成，迟则失机。',
    ju: '速喜喜来临，求财向南行。失物申未午，逢人路上寻。官事有福德，病者无祸侵。田宅六畜好，出行有吉音。' },
  { name: '赤口', wuxing: '金', dir: '西方', num: 4, color: '#FF3B30',
    short: '口舌是非，谨言慎行',
    brief: '口舌是非，争执官非。言多必失，遇冲突冷处理，勿签勿诺。',
    ju: '赤口主口舌，官非切宜防。失物速速讨，行人有惊慌。六畜多作怪，病者出西方。更须防咒怨，恐染祸灾殃。' },
  { name: '小吉', wuxing: '木', dir: '东方', num: 5, color: '#30D158',
    short: '和合顺遂，贵人相助',
    brief: '和合顺意，贵人相助。小事必成，人缘财路俱佳，宜结不宜断。',
    ju: '小吉最吉昌，路上好商量。阴人来报喜，失物在坤方。行人即便至，交关甚是强。凡事皆和合，病者叩穹苍。' },
  { name: '空亡', wuxing: '土', dir: '中央', num: 6, color: '#98989D',
    short: '落空无果，静待时机',
    brief: '音信落空，谋事难成。用力皆虚耗，宜静待时机，不可妄动。',
    ju: '空亡事不祥，阴人多乖张。求财无利益，行人有灾殃。失物寻不见，官事有刑伤。病人逢邪祟，斟酌更周详。' },
];

const MONTH_NAMES = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const DAY_NAMES = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十',
  '十一','十二','十三','十四','十五','十六','十七','十八','十九','二十',
  '廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
const ZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const SHICHEN_RANGE = ['23-01','01-03','03-05','05-07','07-09','09-11','11-13','13-15','15-17','17-19','19-21','21-23'];

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

// ---------- 起课 ----------
function cast(date, ziRollover) {
  const ziHour = date.getHours() >= 23 || date.getHours() < 1;
  // 子时换日：23:00 之后日宫按次日数
  const dayDate = (ziRollover && ziHour) ? new Date(date.getTime() + 3600000) : date;
  const lunar = solarToLunar(dayDate.getFullYear(), dayDate.getMonth() + 1, dayDate.getDate());
  const zhi = Math.floor(((date.getHours() + 1) % 24) / 2);

  const monthIdx = (lunar.month - 1) % 6;              // 正月起大安
  const dayIdx = (monthIdx + lunar.day - 1) % 6;       // 月宫起初一
  const hourIdx = (dayIdx + zhi) % 6;                  // 日宫起子时
  return { lunar, zhi, monthIdx, dayIdx, hourIdx };
}

// 下一个时辰交界（奇数点：1,3,5…23），用于 refreshAfter 提示系统刷新
function nextShichenTime(now) {
  const next = new Date(now.getTime());
  next.setSeconds(0, 0);
  next.setMinutes(0);
  const h = now.getHours();
  const boundary = h % 2 === 1 ? h : h + 1;   // 落到最近的奇数点
  next.setHours(boundary);
  if (next <= now) next.setHours(boundary + 2); // 已过整点则取下一个时辰
  return next;
}

const chip = (label, p) => ({
  type: 'stack', direction: 'column', alignItems: 'center', gap: 0, flex: 1,
  children: [
    { type: 'text', text: label, font: { size: 'caption2' }, textColor: '#7A7A8C' },
    { type: 'text', text: p.name, font: { size: 'subheadline', weight: 'bold' }, textColor: p.color, maxLines: 1 },
  ],
});

export default async function (ctx) {
  const env = ctx.env || {};
  const ziRollover = env.ZI_ROLLOVER === '1' || env.ZI_ROLLOVER === 'true';
  const showMeaning = env.SHOW_MEANING !== '0';

  const now = new Date();
  const { lunar, zhi, monthIdx, dayIdx, hourIdx } = cast(now, ziRollover);
  const month = PALACES[monthIdx], day = PALACES[dayIdx], hour = PALACES[hourIdx];

  const pad = (n) => String(n).padStart(2, '0');
  const clock = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const lunarStr = `农历${lunar.isLeap ? '闰' : ''}${MONTH_NAMES[lunar.month - 1]}月${DAY_NAMES[lunar.day - 1]}`;
  const scStr = `${ZHI[zhi]}时 ${SHICHEN_RANGE[zhi]}`;
  const refreshAfter = nextShichenTime(now).toISOString();

  // 锁屏内联：一行
  if (ctx.widgetFamily === 'accessoryInline') {
    return {
      type: 'widget',
      refreshAfter,
      children: [{
        type: 'text', text: `小六壬 ${hour.name}·${ZHI[zhi]}时`,
        font: { size: 'caption1', weight: 'semibold' }, textColor: hour.color, maxLines: 1,
      }],
    };
  }
  // 锁屏圆形：只有宫名
  if (ctx.widgetFamily === 'accessoryCircular') {
    return {
      type: 'widget', refreshAfter, padding: 2,
      children: [
        { type: 'text', text: hour.name, font: { size: 'headline', weight: 'heavy' }, textColor: hour.color, textAlign: 'center', maxLines: 1, minScale: 0.6 },
        { type: 'text', text: `${ZHI[zhi]}时`, font: { size: 'caption2' }, textColor: '#8E8E93', textAlign: 'center' },
      ],
    };
  }
  // 锁屏矩形：紧凑两行
  if (ctx.widgetFamily === 'accessoryRectangular') {
    return {
      type: 'widget', refreshAfter, gap: 2,
      children: [
        { type: 'stack', direction: 'row', alignItems: 'center', gap: 6, children: [
          { type: 'text', text: `小六壬 ${hour.name}`, font: { size: 'headline', weight: 'bold' }, textColor: hour.color },
          { type: 'spacer' },
          { type: 'text', text: `${ZHI[zhi]}时`, font: { size: 'caption1' }, textColor: '#8E8E93' },
        ]},
        { type: 'text', text: hour.brief, font: { size: 'caption2' }, textColor: '#AAAAAA', maxLines: 2 },
      ],
    };
  }

  // 主屏幕小/中/大
  const isSmall = ctx.widgetFamily === 'systemSmall';
  const children = [
    { type: 'stack', direction: 'row', alignItems: 'center', gap: 5, children: [
      { type: 'image', src: 'sf-symbol:moon.stars.fill', color: '#FFD60A', width: 14, height: 14 },
      { type: 'text', text: '小六壬', font: { size: 'subheadline', weight: 'bold' }, textColor: '#FFFFFF' },
      { type: 'spacer' },
      { type: 'text', text: clock, font: { size: 'caption2' }, textColor: '#7A7A8C' },
    ]},
    { type: 'text', text: isSmall ? `${lunarStr} ${ZHI[zhi]}时` : `${lunarStr} · ${scStr}`, font: { size: 'caption2' }, textColor: '#7A7A8C', maxLines: 1, minScale: 0.7 },
    { type: 'spacer', length: 2 },
    { type: 'stack', direction: 'row', alignItems: 'center', gap: 4, children: [
      chip('月', month), chip('日', day), chip('时', hour),
    ]},
    { type: 'spacer', length: 2 },
    { type: 'text', text: `${hour.name} · ${hour.wuxing} · ${hour.dir}`, font: { size: isSmall ? 'headline' : 'title3', weight: 'heavy' }, textColor: hour.color, maxLines: 1, minScale: 0.7 },
    { type: 'text', text: isSmall ? hour.short : hour.brief, font: { size: isSmall ? 'footnote' : 'caption1' }, textColor: '#D0D0D8', maxLines: 2, minScale: 0.75 },
  ];
  if (showMeaning && ctx.widgetFamily === 'systemLarge') {
    children.push(
      { type: 'spacer', length: 4 },
      { type: 'text', text: hour.ju, font: { size: 'caption2' }, textColor: '#8E8E93', maxLines: 5, minScale: 0.8 },
    );
  }

  return {
    type: 'widget',
    refreshAfter,
    padding: 14,
    gap: 5,
    backgroundGradient: {
      type: 'linear',
      colors: ['#12121C', '#1B1B2E', hour.color + '22'],
      stops: [0, 0.6, 1],
      startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 },
    },
    children,
  };
}
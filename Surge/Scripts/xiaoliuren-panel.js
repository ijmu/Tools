/**
 * 小六壬 · 马前课 —— Surge 信息面板版
 * ==========================================================================
 * 来源：同仓库 Egern 版 Egern/Scripts/xiaoliuren.js（核心起课算法逐字节复用）。
 *
 * ★ 为什么不是「小组件」★
 *   Surge iOS 的脚本类型只有七种：http-request / http-response / rule / dns /
 *   event / cron / generic —— 没有任何 widget 类型，官方手册全量索引里 "widget"
 *   仅出现在「用系统小组件快速切换策略组」。Surge 的小组件是内置的策略组小组件，
 *   不接受自定义脚本渲染。因此 Egern/Loon 那套 type:'widget' + widgetFamily 的
 *   DSL 在 Surge 上不存在等价物。
 *   最接近的载体是「信息面板（[Panel]）」：iOS 在「策略选择」界面显示，Mac 在菜单栏
 *   Panels 子菜单显示，由 generic 脚本产出纯文本内容。
 *
 * 刷新语义：
 *   面板内容由 Surge 缓存，只在「到点 + 用户打开策略选择界面」时才重跑脚本。
 *   所以起课时间是「你打开面板的那一刻」，与 Egern 版「刷新那一刻起课」同义。
 *
 * env（不写在脚本里，写在 [Script] 行的 argument= 参数上）：
 *   argument="zi=1,ju=1"
 *     zi=0  关闭子时换日（默认开，23:00 后日宫按次日数）
 *     ju=0  大尺寸/面板不显示六神断句全诗（默认显示）
 *
 * 部署（把下面三行加进你的 Surge 配置）：
 *   [Script]
 *   xiaoliuren-panel = type=generic, script-path=https://raw.githubusercontent.com/ijmu/Tools/main/Surge/Scripts/xiaoliuren-panel.js, script-update-interval=86400, timeout=10
 *   [Panel]
 *   XiaoLiuRen = title="小六壬", content="打开策略视图即起课", style=info, script-name=xiaoliuren-panel, update-interval=60
 *
 * ★ 已知问题修复（相对 Egern 版）★
 *   原版 solarToLunar() 在「有闰月的年份」之后算错：闰月被消费后 isLeap 没有复位，
 *   后续每个月的天数一律按闰月天数（29 或 30）计，误差逐步累积。实测：
 *     2023-06-22（端午，应为五月初五）→ 原版算成 闰六月初六
 *     2025-10-06（中秋，应为八月十五）→ 原版算成 闰九月十六
 *     2028 / 2031 / 2033 … 凡有闰月之年皆错，且当年闰月之后一直错到年底（含换算到次年春节前）
 *   本版已修正为「正常月 → 该月闰月副本」两趟推进，逐日全量比对通过（见 README）。
 *   同日已把同一处修复同步到 Egern 版 Egern/Scripts/xiaoliuren.js，两边内核现已一致。
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

/* ============================ Surge 面板外壳 ============================ */

function parseArg(raw) {
  const out = {};
  if (!raw) return out;
  String(raw).split(/[&,;\n]/).forEach(function (kv) {
    const s = String(kv).trim();
    if (!s) return;
    const eq = s.indexOf('=');
    if (eq <= 0) out[s] = '1';
    else out[s.slice(0, eq).trim()] = s.slice(eq + 1).trim();
  });
  return out;
}

const _ARG = (typeof $argument !== 'undefined' && $argument) ? parseArg($argument) : {};
const _off = (v) => ['0', 'false', 'no', 'off'].indexOf(String(v).toLowerCase()) >= 0;
const ZI_ROLLOVER = _ARG.zi === undefined ? true : !_off(_ARG.zi);
const SHOW_MEANING = _ARG.ju === undefined ? true : !_off(_ARG.ju);
const pad2 = (n) => String(n).padStart(2, '0');

/** 吉凶 → 面板色：good 绿 / info 蓝 / alert 黄 / error 红 */
const PALACE_STYLE = { '大安': 'good', '速喜': 'good', '小吉': 'good', '留连': 'info', '赤口': 'alert', '空亡': 'error' };

function buildPanel(now) {
  const r = cast(now, ZI_ROLLOVER);
  const lunar = r.lunar, zhi = r.zhi;
  const month = PALACES[r.monthIdx], day = PALACES[r.dayIdx], hour = PALACES[r.hourIdx];
  const clock = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
  const lunarStr = '农历' + (lunar.isLeap ? '闰' : '') + MONTH_NAMES[lunar.month - 1] + '月' + DAY_NAMES[lunar.day - 1];
  const nxt = nextShichenTime(now);
  const HR = '────────────';

  const lines = [
    '落宫 ' + hour.name + '（' + hour.wuxing + ' · ' + hour.dir + ' · 第' + hour.num + '宫）',
    '月宫 ' + month.name + ' › 日宫 ' + day.name + ' › 时宫 ' + hour.name,
    lunarStr + ' · ' + clock + ' · ' + ZHI[zhi] + '时',
    HR,
    hour.brief,
  ];
  if (SHOW_MEANING) lines.push(hour.ju);
  lines.push(HR);
  lines.push('位置 ' + POSITION_HINT[r.hourIdx] + ' · ' + hour.short);
  lines.push('下次换宫 ' + pad2(nxt.getHours()) + ':' + pad2(nxt.getMinutes()));

  return {
    title: '小六壬 · ' + hour.name,
    content: lines.join('\n'),
    style: PALACE_STYLE[hour.name] || 'info',
  };
}

(function () {
  let out;
  try {
    out = buildPanel(new Date());
  } catch (e) {
    out = { title: '小六壬', content: '起课失败：' + (e && e.message ? e.message : String(e)), style: 'error' };
  }
  $done(out);
})();

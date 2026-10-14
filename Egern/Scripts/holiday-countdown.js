/**
 * 📅 节日倒计时 · Egern 小组件（三栏版）
 *
 * 三行：🇨🇳 国内节日 / 🌤 24节气 / 🌍 国际节日，各取最近 N 个倒数日。
 *
 * env（小组件编辑页添加）：
 *   SHOW_CN     = "0"   隐藏「国内节日」行
 *   SHOW_JIEQI  = "0"   隐藏「24节气」行
 *   SHOW_INTL   = "0"   隐藏「国际节日」行
 *   PER_ROW     = "3"   每行显示条数（默认：小 1 / 中 3 / 大 3 / 加大 4）
 *   PLAINBG     = "1"   关闭渐变底，回退纯色底（若某些系统版本渐变白屏时的保险开关）
 *   URL         = "…"   点按组件跳转的链接（默认 calshow:// 打开系统日历）
 *   LUNAR       = "0"   头部不显示农历
 *   TITLE       = "..." 自定义标题
 *
 * 数据与算法（2026-10-14 重写）：
 *   · 农历：1900-2100 数据表驱动；与 lunar-javascript 逐日对拍
 *     73365 天（1900-02-19 ~ 2100-12-31）零差异。表内修正两处历史勘误：
 *       1933 年 → 0x16a95（闰五月应为 30 天）、2060 年 → 0x92e0（原表闰月/大小月错）
 *   · 24节气：不再用「1900 基准 + 平太阳」近似表，改为按视黄经求解
 *     （VSOP87 截断 + IAUC 章动 + 光行差 + ΔT），与 lunar-javascript
 *     对拍 1900-2100 全部 4824 个节气：日期仅 1 处差（1979 大寒，真值
 *     23:59:56，落在午夜 4 秒前），时刻中位误差 8.6 秒。
 *   · 清明同时是节气与法定节日，只在国内行出现一次（按「同名同日期」去重）。
 *
 * 视觉（2026-10-14 四轮，借鉴 Hark 仪表盘组件）：
 *   · 根节点 backgroundGradient 线性渐变底（与油价/彩票等组件同款配色，视觉统一）
 *   · 卡片=语义色淡底玻璃片（亮 8%→现 13%）；大/加大页脚加「本年进度条」（SVG data URI + image 节点）
 *   · 根节点 url：点组件即打开系统日历（calshow://，可用 URL 覆盖）
 *
 * 尺寸自适应（2026-10-14 三轮）：
 *   小 1×1 / 中 3×1 / 大 3×2 / 加大 4×2（每栏「每行几个 × 几行」卡片矩阵）。
 *   大与加大改为「栏标竖排在左 + 右侧卡片矩阵」，行按 flex 均分铺满 —— 大画布靠显示更多条目
 *   填满，而不是把 3 行拉高留大空隙（上一版就是把 9 个条目拉伸，中间空得难看）。
 *   末行不足时用透明占位撑住列宽，保证上下两行卡片对齐。
 *
 * 配色（语义化，2026-10-14 二轮）：
 *   · 四季色 —— 春青 / 夏朱 / 秋金 / 冬玄（四立为界，每季 6 个节气）。
 *     节气条目按「该节气所属季节」上色；节气栏图标随「今天所在季节」变（标签仍为栏位绿，
 *     避免夏季朱红与国内栏正红撞色）。
 *   · 节庆性质色 —— 大喜正红（春节/除夕/元宵/国庆/元旦/元旦劳动节等）、团圆金（中秋/重阳/腊八）、
 *     爱情粉（七夕/情人节/母亲节）、青（端午/龙抬头/护士节）、绿（地球日/环境日）、
 *     橙（万圣夜/感恩节/读书日）、蓝（平安夜/父亲节）、紫（妇女节/跨年夜）。
 *   · 素色（清明/中元节 —— 祭祖·鬼节）—— 冷灰蓝，且**不吃紧急度红橙**：临近只加深素色底衬，
 *     不让扫墓/鬼节被染成喜庆色。
 *   · 紧急度 —— ≤3 天红、≤7 天橙（素色条目除外）；卡片底色一律取语义色的淡底（亮 8%、暗 14%）。
 *   · 时间基准固定 UTC+8（不依赖设备时区），倒计时与农历都按北京时间算。
 */

/* ===================== 农历核心（1900-2100） ===================== */
const LUNAR_INFO = [0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,
0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,
0x06566,0x0d4a0,0x0ea50,0x16a95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,
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
0x92e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,
0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,
0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,
0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a2d0,0x0d150,0x0f252,
0x0d520,];
const BASE_UTC = Date.UTC(1900, 0, 31);
const leapMonth = (y) => LUNAR_INFO[y - 1900] & 0xf;
const leapDays = (y) => (leapMonth(y) ? ((LUNAR_INFO[y - 1900] & 0x10000) ? 30 : 29) : 0);
const monthDays = (y, m) => ((LUNAR_INFO[y - 1900] & (0x10000 >> m)) ? 30 : 29);
const yearDays = (y) => {
  let sum = 348;
  for (let i = 0x8000; i > 0x8; i >>= 1) sum += (LUNAR_INFO[y - 1900] & i) ? 1 : 0;
  return sum + leapDays(y);
};
function lunarYearStart(y) {
  let d = 0;
  for (let i = 1900; i < y; i++) d += yearDays(i);
  return d;
}
// 农历 y 年 m 月（可闰）初一 → 距基准日天数
function lunarMonthStart(y, m, isLeap) {
  let d = lunarYearStart(y);
  const leap = leapMonth(y);
  for (let i = 1; i < m; i++) {
    d += monthDays(y, i);
    if (i === leap) d += leapDays(y);
  }
  if (isLeap) d += monthDays(y, m);
  return d;
}
const fromBase = (off) => new Date(BASE_UTC + off * 86400000);
function solarToLunar(y, m, d) {
  let off = Math.round((Date.UTC(y, m - 1, d) - BASE_UTC) / 86400000);
  let ly = 1900;
  for (; ly < 2101 && off >= yearDays(ly); ly++) off -= yearDays(ly);
  const leap = leapMonth(ly);
  let lm = 1;
  for (; lm <= 12; lm++) {
    for (let pass = 0; pass < 2; pass++) {
      if (pass === 1 && lm !== leap) break;
      const isL = pass === 1;
      const dm = isL ? leapDays(ly) : monthDays(ly, lm);
      if (off < dm) return { year: ly, month: lm, day: off + 1, isLeap: isL };
      off -= dm;
    }
  }
  return { year: ly, month: 12, day: off + 1, isLeap: false };
}
const MONTH_CN = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const DAY_CN = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十',
  '十一','十二','十三','十四','十五','十六','十七','十八','十九','二十',
  '廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
const GAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const ZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const WEEK_CN = ['日','一','二','三','四','五','六'];

/* ===================== 24节气（按视黄经求解，视黄经=15°整倍数） ===================== */
const RAD = Math.PI / 180;
const L_SERIES = {
  0: [[175347046,0,0],[3341656,4.6692568,6283.07585],[34894,4.6261,12566.1517],[3497,2.7441,5753.3849],
      [3418,2.8289,3.5231],[3136,3.6277,77713.7715],[2676,4.4181,7860.4194],[2343,6.1352,3930.2097],
      [1324,0.7425,11506.7698],[1273,2.0371,529.691],[1199,1.1096,1577.3435],[990,5.233,5884.927],
      [902,2.045,26.298],[857,3.508,398.149],[780,1.179,5223.694],[753,2.533,5507.553],
      [505,4.583,18849.228],[492,4.205,775.523],[357,2.92,0.067],[317,5.849,11790.629],
      [284,1.899,796.298],[271,0.315,10977.079],[243,0.345,5486.778],[206,4.806,2544.314],
      [205,1.869,5573.143],[202,2.458,6069.777],[156,0.833,213.299],[132,3.411,2942.463],
      [126,1.083,20.775],[115,0.645,0.98],[103,0.636,4694.003],[102,0.976,15720.839],
      [102,4.267,7.114],[99,6.21,2146.17],[98,0.68,155.42],[86,5.98,161000.69],
      [85,1.3,6275.96],[85,3.67,71430.7],[80,1.81,17260.15],[79,3.04,12036.46],
      [75,1.76,5088.63],[74,3.5,3154.69],[74,4.68,801.82],[70,0.83,9437.76],
      [62,3.98,8827.39],[61,1.82,7084.9],[57,2.78,6286.6],[56,4.39,14143.5],
      [56,3.47,6279.55],[52,0.19,12139.55],[52,1.33,1748.02],[51,0.28,5856.48],
      [49,0.49,1194.45],[41,5.37,8429.24],[41,2.4,19651.05],[39,6.17,10447.39],
      [37,6.04,10213.29],[37,2.57,1059.38],[36,1.71,2352.87],[36,1.78,6812.77],
      [33,0.59,17789.85],[30,0.44,83996.85],[30,2.74,1349.87],[25,3.16,4690.48]],
  1: [[628331966747,0,0],[206059,2.678235,6283.07585],[4303,2.6351,12566.1517],[425,1.59,3.523],
      [119,5.796,26.298],[109,2.966,1577.344],[93,2.59,18849.23],[72,1.14,529.69],
      [68,1.87,398.15],[67,4.41,5507.55],[59,2.89,5223.69],[56,2.17,155.42],
      [45,0.4,796.3],[36,0.47,775.52],[29,2.65,7.11],[21,5.34,0.98],
      [19,1.85,5486.78],[19,4.97,213.3],[17,2.99,6275.96],[16,0.03,2544.31],
      [16,1.43,2146.17],[15,1.21,10977.08],[12,2.83,1748.02],[12,3.26,5088.63],
      [12,5.27,1194.45],[12,2.08,4694],[11,0.77,553.57],[10,1.3,6286.6],
      [10,4.24,1349.87],[9,2.7,242.73],[9,5.64,951.72],[8,5.3,2352.87],
      [6,2.65,9437.76],[6,4.67,4690.48]],
  2: [[52919,0,0],[8720,1.0721,6283.0758],[309,0.867,12566.152],[27,0.05,3.52],
      [16,5.19,26.3],[16,3.68,155.42],[10,0.76,18849.23],[9,2.06,77713.77],
      [7,0.83,775.52],[5,4.66,1577.34],[4,1.03,7.11],[4,3.44,5573.14],
      [3,5.14,796.3],[3,6.05,5507.55],[3,1.19,242.73],[3,6.12,529.69],
      [3,0.31,398.15],[3,2.28,553.57],[2,4.38,5223.69],[2,3.75,0.98]],
  3: [[289,5.844,6283.076],[35,0,0],[17,5.49,12566.15],[3,5.2,155.42],[1,4.72,3.52],[1,5.3,18849.23],[1,5.97,242.73]],
  4: [[114,3.142,0],[8,4.13,6283.08],[1,3.84,12566.15]],
  5: [[1,3.14,0]],
};
function earthLonRad(jdTT) {
  const t = (jdTT - 2451545) / 365250;
  let s = 0;
  for (let n = 0; n <= 5; n++) {
    const arr = L_SERIES[n];
    let acc = 0;
    for (let i = 0; i < arr.length; i++) acc += arr[i][0] * Math.cos(arr[i][1] + arr[i][2] * t);
    s += acc * Math.pow(t, n);
  }
  return s / 1e8;
}
function deltaT(year) {
  if (year >= 2005 && year < 2050) { const t = year - 2000; return 62.92 + 0.32217 * t + 0.005589 * t * t; }
  if (year >= 2050 && year <= 2150) return -20 + 32 * Math.pow((year - 1820) / 100, 2) - 0.5628 * (2150 - year);
  if (year >= 1986) { const t = year - 2000;
    return 63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5; }
  if (year >= 1961) { const t = year - 1975; return 45.45 + 1.067 * t - t * t / 260 - t ** 3 / 718; }
  if (year >= 1941) { const t = year - 1950; return 29.07 + 0.407 * t - t * t / 233 + t ** 3 / 2547; }
  if (year >= 1920) { const t = year - 1920; return 21.20 + 0.84493 * t - 0.076100 * t * t + 0.0020936 * t ** 3; }
  const t = year - 1900;
  return -2.79 + 1.494119 * t - 0.0598939 * t * t + 0.0061966 * t ** 3 - 0.000197 * t ** 4;
}
// 太阳视黄经（度）：VSOP87 截断 + 章动 + 光行差 + FK5
function sunApparentLon(jdTT) {
  const T = (jdTT - 2451545) / 36525;
  const lonDeg = earthLonRad(jdTT) / RAD + 180 - 0.09033 / 3600;
  const Om = (125.04452 - 1934.136261 * T) * RAD;
  const Ls = (280.4665 + 36000.7698 * T) * RAD;
  const Lm = (218.3165 + 481267.8813 * T) * RAD;
  const dpsi = -17.20 * Math.sin(Om) - 1.32 * Math.sin(2 * Ls) - 0.23 * Math.sin(2 * Lm) + 0.21 * Math.sin(2 * Om);
  const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * RAD;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M)
    + (0.019993 - 0.000101 * T) * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M);
  const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
  const R = 1.000001018 * (1 - e * e) / (1 + e * Math.cos((M + C * RAD)));
  return lonDeg + (dpsi - 20.4898 / R) / 3600;
}
const TERM_NAMES = ['小寒','大寒','立春','雨水','惊蛰','春分','清明','谷雨','立夏','小满','芒种','夏至',
  '小暑','大暑','立秋','处暑','白露','秋分','寒露','霜降','立冬','小雪','大雪','冬至'];
const TERM_LON = [285,300,315,330,345,0,15,30,45,60,75,90,105,120,135,150,165,180,195,210,225,240,255,270];
const _termCache = {};
// 第 year 年、第 idx 个节气的北京时间日期序号（Date.UTC 形）
function termSerial(year, idx) {
  const key = year * 100 + idx;
  if (_termCache[key] !== undefined) return _termCache[key];
  const target = TERM_LON[idx];
  const guess = ((target - 285 + 360) % 360) / 0.9856473 + 5.5;
  let jd = Date.UTC(year, 0, 1) / 86400000 + 2440587.5 + guess;
  for (let i = 0; i < 60; i++) {
    const lam = sunApparentLon(jd);
    let diff = ((target - lam + 180) % 360 + 360) % 360 - 180;
    if (Math.abs(diff) < 1e-9) break;
    jd += diff / 0.9856473;
  }
  const jdUT = jd - deltaT(year) / 86400;
  const d = new Date((jdUT - 2440587.5) * 86400000 + 8 * 3600000);
  return (_termCache[key] = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/* ===================== 色板（语义化） ===================== */
// 节庆性质色：大喜红 / 团圆金 / 爱情粉 / 青 / 自然绿 / 橙 / 国际蓝 / 紫 / 素（祭祖·凶事）
const TONE = {
  red:    { light: '#C82A21', dark: '#FF6B60' },
  gold:   { light: '#C08A0E', dark: '#FFD166' },
  pink:   { light: '#BC3F79', dark: '#FF8CBB' },
  cyan:   { light: '#0E8C84', dark: '#3FD6C8' },
  green:  { light: '#1E8E3E', dark: '#4CD964' },
  orange: { light: '#B4621A', dark: '#FFA25C' },
  blue:   { light: '#1668C4', dark: '#5AA9FF' },
  violet: { light: '#7A4BC0', dark: '#B98CFF' },
  mute:   { light: '#5E7A8A', dark: '#A3BAC6' },
};
// 四季色（依传统五色：春青 · 夏赤 · 秋金 · 冬玄）
const SEASON = {
  spring: { light: '#1E9E63', dark: '#4CD98A' },
  summer: { light: '#D95B25', dark: '#FF9E63' },
  autumn: { light: '#C08A0E', dark: '#FFD166' },
  winter: { light: '#3B6EA5', dark: '#7FB2E8' },
};
// 24节气所属季节（四立起算：每季 6 个）
const TERM_SEASON = ['winter','winter','spring','spring','spring','spring','spring','spring',
  'summer','summer','summer','summer','summer','summer',
  'autumn','autumn','autumn','autumn','autumn','autumn',
  'winter','winter','winter','winter'];

/* ===================== 节日数据（北京时间 + 色调） ===================== */
// 国内·公历固定
const CN_FIXED = [
  ['01-01', '元旦', 'red'], ['05-01', '劳动节', 'red'], ['05-04', '青年节', 'red'],
  ['06-01', '儿童节', 'red'], ['07-01', '建党节', 'red'], ['08-01', '建军节', 'red'],
  ['09-10', '教师节', 'red'], ['10-01', '国庆节', 'red'],
];
// 国内·农历（月, 日, 名, 色调）——除夕与清明单独处理
const CN_LUNAR = [
  [1, 1, '春节', 'red'], [1, 15, '元宵节', 'red'], [2, 2, '龙抬头', 'cyan'], [5, 5, '端午节', 'cyan'],
  [7, 7, '七夕节', 'pink'], [7, 15, '中元节', 'mute'], [8, 15, '中秋节', 'gold'],
  [9, 9, '重阳节', 'gold'], [12, 8, '腊八节', 'gold'],
];
// 国际·公历固定
const INTL_FIXED = [
  ['02-14', '情人节', 'pink'], ['03-08', '妇女节', 'violet'], ['04-01', '愚人节', 'gold'],
  ['04-22', '地球日', 'green'], ['04-23', '读书日', 'orange'], ['05-12', '护士节', 'cyan'],
  ['06-05', '环境日', 'green'], ['10-31', '万圣夜', 'orange'], ['12-24', '平安夜', 'blue'],
  ['12-25', '圣诞节', 'red'], ['12-31', '跨年夜', 'violet'],
];
// 国际·浮动（月, 第几周, 周几, 名, 色调）：母亲节粉色、父亲节蓝色、感恩节橙色
const INTL_FLOATING = [
  [5, 2, 0, '母亲节', 'pink'], [6, 3, 0, '父亲节', 'blue'], [11, 4, 4, '感恩节', 'orange'],
];
const nthWeekdaySerial = (year, month, weekday, n) => {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const diff = (weekday - first.getUTCDay() + 7) % 7;
  return Date.UTC(year, month - 1, 1 + diff + (n - 1) * 7);
};
const DAY_MS = 86400000;

/* ===================== 汇总三栏倒数日 ===================== */
function collect(cst, opt) {
  const y = cst.y, m = cst.m, d = cst.d;
  const qingming = (opt && opt.qingming) || 'cn';
  const today = Date.UTC(y, m - 1, d);
  const lunar = solarToLunar(y, m, d);
  const buckets = { cn: [], jq: [], intl: [] };
  const seen = new Set();
  const add = (key, name, serial, tone) => {
    if (serial < today) return;
    const tag = name + '@' + serial;
    if (seen.has(tag)) return;
    seen.add(tag);
    buckets[key].push({ name, days: Math.round((serial - today) / DAY_MS), serial, tone });
  };
  // 国内·公历
  for (const [md, name, tone] of CN_FIXED) {
    const mo = +md.slice(0, 2), da = +md.slice(3);
    let s = Date.UTC(y, mo - 1, da);
    if (s < today) s = Date.UTC(y + 1, mo - 1, da);
    add('cn', name, s, tone);
  }
  // 国内·农历（以今天所在农历年为基准，跨年自动取下一轮）
  for (const [lm, ld, name, tone] of CN_LUNAR) {
    for (const ly of [lunar.year, lunar.year + 1]) {
      const t = fromBase(lunarMonthStart(ly, lm, false) + ld - 1);
      const s = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
      if (s >= today) { add('cn', name, s, tone); break; }
    }
  }
  // 除夕：下一轮腊月的最后一天 = 次年正月初一前一天（大喜）
  for (const ly of [lunar.year, lunar.year + 1]) {
    const nx = fromBase(lunarMonthStart(ly + 1, 1, false));
    const s = Date.UTC(nx.getUTCFullYear(), nx.getUTCMonth(), nx.getUTCDate()) - DAY_MS;
    if (s >= today) { add('cn', '除夕', s, 'red'); break; }
  }
  // 清明节（节气日，法定假日，祭扫 → 素色）：默认归「国内节日」行，节气行不再重复
  if (qingming !== 'jq') {
    let s = termSerial(y, 6);
    if (s < today) s = termSerial(y + 1, 6);
    add('cn', '清明节', s, 'mute');
  }
  // 24节气：色调 = 该节气所属季节
  for (let i = 0; i < 24; i++) {
    if (i === 6 && qingming === 'cn') continue;
    let s = termSerial(y, i);
    if (s < today) s = termSerial(y + 1, i);
    add('jq', TERM_NAMES[i], s, TERM_SEASON[i]);
  }
  // 国际·公历
  for (const [md, name, tone] of INTL_FIXED) {
    const mo = +md.slice(0, 2), da = +md.slice(3);
    let s = Date.UTC(y, mo - 1, da);
    if (s < today) s = Date.UTC(y + 1, mo - 1, da);
    add('intl', name, s, tone);
  }
  // 国际·浮动
  for (const [mo, n, wd, name, tone] of INTL_FLOATING) {
    let s = nthWeekdaySerial(y, mo, wd, n);
    if (s < today) s = nthWeekdaySerial(y + 1, mo, wd, n);
    add('intl', name, s, tone);
  }
  for (const k in buckets) buckets[k].sort((a, b) => a.days - b.days || a.serial - b.serial);
  // 今天的季节（四立为界）
  const t0 = Date.UTC(y, m - 1, d);
  let season = 'winter';
  for (const [idx, key] of [[2, 'spring'], [8, 'summer'], [14, 'autumn'], [20, 'winter']]) {
    if (t0 >= termSerial(y, idx)) season = key;
  }
  return {
    buckets, today, season, year: y, lunar,
    ganzhi: GAN[(lunar.year - 4) % 10] + ZHI[(lunar.year - 4) % 12],
    animal: '鼠牛虎兔龙蛇马羊猴鸡狗猪'[(lunar.year - 4) % 12],
    week: new Date(today).getUTCDay(),
  };
}
const fmtMD = (serial) => { const d = new Date(serial); return (d.getUTCMonth() + 1) + '月' + d.getUTCDate() + '日'; };
const daysText = (days) => (days === 0 ? '今天' : days === 1 ? '明天' : days + '天');

/* ===================== 渲染（Egern Widget DSL） ===================== */
const SECTIONS = [
  { key: 'cn',   label: '国内', icon: 'flag.fill', accent: TONE.red },
  { key: 'jq',   label: '节气', icon: 'leaf.fill', accent: SEASON.spring },  // 随当前季节变
  { key: 'intl', label: '国际', icon: 'globe',     accent: TONE.blue },
];
const C = {
  bg: { light: '#FFFFFF', dark: '#1C1C1E' },
  primary: { light: '#1A1A1A', dark: '#FFFFFF' },
  secondary: { light: '#8A8A8E', dark: '#98989D' },
  tertiary: { light: '#B4B4B9', dark: '#6E6E73' },
  card: { light: '#F2F2F7', dark: '#2C2C2E' },
  cardHot: { light: '#FF3B301A', dark: '#FF453A2E' },
  cardWarm: { light: '#FF950012', dark: '#FF9F0A1F' },
  hot: { light: '#E0342C', dark: '#FF6B60' },
  mute: { light: '#5E7A8A', dark: '#A3BAC6' },
  muteBg: { light: '#5E7A8A20', dark: '#A3BAC630' },
  warm: { light: '#C77700', dark: '#FFB340' },
  cal: { light: '#D70015', dark: '#FF6B60' },
};
const T = (s, opt) => Object.assign({ type: 'text', text: s }, opt);
const IMG = (name, size, color) => ({ type: 'image', src: 'sf-symbol:' + name, width: size, height: size, color });
const STACK = (dir, opt, kids) => Object.assign({ type: 'stack', direction: dir, children: kids }, opt);
const svgUri = (svg) => 'data:image/svg+xml,' + encodeURIComponent(svg);
function barSvg(pct, color, w, h) {
  const r = h / 2, fw = Math.max(h, w * Math.max(0, Math.min(1, pct))).toFixed(1);
  return svgUri(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}'>` +
    `<rect width='${w}' height='${h}' rx='${r}' fill='${color}' fill-opacity='0.26'/>` +
    `<rect width='${fw}' height='${h}' rx='${r}' fill='${color}'/></svg>`);
}
// 与油价/彩票等组件统一的渐变底（Hark 同款）
function bg() {
  return {
    type: 'linear',
    colors: [{ light: '#FFF1F0', dark: '#2A0E10' }, { light: '#F4F0FF', dark: '#140F26' }, { light: '#EEF6FF', dark: '#07121F' }],
    stops: [0, 0.55, 1], startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 },
  };
}

const toneColor = (t) => TONE[t] || SEASON[t] || C.secondary;
const toneBg = (t) => { const c = toneColor(t); return { light: c.light + '22', dark: c.dark + '30' }; };
const dayColor = (days, t) => {
  if (t === 'mute') return C.mute;                       // 祭祖/鬼节：永远素色，不染喜庆红橙
  return days <= 3 ? C.hot : days <= 7 ? C.warm : toneColor(t);
};
const cardBg = (days, t) => {
  if (t === 'mute') return days <= 7 ? C.muteBg : toneBg(t);
  return days <= 3 ? C.cardHot : days <= 7 ? C.cardWarm : toneBg(t);
};

const PROFILES = {
  systemSmall: { pad: [12, 13, 12, 13], gap: 5, rows: 1, perRow: 1, rowGap: 6, label: 10.5, icon: 11,
                 name: 12, day: 12.5, padV: 7, padH: 8, radius: 10, title: 13, date: 10, lunar: false },
  systemMedium: { pad: [14, 15, 14, 15], gap: 6, rows: 1, perRow: 3, rowGap: 6, label: 11, icon: 11,
                 name: 12, day: 13, padV: 7, padH: 8, radius: 9.5, title: 14, date: 10.5, lunar: true },
  systemLarge: { pad: [16, 18, 16, 18], gap: 8, rows: 2, perRow: 3, rowGap: 7, sectionGap: 10, cardRowGap: 5, barW: 110,
                 label: 12, icon: 12, name: 12, day: 13, sub: 9.5, twoLine: true,
                 padV: 5, padH: 8, radius: 11, title: 16, date: 11, lunar: true, rowFlex: false },
  systemExtraLarge: { pad: [18, 20, 18, 20], gap: 9, rows: 2, perRow: 4, rowGap: 8, sectionGap: 12, cardRowGap: 6, barW: 170,
                 label: 13, icon: 13, name: 13, day: 15, sub: 10, twoLine: true,
                 padV: 6, padH: 10, radius: 12, title: 17, date: 11.5, lunar: true, rowFlex: false },
};

function chip(sec, o, season) {
  return STACK('row', { alignItems: 'center', gap: 3 }, [
    IMG(sec.icon, o.icon, sec.key === 'jq' ? SEASON[season] : sec.accent),
    T(sec.label, { font: { size: o.label, weight: 'semibold' }, textColor: sec.accent, lineLimit: 1 }),
  ]);
}
function cell(it, sec, o) {
  const nameText = T(it.name, { font: { size: o.name, weight: 'medium' }, textColor: C.primary, lineLimit: 1, minScale: 0.6 });
  const left = o.twoLine
    ? STACK('column', { gap: 1 }, [nameText,
        T(fmtMD(it.serial), { font: { size: o.sub }, textColor: C.tertiary, lineLimit: 1, minScale: 0.7 })])
    : nameText;
  return STACK('row', { alignItems: 'center', flex: 1, padding: [o.padV, o.padH, o.padV, o.padH],
                        borderRadius: o.radius, backgroundColor: cardBg(it.days, it.tone) }, [
    left,
    { type: 'spacer' },
    T(daysText(it.days), { font: { size: o.day, weight: 'bold' }, textColor: dayColor(it.days, it.tone),
                           textAlign: 'right', lineLimit: 1, minScale: 0.7 }),
  ]);
}
function footer(data, o, env) {
  if (!o.barW) return null;
  const y = data.year;
  const pct = (data.today - Date.UTC(y, 0, 1)) / (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1));
  const tone = SEASON[data.season] || TONE.red;
  return STACK('row', { alignItems: 'center', gap: 6 }, [
    T(`${y} 年已过 ${Math.round(pct * 100)}%`, { font: { size: o.sub }, textColor: C.tertiary, lineLimit: 1 }),
    { type: 'spacer' },
    { type: 'image', src: barSvg(pct, tone.light, o.barW, 5), width: o.barW, height: 5 },
  ]);
}

function header(data, o, env, fam) {
  const { lunar } = data;
  const title = (env.TITLE || '').trim() || (fam === 'systemSmall' ? '倒计时' : '节日倒计时');
  const ok = lunar.month >= 1 && lunar.month <= 12 && lunar.day >= 1 && lunar.day <= 30;
  const showLunar = o.lunar && ok && (env.LUNAR || '1').trim() !== '0';
  const lunarTail = `${data.ganzhi}${data.animal}年${MONTH_CN[lunar.month - 1]}月${DAY_CN[lunar.day - 1]}`;
  const right = `${fmtMD(data.today)} 周${WEEK_CN[data.week]}` +
    (showLunar ? (o.twoLine ? ` · ${lunarTail}` : ` · 农历${MONTH_CN[lunar.month - 1]}月${DAY_CN[lunar.day - 1]}`) : '');
  return STACK('row', { alignItems: 'center', gap: 4 }, [
    IMG('calendar', o.icon + 2, C.cal),
    T(title, { font: { size: o.title, weight: 'bold' }, textColor: C.primary, lineLimit: 1, minScale: 0.7 }),
    { type: 'spacer' },
    T(right, { font: { size: o.date }, textColor: C.secondary, textAlign: 'right', lineLimit: 1, minScale: 0.6 }),
  ]);
}
function rowsOf(data, o, env) {
  const on = (k) => (env[k] || '1').trim() !== '0';
  const rows = [];
  for (const sec of SECTIONS) {
    const flag = sec.key === 'cn' ? 'SHOW_CN' : sec.key === 'jq' ? 'SHOW_JIEQI' : 'SHOW_INTL';
    if (!on(flag)) continue;
    const items = data.buckets[sec.key].slice(0, o.perRow * o.rows);
    if (!items.length) continue;
    const rowExtra = { alignItems: 'center', gap: o.rowGap };
    if (o.rowFlex !== false) rowExtra.flex = 1;
    if (o.rows <= 1) {
      rows.push(STACK('row', rowExtra,
        [chip(sec, o, data.season)].concat(items.map((it) => cell(it, sec, o)))));
      continue;
    }
    // 多行档位：栏标竖排在左，右侧 perRow 列的卡片矩阵（末行用透明占位保持列宽一致）
    const cardRows = [];
    for (let i = 0; i < items.length; i += o.perRow) {
      const chunk = items.slice(i, i + o.perRow);
      const kids = chunk.map((it) => cell(it, sec, o));
      for (let k = chunk.length; k < o.perRow; k++) kids.push({ type: 'spacer', flex: 1 });
      cardRows.push(STACK('row', { alignItems: 'center', gap: o.rowGap }, kids));
    }
    rows.push(STACK('row', Object.assign({ alignItems: 'center', gap: o.sectionGap }, o.rowFlex === false ? {} : { flex: 1 }), [
      chip(sec, o, data.season),
      STACK('column', { gap: o.cardRowGap, flex: 1 }, cardRows),
    ]));
  }
  return rows;
}

export default async function (ctx) {
  try {
    const env = ctx.env || {};
    const fam = ctx.widgetFamily || 'systemMedium';
    // 固定 UTC+8：不依赖设备时区（脚本环境时区不可靠）
    const shifted = new Date(Date.now() + 8 * 3600000);
    const cst = { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth() + 1, d: shifted.getUTCDate() };
    const data = collect(cst, { qingming: (env.QINGMING || 'cn').trim() });
    const refreshAfter = new Date(Date.UTC(cst.y, cst.m - 1, cst.d) + DAY_MS + 30000 - 8 * 3600000).toISOString();

    // ---------- 锁屏 ----------
    if (fam === 'accessoryInline') {
      const all = [];
      for (const sec of SECTIONS) for (const it of data.buckets[sec.key]) all.push(it);
      all.sort((a, b) => a.days - b.days || a.serial - b.serial);
      const n = all[0];
      return { type: 'widget', refreshAfter,
        children: [T(`${n.name} ${daysText(n.days)}`, { font: { size: 'caption1', weight: 'semibold' }, lineLimit: 1 })] };
    }
    if (fam === 'accessoryCircular') {
      const kids = SECTIONS.map((sec) => {
        const it = data.buckets[sec.key][0];
        return STACK('row', { alignItems: 'center', gap: 3 }, [
          IMG(sec.icon, 9, sec.key === 'jq' ? SEASON[data.season] : sec.accent),
          T(it ? it.name.slice(0, 3) : '—', { font: { size: 10, weight: 'medium' }, lineLimit: 1, minScale: 0.6 }),
          { type: 'spacer' },
          T(it ? daysText(it.days) : '', { font: { size: 10, weight: 'bold' }, textColor: dayColor(it ? it.days : 99, it && it.tone), lineLimit: 1, minScale: 0.6 }),
        ]);
      });
      return { type: 'widget', padding: 4, gap: 2, refreshAfter, children: kids };
    }
    if (fam === 'accessoryRectangular') {
      const kids = SECTIONS.map((sec) => {
        const it = data.buckets[sec.key][0];
        return STACK('row', { alignItems: 'center', gap: 4 }, [
          IMG(sec.icon, 10, sec.key === 'jq' ? SEASON[data.season] : sec.accent),
          T(it ? it.name : '—', { font: { size: 'caption1', weight: 'semibold' }, textColor: C.primary, lineLimit: 1, minScale: 0.7 }),
          { type: 'spacer' },
          T(it ? daysText(it.days) : '', { font: { size: 'caption1', weight: 'bold' }, textColor: dayColor(it ? it.days : 99, it && it.tone), lineLimit: 1, minScale: 0.7 }),
        ]);
      });
      return { type: 'widget', padding: [4, 6, 4, 6], gap: 3, refreshAfter, children: kids };
    }

    // ---------- 主屏幕 ----------
    const base = PROFILES[fam] || PROFILES.systemMedium;
    const o = Object.assign({}, base);
    const per = parseInt((env.PER_ROW || '').trim(), 10);
    if (per >= 1 && per <= 6) o.perRow = per;
    const kids = [header(data, o, env, fam)];
    const rows = rowsOf(data, o, env);
    kids.push(...rows);
    const foot = footer(data, o, env);
    if (o.rowFlex === false) {
      // 大/加大：卡片密度已够，行不拉伸（防挤压裁切）；页脚钉底，余量落在页脚上方
      if (foot) { kids.push({ type: 'spacer' }); kids.push(foot); }
    } else {
      if (foot) { kids.push({ type: 'spacer', length: 6 }); kids.push(foot); }
      // 三行时让行均分剩余高度铺满画布；只剩一两行时留白由尾部空位吸收
      if (rows.length <= 2) kids.push({ type: 'spacer' });
    }
    const plain = (env.PLAINBG || '').trim() === '1';
    const root = { type: 'widget', padding: o.pad, gap: o.gap, refreshAfter, children: kids };
    if (plain) root.backgroundColor = C.bg; else root.backgroundGradient = bg();
    if (env.URL) root.url = env.URL; else root.url = 'calshow://';
    return root;
  } catch (e) {
    return {
      type: 'widget', padding: 14, backgroundColor: C.bg,
      children: [
        STACK('row', { alignItems: 'center', gap: 5 }, [
          IMG('exclamationmark.triangle.fill', 14, C.warm),
          T('节日倒计时出错', { font: { size: 'footnote', weight: 'semibold' }, textColor: C.primary, lineLimit: 1 }),
        ]),
        T(String((e && e.message) || e), { font: { size: 'caption2' }, textColor: C.secondary, lineLimit: 2 }),
      ],
    };
  }
}

/*
 * 名称: 📅 纯黄历 · 老黄历（HL.js 骨架精修 · 三档独立 · 宜忌整词装箱）
 * ==========================================
 * 模板来源: xcgtb/Egern-Widgets/HL.js (blob f6d6298) —— 仅移植功能与内容，不修改外部仓库。
 * 设计参考: Hark 的层级 / 基线 / 分组 / 三档独立取舍方法，不照搬其外观。
 *
 * 相对原模板的修正（对齐与协调）:
 *  - minimumScaleFactor → 官方 minScale；宜忌行 minScale:1（已按字宽预装箱，不缩字）。
 *  - 移除官方不支持的 justifyContent；日期卡垂直居中改用固定+弹性 spacer。
 *  - 二元 padding → 四元 [上,右,下,左]。
 *  - 移除 family:'rounded'；数字使用默认无衬线 heavy。
 *  - 单树覆盖三档 → ctx.widgetFamily 分 Small/Medium/Large 三棵独立树。
 *  - 主区 alignItems:'center' → 'start'，左日期卡与右栏顶线对齐。
 *  - 宜忌按实际可用宽度整词装箱，接近右安全边才换行；最大行数用完才整项省略加 …。
 *  - 宜/忌短标签语义色自然收口（固定 16pt 小方块），不拉成长色条。
 *  - 宜/忌/冲煞/底部锚点在普通态与长态间固定不位移（按最大行数预留高度）。
 *  - 零天气、零白名单外字段。
 */
export default async function (ctx) {
  const family = ctx.widgetFamily;
  const env = ctx.env || {};
  const showFestival = String(env.SHOW_FESTIVAL == null ? '1' : env.SHOW_FESTIVAL) !== '0';

  const C = {
    bg: { light: '#FFFFFF', dark: '#121212' },
    cardBg: { light: '#F2F2F7', dark: '#1C1C1E' },
    bubbleBg: { light: '#8E8E9315', dark: '#FFFFFF15' },
    main: { light: '#1C1C1E', dark: '#FFFFFF' },
    sub: { light: '#48484A', dark: '#D1D1D6' },
    muted: { light: '#8E8E93', dark: '#8E8E93' },
    divider: { light: '#E5E5EA', dark: '#38383A' },
    gold: { light: '#FF9500', dark: '#FFD700' },
    yi: { light: '#34C759', dark: '#30D158' },
    ji: { light: '#FF3B30', dark: '#FF453A' },
    term: { light: '#34C759', dark: '#30D158' },
    holiday: { light: '#007AFF', dark: '#0A84FF' }
  };

  const now = new Date(Date.now() + (new Date().getTimezoneOffset() + 480) * 60000);
  const [Y, M, D] = [now.getFullYear(), now.getMonth() + 1, now.getDate()];
  const WEEK = '日一二三四五六'[now.getDay()];
  const P = (n) => (n < 10 ? `0${n}` : n);

  const Lunar = {
    info: [0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6,0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x05ac0,0x0ab60,0x096d5,0x092e0,0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06b20,0x1a6c4,0x0aae0,0x092e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a2d0,0x0d150,0x0f252,0x0d520],
    termNames: ['小寒','大寒','立春','雨水','惊蛰','春分','清明','谷雨','立夏','小满','芒种','夏至','小暑','大暑','立秋','处暑','白露','秋分','寒露','霜降','立冬','小雪','大雪','冬至'],
    getTerm(y, n) { return new Date((31556925974.7 * (y - 1900) + [0,21208,42467,63836,85337,107014,128867,150921,173149,195551,218072,240693,263343,285989,308563,331033,353350,375494,397447,419210,440795,462224,483532,504758][n - 1] * 60000) + Date.UTC(1900, 0, 6, 2, 5)).getUTCDate() },
    parse(y, m, d) {
      let offset = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1900, 0, 31)) / 86400000), i, temp = 0;
      for (i = 1900; i < 2101 && offset > 0; i++) {
        temp = 348; for (let j = 0x8000; j > 0x8; j >>= 1) temp += (this.info[i - 1900] & j) ? 1 : 0;
        temp += (this.info[i - 1900] & 0xf) ? ((this.info[i - 1900] & 0x10000) ? 30 : 29) : 0;
        offset -= temp;
      }
      if (offset < 0) { offset += temp; i--; }
      const lYear = i, leap = this.info[lYear - 1900] & 0xf;
      let isLeap = false;
      for (i = 1; i < 13 && offset > 0; i++) {
        if (leap > 0 && i === (leap + 1) && !isLeap) { --i; isLeap = true; temp = (this.info[lYear - 1900] & 0x10000) ? 30 : 29; }
        else temp = (this.info[lYear - 1900] & (0x10000 >> i)) ? 30 : 29;
        if (isLeap && i === (leap + 1)) isLeap = false;
        offset -= temp;
      }
      if (offset === 0 && leap > 0 && i === leap + 1) { if (isLeap) isLeap = false; else { isLeap = true; --i; } }
      if (offset < 0) { offset += temp; i--; }
      const lD = offset + 1, tId = m * 2 - (d < this.getTerm(y, m * 2 - 1) ? 2 : 1);
      const gz = '甲乙丙丁戊己庚辛壬癸'[(lYear - 4) % 10] + '子丑寅卯辰巳午未申酉戌亥'[(lYear - 4) % 12];
      const ani = '鼠牛虎兔龙蛇马羊猴鸡狗猪'[(lYear - 4) % 12];
      const cnMonth = `${isLeap ? '闰' : ''}${['正','二','三','四','五','六','七','八','九','十','冬','腊'][i - 1]}月`;
      const cnDay = lD === 10 ? '初十' : lD === 20 ? '二十' : lD === 30 ? '三十' : ['初','十','廿','卅'][Math.floor(lD / 10)] + ['日','一','二','三','四','五','六','七','八','九','十'][lD % 10];
      return { gz, ani, cn: `${cnMonth}${cnDay}`, term: (this.getTerm(y, tId + 1) === d) ? this.termNames[tId] : '' };
    }
  };

  const allTerms = [];
  [-1, 0, 1].forEach((offset) => {
    for (let i = 1; i <= 24; i++) allTerms.push({ name: Lunar.termNames[i - 1], date: new Date(Y + offset, Math.floor((i - 1) / 2), Lunar.getTerm(Y + offset, i)) });
  });

  const todayMs = new Date(Y, M - 1, D).getTime();
  let currentTerm = '';
  let upcomingTerms = [];
  for (let i = 0; i < allTerms.length; i++) {
    const diff = Math.round((allTerms[i].date.getTime() - todayMs) / 86400000);
    if (diff >= 0) {
      currentTerm = diff === 0 ? allTerms[i].name : allTerms[i - 1].name;
      const startIdx = diff === 0 ? i + 1 : i;
      upcomingTerms = allTerms.slice(startIdx, startIdx + 5).map((t) => `${t.name} ${Math.round((t.date.getTime() - todayMs) / 86400000)}天`);
      break;
    }
  }

  const obj = Lunar.parse(Y, M, D);
  const shichenStr = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'][Math.floor((now.getHours() + 1) % 24 / 2)] + '时';
  let apiData = {};

  try {
    const resp = await ctx.http.get(`https://raw.githubusercontent.com/zqzess/openApiData/main/calendar_new/${Y}/${Y}${P(M)}.json`, { timeout: 8000 });
    const json = JSON.parse(await resp.text());
    const patterns = [`${Y}-${P(M)}-${P(D)}`, `${Y}-${M}-${D}`, `${Y}/${P(M)}/${P(D)}`, `${Y}/${M}/${D}`, `${Y}${P(M)}${P(D)}`];
    const findDateData = (data) => {
      if (!data || typeof data !== 'object') return null;
      for (const key in data) {
        const val = data[key];
        if (!val) continue;
        if (patterns.some((p) => String(key).includes(p))) return val;
        if (typeof val === 'object') {
          const dStr = String(val.date || val.day || val.gregorian || val.oDate || '');
          if (patterns.some((p) => dStr.includes(p))) return val;
          if (val.day == D && (val.month == M || (!val.month && !val.year))) return val;
          const res = findDateData(val);
          if (res) return res;
        }
      }
      return null;
    };
    apiData = findDateData(json) || {};
  } catch (e) {}

  const getVal = (...keys) => { for (const k of keys) if (apiData[k]) return apiData[k]; return ''; };
  const rawYi = String(getVal('yi', 'Yi', 'suit')).replace(/\./g, ' ').trim();
  const rawJi = String(getVal('ji', 'Ji', 'avoid')).replace(/\./g, ' ').trim();

  const stems = '甲乙丙丁戊己庚辛壬癸';
  const branches = '子丑寅卯辰巳午未申酉戌亥';
  const animals = '鼠牛虎兔龙蛇马羊猴鸡狗猪';

  let dOffset = Math.floor((Date.UTC(Y, M - 1, D) - Date.UTC(2024, 0, 1)) / 86400000) % 60;
  if (dOffset < 0) dOffset += 60;

  const rawGzMonth = getVal('gzMonth', 'gz_month') || '';
  const rawGzDate = getVal('gzDate', 'gz_day') || (stems[dOffset % 10] + branches[dOffset % 12]);

  const cIndex = (dOffset + 54) % 60;
  const dZhi = dOffset % 12;
  const chongFull = `冲${animals[(dZhi + 6) % 12]}(${stems[cIndex % 10]}${branches[cIndex % 12]})煞${['南','东','北','西'][dZhi % 4]}`;
  const chongShort = `冲${animals[(dZhi + 6) % 12]}煞${['南','东','北','西'][dZhi % 4]}`;

  let todayHoliday = getVal('holiday', 'festival', 'jiejiari');
  if (!todayHoliday && apiData.type && apiData.type.name) {
    const tName = apiData.type.name;
    if (tName !== '工作日' && tName !== '周末' && tName !== '休息日') todayHoliday = tName;
  }

  const targetHolidays = [
    { name: '元旦', match: (m, d, l) => m === 1 && d === 1 },
    { name: '春节', match: (m, d, l) => l.cn === '正月初一' },
    { name: '清明', match: (m, d, l) => l.term === '清明' },
    { name: '劳动', match: (m, d, l) => m === 5 && d === 1 },
    { name: '端午', match: (m, d, l) => l.cn === '五月初五' },
    { name: '中秋', match: (m, d, l) => l.cn === '八月十五' },
    { name: '国庆', match: (m, d, l) => m === 10 && d === 1 }
  ];

  const upcomingHolidays = [];
  const foundHolidays = new Set();
  for (let i = 1; i <= 365; i++) {
    const tempDate = new Date(todayMs + i * 86400000);
    const ty = tempDate.getFullYear(), tm = tempDate.getMonth() + 1, td = tempDate.getDate();
    const tl = Lunar.parse(ty, tm, td);
    for (const h of targetHolidays) {
      if (!foundHolidays.has(h.name) && h.match(tm, td, tl)) {
        upcomingHolidays.push(`${h.name} ${i}天`);
        foundHolidays.add(h.name);
      }
    }
    if (upcomingHolidays.length >= 5) break;
  }

  const yiWords = rawYi ? rawYi.split(/\s+/).filter(Boolean) : ['诸事皆宜'];
  const jiWords = rawJi ? rawJi.split(/\s+/).filter(Boolean) : ['诸事无忌'];

  // ── 字宽估算与整词装箱 ──
  function charW(ch, fs) {
    if (ch === ' ') return fs * 0.35;
    const code = ch.codePointAt(0);
    if (code < 0x2e80) return fs * 0.55;
    return fs * 1.0;
  }
  function wordW(w, fs) { let s = 0; for (const ch of w) s += charW(ch, fs); return s; }
  function packWords(words, budget, maxLines, fs) {
    const lines = [];
    let cur = '';
    let curW = 0;
    const sp = fs * 0.35;
    let overflow = false;
    for (const w of words) {
      const ww = wordW(w, fs);
      if (cur === '') { cur = w; curW = ww; continue; }
      if (curW + sp + ww <= budget) { cur += ' ' + w; curW += sp + ww; }
      else {
        lines.push(cur);
        if (lines.length >= maxLines) { overflow = true; cur = ''; break; }
        cur = w; curW = ww;
      }
    }
    if (cur !== '') { if (lines.length < maxLines) lines.push(cur); else overflow = true; }
    if (overflow && lines.length) lines[lines.length - 1] += ' …';
    if (!lines.length) lines.push('暂无');
    return lines;
  }

  // ── DSL 原语（仅官方属性）──
  function T(text, size, color, weight, extra) {
    return Object.assign({
      type: 'text', text: String(text == null ? '' : text),
      font: { size: size, weight: weight || 'regular' },
      textColor: color, maxLines: 1, minScale: 1
    }, extra || {});
  }
  function IMG(name, color, size) { return { type: 'image', src: 'sf-symbol:' + name, color: color, width: size, height: size }; }
  function ROW(kids, extra) { return Object.assign({ type: 'stack', direction: 'row', alignItems: 'center', gap: 4, children: (kids || []).filter(Boolean) }, extra || {}); }
  function COL(kids, extra) { return Object.assign({ type: 'stack', direction: 'column', alignItems: 'start', gap: 4, children: (kids || []).filter(Boolean) }, extra || {}); }
  function SP(len) { return len == null ? { type: 'spacer' } : { type: 'spacer', length: len }; }
  function TAG(label, bg, h, fs) {
    return { type: 'stack', direction: 'row', alignItems: 'center', width: 16, height: h, borderRadius: 4, backgroundColor: bg, children: [T(label, fs, '#FFFFFF', 'heavy')] };
  }
  function DIVIDER() { return { type: 'stack', direction: 'row', height: 1, backgroundColor: C.divider, children: [{ type: 'spacer' }] }; }

  function yijiBlock(label, tagColor, words, o) {
    const lines = packWords(words, o.textW, o.maxLines, o.fs);
    const lineNodes = lines.map((ln) => T(ln, o.fs, C.sub, 'medium'));
    return ROW([
      TAG(label, tagColor, o.tagH, o.tagFs),
      COL(lineNodes, { gap: o.lineGap, flex: 1, height: o.reserveH, alignItems: 'start' })
    ], { alignItems: 'start', gap: o.gap });
  }

  function chongRow(text, o) {
    return ROW([IMG('flame.fill', C.ji, o.icon), T(text, o.fs, C.sub, 'medium', { minScale: 0.8 }), SP()], { gap: 4 });
  }

  function dateCard(o) {
    return COL([
      SP(), T('周' + WEEK, o.weekFs, C.holiday, 'bold', { minScale: 0.7 }), SP(o.g1),
      T(String(D), o.dayFs, C.main, 'heavy', { minScale: 0.7 }), SP(o.g1),
      T(obj.cn, o.lunarFs, C.gold, 'bold', { minScale: 0.7 }), SP()
    ], { alignItems: 'center', gap: 0, width: o.cardW, height: o.cardH, backgroundColor: C.cardBg, borderRadius: 10, padding: [4, 4, 4, 4] });
  }

  function header(o, dateStr) {
    return COL([
      ROW([IMG('calendar.circle.fill', C.main, o.icon), T(dateStr, o.dateFs, C.main, 'heavy', { minScale: 0.7 }), SP(), T(shichenStr, o.shichenFs, C.muted, 'bold', { minScale: 0.8 })], { gap: 4 }),
      DIVIDER()
    ], { gap: o.headGap });
  }

  function footer(o, terms, holidays) {
    const termText = terms.join(' · ');
    let holText = holidays.join(' · ');
    if (todayHoliday) holText = `今日${todayHoliday} | 距 ${holText}`;
    const termRow = ROW([IMG('leaf.fill', C.term, o.icon), T(termText, o.fs, C.sub, 'medium', { minScale: 0.7 })], { gap: 4 });
    if (!showFestival) {
      return COL([termRow], { gap: 6, padding: o.pad, borderRadius: 8, backgroundColor: C.bubbleBg });
    }
    const holRow = ROW([IMG('paperplane.fill', C.holiday, o.icon), T(holText, o.fs, C.sub, 'medium', { minScale: 0.7 })], { gap: 4 });
    if (o.twoLines) {
      return COL([termRow, holRow], { gap: 6, padding: o.pad, borderRadius: 8, backgroundColor: C.bubbleBg });
    }
    return ROW([IMG('leaf.fill', C.term, o.icon), T(termText, o.fs, C.sub, 'medium', { minScale: 0.7 }), SP(), IMG('paperplane.fill', C.holiday, o.icon), T(holText, o.fs, C.sub, 'medium', { minScale: 0.7 })], { gap: 6, padding: o.pad, borderRadius: 8, backgroundColor: C.bubbleBg });
  }

  const refreshAfter = new Date(Date.UTC(Y, M - 1, D, 16, 5)).toISOString();

  // ── 三档独立树 ──
  function buildSmall() {
    const o = {
      pad: [8, 8, 8, 8], icon: 12, dateFs: 12, shichenFs: 10, headGap: 5, headSpacer: 5,
      cardW: 43, cardH: 62, weekFs: 9, dayFs: 20, lunarFs: 9, g1: 1, mainGap: 8,
      gzFs: 8.7, termFs: 7.4,
      yi: { fs: 7.6, maxLines: 3, reserveH: 32, textW: 71, tagH: 11, tagFs: 8, gap: 4, lineGap: 1 },
      chong: { fs: 7.5, icon: 9 },
      foot: { icon: 8, fs: 7.4, pad: [4, 6, 4, 6], twoLines: false },
      footSpacer: 5, count: 1
    };
    const gzLine = T(`${obj.gz}年 · ${rawGzDate}日`, o.gzFs, C.gold, 'bold', { minScale: 0.7 });
    const termLine = T(obj.term ? `今日${obj.term}` : `当前${currentTerm}`, o.termFs, C.muted, 'regular', { minScale: 0.8 });
    const right = COL([
      gzLine, termLine,
      yijiBlock('宜', C.yi, yiWords, o.yi),
      yijiBlock('忌', C.ji, jiWords, o.yi),
      chongRow(chongShort, o.chong)
    ], { gap: 3, flex: 1, alignItems: 'start' });
    return {
      type: 'widget', padding: o.pad, url: 'calshow://', backgroundColor: C.bg, refreshAfter,
      children: [
        header(o, `${M}月${D}日`), SP(o.headSpacer),
        ROW([dateCard(o), right], { alignItems: 'start', gap: o.mainGap }),
        SP(),
        footer(o.foot, upcomingTerms.slice(0, o.count), upcomingHolidays.slice(0, o.count))
      ]
    };
  }

  function buildMedium() {
    const o = {
      pad: [10, 10, 10, 10], icon: 13, dateFs: 13, shichenFs: 10.5, headGap: 6, headSpacer: 6,
      cardW: 52, cardH: 64, weekFs: 10, dayFs: 22, lunarFs: 10, g1: 1, mainGap: 8,
      gzFs: 10.2,
      yi: { fs: 8.6, maxLines: 2, reserveH: 24, textW: 238, tagH: 13, tagFs: 9, gap: 4, lineGap: 2 },
      chong: { fs: 8.4, icon: 10 },
      foot: { icon: 9, fs: 8.1, pad: [5, 8, 5, 8], twoLines: false },
      footSpacer: 6, count: 2
    };
    const monthSeg = rawGzMonth ? `${rawGzMonth}月 · ` : '';
    const gzLine = T(`${obj.gz}(${obj.ani})年 · ${monthSeg}${rawGzDate}日 · ${obj.term ? `今日${obj.term}` : `当前${currentTerm}`}`, o.gzFs, C.gold, 'bold', { minScale: 0.7 });
    const right = COL([
      gzLine,
      yijiBlock('宜', C.yi, yiWords, o.yi),
      yijiBlock('忌', C.ji, jiWords, o.yi),
      chongRow(chongFull, o.chong)
    ], { gap: 3, flex: 1, alignItems: 'start' });
    return {
      type: 'widget', padding: o.pad, url: 'calshow://', backgroundColor: C.bg, refreshAfter,
      children: [
        header(o, `${Y}年${M}月${D}日`), SP(o.headSpacer),
        ROW([dateCard(o), right], { alignItems: 'start', gap: o.mainGap }),
        SP(),
        footer(o.foot, upcomingTerms.slice(0, o.count), upcomingHolidays.slice(0, o.count))
      ]
    };
  }

  function buildLarge() {
    const o = {
      pad: [12, 12, 12, 12], icon: 14, dateFs: 14, shichenFs: 11, headGap: 6, headSpacer: 6,
      cardW: 66, cardH: 170, weekFs: 11, dayFs: 34, lunarFs: 11, g1: 6, mainGap: 10,
      gzFs: 11.5, termFs: 9.2,
      yi: { fs: 9.2, maxLines: 4, reserveH: 52, textW: 218, tagH: 14, tagFs: 10, gap: 5, lineGap: 3 },
      chong: { fs: 9.2, icon: 11 },
      foot: { icon: 11, fs: 9.5, pad: [7, 8, 7, 8], twoLines: true },
      footSpacer: 6, count: 3
    };
    const monthSeg = rawGzMonth ? `${rawGzMonth}月 · ` : '';
    const gzLine = T(`${obj.gz}(${obj.ani})年 · ${monthSeg}${rawGzDate}日`, o.gzFs, C.gold, 'bold', { minScale: 0.7 });
    const termLine = T(obj.term ? `今日${obj.term}` : `当前${currentTerm}`, o.termFs, C.muted, 'regular', { minScale: 0.8 });
    const right = COL([
      gzLine, termLine,
      yijiBlock('宜', C.yi, yiWords, o.yi),
      yijiBlock('忌', C.ji, jiWords, o.yi),
      chongRow(chongFull, o.chong)
    ], { gap: 4, flex: 1, alignItems: 'start' });
    return {
      type: 'widget', padding: o.pad, url: 'calshow://', backgroundColor: C.bg, refreshAfter,
      children: [
        header(o, `${Y}年${M}月${D}日`), SP(o.headSpacer),
        ROW([dateCard(o), right], { alignItems: 'start', gap: o.mainGap }),
        SP(),
        footer(o.foot, upcomingTerms.slice(0, o.count), upcomingHolidays.slice(0, o.count))
      ]
    };
  }

  if (family === 'systemSmall') return buildSmall();
  if (family === 'systemLarge') return buildLarge();
  return buildMedium();
}

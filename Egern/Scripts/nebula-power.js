/**
 * 星云AI 电力补贴 · Egern 小组件脚本（generic）
 * ==========================================================================
 * 数据源（公开接口，无需登录）：
 *   POST https://ai.ipix.ink/guest/models   body {"key":"public"}
 *   → { data:[24 个模型], groups:[8 个模型组], rmb_rate:0.01 }
 *   公开接口只校验 key 非空，因此任意字符串都能读到与网站「模型电耗」页
 *   完全一致的数据（含 discount_* 补贴字段、上下文、描述）。
 *
 * 补贴判定 —— 与 ai.ipix.ink 前端 /user/js/models.js 同口径（逐行对齐）：
 *   ① discount_price 非空才存在补贴；
 *   ② discount_start / discount_end 限定日期区间：
 *        10 位纯日期   → 当天 23:59:59 止
 *        16 位带时刻   → 精确到分钟
 *        带时刻但无时区 → 按北京时间（后端同款处理）
 *   ③ discount_daily_start ~ discount_daily_end 限定北京时间每日时段；
 *        区间跨零点（如 22:00 - 02:00）按环绕判定；
 *        只有一端有值 → 该段不生效（与前端一致）；
 *   ④ discount_used ≥ discount_quota → 当日额度已耗尽，前端不再显示「补贴中」，
 *        后端也不再打折。本脚本把它单列为「已耗尽」而不是「补贴中」。
 *
 * 计价口径：
 *   电价单位 = ⚡ / 100K tokens（1M = ×10）
 *   余额口径 = 电价 × rmb_rate（元/⚡，当前 0.01）→ 例：0.1⚡/100K = ¥0.001/100K = ¥0.01/M
 *
 * env（小组件编辑页 Env 区，全部可选）：
 *   NEBULA_COOKIE = "server_session_xxx=..."  → 追加显示你的余额 / 电力包剩余（私有）
 *                                                不填 = 只显示公开补贴（零凭证）
 *   NEBULA_TOP    = "6"                       → 大尺寸列出的补贴档数（默认 medium 4 / large 6）
 *   NEBULA_SORT   = "power" | "price"          → power=能力优先（默认，新/强在前，首行标「首推」）
 *                                                price=省钱优先（有效电价升序，v1 行为）
 *
 * 部署：
 *   1) 工具 → 脚本 → + ：名称 nebula-power，类型 generic，文件位置「本地」，文件名 nebula-power.js
 *   2) 编辑文件，粘贴本文件内容，保存
 *   3) 分析 → 左上角 → 小组件画廊 → +，名称任意，脚本选 nebula-power
 *   4) 主屏幕长按 → + → Egern → 选尺寸 → 长按小组件 → 编辑小组件 → 选该名称
 *
 * v2（2026-09-21）：HTTP 垫片对齐 Egern 实机 API —— ctx.http.get/post(url, {timeout})
 *   返回 Response，需 await res.text()（社区实机组件 xcgtb/Egern-Widgets 核实）；
 *   依次尝试 ctx.http(url,init) → ctx.http({url,...}) → $httpClient 回调 → fetch，
 *   全挂时把各通道死因显示在卡片上。
 * v5（2026-09-22）：刷新韧性——成功数据写入 $persistentStore，断网/超时自动回放缓存
 *   （头部标「缓存 HH:MM」）；记住可用通道走快路径（单通道 5s、总预算 9s）；
 *   整体 11s 看门狗，超时也交付可用卡片，小部件进程掐不死渲染。
 * v6（2026-09-22）：综合排行——综合分 = 能力档位 50% + 平台人气 30% + 补贴力度 20%。
 *   人气项：配 NEBULA_COOKIE 时取 /user/leaderboard 的平台模型榜(真实 tokens，对数刻度)；
 *   未配置时用公开的补贴池今日消耗(discount_used)作代理。NEBULA_SORT=smart(默认)/power/price。
 */

const MODELS_API = 'https://ai.ipix.ink/guest/models';
const USAGE_API = 'https://ai.ipix.ink/user/usage';
const LEADERBOARD_API = 'https://ai.ipix.ink/user/leaderboard';
const CNY_PER_POWER = 0.01; // 兜底单价；实际以接口 rmb_rate 为准

/* 能力档位（0-100）：越新越强越高。依据站点模型描述的参数量/定位词手工标定，
 * 排序模式 power（默认）按它从高到低；表外模型走后缀+描述启发式。
 * 标定原则：同代旗舰(Pro/Max) > 标准 > Flash/轻量；新一代可越上一代旗舰
 * （定案：GLM-5.3-Flash 90 > GLM-5.2 88 —— 补后同价 ⚡1.0，新一代原生多模态优先）。 */
const CAPABILITY = {
  'Qwen3.8-Max': 96, 'Kimi-K3': 95, 'MiMo-V2.5-Pro': 93, 'GLM-5.3': 92,
  'GLM-5.3-Flash': 90, 'GLM-5.2': 88, 'GLM-5.3-FlashX': 86, 'DeepSeek-V4-Pro-0813': 90,
  'MiniMax-M3': 88, 'DeepSeek-V4-Pro': 88, 'Kimi-K2.7-Code': 86, 'Hy4-Preview': 85,
  'Kimi-K2.6': 82, 'Qwen3.8-Flash': 82, 'DeepSeek-V4.1-Flash': 80, 'GLM-5.1': 78,
  'MiMo-V2.5': 78, 'Qwen3.7-Plus': 76, 'DeepSeek-V4-Flash-0731': 74,
  'DeepSeek-V4-Flash-Vision-Exp': 72, 'DeepSeek-V4-Flash': 70, 'Hy3': 70,
  'Qwen3.7-Flash': 68, 'MiniMax-M2.7': 66,
};
function capabilityScore(m) {
  if (CAPABILITY[m && m.display_name] != null) return CAPABILITY[m.display_name];
  const name = String((m && m.display_name) || '');
  const desc = String((m && m.description) || '');
  let s = 50;
  if (/(^|[^a-z])Max|Pro|Plus/.test(name)) s += 18;
  if (/Flash/i.test(name)) s -= 6;
  if (/Exp|Preview/i.test(name)) s -= 4;
  if (/万亿|2\.4T|2\.8万亿|7430 亿|千亿/.test(desc)) s += 16;
  if (/旗舰|最强|第一|Opus/.test(desc)) s += 10;
  if (/轻量|高速|极速|更快/.test(desc)) s -= 6;
  if ((m && m.context_limit || 0) >= 1000000) s += 4;
  return Math.max(0, Math.min(100, s));
}

/** 展示排序：smart=综合分（默认：能力50%+人气30%+补贴20%，分高在前）
 *  power=纯能力优先；price=省钱优先（有效电价升序）。生效档永远排在失效档前。 */
function displayRows(rows, mode) {
  const arr = (rows || []).slice();
  if (mode === 'price') return arr;
  if (mode === 'power') {
    return arr.sort((a, b) => ((b.active - a.active) || (b.cap - a.cap) || (a.eff - b.eff)
      || String(a.m.display_name).localeCompare(String(b.m.display_name))));
  }
  return arr.sort((a, b) => ((b.active - a.active) || (b.score - a.score) || (a.eff - b.eff)
    || String(a.m.display_name).localeCompare(String(b.m.display_name))));
}

/* ============================ 时间（纯算术时区，不依赖 Intl） ============================ */

const pad2 = (n) => String(n).padStart(2, '0');

/** 北京时间快照：Date.now() 是绝对时间，+8h 后用 getUTC* 读取即为北京时间 */
function bjNow(ms) {
  const d = new Date((ms == null ? Date.now() : ms) + 8 * 3600 * 1000);
  const ymd = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  const hm = `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
  return { ymd, hm, full: `${ymd} ${hm}:${pad2(d.getUTCSeconds())}`, h: d.getUTCHours(), mi: d.getUTCMinutes() };
}

/* ============================ 补贴判定 ============================ */

/** 把 discount_end 归一化成可比字符串；10 位 = 当天 23:59:59 */
function normEnd(end) {
  let s = String(end).replace('T', ' ').trim();
  if (s.length <= 10) return s + ' 23:59:59';
  if (s.length < 19) s += ':00';
  return s.slice(0, 19);
}

/** 结束时间是否已过（与前端 _discountEndExpired 同逻辑） */
function endExpired(end, nowFull) {
  if (!end) return false;
  return nowFull.slice(0, 19) > normEnd(end);
}

/** 每日时段判定；跨零点环绕处理；只有一端有值时该段不生效 */
function inDailyWindow(hm, ds, de) {
  if (!ds || !de) return true;
  if (ds <= de) return ds <= hm && hm <= de;
  return hm >= ds || hm <= de;
}

/** 补贴是否处于生效态（不含额度判断） */
function subsidyActive(m, now) {
  if (!m || m.discount_price == null) return false;
  if (m.discount_start && now.ymd < String(m.discount_start).slice(0, 10)) return false;
  if (endExpired(m.discount_end, now.full)) return false;
  if (!inDailyWindow(now.hm, m.discount_daily_start, m.discount_daily_end)) return false;
  return true;
}

/** 额度状态：discount_quota 为空 = 不限量 */
function quotaState(m) {
  const q = m.discount_quota == null ? null : Number(m.discount_quota);
  const used = Number(m.discount_used || 0);
  if (q == null) return { unlimited: true, total: null, used, left: null, depleted: false };
  const left = Math.max(0, q - used);
  return { unlimited: false, total: q, used, left, depleted: left <= 0 };
}

/** 当前实际电价（补贴生效则用 discount_price） */
function effPrice(m, active) {
  const base = Number(m.price == null ? 0 : m.price);
  if (active && m.discount_price != null) return Number(m.discount_price);
  return base;
}

/** 补贴力度（0~1） */
function depth(m) {
  const p = Number(m.price || 0);
  const dp = Number(m.discount_price);
  if (!p || m.discount_price == null || !isFinite(dp)) return 0;
  return Math.max(0, (p - dp) / p);
}

/** 每日时段标签；无时段返回 '' */
function windowLabel(m) {
  if (m.discount_daily_start && m.discount_daily_end) return `${m.discount_daily_start}-${m.discount_daily_end}`;
  return '';
}

/** 下一个即将开启的补贴时段（用于无补贴时的提示） */
function nextWindow(rows, now) {
  let best = null;
  for (const r of rows) {
    const ds = r.m.discount_daily_start, de = r.m.discount_daily_end;
    if (!ds || !de) continue;
    if (inDailyWindow(now.hm, ds, de)) continue;
    if (now.hm < ds) {
      const mins = hmToMin(ds) - hmToMin(now.hm);
      if (!best || mins < best.mins) best = { mins, ds, de, name: r.m.display_name };
    }
  }
  return best;
}
const hmToMin = (hm) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));

/* ============================ HTTP 垫片 v2 ============================
 * Egern 真实 API（对社区实机组件核实）：ctx.http.get(url, {timeout}) → Response，
 * 必须再 await res.text() / res.json()。post 同构。
 * 这里按优先级依次尝试：ctx.http(url,init) → ctx.http({url,...}) → $httpClient 回调 → fetch，
 * 全部失败时抛出带各通道死因的聚合错误（会显示在小组件上，便于远程排障）。
 * ========================================================================== */

async function readBody(res) {
  if (res == null) return '';
  if (typeof res === 'string') return res;
  if (typeof res.text === 'function') return String(await res.text());
  if (typeof res.json === 'function') { try { return JSON.stringify(await res.json()); } catch (_) { return ''; } }
  if (typeof res.body === 'string') return res.body;
  if (typeof res.data === 'string') return res.data;
  if (res.data && typeof res.data === 'object') return JSON.stringify(res.data);
  try { return JSON.stringify(res); } catch (_) { return ''; }
}

function bodyText(b) {
  if (b == null) return '';
  if (typeof b === 'string') return b;
  if (typeof b.text === 'string') return b.text;
  if (typeof b.body === 'string') return b.body;
  try { return JSON.stringify(b); } catch (_) { return ''; }
}

/** 统一请求：opts = {url, method, headers, body, expect(json)->bool, prefer(上次成功通道), budget(总预算ms)}
 *  成功返回 {status, text, json, via(通道名)} */
async function httpJson(ctx, opts) {
  const method = (opts.method || 'GET').toUpperCase();
  const lower = method.toLowerCase();
  const headers = Object.assign({ 'User-Agent': 'Egern/nebula-power' }, opts.headers || {});
  const init = { method, headers, timeout: 5000 };
  if (opts.body != null) init.body = opts.body;
  const url = opts.url;

  const errs = [];
  const attempts = [];
  const h = ctx && ctx.http;
  if (h && typeof h[lower] === 'function') {
    attempts.push(['ctx.http(url,init)', async () => {
      const res = await h[lower](url, init);
      return { status: (res && (res.status || res.statusCode)) || 0, text: await readBody(res) };
    }]);
    attempts.push(['ctx.http({url,...})', async () => {
      const res = await h[lower](Object.assign({ url }, init));
      return { status: (res && (res.status || res.statusCode)) || 0, text: await readBody(res) };
    }]);
  }
  const client = typeof globalThis.$httpClient !== 'undefined' ? globalThis.$httpClient : null;
  if (client && typeof client[lower] === 'function') {
    attempts.push(['$httpClient', () => new Promise((resolve, reject) => {
      let settled = false;
      const fin = (r) => { if (!settled) { settled = true; resolve(r); } };
      const rej = (e) => { if (!settled) { settled = true; reject(e instanceof Error ? e : new Error(String(e))); } };
      const timer = typeof setTimeout === 'function' ? setTimeout(() => rej(new Error('超时')), 5000) : null;
      try {
        client[lower]({ url, headers, body: opts.body }, (err, resp, body) => {
          if (timer) clearTimeout(timer);
          if (err) return rej(err);
          fin({ status: (resp && (resp.status || resp.statusCode)) || 0, text: bodyText(body) });
        });
      } catch (e) { if (timer) clearTimeout(timer); rej(e); }
    })]);
  }
  if (typeof fetch === 'function') {
    attempts.push(['fetch', async () => {
      const res = await fetch(url, { method, headers, body: opts.body });
      return { status: res.status, text: await res.text() };
    }]);
  }
  // 上次成功的通道提到最前（省去逐个试错，小部件进程的渲染窗口很宝贵）
  if (opts.prefer) {
    const i = attempts.findIndex(([n]) => n === opts.prefer);
    if (i > 0) attempts.unshift(...attempts.splice(i, 1));
  }
  const deadline = Date.now() + (opts.budget || 9000);
  for (const [name, run] of attempts) {
    if (Date.now() > deadline - 1200) { errs.push(name + ': 跳过(超预算)'); continue; }
    let r;
    try { r = await run(); } catch (e) { errs.push(name + ': ' + (e && e.message ? e.message : String(e))); continue; }
    let j = null;
    try { j = JSON.parse(r.text); } catch (_) { /* 非 JSON */ }
    if (j != null && opts.expect && !opts.expect(j)) {
      const d = j && j.detail ? ' detail=' + String(j.detail).slice(0, 60) : '';
      errs.push(name + ': HTTP ' + r.status + d);
      continue;
    }
    if (j == null && r.status >= 400) { errs.push(name + ': HTTP ' + r.status); continue; }
    return { status: r.status, text: r.text, json: j, via: name };
  }
  const msg = errs.length ? errs.join(' | ') : '无可用通道（ctx.http/$httpClient/fetch 均缺失）';
  throw new Error(String(msg).slice(0, 150));
}

/* ============================ 持久缓存（$persistentStore → 内存兜底） ============================ */

const STORE_KEY = 'nebula_power_cache';
let _memCache = null;

function cacheRead() {
  try {
    const ps = typeof globalThis.$persistentStore !== 'undefined' ? globalThis.$persistentStore : null;
    if (ps && typeof ps.read === 'function') {
      const raw = ps.read(STORE_KEY);
      const c = raw ? JSON.parse(raw) : null;
      return c && c.json ? c : _memCache;
    }
  } catch (_) { /* 存储坏就当没有 */ }
  return _memCache;
}
function cacheWrite(c) {
  _memCache = c;
  try {
    const ps = typeof globalThis.$persistentStore !== 'undefined' ? globalThis.$persistentStore : null;
    if (ps && typeof ps.write === 'function') return !!ps.write(JSON.stringify(c), STORE_KEY);
  } catch (_) {}
  return false;
}

/* ============================ 取数 ============================ */

/** 人气分 0-100（对数刻度）：lb 有平台排行榜(需 Cookie)用真实 tokens；否则用公开的
 *  补贴池今日消耗(discount_used)作代理——它本身就是全站用户在补贴价下的真实用量。 */
function popularityMap(lbModels, rows) {
  const vals = {};
  let max = 0;
  const src = (Array.isArray(lbModels) && lbModels.length) ? lbModels : null;
  if (src) {
    for (const it of src) {
      const v = Number(it.tokens || it.credit || 0);
      if (v > 0) { vals[it.model] = v; if (v > max) max = v; }
    }
  } else {
    for (const it of rows || []) { // 原始模型表：补贴池今日消耗 = 全站用户的真实用票
      const v = Number((it && it.discount_used) || 0);
      const key = (it && (it.id || it.display_name)) || '';
      if (v > 0) { vals[key] = v; if (v > max) max = v; }
    }
  }
  const out = {};
  const L = Math.log(1 + Math.max(max, 1));
  for (const k in vals) out[k] = Math.max(1, Math.min(100, Math.round(100 * Math.log(1 + vals[k]) / L)));
  return out;
}

/** 纯计算：接口 JSON → 汇总结构（不碰网络）。lb = 平台模型排行榜（可选，Cookie 模式才有） */
function computeSubsidy(json, now, lb) {
  const list = json.data || json.models || [];
  const rate = typeof json.rmb_rate === 'number' && json.rmb_rate > 0 ? json.rmb_rate : CNY_PER_POWER;
  const popMap = popularityMap(lb, list);

  const rows = [];
  for (const m of list) {
    const q = quotaState(m);
    const timeOk = subsidyActive(m, now);
    const active = timeOk && !q.depleted;
    const price = effPrice(m, active);
    const pop = popMap[m.id] != null ? popMap[m.id]
      : (popMap[m.display_name] != null ? popMap[m.display_name] : 0);
    const cap = capabilityScore(m);
    rows.push({
      m, q, timeOk, active, price,
      hasSubsidy: m.discount_price != null,
      depth: depth(m),
      eff: price,
      cap, pop,
      score: Math.round((0.5 * cap + 0.3 * pop + 0.2 * Math.round(depth(m) * 100)) * 10) / 10,
    });
  }
  // 排序：有效电价升序 → 补贴力度降序 → 名称（展示序由 displayRows 定）
  rows.sort((a, b) => (a.eff - b.eff) || (b.depth - a.depth) || String(a.m.display_name).localeCompare(String(b.m.display_name)));
  const subsidised = rows.filter((r) => r.hasSubsidy);
  const activeRows = subsidised.filter((r) => r.active);
  const best = rows[0] || null;
  const deepest = subsidised.slice().sort((a, b) => b.depth - a.depth)[0] || null;
  return { rows, subsidised, activeRows, deepest, best, rate, total: rows.length, lbUsed: !!(Array.isArray(lb) && lb.length) };
}

/** 公开补贴数据：实时优先；失败回放上次成功缓存（标「缓存 HH:MM」），冷启动全挂才抛错。
 *  lb = 平台模型排行榜数组（可选，Cookie 模式才有；没有就用人气代理） */
async function loadSubsidy(ctx, now, lb) {
  const memo = cacheRead();
  try {
    const res = await httpJson(ctx, {
      url: MODELS_API, method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'public' }),
      expect: (j) => !!(j && (j.data || j.groups)),
      prefer: memo && memo.tr,
      budget: 9000,
    });
    const json = res.json || JSON.parse(res.text);
    cacheWrite({ t: Date.now(), tr: res.via, json });
    return computeSubsidy(json, now, lb);
  } catch (e) {
    if (memo && memo.json) {
      const out = computeSubsidy(memo.json, now, lb);
      out.fromCache = true;
      out.staleAt = memo.t;
      out.err = e && e.message;
      return out;
    }
    throw e;
  }
}

/** 私有数据（可选）：塞入会话 Cookie 后读你自己的余额 / 电力包 */
async function loadUsage(ctx, cookie) {
  if (!cookie) return null;
  try {
    const res = await httpJson(ctx, {
      url: USAGE_API,
      headers: { Cookie: cookie, Accept: 'application/json' },
      expect: (j) => j && (j.usage || j.packs_remaining != null) && !j.detail,
    });
    const u = (res.json && (res.json.usage || res.json)) || {};
    return {
      remaining: Number(u.packs_remaining || 0),
      packCount: Number(u.active_packs_count || 0),
      balance: Number(u.balance || 0),
      balancePay: !!u.balance_pay_enabled,
    };
  } catch (_) { return null; }
}

/** 平台模型排行榜（可选，需 Cookie）：[{model, tokens, requests, credit}]，给综合分当人气项 */
async function loadLeaderboard(ctx, cookie) {
  if (!cookie) return null;
  try {
    const res = await httpJson(ctx, {
      url: LEADERBOARD_API,
      headers: { Cookie: cookie, Accept: 'application/json' },
      expect: (j) => j && Array.isArray(j.models) && !j.detail,
      budget: 6000,
    });
    return (res.json && res.json.models) || null;
  } catch (_) { return null; }
}

/* ============================ 格式化 ============================ */

function fmtPower(n) {
  const v = Number(n || 0);
  if (!isFinite(v)) return String(n);
  if (v === 0) return '0';
  if (v >= 10000) return (v / 10000).toFixed(1).replace(/\.0$/, '') + 'W';
  if (v >= 1000) return (Math.round(v / 100) / 10) + 'K';
  if (Number.isInteger(v)) return String(v);
  return String(Math.round(v * 100) / 100);
}
function fmtCny(n) {
  const v = Number(n || 0);
  if (v === 0) return '0';
  if (v >= 0.001) return String(Math.round(v * 1000) / 1000);
  return String(Number(v.toPrecision(2)));
}
const pct = (d) => Math.round(d * 100);

/* ============================ 视图 ============================ */

const C = {
  bg: { light: '#FFFFFF', dark: '#101018' },
  card: { light: '#F2F2F7', dark: '#1C1C28' },
  primary: { light: '#111114', dark: '#FFFFFF' },
  secondary: { light: '#5F5F6B', dark: '#A6A6B8' },
  tertiary: { light: '#9A9AA5', dark: '#6C6C80' },
  accent: { light: '#1F7A38', dark: '#3FD06A' },   // 电力绿（站点同色 #1F7A38）
  gold: { light: '#9A6B00', dark: '#FFD60A' },     // 补贴金
  warn: { light: '#B25000', dark: '#FF9F0A' },
  danger: { light: '#C4000F', dark: '#FF453A' },
};
const T = (text, o) => Object.assign({ type: 'text', text: String(text) }, o || {});

function header(sub) {
  return {
    type: 'stack', direction: 'row', alignItems: 'center', gap: 4,
    children: [
      { type: 'image', src: 'sf-symbol:bolt.fill', width: 12, height: 12, color: C.gold },
      T('星云电力', { font: { size: 'subheadline', weight: 'bold' }, textColor: C.primary, lineLimit: 1 }),
      { type: 'spacer' },
      T(sub, { font: { size: 'caption2' }, textColor: C.secondary, textAlign: 'right', lineLimit: 1, minScale: 0.6 }),
    ],
  };
}

function foot(parts) {
  return {
    type: 'stack', direction: 'row', alignItems: 'center', gap: 4,
    children: parts.map((p, i) => T(p, {
      font: { size: 'caption2' }, textColor: C.tertiary,
      lineLimit: 1, minScale: 0.6, ...(i ? { textAlign: 'right' } : {}),
    })).reduce((acc, el) => (acc.length ? acc.concat([{ type: 'spacer' }, el]) : [el]), []),
  };
}

/** 补贴/价格一行；first=true 时加「首推」标 */
function rowLine(r, wide, first) {
  const m = r.m;
  const priceColor = r.active ? C.gold : C.tertiary;
  const kids = [
    T((first ? '首推 ' : '') + m.display_name, { font: { size: 'footnote', weight: 'semibold' }, textColor: r.active ? C.primary : C.secondary, lineLimit: 1, minScale: 0.65 }),
    { type: 'spacer' },
  ];
  if (wide) {
    kids.push(T(windowLabel(m) || '全天', { font: { size: 'caption2' }, textColor: C.tertiary, lineLimit: 1 }));
  }
  kids.push(T(`⚡${fmtPower(r.eff)}`, { font: { size: 'footnote', weight: 'heavy' }, textColor: priceColor, lineLimit: 1 }));
  kids.push(T(`-${pct(r.depth)}%`, { font: { size: 'caption2', weight: 'semibold' }, textColor: r.active ? C.accent : C.tertiary, lineLimit: 1 }));
  if (wide) {
    const qt = r.q.unlimited ? '∞' : (r.q.depleted ? '已耗尽' : '剩' + fmtPower(r.q.left));
    const ratio = r.q.total ? r.q.left / r.q.total : 1;
    kids.push(T(qt, { font: { size: 'caption2' }, textColor: r.q.depleted || ratio < 0.15 ? C.warn : C.tertiary, lineLimit: 1 }));
  }
  return { type: 'stack', direction: 'row', alignItems: 'center', gap: 5, children: kids };
}

function subsidyRowList(data, disp, limit, wide) {
  const act = disp.filter((r) => r.active);
  let list = act.length ? act : disp.filter((r) => r.hasSubsidy && !r.q.depleted);
  // 每个模型组只留一个最优推荐（GLM/Qwen/DeepSeek/… 各留榜首，不重复点同一家的菜）
  const seen = {};
  list = list.filter((r) => {
    const g = r.m.group || r.m.display_name;
    if (seen[g]) return false;
    seen[g] = true;
    return true;
  });
  return list.slice(0, limit).map((r, i) => rowLine(r, wide, i === 0));
}

/* ============================ 入口 ============================ */

async function renderWidget(ctx) {
  ctx = ctx || {};
  const env = ctx.env || {};
  const fam = ctx.widgetFamily || 'systemSmall';
  const now = bjNow();

  let data = null, usage = null, err = null;
  try {
    const lb = env.NEBULA_COOKIE ? await loadLeaderboard(ctx, env.NEBULA_COOKIE) : null;
    data = await loadSubsidy(ctx, now, lb);
  } catch (e) { err = e && e.message ? e.message : String(e); }
  if (data && env.NEBULA_COOKIE) usage = await loadUsage(ctx, env.NEBULA_COOKIE);

  const refreshAfter = nextRefresh();

  if (!data) {
    return {
      type: 'widget', refreshAfter, padding: 14, gap: 4, backgroundColor: C.bg,
      children: [
        header('离线'),
        T('补贴数据获取失败', { font: { size: 'footnote', weight: 'semibold' }, textColor: C.primary, lineLimit: 1 }),
        T(String(err || '未知错误'), { font: { size: 'caption2' }, textColor: C.secondary, lineLimit: 2, minScale: 0.7 }),
        { type: 'spacer' },
        foot(['将在 10 分钟后重试', 'ai.ipix.ink']),
      ],
    };
  }

  const orderRaw = String(env.NEBULA_SORT || 'smart').toLowerCase();
  const order = ['smart', 'power', 'price'].includes(orderRaw) ? orderRaw : 'smart';
  const disp = displayRows(data.rows, order);
  const best = disp[0] || data.best;
  const activeN = data.activeRows.length;
  const subN = data.subsidised.length;
  const deep = data.deepest;
  const cheapest = best.m.display_name;
  const priceTxt = `⚡${fmtPower(best.eff)}`;
  const win = windowLabel(best.m);
  const next = nextWindow(data.subsidised, now);
  const usageParts = [];
  if (usage) {
    usageParts.push(`余额 ⚡${fmtPower(usage.remaining)}`, `${usage.packCount} 包`);
    if (usage.balance > 0) usageParts.push(`¥${fmtCny(usage.balance)}`);
  }

  /* ---------- 锁屏 ---------- */
  if (fam === 'accessoryInline') {
    return {
      type: 'widget', refreshAfter,
      children: [T(`星云 ${best.active ? '补贴 ' + priceTxt : priceTxt} ${cheapest}`,
        { font: { size: 'caption1', weight: 'semibold' }, textColor: C.gold, lineLimit: 1, minScale: 0.8 })],
    };
  }
  if (fam === 'accessoryCircular') {
    return {
      type: 'widget', refreshAfter, padding: 2, gap: 0,
      children: [
        T(fmtPower(best.eff), { font: { size: 'headline', weight: 'heavy' }, textColor: C.gold, textAlign: 'center', lineLimit: 1, minScale: 0.5 }),
        T(activeN ? `补贴 ${activeN}` : '无补贴', { font: { size: 'caption2' }, textColor: C.secondary, textAlign: 'center', lineLimit: 1, minScale: 0.6 }),
      ],
    };
  }
  if (fam === 'accessoryRectangular') {
    return {
      type: 'widget', refreshAfter, gap: 1,
      children: [
        {
          type: 'stack', direction: 'row', alignItems: 'center', gap: 5, children: [
            T('星云电力', { font: { size: 'caption1', weight: 'bold' }, textColor: C.primary, lineLimit: 1 }),
            { type: 'spacer' },
            T(activeN ? `补贴中 ${activeN} 档` : '当前无补贴', { font: { size: 'caption1' }, textColor: activeN ? C.accent : C.secondary, lineLimit: 1 }),
          ],
        },
        T(`${cheapest} ${priceTxt}${best.active ? ' -' + pct(best.depth) + '%' : ''}`,
          { font: { size: 'caption2' }, textColor: C.secondary, lineLimit: 1, minScale: 0.65 }),
      ],
    };
  }

  /* ---------- 主屏 ---------- */
  const isSmall = fam === 'systemSmall';
  const isLarge = fam === 'systemLarge';
  const wide = isLarge;
  const topN = Number(env.NEBULA_TOP || 0) || (isLarge ? 6 : 4);

  const children = [header((data.fromCache ? `缓存 ${bjNow(data.staleAt).hm} · ` : '')
    + (activeN ? `补贴中 ${activeN}` : (subN ? `补贴 ${subN} 档待启` : '无补贴')))];

  if (isSmall) {
    children.push(
      { type: 'spacer', length: 2 },
      T(cheapest, { font: { size: 'title3', weight: 'heavy' }, textColor: best.active ? C.gold : C.primary, lineLimit: 1, minScale: 0.55 }),
      {
        type: 'stack', direction: 'row', alignItems: 'baseline', gap: 5, children: [
          T(priceTxt, { font: { size: 'headline', weight: 'heavy' }, textColor: C.primary, lineLimit: 1 }),
          T('/100K', { font: { size: 'caption2' }, textColor: C.tertiary, lineLimit: 1 }),
          { type: 'spacer' },
          best.active
            ? T(`-${pct(best.depth)}%`, { font: { size: 'caption1', weight: 'semibold' }, textColor: C.accent, lineLimit: 1 })
            : T(`¥${fmtCny(best.eff * data.rate)}/100K`, { font: { size: 'caption2' }, textColor: C.tertiary, lineLimit: 1 }),
        ],
      },
      T(best.active
        ? `原 ⚡${fmtPower(best.m.price)}${win ? ' · ' + win : ' · 全天'}`
        : (next ? `下一档 ${next.ds}-${next.de} ${next.name}` : '全天无补贴时段'),
        { font: { size: 'caption2' }, textColor: C.secondary, lineLimit: 1, minScale: 0.65 }),
      { type: 'spacer' },
      foot(deep ? [`最深-${pct(deep.depth)}%`, usageParts.length ? usageParts[0] : `${data.total} 模型`] : [`${data.total} 模型`, now.hm])
    );
  } else {
    children.push({ type: 'spacer', length: 2 });
    children.push(...subsidyRowList(data, disp, topN, wide));
    children.push({ type: 'spacer' });
    const footParts = [];
    if (usage) footParts.push(`⚡${fmtPower(usage.remaining)}`, `${usage.packCount} 包`);
    footParts.push(`¥${fmtCny(data.rate)}/⚡`);
    footParts.push(`${now.hm} 北京`);
    children.push(foot(footParts));
  }

  return {
    type: 'widget',
    padding: isSmall ? [12, 13, 12, 13] : [14, 16, 14, 16],
    gap: isSmall ? 4 : 5,
    backgroundColor: C.bg,
    refreshAfter,
    children,
  };
}

/** 每 10 分钟一刻刷新（补贴时段最多按半小时粒度变化，10 分钟足够且省电） */
function nextRefresh() {
  const ms = Date.now();
  const step = 10 * 60 * 1000;
  return new Date(Math.floor(ms / step) * step + step + 5000).toISOString();
}

/* 供离线测试脚本调用（Egern 忽略多余导出） */
export const __internals = {
  bjNow, normEnd, endExpired, inDailyWindow, subsidyActive, quotaState,
  effPrice, depth, windowLabel, nextWindow, fmtPower, fmtCny, loadSubsidy, httpJson,
  capabilityScore, displayRows, computeSubsidy,
  _testResetCache: () => { _memCache = null; },
};

/** 入口：整体看门狗——小部件进程对脚本时长很敏感，超时也给一张可用卡片 */
export default async function (ctx) {
  const run = renderWidget(ctx || {});
  if (typeof Promise !== 'undefined' && typeof Promise.race === 'function' && typeof setTimeout === 'function') {
    return Promise.race([
      run,
      new Promise((resolve) => setTimeout(() => resolve({
        type: 'widget', padding: 14, gap: 4, backgroundColor: C.bg,
        refreshAfter: nextRefresh(),
        children: [
          header('超时'),
          T('本次刷新超时，下个周期自动重试', { font: { size: 'caption2' }, textColor: C.secondary, lineLimit: 1, minScale: 0.7 }),
        ],
      }), 11000)),
    ]);
  }
  return run;
}
/**
 * 星云AI 电力补贴 —— Surge 信息面板版
 * ==========================================================================
 * 来源：同仓库 Egern 版 Egern/Scripts/nebula-power.js
 *       （补贴判定 / 计价口径 / 能力档位 / 综合排序 / 缓存策略 全部逐字节复用，
 *         仅替换 HTTP 与持久化适配层，以及最外层渲染壳。）
 *
 * ★ 为什么不是「小组件」★
 *   Surge 的七种脚本类型里没有 widget，Surge 的小组件是内置的策略组小组件，
 *   不接受自定义脚本渲染。Egern 的 type:'widget' DSL 在 Surge 上无等价物。
 *   这里的载体是「信息面板（[Panel] + type=generic）」：iOS 在策略选择界面显示，
 *   Mac 在菜单栏 Panels 子菜单显示；内容是纯文本（\n 换行），没有逐行配色/布局。
 *   因此本版把原小组件的「多列富文本」压成「每档一行」的可读文本。
 *
 * 数据源与判定口径与 Egern 版完全一致：
 *   POST https://ai.ipix.ink/guest/models  body {"key":"public"}
 *   ① discount_price 非空才有补贴；② discount_start/end 限定日期；③ daily 时段跨零点环绕；
 *   ④ 额度池耗尽只做提示，不改实扣价（实账单证实）。
 *
 * 刷新语义：
 *   面板内容由 Surge 缓存，仅在「update-interval 到点 + 用户打开策略选择界面」时重跑。
 *   网络失败时回放上次成功结果（标「缓存 HH:MM」），冷启动全挂才显示错误。
 *
 * env（写在 [Script] 行的 argument= 参数上）：
 *   argument="sort=smart,top=6,cookie=server_session_xxx=..."
 *     sort   = smart(默认，能力50%+人气30%+补贴20%) | power(纯能力) | price(省钱优先)
 *     top    = 面板列出的档数（默认 6）
 *     cookie = 可选。填你自己的会话 Cookie 才显示私有余额/电力包；不填=零凭证只用公开数据
 *
 * 部署（把下面三行加进你的 Surge 配置）：
 *   [Script]
 *   nebula-power-panel = type=generic, script-path=https://raw.githubusercontent.com/ijmu/Tools/main/Surge/Scripts/nebula-power-panel.js, script-update-interval=86400, timeout=12, argument="sort=smart,top=6"
 *   [Panel]
 *   NebulaPower = title="星云电力补贴", content="打开策略视图即刷新", style=info, script-name=nebula-power-panel, update-interval=600
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
 *  power=纯能力优先；price=省钱优先（有效电价升序）。
 *  可用度分层永远最优先：生效档 > 时段内但额度耗尽 > 时段外。 */
function displayRows(rows, mode) {
  const arr = (rows || []).slice();
  const tier = (a, b) => ((b.usable - a.usable)
    || (mode === 'price' ? (a.eff - b.eff) || (b.depthEff - a.depthEff) : mode === 'power' ? (b.cap - a.cap) || (a.eff - b.eff) : (b.score - a.score) || (a.eff - b.eff))
    || String(a.m.display_name).localeCompare(String(b.m.display_name)));
  return arr.sort(tier);
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
  const headers = Object.assign({ 'User-Agent': 'Surge/nebula-power' }, opts.headers || {});
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
  const client = (typeof $httpClient !== 'undefined' && $httpClient)
    || (typeof globalThis !== 'undefined' && globalThis.$httpClient) || null;
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
  const msg = errs.length ? errs.join(' | ') : '无可用通道（$httpClient/fetch 均缺失）';
  throw new Error(String(msg).slice(0, 150));
}

/* ============================ 持久缓存（$persistentStore → 内存兜底） ============================ */

/** Surge 的 $persistentStore 是裸全局；JSC 引擎下未必挂在 globalThis 上，两个都探。 */
function store() {
  if (typeof $persistentStore !== 'undefined' && $persistentStore) return $persistentStore;
  if (typeof globalThis !== 'undefined' && globalThis.$persistentStore) return globalThis.$persistentStore;
  return null;
}

const STORE_KEY = 'nebula_power_cache';
let _memCache = null;

function cacheRead() {
  try {
    const ps = store();
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
    const ps = store();
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
    const price = effPrice(m, timeOk);
    const pop = popMap[m.id] != null ? popMap[m.id]
      : (popMap[m.display_name] != null ? popMap[m.display_name] : 0);
    const cap = capabilityScore(m);
    // 实扣价只看时段：额度池耗尽不改实扣价（实账单证实，计数器到 quota 封顶只是记账）
    const active = timeOk;
    const depthEff = depth(m);
    rows.push({
      m, q, timeOk, active, price,
      hasSubsidy: m.discount_price != null,
      depth: depth(m),
      depthEff,
      eff: price,
      cap, pop,
      usable: timeOk ? 2 : 0,
      score: Math.round((0.5 * cap + 0.3 * pop + 0.2 * Math.round(depthEff * 100)) * 10) / 10,
    });
  }
  // 排序：有效电价升序 → 补贴力度降序 → 名称（展示序由 displayRows 定）
  rows.sort((a, b) => (a.eff - b.eff) || (b.depth - a.depth) || String(a.m.display_name).localeCompare(String(b.m.display_name)));
  const subsidised = rows.filter((r) => r.hasSubsidy);
  const activeRows = subsidised.filter((r) => r.active);
  const best = rows[0] || null;
  const deepest = subsidised.slice().sort((a, b) => b.depth - a.depth)[0] || null;
  const siteCount = rows.filter((r) => r.timeOk).length; // 官网「补贴生效中」口径：只看时段
  return { rows, subsidised, activeRows, deepest, best, rate, total: rows.length, siteCount, lbUsed: !!(Array.isArray(lb) && lb.length) };
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
const CFG = {
  cookie: _ARG.cookie || '',
  sort: ['smart', 'power', 'price'].indexOf(String(_ARG.sort || 'smart').toLowerCase()) >= 0
    ? String(_ARG.sort || 'smart').toLowerCase() : 'smart',
  top: Math.max(1, Math.min(20, Number(_ARG.top || 6) || 6)),
};

const HR = '────────────';
/** 首行那个「第一名」在不同排序下的含义不同，措辞必须跟着变，否则是假标签 */
const PICK_LABEL = { smart: '首推', power: '能力最强', price: '最低' };
const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳'];

/** 一行一档：序号 名称 ⚡实扣价 -力度% 时段 [池状态] */
function rowLine(r, idx) {
  const parts = [CIRCLED[idx] || (idx + 1) + '.', r.m.display_name, '⚡' + fmtPower(r.eff), '-' + pct(r.depthEff) + '%'];
  parts.push(windowLabel(r.m) || '全天');
  if (r.q.depleted) parts.push('[池满]');
  return parts.join(' ');
}

function renderPanel(data, usage, now) {
  const disp = displayRows(data.rows, CFG.sort);
  const best = disp[0] || data.best;
  const onN = data.siteCount;
  const lines = [];

  const stamp = (data.fromCache ? '缓存 ' + bjNow(data.staleAt).hm : now.hm) + ' 北京';
  lines.push(stamp + ' · ' + data.total + ' 个模型 · ¥' + fmtCny(data.rate) + '/⚡');
  if (onN) lines.push('补贴中 ' + onN + ' 档 · ' + (PICK_LABEL[CFG.sort] || '首推') + ' ⚡' + fmtPower(best.eff) + ' ' + best.m.display_name);
  else lines.push('当前无补贴');

  lines.push(HR);
  let list = disp.filter((r) => r.timeOk);
  if (!list.length) list = disp.filter((r) => r.hasSubsidy && !r.q.depleted);
  const seen = {};
  list = list.filter((r) => {
    const g = r.m.group || r.m.display_name;
    if (seen[g]) return false;
    seen[g] = true;
    return true;
  }).slice(0, CFG.top);
  if (list.length) {
    list.forEach((r, i) => lines.push(rowLine(r, i)));
  } else {
    lines.push('暂无可用补贴档');
  }
  lines.push(HR);

  const deep = data.deepest;
  if (deep && deep.depthEff > 0) lines.push('最深 -' + pct(deep.depthEff) + '% · ' + deep.m.display_name);
  const next = nextWindow(data.subsidised, now);
  if (next && !onN) lines.push('下一档 ' + next.ds + '-' + next.de + ' · ' + next.name);
  if (usage) {
    let u = '余额 ⚡' + fmtPower(usage.remaining) + ' · ' + usage.packCount + ' 包';
    if (usage.balance > 0) u += ' · ¥' + fmtCny(usage.balance);
    lines.push(u);
  }

  return {
    title: '星云电力补贴' + (onN ? ' · ' + onN + ' 档' : ''),
    content: lines.join('\n'),
    style: data.fromCache ? 'alert' : (onN ? 'good' : 'info'),
  };
}

async function main() {
  const now = bjNow();
  let data = null, usage = null, err = null;
  try {
    const lb = CFG.cookie ? await loadLeaderboard(null, CFG.cookie) : null;
    data = await loadSubsidy(null, now, lb);
  } catch (e) { err = e && e.message ? e.message : String(e); }
  if (data && CFG.cookie) usage = await loadUsage(null, CFG.cookie);

  if (!data) {
    return {
      title: '星云电力补贴 · 离线',
      content: ['补贴数据获取失败', String(err || '未知错误').slice(0, 120), '下次打开面板时自动重试'].join('\n'),
      style: 'error',
    };
  }
  return renderPanel(data, usage, now);
}

(function () {
  let settled = false;
  const finish = function (obj) {
    if (settled) return;
    settled = true;
    if (timer && typeof clearTimeout === 'function') clearTimeout(timer);
    $done(obj);
  };
  const timer = (typeof setTimeout === 'function')
    ? setTimeout(function () {
      finish({ title: '星云电力补贴 · 超时', content: '本次刷新超时（9s）\n下拉/重开策略界面可重试', style: 'alert' });
    }, 9000)
    : null;

  Promise.resolve()
    .then(main)
    .then(finish)
    .catch(function (e) {
      finish({ title: '星云电力补贴 · 出错', content: String((e && e.message) || e).slice(0, 200), style: 'error' });
    });
})();

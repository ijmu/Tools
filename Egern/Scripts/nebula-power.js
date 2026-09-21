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
 *   NEBULA_TOP    = "6"                       → 大尺寸列出的补贴档数（默认 medium 3 / large 6）
 *
 * 部署：
 *   1) 工具 → 脚本 → + ：名称 nebula-power，类型 generic，本地文件 nebula-power.js
 *   2) 分析 → 小组件画廊 → + ：名称「星云电力」，脚本选 nebula-power
 *   3) 主屏/锁屏长按 → + → Egern → 选尺寸 → 编辑小组件 → 选「星云电力」
 */

const MODELS_API = 'https://ai.ipix.ink/guest/models';
const USAGE_API = 'https://ai.ipix.ink/user/usage';
const CNY_PER_POWER = 0.01; // 兜底单价；实际以接口 rmb_rate 为准

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

/* ============================ HTTP 垫片（多运行时兼容） ============================ */

function pickGetter(ctx, method) {
  const c = [
    ctx && ctx.http,
    typeof globalThis.$httpClient !== 'undefined' ? globalThis.$httpClient : null,
    typeof globalThis.$http !== 'undefined' ? globalThis.$http : null,
  ];
  for (const o of c) {
    if (o && typeof o[method] === 'function') return o[method].bind(o);
  }
  return null;
}

/** 回调式 / Promise 式 / fetch 式三种运行时统一成一个 async 请求 */
function httpRequest(ctx, opts) {
  const headers = Object.assign({ 'User-Agent': 'Egern/nebula-power' }, opts.headers || {});
  const req = { url: opts.url, method: opts.method || 'GET', headers };
  if (opts.body != null) req.body = opts.body;

  const getter = pickGetter(ctx, (opts.method || 'GET').toLowerCase());
  if (getter) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (r) => { if (!settled) { settled = true; resolve(r); } };
      const fail = (e) => { if (!settled) { settled = true; reject(e instanceof Error ? e : new Error(String(e))); } };
      const cb = (err, resp, body) => {
        if (err) return fail(err);
        finish({ status: (resp && (resp.status || resp.statusCode)) || 0, text: bodyText(body) });
      };
      let timer = null;
      if (typeof setTimeout === 'function') timer = setTimeout(() => fail(new Error('请求超时')), 9000);
      try {
        const ret = getter(req, cb);
        if (ret && typeof ret.then === 'function') {
          ret.then((r) => finish({ status: (r && (r.status || r.statusCode)) || 0, text: bodyText(r && (r.body != null ? r.body : r)) }), fail);
        } else if (ret && (typeof ret.text === 'function' || typeof ret === 'string')) {
          Promise.resolve(ret).then(async (r) => {
            const t = typeof r === 'string' ? r : (typeof r.text === 'function' ? await r.text() : JSON.stringify(r));
            finish({ status: (r && r.status) || 0, text: t });
          }, fail);
        }
      } catch (e) { fail(e); return; }
      const clear = () => { if (timer) clearTimeout(timer); };
      Promise.resolve().then(clear);
    });
  }
  if (typeof fetch === 'function') {
    return fetch(opts.url, { method: req.method, headers, body: opts.body })
      .then(async (r) => ({ status: r.status, text: await r.text() }));
  }
  return Promise.reject(new Error('当前运行时不提供 HTTP 接口'));
}

function bodyText(b) {
  if (b == null) return '';
  if (typeof b === 'string') return b;
  if (typeof b.text === 'string') return b.text;
  if (typeof b.body === 'string') return b.body;
  try { return JSON.stringify(b); } catch (_) { return ''; }
}

/* ============================ 取数 ============================ */

/** 公开补贴数据：返回 { rows, rate, best, activeCount, total } */
async function loadSubsidy(ctx, now) {
  const res = await httpRequest(ctx, {
    url: MODELS_API, method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'public' }),
  });
  const json = JSON.parse(res.text);
  const list = json.data || json.models || [];
  const rate = typeof json.rmb_rate === 'number' && json.rmb_rate > 0 ? json.rmb_rate : CNY_PER_POWER;

  const rows = [];
  for (const m of list) {
    const q = quotaState(m);
    const timeOk = subsidyActive(m, now);
    const active = timeOk && !q.depleted;
    const price = effPrice(m, active);
    rows.push({
      m, q, timeOk, active, price,
      hasSubsidy: m.discount_price != null,
      depth: depth(m),
      eff: price,
    });
  }
  // 排序：有效电价升序 → 补贴力度降序 → 名称
  rows.sort((a, b) => (a.eff - b.eff) || (b.depth - a.depth) || String(a.m.display_name).localeCompare(String(b.m.display_name)));
  const subsidised = rows.filter((r) => r.hasSubsidy);
  const activeRows = subsidised.filter((r) => r.active);
  const best = rows[0] || null;
  const deepest = subsidised.slice().sort((a, b) => b.depth - a.depth)[0] || null;
  return { rows, subsidised, activeRows, deepest, best, rate, total: rows.length };
}

/** 私有数据（可选）：塞入会话 Cookie 后读你自己的余额 / 电力包 */
async function loadUsage(ctx, cookie) {
  if (!cookie) return null;
  try {
    const res = await httpRequest(ctx, { url: USAGE_API, headers: { Cookie: cookie, Accept: 'application/json' } });
    if (!res || !res.text) return null;
    const j = JSON.parse(res.text);
    const u = j.usage || j;
    return {
      remaining: Number(u.packs_remaining || 0),
      packCount: Number(u.active_packs_count || 0),
      balance: Number(u.balance || 0),
      balancePay: !!u.balance_pay_enabled,
    };
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

/** 补贴/价格一行（中尺寸：名 + 价 + 力度；大尺寸再加时段与额度） */
function rowLine(r, wide) {
  const m = r.m;
  const priceColor = r.active ? C.gold : C.tertiary;
  const kids = [
    T(m.display_name, { font: { size: 'footnote', weight: 'semibold' }, textColor: r.active ? C.primary : C.secondary, lineLimit: 1, minScale: 0.7 }),
    { type: 'spacer' },
  ];
  if (wide) {
    kids.push(T(windowLabel(m) || '全天', { font: { size: 'caption2' }, textColor: C.tertiary, lineLimit: 1 }));
  }
  kids.push(T(`⚡${fmtPower(r.eff)}`, { font: { size: 'footnote', weight: 'heavy' }, textColor: priceColor, lineLimit: 1 }));
  kids.push(T(`-${pct(r.depth)}%`, { font: { size: 'caption2', weight: 'semibold' }, textColor: r.active ? C.accent : C.tertiary, lineLimit: 1 }));
  if (wide) {
    const qt = r.q.unlimited ? '∞' : (r.q.depleted ? '已耗尽' : '剩' + fmtPower(r.q.left));
    kids.push(T(qt, { font: { size: 'caption2' }, textColor: r.q.depleted ? C.warn : C.tertiary, lineLimit: 1 }));
  }
  return { type: 'stack', direction: 'row', alignItems: 'center', gap: 5, children: kids };
}

function subsidyRowList(data, limit, wide) {
  const list = data.activeRows.length ? data.activeRows : data.subsidised.filter((r) => !r.q.depleted);
  const picked = (list.length ? list : data.subsidised).slice(0, limit);
  return picked.map((r) => rowLine(r, wide));
}

/* ============================ 入口 ============================ */

export default async function (ctx) {
  ctx = ctx || {};
  const env = ctx.env || {};
  const fam = ctx.widgetFamily || 'systemSmall';
  const now = bjNow();

  let data = null, usage = null, err = null;
  try { data = await loadSubsidy(ctx, now); } catch (e) { err = e && e.message ? e.message : String(e); }
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

  const best = data.best;
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
  const topN = Number(env.NEBULA_TOP || 0) || (isLarge ? 6 : 3);

  const children = [header(activeN ? `补贴中 ${activeN}` : (subN ? `补贴 ${subN} 档待启` : '无补贴'))];

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
    children.push(...subsidyRowList(data, topN, wide));
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
  effPrice, depth, windowLabel, nextWindow, fmtPower, fmtCny, loadSubsidy, httpRequest,
};
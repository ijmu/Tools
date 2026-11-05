/**
 * 看多标的 · Egern 小组件
 * 数据源：gp.xsian.top「资本家持股分析平台」
 * 展示：标签含「极力推荐 / 强烈看多 / 重仓绩优」的个股 —— 名称 / 代码 / 现价 / 当日涨幅
 *
 * 模块参数（Egern 模块设置页三个输入框）：
 *   GP_SITE  网站地址，站点换域名时改这里，默认 https://gp.xsian.top
 *   GP_USER  账号
 *   GP_PASS  密码
 * 可选参数：
 *   GP_SORT  pct(默认，按当日涨幅降序) | date(推荐日期新→旧) | pnl(累计收益率降序)
 *   GP_MAX   最多显示几只，留空按尺寸自适应
 */

const NS = 'gp-bullish:v1:';
const DEFAULT_SITE = 'https://gp.xsian.top';
const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const PAGE_SIZE = 300;
const ROWS = { small: 8, medium: 6, large: 17 };

// ─── 颜色（light / dark 动态色） ───
const dyn = (light, dark) => ({ light, dark });
const C = {
  ink: dyn('#132C42', '#F1F6FC'),
  sub: dyn('#5C6E82', '#A6B6CA'),
  dim: dyn('#8496A8', '#7C8FA6'),
  line: dyn('#E2E9F2', '#243347'),
  panel: dyn('#FFFFFF', '#182338'),
  gold: dyn('#B07808', '#FFD166'),
  goldBg: dyn('#FFF2D2', '#41320E'),
  red: dyn('#D03A3A', '#FF8B72'),
  redBg: dyn('#FFE7E2', '#42201B'),
  green: dyn('#12885A', '#5CD69B'),
  purple: dyn('#6B4FC0', '#B49BFF'),
  purpleBg: dyn('#EDE7FF', '#2C2350'),
  glass: dyn('#FFFFFFB8', '#FFFFFF14'),
};

function bg() {
  return {
    type: 'linear',
    colors: [dyn('#FFFFFF', '#0F1A2E'), dyn('#F1F5FB', '#0B1425'), dyn('#E6EDF7', '#07101D')],
    stops: [0, 0.52, 1],
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 1, y: 1 },
  };
}

function refreshAfter() {
  const now = new Date();
  const day = now.getDay();
  const hm = now.getHours() * 60 + now.getMinutes();
  const trading = day >= 1 && day <= 5 && hm >= 555 && hm <= 925; // 9:15 ~ 15:25
  return new Date(now.getTime() + (trading ? 5 : 30) * 60 * 1000).toISOString();
}

// ─── DSL helpers ───
function T(text, o) {
  o = o || {};
  const font = { size: o.size == null ? 11 : o.size };
  if (o.weight) font.weight = o.weight;
  if (o.mono) font.family = 'Menlo';
  const n = { type: 'text', text: String(text == null ? '' : text), font, maxLines: o.lines == null ? 1 : o.lines };
  if (o.color) n.textColor = o.color;
  if (o.min != null) n.minScale = o.min;
  if (o.w != null) n.width = o.w;
  if (o.align) n.textAlign = o.align;
  return n;
}

function S(children, o) {
  o = o || {};
  const n = { type: 'stack', direction: o.dir || 'row', children: children.filter(Boolean) };
  if (o.gap != null) n.gap = o.gap;
  if (o.pad) n.padding = o.pad;
  if (o.bg) n.backgroundColor = o.bg;
  if (o.radius != null) n.borderRadius = o.radius;
  if (o.align) n.alignItems = o.align;
  if (o.w != null) n.width = o.w;
  if (o.h != null) n.height = o.h;
  if (o.flex != null) n.flex = o.flex;
  return n;
}

const SP = (len) => (len == null ? { type: 'spacer' } : { type: 'spacer', length: len });

function chip(label, fg, bgColor) {
  return S([T(label, { size: 8, weight: 'bold', color: fg })], {
    pad: [1, 3, 1, 3],
    bg: bgColor,
    radius: 3,
    align: 'center',
  });
}

function symbol(name, size, color) {
  const n = { type: 'image', src: 'sf-symbol:' + name, width: size, height: size };
  if (color) n.color = color;
  return n;
}
// ─── 配置读取 ───
function readEnv(ctx) {
  const e = (ctx && ctx.env) || {};
  const pick = (...keys) => {
    for (const k of keys) {
      const v = e[k];
      if (v != null && String(v).trim() && !String(v).includes('{{')) return String(v).trim();
    }
    return '';
  };
  let site = pick('GP_SITE', 'SITE', 'gp_site') || DEFAULT_SITE;
  site = site.replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(site)) site = 'https://' + site;
  return {
    site,
    user: pick('GP_USER', 'USERNAME', 'USER', 'gp_user'),
    pass: pick('GP_PASS', 'PASSWORD', 'PASS', 'gp_pass'),
    sort: (pick('GP_SORT') || 'date').toLowerCase(),
    max: parseInt(pick('GP_MAX'), 10),
    days: (() => {
      const v = parseInt(pick('GP_DAYS'), 10);
      return isNaN(v) ? 7 : v; // 0 = 不过滤
    })(),
  };
}

function storeGet(ctx, key) {
  try {
    const v = ctx && ctx.storage ? ctx.storage.get(NS + key) : null;
    return v == null ? null : v;
  } catch (e) {
    return null;
  }
}

function storeSet(ctx, key, val) {
  try {
    if (ctx && ctx.storage) ctx.storage.set(NS + key, val);
  } catch (e) {}
}

// ─── HTTP ───
function headers(cfg, extra) {
  return Object.assign(
    {
      'User-Agent': UA,
      Referer: cfg.site + '/',
      Origin: cfg.site,
      Accept: 'application/json, text/plain, */*',
    },
    extra || {}
  );
}

function toForm(obj) {
  const parts = [];
  for (const k of Object.keys(obj)) {
    parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(obj[k] == null ? '' : obj[k]));
  }
  return parts.join('&');
}

// mode: 'json' = 预序列化字符串 | 'obj' = 直接把对象交给宿主序列化 | 'form' = 表单编码
async function httpJson(ctx, cfg, path, opts) {
  opts = opts || {};
  const url = cfg.site + path;
  const h = headers(cfg, opts.headers);
  const mode = opts.mode || 'json';
  let resp;
  if (opts.body != null) {
    h['Content-Type'] = mode === 'form' ? 'application/x-www-form-urlencoded' : 'application/json';
    const req = { headers: h, timeout: opts.timeout || 20000 };
    if (mode === 'obj') req.body = opts.body;
    else if (mode === 'form') req.body = toForm(opts.body);
    else req.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
    resp = await ctx.http.post(url, req);
  } else {
    resp = await ctx.http.get(url, { headers: h, timeout: opts.timeout || 20000 });
  }
  const status = resp && resp.status;
  let text = '';
  try {
    text = await resp.text();
  } catch (e) {}
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {}
  const msg = (json && (json.message || json.msg)) || String(text || '').trim().slice(0, 70);
  const err = new Error((status ? 'HTTP ' + status + ' @ ' + path : '@ ' + path) + (msg ? ' · ' + msg : ''));
  err.status = status;
  err.authDead = status === 401 || status === 403;
  err.format = status === 400;
  if (!resp || !status || status >= 400) throw err;
  if (!json) throw new Error(path + ' 未返回 JSON · ' + String(text).slice(0, 70));
  return json;
}

// 登录：成功拿 token；若服务端要求「原设备确认」则轮询
// 宿主把 POST body 丢掉时会拿到 400「无效的请求格式」，所以换三种 body 形态各试一次
async function login(ctx, cfg) {
  if (!cfg.user || !cfg.pass) throw new Error('模块设置里缺少账号或密码');
  const payload = { username: cfg.user, password: cfg.pass, public_ip: storeGet(ctx, 'ip') || '' };
  const modes = ['json', 'obj', 'form'];
  let lastErr = null;
  for (let i = 0; i < modes.length; i++) {
    const mode = modes[i];
    try {
      const j = await httpJson(ctx, cfg, '/api/login', { body: payload, mode });
      return await adoptLogin(ctx, cfg, j, mode);
    } catch (e) {
      if (e.status !== 400) throw e;
      lastErr = e;
    }
  }
  throw lastErr || new Error('登录失败');
}

async function adoptLogin(ctx, cfg, j, mode) {
  if (j.success && j.token) {
    storeSet(ctx, 'token', j.token);
    storeSet(ctx, 'token_at', String(Date.now()));
    storeSet(ctx, 'login_mode', mode);
    return j.token;
  }
  if (j.pending && j.req_id) {
    // 另一端（网页/已登录设备）需要在 60 秒内点「允许」
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 2500));
      const s = await httpJson(ctx, cfg, '/api/login_status?req_id=' + encodeURIComponent(j.req_id));
      if (s && s.success && s.token) {
        storeSet(ctx, 'token', s.token);
        storeSet(ctx, 'token_at', String(Date.now()));
        return s.token;
      }
    }
    throw new Error('需在网页端点「允许」新设备登录');
  }
  throw new Error(j.message || '账号或密码错误');
}

async function ensureToken(ctx, cfg, force) {
  if (!force) {
    const t = storeGet(ctx, 'token');
    if (t) return t;
  }
  return login(ctx, cfg);
}// ─── 数据层：拉取 / 打标 / 排序 ───
function isTrue(v) {
  return v === 1 || v === true || v === '1' || v === 'true';
}

function tagsOf(it) {
  return {
    quality: isTrue(it.IS_QUALITY_PICK), // 极力推荐
    strong: it.SIGNAL_LEVEL === '强烈看多', // 强烈看多
    heavy: isTrue(it.IS_HEAVY_QUALITY), // 重仓绩优
  };
}

async function fetchHoldings(ctx, cfg, token, kind) {
  const q =
    kind === 'bullish' ? 'onlyBullish=1&onlyHeavyQuality=0' : 'onlyHeavyQuality=1&onlyBullish=0';
  const path =
    '/api/holdings?page=1&pageSize=' +
    PAGE_SIZE +
    '&tab=all&search=&timeFilter=latest&sortCol=NOTICE_DATE&sortOrder=desc&filters=%7B%7D&' +
    q;
  const j = await httpJson(ctx, cfg, path, { headers: { Authorization: 'Bearer ' + token } });
  return Array.isArray(j.items) ? j.items : [];
}

async function fetchRealtime(ctx, cfg, token, codes) {
  const out = {};
  for (let i = 0; i < codes.length; i += 60) {
    const batch = codes.slice(i, i + 60);
    try {
      const j = await httpJson(ctx, cfg, '/api/realtime_price?codes=' + batch.join(','), {
        headers: { Authorization: 'Bearer ' + token },
        timeout: 15000,
      });
      const px = j.prices || {};
      for (const k of Object.keys(px)) out[k] = px[k];
    } catch (e) {
      // 单批失败不影响整体，改用持仓快照价
    }
  }
  return out;
}

function padCode(c) {
  return String(c == null ? '' : c).padStart(6, '0');
}

// 本地时区的「N 天前」日期串（YYYY-MM-DD）
function cutoffDate(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  const p = (n) => (n < 10 ? '0' + n : '' + n);
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function todayStr() {
  return cutoffDate(0);
}

function dateValue(s) {
  const t = Date.parse(String(s || '').slice(0, 10) + 'T00:00:00Z');
  return Number.isFinite(t) ? t : 0;
}

function buildList(items, quotes, cfg) {
  const map = new Map();
  const cut = cfg.days > 0 ? cutoffDate(cfg.days) : '';

  for (const it of items) {
    const code = padCode(it.SECURITY_CODE);
    const tags = tagsOf(it);
    if (!tags.quality && !tags.strong && !tags.heavy) continue;
    if (map.has(code)) continue;
    const notice = String(it.NOTICE_DATE || '').slice(0, 10);
    // 只留新鲜推荐的：日期早于截止日的直接丢；日期异常的（未来/空）保留并标 —
    if (cut && /^\d{4}-\d{2}-\d{2}$/.test(notice) && notice < cut) continue;
    const q = quotes[code] || {};
    const price = Number(q.price) > 0 ? Number(q.price) : Number(it.CURRENT_PRICE) || 0;
    const pct = q.change_pct == null || isNaN(Number(q.change_pct)) ? null : Number(q.change_pct);
    map.set(code, {
      name: String(it.SECURITY_NAME_ABBR || q.name || '').trim() || code,
      code,
      price,
      pct,
      pnl: Number(it.CURRENT_PNL_RATIO),
      cost: Number(it.REPORT_PRICE),
      chgRatio: it.CHANGE_RATIO_VAL == null || it.CHANGE_RATIO_VAL === '' ? null : Number(it.CHANGE_RATIO_VAL),
      chgType: String(it.CHANGE_TYPE || '').trim(),
      industry: String(it.INDUSTRY || '').trim(),
      notice,
      tags,
    });
  }
  const list = Array.from(map.values());
  const sort = cfg.sort || 'pct';
  list.sort((a, b) => {
    if (sort === 'date') {
      const d = dateValue(b.notice) - dateValue(a.notice);
      if (d) return d;
      return (b.pct == null ? -999 : b.pct) - (a.pct == null ? -999 : a.pct);
    }
    if (sort === 'pnl') {
      const p = (isNaN(b.pnl) ? -9999 : b.pnl) - (isNaN(a.pnl) ? -9999 : a.pnl);
      if (p) return p;
    }
    return (b.pct == null ? -999 : b.pct) - (a.pct == null ? -999 : a.pct);
  });
  return list;
}

// 拉一轮完整数据（含一次 401 重登）
async function loadData(ctx, cfg) {
  let token = await ensureToken(ctx, cfg, false);
  let items, quotes;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const bull = await fetchHoldings(ctx, cfg, token, 'bullish');
      const heavy = await fetchHoldings(ctx, cfg, token, 'heavy');
      items = bull.concat(heavy);
      const codes = Array.from(new Set(items.map((x) => padCode(x.SECURITY_CODE))));
      quotes = await fetchRealtime(ctx, cfg, token, codes);
      break;
    } catch (e) {
      if (e.authDead && attempt === 0) {
        token = await ensureToken(ctx, cfg, true);
        continue;
      }
      throw e;
    }
  }
  const list = buildList(items, quotes, cfg);
  if (!list.length) throw new Error(cfg.days > 0 ? '近 ' + cfg.days + ' 天没有新推荐的标的' : '三个标签当前都没有标的');
  const ck = 'cache:' + cfg.site + ':' + cfg.days;
  storeSet(ctx, ck, JSON.stringify({ at: Date.now(), total: list.length, list: list.slice(0, 60) }));
  return { list, total: list.length, at: Date.now(), stale: false };
}

// 缓存只在拉取失败时兜底：按站点隔离（换网址不串数据），且超过 3 小时视为过期不用
const CACHE_TTL = 3 * 60 * 60 * 1000;

function cachedData(ctx, cfg) {
  const raw = storeGet(ctx, 'cache:' + cfg.site + ':' + cfg.days);
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    if (!d || !Array.isArray(d.list) || !d.list.length) return null;
    if (Date.now() - (d.at || 0) > CACHE_TTL) return null;
    return { list: d.list, total: d.total || d.list.length, at: d.at || 0, stale: true };
  } catch (e) {
    return null;
  }
}// ─── 渲染层 ───
function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

function clockOf(ms) {
  const d = new Date(ms);
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

function fmtPrice(v) {
  const n = Number(v);
  if (!(n > 0)) return '—';
  return n >= 1000 ? n.toFixed(0) : n.toFixed(2);
}

function fmtPct(v) {
  if (v == null || isNaN(v)) return '—';
  const n = Number(v);
  return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
}

function fmtPnl(v) {
  if (v == null || isNaN(v)) return '—';
  const n = Number(v);
  return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
}

function pctColor(v) {
  if (v == null || isNaN(v) || Math.abs(Number(v)) < 0.005) return C.dim;
  return Number(v) > 0 ? C.red : C.green;
}

function tagChips(tags, size) {
  const arr = [];
  if (tags.quality) arr.push(chip('荐', C.gold, C.goldBg));
  if (tags.strong) arr.push(chip('多', C.red, C.redBg));
  if (tags.heavy) arr.push(chip('绩', C.purple, C.purpleBg));
  if (!arr.length) return null;
  return S(arr, { gap: 2, align: 'center' });
}

function fmtCost(v) {
  return v > 0 ? v.toFixed(2) : '—';
}

function fmtChg(it) {
  if (it.chgRatio == null || isNaN(it.chgRatio)) return it.chgType || '—';
  const n = it.chgRatio;
  return (it.chgType ? it.chgType + ' ' : '') + (n > 0 ? '+' : '') + n.toFixed(2) + '%';
}

// 副行：成本价 / 收益率 / 调仓变动（各自按涨跌着色）
function metaNodes(it, size, withNotice) {
  const out = [];
  if (it.cost > 0) out.push(T('成本 ' + fmtCost(it.cost), { size: size, color: C.dim, mono: true }));
  if (!isNaN(it.pnl)) out.push(T('收益 ' + fmtPnl(it.pnl), { size: size, weight: 'semibold', color: pctColor(it.pnl) }));
  const chg = fmtChg(it);
  if (chg !== '—') {
    // 幅度站点未下发（普通账号 CHANGE_RATIO_VAL 全为 null），按方向着色：增持/新进=红，减持=绿
    const chgColor =
      it.chgRatio != null && !isNaN(it.chgRatio)
        ? pctColor(it.chgRatio)
        : it.chgType === '减持'
        ? C.green
        : it.chgType
        ? C.red
        : C.dim;
    out.push(T('调仓 ' + chg, { size: size, weight: 'semibold', color: chgColor, min: 0.75 }));
  }
  return out;
}

// 单只条目：dual = 主行 + 副行（推荐日期/行业/累计收益率），用于标的很少时把版面撑起来
function stockEntry(it, size, dual) {
  const color = pctColor(it.pct);
  if (size === 'small') {
    if (!dual) return stockRow(it, true);
    return S(
      [
        S(
          [
            T(it.name, { size: 9.5, weight: 'semibold', color: C.ink, min: 0.7 }),
            T(it.code, { size: 7, color: C.dim, mono: true }),
            SP(),
            T(fmtPrice(it.price), { size: 9.5, weight: 'semibold', color: C.ink, mono: true, w: 34, align: 'right' }),
          ],
          { gap: 3, align: 'center' }
        ),
        S([T(fmtPct(it.pct), { size: 9.5, weight: 'semibold', color: color, mono: true, w: 40, align: 'right' }), SP()].concat(
          metaNodes(it, 7.5, false)
        ), { gap: 3, align: 'center' }),
      ],
      { dir: 'column', gap: 2 }
    );
  }
  if (!dual) return stockRow(it, false);
  return S(
    [
      S(
        [
          tagChips(it.tags),
          T(it.name, { size: 11.5, weight: 'semibold', color: C.ink, min: 0.8 }),
          T(it.code, { size: 8, color: C.dim, mono: true }),
          SP(),
          T(fmtPrice(it.price), { size: 11.5, weight: 'semibold', color: C.ink, mono: true, w: 46, align: 'right' }),
        ],
        { gap: 3, align: 'center' }
      ),
      S(
        [T(fmtPct(it.pct), { size: 11.5, weight: 'semibold', color: color, mono: true, w: 50, align: 'right' }), SP()].concat(
          metaNodes(it, 9, true)
        ),
        { gap: 4, align: 'center' }
      ),
    ],
    { dir: 'column', gap: 1 }
  );
}

function stockRow(it, compact) {
  const color = pctColor(it.pct);
  if (compact) {
    return S(
      [
        T(it.name, { size: 9.5, weight: 'semibold', color: C.ink, min: 0.7 }),
        T(it.code, { size: 7.5, color: C.dim, mono: true }),
        SP(),
        T(fmtPrice(it.price), { size: 9.5, weight: 'semibold', color: C.ink, mono: true, w: 36, align: 'right' }),
        T(fmtPct(it.pct), { size: 9.5, weight: 'semibold', color: color, mono: true, w: 41, align: 'right' }),
      ],
      { gap: 3, align: 'center' }
    );
  }
  return S(
    [
      tagChips(it.tags),
      T(it.name, { size: 11.5, weight: 'semibold', color: C.ink, min: 0.8 }),
      SP(2),
      T(it.code, { size: 8, color: C.dim, mono: true }),
      SP(),
      T(fmtPrice(it.price), { size: 11.5, weight: 'semibold', color: C.ink, mono: true, w: 46, align: 'right' }),
      T(fmtPct(it.pct), { size: 11.5, weight: 'semibold', color: color, mono: true, w: 50, align: 'right' }),
    ],
    { gap: 3, align: 'center' }
  );
}

// 大尺寸专用：每只一张玻璃卡，两行（主行 + 推荐日期/行业/累计收益率）
function stockCard(it, three) {
  const color = pctColor(it.pct);
  const main = S(
    [
      tagChips(it.tags),
      T(it.name, { size: 15, weight: 'semibold', color: C.ink, min: 0.8 }),
      T(it.code, { size: 9.5, color: C.dim, mono: true }),
      SP(),
      T(fmtPrice(it.price), { size: 15, weight: 'semibold', color: C.ink, mono: true }),
      T(fmtPct(it.pct), { size: 14, weight: 'semibold', color: color, mono: true }),
    ],
    { gap: 5, align: 'center' }
  );
  if (!three) {
    const right = [];
    if (it.notice) right.push(T('推荐 ' + it.notice.slice(5), { size: 9.5, color: C.dim }));
    if (it.industry) right.push(T('· ' + it.industry, { size: 9.5, color: C.dim, min: 0.7 }));
    const meta = metaNodes(it, 9.5, true).concat([SP()], right);
    return S([main, S([SP()].concat(meta), { gap: 5, align: 'center' })], {
      dir: 'column',
      gap: 5,
      pad: [10, 12, 10, 12],
      bg: C.glass,
      radius: 12,
    });
  }
  // 三行卡：主行 / 成本·收益·调仓 / 推荐日期·行业
  const foot = [];
  if (it.notice) foot.push(T('推荐 ' + it.notice.slice(5), { size: 9, color: C.dim }));
  if (it.industry) foot.push(T('· ' + it.industry, { size: 9, color: C.dim, min: 0.7 }));
  return S(
    [main, S(metaNodes(it, 10, true), { gap: 10, align: 'center' }), S(foot, { gap: 3, align: 'center' })],
    { dir: 'column', gap: 5, pad: [10, 12, 10, 12], bg: C.glass, radius: 12 }
  );
}

function legend(size) {
  const sz = 8;
  const item = (label, name, fg, bgc) =>
    S([chip(label, fg, bgc), T(name, { size: sz, color: C.dim })], { gap: 2, align: 'center' });
  return S(
    [
      item('荐', '极力推荐', C.gold, C.goldBg),
      SP(10),
      item('多', '强烈看多', C.red, C.redBg),
      SP(10),
      item('绩', '重仓绩优', C.purple, C.purpleBg),
    ],
    { align: 'center', gap: 0 }
  );
}

function header(list, data, cfg) {
  const n = data.total || list.length;
  const count = (cfg.days > 0 ? '近' + cfg.days + '天 ' : '') + n + ' 只' + (data.stale ? ' · 缓存' : '');
  return S(
    [
      symbol('chart.line.uptrend.xyaxis', 12, C.gold),
      T('看多标的', { size: 13.5, weight: 'bold', color: C.ink }),
      SP(),
      T(count, { size: 9, color: data.stale ? C.gold : C.sub, min: 0.8 }),
      SP(5),
      T(data.stale ? clockOf(data.at) : clockOf(data.at), { size: 9, color: C.dim, mono: true }),
    ],
    { gap: 5, align: 'center' }
  );
}

function widgetRoot(children, bottomPad) {
  return {
    type: 'widget',
    padding: [4, 12, 4, 12], // 上下留白一致：图例贴底、头部也贴顶
    gap: 3,
    backgroundGradient: bg(),
    refreshAfter: refreshAfter(),
    children,
  };
}

// 行数少时把行距撑开，避免大片留白；行数多时保持紧凑
function rowGapFor(size, n, rowH, hasLegend) {
  const H = size === 'large' ? 382 : 170;
  const fixed = 8 + 16.5 + 12 + (hasLegend ? 12.6 : 0); // padding + 头部 + widget 间隙 + 图例
  if (n <= 1) return 3;
  const g = Math.floor((H - fixed - n * rowH) / (n - 1));
  return Math.max(3, Math.min(8, g));
}

function buildWidget(data, size, cfg) {
  const limit = cfg.max > 0 ? cfg.max : ROWS[size] || ROWS.medium;
  const list = data.list.slice(0, limit);
  const hasLegend = size !== 'small';
  const useCards = size === 'large' && list.length <= 5;
  const dual = (size === 'small' || size === 'medium') && list.length <= 3;
  let body;
// 标的按正常间距紧凑排列，位置不被拉伸
  if (useCards) {
    const three = list.length <= 4;
    body = S(list.map((it) => stockCard(it, three)), { dir: 'column', gap: 10 });
  } else {
    const rowH = dual ? (size === 'small' ? 29 : 32.5) : 14.5;
    const gap = rowGapFor(size, list.length, rowH, hasLegend);
    body = S(list.map((it) => stockEntry(it, size, dual)), { dir: 'column', gap: gap });
  }
  // 头部 → 标的列表 → （弹性留白）→ 图例，图例固定左下角
  const children = [header(list, data, cfg), body, SP()];
  if (hasLegend) children.push(legend(size));
  return widgetRoot(children, 4);
}

function buildMessage(title, msg, hint) {
  const children = [
    S(
      [
        symbol('exclamationmark.triangle.fill', 11, C.gold),
        T(title, { size: 12.5, weight: 'semibold', color: C.ink }),
      ],
      { gap: 4, align: 'center' }
    ),
    SP(2),
    T(msg || '未知错误', { size: 10, color: C.sub, lines: 4 }),
  ];
  if (hint) {
    children.push(SP(2));
    children.push(T(hint, { size: 8.5, color: C.dim, lines: 3 }));
  }
  return widgetRoot(children, 12);
}

// ─── 入口 ───
export default async function (ctx) {
  const family = String((ctx && ctx.widgetFamily) || 'systemMedium');
  const size = /small/i.test(family) ? 'small' : /large/i.test(family) ? 'large' : 'medium';
  const cfg = readEnv(ctx);
  try {
    if (!cfg.user || !cfg.pass) {
      return buildMessage('未配置账号', '请在 Egern 模块设置里填写 网站 / 账号 / 密码。', '默认站点 ' + cfg.site);
    }
    const data = await loadData(ctx, cfg);
    return buildWidget(data, size, cfg);
  } catch (e) {
    const cached = cachedData(ctx, cfg);
    if (cached) return buildWidget(cached, size, cfg);
    return buildMessage('拿不到数据', (e && (e.message || String(e))) || '网络异常', '模块设置：' + cfg.site + ' · 账号 ' + (cfg.user || '未填'));
  }
}
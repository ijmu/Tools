// Surge 面板脚本本地仿真测试台
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');           // 仓库根
const SRC = (p) => path.join(ROOT, p);

// 用法: node Surge/Scripts/tests/simulate-panel.js xiaoliuren-panel.js
//       node Surge/Scripts/tests/simulate-panel.js nebula-power-panel.js
// 用假 $httpClient/$persistentStore/$argument 在 Node 里执行脚本，打印 $done() 产出。
// 星云接口使用本地 fixture，测试不依赖第三方网络。

const STORE = {};                      // 模拟 $persistentStore
const FIXTURE = {
  rmb_rate: 0.01,
  data: [
    { id: 'alpha', display_name: 'Alpha-2-Pro', price: 2, discount_price: 1, discount_daily_start: '00:00', discount_daily_end: '23:59', discount_quota: 100, discount_used: 20, context_limit: 2000000, description: '旗舰模型' },
    { id: 'beta', display_name: 'Beta-1-Flash', price: 1, discount_price: 0.5, discount_daily_start: '12:00', discount_daily_end: '13:00', discount_quota: 10, discount_used: 10, context_limit: 100000, description: '高速轻量模型' },
    { id: 'gamma', display_name: 'Gamma-1', price: 3, context_limit: 100000, description: '标准模型' },
  ],
};
let MODE = 'live';                     // live | fail
let FIXED = null;                      // 固定时间（ms）

function makeCtx(arg) {
  const ctx = {
    $argument: arg,
    $persistentStore: {
      read: (k) => (k in STORE ? STORE[k] : null),
      write: (v, k) => { STORE[k] = v; return true; },
    },
    $httpClient: {
      post: (o, cb) => call('POST', o, cb),
      get: (o, cb) => call('GET', o, cb),
    },
    console,
    setTimeout, clearTimeout,
  };
  if (FIXED != null) {
    const R = Date;
    function F(...a) { return a.length ? new R(...a) : new R(FIXED); }
    F.now = () => FIXED; F.UTC = R.UTC; F.parse = R.parse; F.prototype = R.prototype;
    ctx.Date = F;
  }
  vm.createContext(ctx);
  return ctx;
}

async function call(method, o, cb) {
  const url = typeof o === 'string' ? o : o.url;
  const opts = typeof o === 'string' ? {} : o;
  if (MODE === 'fail') { cb('连接被拒绝（模拟断网）', null, null); return; }
  try {
    if (url.includes('/guest/models')) {
      cb(null, { status: 200 }, JSON.stringify(FIXTURE));
      return;
    }
    if (url.includes('/user/usage')) {
      cb(null, { status: 200 }, JSON.stringify({ packs_remaining: 1234, active_packs_count: 2, balance: 5.5 }));
      return;
    }
    if (url.includes('/user/leaderboard')) {
      cb(null, { status: 200 }, JSON.stringify({ models: [{ model: 'alpha', tokens: 900 }] }));
      return;
    }
    cb('未知测试 URL', null, null);
  } catch (e) { cb(String(e && e.message || e), null, null); }
}

function run(file, arg) {
  const ctx = makeCtx(arg);
  return new Promise((resolve) => {
    ctx.$done = (o) => resolve(o);
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
    setTimeout(() => resolve({ timeout: true }), 15000);
  });
}

const which = process.argv[2];
const file = SRC('Surge/Scripts/' + which);

(async () => {
  if (which === 'xiaoliuren-panel.js') {
    for (const iso of ['2026-10-02T14:23:00', '2026-10-02T23:30:00', '2026-01-01T00:05:00']) {
      FIXED = new Date(iso + '+08:00').getTime();
      const r = await run(file, 'zi=1,ju=1,ic=1');
      console.log('\n===== ' + iso + ' (+08) =====');
      console.log('title  :', r.title);
      console.log('icon   :', r.icon, r['icon-color'], '| style:', r.style);
      console.log('content:\n' + r.content);
    }
    // 关掉断句全诗
    FIXED = new Date('2026-10-02T14:23:00+08:00').getTime();
    const r2 = await run(file, 'zi=0,ju=0,ic=1');
    console.log('\n===== zi=0 ju=0 =====');
    console.log('icon   :', r2.icon, r2['icon-color']);
    console.log('content:\n' + r2.content);
    // ic=0 回退到系统 style
    const r3 = await run(file, 'zi=1,ju=1,ic=0');
    console.log('\n===== zi=1 ju=1 ic=0（系统图标回退）=====');
    console.log('icon   :', r3.icon, '| style:', r3.style);
  } else if (which === 'weather-yiji-panel.js') {
    console.log('天气面板使用中国天气网公开接口，建议在 Surge 真机中验证城市搜索和天气字段。');
    process.exit(0);
  } else if (which === 'holiday-countdown-panel.js') {
    for (const [iso, arg] of [
      ['2026-10-02T14:23:00', 'PER_ROW=2,LUNAR=1'],
      ['2026-10-02T14:23:00', 'SHOW_CN=0,SHOW_JIEQI=0,SHOW_INTL=1,PER_ROW=1'],
    ]) {
      FIXED = new Date(iso + '+08:00').getTime();
      const r = await run(file, arg);
      console.log('\\n===== ' + iso + ' (+08) ' + arg + ' =====');
      console.log('title  :', r.title, '| style:', r.style, '| icon:', r.icon);
      console.log('content:\\n' + r.content);
    }
  } else {
    console.log('--- 第 1 次：实时抓取 ---');
    const a = await run(file, 'sort=usage,top=6');
    console.log('title  :', a.title, '| style:', a.style);
    console.log(a.content);
    console.log('\n--- 第 2 次：模拟断网（应回放缓存）---');
    MODE = 'fail';
    const b = await run(file, 'sort=usage,top=6');
    console.log('title  :', b.title, '| style:', b.style);
    console.log(b.content);
    console.log('\n--- 第 3 次：冷启动 + 断网（清空缓存，应报错不崩）---');
    for (const k of Object.keys(STORE)) delete STORE[k];
    const c = await run(file, 'sort=price,top=3');
    console.log('title  :', c.title, '| style:', c.style);
    console.log(c.content);
    console.log('\n--- 第 4 次：恢复网络 + price 排序 top=3 ---');
    MODE = 'live';
    const d = await run(file, 'sort=price,top=3');
    console.log('title  :', d.title, '| style:', d.style);
    console.log(d.content);
  }
  process.exit(0);
})();
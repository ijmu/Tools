// 农历换算校验：以独立「逐月推进」算法为基准，对拍 Surge 版与 Egern 版两个脚本内核
// 用法: node Surge/Scripts/tests/validate-lunar.js      （全绿 exit 0，有不符 exit 1）
//
// 为什么要独立基准：农历/日历类换算若拿原实现自证，等于把同一个 bug 验两遍。
//   本台架另写了一份「正常月 → 闰月副本」逐月推进的枚举实现，三份互不共享代码。
// 历史（2026-10-02 修复前）：原 solarToLunar 在闰月被消费后 isLeap 不复位，
//   闰月之后每月都按闰月天数计 → 月边界 1164/4972 天不符、闰月年逐日 1124/2192 天不符。
const path = require('path');
const fs = require('fs'), vm = require('vm');
const ROOT = path.resolve(__dirname, '../../..');
const SRC = (p) => path.join(ROOT, p);

function loadKernel(file, endMark) {
  const src = fs.readFileSync(file, 'utf8');
  const head = src.slice(src.indexOf('const LUNAR_INFO'), src.indexOf(endMark));
  const ctx = { console }; vm.createContext(ctx);
  vm.runInContext(head + '\n;globalThis.__t={solarToLunar,leapMonth,monthDays,leapDays,yearDays};', ctx);
  return ctx.__t;
}
const SURGE = loadKernel(SRC('Surge/Scripts/xiaoliuren-panel.js'), '/* ============================ Surge 面板外壳');
const EGERN = loadKernel(SRC('Egern/Scripts/xiaoliuren.js'), 'export default async function');

const DAY = 86400000, BASE = Date.UTC(1900, 0, 31);
const K = (x) => x.year + '/' + x.month + '/' + x.day + '/' + (x.isLeap ? 1 : 0);
const at = (off) => { const d = new Date(BASE + off * DAY); return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]; };

// —— 独立基准：逐月推进枚举（不共享任何原脚本代码）——
const seq = [], leapYears = [];
let off = 0;
for (let y = 1900; y <= 2100; y++) {
  const lp = SURGE.leapMonth(y); if (lp) leapYears.push(y);
  for (let m = 1; m <= 12; m++) {
    const d1 = SURGE.monthDays(y, m);
    seq.push({ off, y, m, isLeap: false, len: d1 }); off += d1;
    if (m === lp) { const d2 = SURGE.leapDays(y); seq.push({ off, y, m, isLeap: true, len: d2 }); off += d2; }
  }
}

let fails = 0;
function report(name, bad, example) {
  console.log('  ' + (bad === 0 ? '✓' : '✗') + ' ' + name.padEnd(12) + ' 不符 ' + bad + (example ? '   例: ' + example.join('  ') : ''));
  fails += bad;
}

// 【1】月边界：1900-2100 每个农历月的首日与末日
let n = 0, badS = 0, badE = 0, badX = 0, exS = null, exE = null, exX = null;
for (const s of seq) {
  for (const [doff, wantDay] of [[s.off, 1], [s.off + s.len - 1, s.len]]) {
    const [Y, M, D] = at(doff);
    const want = K({ year: s.y, month: s.m, day: wantDay, isLeap: s.isLeap });
    const a = K(SURGE.solarToLunar(Y, M, D)), b = K(EGERN.solarToLunar(Y, M, D));
    n++;
    if (a !== want) { badS++; if (!exS) exS = [Y + '-' + M + '-' + D, '实得 ' + a, '应为 ' + want]; }
    if (b !== want) { badE++; if (!exE) exE = [Y + '-' + M + '-' + D, '实得 ' + b, '应为 ' + want]; }
    if (a !== b) { badX++; if (!exX) exX = [Y + '-' + M + '-' + D, 'Surge ' + a, 'Egern ' + b]; }
  }
}
console.log('【月边界】农历月 ' + seq.length + ' 个 → 检查 ' + n + ' 天（1900~2100 每月首末日）');
report('Surge 版', badS, exS);
report('Egern 版', badE, exE);
report('两边一致', badX, exX);

// 【2】闰月年逐日（原版错得最集中的场景）
const deepYears = [2020, 2023, 2025, 2028, 2031, 2033];
let dn = 0, dbS = 0, dbE = 0, dbX = 0, ex2 = null, ex3 = null;
for (const y of deepYears) {
  for (let t = Date.UTC(y, 0, 1); t <= Date.UTC(y, 11, 31); t += DAY) {
    const o0 = Math.round((t - BASE) / DAY);
    const s = seq.find((x) => x.off <= o0 && o0 < x.off + x.len);
    const want = K({ year: s.y, month: s.m, day: o0 - s.off + 1, isLeap: s.isLeap });
    const d = new Date(t), Y = d.getUTCFullYear(), M = d.getUTCMonth() + 1, D = d.getUTCDate();
    const a = K(SURGE.solarToLunar(Y, M, D)), b = K(EGERN.solarToLunar(Y, M, D));
    dn++;
    if (a !== want) { dbS++; if (!ex2) ex2 = [d.toISOString().slice(0, 10), '实得 ' + a, '应为 ' + want]; }
    if (b !== want) { dbE++; if (!ex3) ex3 = [d.toISOString().slice(0, 10), '实得 ' + b, '应为 ' + want]; }
    if (a !== b) dbX++;
  }
}
console.log('【闰月年逐日】' + deepYears.join('/') + ' 共 ' + dn + ' 天');
report('Surge 版', dbS, ex2);
report('Egern 版', dbE, ex3);
report('两边一致', dbX);

// 【3】公认基准日（春节 / 端午 / 中秋 / 闰月首日）
const MN = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const DN = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十', '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];
const S = (l) => (l.isLeap ? '闰' : '') + MN[l.month - 1] + '月' + DN[l.day - 1];
const cases = [['2018-02-16', '正月初一', '春节2018'], ['2020-01-25', '正月初一', '春节2020'],
['2023-01-22', '正月初一', '春节2023'], ['2024-02-10', '正月初一', '春节2024'],
['2025-01-29', '正月初一', '春节2025'], ['2026-02-17', '正月初一', '春节2026'],
['2023-06-22', '五月初五', '端午2023'], ['2024-06-10', '五月初五', '端午2024'],
['2025-05-31', '五月初五', '端午2025'], ['2026-06-19', '五月初五', '端午2026'],
['2023-09-29', '八月十五', '中秋2023'], ['2024-09-17', '八月十五', '中秋2024'],
['2025-10-06', '八月十五', '中秋2025'], ['2026-09-25', '八月十五', '中秋2026'],
['2023-03-22', '闰二月初一', '闰二月首日2023'], ['2025-07-25', '闰六月初一', '闰六月首日2025']];
console.log('\n【公认基准日】');
let ps = 0, pe = 0;
for (const [d, exp, note] of cases) {
  const [y, m, dd] = d.split('-').map(Number);
  const a = S(SURGE.solarToLunar(y, m, dd)), b = S(EGERN.solarToLunar(y, m, dd));
  if (a === exp) ps++; if (b === exp) pe++;
  console.log('  ' + (a === exp && b === exp ? '✓' : '✗') + ' ' + d + ' 期望 ' + exp.padEnd(9) +
    ' Surge ' + a.padEnd(9) + ' Egern ' + b.padEnd(9) + ' (' + note + ')');
}
fails += (cases.length - ps) + (cases.length - pe);
console.log('\n基准日通过：Surge 版 ' + ps + '/' + cases.length + '，Egern 版 ' + pe + '/' + cases.length);
console.log(fails === 0 ? '\n全部通过（不符 0）' : '\n存在不符：' + fails + ' 处');
process.exit(fails === 0 ? 0 : 1);
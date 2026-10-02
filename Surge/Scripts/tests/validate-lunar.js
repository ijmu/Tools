// 农历校验（快速版）：月边界全量 + 闰月年逐日；独立「逐月推进」算法为准
const fs = require('fs'), vm = require('vm');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');           // 仓库根
const SRC = (p) => path.join(ROOT, p);

// 用法: node Surge/Scripts/tests/validate-lunar.js
// 以独立「逐月推进」算法为基准，对拍 Surge 版（修复版）与 Egern 版（原版）
function loadKernel(src, endMark) {
  const head = src.slice(src.indexOf('const LUNAR_INFO'), src.indexOf(endMark));
  const ctx = { console }; vm.createContext(ctx);
  vm.runInContext(head + '\n;globalThis.__t={solarToLunar,leapMonth,monthDays,leapDays,yearDays};', ctx);
  return ctx.__t;
}
const FIXED = loadKernel(fs.readFileSync(SRC('Surge/Scripts/xiaoliuren-panel.js'), 'utf8'), '/* ============================ Surge 面板外壳');
const ORIG = loadKernel(fs.readFileSync(SRC('Egern/Scripts/xiaoliuren.js'), 'utf8'), 'export default async function');

const DAY = 86400000, BASE = Date.UTC(1900, 0, 31);
const K = (x) => x.year + '/' + x.month + '/' + x.day + '/' + (x.isLeap ? 1 : 0);
const at = (off) => { const d = new Date(BASE + off * DAY); return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]; };

// 独立实现：正常月 → 闰月副本 逐月推进
const seq = []; let off = 0, leapYears = [];
for (let y = 1900; y <= 2100; y++) {
  const lp = FIXED.leapMonth(y); if (lp) leapYears.push(y);
  for (let m = 1; m <= 12; m++) {
    const d1 = FIXED.monthDays(y, m);
    seq.push({ off, y, m, isLeap: false, len: d1 }); off += d1;
    if (m === lp) { const d2 = FIXED.leapDays(y); seq.push({ off, y, m, isLeap: true, len: d2 }); off += d2; }
  }
}

let n = 0, badF = 0, badO = 0, exF = null, exO = null;
for (const s of seq) {                       // 每个月：首日 + 末日
  for (const [doff, wantDay] of [[s.off, 1], [s.off + s.len - 1, s.len]]) {
    const [Y, M, D] = at(doff);
    const want = K({ year: s.y, month: s.m, day: wantDay, isLeap: s.isLeap });
    const f = K(FIXED.solarToLunar(Y, M, D)), o = K(ORIG.solarToLunar(Y, M, D));
    n++;
    if (f !== want) { badF++; if (!exF) exF = [Y + '-' + M + '-' + D, '实得 ' + f, '应为 ' + want]; }
    if (o !== want) { badO++; if (!exO) exO = [Y + '-' + M + '-' + D, '实得 ' + o, '应为 ' + want]; }
  }
}
console.log('【月边界】农历月共 ' + seq.length + ' 个 → 检查 ' + n + ' 天（1900~2100 每月首末日）');
console.log('  修复版 不符 ' + badF + (exF ? '  例: ' + exF.join('  ') : ''));
console.log('  原  版 不符 ' + badO + (exO ? '  例: ' + exO.join('  ') : ''));

// 闰月年逐日（原版错得最多的场景）
const deepYears = [2020, 2023, 2025, 2028, 2031, 2033];
let dn = 0, dbF = 0, dbO = 0, ex2 = null;
for (const y of deepYears) {
  for (let t = Date.UTC(y, 0, 1); t <= Date.UTC(y, 11, 31); t += DAY) {
    const o0 = Math.round((t - BASE) / DAY);
    const s = seq.find((x) => x.off <= o0 && o0 < x.off + x.len);
    const want = K({ year: s.y, month: s.m, day: o0 - s.off + 1, isLeap: s.isLeap });
    const d = new Date(t), f = K(FIXED.solarToLunar(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()));
    const o = K(ORIG.solarToLunar(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()));
    dn++; if (f !== want) dbF++; if (o !== want) { dbO++; if (!ex2) ex2 = [d.toISOString().slice(0, 10), '实得 ' + o, '应为 ' + want]; }
  }
}
console.log('【闰月年逐日】' + deepYears.join('/') + ' 共 ' + dn + ' 天');
console.log('  修复版 不符 ' + dbF);
console.log('  原  版 不符 ' + dbO + (ex2 ? '  例: ' + ex2.join('  ') : ''));

// 公认基准日
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
let pass = 0, passO = 0;
for (const [d, exp, note] of cases) {
  const [y, m, dd] = d.split('-').map(Number);
  const f = S(FIXED.solarToLunar(y, m, dd)), o = S(ORIG.solarToLunar(y, m, dd));
  if (f === exp) pass++; if (o === exp) passO++;
  console.log('  ' + (f === exp ? '✓' : '✗') + ' ' + d + ' 期望 ' + exp.padEnd(9) + ' 修复版 ' + f.padEnd(9) + ' 原版 ' + o.padEnd(9) + ' (' + note + ')');
}
console.log('\n基准日通过：修复版 ' + pass + '/' + cases.length + '，原版 ' + passO + '/' + cases.length);
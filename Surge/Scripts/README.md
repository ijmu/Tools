# Surge 版 · 小六壬 / 星云电力补贴

这两份是仓库里 Egern 版脚本（`Egern/Scripts/xiaoliuren.js`、`Egern/Scripts/nebula-power.js`）的 Surge 移植。

## ★ 先说结论：Surge 没有「自定义小组件」这个东西 ★

Egern 那套 `type:'widget'` / `ctx.widgetFamily` / `children` 的 DSL，**在 Surge 上不存在等价物**，不是我没找到写法，是能力本身不存在：

- 官方手册（manual.nssurge.com）脚本部分明确列出 **七种脚本类型**：
  `http-request` / `http-response` / `rule` / `dns` / `event` / `cron` / `generic` —— 没有 widget。
- 手册全站搜索索引（2.4 MB，逐字检索）中 **"widget" 只出现在两处**，都是「用系统小组件快速切换策略组」和「从小组件启动 Surge」。
  Surge 的小组件是**内置的策略组小组件**（App Store 更新说明：「Policy group widgets now support the extra-large size」），**不接受自定义脚本渲染**。
- 因此 `[Script]` 段里写 `type=widget` 会被直接拒收（未知类型）。

**替代载体 = 信息面板（[Panel] + `type=generic` 脚本）**：
iOS 显示在「策略选择」界面里，Mac 显示在菜单栏 Panels 子菜单。内容是**纯文本（`\n` 换行）**，没有逐行配色和布局，所以原小组件的多列排布在这里压成了「每档一行」。

```js
$done({ title, content, style })   // style: good / info / alert / error
```
触发参数：`$input = {purpose:"panel", position:"policy-selection", panelName:"..."}`，`$trigger` 为 `button`（点刷新）或 `auto-interval`（到 update-interval 且打开面板）。

> 刷新语义：面板内容由 Surge 缓存，**只在「到点 + 用户打开策略选择界面」时才重跑脚本**。
> 所以小六壬的起课时间 = 你打开面板那一刻，与 Egern 版「刷新那一刻起课」同义。

## 安装

### 方式一：模块（推荐）

Surge → 模块 → 从 URL 添加：

```
https://raw.githubusercontent.com/ijmu/Tools/main/Surge/Module/xiaoliuren.sgmodule
```

模块内自带 `[Script]` 行与 `[Panel]` 行，装完即用；`zi` / `ju` / `ic` 三个开关在模块参数里直接填（`ic=0` 可把每宫专属图标回退成系统的 good/info/alert/error 风格）。
国内拉不到 raw 时，把 `script-path` 换成 jsDelivr 镜像 `https://testingcf.jsdelivr.net/gh/ijmu/Tools@main/Surge/Scripts/xiaoliuren-panel.js`。

### 方式二：写进主配置（兜底）

> ⚠️ 本仓库 `Surge.conf` **不含** [Panel] / [Script] 段（它是裸配置示例），下面这些行要手动加进你自己的配置：

```ini
[Script]
xiaoliuren-panel = type=generic, script-path=https://raw.githubusercontent.com/ijmu/Tools/main/Surge/Scripts/xiaoliuren-panel.js, script-update-interval=86400, timeout=10, argument="zi=1,ju=1"
nebula-power-panel = type=generic, script-path=https://raw.githubusercontent.com/ijmu/Tools/main/Surge/Scripts/nebula-power-panel.js, script-update-interval=86400, timeout=12, argument="sort=smart,top=6"

[Panel]
XiaoLiuRen = title="小六壬", content="打开策略视图即起课", style=info, script-name=xiaoliuren-panel, update-interval=60
NebulaPower = title="星云电力补贴", content="打开策略视图即刷新", style=info, script-name=nebula-power-panel, update-interval=600
```

- ⚠️ `[Panel]` 与模块的关系：手册《Module》章列出的可覆盖段落是 General / MITM / WireGuard / MTProto / Snell Server / Ruleset / Rule / Script / URL Rewrite / Header Rewrite / Host / IP Rewrite，**名单里没有 [Panel]**；但社区面板模块（Rabbit-Spec 的 Panel 系列、深巷有喵等，GitHub 上 1100+ 个 `.sgmodule` 均含 `[Panel]`）都是这么分发的，实测生效。本模块同此做法。**如果你的 Surge 版本不吃模块里的 `[Panel]`，把模块 `[Panel]` 那一行抄进主配置即可**（`[Script]` 行由模块提供，不冲突：面板 id 同名，模块会覆盖配置里的同名面板，不会出现两个「小六壬」）。
- ⚠️ `timeout` 默认只有 **5 秒**，星云要联网，务必显式写到 10~12，否则会被掐断。
- 面板需要 iOS 4.9.3+（且订阅有效）。

### 参数（写在各脚本的 `argument=` 上）

| 脚本 | 参数 | 默认 | 说明 |
|---|---|---|---|
| xiaoliuren-panel | `zi` | `1` | `zi=0` 关闭子时换日（23:00 后日宫按次日数） |
| | `ju` | `1` | `ju=0` 不显示六神断句全诗 |
| nebula-power-panel | `sort` | `smart` | `smart` 综合（能力 50% + 人气 30% + 补贴 20%）/ `power` 纯能力 / `price` 省钱 |
| | `top` | `6` | 面板列出档数 1~20 |
| | `cookie` | 空 | 填 `server_session_xxx=...` 才显示私有余额/电力包；**不填 = 零凭证，只用公开数据** |

## 与原 Egern 版的差异

| | Egern 版 | Surge 版 |
|---|---|---|
| 载体 | 主屏/锁屏小组件（4 种尺寸） | 信息面板（纯文本） |
| 排版 | 多列富文本、SF Symbol、逐行配色 | 每档一行，`style` 决定整卡颜色 |
| 取数/判定/排序算法 | — | **逐字节复用，未改动** |
| 农历换算 | **已修复**（2026-10-02 同步，见下） | **已修复** |
| 离线降级 | `$persistentStore` 缓存回放 | 同（标 `缓存 HH:MM`） |

星云版保留：补贴生效三条件（`discount_price` + 日期区间 + 每日时段跨零点环绕）、额度池只提示不改实扣价、能力档位表 + 人气代理 + 综合分排序、断网回放缓存。
面板比小组件多出的信息：单行内同时给出实扣电价、折扣力度、每日时段、池状态。

## ★ 修掉的 bug：农历换算在「闰月年」之后全错（两边已同步修复）★

`xiaoliuren.js` 的 `solarToLunar()` 里：

```js
const dm = isLeap ? leapDays(ly) : monthDays(ly, lm);
if (offset < dm) break;
offset -= dm;
if (lm === leap) isLeap = !isLeap;      // ← 闰月被消费后 isLeap 不复位
```

闰月消费完（`lm === leap + 1`）之后 `isLeap` 一直保持 `true`，**后面每个月的天数一律按闰月天数（29 或 30）计**，误差逐月累积 —— 而且一直错到次年春节之前。

实测（独立「逐月推进」算法为准）：

| 检查项（独立基准） | 修复后（Surge + Egern） | 修复前 |
|---|---:|---:|
| 1900–2100 全部农历月的首/末日（4972 天） | **0 不符** | 1164 不符 |
| 闰月年 2020/2023/2025/2028/2031/2033 逐日（2192 天） | **0 不符** | 1124 不符 |
| 公认基准日 16 条（春节/端午/中秋/闰月首日） | **16/16** | 11/16 |
| Surge 版与 Egern 版逐日同解 | **0 不符** | — |

这不是显示层的小问题，**落宫本身会算错**（落宫是三宫链的终点，等于整张签的结果）：

| 输入 | 修复前 | 修复后 |
|---|---|---|
| 2025-10-06（中秋） | 农历闰九月十六 · 落宫**小吉** | 农历八月十五 · 落宫**速喜** |
| 2023-06-22（端午） | 农历闰六月初六 · 落宫**赤口** | 农历五月初五 · 落宫**留连** |

原版错例：2023-06-22 端午 → 算成「闰六月初六」（应五月初五）；2025-10-06 中秋 → 算成「闰九月十六」（应八月十五）；2026-01-01 → 算成「闰腊月十六」（应冬月十三）。

修复：改成「正常月 → 该月闰月副本」两趟推进，闰月只在本月之后出现一次：

```js
for (; lm <= 12; lm++) {
  for (let pass = 0; pass < 2; pass++) {
    if (pass === 1 && lm !== leap) break;
    const isL = pass === 1;
    const dm = isL ? leapDays(ly) : monthDays(ly, lm);
    if (offset < dm) return { year: ly, month: lm, day: offset + 1, isLeap: isL };
    offset -= dm;
  }
}
```

同步状态：**两边都已修复**。`Egern/Scripts/xiaoliuren.js` 与 `Surge/Scripts/xiaoliuren-panel.js` 的内核现已一致，
`tests/validate-lunar.js` 会断言两者逐日同解（不一致即 exit 1）。
Egern 版通过 `Egern.yaml` 的 `update_interval` 自动拉取，无需手动改。

## 验证方式（可复跑）

两个脚本都能脱离 Surge 在 Node 里跑：用假 `$httpClient` / `$persistentStore` / `$argument` 建 vm 上下文执行，断言 `$done()` 的产出。台架已随仓库提供：

```bash
node Surge/Scripts/tests/validate-lunar.js                        # 农历：独立算法逐日对拍，打印上表
node Surge/Scripts/tests/simulate-panel.js xiaoliuren-panel.js    # 小六壬面板
node Surge/Scripts/tests/simulate-panel.js nebula-power-panel.js  # 星云面板（含断网/冷启动降级）
```

- 小六壬：固定 3 个时间点 + `zi=0/ju=0` 开关，检查落宫/三宫链/农历/下次换宫。
- 星云：实时抓取 → 模拟断网（应回放缓存并标 `缓存 HH:MM`）→ 冷启动+断网（应报错不崩）→ 恢复网络切 `sort=price,top=3`。
- 农历：见上表。**基准是独立实现的「逐月推进」算法**，不用原版实现自证（否则会把同一个 bug 验两遍）。
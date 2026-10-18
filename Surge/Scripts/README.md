# Surge 组件

这里是 `ijmu/Tools` 中 Egern 组件的 Surge 适配版。Surge 没有 Egern 的 `type: "widget"` 渲染协议，因此四个组件统一改为 `type=generic` 脚本 + `[Panel]` 信息面板：

- iOS：在策略选择界面查看；
- macOS：在菜单栏的 Panels 子菜单查看；
- 面板内容由 Surge 缓存，只有更新间隔到期且用户进入相应界面时才会重新执行。

这意味着 Surge 版本不能提供 Egern 的主屏/锁屏小组件布局、`widgetFamily` 尺寸适配、渐变背景或点击组件跳转。

## 安装模块

在 Surge 的“模块”中选择“从 URL 添加”，分别安装需要的模块：

| 组件 | 模块 URL | 脚本 URL |
| --- | --- | --- |
| 小六壬 | `https://raw.githubusercontent.com/ijmu/Tools/main/Surge/Module/xiaoliuren.sgmodule` | `https://raw.githubusercontent.com/ijmu/Tools/main/Surge/Scripts/xiaoliuren-panel.js` |
| 节日倒计时 | `https://raw.githubusercontent.com/ijmu/Tools/main/Surge/Module/holiday-countdown.sgmodule` | `https://raw.githubusercontent.com/ijmu/Tools/main/Surge/Scripts/holiday-countdown-panel.js` |
| 星云电力补贴 | `https://raw.githubusercontent.com/ijmu/Tools/main/Surge/Module/nebula-power.sgmodule` | `https://raw.githubusercontent.com/ijmu/Tools/main/Surge/Scripts/nebula-power-panel.js` |
| 天气·黄历宜忌 | `https://raw.githubusercontent.com/ijmu/Tools/main/Surge/Module/weather-yiji.sgmodule` | `https://raw.githubusercontent.com/ijmu/Tools/main/Surge/Scripts/weather-yiji-panel.js` |

模块只增加脚本和信息面板，不修改 `[Proxy]`、`[Proxy Group]`、既有规则或 MITM 证书。建议先安装模块测试，再决定是否把脚本和面板行复制到主配置；当前 `Surge/Surge.conf` 保持裸配置，不自动启用这些面板。

面板功能要求 Surge iOS 4.9.3+ 或 Surge Mac 5.7.5+，并需要有效的面板订阅能力。脚本远程更新间隔为 86400 秒，面板刷新间隔按组件分别为 60 秒（小六壬）、600 秒（节日/星云）或 1800 秒（天气）。Surge 的远程脚本会自动缓存；如果所在网络无法访问 GitHub Raw，可将模块/脚本 URL 替换为可用镜像，但镜像内容应保持同一版本。

## 小六壬

模块参数：

- `zi=1`：23:00 后的子时按次日换日；设为 `0` 关闭；
- `ju=1`：显示六神断句全诗；设为 `0` 只显示短断语；
- `ic=1`：使用每个落宫对应的 SF Symbol 和颜色；设为 `0` 使用 Surge 的 `good/info/alert/error` 样式。

起课只使用设备当前时间和本地农历算法，不请求网络，也不保存凭证。农历表覆盖 1900–2100；Surge 版与当前 Egern 版使用同一套闰月遍历逻辑。

## 节日倒计时

模块参数：

- `SHOW_CN=1`、`SHOW_JIEQI=1`、`SHOW_INTL=1`：分别显示国内、节气和国际栏目；
- `PER_ROW=3`：每栏显示最近几项，范围 1–6；
- `LUNAR=1`：面板首行显示农历，设为 `0` 隐藏；
- `TITLE=节日倒计时`：自定义面板标题；
- `QINGMING=cn`：清明放入国内栏目；设为 `jq` 时放入节气栏目。

脚本继续使用固定 UTC+8 计算农历、24 节气和节日日期。Surge 面板以纯文本展示每栏日期、倒计时、年度进度和最近事件；`PLAINBG`、`URL` 以及 Widget 尺寸参数属于 Egern 渲染能力，在 Surge 面板中不生效。

## 天气·黄历宜忌

模块参数通过本地 `[Script]` 的 `argument` 设置：

- `CITY=海口`：城市名称或 9 位中国天气网城市编码；内置常用城市，未知城市会尝试天气网搜索；
- `SHOW_YIJI=1`：显示黄历宜忌，设为 `0` 只显示天气；
- `YI_COUNT=6`、`JI_COUNT=5`：宜/忌词条数量上限。

脚本使用中国天气网公开接口，不需要 API Key，展示当前天气、七日预报、农历、干支、建除十二神、值神、二十八宿、冲煞和宜忌。与 Egern 版相比，Surge 版本使用纯文本面板，不保留天气图标、渐变背景、Widget 尺寸分支和系统小组件布局。天气接口属于公开网页数据源，字段变化或网络不可达时会显示错误面板。

## 星云电力补贴

模块参数：

- `sort=usage`：按今日用量排序（默认）；也可用 `smart`（综合）、`power`（能力）或 `price`（省钱）；
- `top=6`：最多显示 1–20 个模型；
- `cookie=`：可选。只有用户在 Surge 本地模块参数里自行填入会话 Cookie，面板才会请求私有余额和排行榜。

仓库不包含任何 Cookie、Token 或其他凭证。公开接口为：

- `POST https://ai.ipix.ink/guest/models`，请求体 `{"key":"public"}`；
- 可选私有接口：`/user/usage` 和 `/user/leaderboard`。

脚本会使用 Surge `$persistentStore` 缓存上次成功的公开模型数据。请求失败时显示缓存时间；冷启动且没有缓存时显示错误面板。面板内容是每个模型一行的纯文本，不保留 Egern 的多列富文本 Widget 布局。

## 直接写入主配置

如果不使用模块，也可以把对应模块中的 `[Script]` 和 `[Panel]` 段复制到自己的 Surge profile。模块内置的是跨平台安全默认值；需要自定义参数时，请复制 `[Script]` 行到本地 profile 修改 `argument`。不要把带有个人 Cookie 的 `argument` 提交到公开仓库。

## 验证

仓库维护者可在具备 Node.js 的环境中运行：

```sh
node --check Surge/Scripts/xiaoliuren-panel.js
node --check Surge/Scripts/holiday-countdown-panel.js
node --check Surge/Scripts/nebula-power-panel.js
node --check Surge/Scripts/weather-yiji-panel.js
node Surge/Scripts/tests/validate-lunar.js
node Surge/Scripts/tests/simulate-panel.js xiaoliuren-panel.js
node Surge/Scripts/tests/simulate-panel.js nebula-power-panel.js
```

其中历史测试台会模拟 `$argument`、`$httpClient` 和 `$persistentStore`；真实面板刷新仍应在 Surge iOS/macOS 中验证。

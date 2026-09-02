# D3：Collins 固定词典 Registry

日期：2026-09-02。版本：4.7.3+D.3。基于 D2 延续 D 线，不开始 A/C/B/E，不引入后端或公共代理。

## 交付内容

1. Collins 设置改为应用内固定二选一：
   - `american-learner` — Collins Cobuild Advanced American；
   - `american` — Webster's New World College Dictionary。
2. 删除 `GET /api/v1/dictionaries`、目录 payload 解码、动态目录选择、目录 AbortController 与“获取账号词典”状态。
3. 删除自由词典代码输入。只有固定 Registry 中的 code 能保存和发起查询；空值或旧的其他 code 在网络前失败，不自动猜测或换词典。
4. 查词继续严格保持一次 `search/first` 请求、零自动重试、零自动换词典。认证对齐 Collins 官方演示的 `accessKey` Header，路径对齐为带尾斜杠的 `search/first/`，不在 URL 中放密钥。
5. 设置 UI 复用现有 `field + select`、主题和管理弹窗布局；Registry 表示 VIX 支持范围，不宣称当前账号已授权。
6. 版本、Service Worker cache generation、升级桥、测试 fixture 和人工清单同步至 D3。

## 保持不变

- Schema 6 / IndexedDB 5 / Seed 4 / VIX JSON 2；
- `gualVocabulary.collinsApiKey` 与 `gualVocabulary.collinsDictionaryCode` 存储键；
- Provider session 取消、迟到响应丢弃、无自动重试；
- Collins HTML 惰性解析及安全白名单复制；
- 查询结果只存在于当前弹窗，不写词库、备份或 Cache Storage；
- Collins 官网降级入口；
- GitHub Pages 静态部署，不新增 Bridge。

## 兼容规则

- 旧值 `american-learner` / `american`：设置页直接回显并可继续使用；
- 空值：显示“请选择词典”；
- 其他旧值：不发请求、不静默迁移；用户保存设置时选择固定候选或清除该旧值；
- 更换 Collins Key 不自动改变词典选择，因为选择表示产品偏好，账号授权仍由真实查询响应判断。

## 外部验收边界

D3 消除了目录发现依赖，但不能在本地测试中证明 Collins 允许 GitHub Pages 上的 iPhone Home Screen PWA 跨域读取。目标真机仍需分别验证两个固定 code 的真实授权查询。若浏览器仍在 CORS、OPTIONS 或服务验证层失败，需要另行裁决受控 Bridge 或官网降级；该裁决不属于本包。

成功标准不是设置页不报错，而是目标 iPhone 17 standalone PWA 使用所选固定词典取得真实 `entryId + entryContent`、安全显示，并继续满足单请求、无重试、无持久化结果。

## 本地验证

- Provider 单测覆盖 Registry 不可变性、两个固定 code、旧值网络前拒绝、Header 鉴权、规范路径、零目录请求及既有错误分类；
- Static / integration 覆盖 D3 版本、缓存代、目录功能删除和密钥不进入 URL；
- Core / runtime / behavior / stress / performance / layout 保持回归范围；
- 真机真实 Collins 网络验收：待用户部署后执行。

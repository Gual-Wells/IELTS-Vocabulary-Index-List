# Vocabulary Index 5.0.0-alpha.3 交付说明

本版本是 alpha.2 的兼容性与数据修订，不改变 Cloudflare 基础设施标识。

## 已完成

- 修复 Cloudflare Access 保护 Static Assets Worker 时 Collins API 误报 401：优先使用可信 `ctx.access`，并在内部路由不传递上下文时验证应用域 `CF_Authorization` JWT。
- Provider 错误分类能区分 VIX Access 会话问题与 Collins Key/账号问题。
- 管理词库排序采用直接子项事件委托、事件隔离和每动画帧一次的布局处理，消除嵌套拖动柄重复监听。
- 来源入口改为与 VIX 主题一致的说明卡片，解释用途并在二级页展示来源类别。
- Seed revision 6 将计算机术语从 1,121 扩充到 1,421，将通用英语搭配从 50 扩充到 326。
- Worker 名保持 `vix-5-alpha2`；现有 Secret、Access 和 Durable Object 绑定继续复用。

## 仍需真机确认

- iPhone standalone PWA 登录 Access 后查询 Collins，预期不再出现 VIX Access 401；若随后出现 502，才表示请求已经到 Collins 上游，需要进一步核对官方 Key 或账号权限。
- 在“管理词库”中分别拖动一个词表和一个词域，确认页面能跟手滚动且不会长时间冻结。
- 更新后打开“计算机术语”和“通用英语搭配”，确认新计数与新增条目可见。

# Vocabulary Index 3.3.0 本地架构

## 目标

架构只服务 iPhone standalone PWA 的单用户本地工作流。无远程业务数据库、账户或同步服务器。

## 模块

- `v3-app.js`：版本校验、Service Worker、standalone 检测、viewport 恢复；
- `v3-db.js`：IndexedDB Schema 4、备份和事务；
- `v3-store.js`：内存状态、索引、可见 ID 集合、局部写入；
- `v3-ui.js`：固定动态顶部、紧凑一级表项、覆盖层、长列表分块、日期模式、关联和弹窗；
- `v3-exchange.js`：VIX 内容包；
- `v3-integrations.js`：Oxford 与 ChatGPT 快捷指令；
- `v3-data-worker.js`：大型 JSON 预检；
- `v3-ai.js`：可选 Groq 核查。

## 渲染

- 首页与列表均由内存 Store 投影；
- 固定紧凑导航与滚动大标题分离；
- PIN、标注审阅和首页警告使用不参与文档流的覆盖层；
- 一级表项按 42 行分块；
- 首块同步生成，后续块接近视口时生成；
- Entry ID 映射到所在块，保证程序化跳转；
- SVG 模板按图标名缓存；
- 完整关联只在展开时解析；
- 滚动结束后才持久化上次位置。

## 数据隔离

业务数据只存在当前 origin 的 IndexedDB。其他设备或其他用户的浏览器拥有独立存储，不会修改当前设备。应用没有跨设备一致性协议。

## PWA 生命周期

- Service Worker 缓存 App Shell；
- 更新桥删除旧壳缓存；
- 后台恢复检测 WebKit 异常 viewport；
- 修复逻辑只改变页面 meta，不改变数据库。

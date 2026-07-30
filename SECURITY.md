# 安全设计说明

- 不使用外部 JavaScript、字体、图标库或 CDN。
- HTML 不包含内联事件处理器；动态内容通过 DOM API 和 `textContent` 创建。
- Content Security Policy 仅允许本站资源及向 `https://api.groq.com` 发起连接。
- Groq API Key 存放在当前站点的 `localStorage` 中，不进入 IndexedDB、导出文件或 Git 仓库。
- GitHub Pages 是纯前端托管，浏览器中的 API Key 无法对本设备上的同源脚本保密。当前项目不加载第三方脚本，以缩小风险面。
- 数据修改使用 IndexedDB 事务；导入在完整解析与预览后一次性提交。
- AI 输出经过 JSON 解析、字段白名单和词性校验，不直接写入词汇修改。
- AI 核查只写标注；所有词汇修正必须由用户手动执行。

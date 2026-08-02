# Vocabulary Index 3.1.1 测试报告

## 自动化结果

```text
run-tests: OK
static-tests: OK
stress-tests: OK (126 entries, 156 memberships, 45 study stamps)
integration-tests: OK (largest tested URL 33,726 chars)
performance-tests: OK
TypeScript checkJs: 0 errors
JavaScript / MJS syntax: OK
HTML parse: OK
CSS parse: OK
JSON parse: 13/13
HTTP smoke: 20/20 resources HTTP 200
```

本轮性能复测记录：

```text
25 次本地搜索：约 25.7 ms
普通表 VIX 预检：约 2.49 s
```

不同运行环境会产生小幅波动。

## 外部查询专项测试

- 牛津 URL 对 `thread pool` 生成：
  `hk-com-oupc-oecd-lookup://x-callback-url/s?q=thread%20pool`；
- ChatGPT URL 使用准确快捷指令名称 `AI查询`；
- URL 参数固定为 `input=text`；
- 发送文本可从 URL 完整反解回原始提示词和 JSON；
- 普通表高关联词 `data` 已验证直接关系完整；
- 全局同形词 `address` 已验证导出全部独立域实例；
- 全局高关联词 `data` 的测试 URL 长度为 33,726 字符，低于测试保护上限 100,000；
- 快照排除 Groq API Key、无关 Entry、全局设置、撤销历史和无关浏览位置；
- 两个按钮独立于复制、日期刷新、PIN 和关联操作。

## 数据回归

3.1.1 的 `data/seed.json` 与 3.1.0 比较后，除 `appVersion` 从 `3.1.0` 更新为 `3.1.1` 外完全一致：

- Schema 4 不变；
- Seed revision 3 不变；
- Domains、Collections、Entries、Memberships、PhraseTokens、Pins、Annotations、StudyStamps 和 Settings 内容不变。

## 仍需真机验收

自动化环境无法验证第三方 iOS App 的最终行为。部署后必须在用户当前 iPhone 上确认：

1. 牛津 URL Scheme 能打开已安装的牛津英汉辞书并完成查询；
2. `AI查询` 快捷指令能接收长文本；
3. `Start conversation with ChatGPT` 会建立非临时新聊天并完整收到 JSON；
4. 高关联词 `data` 不发生 URL 截断；
5. 从目标 App 返回 PWA 后，原列表、展开状态、学习日期和浏览位置保持正常。

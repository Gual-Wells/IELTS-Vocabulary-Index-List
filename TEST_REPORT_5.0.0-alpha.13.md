# 5.0.0-alpha.13 测试报告

自动化范围：

- Bridge 认证：Bearer、专用 Device Token 头、双头冲突失败关闭与 CORS 预检。
- Bridge 文件库：投递、收件箱、按需读取、审核记录回写、永久删除与索引丢失恢复。
- Mirror：Context/Result 哈希校验、两层审核、选择/开关/删除，以及破损问号释义的拒绝与单侧有效释义回填。
- 静态契约：iOS 凭据字段属性、通知层级、文件选择器、设置顺序、集成资源样式、无页面指纹 debug 信息与 Service Worker 版本一致性。

实际结果：Bridge 11/11，Mirror 5/5，Provider 7/7；23,917 条 Seed 的核心、迁移、分片、关系、压力与性能测试通过。Mirror 23,917 条运行时投影为 16.9 ms。Chromium 402×874 布局合同通过；冷启动中断于 9,027 条后可续传并在 15,715 ms 完成。静态资源预缓存 48 项，无重复。

自动化结果只证明源码与 Chromium 合同；iOS Safari、Chrome 和 Home Screen PWA 的 Password AutoFill、WebKit 网络栈与实际弹窗层叠仍按 `tests/MANUAL_CHECKLIST.md` 做真机验收。

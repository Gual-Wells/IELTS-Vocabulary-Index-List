# 迁移到 VIX 5.1.0

5.1.0 是正式离开 alpha 系列的架构收敛版本，但不是新的 Seed 内容世代。当前 Seed 仍是 revision 8；它的质量债务留给下一次完整 Seed 发布处理。

## 应用数据

- 首次启动会清空旧 history 与 annotations，并删除关联的 history pointer、来源目录和 AI 核验设置。
- IndexedDB 中 history/annotations 对象仓库暂时保留为空壳，以避免只为物理删表触发一次高风险数据库版本迁移；产品不再读取或写入这些能力。
- 旧 Seed 输入中的双释义与来源字段只在读取边界被归一化，运行时模型输出单一 `gloss`。
- PIN、学习日期、显示/关系偏好、普通 Entry 编辑与词表 membership 保留。

## Personal Mirror

1. 打开设置中的 Personal Mirror，进入 Site 配对页。
2. 配对成功后，执行一次“同步到 Mirror”，把当前完整 VIX 状态写成 Site 中唯一的最新快照。
3. VIX 的文件选择按钮打开 Site `/picker`；选择 Mirror 文件不会直接改数据库。
4. 在 VIX 中勾选并提交 Layer 2 候选后，系统使用 VIX increment 事务合并并自动同步快照与文件状态。

旧 Cloudflare Bridge 配置、Device Token、Agent Token、Google TTS Key 与远端目录缓存不再参与运行。项目中不再发布 `bridge/`。

## VIX Function

重新运行：

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\integration\vix-function\VIX-Function.ps1 -Action Configure
```

配置 Site URL 和配对生成的协议写入 token。token 由 Windows DPAPI 加密保存在本机。Function 不需要知道 VIX 5.1.0 或 Seed revision 8；它只检查协议与 capability。

## 下一 Seed 世代

不要把当前 `data/seed.json` 原地改成“增量版”。先从 Mirror 最新快照导出一个候选源，再显式生成新文件：

```powershell
npm run seed:finalize-next -- --input <mirror-snapshot.json> --output <next-seed.json>
npm run seed:validate-next -- --input <next-seed.json>
```

门禁通过后才把该完整文件作为新世代 Seed 发布。更新世代是产品所有者的显式动作，不由 Site 或 VIX 自动完成。

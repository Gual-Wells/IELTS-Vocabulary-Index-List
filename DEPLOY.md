# GitHub Pages 部署

目标地址：

```text
https://gual-wells.github.io/IELTS-Vocabulary-Index-List/
```

项目已经全部使用相对路径，适配该 GitHub Pages 子目录。

## 替换现有仓库

1. 下载并解压交付 ZIP。
2. 将解压后目录中的**全部内容**放到仓库根目录，而不是再套一层文件夹。
3. 提交并推送到当前 Pages 使用的分支。
4. 在仓库 `Settings → Pages` 中确认发布来源为该分支根目录 `/ (root)`。
5. 等待 GitHub Pages 部署完成后打开目标地址。

## 首次访问

首次打开会将 `data/seed.json` 写入 IndexedDB。之后运行时不再依赖种子文件，除非清除此站点的全部本地数据。

建议首次部署后执行：

1. Safari 正常标签页打开网站，确认首页显示 7 个词表和 5,005 个全局唯一词汇。
2. 使用“分享 → 添加到主屏幕”。
3. 从主屏幕启动，点按任一词汇，确认复制提示出现。
4. 在设置中填写 Groq API Key，并点击“读取可用模型”。
5. 导出一次完整 JSON，保存为初始备份。

## 更新缓存

Service Worker 使用版本化缓存。发布新版时应同步修改：

- `js/constants.js` 中的 `APP_VERSION`；
- `sw.js` 中的 `CACHE_NAME`。

当前版本已经调用 `skipWaiting()` 和 `clients.claim()`。若 Safari 仍显示旧界面：

1. 完全退出主屏幕应用后重开；
2. 或在 Safari 的网站数据设置中删除该站点缓存；
3. 不要删除网站数据，除非已有 JSON 备份，因为 IndexedDB 也会一并清除。

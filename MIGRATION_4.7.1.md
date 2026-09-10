# Vocabulary Index 4.7.1 迁移说明

## 数据迁移

无。Backup Schema 6 / IndexedDB 5 / Seed revision 4 / VIX 2全部不变。

## Runtime 迁移

从4.7.0升级时，仅替换完整文件树并让新的 Service Worker cache generation接管。不得把4.7.0的 sibling/reindex target TOP+collapsed规则继续视为当前产品契约。

## Presentation 迁移

- `css/v4.7.0.css`继续作为历史基础层加载；`css/v4.7.1.css`最后加载并覆盖 Pop、LetterRail、Modal等 corrective规则；
- `vix-content-plane`的旧 sibling/reindex keyframes可保留为历史CSS，但 active UI不再调用对应 presentation kind；
- `.letter-nav-locus`不再生成；不要用旧测试或插件重新注入；
- Modal不再依赖 `.modal-layer-entering` 下一帧移除来启动入场；
- 普通 mode/view switch不再主动 reset root scroll。

## 回滚

如需回滚4.7.0，应完整回滚 JS + CSS + SW + tests + lifecycle docs，禁止只撤某个文件形成混合运行时。

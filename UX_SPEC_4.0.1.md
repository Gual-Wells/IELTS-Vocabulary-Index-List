# Vocabulary Index 4.0.1 UX 规格

## Sticky

列表内字母标题是普通分组标题；当前字母只由顶部单一 Sticky Heading Layer 展示。字母栏下方不得出现空白占位带；快速滚动/惰性渲染后当前字母应及时一致。

## Modal

应用设置、词库管理、词表操作等使用 retained modal stack。打开子任务时父 card 保留、变暗并不可交互；子 card 在新的轻遮罩上显示。关闭子层直接露出原父层，不重新渲染父层。

管理型弹窗以词表内操作弹窗的宽度、触控密度和受限高度为基准：四角完整、body 自滚动、footer 仍在 card 内。不要为了紧凑缩小正常触控区域；优先删除无用说明文字。

Backdrop 先出现，card 完成布局后一次性显示；禁止可见位移、尺寸跳变或白色闪现。

## Rows

繁体释义和独立域来源继续使用同一 secondary-line Y/bottom metric；有副信息的 row 只比普通 row 略高。content Entry：短文本单行，中长文本换行，极长文本可横向滚动，不能被右侧控件截失。

## Query chooser

四列固定 Oxford → Collins → Groq → ChatGPT；图标下显示小副字。仅 Oxford/ChatGPT 重绘以对齐现有 Collins/Groq 风格。面板略向左贴近查询按钮，不增加明显高度。

## Settings

不展示自用场景无必要的开发说明段落。checkbox 使用产品风格，但仍是原生 checkbox 控件。

## iOS shell

standalone 状态栏保持 `default`；Modal Host/backdrop 覆盖顶部 safe-area 并与 App 背景连续，业务控件继续按 safe-area 避让。

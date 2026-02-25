# 00 Overview

## Status
- State: in-progress
- Next step: 进行 macOS 手工 smoke（顶栏融合、折叠按钮、market 禁用）并由产品确认视觉细节

## Goal
- 在 macOS 实现融合顶栏，并将导航折叠入口移动到最上层顶栏左侧。

## Non-goals
- 不改 Windows/Linux 窗口标题栏行为。
- 不新增搜索图标和品牌 Logo 图标。
- 不改 TopToolbar 的业务职责。

## Context
- 当前存在原生标题栏与自绘顶栏叠加。
- 侧栏收起/展开按钮位于 SidebarNav 内部，无法满足参考图的顶层入口布局。

## Acceptance criteria (high level)
- [ ] macOS 下仅一套融合顶栏视觉（traffic lights + 应用顶栏共存）
- [x] 顶栏左侧提供导航折叠按钮，侧栏内三角按钮移除
- [x] 市场页保持强制收起且顶部按钮禁用
- [x] 前后端 typecheck 全通过

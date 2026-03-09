# Quickstart: Phase 1 — SyncController 解耦

**Feature**: [spec.md](./spec.md)
**Created**: 2026-03-09

## 快速驗證場景

### 場景 1: Blocks → Code 同步

1. 在積木面板拖放一個 `print` 積木
2. BlocklyPanel 的 onChange → `bus.emit('edit:blocks', { blocklyState })`
3. SyncController 收到 → 解析語義樹 → 產生程式碼 → `bus.emit('semantic:update', { tree, code, source: 'blocks' })`
4. MonacoPanel 收到 → 更新編輯器顯示 `cout << ... << endl;`

### 場景 2: Code → Blocks 同步

1. 在程式碼面板輸入 `int x = 5;`
2. MonacoPanel 的 onChange → `bus.emit('edit:code', { code })`
3. SyncController 收到 → parse → lift → 產生 blockState → `bus.emit('semantic:update', { tree, blockState, source: 'code' })`
4. BlocklyPanel 收到 → 更新 workspace 顯示對應積木

### 場景 3: 面板獨立性驗證

```bash
# 移除 BlocklyPanel import 後，MonacoPanel 仍可編譯
# 移除 MonacoPanel import 後，BlocklyPanel 仍可編譯
# SyncController 不 import 任何 panels/ 路徑
grep -r "import.*panels/" src/ui/sync-controller.ts  # 應為空
```

### 場景 4: Style Exception 流程

1. APCS preset + 使用者貼入含 `printf` 的程式碼
2. MonacoPanel → `edit:code` → SyncController lift → 偵測到 style exception
3. SyncController 透過回呼通知 App 層顯示 action bar
4. 使用者選擇「保留」或「自動轉換」

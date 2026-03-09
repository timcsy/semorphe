# Quickstart: Phase 2 — app.ts 拆分

**Date**: 2026-03-09

## 驗證步驟

### 1. 單元測試驗證

```bash
npx vitest run tests/unit/ui/toolbox-builder.test.ts
npx vitest run tests/unit/ui/block-registrar.test.ts
npx vitest run tests/unit/ui/app-shell.test.ts
```

### 2. 全套測試

```bash
npx vitest run
```

所有現有測試 MUST 通過（零 regression）。

### 3. 建構驗證

```bash
npm run build
```

建構成功，無 TypeScript 錯誤。

### 4. 靜態分析

```bash
# ToolboxBuilder 零 Blockly 依賴
grep -r "from 'blockly'" src/ui/toolbox-builder.ts
# 預期：無結果

# app.ts 行數
wc -l src/ui/app.ts
# 預期：< 500

# app.ts 無動態積木定義
grep "Blockly.Blocks\[" src/ui/app.ts
# 預期：無結果
```

### 5. 瀏覽器 Smoke Test

1. `npm run dev` 啟動開發伺服器
2. 開啟瀏覽器，確認以下功能正常：
   - [ ] Blockly workspace 顯示，可拖拉積木
   - [ ] 積木 → 程式碼同步
   - [ ] 程式碼 → 積木同步
   - [ ] 雙向高亮（點積木→高亮程式碼，點程式碼→高亮積木）
   - [ ] 風格切換（APCS ↔ Competitive）
   - [ ] 層級切換（L0 ↔ L1 ↔ L2）
   - [ ] 執行程式（▶ 執行）
   - [ ] 主控台輸入輸出
   - [ ] 匯出/匯入
   - [ ] 自動同步開關

## 模組依賴方向

```
app.ts ──→ ToolboxBuilder  (純函式呼叫)
       ──→ BlockRegistrar  (registerAll + accessor queries)
       ──→ AppShell         (createLayout + wireCallbacks)
       ──→ SyncController   (已在 Phase 1 解耦)
       ──→ Panels           (BlocklyPanel, MonacoPanel, ...)
```

不允許反向依賴（新模組不得 import app.ts）。

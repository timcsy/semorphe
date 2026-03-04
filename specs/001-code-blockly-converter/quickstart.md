# 快速開始

## 環境需求

- Node.js 18+
- npm 或 pnpm

## 安裝與啟動

```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev
```

開啟瀏覽器前往 `http://localhost:5173`。

## 基本使用

1. **拖拉積木**: 從左側工具箱拖出積木到 Blockly 編輯器中，右側程式碼面板會即時更新
2. **輸入程式碼**: 在右側程式碼編輯器中輸入 C/C++ 程式碼，左側 Blockly 編輯器會自動產生對應積木
3. **匯出/匯入**: 使用工具列的匯出按鈕下載工作檔案，或匯入先前的工作檔案

## 自訂積木

建立一個 JSON 檔案，遵循 Block Spec 規範（見 `contracts/block-spec-schema.md`），然後在 Web 介面中上傳即可使用。

## 開發

```bash
# 執行測試
npm test

# 執行測試（監看模式）
npm run test:watch

# 建置
npm run build
```

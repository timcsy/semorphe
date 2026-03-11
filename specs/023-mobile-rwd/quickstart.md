# 快速入門：行動裝置響應式佈局

## 開發環境

```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev

# 在瀏覽器中開啟（通常是 http://localhost:5174/semorphe/）
# 使用 Chrome DevTools 的 Device Mode 模擬行動裝置
```

## 測試

```bash
# 執行所有測試
npm test

# 執行特定測試
npx vitest run tests/unit/ui/layout-manager.test.ts
npx vitest run tests/integration/responsive-layout.test.ts
```

## 關鍵檔案

| 檔案 | 用途 |
|------|------|
| `src/ui/layout/layout-manager.ts` | 偵測斷點、切換佈局模式 |
| `src/ui/layout/mobile-tab-bar.ts` | 底部 tab bar 元件 |
| `src/ui/toolbar/mobile-menu.ts` | 漢堡下拉式覆蓋選單 |
| `src/ui/app-shell.ts` | 整合入口，建立佈局 |
| `src/ui/style.css` | media query 區塊（檔案底部） |

## 測試行動裝置佈局

1. 開啟 Chrome DevTools（F12）
2. 點擊 Device Mode 圖示（或 Ctrl+Shift+M）
3. 選擇裝置：iPhone SE（375×667）、iPhone 12（390×844）、iPad（768×1024）
4. 驗證：
   - ≤768px：底部 tab bar 出現，面板全螢幕切換
   - ≥769px：桌面分割面板
   - 拖動視窗邊界跨越 768px：佈局即時切換

## 設計原則

- **不修改面板元件**：BlocklyPanel、MonacoPanel 等與佈局無關
- **DOM 搬移而非重建**：切換模式時用 `appendChild` 搬移面板
- **CSS 優先**：純樣式變更用 media query，DOM 操作用 JS
- **觸發 resize**：搬移面板後必須 `window.dispatchEvent(new Event('resize'))`

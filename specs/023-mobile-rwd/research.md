# 研究紀錄：行動裝置響應式佈局

## R1: Blockly 觸控支援與行動裝置相容性

**決策**: 使用 Blockly 內建觸控支援，不自訂手勢處理。

**理由**: Blockly 12.x 已內建完整的觸控事件處理（拖曳、長按右鍵選單、雙指縮放）。`zelos` renderer 已針對觸控最佳化（圓角、較大的連接點）。只需確保容器尺寸正確且不阻擋觸控事件傳遞。

**替代方案**:
- 自訂 touch event handler（過度設計，Blockly 已處理）
- 使用 Hammer.js 等手勢庫（不必要的依賴）

## R2: CSS Media Query vs JavaScript 偵測

**決策**: 混合使用——CSS media query 處理純樣式（隱藏/顯示元素），JavaScript `matchMedia` 處理需要 DOM 操作的佈局切換（移動面板元素）。

**理由**: 純 CSS 無法實現「將 DOM 元素從一個容器搬到另一個容器」。但純 JS 偵測會讓樣式邏輯分散。混合方案讓各自做擅長的事：
- CSS: `display: none/flex`（分隔線、狀態列、工具列按鈕）
- JS: `container.appendChild(panel)`（面板搬移）、`resize` 事件

**替代方案**:
- 純 CSS Container Queries（瀏覽器支援度已足夠，但無法搬移 DOM）
- 純 JS + inline styles（失去 CSS 的宣告式優勢）

## R3: 面板狀態在佈局切換時的保留策略

**決策**: DOM 元素搬移（`appendChild`），不銷毀重建。

**理由**: Blockly 工作區初始化成本高（WASM parser、積木 SVG 渲染）。Monaco 編輯器同理。`appendChild` 只是將 DOM 節點從一個父元素移到另一個，不觸發銷毀/重建。搬移後觸發 `window.resize` 讓兩者重新計算尺寸即可。

**替代方案**:
- 銷毀重建（成本高、狀態遺失）
- CSS `visibility: hidden` + `position: absolute`（DOM 結構不變，但複雜度高、要管理 z-index）

## R4: Tab Bar 實作方式

**決策**: 自訂 HTML/CSS 元件（`mobile-tab-bar.ts`），不引入 UI 框架。

**理由**: Semorphe 不使用任何 UI 框架（React/Vue/等），全部是原生 DOM 操作。Tab bar 結構極簡（3 個按鈕 + badge），不值得引入新依賴。

**替代方案**:
- Material Web Components（過重，與專案風格不符）
- 第三方 tab bar 庫（不必要的依賴）

## R5: 漢堡選單中選擇器的搬移

**決策**: 行動裝置上，選擇器 DOM 元素從工具列搬到下拉選單容器中。桌面模式時搬回原位。

**理由**: 目前的選擇器（Topic、Style、Block Style、Locale）是掛載在工具列的 `<span>` mount point 中。搬移 DOM 元素比重建選擇器實例更簡單，且保留已選擇的狀態。

**替代方案**:
- 在下拉選單中建立新的選擇器實例（需同步兩份狀態，複雜）
- 用 CSS 隱藏工具列選擇器，在選單中用文字連結觸發同一選擇器（hack）

## R6: Quick-Access Bar 在行動裝置上的處理

**決策**: 行動裝置上簡化 Quick-Access Bar 的按鈕——undo/redo/clear 保留（功能必要），同步按鈕和檔案選單收入漢堡選單，level-selector 和 block-style-selector 也收入漢堡選單。

**理由**: Quick-Access Bar 是積木面板上方的工具列，包含同步、undo/redo、清空、檔案選單和選擇器。在行動裝置上，水平空間有限。保留最常用的操作（undo/redo/clear），其餘收入漢堡選單，避免溢出。

**替代方案**:
- 完全隱藏（失去 undo/redo，使用者體驗差）
- 全部保留加 `overflow-x: auto`（觸控裝置上水平捲動不直覺）

# 實作計畫：行動裝置響應式佈局（Tab 切換模式）

**分支**: `023-mobile-rwd` | **日期**: 2026-03-11 | **規格**: [spec.md](spec.md)
**輸入**: 功能規格來自 `/specs/023-mobile-rwd/spec.md`

## 摘要

為 Semorphe UI 加入響應式設計，在視窗寬度 ≤768px 時，以底部 tab bar（積木/程式碼/主控台）全螢幕切換取代桌面的左右分割面板。桌面佈局維持不變。工具列在行動裝置上簡化為執行、同步加漢堡下拉選單。隱藏狀態列。主控台分頁內含 Console/Variables 子分頁。

技術方案：以 CSS media query 為主，搭配 TypeScript 中新增 `LayoutManager` 元件偵測斷點並切換佈局模式（split-pane ↔ tab-bar）。既有面板元件（BlocklyPanel、MonacoPanel、ConsolePanel、VariablePanel）不需修改，僅改變其容器的可見性和尺寸。

## 技術背景

**語言/版本**: TypeScript 5.x
**主要依賴**: Blockly 12.4.1, Monaco Editor, Vite
**儲存**: N/A（純 UI 佈局變更）
**測試**: Vitest（單元測試 + 整合測試）
**目標平台**: 瀏覽器（桌面 + 行動裝置，視窗寬度 320px–2560px+）
**專案類型**: Web 應用程式（教學工具）
**效能目標**: Tab 切換 <1 秒；佈局轉換不閃爍
**約束**: 觸控目標 ≥44px；Blockly 工作區不被 tab bar 遮擋
**規模**: 修改約 5-8 個檔案（CSS + TypeScript），新增 2-3 個元件

## 憲法檢查

*GATE：Phase 0 研究前必須通過。Phase 1 設計後需再次檢查。*

| 原則 | 狀態 | 說明 |
|------|------|------|
| I. 簡約優先 | ✅ 通過 | 僅實作當前需求（RWD tab 切換），不預留未來擴充（如手勢滑動切換）。使用 CSS media query + 最小 JS 邏輯。 |
| II. 測試驅動開發 | ✅ 通過 | 每個 User Story 可獨立測試。將先寫測試再實作。 |
| III. Git 紀律 | ✅ 通過 | 每個邏輯步驟完成後 commit。 |
| IV. 規格文件保護 | ✅ 通過 | 不修改 specs/ 和 .specify/ 目錄下的既有文件。 |
| V. 繁體中文優先 | ✅ 通過 | 規格、計畫、任務文件以繁體中文撰寫。程式碼變數名維持英文。 |

## 專案結構

### 文件（本功能）

```text
specs/023-mobile-rwd/
├── spec.md              # 功能規格
├── plan.md              # 本檔案
├── research.md          # Phase 0 研究產出
├── data-model.md        # Phase 1 產出（本功能為 N/A）
├── quickstart.md        # Phase 1 產出
└── tasks.md             # Phase 2 產出（/speckit.tasks）
```

### 原始碼（需修改/新增的檔案）

```text
src/ui/
├── app-shell.ts              # [修改] 條件建立 tab bar 或 split pane
├── layout/
│   ├── split-pane.ts          # [保留] 桌面模式不變
│   ├── bottom-panel.ts        # [保留] 桌面模式不變
│   ├── layout-manager.ts      # [新增] 偵測斷點，切換佈局模式
│   └── mobile-tab-bar.ts      # [新增] 行動裝置底部 tab bar 元件
├── toolbar/
│   ├── quick-access-bar.ts    # [修改] 行動裝置上簡化按鈕
│   └── mobile-menu.ts         # [新增] 漢堡下拉式覆蓋選單
├── panels/
│   ├── blockly-panel.ts       # [不修改] 面板本身與佈局無關
│   ├── monaco-panel.ts        # [不修改]
│   ├── console-panel.ts       # [不修改]
│   └── variable-panel.ts      # [不修改]
└── style.css                  # [修改] 新增 media query 區塊

tests/
├── unit/ui/
│   ├── layout-manager.test.ts       # [新增]
│   ├── mobile-tab-bar.test.ts       # [新增]
│   └── mobile-menu.test.ts          # [新增]
└── integration/
    └── responsive-layout.test.ts    # [新增]
```

**結構決策**: 遵循既有的 `src/ui/layout/` 和 `src/ui/toolbar/` 分層結構。新元件放在對應的子目錄中。面板元件完全不動——只改容器的可見性。

## 設計決策

### D1: 佈局切換機制

使用 `window.matchMedia('(max-width: 768px)')` 監聽斷點變化。`LayoutManager` 負責：
- 初始化時判斷目前模式
- 監聽 `change` 事件切換模式
- 切換時隱藏/顯示 split-pane 或 tab-bar
- 觸發 `window.resize` 讓 Blockly/Monaco 重新計算尺寸

### D2: 面板共用（不銷毀重建）

行動和桌面模式**共用相同的面板 DOM 元素**。切換佈局時，只是把面板元素搬到不同的容器中（`appendChild`），而非銷毀重建。這確保：
- Blockly 工作區狀態完整保留
- Monaco 編輯器游標和內容不遺失
- 沒有重複初始化的開銷

### D3: Tab Bar 結構

```
.mobile-tab-bar (position: fixed, bottom: 0, height: 48px)
├── .tab-item.active  [積木圖示 + 文字]
├── .tab-item         [程式碼圖示 + 文字]  (可能有 .badge)
└── .tab-item         [主控台圖示 + 文字]  (可能有 .badge)
```

### D4: 主控台子分頁

主控台分頁內部複用桌面版的 `BottomPanel` 子分頁機制（Console/Variables tab buttons），但不含 divider 和拖拉調整高度。直接顯示為全高面板。

### D5: 漢堡選單

```
.mobile-menu-overlay (position: absolute, top: 36px, right: 0)
├── 語言選擇器
├── 程式碼風格選擇器
├── 積木風格選擇器
├── Topic 選擇器
├── 語言設定選擇器
└── 目前設定摘要（取代隱藏的狀態列）
```
點擊外部關閉，使用 `document.addEventListener('click', ...)` 偵測。

## 複雜度追蹤

> 無違反憲法之處，此表不需填寫。

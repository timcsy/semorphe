# Tasks: 行動裝置響應式佈局（Tab 切換模式）

**輸入**: 設計文件來自 `/specs/023-mobile-rwd/`
**前置條件**: plan.md（必要）、spec.md（必要）、research.md、quickstart.md

**測試**: 依據憲法 II. 測試驅動開發原則，包含測試任務。

**組織**: 任務按使用者故事分組，支援獨立實作和測試。

## 格式: `[ID] [P?] [Story] 描述`

- **[P]**: 可平行執行（不同檔案，無依賴）
- **[Story]**: 所屬使用者故事（US1、US2、US3 等）
- 描述中包含確切的檔案路徑

---

## Phase 1: Setup（共用基礎設施）

**目的**: 建立目錄結構與共用型別

- [x] T001 建立 `src/ui/layout/` 目錄結構（若不存在）
- [x] T002 [P] 建立 `src/ui/toolbar/` 目錄結構（若不存在）

---

## Phase 2: Foundational（阻擋性前置條件）

**目的**: LayoutManager 核心斷點偵測——所有使用者故事的共用基礎

**⚠️ 關鍵**: 此階段完成前，任何使用者故事都不能開始

### 測試（先寫，確認失敗）

- [x] T003 [P] 建立 LayoutManager 單元測試 `tests/unit/ui/layout-manager.test.ts`——測試斷點偵測（≤768px → mobile、≥769px → desktop）、模式切換回呼、初始化時正確判斷模式
- [x] T004 [P] 建立整合測試 `tests/integration/responsive-layout.test.ts`——測試跨斷點時佈局模式切換、面板 DOM 搬移後 resize 事件觸發

### 實作

- [x] T005 實作 LayoutManager `src/ui/layout/layout-manager.ts`——使用 `window.matchMedia('(max-width: 768px)')` 偵測斷點、監聽 `change` 事件、提供 `onModeChange` 回呼、切換後觸發 `window.dispatchEvent(new Event('resize'))`

**檢查點**: LayoutManager 能正確偵測並回報佈局模式，所有 Phase 2 測試通過

---

## Phase 3: US1 + US2 — 全寬積木編輯 + Tab 切換（優先級：P1）🎯 MVP

**目標**: 行動裝置上顯示底部 tab bar，面板全螢幕切換（積木/程式碼/主控台），Blockly 觸控正常運作

**獨立測試**: 在 ≤768px 視窗開啟 Semorphe，驗證 Blockly 全寬、底部 tab bar 可切換 3 個分頁、主控台含 Console/Variables 子分頁、切換分頁保留面板狀態

### 測試（先寫，確認失敗）

- [x] T006 [P] [US1] 建立 MobileTabBar 單元測試 `tests/unit/ui/mobile-tab-bar.test.ts`——測試 3 個分頁渲染、點擊切換 active 狀態、badge 顯示/隱藏、觸控目標 ≥44px
- [x] T007 [P] [US2] 在 `tests/integration/responsive-layout.test.ts` 新增 tab 切換整合測試——測試面板 DOM 搬移（appendChild）、切換後面板全寬顯示、主控台子分頁切換

### 實作

- [x] T008 [P] [US1] 實作 MobileTabBar 元件 `src/ui/layout/mobile-tab-bar.ts`——底部 tab bar（position: fixed, bottom: 0, height: 48px），3 個分頁（積木/程式碼/主控台），圖示 + 文字，badge 支援，觸控目標 ≥44px
- [x] T009 [US2] 在 `src/ui/layout/layout-manager.ts` 中新增面板切換邏輯——管理 3 個面板容器的可見性、DOM 搬移（appendChild 而非銷毀重建）、切換後觸發 resize、主控台分頁內含 Console/Variables 子分頁容器
- [x] T010 [US1] 在 `src/ui/style.css` 新增行動裝置 media query 區塊——`@media (max-width: 768px)` 隱藏分割面板分隔線、面板全寬全高（減去工具列和 tab bar）、Blockly 工作區底部 padding 避免被 tab bar 遮擋
- [x] T011 [US2] 修改 `src/ui/app-shell.ts`——整合 LayoutManager，根據模式條件建立 tab bar 或 split pane、連接 MobileTabBar 的 tab 切換事件到 LayoutManager 的面板切換邏輯
- [x] T012 [US2] 在 MobileTabBar 實作同步指示器——當非活躍分頁的內容更新時顯示 badge（圓點），切換到該分頁後清除

**檢查點**: 行動裝置上 Blockly 全寬可用、3 個分頁可切換、面板狀態保留、同步 badge 正常顯示。所有 Phase 3 測試通過

---

## Phase 4: US3 — 行動裝置簡化工具列（優先級：P2）

**目標**: 行動裝置工具列只顯示執行、同步按鈕和漢堡選單圖示，次要控制項收入下拉式覆蓋選單

**獨立測試**: 在 ≤768px 視窗驗證工具列只有 3 個按鈕、點擊漢堡開啟下拉選單含所有選擇器、點擊外部關閉選單

### 測試（先寫，確認失敗）

- [x] T013 [P] [US3] 建立 MobileMenu 單元測試 `tests/unit/ui/mobile-menu.test.ts`——測試選單開啟/關閉、選擇器 DOM 搬移、點擊外部關閉

### 實作

- [x] T014 [P] [US3] 實作 MobileMenu 元件 `src/ui/toolbar/mobile-menu.ts`——下拉式覆蓋選單（position: absolute, top: 36px, right: 0），包含語言、程式碼風格、積木風格、Topic、語言設定選擇器的容器，點擊外部關閉（`document.addEventListener('click', ...)`）
- [x] T015 [US3] 修改 `src/ui/toolbar/quick-access-bar.ts`——行動裝置上隱藏同步按鈕、檔案選單、level-selector、block-style-selector（這些收入漢堡選單），保留 undo/redo/clear
- [x] T016 [US3] 在 `src/ui/app-shell.ts` 整合 MobileMenu——行動裝置模式時建立漢堡按鈕和 MobileMenu、切換模式時將選擇器 DOM 搬移至選單容器或搬回工具列原位
- [x] T017 [US3] 在 `src/ui/style.css` 新增 MobileMenu 和工具列簡化樣式——漢堡按鈕樣式、下拉選單佈局、工具列行動裝置隱藏規則

**檢查點**: 行動裝置工具列精簡、漢堡選單含所有次要控制項、選擇器可正常使用。所有 Phase 4 測試通過

---

## Phase 5: US4 — 桌面佈局維持不變（優先級：P2）

**目標**: 確保桌面使用者（≥769px）看到與之前完全相同的佈局，無退化

**獨立測試**: 在 ≥769px 視窗打開 Semorphe，驗證分割面板、分隔線、完整工具列、狀態列全部正常

### 測試（先寫，確認失敗）

- [x] T018 [US4] 在 `tests/integration/responsive-layout.test.ts` 新增桌面迴歸測試——驗證 ≥769px 時 split-pane 出現、tab bar 不出現、工具列完整、狀態列可見、跨斷點雙向切換後面板狀態保留

### 實作

- [x] T019 [US4] 審查並修正 `src/ui/layout/layout-manager.ts` 中桌面→行動→桌面的雙向切換——確保面板搬回 split-pane 容器、分隔線恢復、工具列選擇器搬回原位
- [x] T020 [US4] 在 `src/ui/style.css` 確認桌面樣式不受行動裝置 media query 影響——驗證分割面板、分隔線、狀態列在 ≥769px 時正常顯示

**檢查點**: 桌面佈局完全無退化、跨斷點雙向切換正常。所有 Phase 5 測試通過

---

## Phase 6: US5 — 行動裝置隱藏狀態列（優先級：P3）

**目標**: 行動裝置上隱藏狀態列，狀態資訊可透過漢堡選單存取

**獨立測試**: 在 ≤768px 視窗驗證狀態列不可見、漢堡選單中可看到目前設定摘要

### 實作

- [x] T021 [US5] 在 `src/ui/style.css` 的行動裝置 media query 中隱藏狀態列——`display: none` 狀態列容器
- [x] T022 [US5] 在 `src/ui/toolbar/mobile-menu.ts` 新增目前設定摘要區塊——顯示目前語言、風格、Topic 等資訊（取代隱藏的狀態列）

**檢查點**: 行動裝置狀態列隱藏、選單中可查看設定。所有使用者故事功能完成

---

## Phase 7: Polish & 跨切面關注

**目的**: 跨使用者故事的改善

- [x] T023 [P] 執行 `quickstart.md` 驗證——按照 quickstart 步驟在 Chrome DevTools Device Mode 手動測試 iPhone SE（375×667）、iPhone 12（390×844）、iPad（768×1024）
- [x] T024 [P] 驗證所有現有測試無退化——`npm test` 全部通過
- [ ] T025 觸控手勢最終驗證——確認 Blockly 拖曳、雙指縮放、工具箱操作在行動裝置全寬下不與 tab bar 或頁面手勢衝突

---

## 依賴與執行順序

### Phase 依賴

- **Setup（Phase 1）**: 無依賴——可立即開始
- **Foundational（Phase 2）**: 依賴 Setup 完成——**阻擋所有使用者故事**
- **US1+US2（Phase 3）**: 依賴 Phase 2 完成——MVP 核心
- **US3（Phase 4）**: 依賴 Phase 2 完成——可與 Phase 3 平行（但建議在 Phase 3 之後）
- **US4（Phase 5）**: 依賴 Phase 3 完成——需要行動裝置佈局已實作才能測試雙向切換
- **US5（Phase 6）**: 依賴 Phase 4 完成——需要漢堡選單存在才能放設定摘要
- **Polish（Phase 7）**: 依賴所有使用者故事完成

### 使用者故事依賴

- **US1+US2（P1）**: Phase 2 完成後可開始——無其他故事依賴
- **US3（P2）**: Phase 2 完成後可開始——與 US1+US2 獨立（但工具列修改需注意 app-shell 整合順序）
- **US4（P2）**: 需要行動裝置佈局已存在——依賴 US1+US2
- **US5（P3）**: 需要漢堡選單已存在——依賴 US3

### 各使用者故事內部

- 測試必須先寫，確認失敗後才實作
- 元件實作（[P] 標記）可平行
- 整合步驟（app-shell 修改）需在元件完成後
- 樣式修改可與元件實作平行

### 平行機會

- T003 + T004 可平行（不同測試檔案）
- T006 + T007 可平行（不同測試檔案）
- T008 + T010 可平行（不同檔案：ts vs css）
- T013 + T014 可平行（測試 + 實作不同檔案）
- T023 + T024 可平行（手動測試 + 自動測試）

---

## 平行範例：Phase 3（US1+US2）

```bash
# 先平行啟動測試：
Task: "建立 MobileTabBar 單元測試 tests/unit/ui/mobile-tab-bar.test.ts"   # T006
Task: "新增 tab 切換整合測試 tests/integration/responsive-layout.test.ts"  # T007

# 再平行啟動核心元件：
Task: "實作 MobileTabBar 元件 src/ui/layout/mobile-tab-bar.ts"           # T008
Task: "新增行動裝置 media query src/ui/style.css"                         # T010

# 最後依序整合：
Task: "面板切換邏輯 src/ui/layout/layout-manager.ts"                      # T009
Task: "整合 app-shell.ts"                                                  # T011
Task: "同步指示器"                                                          # T012
```

---

## 實作策略

### MVP 優先（僅 US1+US2）

1. 完成 Phase 1: Setup
2. 完成 Phase 2: Foundational（LayoutManager 核心）
3. 完成 Phase 3: US1+US2（底部 tab bar + 面板全螢幕切換）
4. **停下驗證**: 在 Chrome DevTools Device Mode 測試行動裝置佈局
5. 若可接受即部署/展示

### 漸進交付

1. Setup + Foundational → 基礎就緒
2. US1+US2 → 行動裝置可用（MVP！）
3. US3 → 工具列精簡 + 漢堡選單
4. US4 → 桌面迴歸驗證
5. US5 → 狀態列隱藏 + 選單設定摘要
6. Polish → 觸控最終驗證

---

## 備註

- US1 和 US2 合併為同一 Phase（它們共享 MobileTabBar 和 LayoutManager 面板切換邏輯，拆開反而增加整合成本）
- [P] 任務 = 不同檔案、無依賴
- [Story] 標籤追溯任務到使用者故事
- 面板元件（BlocklyPanel、MonacoPanel、ConsolePanel、VariablePanel）**不需修改**——僅改容器
- DOM 搬移用 `appendChild`，不銷毀重建
- 每次搬移後必須 `window.dispatchEvent(new Event('resize'))`
- 每個任務或邏輯群組完成後 commit

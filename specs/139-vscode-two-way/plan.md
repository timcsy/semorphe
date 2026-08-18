# Implementation Plan：擴充長成能用的——雙向同步／高亮／執行／設定

**Branch**: `139-vscode-two-way` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/139-vscode-two-way/spec.md`

---

## Summary

讓第一刀那顆積木**開始有用**：改積木會改程式碼（**只改那一段**）、改程式碼會改積木、
點一邊另一邊亮、單步時積木依序高亮、組態進專案設定、工具箱與外觀補齊。

🟢 **而規劃期已經把六個「架構限制」量掉三個**，所以這一刀比它看起來便宜。
🔴 **代價是它動的面積比第一刀大得多** —— 風險管理寫在「Constitution Check」與
「Complexity Tracking」裡，不是靠小心。

**[research.md](./research.md) 改變了兩個原本以為定了的東西**：

```
① 範圍要拿【文件的實際文字】比，不是拿 generate(原樹) 比
   → 我量到的是「第 2 次之後的編輯」，而我把它讀成了「所有編輯」
② 解析跑在 Webview ⟹ 'wasm-unsafe-eval' 的觸發條件【成立了】
   → 那不是範圍蔓延，是規格說的那個時刻到了
```

---

## Technical Context

**Language/Version**: TypeScript 5.9（`strict` ＋ `verbatimModuleSyntax` ＋ `erasableSyntaxOnly`）

**Primary Dependencies**: 既有的 Blockly 12.4.1／Vite 7.3.1／web-tree-sitter 0.26.6
／`@types/vscode`／`@vscode/vsce`。**本輪零新增外部相依。**

**Storage**:
```
組態        專案設定檔（語言可覆寫）
視圖狀態    宿主的 per-uri 狀態儲存
文件內容    🔴 不存——檔案就是真相
```

**Testing**: Vitest（現況 4304）＋ Playwright。
🟢 **本輪可測面積比第一刀大得多**：範圍計算、身分比對、設定解析、
視圖狀態搬遷**全是純函式**。

**Target Platform**: VSCode 1.74+／Arduino IDE 2.x（Theia）

**Project Type**: 既有專案 ＋ `src/vscode/` 宿主層（第一刀已建立）

**Performance Goals**：
```
切分頁重建   ≤ 100 ms（量過的下界是 13 ms）
單步高亮     人手可感知的即時（無明確門檻——本輪建立第一個觀測）
```

**Constraints**:
- 網頁版零行為改變（全套綠 · 護欄基線零變動 · 中立性 0 · 探針 0.07%／0 漂移）
- 🔴 防迴圈**零個時間等待**（FR-005）
- `npx tsc --noEmit` 必須涵蓋新程式碼，**不得靠 exclude 過關**
- CSP 只加 `'wasm-unsafe-eval'` **一項**，不得順手放寬別的

**Scale/Scope**: 八個使用者故事 · 一個面板 · 一份文件 · 200 顆膠囊

---

## Constitution Check

*GATE: 必須在 Phase 0 之前通過，Phase 1 之後重驗。*

| 原則 | 判定 | 依據 |
|---|---|---|
| **I. 簡約優先** | 🟡 **有張力，見下** | 「一次做完」是使用者拍板的，而它與 YAGNI 天生緊張。處置是**按使用者故事切且每段獨立可驗**，不是縮範圍 |
| **II. TDD（非妥協）** | 🟢 **本輪大部分成立** | 四塊核心邏輯是純函式，**全部先寫測試**。⚠️ 而「在 Electron 裡按鍵拖曳」測不到——**明說並交棒**，不假裝 |
| **III. Git 紀律** | 🟢 通過 | 每個使用者故事一個 commit；🔴 **而動到共用檔那一步單獨一個** |
| **IV. 規格文件保護** | 🟢 通過 | 不碰 `specs/`、`.specify/` |
| **V. 繁體中文優先** | 🟢 通過 | |

### 🔴 Post-Design 重驗（Phase 1 之後）

| 原則 | 重驗 | 結果 |
|---|---|---|
| I. 簡約 | 設計後有沒有多出東西？ | 🟢 **反而少了**：`storageService` 在這一側**不出現**（research §一、draft §七）——不是多寫一層轉接，是**不接** |
| II. TDD | 設計有沒有讓可測面積變大？ | 🟢 **有**：範圍計算搬進 `core/projection/` 之後，**探針那 407 筆量測變成它的回歸測試** |
| III. Git | 風險最高的一步隔離了嗎？ | 🟢 `createDarkTheme()` 的抽出**單獨 commit ＋ 立刻跑全套** |
| IV–V | 無變動 | 🟢 |

---

## Project Structure

### Documentation (this feature)

```text
specs/139-vscode-two-way/
├── spec.md              ✅  八個故事 · 14 FR · 12 SC
├── checklists/requirements.md  ✅  16 項全過
├── plan.md              ← 本檔
├── research.md          ✅  Phase 0（🔴 含一個我量錯的更正）
├── data-model.md        ✅  Phase 1
├── contracts/sync-protocol.md  ✅  Phase 1
├── quickstart.md        ✅  Phase 1
└── tasks.md             ← /speckit-tasks 產出
```

### Source Code (repository root)

```text
src/
├── core/projection/
│   └── rewrite-span.ts       ★ 從探針升格：去頭去尾取中間（🟢 中立，不認識宿主）
├── ui/panels/blockly-panel.ts
│   └── （抽出 createDarkTheme → 共用）  🔴 唯一動到網頁版的一步，單獨 commit
└── vscode/
    ├── extension.ts          （擴充：訂閱 active editor／文件變更／設定變更）
    ├── panel.ts              （擴充：接線）
    ├── webview-html.ts       （＋ 'wasm-unsafe-eval'）
    ├── manifest.ts           （＋ configuration 宣告，language-overridable）
    ├── sync/
    │   ├── echo-guard.ts     ★ 純函式：我們產生的 version 集合
    │   ├── settings.ts       ★ 純函式：設定 → 組態（含語言覆寫的解析）
    │   └── view-state.ts     ★ 純函式：per-uri 視圖狀態、untitled → file 的搬遷
    └── webview/
        ├── main.ts           （＋ 工具箱／主題／同步／高亮／執行接線）
        ├── lift.ts           ★ Webview 裡的 parse ＋ lift（tree-sitter wasm）
        ├── highlight.ts      ★ 純函式：行 ↔ nodeId 的雙向反查
        └── fps.ts            （沿用）

tests/integration/            ★ 四塊純函式的測試
tests/probes/edit-blast-radius.test.ts   （改成 import src 的 rewriteSpan）
```

**Structure Decision**：沿用第一刀的 `src/vscode/`（護欄掃得到）。
🔴 **而範圍計算刻意放 `core/projection/` 不放 `src/vscode/`**
——它是純文字比對，**不認識任何宿主**，放進中立目錄讓網頁版也拿得到。

---

## 實作階段（🔴 **按使用者故事切，每段獨立可驗**）

> `history/072` 的病歷是「一次做很多而整體沒人看」。
> **每一個 Phase 結束都要能回答「使用者現在多做得到什麼」。**

### Phase A —— 四塊純函式（**唯一能完整 TDD 的一塊，先做**）

```
rewrite-span   去頭去尾取中間；🔴 而輸入是【文件文字】不是 generate(原樹)
echo-guard     我們產生的 version 集合；⚠️ 上界用【數量】不用時間
settings       設定 → 組態，含語言覆寫的優先序
view-state     per-uri 存取 ＋ untitled → file 的身分搬遷
```

**出口**：四塊全綠；探針改用 `src/` 的 `rewriteSpan` 之後**數字不變**。

### Phase B —— US6 外觀與工具箱（**先做它，因為後面每一個故事都要看得見**）

```
抽出 createDarkTheme()   🔴 單獨 commit ＋ 立刻跑全套
Blockly.inject 補齊七項   renderer/theme/grid/zoom/toolbox
buildToolbox 接上         需 visibleConcepts／ioPreference／categoryColors
```

**出口**：面板有工具箱、深色、與網頁版一致 → **SC-009**。

### Phase C —— US1 blocks → code（範圍編輯 ＋ undo）

**出口**：改一顆積木只重寫那一段、一次修改一個復原步驟、拖位置不改檔案
→ **SC-001／002／003**。

### Phase D —— US2 code → blocks（lift ＋ 防迴圈）

```
Webview 裡跑 tree-sitter   ⟹ 此時才加 'wasm-unsafe-eval' ＋ wasm 進封包
echo-guard 接上            🔴 零個時間等待
```

**出口**：貼一段程式積木重畫且**停下來** → **SC-004／005**。

### Phase E —— US3 雙向高亮

**出口**：點積木照亮程式碼、移游標選取積木、沒有迴圈 → **SC-006**。

### Phase F —— US4 單步執行

```
🔴 原生編輯器只是 ExecutionAtNodeEvent 的第三個視圖——不要另外發明機制
```

**出口**：單步 N 次積木高亮換 N 次、程式碼側同步 → **SC-007**。

### Phase G —— US5 設定 ＋ US7 視圖狀態

**出口**：專案設定與語言覆寫都生效、切分頁回來原位 → **SC-008／010**。

### Phase H —— US8 回歸 ＋ 交棒

```
全套綠 · 護欄基線零變動 · 中立性 0 · 探針 0.07%／0 漂移 · tsc 過
建置 ＋ 裝進 VSCode 與 Arduino IDE
🔴 交棒：使用者要按鍵與拖曳的那幾條
```

**出口**：**SC-011／012**。

---

## 🔴 驗證的分工——**與第一刀相同的誠實**

| 類別 | 誰 | 怎麼驗 |
|---|---|---|
| 範圍計算／身分比對／設定解析／視圖狀態 | 🟢 我 | 單元測 |
| 網頁版不退步 | 🟢 我 | 全套 ＋ 護欄 ＋ 探針 |
| 積木畫得出來、工具箱、主題 | 🟢 我 | Chromium 預檢（`tools/vscode-preflight/`） |
| **改積木→檔案真的變了、undo、游標、摺疊** | 🔴 **使用者** | 在真的 VSCode 裡操作 |
| **單步時看得見積木依序亮** | 🔴 **使用者** | 同上 |

> **一個做不到的驗收，處置是把它交出去並讓它變容易，
> 不是換一個我做得到的驗收。**

**處置**：面板的讀數要顯示**這一次改了幾行、是不是回音、目前哪個節點**
——讓交棒那一步只需要照著看。

---

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| **憲法 I：一次做完八個故事** | 使用者拍板（2026-08-17）。而它有理：一顆能顯示不能編輯的積木**沒有使用者**，分刀交付的中間態**沒有人能用** | 「先做雙向同步，其餘下一刀」——❌ 使用者明確否決。🟢 **處置不是縮範圍，是讓每個故事獨立可驗**，而 Phase B 先做外觀正是為了讓後面每一步都看得見 |
| **憲法 II：兩類驗收測不到** | 「在 Electron 桌面應用裡按鍵與拖曳」——我驅動不了 | 「寫 Chromium e2e 宣稱覆蓋」——❌ 那是 `history/076` 那個錯的形狀（在 A 環境驗、宣稱 B 環境成立）。🟢 處置：把測得到的切出來 TDD，測不到的**明說並讓它變容易** |
| **動到共用檔 `blockly-panel.ts`** | `createDarkTheme()` 今天是 private，而 Webview 要同一個主題 | 「在 Webview 裡複製一份主題」——❌ **兩份會漂移**，而 `history/072` 正是那個病。🟢 處置：單獨 commit ＋ 改完立刻跑全套 |
| **CSP 多一個 `'wasm-unsafe-eval'`** | `code → blocks` 要在 Webview 裡跑 tree-sitter | 「解析放主行程」——❌ lift 需要膠囊登錄表，而那是 esbuild/CJS 坑的正中央（`registry.ts:22-48`）。🟢 而 `'wasm-unsafe-eval'` **嚴格窄於** `'unsafe-eval'`；⚠️ 驗收要釘死「只加這一項」 |
| **封包 456 KB → 約 4 MB** | tree-sitter 的 wasm 要進封包 | 「執行期下載」——❌ 離線就壞，而第四十五條護欄守的正是「執行期零外部請求」 |

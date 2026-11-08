# Research: 操作者介面第一刀——「提議中」的變更

> 2026-11-09。每一條附程式碼位置（worktree 368 當下）。

## R1 · 接受時怎麼把樹換進去

- **Decision**：`bus.emit('edit:tree', { viewId: 'proposal', tree })`。
- **Rationale**：`SyncController.handleEditTree`（`src/core/sync/sync-controller.ts:528`）把舊樹推進樹層級的歷史（`past`，上限 50，`structuredClone`）、清 `future`、`applyTree` 產碼＋補丁器（補 include）＋重畫積木，再發 `semantic:update`（`originViewId: 'proposal'`）——每一個視圖的 id 都不是 `'proposal'`，所以全部重畫（`src/panels/blocks/view.ts:269`）。節點 id 原樣保留（不重新 lift）。
- **Alternatives**：`generateCode → codeView.setCode → syncCodeToBlocks`（套範例與換風格走的路，`app.ts:3024`）——會重新 lift、全部換號、不進樹的歷史，接受後連鎖讓所有其他提議過期；不選。
- ⚠️ `handleEditTree` 在 `syncing` 中會直接 return（丟掉，不排隊）——接受要先確認沒在同步，否則回報失敗、提議留在佇列。

## R2 · 復原

- **Decision**：`App.lastEditor` 加一個值 `'proposal'`，`doUndo`／`doRedo` 對它走 `undoTree`／`redoTree`（同 `'flow'`）。
- **Rationale**：今天一對按鈕依 `lastEditor` 分派（`app.ts:3394-3409`）；不改的話接受後按復原會去叫 Blockly 的（已被重畫清空的）堆疊。VSCode 的程式碼是對文件 `applyEdit`（`vscode-code-view.ts:495`），IDE 自己的復原也成立。
- **Alternatives**：直接設成 `'flow'`——語意上說謊（不是流程面板改的），不選。

## R3 · 樹什麼時候會換號（決定「過期」有多常見）

| 動作 | 節點 id | 位置 |
|---|---|---|
| 改程式碼 → lift | 全部新的 | `pattern-lifter.ts:333`、`lifter.ts:558` |
| 改積木 → 抽取 | 盡量保留（`_blockIdToNodeId`） | `view.ts:1147-1160` |
| 流程面板 `edit:tree` | 保留 | `app.ts:2008` |
| 套範例、換語言／目標、換風格 | 全部新的（重新 lift） | `app.ts:1274-1296`、`2905-2937`、`3024` |
| 樹的復原／重做 | 回到舊的 id | `sync-controller.ts:509` |

- **Decision**：過期判準 = 提議引用的每一個節點 id 在目前的樹上存在、且 componentId 與送出時的快照相同；**加上**整串操作在目前的樹上仍套得過（R5 的檢查）。不做依形狀重新對位（`carryTypes` 是現成的近似，但那是「猜」——第一刀照實過期）。
- **Hook**：沒有專門的「樹變了」事件；每一條改 `currentTree` 的路都以 `semantic:update` 收尾（`view-host.ts` 的 `SemanticUpdateEvent`）→ 佇列訂閱它重新檢查。

## R4 · 問元件宣告

- 存在：`componentTraits`／登錄表（`src/core/component/registry.ts:112` 的 `registeredComponents()`）；非膠囊（std 模組）在語言套件的 `declarations().components`——核心不得 import `languages/`（audit-layering），**由呼叫端注入**一個 `knows(componentId)`／`declOf(componentId)`。
- 接點：`slotDeclsOf(id)`（`slot-check.ts:94`，含 min／max）、`fitsSlot(child, allowed)`（`:119`）。
- 屬性：`paramSpecs(manifest.properties)`（`param-spec.ts:36`）；值型別 `PropertyValue = string | number | boolean | string[]`（`types.ts:3`）。
- 根：`isProgramRoot(componentId)`（`traits.ts:226`）——不寫死任何元件名字（audit-neutrality）。
- **Decision**：驗證器 `validateOps(tree, ops, schema)`，`schema` 是一個小介面 `{ known(id), slots(id), props(id), isRoot(id) }`；App 用登錄表＋語言套件組出來，單元測試直接用真的元件宣告（`allCppComponents()`，audit-declaration-assembly）。

## R5 · 結構操作的語意

- **Decision**：
  - `insert {parent, slot, index, node: NodeSpec}`：`NodeSpec = {componentId, properties?, slots?: Record<string, NodeSpec[]>}`，新節點的 id 由系統發（`generateId`）——操作者不給 id。
  - `remove {node}`、`move {node, parent, slot, index}`（index 以**移除之後**的那個接點計）、`setProperty {node, name, value}`。
  - `index` 可等於長度（接在最後）；超出 → 拒。
  - 後面的操作可以引用前面插入的節點嗎？第一刀**不行**（操作者不知道新 id）；要插一棵子樹就在 `NodeSpec.slots` 裡一次給。
- 拒絕的條件：節點不存在、元件不認得（含 `NodeSpec` 子孫）、接點不是那顆元件宣告的、子節點不合那個接點的 `allowed`、超過 `max`、屬性未宣告或值型別不對、刪移根、移到自己的子孫、空提議。
- 全有或全無：在 `structuredClone` 的副本上逐步套用，任何一步失敗回傳 `{ok:false, step, reason}`。

## R6 · 差異

- **Decision**：產碼用 `generateCode(tree, language, style)`（`code-generator.ts:178`）＋補丁器 `syncController.patchMissingDependencies`（`sync-controller.ts:449`），讓改前／改後與程式碼面板顯示的一致；行差異用 `alignLines`（`patch-shift.ts:54`，LCS）組出 `+／-／ ` 三種行（純函式放核心；重用而非複製——audit-shared-file-husks）。
- **Alternatives**：Monaco diff editor——repo 沒用過、要多一個編輯器實例與兩個宿主的版面；第一刀的差異是幾行，不選。

## R7 · 介面

- **Decision**：一條提議列（`src/ui/proposal-bar.ts`），仿 `style-action-bar.ts` 的非阻斷列，但內容多了作者、理由、差異（`<pre>` 帶 `+`／`-` 著色）、「還有 N 個在等」、接受／退回；過期時接受停用、顯示原因。掛在 `document.body`，兩個宿主共用 App 所以都有。
- **Alternatives**：做成一個面板（`src/panels/<id>/panel.ts`）——要動版面層、panels-only 打包護欄；提議是暫時的、有就出現，列比較符合。之後要常駐（歷史、委派）再升格成面板。
- 文案走 `msg(key, fallback)`；不得用原生 `confirm`（audit-no-native-dialog）。

## R8 · 程式化入口

- **Decision**：`App.proposals`（一個 `ProposalQueue` 的門面）：`submit(input) → {id, status, reason?}`、`list()`、`get(id)`；**不提供** `accept`／`reject` 給外部（FR-013：操作者不能替人接受）——接受與退回只在列上的按鈕。測試用 `__app.proposals.submit(...)`（`src/main.ts:22` 的 `window.__app`），e2e 按按鈕。
- VSCode 外部 AI 經延伸模組送訊息（`messages.ts` 新增一種 `HostMessage`）**延後**：spec 的 Assumptions 已列；webview 裡的 `__app` 一樣可用。

## R9 · 護欄

- audit-layering：`src/core/proposals/` 不 import ui／languages／components／providers；`src/ui/proposal-bar.ts` 只 import core。
- audit-portable-core：核心無 DOM。
- audit-tests-import-reachable：模組要真的接進 App（從 `src/main.ts` 可達）。
- audit-four-independences：不新增 `codeView.*`／`blocklyPanel.*` 直接呼叫——接受走匯流排。
- audit-neutrality：不寫死元件名。
- `src/core/README.md` 的子目錄表加一列。

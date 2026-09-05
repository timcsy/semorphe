# Implementation Plan: 骨架在積木那側上匯流排

**Branch**: `172-scaffold-on-bus` | **Date**: 2026-09-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/172-scaffold-on-bus/spec.md`

## Summary

一個「哪幾顆是骨架」的事實今天有兩條路：流程視圖走匯流排，
積木視圖走**組裝點直接呼叫**。這一刀讓積木那側也走匯流排，並加一條護欄擋回頭路。

**技術取徑**（查證見 [research.md](research.md)）：

```
真相那側   SyncController 多一支「重發骨架告示」
           ——發 semantic:update，帶 tree ＋ code ＋ scaffold，【不帶 blockState】
積木那側   onSemanticUpdate 讀 event.scaffold，套用到自己身上
           ——⚠️ 在重畫那道閘門【之外】，因為套骨架不需要重畫
組裝點     remarkScaffold() 退場；改成叫真相那側重發
護欄       .markScaffoldBlocks( 出現在 blockly-panel.ts 以外 → 紅
```

🔴 **不帶 `blockState` 是整個設計的樞紐**：積木面板的重畫本來就閘在它上面
（`blockly-panel.ts:214`），所以不帶它就等於「只套骨架，不重畫」
——而重畫會打斷拖曳、清掉復原堆疊。

## Technical Context

**Language/Version**: TypeScript 5.x

**Primary Dependencies**: Blockly 12.4.1（積木）· 既有的 `SemanticBus` / `ViewHost`

**Storage**: N/A（這一刀不碰持久化）

**Testing**: Vitest（單元 ＋ 護欄）· Playwright（e2e）

**Target Platform**: 網頁版（`src/ui`）· ⚠️ VSCode／Theia 那側**不受影響**
（骨架標記是積木面板內部的事，而積木面板在兩邊是同一支）

**Project Type**: 瀏覽器內的編輯器

**Performance Goals**: 無新增——⚠️ 而**要確認沒有退步**：
新的發布點每次深度變更發一則事件，而深度變更是使用者動作（低頻）

**Constraints**:
- 🔴 **外觀逐字不變**（三段鷹架 × 積木的透明度／可拖曳性／數量）
- ⚠️ **拖曳不得被弄壞**（`markScaffoldBlocks` 會動 `setDragStrategy`）
- ⚠️ 既有的 `setTimeout(…, 900)` 時序**不得縮短**（`app.ts:757` 記著它踩過的雷）

**Scale/Scope**: 3 個檔案改動（`sync-controller.ts` · `blockly-panel.ts` · `app.ts`）
＋ 1 條新護欄 ＋ 1 支 e2e

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 憲章條款 | 判定 | 依據 |
|---|---|---|
| **I. 簡約優先** | 🟢 過 | 這一刀**淨刪**：`remarkScaffold()` 退場、`markScaffoldBlocks` 從對外變內部。新增只有一支發布方法 ＋ 一條護欄。⚠️ 不做 `markScaffoldBlocks` 那 200 行的重構（spec Out of Scope 有寫） |
| **II. TDD（非妥協）** | 🟢 過 | 護欄先寫（它會**當場紅**在今天的 `app.ts:2005` 上）；e2e 先寫（三段鷹架 ＋ 拖曳，它們今天就該綠——那是「外觀不變」的基線） |
| **III. Git 紀律** | 🟢 過 | 三段：① 護欄＋e2e（紅）② 實作（綠）③ 棘輪下調＋知識庫 |
| **IV. 規格文件保護** | 🟢 過 | spec 不因實作困難而改；真的要改要留下為什麼 |

🔴 **Re-check after Phase 1**：見本檔末〈設計後複查〉。

## Project Structure

### Documentation (this feature)

```text
specs/172-scaffold-on-bus/
├── plan.md              # 本檔
├── research.md          # Phase 0：三條查證 ＋ 那個難點的決定
├── data-model.md        # Phase 1：那則事件的形狀
├── quickstart.md        # Phase 1：怎麼驗這一刀真的做到了
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks 產
```

⚠️ **沒有 `contracts/`**——這一刀不新增任何對外介面。
`SemanticUpdateEvent` 的形狀**一格都不改**（`scaffold` 早就在了）。

### Source Code (repository root)

```text
src/
├── core/
│   └── sync-controller.ts        # ➕ 一支「重發骨架告示」
├── ui/
│   ├── app.ts                    # ➖ remarkScaffold() 退場
│   └── panels/
│       └── blockly-panel.ts      # ➕ onSemanticUpdate 讀 event.scaffold
│                                 # 🔁 markScaffoldBlocks 改成內部
tests/
└── integration/
    └── audit-scaffold-on-bus.test.ts   # ➕ 新護欄（含注入測試）
e2e/
└── scaffold-modes.spec.ts        # ➕ 或併進既有的鷹架 e2e
```

## 實作順序（TDD）

### ① 先紅

1. **新護欄**：掃 `src/`，`.markScaffoldBlocks(` 在 `blockly-panel.ts` 以外
   → 報檔名 ＋ 行號。**今天跑它會紅在 `app.ts:2005`**——那是這條護欄的「先紅」。
2. **注入測試**（第四十九條）：合成一份含那一行的輸入 → 必須報得出來；
   合成一份乾淨的 → 不得報。
3. **e2e 基線**：三段鷹架的外觀 ＋ 拖曳。⚠️ **它們今天就該綠**
   ——這一刀的驗收是「它們改完之後還是綠」。

### ② 再綠

4. `SyncController` 加「重發骨架告示」：發 `semantic:update`，
   帶 `tree`（現在那棵）＋ `code` ＋ `scaffold: this.scaffoldNotice(tree)`，
   `source: 'resync'`，**不帶 `blockState`**。
5. `BlocklyPanel.onSemanticUpdate` 讀 `event.scaffold`：
   🔴 **放在 `if (!mine && event.blockState)` 那道閘門【之外】**
   ——套骨架不需要重畫，而閘門是為重畫設的。
6. `markScaffoldBlocks` 改成內部（`private`）。
7. `app.ts` 的 `remarkScaffold()` 退場；`markOutOfScopeBlocks()` 裡那一行
   改成「叫真相那側重發」。
   ⚠️ **那個 `setTimeout(…, 900)` 保留**——它擋的是「換目標途中」那個雷，
   與這一刀無關。

### ③ 收尾

8. `audit-four-independences` 的方法呼叫數**下調**（顯式，寫進 commit）。
9. `view-host.ts:104` 那條「⚠️ 積木那一側今天還走組裝點直接呼叫」**改寫**
   ——它記的是債，而債清了。改成記「為什麼是這個形狀」。
10. `vision.md` 那一筆打勾 ＋ `history/` 一筆轉變。

## 風險與緩解

| 風險 | 緩解 |
|---|---|
| 🔴 **拖曳被弄壞**（`markScaffoldBlocks` 會動 `setDragStrategy`） | e2e US2：三段模式下各拖一次 |
| 🔴 **時序**：新的事件比 `getVisibleComponents()` 早到 → 整個畫布變淡 | 保留 `setTimeout(…, 900)`；**不縮短、不移除**。`app.ts:757` 記著這個雷 |
| ⚠️ 流程面板收到不帶 `blockState` 的更新 | 它不讀 `blockState`（`flow-panel.ts:968` 只讀 `tree`／`scaffold`／`code`／`mappings`），會 `rebuild()` 一次——那是它本來每次都做的 |
| ⚠️ 面板還沒建好就收到事件 | 沿用既有機制（視圖登錄表統一派送，`blockly-panel.ts:434`）——這一刀不動它 |

## 設計後複查（Constitution re-check）

| 條款 | 判定 | 說明 |
|---|---|---|
| **I. 簡約優先** | 🟢 | 設計出來之後淨行數仍然是負的：一支新方法（約 10 行）換掉一支舊方法 ＋ 一個 public 介面 |
| **II. TDD** | 🟢 | 護欄的「先紅」不是合成的——**它今天就紅在真的那一行上** |
| **III. Git 紀律** | 🟢 | 三段 commit |
| **IV. 規格保護** | 🟢 | 設計沒有改動任何 FR／SC |

🔴 **一個沒有被設計解掉的東西**：`markOutOfScopeBlocks()` 仍然同時做兩件事
（超出範圍 ＋ 叫真相重發骨架）。拆開它**不在這一刀**——
它的呼叫點有 6 個，而 spec 的 Out of Scope 明說「超出範圍的標記是另一件事」。
⚠️ 這一句要留在 `history/` 裡，不然下一個人會以為它被漏掉了。

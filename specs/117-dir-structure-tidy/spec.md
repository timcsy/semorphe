# Feature Specification: 目錄結構的四件小整理

**Created**: 2026-08-12
**設計脈絡**: [draft/2026-08-12-目錄結構對硬體的適配](../../knowledge/draft/2026-08-12-目錄結構對硬體的適配.md)
**Roadmap**: `knowledge/vision.md`「目錄結構的四件小整理（2026-08-12 拍板，硬體之前）」

## 這是什麼

使用者的觀察：「`src` 底下除了 `components` 還是一堆東西，沒有按功能拆分的感覺，
而且好像有重複的東西散在各地。」

查證之後，**結構本身不亂**——`src/` 頂層混了三種切法（按層／按擴充點／按東西的種類），
而三種在不同軸上各自成立。真正的問題只有**四個具體點**，而它們的共同形狀是：

> **一個資料夾的名字，與它實際裝的東西對不上。**

⚠️ 而這不是美觀問題。硬體域即將進來（`scope: hw` 的白名單已經預留），
一個名不副實的資料夾在那時會變成**放錯東西的預設位置**。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 一個新來的人打開 `src/blocks/` (Priority: P1)

**現況**：他預期看到積木定義，實際看到四份**存檔遷移的凍結明表**與一份插槽名，
外加兩個空目錄。

**為什麼是 P1**：這是四項裡唯一「現在就是錯的」——與硬體無關，
不需要等任何第二個實作來告訴我們對的名字。

**驗收**：
1. 資料夾的名字說得出它裝什麼
2. `src/` 底下沒有空目錄
3. 所有 import 路徑跟著更新，`tsc` 綠

### User Story 2 - 存檔遷移表只有一份 (Priority: P1)

**現況**：`id-migrations.ts` 與 `block-input-names.ts` 各有兩份，
分別住在 `src/blocks/` 與 `src/languages/cpp/`，靠 `UNIVERSAL_` / `CPP_` 前綴分開。

**而分裂的依據已經消失**：那個依據是 `layer: universal`（「這顆概念是通用的」），
而它今天**零生產消費者**（查證見 `draft/2026-08-11-universal是一份還沒被驗證的外延主張.md`）。

**⚠️ 這是四項裡風險最高的一項**，理由見 Edge Cases。

**驗收**：
1. 兩個名字各只剩一份檔案
2. **凍結明表的內容逐字不變**——`git diff` 只顯示位置變動，沒有一個字元的內容變動
3. 舊版存檔仍然升得上來（實測，不是只有測試綠）

### User Story 3 - 視圖的驗證假設不再需要一個頂層目錄 (Priority: P2)

**現況**：`src/views/` 只有一個檔（36 行），註解逐字說它存在的理由是
「verify that the concept/blockDef split enables views independent of the Blockly projection layer」。

**它成功了**——而它證明的那件事現在由 `ViewHost` 契約與視圖登錄表
（`src/core/view-registry.ts`）持續證明著。**一個假的實作完成任務之後，
繼續佔一個頂層目錄，會讓讀者以為那是一個產品層。**

**驗收**：`src/views/` 消失，而它保護的那個性質仍有東西在保護。

### User Story 4 - 2D 面板進來時有一個乾淨的位置 (Priority: P2)

**現況**：`ui/` 頂層站著兩個 **Blockly 專屬**的檔（`block-registrar.ts` 2296 行、
`toolbox-builder.ts`），與通用的 UI 骨架（`app-shell`、`layout/`）平起平坐。

**為什麼現在做而不是等**：這一項的**成本會隨推遲增加**
（`experience.md`「一件『該做但不急』的事」的判準）——2D 面板進來時若沒分，
它會長在混亂裡，而那時要分就得同時搬兩邊。

**驗收**：`ui/` 頂層沒有 Blockly 專屬檔。

### Edge Cases

- **⚠️ 凍結明表被「順手整理」**：合併兩份 `id-migrations` 時，最自然的動作是
  排序、去重、統一格式。而那些表記的是**歷史事實**（「v2 那時存在哪些身分」）。
  `experience.md`「一次改名要問兩件事」記過一次翻車：改名腳本誤傷凍結明表
  → **真實使用者的舊存檔升級不了**。
  → **本規格明文禁止**：只准搬家，不准排序／去重／補註解／改格式。

- **`universal.ts` 不是遷移表**：`src/blocks/` 五個檔裡有一個是
  「通用積木的唯一入口」（19 行），性質與其餘四個不同。
  它該跟著遷移表走，還是留在別處？→ 見 Assumptions。

- **import 路徑牽動範圍**：`src/blocks/` 被 20+ 個檔 import（含 `tests/`）。
  改名必須一次改完，否則 `tsc` 會紅一路。

- **e2e 的存在改變了驗證方式**：這次有 6 支 Playwright 可以驗「使用者看到的
  是不是對的」。⚠️ 而存檔升級**不在那 6 支涵蓋範圍內**——要另外實測。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**：`src/blocks/` 更名為對得上內容的名字；所有 import 路徑更新
- **FR-002**：`src/blocks/projections/` 與 `src/blocks/semantics/` 兩個空目錄刪除
- **FR-003**：`id-migrations` 的兩份合併為一份
- **FR-004**：`block-input-names` 的兩份合併為一份
- **FR-005**：⚠️ FR-003／FR-004 執行時，**凍結明表的內容逐字不變**
- **FR-006**：`src/views/semantic-tree-view.ts` 移出 `src/`；其測試跟著移動
- **FR-007**：`ui/block-registrar.ts` 與 `ui/toolbox-builder.ts` 移入 `ui/blockly/`
- **FR-008**：本次不改變任何**執行期行為**——只有檔案位置與 import 路徑改變

### Key Entities

| | 是什麼 | 為什麼要小心 |
|---|---|---|
| **凍結明表** | `id-migrations`／`block-type-migrations`／`merged-identities` | 記的是**歷史事實**，不是設定。改一筆 = 一批舊存檔升不上來 |
| **插槽名** | `block-input-names` | 積木定義與動態註冊的**唯一真相**；兩處必須同步 |
| **通用積木入口** | `universal.ts` | 已蓋 owner 章的唯一入口，被 8+ 處 import |

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**：`src/` 底下的空目錄數 = **0**
- **SC-002**：`id-migrations` 與 `block-input-names` 這兩個名字，在 `src/` 底下
  **各只出現一次**
- **SC-003**：凍結明表的**內容 diff = 0 行**（位置變動不計）
- **SC-004**：`ui/` 頂層的 Blockly 專屬檔數 = **0**
- **SC-005**：`npx tsc --noEmit` 無錯誤
- **SC-006**：`npm test` 全綠（基準：3956 passed）
- **SC-007**：`npm run test:e2e` 全綠（基準：6 passed）
- **SC-008**：⚠️ **一份舊版存檔載入後，積木與程式碼都正確還原**
  ——實測，不是只有測試綠

## Assumptions

- **`src/blocks/` 的新名字**：採用 `src/migrations/`。
  理由：五個檔裡四個是遷移表，而第五個（`universal.ts`）**不屬於這裡**
  ——它是「通用積木的唯一入口」，性質接近 `languages/`。
  → 假設：`universal.ts` 移到 `src/languages/universal.ts`，
  與 `languages/style.ts`（既有的語言中立檔）同層。
  ⚠️ 若此假設被否決，`blocks/` 改名為 `migrations/` 仍成立，
  只是 `universal.ts` 留在原處會變成一個孤兒。

- **合併的方向**：以 `languages/cpp/` 那份為主檔（它比較大：358 vs 147、56 vs 85），
  把 `blocks/` 那份的內容**原樣附加**進去。理由是減少移動的行數 = 減少誤傷面。

- **`ui/blockly/` 的邊界**：只移動「不認識 Blockly 就沒有意義」的檔。
  `blockly-panel.ts` **留在 `ui/panels/`**——`panels/` 這個切法是按角色分的，
  而它在那個軸上是對的（2D 面板將來也會在那裡）。

- **本次不碰**：`interpreter/` 改名、`languages/` 重切、`block-registrar` 的宣告化。
  三者的理由分別是「等硬體」「等 Python」「卡在設計決定」，
  見 `draft/2026-08-12-目錄結構對硬體的適配.md` §四。

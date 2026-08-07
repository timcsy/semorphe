# Feature Specification: 元件身分的引用完備性——程式碼不得建出登錄表裡沒有的身分

**Feature Branch**: `101-component-id-integrity`

**Created**: 2026-08-07

**Status**: Draft

**路線圖位置**: 階段 6.5 的 **C3**（C 於 2026-08-07 拆成 C1／C2／C3）

---

## ⚠️ 先講一處 re-route：機制從「branded type」改成「引用完備性護欄」

功能描述要求把 `conceptId: string` 改成 branded type，驗收是

> 「`const x: ComponentId = 'typo'` **編譯失敗**」

**那句話是真的，而它達不到它宣稱的目的。** 標題寫的是「讓編譯器攔得住**打錯的** componentId」，
而 branded type 攔不到打錯的——

```ts
componentId('cpp_priority_queue_declair')   // ← 編譯完全通過
```

branded type 攔的是「**這個字串沒有經過建構入口**」，不是「**這個身分不存在**」。
兩者差很遠，而症狀一模一樣：都是一個 `string`。

### 而「不存在的身分」不是假想的風險——今天就有四筆

實測（`createNode()` 建出的身分，比對登錄表的 175 顆）：

| 幽靈身分 | 哪裡建的 | 是什麼 |
|---|---|---|
| **`var_declare_expr`** | `extractors/extract-strategies.ts:126` | ⚠️ **B 項（098）把它併進 `var_declare` 了**，而這條抽取路徑還在生產它 |
| **`cpp_priority_queue_declare`** | `core/lifters/strategies.ts:656` | 容器對照表指向一顆**從來不存在**的元件 |
| **`cpp_initializer_list`** | `core/lifters/strategies.ts:62` | 有產生器（`declarations.ts:106`），**沒有概念定義** |
| **`param_decl`** | `core/lifters/strategies.ts:359`（＋2 處） | 結構化參數節點，**沒有概念定義** |

實測驗證（`priority_queue<int> pq;` 走完辨識）：

```
樹裡的 conceptId 數: 8
⚠️ 登錄表裡不存在的: cpp_priority_queue_declare
```

**四筆沒有一筆會被 branded type 攔到**——它們都是合法的字串，只是指向不存在的東西。
而它們**全部**會被「引用完備性」攔到。

### 所以本規格做的是後者

| | branded type | 引用完備性護欄 |
|---|---|---|
| 攔得到今天這四筆嗎 | ❌ 一筆都攔不到 | ✅ 四筆全部 |
| 改動範圍 | **106 個檔**（`conceptId: string` 出現 155 次，含 49 個測試檔） | 一支護欄 ＋ 四筆修正 |
| 對 D（命名空間遷移）的幫助 | 逼所有建構走同一入口 | **先確定「用到的身分集合」＝「宣告的身分集合」**——沒有這一步，D 的改名會把幽靈一起改名 |

**branded type 沒有被否決，是被降級為「等它有指涉物再說」**——見 Out of Scope。

---

## User Scenarios & Testing

### User Story 1 — 學生拖出來的積木不會產出一個沒人認識的東西 (Priority: P1)

一個學生從工具箱拖出「宣告變數（運算式版）」，接上數值。系統把它變成語義樹。
**那棵樹裡的每一顆節點，都必須是登錄表認得的元件。**

**Why this priority**：`var_declare_expr` 今天就是壞的——B 項把身分併掉了，
而抽取路徑還在生產舊身分。**存檔轉換救不了它**，因為轉換只在載入時跑，
而這是**新產生**的節點。

**Independent Test**：走一次 積木 → 語義樹，掃出每個 conceptId，比對登錄表。

**Acceptance Scenarios**：

1. **Given** 任何一顆工具箱裡的積木，**When** 抽取成語義樹，**Then** 樹裡每個身分都在登錄表裡
2. **Given** 任何一段可辨識的 C++，**When** 辨識成語義樹，**Then** 同上
3. **Given** 一個身分被合併掉（如 B 項），**When** 還有程式碼在生產舊身分，**Then** **出聲**

---

### User Story 2 — 加一顆元件時，忘了寫概念定義會當場知道 (Priority: P1)

維護者寫了 lifter、寫了 generator，**忘了寫 `concepts.json`**。
今天的結果是：那顆元件對所有護欄隱形——五路完備性不數它、就近性不數它、身分健檢不數它。

**Why this priority**：`cpp_initializer_list` 正是這個形狀（有產生器、沒定義），
而它**躲過了全部二十條護欄**。一顆隱形的元件比一顆壞掉的元件更難處理。

**Independent Test**：合成一個「建出未宣告身分」的程式碼路徑，確認被報出。

**Acceptance Scenarios**：

1. **Given** 一段建出未宣告身分的程式碼，**When** 跑護欄，**Then** 指名那個身分與檔案行號
2. **Given** 一個**內部哨兵**節點（`_compound`／`_multi_field` 這類），**When** 跑護欄，**Then** **不報**——那不是元件

---

### User Story 3 — 降級用的身分要**明確宣告**，不是靠命名慣例 (Priority: P2)

`raw_code`／`unresolved` 是降級時的退路，它們沒有概念定義是**刻意的**。
但今天分不出「刻意」與「忘了」——兩者都只是「不在登錄表裡」。

**Why this priority**：這是 `skipPaths` 同一種紀律。不做的話護欄會有四筆常駐雜訊，
而**常駐雜訊會讓人學會忽略整條護欄**。

**Acceptance Scenarios**：

1. **Given** 一個降級身分，**When** 跑護欄，**Then** 它在「明確宣告的非元件」欄，不在違規欄
2. **Given** 一個**沒有宣告理由**的未知身分，**When** 跑護欄，**Then** 算違規

## Requirements

### 引用完備性

- **FR-001**: 任何程式碼路徑建出的元件身分 MUST 存在於登錄表
- **FR-002**: 違反時 MUST 指名**身分 ＋ 建構它的檔案與行號**——只說「有 N 筆」修不了
- **FR-003**: **內部哨兵**（非元件的樹節點）MUST 可與元件區分，且判準 MUST 可機械判定
- **FR-004**: **降級身分**（`raw_code`／`unresolved` 等）MUST 明確宣告並附理由，MUST NOT 靠命名慣例推斷

### 今天那四筆

- **FR-005**: `var_declare_expr` 的生產路徑 MUST 改為產出合併後的身分
- **FR-006**: `cpp_priority_queue_declare` MUST 要嘛補齊成真元件、要嘛從對照表移除——**兩者都可以，不可以留著**
- **FR-007**: `cpp_initializer_list`、`param_decl` MUST 補概念定義，或明確宣告為內部節點

### 護欄

- **FR-008**: 護欄 MUST 用**硬性零**，MUST NOT 用棘輪
- **FR-009**: 護欄第一次跑 MUST 是紅的，且 MUST 指名上述四筆
- **FR-010**: 護欄 MUST 有雙向注入：合成的幽靈身分**必報**、合成的真身分**必不報**

### 不得退步

- **FR-011**: MUST NOT 動存檔格式（`CURRENT_VERSION` 不變）
- **FR-012**: 全套測試 MUST 綠；既有二十條護欄 MUST NOT 上升

## Success Criteria

- **SC-001**: 走完「所有工具箱積木 → 語義樹」與「所有辨識樣本 → 語義樹」，幽靈身分 **0**
- **SC-002**: 合成一個建出未宣告身分的路徑，護欄**指名它的檔案與行號**
- **SC-003**: 降級身分與內部哨兵各自有明確宣告，護欄的違規欄**零常駐雜訊**
- **SC-004**: `priority_queue<int> pq;` 這段程式碼的處置有明確結論（補齊或移除），且**測試釘住那個結論**
- **SC-005**: 全套綠，其餘護欄無一上升

## Out of Scope

- **branded type `ComponentId`**——降級為「等它有指涉物再說」。它攔不到今天這四筆，
  而代價是 106 個檔。真正能攔到打錯字的是**登錄表導出的字面聯集型別**（需要 codegen），
  那是另一個題目，且應在 D 之後評估（D 會改動全部 175 個值）
- **C1 參數規格化**（下一個 spec）
- **C2 資訊軸**（已延後，vision 已記）
- **D 命名空間遷移**——本規格是它的前置：**先確定「用到的」＝「宣告的」，再改名**
- **改欄位名 `conceptId` → `componentId`**——那是 D 的詞彙遷移

## Assumptions

- **「建出身分」的入口是 `createNode()`**：實測 `src/` 的 `createNode('...')` 共 8 個未宣告身分，
  而其他看似相關的字面（`registerExtractStrategy('u_if')`、`g.set('binary_expression')`）
  是**積木型別**與 **AST 節點型別**，不是元件身分。⚠️ 第一版掃描把它們混在一起報了 27 筆——
  判準必須先在已知答案上驗過（`build-guardrail` 第 6 步）
- **內部哨兵用底線前綴**（`_compound`／`_multi_field`）：這是現況的慣例，
  但 FR-003 要求判準可機械判定——若沿用前綴，那要成為**宣告的規則**而非默契
- **降級身分數量很少**（`raw_code`／`unresolved`），逐筆宣告成本低

## Risks & Mitigations

| 風險 | 來源 | 緩解 |
|---|---|---|
| 掃描器把積木型別／AST 型別當成元件身分 | 規劃階段第一版就報了 27 筆假的 | 判準先在已知答案樣本上驗（`var_declare` 真、`cpp_priority_queue_declare` 假） |
| 「補齊 vs 移除」`priority_queue` 選錯 | 它可能是有人想做而沒做完 | SC-004 要求**明確結論 ＋ 測試釘住**，不接受「先留著」 |
| 護欄有常駐雜訊 → 被忽略 | 四筆降級／哨兵身分 | FR-004 要求明確宣告，違規欄必須是零 |
| 補了概念定義但沒有五路 → 變成新的殼 | `cpp_initializer_list` 補定義後會進完備性統計 | 補定義的同時檢查五路，或明確 `skipPaths` 附理由 |
| 護欄第一次就綠 | 判準寫錯 | FR-009 明訂第一次必須紅且指名四筆 |

## 理論地基

- `knowledge/concepts/執行機構.md`「機制有了，沒人接上」**六個實例**——這一條決定了為什麼驗收是「幽靈為 0」而不是「型別存在」
- `knowledge/experience.md`「一支測著死程式碼的測試，綠燈與測著活程式碼的長得一模一樣」——`cpp_initializer_list` 有產生器卻沒有身分，是同族
- `knowledge/experience.md`「**一個沒有指涉物的設計，讀起來與一個有指涉物的完全一樣**」——branded type 的 re-route 正是這一條的第二次套用
- `knowledge/skills/build-guardrail` 第 6.5 步（第一次跑必須紅）、第 6.8 步（硬性零 vs 棘輪）、第 6 步（靜態判斷先在已知答案上驗）
- `knowledge/history/028`（B 項身分整併）——`var_declare_expr` 那筆是它留下的尾巴

# Research: 元件動詞改名——每個視圖一對 render／lift

量測日期：2026-10-31（`main` b4b11f5b 之後的 `181-view-paths`）。

## R1. 今天的宣告長什麼樣（母體）

349 顆元件（cpp 250、python 99）。`paths` 的鍵：

| 鍵 | 顆數 | 值 |
|---|---|---|
| `render` | 349 | `./forms/blocks.json` ×348、`null` ×1 |
| `extract` | 349 | `./forms/blocks.json` ×348、`null` ×1 |
| `generate` | 349 | `./generate.ts` ×346、`null` ×3 |
| `lift` | 349 | `./lift.ts` ×197、`./lift-pattern.json` ×145、`null` ×7 |
| `execute` | 349 | `./execute.ts` ×326、`null` ×23 |
| `liftStrategy` | 78 | `./lift-strategy.ts` |
| `formalize` | 102 | `./formalize.ts`（第 393 刀） |
| `_render_why`／`_extract_why`／`_generate_why`／`_lift_why`／`_execute_why` | 2／2／5／28／26 | 說明顯式的空 |

## R2. 誰讀這些鍵

| 讀取者 | 讀什麼 | 改法 |
|---|---|---|
| `src/core/component/types.ts` | `FivePath`、`FIVE_PATHS`、`paths` 的型別 | 換成視圖化的型別與「格子」列舉（見 data-model） |
| `src/core/component/registry.ts` | C3：五路全列、`null` 要有 `_why` | 換成視圖化的 C3（見 R4） |
| `src/core/component/paths.ts` | 「宣告了 generate／execute／lift／liftStrategy 的資料夾」對實作檔 | 改用格子查詢 |
| `src/core/component/judges.ts` | `PATH_JUDGE` 以五路＋formalize 為鍵、`SIX_PATHS` | 鍵改成格子名 |
| `tests/helpers/component-paths.ts` ＋ `tests/unit/core/component-paths.test.ts` | 每顆的路徑覆蓋表 | 改用格子 |
| `tests/integration/audit-judge-coverage.test.ts` ＋ 基線 `judge-coverage.json` | `byPath` 以舊鍵計數 | 鍵改名，數字不變（SC-005） |
| `tests/integration/audit-completeness.test.ts`、`audit-projection-home`、`audit-projection-loss`、`audit-lift-grammar`、`python-first-block` | 讀 `paths` 的某一路 | 改用格子查詢 |
| `tests/probes/studycpp-has-blocks`、`judge-coverage-execute` | 同上 | 同上 |
| `src/components/cpp/{string_empty,queue_back}/spec.test.ts`、`literal_char/lift.ts` | 註解或測試裡提到舊鍵 | 逐一看 |
| `tests/assets/declared-slots-decisions.json`、基線 `declared-slots.json`、`shared-file-husks.json` | 文字裡提到舊鍵 | 逐一看：判準用到的要改，純敘述的不動 |

## R3. 舊鍵 → 新位置（一對一）

- **Decision**：

  ```
  render         → views.blocks.render        _render_why   → views.blocks._render_why
  extract        → views.blocks.lift          _extract_why  → views.blocks._lift_why
  generate       → views.code.render          _generate_why → views.code._render_why
  lift           → views.code.lift            _lift_why     → views.code._lift_why
  liftStrategy   → views.code.liftStrategy
  formalize      → formalize（不動）
  execute        → execute（不動）              _execute_why  → _execute_why（不動）
  ```

- **Rationale**：設計 draft 五之五定案的形狀。`liftStrategy` 是「從程式碼辨識」的具名策略，屬於 `code` 視圖的 lift 那一側。
- **Alternatives**：平鋪（`renderBlocks`…）——被否決，視圖名被編進鍵名，加一個視圖就加兩個鍵（五之五）。

## R4. 「顯式的空」與「單向視圖」怎麼並存

- **問題**：今天的紀律（C3）是「每一路都要列出，沒有的寫 `null` ＋ `_why`」，用來分辨顯式的空與遺漏的空。
  而 spec 說「只能單向的視圖只寫 render」——若以「元件沒寫 lift」表示單向，遺漏的 lift 就會被當成單向而安靜放行。
- **Decision**：**雙向還是單向，是視圖的性質，不是元件的**。核心有一張視圖表（今天兩筆：`blocks` 雙向、`code` 雙向）。
  - 雙向視圖：`render` 與 `lift` 兩個鍵都 MUST 列出（`null` ＋ `_why` 合法）。
  - 單向視圖：`render` MUST 列出；`lift` MUST NOT 出現。
  - 未知的視圖名（不在表上）：擋下——加一個視圖就是在表上加一筆。
- **Rationale**：兩條紀律都保住；「加一個視圖」= 表上一筆 ＋ 各元件的宣告，不加動詞（SC-004 計的是動詞清單）。
- **Alternatives**：
  - 「沒寫 lift 就是單向」——會讓遺漏的空安靜放行（正是 C3 要擋的）。否決。
  - 每顆元件自己宣告方向——同一個視圖在不同元件上方向不同沒有意義。否決。

## R5. 改寫 349 個宣告的方式

- **Decision**：一次性的轉換腳本（放 scratchpad，不進 repo），逐檔改寫 `paths`，其餘欄位與順序不動；改完用 R1 的計數逐格比對（SC-003）。
- **Rationale**：P8 不留轉接層；一次性轉換不是產品的一部分。
- **Alternatives**：讓載入器同時讀新舊兩種——違反 P8，否決。

## R6. 判定者對照的鍵

- **Decision**：`PATH_JUDGE` 的鍵改成格子名：`blocks.render`、`blocks.lift`、`code.render`、`code.lift`、`execute`、`formalize`。
  `judgeOf` 與 `audit-judge-coverage` 照新鍵；基線 `judge-coverage.json` 的 `byPath` 鍵改名、數字逐一相同。
- **Rationale**：五之五：「`judges.ts` 的 `PATH_JUDGE` 鍵改成 `render.blocks`……（今天它已有 `render`／`lift` 兩個鍵，平鋪會撞號）」。
  採「視圖.方向」的順序以與宣告的巢狀順序一致（`views.blocks.render` → `blocks.render`）。

## R7. 知識庫要改的文字

- `principles.md` P2 原文與最終檢驗表那一列（五之四第 1 條的定案文字）。
- `concepts/元件.md` 第 23 行起的五槽表與名詞表：槽位「身分・接點・參數・形態・形式」；「行為」留在投影族的說明裡。
- `concepts/元件代數.md` 完備性 ⑤：「∃ execute path」→「formalize 存在」。
- 新增 history（下一個編號）：「元件的動詞改成每個視圖一對 render／lift；行為槽換成形式槽」，連回 306（元件不再自帶 execute）與五之四、五之五。

# Research：宣告了的接點在積木上表達不出來

**Date**: 2026-08-14

---

## Q1：12 筆的逐筆分組——而它比 spec 假設的多一種

spec 假設兩種子機制。**實測是三種**：

| 子機制 | 積木定義在哪 | 例 | 成本 |
|---|---|---|---|
| ① **JSON 是唯一真相，而缺 input** | `forms/blocks.json` | `string_declare`（只有 `NAME` 欄位） | 🟡 中 |
| ② **有動態插槽而沒宣告對映** | JSON ＋ `dynamicRules` | （待逐筆驗） | 🟢 低 |
| ③ 🔴 **積木在別處命令式產生** | `block-registrar.ts` 或手寫 strategy | `vector_declare`／`var_declare` | 🔴 高 |

### 證據

```
string_declare   forms/blocks.json 的 args0 = [{field_input, NAME}]
                 而 block-registrar 裡【沒有】它 → JSON 就是真相
vector_declare   forms/blocks.json 的 args0 = []（空）
                 block-registrar.ts:558 有 Blockly.Blocks['cpp_vector_declare']
                 實際 inputs = HEAD／TAIL（dummy）＋ EXPR{i}（動態，對 values）
                 🔴 沒有 source／size／fill
var_declare      兩個形態：expression 版有 INIT_0；statement 版 args0 = []，
                 renderMapping.strategy = 'cpp:renderVarDeclare'（手寫）
```

⚠️ **③ 正是 `CLAUDE.md` 記的雙重真相陷阱**：
「`universal.json` blockDef 和動態註冊定義相同積木的 input names。
**修改任一方時必須同步另一方。**」

### 🔴 決策 1：**每一顆元件是一個獨立的交付**，不是「一次清 12 筆」

- **Rationale**：三種子機制的修法**完全不同**（改 JSON ／ 加 `dynamicRules` ／
  改命令式註冊 ＋ 同步 extractor）。混在一次交付裡的話，
  **一顆出問題會讓其餘的無法二分**。
- ⚠️ 而 `experience`「一份按症狀分類的清單會把同一個根因寫成好幾筆」
  的**另一半**在這裡生效——`build-guardrail` 逐字：
  「**一叢違規看起來像一個根因，而那是假設不是結論**」。
  **根因是同一個（宣告與形態沒有執行機構），而修法不是。**
- **Alternatives considered**：
  - **一次全清** ❌ 見上，無法二分
  - **只改宣告（把接點降級成參數）** ❌ 那是「用宣告刷數字」
    ——`build-guardrail`：「用宣告刷數字看起來會像進步」

---

## Q2：改積木長相會不會動到存檔遷移

```
新增 input   舊存檔的積木 XML 沒有那個 input  →  Blockly 載入時忽略缺的 input
             ⚠️ 而【不會】報錯，也不會遺失既有欄位
移除／改名   🔴 會——而本功能【只新增】
```

### 決策 2：**只新增插槽，不改名、不移除**

- 那讓存檔遷移這條紅線**不被踩到**（`experience`「一次改名要問兩件事」）。
- ⚠️ 而**驗收仍要實測一次舊存檔**——這個專案在這裡翻過車。

---

## Q3：多形態的元件要不要每個形態都改

`var_declare` 有 **statement ／ expression 兩個形態**，
而 `expression` 版**已經對上 `initializer`**、`statement` 版走手寫 strategy。

### 決策 3：**FR-003 成立，而它讓 `var_declare` 的成本翻倍**

⚠️ 兩個形態的 `extraState` 格式**必須完全相同**
（`CLAUDE.md` 的已知陷阱：`STATEMENT_TO_EXPRESSION` 直接搬移 extraState）。

→ **`var_declare` 排在最後**——它是三顆裡最貴的。

---

## 交付順序（按成本，而非按使用者影響）

```
① string_declare      🟡 JSON 就是真相，加一個 input ＋ 對映 ＋ i18n
② vector_declare      🔴 命令式註冊 ＋ extractor 同步
③ var_declare         🔴 兩個形態 ＋ 手寫 strategy ＋ extraState 契約
④ 其餘 9 筆           逐筆分組後再排
```

⚠️ **而這與 spec 的使用者影響排序不同**（spec 是 string／var／vector）。
**理由**：`var_declare` 最貴而 `string_declare` 最便宜，
而**每一顆都是獨立交付**——先做便宜的可以讓機制先被驗過一次。

> **當每一項都獨立可交付時，先做最便宜的那一項不是逃避，
> 是讓後面幾項有一個驗過的模板。**

---

## 風險與對策

| 風險 | 出處 | 對策 |
|---|---|---|
| 🔴 一次改太多，出問題無法二分 | 決策 1 | **一顆一個 commit**，每顆都跑量測 |
| 雙重真相：JSON 與命令式不同步 | `CLAUDE.md` | 改命令式那幾顆時，**兩邊都要改**；而第三十四條護欄在看 |
| extraState 契約破裂（多形態） | `CLAUDE.md` | `var_declare` 排最後，而它要驗形態切換 |
| 「用宣告刷數字」 | `build-guardrail` | FR-005：每一筆下降要說得出是實作還是重新分類 |
| 積木變寬 → 快照變動 | spec SC-008 | 一起改基線並說明 |
| 舊存檔 | 決策 2 | 只新增不改名；而**仍要實測一次** |

# Feature Specification: lift pattern 的文法歸屬

**Feature Branch**: `167-lift-grammar-attribution`

**Created**: 2026-08-20

**Status**: Draft

**Input**: 目標「把 Python 基本功能的積木做完」的第一次量測撞到的根因——
貼一段真的 Python 進去，`if`／`while`／`for`／`return`／變數**全部被辨識成 C++ 元件**，
而降級數是 0。設計脈絡：[knowledge/draft](../../knowledge/draft/2026-08-20-Python的if被辨識成cpp的if.md)

---

## 為什麼這一刀先做

這一刀**不新增任何一顆積木**，而它是 Python 目標的前置。

量測（貼 `x = 5` / `if` / `while` / `for` / `def` / `print` 走 lift）：

```
18×  unresolved
14×  cpp:var_ref          🔴
 5×  python:literal_number
 3×  python:print
 2×  python:literal_string
 1×  python:program
 1×  cpp:if   1× cpp:loop_while   1× cpp:loop_for   1× cpp:return   🔴
────────────────────────────────
總節點 47，**其中降級 0**
```

> **「降級 0」不是好消息**：不是都認對了，是**都被自信地認錯了**。

`cpp:if` 有形態畫得出來、有 generate 產得回去——**於是一段 Python 貼進去，
產出來會是 C++，而沒有任何東西出聲。**

🔴 **在這一條修好之前，加任何一顆 Python 元件都是徒勞**：
`python:if` 與 `cpp:if` 會在同一個 `astNodeType` 上競爭，
而勝負由 `priority` 決定——**那是一個沒有人設計過的排序。**

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 貼一段 Python，看到的是 Python（Priority: P1）

學生從 AI 或教材複製一段 Python，貼進程式碼面板。
今天他會看到一堆 C++ 積木（`if`／`while`／`for`／變數），而**畫面上沒有任何異常**——
直到他按「產生程式碼」，吐出來的是 C++。

修好之後：認得出來的顯示 Python 積木，**認不出來的顯示灰色的降級積木**，
而灰色是一個他看得見的認知邊界。

**Why this priority**：這是唯一一條使用者真的會走的路，而它今天會**靜默地說謊**。
其餘所有 Python 工作都建在這條路上。

**Independent Test**：貼那段 Python，檢查工作區上沒有任何一顆 C++ 積木。

**Acceptance Scenarios**：

1. **Given** 目標是 Python，**When** 貼入含 `if` / `while` / `for` / `def` / 變數指派的程式碼，
   **Then** 語義樹裡**不出現任何 `cpp:` 開頭的元件**
2. **Given** 同上，**When** 某個節點沒有對應的 Python 元件，
   **Then** 它降級成 `raw_code` / `raw_expression`（**看得見**），而不是套上一個 C++ 身分
3. **Given** 目標是 C++，**When** 貼入既有的任何一段 C++ 程式碼，
   **Then** 辨識結果與這一刀之前**逐字相同**

---

### User Story 2 - 加一顆 Python 元件不會與 C++ 的搶（Priority: P2）

下一刀要加 `python:if`。今天它與 `cpp:if` 都掛在 `if_statement` 上，
誰贏由 `priority` 決定——**而那個排序沒有人設計過，也沒有任何東西在看它。**

**Why this priority**：它是 P1 的直接後果，而它決定後面十幾顆元件會不會踩到同一個坑。

**Independent Test**：加一顆宣告在既有 `astNodeType` 上的 Python 探針元件，
確認它在 Python 底下贏、在 C++ 底下**完全不參與**。

**Acceptance Scenarios**：

1. **Given** `python:X` 與 `cpp:Y` 宣告同一個 `astNodeType`，**When** 在 Python 底下 lift，
   **Then** 只有 `python:X` 被考慮，`priority` 不參與跨文法的競爭

---

### User Story 3 - 一筆沒有標文法的 pattern 會被擋下來（Priority: P3）

**Why this priority**：這是防腐。若缺漏時預設成某個文法，這條規則會在第二年安靜失效。

**Independent Test**：注入一筆沒有文法宣告的 pattern，護欄必須紅。

**Acceptance Scenarios**：

1. **Given** 一筆 lift pattern 沒有宣告文法，**When** 跑護欄，
   **Then** 它**指名那一筆**並失敗；**不得**預設成任何文法

---

### Edge Cases

- **一顆膠囊帶多筆 pattern，而它們屬於不同文法**：宣告在 pattern 上（不是膠囊上），
  所以表達得出。今天沒有這種膠囊，而機制不禁止。
- **沒有 `component.componentId` 的 pattern**（5 筆 operatorDispatch：
  `negate` / `logic_not` / `logic` / `compare` / `arithmetic`）：
  它們的身分依運算子而定，**所以歸屬不可從 componentId 推**——這是「宣告在 pattern 上」的直接理由。
- **同一個文法服務多個教學語言**：`cpp` 套件一個文法（tree-sitter-cpp）
  四個教學語言（c-beginner / cpp-beginner / cpp-competitive / arduino）。
  過濾必須以**文法**為鍵，以語言為鍵會讓 C 拿不到 C++ 的 pattern。
- **目標語言切換到還沒有任何元件的語言**：全部降級，而**降級是可見的**——這是正確行為，不是缺陷。

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 每一筆 lift pattern MUST 宣告它寫給哪一個**文法**。
- **FR-002**: 系統 MUST 只用「屬於當前文法」的 pattern 來辨識，其餘一筆都不得參與比對。
- **FR-003**: 一筆**沒有**文法宣告的 pattern MUST 讓護欄失敗並**指名它**；
  系統 MUST NOT 替它挑一個預設文法。
- **FR-004**: 語言套件 MUST 宣告自己用哪一個文法——**核心不得從任何名字、路徑或前綴推導**。
- **FR-005**: 當前文法底下辨識不出來的節點 MUST 走誠實降級（可見的降級積木），
  MUST NOT 套用其他文法的元件身分。
- **FR-006**: 「辨識時要跳過哪些 AST 節點型別」的清單 MUST 依文法而定，
  MUST NOT 是一份跨語言共用的硬編清單。
- **FR-007**: 既有 C++ 的辨識結果 MUST 逐字不變。

### Key Entities

- **文法（grammar）**：`astNodeType` 這個字串所屬的命名空間。
  今天有兩個（tree-sitter-cpp、tree-sitter-python）。
  ⚠️ **它不是語言**——一個文法可服務多個教學語言。
- **lift pattern**：一筆「這個 AST 形狀 → 這顆元件」的資料。今天 70 筆（膠囊 65 ＋ 共用 5）。
- **語言套件**：宣告自己的解析器與文法的登記處條目。

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 貼入那段基準 Python，語義樹中 `cpp:` 元件的數量 **從 18 降到 0**。
- **SC-002**: 同一段 Python 中，辨識不出來的部分 **100% 以可見的降級形式呈現**
  （今天是 0%——它們被套上了 C++ 身分）。
- **SC-003**: C++ 既有測試 **通過數與這一刀之前完全相同**，一支都不減。
- **SC-004**: 缺少文法宣告的 pattern 數量為 **0**，而注入一筆會讓護欄**紅**。
- **SC-005**: 跨語言硬編的節點型別清單數量 **降到 0**。

---

## Assumptions

- **文法的識別以語言套件宣告的值為準**，取值採用解析器名稱（如 `tree-sitter-cpp`）。
  選這個而不是自創代號，是因為它**已經是 wasm 檔名**，對得起來、查得到。
- **`hw` scope 不在本刀範圍**——今天沒有 hw 元件，替它設計映射就是為想像中的使用者設計介面。
- **`universal` 在 lift 這一側不存在**——實測 0 筆 universal lift pattern
  （`forms/blocks.json` 有 27 筆 `language: universal`，那是**投影**那一側的事）。
- **共用檔 `src/languages/cpp/lift-patterns.json`（5 筆）與膠囊的 65 筆一視同仁**——
  位置不代表歸屬，它也要明說。
- **測試助手 `tests/helpers/setup-lifter.ts` 維持 C++ 專用**（113 個測試檔在用），
  Python 的量測另建入口——把它改成多語言是一次獨立的重構，不在本刀。

---

## Out of Scope（防蔓延）

- 新增任何 Python 元件——**本刀是它的前置，而不是它**
- `unresolved` 那 18 筆（＝ Python 還沒有對應元件）
- `hw` scope 的文法映射
- 把 `setup-lifter.ts` 改成多語言
- Python 的執行期、工具箱切換、round-trip 完整性

# Feature Specification: 深嵌入的 formalize——語義樹翻成 Cella 的程式 JSON（C++／Arduino 先）

**Feature Branch**: `180-deep-formalize`

**Created**: 2026-10-31

**Status**: Draft

**Input**: 重構階段 4（vision〈重構：語意交給 Cella〉）。使用者 2026-10-31 定：階段 1 完成後開工、先 C++／Arduino（四之十五第 6 題）；
`formalize` 這個名字保留，意思是盟約第 2 條的防腐層翻譯（第 5 題）。Cella 的程式 JSON 是 `@cella-lang/cfamily` 的 `cfamily.syntax`：
每個建構子帶編輯器的節點標籤 `n`，判決的問題、除錯器的停點、型別查詢的洞都用它指名節點。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 課文的每一份 C++／Arduino 解答都翻得成 Cella 的程式（Priority: P1）

把一份課文解答（學生的程式碼 → 語義樹）交給 formalize，得到一份 Cella 認得的程式 JSON；Cella 檢查它時不會說「這不是程式」（`invalid`）。
翻不出來的構造不送：formalize 自己標成「Cella 還判不出來」，並說出是哪一顆節點、哪一種構造。

**Why this priority**: 這是切換到 Cella 的必要條件（304 的切換條件之二），也是 C18 判決綁定語料的 `program` 那一半。

**Independent Test**: 對 cpp-beginner、cpp-advanced、c-bridge、arduino 四條軌道的每一份解答跑 formalize，數「翻得出／自己標 unknown／例外」三類；
翻得出的再交給 Cella 的判決入口，數 `invalid`。

**Acceptance Scenarios**:

1. **Given** 一份只用支援構造的解答，**When** formalize，**Then** 得到程式 JSON，且 Cella 的判決不是 `invalid`。
2. **Given** 一份用到 Cella 還沒做的構造（依 Cella 的支援清單）的程式，**When** formalize，**Then** 不送出，回「還判不出來」並指出節點與構造名。
3. **Given** 一份 Arduino 解答，**When** formalize，**Then** 程式 JSON 帶 `board`，且依板子選 `@cella-lang/arduino`。

---

### User Story 2 - Cella 的答案標得回積木（Priority: P1）

Cella 回報的每一個問題（UB、型別錯誤、還沒做的構造）都帶節點標籤；semorphe 用它找到對應的那塊積木與那一行程式碼。

**Why this priority**: 「洞 → 積木」是學生看得到保證的唯一管道；沒有它，判決只是一行文字。

**Independent Test**: 對一組會被 reject 的程式（除以零、越界、未初始化），檢查每一個 problem 的 `at` 都對得回語義樹裡存在的節點。

**Acceptance Scenarios**:

1. **Given** `int a = 1 / 0;` 的程式，**When** 送 Cella 判決，**Then** problem 的節點標籤就是那個除法的節點。
2. **Given** 一份編輯中、某個槽還空著的程式，**When** formalize，**Then** 那個槽變成洞（標籤 `<節點>#<槽名>`），而不是擲例外。

---

### User Story 3 - 名字指得到它的宣告（Priority: P2）

每一個變數參照都對到宣告它的那個節點（Cella 的 `DeclId`），遮蔽、區塊作用域、全域都正確；指不到宣告的名字出聲，不產生項。

**Why this priority**: 變數面板、除錯器的 frames、型別查詢都靠它；今天語義樹的變數參照只存名字。

**Independent Test**: 一組遮蔽與作用域的程式（同名的區域與全域、迴圈變數、函式參數），檢查每個參照的宣告節點。

**Acceptance Scenarios**:

1. **Given** 全域 `int x` 與 `main` 裡的區域 `int x`，**When** formalize，**Then** `main` 裡的 `x` 指向區域那一個。
2. **Given** 一個沒有宣告的名字，**When** formalize，**Then** 出聲（標 unknown，指出節點），不猜。

### Edge Cases

- `using namespace std;` 與標頭：送出最後真正交給編譯器的那一份 `#include`（學生寫的加自動補的，依順序、帶節點；四之十的 `iInclude` 約定）。
- 語義樹裡的 `raw_code`／`unresolved`：不送（盟約第 2 條），整支程式標「還判不出來」並指出那一塊。
- 一顆元件展開成多個建構子（`sort_range`、計數迴圈、Arduino 裝置積木）：節點標籤掛在哪幾個建構子上，決定步數與停點——依「一步 ＝ 進入帶標籤的節點一次」的約定，只在學生看得到的那一層掛標籤。
- 文字照 UTF-8（Cella 10-31 的變更）：字串長度與 JS 直譯器今天的算法可能不同——列入切換前要對的差異，不在本階段改執行。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統 MUST 把 C++ 與 Arduino 的語義樹翻成 Cella 的程式 JSON（`prog`，含 `lang`、`items`，Arduino 另含 `board`）。
- **FR-002**: 每一個由語義節點產生的建構子 MUST 帶該節點的標籤；一顆元件展開成多個建構子時，標籤規則依上面的邊界情況。
- **FR-003**: 系統 MUST 以一趟靜態作用域走訪，替每個變數參照找到宣告節點；找不到時出聲、不產生項。
- **FR-004**: 送出前 MUST 依 Cella 的支援清單判斷構造是否已支援；未支援的不送，回「還判不出來」並指出節點與構造名（判斷依據是清單，不是比對錯誤訊息字串）。
- **FR-005**: 空著的槽 MUST 翻成洞（`<節點>#<槽名>`），不擲例外。
- **FR-006**: 系統 MUST 送出 `#include` 的完整清單（學生寫的加自動補的，依順序、帶節點）。
- **FR-007**: 元件 → 建構子的對應 MUST 集中成一張可檢查的對照（每顆 C++ 元件：對到哪些建構子，或標明「未支援／不送」），由護欄確認沒有元件被漏掉。
- **FR-008**: 系統 MUST 能為 C18 判決綁定產出語料：每筆 `{id, program, text}`（`text` 是 semorphe 產出的 C++）。

### Key Entities

- **程式 JSON**：Cella `cfamily.syntax` 的值；Cella 的判決、型別查詢、除錯器都吃它。
- **節點標籤**：語義節點的身分，掛在建構子上；Cella 的答案用它指名位置。
- **宣告節點**（DeclId）：變數第一次在這個作用域被綁定的那個節點。
- **元件對照表**：每顆元件 → 建構子（或「未支援／不送」）。
- **支援清單**：Cella 公開、機器讀得到的「已做的函式與成員」，含 `partial`。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 四條 C／C++／Arduino 軌道的課文解答，100% 翻得出程式 JSON，或明確標成「還判不出來」並指出構造（0 個例外、0 個靜默遺漏）。
- **SC-002**: 翻得出的程式交給 Cella，`invalid` 為 0。
- **SC-003**: Cella 回報的 problem，100% 的節點標籤對得回語義樹裡的節點。
- **SC-004**: 元件對照表涵蓋 100% 的 C++ 元件（每顆都有對應或明確的「不送」理由），由護欄守住。
- **SC-005**: 能產出 C18 語料並交給 Cella（先交 `text`，`program` 隨本階段長出來補上）。

## Assumptions

- Cella 的套件要先升級（重構階段 3 的換版本那一半）；2026-10-31 npm 上那一組的 peer 釘選互相矛盾，已回報 Cella。
  在那之前，對照表、作用域走訪、節點標籤可以先做與單元測試；SC-002 的驗證等升級。
- 程式 JSON 的形狀以 Cella repo 的 `packages/cfamily/src/syntax.cella`（`deriving Json`）為準；缺欄位、多欄位、未知建構子 Cella 都會帶路徑報錯，可拿來當格式的判定者。
- Python 的 formalize 是重構階段 7，不在本 spec。

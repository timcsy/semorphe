# Feature Specification: OOP 來回一趟的四個缺陷

**Feature Branch**: `246-delete-interpreter`（與 spec 208 同一條；刪直譯器之前做）
**Created**: 2026-11-03
**Status**: Draft
**Input**: spec 208 T002 補 OOP 語義的 Cella 測試時量到——直譯器蓋住了它們（它對這些寫法要嘛照樣跑出一個結果，要嘛什麼都不做）。

## 背景

學生寫的四種 C++ 寫法，轉成積木再轉回程式碼之後**變成另一支程式**（或編不過），而切到 Cella 之後執行也會錯：

| 學生寫的 | 來回一趟之後 | 執行（Cella） |
|---|---|---|
| `p->m()` | `p.m()`（編不過） | 判「沒有這個成員」 |
| `struct B : A { … }` | `struct B { … }`（繼承不見） | override 對不到基底，判 reject |
| `virtual ~A()` | `~A()`（不再是虛擬的） | 經基底指標刪除時行為不同 |
| `virtual int f() const`、`int f() const override` | 尾端 `const` 不見 | 在 const 物件上呼叫判 reject |

P1（語意樹是唯一真相）要求每一種投影都忠實；這四個違反它，而且都是**安靜地丟東西**（P6）。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 寫物件導向程式的學生，轉積木再轉回來，程式不變（Priority: P1）

**Independent Test**：四種寫法各一段，轉積木再轉回程式碼，一字不差；語意樹記下了箭號、基底、virtual、const。

**Acceptance Scenarios**：
1. **Given** `A* p = &b; p->hi();`，**When** 轉積木再轉回，**Then** 仍是 `p->hi();`，積木上看得出是經過指標呼叫。
2. **Given** `struct B : A { … };`，**When** 轉積木再轉回，**Then** 基底還在，積木上看得到基底。
3. **Given** `virtual ~A() {}`，**When** 轉積木再轉回，**Then** 仍是 `virtual ~A() {}`。
4. **Given** `virtual int v() const`、`int v() const override`，**When** 轉積木再轉回，**Then** `const` 還在。

### User Story 2 - 這些程式按「執行」跑出 C++ 的結果（Priority: P1）

**Independent Test**：spec 208 的 `cella-oop-semantics` 裡兩根釘子（基底指標的虛擬分派、`struct B : A` 的覆寫）轉成正向測試並通過；`fuzz-cpp-oop` 裡「指標陣列的虛擬分派」那條 todo 轉正。

### User Story 3 - 在積木上能改這些設定（Priority: P2）

學生在積木上看得到、也改得了：箭號或點、基底（名字與存取）、解構子是否 virtual、方法是否 const。樣子與同族一致（照 `method_def` 的 const 下拉、`class_def` 的基底欄位）。

**Independent Test**：瀏覽器驗收截圖：四顆積木的樣子與同族並排一致；改下拉之後程式碼跟著變。

### Edge Cases

- **舊存檔**：沒有新屬性的節點載入時取預設值（點、沒有基底、非 virtual、非 const），不得報錯或丟節點。
- **`final`**：Cella 還沒有形狀（cella 2026-11-03 說會再談）——照實標「還不支援」，不得送成 virtual 或 override（否則覆寫 final 方法的錯程式會被接受）。
- **多重繼承、`virtual` 繼承**（`struct C : A, B`、`: virtual A`）：這一刀不做；照實降級，不得只留第一個基底。
- **`p->field`**（欄位不是方法）已經有 `struct_at_ptr`，不在範圍內。

## Requirements *(mandatory)*

- **FR-001**: 方法呼叫 MUST 記下是經過指標（`->`）還是物件（`.`）；產回的程式碼與原文一致；交給 Cella 的形狀照實帶箭號。
- **FR-002**: `struct` 的宣告 MUST 記下單一基底與存取（預設 public，與 `class` 的預設 private 不同）；產回一致；交給 Cella 的形狀帶基底。
- **FR-003**: 解構子 MUST 記下是否 virtual；產回一致；交給 Cella 的 `virt` 照實。
- **FR-004**: 虛擬方法、覆寫方法 MUST 記下尾端 const；產回一致；交給 Cella 的 `isConst` 照實。
- **FR-005**: `final`、多重繼承、virtual 繼承 MUST 照實降級（說得出還不支援），MUST NOT 安靜地丟掉或改成別的意思。
- **FR-006**: 舊存檔 MUST 照預設值載入（遷移一步，有測試）。
- **FR-007**: 改了積木的樣子 MUST 重產課文對照圖；改了 lift MUST 拿 StudyCpp 重量（形狀不得退步）。

## Success Criteria *(mandatory)*

- **SC-001**: 四種寫法來回一趟一字不差（每種至少兩個變化）。
- **SC-002**: 兩根釘子與一條 todo 轉正，缺陷帳的棘輪數字下降。
- **SC-003**: StudyCpp 218 支的來回一趟與 Cella 判決，修之前與修之後相比沒有任何一支退步。
- **SC-004**: e2e 全綠；瀏覽器驗收四顆積木與同族一致。

## Assumptions

- Cella 的形狀（cella 2026-11-03）：`mbMethod.virt` ∈ vNone／vVirtual／vOverride／vPure；`mbDtor { virt }`；隱含 this 的方法呼叫 `eMCall { obj: eThis, arrow: true }`。基底的形狀照 `class_def` 現在送的。
- 這一刀與 spec 208 同一條分支，獨立提交；spec 208 的段 3（刪）等它完成。

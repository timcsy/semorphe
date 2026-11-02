# Feature Specification: 膠囊自證測換判準——第二批（重構 6c-2b）

**Feature Branch**: `225-migrate-capsules-mid`
**Created**: 2026-11-02
**Status**: Draft
**Input**: 6c 測試盤點 B-1 難度「中」、只看 C++ 程式行為（不碰 Arduino 腳位、不驗直譯器自己的錯誤訊息）的膠囊自證測，執行判準從 JS 直譯器換成 Cella。

## 背景

6c-2a（spec 199）遷完 B-1 難度低的 37 個。難度中的裡面，有六個斷言的仍然是「一段 C++ 程式的行為」：
`set_insert`、`container_erase`（multiset——使用者定「6c 前要補完」的四族之一）、`initializer_list`（多維大括號——四族之一）、
`namespace_def`（不存在的限定名要報錯）、`define`、`define_func`（巨集；引用 `executors/preprocessor` 的 `resetDefinedMacros`）。

範圍外（理由）：
- `program`：斷言 Arduino 的 setup／loop 進入點與「都沒有要出聲」——Arduino 的判決要走板子的模型，屬 6c-3。
- `var_ref/gap.test.ts`：斷言直譯器的錯誤訊息（「不得說變數尚未宣告」、近似名）——Cella 那側是 `problems` 轉中文，屬 6c-3。
- Arduino 腳位、時鐘、Serial 那幾支（tone、micros、pin_mode…）：讀 verdict 的 `pins`／`clock`，屬 6c-2c。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 六個膠囊的執行斷言改由 Cella 判（Priority: P1）

**Independent Test**: 六個檔各自單獨跑全綠；檔內不再引用 `SemanticInterpreter`、`src/interpreter/*`、`resetDefinedMacros`。

**Acceptance Scenarios**:

1. **Given** 斷言輸出的測試，**When** 換成 `expectCellaOut`，**Then** 同一個期望值成立。
2. **Given** 斷言「要出聲」（`rejects.toThrow()`）的反向測試，**When** 改寫，**Then** 斷言 Cella 的判決不是 accept，而且判決種類與原因說得出「為什麼」（例如不存在的限定名 → reject 未宣告；運算式位置的函式巨集 → 翻不出或 reject），不是「隨便哪種錯都算」。
3. **Given** 一條斷言是 JS 直譯器自己的取捨（例如「沒有型別脈絡時就是一串值」），**When** 它在 C++ 裡不是合法程式，**Then** 依 C++ 改寫或改成斷言 reject，依據寫在註解。
4. **Given** Cella 判錯或未支援，**Then** 用 `knownCellaGap` 釘住並回報，不用 skip。

## Requirements *(mandatory)*

- **FR-001**: 六個檔的執行斷言 MUST 改用 `tests/helpers/cella-run.ts`。
- **FR-002**: 改完的檔 MUST NOT 引用 JS 直譯器與 `resetDefinedMacros`。
- **FR-003**: lift／generate／round-trip 那幾條 MUST 不動。
- **FR-004**: 反向測試 MUST 斷言具體的判決種類或原因，MUST NOT 只斷言「不是 accept」。
- **FR-005**: 期望值改動 MUST 逐條附依據；Cella 那側的問題 MUST 回報 cella。

## Success Criteria *(mandatory)*

- **SC-001**: 六個檔全綠，無新增 skip。
- **SC-002**: 六個檔對 JS 直譯器的引用歸零。
- **SC-003**: 反向測試每一條都說得出判決種類或原因。

## Assumptions

- 從 224 分出（帶 `knownCellaGap`）；Cella 0.1.202611020258。

# Tasks：語法錯誤說得出「少了什麼、在哪裡」

**Plan**: [plan.md](plan.md) · **TDD**：憲法第二條非妥協

## 🔴 不可交換的順序

```
Phase 2 的反向測試  →  Phase 3 的實作  →  Phase 4 的正向  →  Phase 5 的面板
```

這一刀最可能的失敗是**開始亂報**。反向測試先在「還沒有提示」的世界裡釘住
「正確的程式零診斷」「認不得的輸入零提示」，實作之後它們才是真的防線。

⚠️ 反向那兩支第一次跑是**綠**的——同 `build-guardrail` 6.5 的例外：
**靠注入不靠第一次的紅**，而正向那四條就是它們的注入（實作前必須紅）。

## Phase 1：Setup

*（無——沒有新依賴、沒有新目錄）*

## Phase 2：反向先寫（🔴 阻擋實作）

- [X] T001 [US2] 在 `tests/integration/syntax-gap.test.ts` 寫反向：一段**正確**的程式 → 語法診斷**0** 個；⚠️ 前面要有正向錨點（先證明 lift 真的跑了）
- [X] T002 [P] [US2] 在同檔寫反向：`void f() { @@@ ### }` → **有**語法診斷而**修復提示 0 個**，訊息與今天**逐字相同**
- [X] T003 [P] [US2] 在同檔寫反向：`whlie (x) {}` → 🔴 **不得**出現任何指向 `while` 的建議（那個 token 拿不到，說了就是猜的）

## Phase 3：實作

- [X] T004 在 `src/core/lift/types.ts` 的 `AstNode` 加 `isMissing?: boolean`，註解引用 `hasError` 那段的理由（**選用是因為假樹描述的正是沒有缺口的樹**）
- [X] T005 在 `src/core/lift/lifter.ts` 走到 `hasError` 的節點時收集底下的 MISSING → `metadata.syntaxGaps`（**陣列**，不合併）
- [X] T006 [P] 在 `src/core/types.ts` 的 `Diagnostic` 加 `at?: { line: number; column: number }`，🔴 註解寫明「MISSING 不在樹裡，`nodeId` 指不到它」
- [X] T007 在 `src/core/diagnostics.ts` 的 `diagnosticsFromTree` 把 `syntaxGaps` 帶進 `params.missing` ＋ `at`；⚠️ **沒有缺口時一格都不加**

## Phase 4：正向（此時 T001–T003 仍須綠）

- [X] T008 [US1] 在 `tests/integration/syntax-gap.test.ts` 加四種形狀，**逐條**斷言行與欄：宣告、輸出、巢狀區塊（位置在最內層）、`for` 的第一個分號
- [X] T009 [P] [US1] 在同檔加：MISSING **不是** `;` 時（例如少 `)`），訊息說得出**是哪一個符號**，不得一律講分號

## Phase 5：面板 ＋ 收工

- [X] T010 `src/ui/panels/monaco-panel.ts`：有 `at` → 波浪縮到那一欄；🔴 **沒有 `at` 照舊畫整行**（既有行為不得動）
- [X] T011 [P] `src/ui/panels/blockly-panel.ts`：有 `at` → tooltip 多說一句，⚠️ **只用 `line`**（積木沒有「欄」）
- [X] T012 i18n 兩語各加訊息鍵；⚠️ 值不得是代號
- [X] T013 `npm test` 全綠 ＋ `npx tsc --noEmit` 過
- [X] T014 🔴 **開瀏覽器**照 [quickstart.md](quickstart.md) §③ 四條（用 `verify-in-browser`）
- [X] T015 知識反流：`knowledge/history/` 記轉變（實測把構想翻過來那一段）、`knowledge/experience.md` 記教訓、`knowledge/vision.md` 6.7 打勾

## MVP

**T001–T009**（核心事實流得通）。面板是呈現，可分開交付。

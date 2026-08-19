# 實作計畫：語法錯誤說得出「少了什麼、在哪裡」

**Branch**: `143-syntax-repair-hint` · **Date**: 2026-08-19 · **Spec**: [spec.md](spec.md)

## Summary

lift 走 AST 時把 tree-sitter 的 **MISSING 節點**（該有而沒有的 token）記進節點的
metadata，`diagnosticsFromTree` 把它帶進診斷，兩個面板各自決定怎麼說。
🔴 **找不到明確缺口就完全不提**——訊息與今天逐字相同。

## Technical Context

**語言／依賴**：TypeScript 5.x · web-tree-sitter 0.26.6 · Vitest（**無新增依賴**）
**測試**：`npm test`（護欄 32 條）
**規模**：`AstNode` 一格 · `Diagnostic` 一格 · lift 一段 · 兩個面板各一小段 · 測試兩支

**Unknowns**：**無**。四個問題全部有答案，見 [research.md](research.md)。

## Constitution Check

| 條 | 判定 | 依據 |
|---|---|---|
| **I. 簡約優先** | 🟢 | 🔴 **明確否決搬 `near-miss.ts` 到核心**——這一刀根本不用它（原構想被實測否決）。搬它是為一個不存在的需求付款 |
| **II. TDD** | 🟢 | 每一階段測試先寫；🔴 而**反向測試先於正向**（見下） |
| **III. Git 紀律** | 🟢 | 每組任務一 commit |
| **IV. 規格文件保護** | 🟢 | 不覆蓋 `specs/` |
| **V. 繁體中文優先** | 🟢 | |

### 🔴 Phase 0 沒有再改規格——而那需要說明

spec 142 的 plan 寫過「**一個 Phase 0 如果沒有改到任何規格，它多半沒有真的去查**」。

⚠️ **這一份沒有改，理由是規格【自己已經是一次量測的產物】**
——它的「出發點」整節就是 Phase 0 該做的事，只是做在寫規格之前。
Phase 0 這一輪查的是**下游**（事實怎麼流到使用者），而那四個問題**規格刻意沒有決定**
（它明寫「位置的錨點怎麼共存留給 plan 論證」）。

## 🔴 不可交換的順序

```
① 反向測試（不亂報／不亂猜）    ← 先寫，此時它們是【綠】的
② AstNode.isMissing ＋ lift 記錄缺口
③ 正向測試（四種形狀）
④ Diagnostic.at ＋ 兩個面板
```

⚠️ **①先於②不是形式**。這一刀最可能的失敗是**開始亂報**
（每個 `hasError` 的節點都掛一個提示）。反向測試先在**還沒有提示**的世界裡
釘住「正確的程式零診斷」「認不得的輸入零提示」，②之後它們就是真的防線。

🟡 而 ① 第一次跑是綠的——同 `build-guardrail` 6.5 的例外：**靠注入不靠第一次的紅**。
所以 ③ 的四種形狀就是它們的注入：**②做完之前 ③ 必須紅**。

## Project Structure

```
specs/143-syntax-repair-hint/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md
└── checklists/requirements.md

src/core/lift/types.ts          AstNode 加 isMissing
src/core/lift/lifter.ts         走 AST 時收集 MISSING → metadata.syntaxGaps
src/core/types.ts               Diagnostic 加 at?
src/core/diagnostics.ts         把 syntaxGaps 帶進 Diagnostic
src/ui/panels/monaco-panel.ts   有 at → 波浪縮到那一欄
src/ui/panels/blockly-panel.ts  有 at → tooltip 多說一句（只用 line）

tests/integration/syntax-gap.test.ts    正向四形狀 ＋ 反向兩條
```

## Complexity Tracking

| 新增的複雜度 | 當前需求 | 為什麼不能更簡單 |
|---|---|---|
| `AstNode.isMissing` | 拿不到就什麼都做不了 | 理由與 `hasError` 逐字相同 |
| `metadata.syntaxGaps` **陣列** | 一個檔案可能少很多分號 | 單值會讓「第二個以後」消失 |
| `Diagnostic.at` | MISSING **不在樹裡**，`nodeId` 指不到 | research R1；用父節點會把波浪畫成整行，**比不標更糟** |
| ~~搬 `near-miss.ts`~~ | ❌ **無當前需求** | 憲法 I 否決 |

## 風險與對策

| 風險 | 來自 | 對策 |
|---|---|---|
| 🔴 開始亂報 | `experience`「一個指錯地方的錯誤訊息，比沒有訊息更糟」 | 反向測試**先寫**（順序①） |
| 只驗一種形狀就以為都行 | 「一叢違規不一定同一個根因」 | 四種形狀**逐條**斷言 |
| 波浪畫整行等於沒縮 | — | 瀏覽器驗收第 1 條明寫「壞的是畫整行」 |
| 診斷不是全集取代 | 既有註解：`setModelMarkers` 是取代 | 瀏覽器驗收第 3 條（補回分號 → 波浪**完全消失**） |

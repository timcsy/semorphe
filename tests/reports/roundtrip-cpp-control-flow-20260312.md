# Round-Trip 測試報告 — C++ Control Flow — 2026-03-12

## 摘要
- 語言：C++
- 測試程式數：10
- PASS：10
- FAIL：0

## 修復的 Bug

### Bug 1：switch-case value 洩漏到 body（已修復）
- **問題**：`liftCaseStatement` 使用 `c !== valueNode` 過濾 body children，但 web-tree-sitter 每次存取建立新的包裝物件，導致 `===` 永遠為 false
- **症狀**：`case 1:` 後 body 第一行出現 `1            cout << ...`
- **修復**：改用 `startPosition` 比較取代 `===` 參考相等
- **修復位置**：`src/languages/cpp/core/lifters/statements.ts`
- **同類修復**：`src/languages/cpp/core/lifters/strategies.ts` (typedef lifter)

## 測試結果

| # | 程式 | 概念 | 結果 |
|---|------|------|------|
| 1 | simple_if | if, compare | ✅ PASS |
| 2 | if_else | if, else, modulo | ✅ PASS |
| 3 | if_else_if_chain | if, else if, compare | ✅ PASS |
| 4 | while_loop | while, arithmetic, assign | ✅ PASS |
| 5 | count_loop | for (counting), cout | ✅ PASS |
| 6 | general_for | cpp_for_loop, arithmetic | ✅ PASS |
| 7 | do_while | cpp_do_while, arithmetic | ✅ PASS |
| 8 | switch_case | cpp_switch, cpp_case, cpp_default, break | ✅ PASS |
| 9 | break_in_loop | for, if, break | ✅ PASS |
| 10 | continue_in_loop | for, if, continue | ✅ PASS |

## 產生的回歸測試
- `tests/integration/roundtrip-control-flow.test.ts`（20 個測試）

# 模糊測試報告 — C++ Control Flow — 2026-03-12

## 摘要
- 語言：C++
- 產生的程式數：10
- 成功執行：10
- Round-trip PASS：6
- COMPILE_FAIL：2（switch fall-through + char literal in switch）
- SEMANTIC_DIFF：2（陣列初始化 — Phase 4 scope）

## 發現並修復的 Bug

### Bug 1：switch-case value 洩漏到 body（已修復）
- **程式**：roundtrip test #8
- **原始碼**：`case 1: cout << "Mon" << endl; break;`
- **錯誤輸出**：`case 1:\n1            cout << "Mon" << endl;`
- **根本原因**：web-tree-sitter 節點 `===` 參考比較失敗，`filter(c => c !== valueNode)` 無效
- **修復**：改用 `startPosition` 座標比較
- **修復位置**：`src/languages/cpp/core/lifters/statements.ts`

## 已知限制

### COMPILE_FAIL: switch fall-through
- 空 case body 的 fall-through 模式（`case 0: case 1:`）code generation 有問題
- **範疇**：Phase 2 — 可在後續 PR 修復

### COMPILE_FAIL: char literal in switch
- switch case 中的 char literal `'A'` 被生成為 string literal `"A"`
- **範疇**：Phase 1 char literal 與 switch 交互

### SEMANTIC_DIFF: 陣列初始化列表
- `int arr[] = {1, 2, 3}` 的初始化列表在 roundtrip 中遺失
- **範疇**：Phase 4 陣列與指標

## 產生的回歸測試
- `tests/integration/fuzz-cpp-control-flow.test.ts`（12 個 PASS 測試 + 3 個 todo）

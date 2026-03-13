# 模糊測試報告 — C++ containers — 2026-03-13

## 摘要
- 語言：C++
- 產生的程式數：10
- 成功執行（原始）：10/10
- Round-trip PASS：1（fuzz_6）
- SEMANTIC_DIFF（bug）：0
- COMPILE_FAIL（預期降級）：9
- LIFT_FAIL（限制）：0
- EXPECTED_DEGRADATION：9（8 個因容器概念未實作 + 1 個因 initializer list 不支援）

## 分類

| # | 程式描述 | P1 穩定 | 結果 | 原因 |
|---|---------|---------|------|------|
| 1 | 巢狀 vector 矩陣轉置 | ✅ | EXPECTED_DEGRADATION | initializer list `= {{...}}` 和 constructor args `(N, default)` 不支援 |
| 2 | stack 表達式求值器 | N/A | EXPECTED_DEGRADATION | `cpp_stack_declare/push/pop/top` 尚未實作 |
| 3 | map 頻率計數+erase | N/A | EXPECTED_DEGRADATION | `cpp_map_declare` 尚未實作 |
| 4 | set 交集運算 | N/A | EXPECTED_DEGRADATION | `cpp_set_declare` 尚未實作 |
| 5 | BFS 圖搜尋 (queue+map+set+vector) | N/A | EXPECTED_DEGRADATION | 多個容器概念尚未實作 |
| 6 | vector 分區 (back/pop_back/empty) | ✅ | PASS | 所有 vector 概念正確 lift/generate |
| 7 | map of vectors 分組 | N/A | EXPECTED_DEGRADATION | `cpp_map_declare` 尚未實作 |
| 8 | stack-queue 反轉 | N/A | EXPECTED_DEGRADATION | `cpp_queue_declare/stack_declare` 尚未實作 |
| 9 | set 去重 + insert | N/A | EXPECTED_DEGRADATION | `cpp_set_declare` 尚未實作 |
| 10 | 稀疏矩陣乘法 (map<pair>) | N/A | EXPECTED_DEGRADATION | `cpp_map_declare` 尚未實作 |

## 發現的 Bug

無。所有 vector 概念（declare, push_back, pop_back, back, empty, size, clear）在 fuzz_6 中正確 lift → generate → re-lift，P1 穩定。

## 覆蓋缺口

### 尚未實作的容器概念（將在後續 pipeline 實作）
- `cpp_stack_declare`, `cpp_stack_push`, `cpp_stack_pop`, `cpp_stack_top`
- `cpp_queue_declare`, `cpp_queue_push`, `cpp_queue_pop`, `cpp_queue_front`
- `cpp_map_declare`, `cpp_map_erase`, `cpp_map_count`, `cpp_map_find`
- `cpp_set_declare`, `cpp_set_insert`, `cpp_set_erase`, `cpp_set_count`, `cpp_set_find`

### Vector 已知限制
- Initializer list 語法 `= {1, 2, 3}` 不支援 — 降級為空宣告
- Constructor 語法 `(N, default)` 不支援 — 降級為空宣告
- 巢狀 template `vector<vector<int>>` 可正確 lift declare，但 initializer 仍不支援

## 產生的回歸測試

- `tests/integration/fuzz-cpp-containers.test.ts`
  - 3 個 PASS 測試（fuzz_6 的 lift/P1/generate 驗證）
  - 8 個 `it.todo`（等各容器概念 pipeline 實作後啟用）

## P1 穩定性分析

- fuzz_1: ✅ P1 穩定（但有語義降級）
- fuzz_6: ✅ P1 穩定且語義正確
- fuzz_2-5, 7-10: P1 不穩定（因 `/* unknown concept */` 註解的縮排在二次 roundtrip 時改變——這是已知的 unknown concept 渲染行為，不是 vector 概念的 bug）

# 模糊測試報告 — C++ — 2026-10-31（`cpp:time`，第 395 刀）

## 摘要
- 語言：C++　難度：easy　範疇：時間與亂數（`time(0)`／`time(NULL)`、`srand`／`rand`）
- 產生的程式數：10（資訊隔離的出題者，看不到原始碼）
- 成功執行：10
- Round-trip PASS：10
- SEMANTIC_DIFF／COMPILE_FAIL／ROUNDTRIP_DRIFT／WRONG_COMPONENT：0
- LIFT_FAIL／EXPECTED_DEGRADATION：0

## 出題者用到的寫法（對新元件有意義的那幾種）
- `srand(time(0))`、`srand(time(NULL))`、`srand((unsigned) time(NULL))`、`srand(time(0) % 1000)`
- `time(0)` 存進 `int`／`long`、出現在比較與算式裡（`time(0) - a <= 1`）、`(int)(time(NULL) % 60)`
- ⟹ `time(0)` 的每一處都認成 `cpp:time`；`time(NULL)` 照舊是通用函式呼叫，文字不變

## 發現的 Bug
無。

## 產生的回歸測試
- `tests/integration/fuzz-cpp-time.test.ts`（10 支，每支斷言：輸出等價、元件身分、二次往返、無 raw_code）
- `it.todo`：0

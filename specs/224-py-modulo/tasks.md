# Tasks: C++ → Python 的取餘數

- [x] T001 反例改寫：取餘數的一般用法 → 換過去且判決相同；新增保留：64 位元的 % 與 /、有副作用的一邊（`tests/integration/cpp-to-python-verdict.test.ts`）
- [x] T002 `contract.ts` 的 `isNarrowInt`、`truncatedRemainder`；`arithmetic`／`var_assign_compound` 的 to-python
- [x] T003 逐字輸出的最小例（`tests/unit/languages/cpp/cpp-to-python.test.ts`）
- [x] T004 換過去之後露出的 Cella 不一致（sqrt 的 assumes 只在 C++ 那側）以 knownCellaGap 釘住並回報
- [ ] T005 guard、長測試、合併

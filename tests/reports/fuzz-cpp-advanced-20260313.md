# 模糊測試報告 — C++ Advanced Features — 2026-03-13

## 摘要
- 語言：C++
- 難度：hard
- 範疇：advanced-features (lambda, namespace, try-catch, throw, casts, range-for, template function)
- 產生的程式數：10
- 成功編譯/執行：10
- Round-trip PASS：0
- COMPILE_FAIL：0（無 bug 在已支援概念中）
- EXPECTED_DEGRADATION：10（全部使用不支援的進階特性）
- P1 穩定性：6/10 STABLE（不穩定的 4 個由未支援特性造成）

## 分析

所有 10 個程式都大量使用目前未支援的 C++ 進階特性，導致程式碼降級為 raw_code 或結構化提升不完整。這是預期行為 — 這些特性不在當前 Phase 7 的概念範圍內。

## 覆蓋缺口

1. **`mutable` lambda** — lambda 的 `mutable` 關鍵字不保留（fuzz_1, fuzz_6）
2. **Template specialization** — `template <>` 全特化不支援（fuzz_2, fuzz_5）
3. **Variadic templates** — `typename...Args` 和 fold expressions 不支援（fuzz_8）
4. **Multiple catch blocks** — try-catch 只支援一個 catch（fuzz_7）
5. **Catch-all `catch (...)`** — 不支援（fuzz_7）
6. **Rethrow `throw;`** — 無引數 throw 不支援（fuzz_7）
7. **`const` method qualifier** — 方法的 `const` 修飾遺失（fuzz_3, fuzz_9）
8. **`virtual ~Base() = default`** — 預設虛擬解構函式不支援（fuzz_3, fuzz_9）
9. **Namespace aliasing** — `namespace X = Y::Z;` 不支援（fuzz_4, fuzz_10）
10. **Pointer member access `ptr->`** — 已知限制（fuzz_4, fuzz_9）
11. **Functor class `operator()`** — 不支援（fuzz_10）
12. **`std::cout` without `using namespace std`** — 所有 10 個程式都直接使用 `std::cout`，lifter/generator 不支援此模式

## 產生的回歸測試
- `tests/integration/fuzz-cpp-advanced.test.ts`：新增測試案例

## 建議後續
1. 支援 `mutable` lambda 修飾
2. 支援多個 catch blocks
3. 支援 `const` method/parameter qualifier
4. 支援 namespace aliasing
5. 支援 template specialization（較大工程）

# 模糊測試報告 — Python — 2026-11-11（元件管線 413：連鎖指定）

範圍從簡：沿用 410 那批資訊隔離盲測（出題者不知道實作，8 支，`tests/integration/fuzz-python-student.test.ts`），
不另派出題者。連鎖指定的來源正是其中的 fuzz_7（`is_prime[0] = is_prime[1] = False`）。

## 摘要
- 程式數：8（都能在 CPython 跑）
- 本刀之後：8 支 lift → 產碼 → 再 lift 都是不動點；fuzz_7 從「整句照實降級」變成**整段認得**（含 `python:assign_chain`）
- SEMANTIC_DIFF / COMPILE_FAIL / ROUNDTRIP_DRIFT / WRONG_COMPONENT：0
- 新 bug：0

## 覆蓋缺口（不是本刀的）
- **切片指定** `xs[a::k] = …`：Cella 的指定目標把下標當一般運算式降（`cella/packages/python/src/lowering.cella` 的 sAssign → eSubscript，
  切片落到「a slice outside a subscript」）。我們送的 `eSubscript(eSlice)` 是忠實的 ⟹ Cella 那側的缺口，fuzz_7 以 `knownCellaGap` 釘住、回報 cella。
- 類別本體只有 `pass`（`class P: pass`）lift 成 unresolved——既有缺口，round-trip 時撞到，不在本刀範圍。

## TODO：0

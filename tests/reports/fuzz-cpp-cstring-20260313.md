# 模糊測試報告 — C++ <cstring> — 2026-03-13

## 摘要
- 語言：C++
- 產生的程式數：10
- 成功執行：10（全部編譯通過）
- Round-trip PASS：2
- COMPILE_FAIL（pre-existing）：5
- STDOUT_DIFF（pre-existing）：3
- cstring 特定 Bug：0

## 結果詳細

| # | 範疇 | 結果 | 根因 |
|---|------|------|------|
| 01 | strcpy/strcat/memset | COMPILE_FAIL | const qualifier loss on pointer params |
| 02 | strncpy/memset/strlen | STDOUT_DIFF | `char s[]="..."` array initializer lost |
| 03 | strcmp/strncmp | STDOUT_DIFF | array initializer loss + const params |
| 04 | strchr/strstr/strlen | ✅ PASS | — |
| 05 | memcpy/memset/strlen | STDOUT_DIFF | array initializer loss |
| 06 | strcpy/strcmp | ✅ PASS | — |
| 07 | strcat/strncpy/strcpy | COMPILE_FAIL | pointer decl in for-init lost |
| 08 | memcpy/memset/strcpy/strncmp | COMPILE_FAIL | multi-decl arrays lose size |
| 09 | strchr/strcat/strncpy | COMPILE_FAIL | while-assignment pattern broken |
| 10 | strstr/memcpy/strcpy/strlen | COMPILE_FAIL | while-assignment pattern broken |

## 發現的 Bug

**無 cstring 特定 bug。** 所有失敗均由 pre-existing C++ lifter 限制引起：

1. **const qualifier loss** — `const char*` 函式參數被降為 `char*`
2. **char array initializer loss** — `char s[] = "text"` → `char s[N]`（無初始值）
3. **while-assignment pattern** — `while ((x = f()) != null)` 條件內賦值被破壞
4. **pointer-in-for-init** — `for (const char* p = ...)` 初始化遺失
5. **multi-declaration array size** — `char a[8], b[8]` 陣列大小遺失

## 覆蓋缺口

以上 5 個問題都是通用的 C++ lifter 限制，非 cstring 概念問題。
已作為 `it.todo` 記錄在 `tests/integration/fuzz-cpp-cstring.test.ts`。

## 產生的回歸測試

- `tests/integration/fuzz-cpp-cstring.test.ts` — 10 個測試（2 PASS + 8 todo）
- 8 個 todo 全部源自 pre-existing lifter 限制，非本次 pipeline 範疇

## it.todo 數量：8
- 原因：全部為 pre-existing C++ lifter 限制（const params、array initializers、while-assignment、pointer-in-for、multi-decl arrays）
- 何時修：待 C++ core lifter 增強時（Phase 1-7 概念 pipeline）

# Round-Trip 測試結果（C++）：`cpp:time`

日期：2026-10-31（第 395 刀）　測試檔：`tests/integration/roundtrip-cpp-time.test.ts`　參照編譯器：有（本機 clang ＋ `bits/stdc++.h` 墊片）

| # | 程式 | 概念 | 結果 | 細節 |
|---|------|------|------|------|
| 1 | 亂數種子（課文第 12 課的寫法） | time, random_seed, random_next | ✅ PASS | 元件身分 ✔、二次往返 ✔、輸出相同 |
| 2 | 當運算式比較 | time, compare, print | ✅ PASS | |
| 3 | 存進變數、兩次相差不到一秒 | time, var_declare, arithmetic | ✅ PASS | |
| 4 | 當函式的引數 | time, func_def, func_call | ✅ PASS | |
| 5 | 其他寫法（`time(NULL)`／`time(nullptr)`／`std::time(0)`） | func_call | ✅ PASS | 照舊是通用函式呼叫，文字不變、無 raw_code |

摘要：5/5 PASS。

⚠️ `time(0)` 的值每次不同——程式只印與時間無關的結果。「補丁器補得到 `<ctime>`（C 方言是 `<time.h>`）」由膠囊的 `spec.test.ts` 驗（參照編譯器那一側一律 `bits/stdc++.h`，驗不到個別標頭）。

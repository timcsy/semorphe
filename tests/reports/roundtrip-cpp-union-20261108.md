# Round-Trip：cpp union_declare（2026-11-08，元件管線 345）

| # | 程式 | 概念 | 結果 | 細節 |
|---|------|------|------|------|
| 1 | u1 基本 | union_declare、成員存取、printf | ✅ PASS | gcc `65\|z`、Cella 相同 |
| 2 | u2 typedef 匿名 ＋ sizeof(別名) | union_declare（name 空、typedef_alias Num）、sizeof | ✅ PASS | 第一次量到 sizeof 不認得 typedef 名——已修（sizeof 改問「不是變數而且是型別」） |
| 3 | u3 union 當結構成員 | union_declare、struct_declare、巢狀成員存取 | ✅ PASS | `2.25` |
| 4 | u4 union 陣列、當參數 | union_declare、array_declare、func_def | ✅ PASS | `6 8` |
| 5 | u5 C++ | union_declare、cout | ✅ PASS | `2.5\|7` |

摘要：5/5 PASS。每支都量：元件身分（一顆 `cpp:union_declare`、零原文）、lift → 產碼 → 再 lift 同一棵、走一趟積木一字不差、Cella 輸出等於 gcc／g++。
降級（照實）：結構裡的匿名 union、帶成員函式的 union——見膠囊的 spec.test.ts。
永久測試：`tests/integration/roundtrip-cpp-union.test.ts`。

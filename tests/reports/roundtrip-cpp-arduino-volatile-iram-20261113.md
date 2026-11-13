# Round-Trip 測試結果（C++／Arduino）— 438 易變變數與中斷函式

判準：語義樹身分 → 產碼不動點 → render／Blockly 載入／extract 走一趟積木 → Cella（uno、esp32）判決與輸出。
永久測試：`tests/integration/arduino-types-isr.test.ts`（describe「438」）、`src/components/cpp/var_declare_volatile/spec.test.ts`、`tests/integration/declaration-shapes-roundtrip.test.ts`（兩個新形狀）。

| # | 程式 | 概念 | 結果 | 細節 |
|---|------|------|------|------|
| 1 | 語料：ESP32 按鈕計數（arduino-wide 原文） | volatile ×2、IRAM_ATTR ×1 | ✅ PASS | 零 raw_code；Cella 判決見 437（attachInterrupt 照實翻不出） |
| 2 | Uno：旗標在 loop 裡輪詢 | volatile ×2 | ✅ PASS | uno／esp32 輸出 `3` |
| 3 | 函式裡的易變變數，初值是運算式 | volatile ×1 | ✅ PASS | 輸出 `13` |
| 4 | 帶參數與回傳值的中斷函式 | IRAM_ATTR ×1 | ✅ PASS | 輸出 `42` |
| 5 | 兩個中斷函式共用一個旗標 | volatile byte、IRAM_ATTR ×2 | ✅ PASS | 輸出 `2` |
| 6 | 其餘形狀（`bool volatile`、多宣告子、`volatile const`、`static volatile`、指標、陣列、`ICACHE_RAM_ATTR`） | — | 🟡 DEGRADED（刻意） | 整句照原文、一字不丟 |
| 7 | 不在板子上的 `IRAM_ATTR` | — | ✅ 照實 untranslated | |

摘要：5/5 PASS；7 類刻意降級的形狀維持誠實降級。

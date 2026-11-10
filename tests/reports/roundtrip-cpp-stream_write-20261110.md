# Round-Trip 測試結果（C++，stream_write，2026-11-10）

| # | 程式 | 結果 |
|---|------|------|
| 1 | 自由函式 operator<< | ✅ PASS |
| 2 | 朋友原型加類別外定義 | ✅ PASS |
| 3 | 鏈式、換行、運算式 | ✅ PASS |
| 4 | 區域 ostream 參考 | ✅ PASS |
| 5 | std:: 前綴（參數型別） | ✅ PASS |
| 6 | 迴圈與條件裡 | ✅ PASS |
| 7 | 值裡的位移要留括號 | ✅ PASS |

摘要：7/7 PASS。期望輸出以 clang++ 實跑核對。永久測試：`tests/integration/roundtrip-cpp-stream-write.test.ts`。

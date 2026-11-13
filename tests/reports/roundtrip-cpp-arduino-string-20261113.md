# Round-Trip：cpp Arduino String 方法與序列埠讀取（435）— 2026-11-13

測試檔：`tests/integration/roundtrip-cpp-arduino-string.test.ts`（36 條）

| # | 程式 | 元件 | 身分 | ①② 產碼／不動點 | ③ 載入 | ④ 積木來回 | ⑤ Cella |
|---|---|---|---|---|---|---|---|
| 1 | 433 指令解析（全套） | read_string, trim, find, substr, as_int | ✅ | ✅ | ✅ | ✅ | ✅ uno／esp32 `led -> 42` |
| 2 | indexOf 兩個引數 | find | ✅ | ✅ | ✅ | ✅ | — |
| 3 | substring 一個引數接 toInt | substr, as_int | ✅ | ✅ | ✅ | ✅ | — |
| 4 | 讀一個整數 | read_number | ✅ | ✅ | ✅ | ✅ | — |
| 5 | readStringUntil 直接接 toInt | read_string, as_int | ✅ | ✅ | ✅ | ✅ | ✅ esp32 `17` |
| 6 | if 條件與迴圈裡 | find, substr, read_number | ✅ | ✅ | ✅ | ✅ | — |
| 7 | ★ 自己的類別同名方法 | 不搶（method_call） | ✅ | ✅ | ✅ | ✅ | — |
| 8 | ★ std::string 的 find／substr | 不搶 | ✅ | ✅ | ✅ | ✅ | — |

摘要：8/8 PASS。各元件自己的 spec.test.ts 另有 30 條（含 Uno／ESP32 執行）。
過程中唯一的紅是測試自己的錯（模板字串裡 `'\n'` 被 JS 吃成真的換行），不是產品缺陷。

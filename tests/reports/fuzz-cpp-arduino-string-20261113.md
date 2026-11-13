# 模糊測試報告 — C++（Arduino）— 2026-11-13

範疇：435 的六顆新元件（`arduino_string_{trim,find,substr,as_int}`、`serial_read_{string,number}`）。
出題：隔離的子代理（不知道 Semorphe），8 支 sketch，各附一段序列埠輸入。
判準：Cella（uno、esp32）跑原始程式與走一趟積木回來的程式，判決與輸出相同——不是出題者手算的預期。

## 摘要

| | 支數 |
|---|---|
| 產生 | 8 |
| 沒有降級（零 raw_code／unresolved） | 8 |
| 再 lift 是不動點 | 8 |
| 走一趟積木回來一字不差 | 8 |
| Cella ESP32：accept 且原始＝積木來回 | 8 |
| Cella Uno：判決與輸出原始＝積木來回 | 8（其中 5 支兩邊都 reject，見下） |
| SEMANTIC_DIFF／COMPILE_FAIL／ROUNDTRIP_DRIFT／WRONG_COMPONENT | 0 |

## 觀察（不是缺陷）

1. **不帶大括號的 `if (…) break;` 產出會補大括號**（fuzz_2／3／4／6）：排版風格的正規化，行為相同（⑤ 比過）。
   所以測試不比原文，比「再 lift 是不動點」。
2. **Uno 上 `trim()` 遇到開頭空白判 reject**（fuzz_1／4／5／6／7，`ubLib`）：AVR 核心的 `String::trim` 用 `memcpy` 搬重疊區段，
   是未定義行為；cella 已確認這是忠實的判決。ESP32 的核心用 `memmove`，八支都 accept。測試把 Uno 的 reject 原因釘成只能是那一條。

## 產生的回歸測試

`tests/integration/fuzz-cpp-arduino-string.test.ts`（41 支，全綠，殘留 todo 0）。

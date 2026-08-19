# 147 — 八塊板子，而每一個值都說得出來源

**日期**：2026-08-19 · **上游**：階段 6.11「屬性的候選值由目標提供」 ＋ 使用者的教學清單

## 出發點：使用者說出他會教哪些板子

> 「我們之後會教一般的 ESP32 NodeMCU、C3 Supermini、S3、S3 WROOM CAM、
> Wemos D1 mini、NodeMCU ESP8266 版本、Arduino Uno、Arduino Nano 等等板子，
> **所以這些一定要有**」

而在查證這份清單的過程中，**既有的板子資料被查出兩個錯**——
它們的共同點是：**憑印象填的值，然後長出了一條護欄把它固定住**。

## 🔴 兩個既有的錯（都已對著上游查證）

```
❌ 「ESP32 沒有 A0」    真相 A0 = 36（nodemcu-32s/pins_arduino.h）
                       而 tests/integration/board-pin-model.test.ts:55
                       【強制】它是 undefined ——護欄守著一個假事實

❌ NANO_BOARD = {...UNO_BOARD}   真相 Nano 用 eightanaloginputs variant，
                                 多了 A6=20／A7=21，上界 21 不是 19
```

⚠️ **第二個特別值得看**：`arduino-pins.ts:59` 的註解逐字寫著
「Nano 與 Uno 同一顆 ATmega328P。⚠️ 而驗收**逐塊斷言**，不從 Uno 推論。」
**下一行就是 `{ ...UNO_BOARD }`。**

> **我對【測試】設了防線，卻讓【資料】照樣用展開運算子推論出來。**

## 🔴 第三件事：板子資料有兩份

```
產品讀   src/languages/cpp/targets/*.json 的 "board"      ← 真相
護欄測   arduino-pins.ts 的 UNO_BOARD／NANO_BOARD／ESP32_BOARD
```

`NANO_BOARD`／`ESP32_BOARD` **產品路徑一個都沒讀**。八塊板子會把這份重複變成八份。
⚠️ spec `144` 才剛因為同一個形狀刪掉 `properties.values`。

## 查證出來的事實（每一列都附上游檔案）

| 目標 | 上游 variant | 核心 | 類比常數 | 腳位 |
|---|---|---|---|---|
| `arduino-uno` | `ArduinoCore-avr` `variants/standard` | avr | `A0–A5` = 14–19 | 0–19 |
| `arduino-nano` | `ArduinoCore-avr` `variants/eightanaloginputs` | avr | `A0–A7` = 14–**21** | 0–**21** |
| `esp32` | `arduino-esp32` `variants/nodemcu-32s` | esp32 | `A0`=36 `A3–A7` `A10–A19` | 0–19,21–23,25–27,32–39 |
| `esp32c3` | `arduino-esp32` `variants/esp32c3` | esp32 | `A0–A5` = **0–5** | 0–21 |
| `esp32s3` | `arduino-esp32` `variants/esp32s3` | esp32 | `A0–A19` = **1–20** | 0–21,26–48 |
| `esp32s3-cam` | 同 `esp32s3` | esp32 | 同 S3 | 同 S3 |
| `wemos-d1-mini` | `esp8266/Arduino` `variants/d1_mini` | **esp8266** | `A0` = **17**（唯一） | `D0–D8` |
| `nodemcu-esp8266` | `esp8266/Arduino` `variants/nodemcu` | **esp8266** | `A0` = 17 | `D0–D10` |

> 🔴 **`A0` ＝ 14／21／36／0／1／17——同一個名字，五個值。**
> 一張模組層級的常數表在這裡不會拋錯，只會讓燈亮在**錯的腳**上。

⚠️ **ESP8266 帶進來的不是新的值，是新的【命名體系】**：
`D0–D8` → GPIO 16, 5, 4, 0, 2, 14, 12, 13, 15（**不連續**，`D1` 是 GPIO 5）。
🟢 而 `constants` 已經是 `Record<string, number>`，**機制吃得下**——倒的只是資料。

## 能力（`provides`）也查證過

| 目標 | `touch` | `ledc-pwm` | 依據 |
|---|---|---|---|
| Uno／Nano | ❌ | ❌ | AVR 沒有這兩個週邊 |
| `esp32` | ✅ | ✅ | 既有 |
| `esp32c3` | **❌** | ✅ | `esp-idf` `esp32c3/soc_caps.h` **完全沒有** `SOC_TOUCH_SENSOR_*` |
| `esp32s3`／`-cam` | ✅ | ✅ | `esp32s3/soc_caps.h` `SOC_TOUCH_SENSOR_VERSION (2)` |
| 兩塊 ESP8266 | ❌ | ❌ | `ledcWrite` 是 ESP32 的 API；ESP8266 的 `analogWrite` 是軟體 PWM |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 學生選自己手上那塊板子 (Priority: P1)

八個目標選得到，而**同一個 `A0` 在不同板子上是不同的腳位**。
**驗收**：`esp32` 下 `analogRead(A0)` 讀 36 號；`esp32c3` 下讀 0 號；`wemos-d1-mini` 下讀 17 號。

### User Story 2 - 🔴 一支這塊板子沒有的腳位要被擋下來 (Priority: P1)

`maxPin` 只比上界，於是 `digitalWrite(30, HIGH)` 在 ESP32 上**不會被擋**（30 < 39）
——**而 ESP32 根本沒有 GPIO 30**。
**驗收**：ESP32 下 30 號腳位拋錯，而 32 號不拋。

### User Story 3 - 🔴 既有三個非硬體目標一個字都不能變 (Priority: P1)

`cpp`／`c`／競程**沒有板子**。
**驗收**：它們的產出與執行行為與今天逐字相同。

### Edge Cases

- **ESP8266 的 `D1`**：它是一個**常數名**（GPIO 5），而 Uno 上沒有這個名字 → 在 Uno 下應該**查不到**，走既有的「未宣告變數」診斷
- **ESP32 的 `A1`／`A2`**：`nodemcu-32s` **真的沒有定義**它們 → 這才是「這塊板子沒有這個名字」的**真實**例子（原本那條護欄舉錯了例）
- **S3 WROOM CAM 與 S3 腳位相同**：差別是相機佔掉哪幾支腳，而**今天沒有「被佔用」這個概念** → 列為已知缺口，不在這一刀發明它

## Requirements *(mandatory)*

- **FR-001**：板子資料 MUST 只有一份，住在 `targets/*.json`。`arduino-pins.ts` 只留**機制**與退路
- **FR-002**：每一塊板子 MUST 帶 `source` 欄位，指出它的上游 variant 檔案
- **FR-003**：🔴 腳位的合法性 MUST 由**集合**判定（`ranges`），不是單一上界
- **FR-004**：八個目標 MUST 都選得到，而它們的常數表逐塊斷言、**不從彼此推論**
- **FR-005**：`provides` MUST 逐塊查證（C3 沒有 `touch`）
- **FR-006**：🔴 沒有 `board` 的目標（`cpp`／`c`／競程）MUST 行為不變

## Success Criteria

- **SC-001**：八塊板子的 `A0` 值互不推論，且與上游一致
- **SC-002**：ESP32 的 GPIO 30 被擋下，訊息說得出是哪一塊板子
- **SC-003**：`arduino-pins.ts` 裡的板子**資料**歸零（只剩機制）
- **SC-004**：全套測試綠，非硬體目標零變更

## 明確排除

- **下拉選項跟著板子走**——那是這一刀的下游（資料對了才有意義）
- **「被佔用的腳位」**（S3 CAM 的相機腳）——沒有這個概念，不在這裡發明
- **板子拆成獨立的軸**——今天一塊板子 ＝ 一個目標，零機制。
  重開條件是「同一塊板子要配不同語言」真的出現
- **ESP8266 與 ESP32 的函式差異**（`ESP8266WiFi.h` vs `WiFi.h`）——`provides` 只查證既有的兩個能力

## Assumptions

- `esp32` 這個目標模擬的是**經典 ESP32（WROOM／DevKitC／NodeMCU-32S）**——這句今天沒有人寫出來過
- 使用者清單裡的「S3」與「S3 WROOM CAM」在 Arduino IDE 都選 `ESP32S3 Dev Module`

## 已知的坑

1. 🔴 **憑印象填資料**——這一刀的存在理由就是它。**每一個值都要附上游檔名**
2. **展開運算子會讓「不從彼此推論」的承諾失效**（Nano 的病歷）
3. **雙重真相**：`arduino-pins.ts` 與 `targets/*.json`（CLAUDE.md 列為首要陷阱）
4. **四項獨立性護欄 #39**：`BoardPinModel` 已因此住在 `core/types.ts`，別搬回去

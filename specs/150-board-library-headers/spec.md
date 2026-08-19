# 150 — 函式庫的標頭與能力也得跟著板子走

**日期**：2026-08-19 · **上游**：spec `147` 的直接後果（加了七塊板子，**而沒有人檢查它們的函式庫**）

## 出發點

```
cpp:wifi_open / cpp:wifi_read   requires: ['<WiFi.h>']       ← 那是【ESP32 的】標頭
兩顆都在 topics/arduino.json:78-79，而【沒有 needsCapability】
                                 → 省略 ＝ 所有板子都有
```

## 查證過的事實（每一列附上游）

| | AVR（Uno／Nano） | ESP32 全系列 | ESP8266（D1 mini／NodeMCU） |
|---|---|---|---|
| WiFi | 🔴 **核心沒有** | 🟢 `WiFi.h` | 🔴 **沒有 `WiFi.h`**，是 `ESP8266WiFi.h` |
| Servo | 核心沒有（IDE 附） | 🔴 核心沒有 | 🟢 `Servo` 在核心裡 |

來源：三個核心的 `libraries/` 目錄
（`arduino/ArduinoCore-avr`、`espressif/arduino-esp32`、`esp8266/Arduino`）。

**今天的後果**：
```
Uno／Nano 的學生   看得到、拿得到 WiFi 積木——而板子上沒有 WiFi
D1 mini 的學生     產出 #include <WiFi.h> ——【編不過】
```

## 🔴 Servo 量到了，而它【不在這一刀】

三個核心都沒有 `Servo.h`；IDE 附的那份支援 AVR 與 ESP8266，
而 ESP32 要裝第三方 `ESP32Servo`。

> **「核心沒有」不等於「不能用」——而那是一個【政策】決定
> （要不要把「學生自己裝得到的函式庫」也擋掉），不是一個機械修法。**

⚠️ 所以這一刀**只做 WiFi**：它的 `<WiFi.h>` 在 ESP8266 上**確定編不過**，
而 Uno 上**確定沒有硬體**。記錄留在 `history/`，等有人決定政策再開。

`DHT.h`／`LiquidCrystal.h` 三個核心都沒有（第三方，各板同名）→ **不受影響**。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 🔴 D1 mini 的學生產出編得過的標頭 (Priority: P1)

**驗收**：D1 mini／NodeMCU 目標的產出是 `#include <ESP8266WiFi.h>`；
ESP32 全系列仍是 `<WiFi.h>`。

### User Story 2 - 🔴 沒有 WiFi 的板子不該看得到 WiFi 積木 (Priority: P1)

**驗收**：Uno／Nano 的可見概念集合**不含** `cpp:wifi_open`／`cpp:wifi_read`，
而 ESP32／ESP8266 **含**（正向錨點）。

### User Story 3 - 🔴 其他目標一個字都不能變 (Priority: P1)

**驗收**：`cpp`／`c`／競程／不指定板子的 `arduino` 的產出與可見集合逐字不變。
（`arduino` 省略 `provides` ＝ 提供全部——**那條預設不可反**。）

### Edge Cases

- **學生自己寫了 `#include <WiFi.h>`**：那是他手寫的 include，
  ⚠️ 而 spec 146 的同一條界線——這一刀治的是**我們產出的**標頭
- **同一份程式碼在兩塊板子間切換**：標頭跟著換，而**語義樹不變**（P1）

## Requirements *(mandatory)*

- **FR-001**：板子 MUST 能宣告自己的標頭替換（`Target.headerAliases`）
- **FR-002**：🔴 這張表 MUST 與 `cIoHeaderFor`／`toCHeader` **分開**
      ——它們答的是**風格**與**名字**，這一張答的是**板子**（spec 146 的病歷）
- **FR-003**：WiFi 元件 MUST 宣告 `needsCapability: 'wifi'`
- **FR-004**：有 WiFi 的六塊板子 MUST 在 `provides` 裡列出 `wifi`
- **FR-005**：介面層與核心 MUST 不出現任何具體的板子名字

## Success Criteria

- **SC-001**：D1 mini 的 WiFi 產出 `<ESP8266WiFi.h>`，ESP32 仍是 `<WiFi.h>`
- **SC-002**：Uno 的可見集合少了那兩顆，而 ESP32 沒少
- **SC-003**：非硬體目標零變更，全套測試綠

## 明確排除

- **Servo**（政策決定，見上）· **DHT／LiquidCrystal**（不受影響）
- **學生手寫的 `#include`**（同 spec 146 的界線）
- **`ESP8266WiFi.h` 的 API 差異**（`WiFi.begin` 兩邊同名——這一刀只換標頭）

## 已知的坑

1. 🔴 **不要把板子的替換塞進 `cIoHeaderFor`**——spec 146 就是在那裡踩過：
   「兩個函式如果回傳同一種型別，很容易被合成一個。」
2. **`provides` 的預設方向不可反**：省略 ＝ 提供全部（`types.ts` 已寫死理由）
3. **可拿性護欄（第十九條）** 會因為可見集合變小而動——要一起更新並說明
4. ⚠️ **本機沒有 Arduino 核心，`gcc` 驗不了**——護欄只守到**宣告層與產出字串**，
   而**這個邊界要寫在測試檔頭上**（spec 146 有 `gcc`，這一刀沒有）

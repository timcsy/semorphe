# Feature Specification：Arduino 第 1–3 項——執行模型 ＋ 腳位 ＋ Serial

**Feature Branch**: `137-arduino-execution-model`
**Created**: 2026-08-17
**Status**: Draft
**路線圖位置**: vision 階段 6.11（第 1、2、3 項；**第 4 項板子視圖不在本輪**）
**設計脈絡**: `knowledge/draft/2026-08-13-支援Arduino要加什麼.md` §五（**in-flight**）
**排序理由**: `knowledge/history/075`（含**被否決那一邊的代價**）

---

## 出發點：一個「跑完了」而其實什麼都沒發生的量測

十段 Arduino 語料今天的實測：

```
殘差節點  0 / 10   🟢 全部辨識得出來——177 顆膠囊直接可用
輸出      "" × 10  🔴 而一段都沒有真的執行
```

原因：`cpp:program` 的執行路是 `if (ctx.functions.has('main'))`
——**Arduino sketch 沒有 `main`**，所以 `setup`／`loop` 從來沒有人呼叫，
**而它不會拋錯，只會安靜地什麼都不做**。

> 🔴 **一個「沒有失敗」的訊號，與一個「成功」的訊號，在報表上長得一模一樣。**
> （`draft`§一——而我曾據此宣稱「10/10 Arduino 跑完了」。）

⚠️ 所以本規格的驗收**錨在輸出**，不是「跑完了沒拋錯」。

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 學生的 sketch 真的會動 (Priority: P1)

一個學生打開系統、選「Arduino」，貼一段最普通的閃爍程式：

```
void setup(){ Serial.begin(9600); }
void loop(){ Serial.println("hi"); delay(1000); }
```

他按執行，**應該看到 `hi` 一行一行出現**。

**Why this priority**: 這是整個階段 6.11 的意義。
🔴 而在它成立之前，前面的每一顆 Arduino 膠囊都是**沒有人能執行的裝飾**。

**Independent Test**: 選 Arduino 目標 → 貼上面那段 → 按執行 → 主控台出現 `hi`。

**Acceptance Scenarios**:

1. **Given** 選了 Arduino 目標，**When** 執行一段只有 `setup()` 的 sketch，
   **Then** `setup()` 的內容**跑過一次**。
2. **Given** 一段有 `loop()` 的 sketch，**When** 執行，
   **Then** `loop()` **重複執行**，而**不是**跑一次就停。
3. **Given** 一段沒有 `setup`／`loop`／`main` 的程式，**When** 執行，
   **Then** 🔴 系統**說得出「找不到進入點」**——不得安靜地什麼都不做。
4. **Given** 選回 C++ 目標，**When** 執行一段有 `main()` 的程式，
   **Then** 行為與本功能之前**完全相同**。

---

### User Story 2 - 腳位與時間看得見 (Priority: P1)

學生寫 `digitalWrite(13, HIGH); delay(1000);`——他要能看出**13 腳現在是高電位**，
而 `millis()` 要回得出一個**往前走**的數字。

**Why this priority**: 腳位是 Arduino 與一般 C++ 的**唯一實質差別**。
沒有它，「Arduino 目標」只是換了個進入點的 C++。

**Independent Test**: 執行 `pinMode(13,OUTPUT); digitalWrite(13,HIGH);`
→ 系統內部記得「13 腳 = 高」；`digitalRead(13)` 讀得回來。

**Acceptance Scenarios**:

1. **Given** `pinMode(13, OUTPUT)` 執行過，**When** `digitalWrite(13, HIGH)`，
   **Then** 13 腳的狀態是高電位。
2. **Given** 一支迴圈裡有 `delay(1000)`，**When** 跑兩圈，
   **Then** `millis()` 的差值**至少是 1000**。
3. **Given** `analogWrite(9, 255)`，**When** 讀 9 腳，**Then** 讀得到那個類比值。
4. **Given** 一個**沒有 `pinMode` 就 `digitalWrite`** 的腳位，**When** 執行，
   **Then** ⚠️ 系統的行為要**說得出來**（照做、或出聲）——**不得是未定義的**。

---

### User Story 3 - 時間可以是假的，也可以是真的 (Priority: P2)

`delay(1000)` 預設**不真的等一秒**（模擬時鐘），這樣測試可重現、跑得快。
而學生想看**真的閃爍**時，可以切成真實時間。

**Why this priority**: 使用者拍板要兩條路，**而他是在看過代價之後選的**：

```
🔴 兩條路 ＝ 兩份行為，而【只有一條會被測到】
```

**Independent Test**: 模擬模式下，一段含 `delay(1000)` × 3 的程式**瞬間跑完**，
而 `millis()` 回報 ≥ 3000。

**Acceptance Scenarios**:

1. **Given** 模擬時鐘（預設），**When** 執行含三次 `delay(1000)` 的 sketch，
   **Then** 它在**遠少於三秒**內完成，而 `millis()` **≥ 3000**。
2. **Given** 真實時間模式，**When** 執行 `delay(50)`，
   **Then** 它**真的花了大約 50 毫秒**。
3. 🔴 **Given** 這兩條路，**When** 交付，
   **Then** **兩條都要有測試，或者在 `findings.md` 裡【明說】哪一條沒被測到**。
   > **一條沒有人跑的路，與一條不存在的路，在報表上長得一樣
   > ——而這一條會被學生跑到（他想看真的閃爍）。**

---

### Edge Cases

- 🔴 **`loop()` 是無限的。** 測試必須有**有界的圈數**，而那個界**要說得出理由**
  （不是隨手挑一個數字）。使用者按停止時要停得下來。
- **同時有 `main()` 與 `setup()`／`loop()`** → 行為要說得出來，不得看載入順序。
- **`setup()` 拋錯** → `loop()` **不該**繼續跑。
- **腳位號碼超出範圍**（`digitalWrite(999, HIGH)`）→ 出聲，不得靜默。
- ⚠️ **`byte` 與 `String` 這兩個 Arduino 型別**——十段語料裡各出現一次。
  它們是型別名，不是函式；**本輪要說清楚它們算不算範圍內**。

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統 MUST 支援一個 Arduino 目標，選它之後**進入點不再只有 `main`**。
- **FR-002**: 選 Arduino 目標時，系統 MUST 先執行一次 `setup()`，再**重複**執行 `loop()`。
- **FR-003**: 系統 MUST 在**找不到任何進入點**時出聲，不得安靜地結束。
  - ⚠️ 這一條是本功能的**起因**：今天的行為正是「安靜地什麼都不做」。
- **FR-004**: 系統 MUST 提供腳位狀態：`pinMode`／`digitalWrite`／`digitalRead`／
  `analogRead`／`analogWrite`，以及常數 `HIGH`／`LOW`／`OUTPUT`／`INPUT`／
  `INPUT_PULLUP`／`A0`，＋ `map`。
- **FR-005**: 系統 MUST 提供 `Serial.begin`／`print`／`println`，
  而它們的輸出 MUST 出現在**現有的主控台**（不新開面板）。
- **FR-006**: 系統 MUST 提供 `delay` 與 `millis`，而**預設是模擬時鐘**
  （可重現、不真的等待）。
- **FR-007**: 系統 MUST 讓使用者切換到真實時間。
- **FR-008**: 🔴 核心與直譯器 MUST NOT 認識「arduino」這個字
  ——目標的資訊以**通用的形式**傳進執行路。
- **FR-009**: 🔴 `src/core/types.ts` 的 `io_style` MUST NOT 改變。
  Serial 這個第三種 I/O 風格住在**語言套件**的宣告裡。
- **FR-010**: C 與 C++ 兩個目標的行為 MUST NOT 改變。
- **FR-011**: 執行 MUST 在使用者要求停止時停得下來（`loop()` 是無限的）。

### Key Entities

- **進入點**：「哪一個函式先跑」是**整個程式這顆的知識**，不是那顆函式的性質。
  （`program/execute.ts` 檔頭逐字：「一個叫 `main` 的函式在別的語言裡可能什麼都不是。」）
- **腳位狀態**：號碼 → 模式（輸入／輸出）＋ 值（高／低／類比）。
- **模擬時鐘**：一個往前走的毫秒數，**而它與真實時間解耦**。
- **I/O 風格家族**：`cout` / `printf` / **`Serial`** 是同一個等價類的三個成員
  （`print` 與 `print_formatted` 今天已經宣告了同一個 `ioRole`）。

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 🔴 十段 Arduino 語料**真的印得出東西**——今天是 `""`×10。
  ⚠️ 錨在**輸出**，不是「沒拋錯」。
- **SC-002**: 覆蓋率探測裡 Arduino 從「不執行」翻成「執行並比對」。
- **SC-003**: 使用者選得到 Arduino 目標，而選擇器數量**沒有增加**。
- **SC-004**: 「找不到進入點」的情況下，使用者**看得到一句話**（今天是 0 句）。
- **SC-005**: 模擬時鐘下，含三次 `delay(1000)` 的 sketch 在**遠少於三秒**內完成，
  而回報的毫秒數 **≥ 3000**。
- **SC-006**: 🔴 時鐘的兩條路，**被測到的條數要說得出來**（2/2，或 1/2 並寫明哪一條）。
- **SC-007**: 中立性的違規數 **仍是 0**；`io_style` 的定義**一個字都沒改**。
- **SC-008**: 既有全套測試全綠（現況 **4211**），**47 條護欄基線一個數字都不動**。
- **SC-009**: 🔴 **在真的瀏覽器上驗過**，⚠️ **而 server 是改動【之後】啟動的**。

---

## Assumptions

- 十段語料代表「一般的入門 Arduino 程式」；本輪**不追求**完整的 Arduino API。
- `byte` 視為 `unsigned char` 的別名；**`String` 若成本過高，可留在範圍外並寫明**。
- 腳位模型是**純軟體**的——沒有電氣模擬、沒有接線（那是第 5 項）。
- 「重複執行 `loop()`」在測試裡有界；在 UI 上由使用者的停止控制。

---

## 明確排除（防蔓延）

- 🔴 **第 4 項板子視圖**——它是**面板佈局那一格的探針**，性質不同，自己一個規格。
- 第 5 項接線（ArduinoCAD 併入）、第 6 項真板子（`arduino-cli`）。
- **`provides` / `reference`** 兩格——查證過**不是本輪前置**
  （Arduino sketch 一行 `#include` 都沒有）。
- ⚠️ **`arduino:` 該不該是自己的 scope**（draft §六 未決②，**仍然開著**）
  ——本輪沿用既有 scope，**而 `findings.md` 要說明那是暫時的**。
- 中斷（`attachInterrupt`）、`EEPROM`、`Wire`／`SPI`。

---

## 已知的坑（來自本專案，不要重踩）

| 坑 | 出處 | 對策 |
|---|---|---|
| 🔴 「沒有失敗」被當成「成功」 | `draft`§一（我踩過） | SC-001 錨在輸出 |
| 開瀏覽器測到不存在的世界 | `experience`（spec 136 踩過） | SC-009 的 server 條件 |
| 機制有了沒人接上（×11） | `concepts/執行機構.md` | 第 47 條護欄 ＋ US1 是端到端的 |
| 核心認識語言專屬的字 | P9／中立性護欄 | FR-008、FR-009 |
| 護欄第一次就綠 | `build-guardrail` 6.5 | 本輪**不新增**護欄，改用探測翻轉 |
| 兩條路只有一條被測 | 使用者已接受的代價 | US3 場景 3 ＋ SC-006 |

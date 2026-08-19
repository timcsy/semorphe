# Feature Specification：腳位的界由板子決定

**Feature Branch**: `145-board-pin-model`
**Created**: 2026-08-19
**Status**: Draft
**路線圖位置**: vision「屬性的候選值由目標提供」**第二步**（`144` 已清完地基）

---

## 🔴 出發點：路線圖寫的那件事【不存在】

路線圖的驗收寫著「**三塊板子的腳位下拉不同**」。實測：

```
pinMode 的 PIN     input_value（Expression）——學生插一顆數字積木進去
腳位下拉            🔴 只有一個，而它是 cpp:pin_constant 的常數清單
                      ['HIGH','LOW','OUTPUT','INPUT','INPUT_PULLUP','A0']
```

**沒有腳位下拉。** 那條驗收指著一個不存在的東西。

🟢 **而真正跟板子有關的東西在【執行期】，寫死成 Uno**：

```
arduino-pins.ts:36    const MAX_PIN = 19                    「Uno 的腳位範圍」
arduino-pins.ts:84    「腳位號碼 25 超出範圍——這塊板子只有 0–19」
arduino-pins.ts:115   A0: 14, A1: 15, … A5: 19
```

⚠️ **所以一個用 ESP32 的學生跑 `digitalWrite(25, HIGH)`，會被告知
「這塊板子只有 0–19」——而那對他的板子是錯的。**

> **一個錯的錯誤訊息比沒有訊息更糟——而「板子寫死」讓它變成
> 【對某些使用者永遠是錯的】。**

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - ESP32 的學生用得了他板子上的腳位 (Priority: P1)

一位學生選 ESP32，寫 `digitalWrite(25, HIGH)` 並按執行。
今天它**拋錯**說板子只有 0–19；他要的是**它跑得起來**。

**Acceptance Scenarios**:

1. **Given** 目標是 `esp32`，**When** 執行 `pinMode(25, OUTPUT); digitalWrite(25, HIGH);`，
   **Then** 不拋錯，且腳位 25 的狀態被記下來
2. **Given** 目標是 `arduino-uno`，**When** 執行同一段，
   **Then** **仍然拋錯**，而訊息說得出**這塊板子**的範圍

### User Story 2 - 🔴 越界仍然要出聲 (Priority: P1)

**Why this priority**: 與 US1 同級。⚠️ **最容易的錯法是「把界拿掉就不會錯了」**
——而 `arduino-pins.ts` 的檔頭寫著那個界存在的理由：

> 「`digitalWrite(999, HIGH)` 在真板子上什麼都不會發生，
> 而**那正是最難查的那種錯**。」

**Acceptance Scenarios**:

1. **Given** 任一板子，**When** 執行 `digitalWrite(999, HIGH)`，**Then** 拋錯
2. **Given** 訊息，**Then** 它說得出**是哪一塊板子**的範圍，不是一個裸數字

### Edge Cases

- **`A0` 在 ESP32 上是什麼**：ESP32 的類比腳位不叫 `A0`
  → ⚠️ **查證後決定**：不在的常數應該「查不到」而不是「給一個 Uno 的值」
- **沒有指定板子的 `arduino` 目標**：保持今天的行為（Uno）
- **非 Arduino 目標**（cpp／c／競程）：**完全不受影響**

---

## Requirements *(mandatory)*

- **FR-001**：腳位的**上界**與**具名常數表** MUST 由目標提供，不得寫死。
- **FR-002**：越界 MUST 仍然拋錯（US2）。
- **FR-003**：錯誤訊息 MUST 說得出是**哪一塊板子**的範圍。
- **FR-004**：`arduino`（不指定板子）MUST 維持今天的行為。
- **FR-005**：非 Arduino 目標 MUST 完全不受影響。
- **FR-006**：🔴 一塊板子沒有的具名常數（ESP32 的 `A0`）MUST **查不到**，
  而不是回一個別的板子的值。

## Key Entities

- **板子的腳位模型**：`{ maxPin, constants }`。⚠️ 它掛在**目標**上
  （`Target.provides` 是能力，這是**數值**——兩者不同，見 plan 論證）。

---

## Success Criteria

- **SC-001**：ESP32 目標下 `digitalWrite(25,…)` **跑得起來**（今天拋錯）。
- **SC-002**：任一板子 `digitalWrite(999,…)` **仍然拋錯**。
- **SC-003**：錯誤訊息含板子名稱。
- **SC-004**：C／C++／競程三個目標的測試**一支都不變**。
- **SC-005**：新增第四塊板子時，需要編輯的**既有共用檔為 0 個**。

---

## 明確排除

- 🔴 **「三塊板子的腳位下拉不同」**——**實測否決**：沒有腳位下拉。
  ⚠️ 重開條件是「真的做出一個腳位下拉」，不是「又想到它了」。
- **板子視圖／腳位狀態顯示**——`history/077` 明寫推遲。
- **PWM 通道數、觸摸腳位清單**等更細的板子差異——**沒有當前需求**（憲法 I）。
- **改寫既有的錯誤訊息措辭**。

## Assumptions

- **ESP32 的腳位上界取 39**（GPIO 0–39，而 34–39 只能輸入）
  ⚠️ **要查證**；而「只能輸入」那一層**不做**（沒有當前需求）。
- **Uno 與 Nano 的腳位模型相同**——⚠️ 驗收**逐塊斷言**。

## 已知的坑

1. 🔴 **不要把界拿掉**——US2 就是為了防這個。
2. **`Target` 上要不要多一格**：`provides` 是**能力**（有沒有），
   腳位模型是**數值**。⚠️ **兩者混在一格會讓 `provides` 變成一個什麼都裝的袋子**
   ——plan 要論證，不得默默塞進去。
3. **執行期的表由誰查**：`PIN_CONSTANT_VALUES` 今天是模組層級的常數，
   而目標是執行期才知道的 → **那條路要接**。

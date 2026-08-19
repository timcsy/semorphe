# Feature Specification：板子成為目標，而它決定學生看得到什麼

**Feature Branch**: `142-arduino-board-targets`
**Created**: 2026-08-19
**Status**: Draft
**路線圖位置**: vision 階段 6.11 **第 4 項**（第 1–3 項見 spec `137`）
**同時清償**: `vision.md:280` 未清的債「`provides`／`reference` 兩格」——**本刀只做 `provides`**
**設計脈絡**: `knowledge/draft/2026-08-13-支援Arduino要加什麼.md`（**in-flight**）

> ⚠️ **編號跳過 141**：`141` 已被 PR #2 的分支 `141-cpp-arduino-builtins` 用掉
> （階段 6.16 的零件積木，走 component-pipeline 沒有建 spec 目錄）。
> 沿用它會讓 `feat(141)` 那批 commit 指向錯的 spec。

---

## 出發點：一個剛量到的事實，不是一個計畫

```
cpp:touch_read、cpp:pwm_attach   都在 topics/arduino.json 同一棵層級樹（:71、:75）
TargetRegistry                   只註冊四個目標，沒有板子這一維
```

🔴 **今天一個用 Uno 的學生，拉得到 ESP32 才有的積木**——而它在他的板子上編不過。

⚠️ 而這一批是**上週剛做的**。`cpp:pwm_write` 的 `_lift_why` 自己寫著
「第一個參數是通道還是腳位，**在程式碼裡看不出來**」
——那個差別的來源正是**板子與核心版本**，而當時刻意不做成兩顆身分。

> **一個「在程式碼裡看不出來」的差別，它的來源通常在程式碼【之外】
> ——而那個外部的東西如果沒有被建模，差別就只能靠人記得。**

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 學生拿不到他的板子上不存在的積木 (Priority: P1)

一位老師在課堂上發 Arduino Uno。學生開啟 Semorphe，選擇「Arduino Uno」，
在工具箱裡**找不到**觸摸感應、PWM 通道那些 ESP32 才有的積木。

**Why this priority**: 這是本刀存在的理由。今天學生拉得到，燒錄時才發現編不過
——而錯誤訊息出現在 Arduino IDE，不在 Semorphe 裡，**學生無從得知是積木選錯了**。

**Independent Test**: 只做這一條就有價值——切到 Uno，數工具箱裡的積木少了哪幾顆。

**Acceptance Scenarios**:

1. **Given** 目標是 `arduino-uno`，**When** 展開所有工具箱分類，
   **Then** `cpp:touch_read`、`cpp:pwm_attach`、`cpp:pwm_setup`、`cpp:pwm_bind`、
   `cpp:pwm_write` 一顆都拿不到
2. **Given** 目標是 `esp32`，**When** 展開所有工具箱分類，**Then** 上述五顆都拿得到
3. **Given** 目標是 `arduino-nano`，**When** 展開，**Then** 與 `arduino-uno` 的可見集合相同
   （⚠️ 而**這一條要逐塊驗**，不得從 Uno 推論）

---

### User Story 2 - 貼上的程式碼仍然被完整理解 (Priority: P1)

一位學生用 Uno，而他從網路上貼了一段 ESP32 的範例進來想看看。
積木面板**照樣把 `touchRead` 顯示成專屬積木**，只是他在工具箱裡拉不出新的一顆。

**Why this priority**: 與 P1 同級，因為它是**這一刀最容易做錯的方向**。
把「拿不到」實作成「認不得」會讓貼上的程式碼降級成 `raw_code`
——那違反 P4（過濾不是簡化）與 P1 投影定理。

**Independent Test**: 在 Uno 目標下貼那段程式碼，檢查語義樹裡有沒有 `cpp:touch_read`。

**Acceptance Scenarios**:

1. **Given** 目標是 `arduino-uno`，**When** 貼上含 `touchRead(T0)` 的程式碼，
   **Then** 語義樹含 `cpp:touch_read` 且**沒有** `raw_code`／`raw_expression`
2. **Given** 同上，**When** 按「積木→程式碼」，**Then** 產出的程式碼**一字不差**

---

### User Story 3 - 三塊板子的腳位不一樣 (Priority: P2)

學生在 Uno 上看到類比腳位是 `A0`–`A5`；換到 ESP32，看到的是它自己的 GPIO 編號。

**Why this priority**: P2 而不是 P1——它是**體驗**問題（下拉選單裡出現不存在的腳位），
而 P1 是**正確性**問題（積木根本不該在那裡）。先做 P1，P2 可以跟在後面。

**Acceptance Scenarios**:

1. **Given** 目標是 `arduino-uno`，**When** 展開腳位下拉，**Then** 含 `A0`–`A5`，
   **且不含** ESP32 專屬的編號
2. **Given** 目標是 `esp32`，**When** 展開腳位下拉，**Then** 反過來

---

### Edge Cases

- **既有存檔怎麼辦**：使用者的工作區裡已經有一顆 ESP32 積木，而他切到 Uno。
  → **積木不消失**（與層級切換同一條既有行為：`experience.md:35`
  「workspace 既有積木不受層級切換影響，只影響 toolbox 可用性」）。
- **一顆概念三塊板子都有**：`digitalWrite` 之類的——`provides` 的預設必須是「有」，
  否則每加一顆元件都要在三個地方登記。
- **目標不是 Arduino**：`cpp-beginner`／`c-beginner`／`cpp-competitive` 沒有板子的概念
  → 它們的可見集合**一格都不能變**。
- **核心版本**（ESP32 core 2.x vs 3.x 的 `ledcAttach`）→ 🔴 **明確不在本刀**，見下。

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**：系統 MUST 讓使用者選得到 `arduino-uno`、`arduino-nano`、`esp32` 三個目標。
- **FR-002**：目標 MUST 能宣告它**提供哪些能力**，而工具箱的可見集合 MUST 是
  「課程清單所列」與「目標所提供」的**交集**。
- **FR-003**：🔴 能力 MUST 以**性質**表達，不得是一串概念身分的清單。
  （`experience.md:1508`「一個宣告要指涉另一顆元件時，指它的性質而不是它的名字」）
- **FR-004**：🔴 `lift` MUST **不受目標影響**——任何目標下，`touchRead` 都要被認成
  `cpp:touch_read`。可見性只作用在**工具箱**。
- **FR-005**：目標 MUST 能提供**不同的腳位常數集合**。
- **FR-006**：既有的 `cpp-beginner`／`c-beginner`／`cpp-competitive` 三個目標的
  可見集合 MUST 完全不變。
- **FR-007**：一顆沒有宣告任何能力需求的概念，MUST 在所有板子上都看得到（預設為「有」）。
- **FR-008**：🔴 「可拿性」的規範 MUST 被改寫成「**在至少一個目標下拿得到**」，
  而不是今天的「拿得到」。⚠️ 而它 MUST 在功能實作**之前**改，且**不得只改基線**。

### Key Entities

- **目標（Target）**：已存在（`id`／`name`／`topic`／`style`／`scaffold`）。
  本刀加一格 **`provides`**——這個目標提供哪些**能力**。
- **能力（capability）**：一個具名的性質（例如「有觸摸感應」「有 LEDC 硬體 PWM」）。
  元件宣告它**需要**哪些能力；目標宣告它**提供**哪些。

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**：切到 Arduino Uno 之後，工具箱裡**沒有一顆**在該板子上不存在的積木
  （今天是 5 顆 → 0 顆）。
- **SC-002**：在任一板子目標下貼上任一板子的範例程式碼，**殘差為 0**
  （沒有節點掉進 `raw_code`／`raw_expression`）。
- **SC-003**：三個既有的非 Arduino 目標，工具箱快照**逐位元組不變**。
- **SC-004**：一位老師換一塊板子只需要**一個動作**（切目標），不必改課程清單。
- **SC-005**：新增第四塊板子時，需要編輯的**既有共用檔為 0 個**
  （與階段 6.5「加一顆元件 ＝ 新增一個資料夾，零編輯」同一條判準）。

---

## 明確排除（防蔓延）

- 🔴 **板子視圖／腳位狀態顯示**——`vision.md:230` 明寫虛擬硬體推遲，理由在 `history/077`。
- 🔴 **`reference` 那一格**——另一半債，**等第一個真消費者**
  （`experience.md` 有一條：延後的理由「今天沒有消費者」已經失效兩次，
  所以這一條要寫明**它的消費者是誰**才能開）。
- 🔴 **`requires` 的風格維**——實測 `io_style=printf` 仍吐 `#include <iostream>`，
  是真缺陷、有 in-flight draft（`2026-08-13-C和C++難分難捨.md`），
  **而它動的是另一個宣告（元件的 `requires`），本刀動的是目標的 `provides`**。另開一刀。
- 🔴 **ESP32 核心版本差異**（2.x 的 `ledcSetup`＋`ledcAttachPin` vs 3.x 的 `ledcAttach`）
  ——那是**同一塊板子的兩個工具鏈版本**，不是兩塊板子。本刀不建模。

---

## Assumptions

- **Uno 與 Nano 的可見集合相同**（同 ATmega328P）。⚠️ 而驗收要求**逐塊驗**，
  不從 Uno 推論——`experience.md`「一叢違規不一定同一個根因」。
- **能力的粒度以「使用者能不能用」為準**，不以晶片規格為準。
  例：「有硬體 PWM」而不是「有 16 個 LEDC 通道」。
- 板子目標沿用既有的 `arduino` 課程清單與風格，**只換 `provides`**
  ——不新增三份 `arduino-*.json`（`experience.md:31`「不要試圖用單一 level 數字
  解決所有問題……維度之間的職責必須分清」）。

---

## 已知的坑（本專案的經驗，不要重踩）

1. 🔴 **可拿性護欄會反咬**（`experience.md:818`）。它今天要求「宣告了就要拿得到」，
   而本刀讓「這塊板子上拿不到」變成**合法**。
   → **護欄先改，功能後做**（`skills/build-guardrail` 6.5 逐字：
   「一個被順便修掉的缺陷不會留下任何紀錄，而它的同類還會再來」）。
2. **不要把板子塞進 topic** —— 會逼出三份幾乎相同的 `arduino-*.json`。
3. **`provides` 指性質不指名字** —— 否則加一顆 ESP32 元件要改三個目標的清單。
4. **P4 是過濾不是簡化** —— 拿不到 ≠ 認不得（見 User Story 2，這是最容易做錯的方向）。

---

## 相關

- `principles.md:54` P4 漸進揭露 · `principles.md:38` P2 概念代數
- `concepts/漸進揭露.md`（多維過濾）· `concepts/執行機構.md`（可拿性護欄的位置）
- `skills/build-guardrail`（護欄先蓋）· `skills/manual-acceptance`（板子切換要人按）
- `knowledge/draft/2026-08-18-收工前的瀏覽器驗收.md`（收工前的清單）

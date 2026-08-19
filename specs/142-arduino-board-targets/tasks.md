# Tasks：板子成為目標，而它決定學生看得到什麼

**Feature**: `142-arduino-board-targets` · **Plan**: [plan.md](plan.md)
**TDD**：憲法第二條「非妥協」→ **每一階段測試先寫**

---

## 🔴 不可交換的順序（違反了就等於沒做）

```
Phase 2 的 T001 護欄  →  Phase 3 的宣告  →  過濾點  →  反向測試
```

`skills/build-guardrail` 6.5 逐字：「**護欄先蓋，功能後做。**一個被順便修掉的缺陷
不會留下任何紀錄，而它的同類還會再來。」

⚠️ **T001 第一次跑會是綠的**（今天沒有元件宣告能力）——那是 6.5 的例外情況，
**處置是注入**，所以 T001 的驗收是「注入紅、真實綠」，不是「第一次紅」。

---

## Phase 1：Setup

*（無——本刀沒有新依賴、沒有新目錄結構。憲法第一條：不做不需要的事。）*

---

## Phase 2：Foundational（🔴 阻擋所有 user story）

- [X] T001 建立能力供給完備性護欄於 `tests/integration/audit-capability-supply.test.ts`——判準「每一個被宣告需要的能力，至少一個目標提供它」，硬性零；⚠️ **必須含兩支注入**：合成一顆需要不存在能力的元件 → **必須報**；合成一顆需要已提供能力的元件 → **必須不報**；★ 健康檢查錨在**掃到幾顆元件**（合成量），🔴 不可錨在違規數
- [X] T002 [P] 在 `src/core/types.ts` 的 `Target` 介面加 `provides?: readonly string[]`，附註解說明**省略 ＝ 提供全部**（FR-006：非硬體目標不得因此少東西）
- [X] T003 [P] 在 `src/core/component/traits.ts` 加 `capabilityOf(conceptId)` 與 `targetProvides(target, capability)` 兩個**唯一入口**，並在 `tests/unit/core/capability.test.ts` 各測正反兩向；🔴 消費者一律走這兩個函式，不得自己讀 `traits.needsCapability`（`concepts/性狀.md`：問性質要有唯一入口）

**Checkpoint**：`npm test` 全綠，T001 的兩支注入各自紅／綠正確。

---

## Phase 3：User Story 1 — 學生拿不到他的板子上不存在的積木（P1）

**目標**：切到 Uno，工具箱裡沒有 ESP32 才有的積木。
**獨立測試**：切三個目標，數工具箱裡的積木。

### 測試先寫

- [ ] T004 [US1] 在 `tests/integration/board-target-visibility.test.ts` 寫**會失敗**的測試：`arduino-uno` 的工具箱**不含** `cpp_touch_read`／`cpp_pwm_attach`／`cpp_pwm_setup`／`cpp_pwm_bind`／`cpp_pwm_write`；`esp32` **含**這 5 顆；⚠️ `arduino-nano` **逐顆斷言**不得從 uno 推論（`experience.md`「一叢違規不一定同一個根因」）
- [ ] T005 [P] [US1] 在 `tests/integration/board-target-visibility.test.ts` 加**反向**測試：`cpp-beginner`／`c-beginner`／`cpp-competitive` 三個目標的可見集合**完全不變**（FR-006）；並加一支**正向錨點**——`arduino-uno` 仍看得到 `cpp_pin_mode`（證明不是整個 Arduino 分類都消失了）

### 宣告

- [ ] T006 [P] [US1] 在 `src/components/cpp/touch_read/component.json` 加 `traits.needsCapability: "touch"` ＋ `_traits_why`（說明它是**板子的硬體能力**，不是語法性質，與 `ioStyle` 同形）
- [ ] T007 [P] [US1] 在 `src/components/cpp/pwm_attach`／`pwm_setup`／`pwm_bind`／`pwm_write` 四顆的 `component.json` 加 `traits.needsCapability: "ledc-pwm"` ＋ `_traits_why`
- [ ] T008 [P] [US1] 新增 `src/languages/cpp/targets/arduino-uno.json`（`provides: []`）、`arduino-nano.json`（`provides: []`）、`esp32.json`（`provides: ["touch","ledc-pwm"]`）——三者 `topic` 都是 `arduino`，🔴 **不新增三份課程清單**（research.md R1）
- [ ] T009 [US1] 在 `src/ui/app.ts` 註冊那三個目標（既有的 `arduino` **保留**，`provides` 省略 ＝ 提供全部，它是「不指定板子」的意思）

### 過濾

- [ ] T010 [US1] 在 `src/ui/app.ts` 的 `callBuildToolbox()`（:526）把 `visibleConcepts` 再過一次能力篩選；🔴 **不得改 `getVisibleConcepts()`**——它同時餵給 `markOutOfScopeBlocks`（:517），改在那裡會讓**畫布上的既有積木變灰**，而那不是本刀的需求（research.md R4）

**Checkpoint**：T004／T005 由紅轉綠，其餘測試不得退步。

---

## Phase 4：User Story 2 — 貼上的程式碼仍然被完整理解（P1）

**目標**：Uno 目標下貼 ESP32 程式碼，`touchRead` 仍被認成專屬積木。
**獨立測試**：lift 一段程式碼，看語義樹。
🔴 **這是這一刀最容易做錯的方向**——把「拿不到」做成「認不得」。

- [ ] T011 [US2] 在 `tests/integration/board-target-lift-unaffected.test.ts` 測：**在 `arduino-uno` 目標下** lift `void loop(){ int v = touchRead(T0); }`，語義樹**含** `cpp:touch_read`、**不含** `raw_code`／`raw_expression`；⚠️ **先寫正向錨點**（證明真的 lift 到東西）再寫負向
- [ ] T012 [US2] 在 `tests/integration/board-target-lift-unaffected.test.ts` 加 round-trip：generate 回去**一字不差**，且 generate 兩次文字相同
- [ ] T013 [P] [US2] 在 `tests/integration/board-target-lift-unaffected.test.ts` 加一支**守住未來**的測試：`cpp:touch_read` 的 lift **不讀任何目標／能力**——⚠️ 它守的是「有人把過濾往上游搬」，而那是本刀最自然的錯法（research.md R5、`build-guardrail` 第 9 步「正確的輸入證明它不亂報」）

**Checkpoint**：US1 ＋ US2 都綠 ⟹ **MVP 完成**。

---

## Phase 5：Polish

- [ ] T014 更新 `tests/baselines/` 與 `toolbox-snapshot` 基線；🔴 **快照若變動，必須逐項指名是哪一顆、為什麼**，不得只重產（`build-guardrail` 第 7 步）
- [ ] T015 [P] `npx tsc --noEmit` 過；`npm test` 全綠
- [ ] T016 🔴 **開瀏覽器人工驗收**——照 [quickstart.md](quickstart.md) §③ 的四條（含**第 4 條保護性**：ESP32 下拉的積木在切到 Uno 之後**必須還在畫布上**）；⚠️ 用 `skills/manual-acceptance` 的三段式，**壞的長什麼樣不可省**
- [ ] T017 知識反流：`knowledge/history/` 新增一則（能力住在 traits ＋「護欄判準不必改，要改的是我們對它在量什麼的理解」）、`knowledge/experience.md` 記蒸餾後的教訓、`knowledge/vision.md` 6.11 第 4 項打勾並在「下一步」開一筆「屬性的候選值由目標提供」（US3 的去處）

---

## 相依圖

```
T001（護欄）
  └─→ T002 ∥ T003（型別 ＋ 唯一入口）
        └─→ Phase 3（US1）：T004 ∥ T005 → T006 ∥ T007 ∥ T008 → T009 → T010
              └─→ Phase 4（US2）：T011 → T012 ∥ T013
                    └─→ Phase 5
```

**US1 與 US2 的關係**：US2 **不依賴** US1 的功能，只依賴 Phase 2 的地基
——⚠️ 但它要在 US1 **之後**跑才有意義（US1 沒做之前它本來就綠，見 research.md R5）。

## 可平行的批次

```
批次 A（Phase 2）   T002 ∥ T003
批次 B（宣告）      T006 ∥ T007 ∥ T008     ← 五顆元件 ＋ 三個目標，互不相干
批次 C（測試）      T004 ∥ T005
批次 D（US2）       T012 ∥ T013
```

## MVP 範圍

**Phase 2 ＋ Phase 3 ＋ Phase 4**（T001–T013）。
US3（腳位常數）已於 Phase 0 移出本刀（research.md R3）。

## 每個 story 的獨立測試判準

| Story | 只做它就能證明什麼 | 怎麼測 |
|---|---|---|
| **US1** | 學生拿不到編不過的積木 | 切三個目標，數工具箱 |
| **US2** | 拿不到 ≠ 認不得 | Uno 下 lift ESP32 程式碼，看語義樹 |

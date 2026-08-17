# Tasks：Arduino 第 1–3 項

**Feature**: `specs/137-arduino-execution-model/` | **Branch**: `137-arduino-execution-model`
**Input**: [spec.md](./spec.md)、[plan.md](./plan.md)、[research.md](./research.md)

> 🔴 **本任務表的第一階段結束時，功能還不能用——而報表已經誠實了。**
> 今天十段語料 `out=""` `err=""`（**安靜地什麼都不做**）；
> Phase 2 結束時它們會是**十段大聲失敗**。那是進步，而它看起來像退步。

---

## Phase 1：Setup

- [x] T001 印出 `Serial.println("hi")` 的**實際 lift 節點樹**
  - 🔴 research 的未查項——**不要照猜的形狀寫**
  - 產出貼進 `findings.md`

## Phase 2：US1 - 進入點（P1）🔴 而它自己就是一次交付

**獨立驗收**：沒有 `main` 的 sketch 不再安靜結束。

- [x] T002 [US1] 加測試：**沒有任何進入點 → 出聲**（`tests/unit/` 或元件 spec 測試）
  - 🔴 **它現在必須紅**——今天的行為是靜默的（`build-guardrail` 6.5 的同一條）
- [x] T003 [US1] `src/components/cpp/program/execute.ts`：`main` > `setup`／`loop` > **出聲**
  - ⚠️ 它是**膠囊不是核心**，所以中立性護欄不受影響（research Q1）
  - 優先順序要**寫進註解**：`main` 存在時 `main` 贏，而那是規格的 Edge Case
- [x] T004 [US1] 加測試：**同時有 `main` 與 `setup`／`loop`** → `main` 贏，不看載入順序
- [x] T005 [US1] 加測試：`setup()` 拋錯 → `loop()` **不繼續跑**
- [x] T006 [US1] 🔴 跑十段語料，**確認全部從「安靜」變成「大聲失敗」**
  - 期望：6 段 `UNDEFINED_FUNC`（pinMode／millis）、4 段 `UNDECLARED_VAR`（Serial）
  - ⚠️ **這是 SC-004 的兌現**：說得出話的情況從 0 段變成 10 段
- [ ] T007 [US1] C++ 不得退步：`npm test` 全綠

## Phase 3：US2 - 腳位、時間、Serial（P1）

**獨立驗收**：`pinMode(13,OUTPUT); digitalWrite(13,HIGH);` 之後 `digitalRead(13)` 讀得回來。

- [ ] T008 [US2] 🔴 走 `/component-pipeline`——**8 個函式 ＋ 6 個常數 ＋ `byte`**
  - `pinMode` `digitalWrite` `digitalRead` `analogRead` `analogWrite` `delay` `millis` `map`
  - `HIGH` `LOW` `OUTPUT` `INPUT` `INPUT_PULLUP` `A0`
  - ⚠️ **必須用 Skill tool 調用**，不可手寫、不可用 agent 精簡代替（使用者的既有回饋）
  - 🟢 lift 那一路是**一行資料**（`registerCallConcept`，research Q3）
- [ ] T009 [US2] `Serial` 單獨處理——**形狀不同**（物件的方法呼叫，不是具名函式）
  - `Serial.begin` / `print` / `println` → 接**現有的主控台**，不新開面板
  - 🔴 依 T001 印出來的實際節點形狀寫
- [ ] T010 [US2] 腳位狀態機：號碼 → 模式 ＋ 值，由膠囊**惰性安裝**進 `ctx`
  - 照 `installLambda(ctx)` 的形狀（`components/cpp/lambda/execute.ts:8`）
- [ ] T011 [US2] **沒有 `pinMode` 就 `digitalWrite`** → 行為要說得出來，不得未定義（規格 Edge Case）
- [ ] T012 [US2] **腳位號碼超範圍** → 出聲，不得靜默
- [ ] T013 [US2] 模擬時鐘：`delay` 推進、`millis` 回報，**惰性安裝**
- [ ] T014 [US2] `String` → 映射到既有字串概念
  - 🔴 **而那是一個簡化**（`+=`／`length()` 不保證）——**寫進 `findings.md`**

## Phase 4：US1 續 - Arduino 目標（P1）

- [ ] T015 `src/languages/cpp/topics/arduino.json`——⚠️ **手寫**
  - 🔴 `findings.md` 要寫明**為什麼沒有推導判準**：spec 136 的判準是
    「C++ **扣掉**什麼」，而 Arduino 是「C++ **換掉**一部分」
- [ ] T016 `src/languages/cpp/targets/arduino.json`（第四個目標，沿用 `apcs` 風格）
  - ⚠️ 「用 Serial 而不是 cout」由**概念層的等價邊**決定，不是由風格決定（research Q8）
- [ ] T017 `tests/unit/target.test.ts`：四筆目標，課程清單與風格**各自不重複**
- [ ] T018 🔴 十段語料的 `runnable` 從 `false` 翻成 `true`，而**它們真的印得出東西**
  - ⚠️ 驗收錨在**輸出**，不是「沒拋錯」（SC-001）
- [ ] T019 `loop()` 的界：**模擬時間上限**（語義的界）＋ `maxSteps`（防卡死的網）
  - 🔴 兩個都要有，**而理由不同**（research Q6）。⚠️ 不接受「隨手挑的圈數」

## Phase 5：US3 - 時鐘的第二條路（P2）

- [ ] T020 [US3] 真實時間模式 ＋ 切換（語言套件的模組層級設定，**不動 `src/core/types.ts`**）
- [ ] T021 [US3] 模擬那條的測試：三次 `delay(1000)` **遠少於三秒**跑完，而 `millis()` ≥ 3000
- [ ] T022 [US3] 🔴 真實那條：**寫一支測試，或在 `findings.md` 明說它沒被測到**
  - ⚠️ 這是使用者**看過代價之後仍然選的**，所以那個代價要**看得見**（SC-006）

## Phase 6：Polish 與驗

- [ ] T023 `npm test` 全綠（現況 4211）；**47 條護欄基線一個數字都不動**
- [ ] T024 🔴 中立性 `total` 仍是 **0**；`src/core/types.ts` 的 `io_style` **一個字沒改**
- [ ] T025 `npx tsc --noEmit`（⚠️ `npm run lint` 這個腳本不存在，見 spec 136 的 findings）
- [ ] T026 `npx playwright test`（現況 31 綠）
- [ ] T027 🔴 **開瀏覽器實測**——⚠️ **server 必須是改動【之後】啟動的**
  - `experience`：「一個開著沒關的 dev server，會讓開瀏覽器實測測到一個不存在的世界」
- [ ] T028 `findings.md`：坑逐條記下，**含「因為知道答案而跳過的」**
  - 必記：T001 的節點形狀、T014 的簡化、T015 沒有判準的理由、
    T022 被測到幾條、`arduino:` scope 仍沿用既有的（draft §六 未決②**仍然開著**）
- [ ] T029 knowie 反流：`history/` 轉變 ＋ `experience` 教訓 ＋ vision 階段 6.11 收成

---

## Dependencies

```
T001 （先印形狀）
 └─ Phase 2 US1 (T002…T007)      🔴 T002 必須先紅
     ├─ Phase 3 US2 (T008…T014)  ← T009 需要 T001
     │   └─ Phase 4 (T015…T019)
     │       └─ Phase 5 US3 (T020…T022)
     └─────────── Phase 6 (T023…T029)
```

**平行機會**：T004／T005 可與 T003 之後同時。T008 的膠囊由 skill 內部批次處理。
**必須循序**：T009 依賴 T001；T018 依賴 T008–T014 全部完成。

## MVP

**Phase 2（T001–T007）** ＝ 進入點修好、報表誠實。
🔴 **而它交付的不是功能，是【一個看得見的錯誤】**——今天是看不見的。

**Phase 2 ＋ 3 ＋ 4** ＝ 一個真的能教 Arduino 的工具。

## 🔴 這份任務表的三個閘門

| 閘門 | 在哪 | 沒過的話 |
|---|---|---|
| 「沒有進入點 → 出聲」**必須先紅** | T002 | 判準寫錯了，不要往下走 |
| 十段語料要**大聲失敗**才算 Phase 2 完成 | T006 | 還是安靜的 → 進入點沒生效 |
| 驗收錨在**輸出**不是「沒拋錯」 | T018 | 會重演「10/10 跑完了」那次誤報 |

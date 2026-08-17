# Implementation Plan：Arduino 第 1–3 項

**Branch**: `137-arduino-execution-model` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)
**Input**: [research.md](./research.md)（🔴 **它推翻了 brief 裡指認的「閘門」**）

## Summary

讓 Arduino sketch **真的跑得動**：進入點從 `main` 擴到 `setup`／`loop`，
補上腳位、時間與 `Serial`，並讓 Arduino 成為第三個目標。

🟢 **而 research 把成本重估了**：進入點**六行**、核心**零改動**、
新概念**一行 lift 資料**。真正的工作量在**膠囊本身**（9 顆左右）。

## Technical Context

**Language**: TypeScript 5.x
**Primary Dependencies**: Blockly 12.4.1、Vite 7.x、Vitest、Playwright
**Testing**: `npm test`（4211 綠）＋ `npx playwright test`（31 綠）
**Constraints**: 中立性 `total: 0`；47 條護欄基線不動；`src/core/types.ts` 不動
**Scale/Scope**: 8 個函式 ＋ 1 個物件 ＋ 6 個常數 ＋ 1 個型別別名；10 段語料

## Constitution Check

| 憲章條目 | 本功能 | 判定 |
|---|---|---|
| 根公理（唯一真實，各式投影） | Arduino 是**同一棵樹的另一種目標**，不是另一種樹 | 🟢 |
| P3 開放擴充 | 新概念走膠囊，**核心一行不動** | 🟢 |
| P4 漸進揭露 | Arduino 課程清單＝另一個可見子集 | 🟢 |
| P9 語言中立 | 🟢 research Q1：進入點的知識**本來就住在膠囊裡** | 🟢 |
| 四項獨立性 | ⚠️ **語言獨立性本輪不被驗**——那是 Python 的工作（`history/075` 的代價） | 🟡 已記錄 |

**Gate 結果**：通過。⚠️ 唯一的 🟡 是**已經在排序決定時接受過的代價**，不是新違規。

---

## 設計決定（全部來自 research）

### D1 進入點：`main` > `setup`／`loop` > **出聲**（research Q1）

改 `src/components/cpp/program/execute.ts`——**一顆膠囊，不是核心**。
🔴 **而第三段是新的**：今天沒有 `main` 就安靜結束，那正是本功能的起因。

### D2 新概念一律走 `/component-pipeline`（research Q4）

使用者的既有回饋：「**必須用 Skill tool 調用 component skills，不可用 agent 精簡代替**」。
target 是**一個特性**（Arduino 執行期表面），不是一顆一顆跑。

### D3 時鐘：膠囊惰性安裝，切換放語言套件的模組層級（research Q5）

照 `installLambda(ctx)` 的形狀。🔴 **不動 `src/core/types.ts`。**

### D4 兩個界，理由不同（research Q6）

```
模擬時間上限   語義的界——使用者看得懂（「跑 5 秒」）
maxSteps       防卡死的網——一個沒有 delay 的 loop() 到不了時間上限
```

### D5 `String` 映射到既有字串概念，**而那是一個簡化**（research Q7）

⚠️ 要寫進 `findings.md`——不是靜靜地做掉。

---

## Phase 0：先讓「安靜」變成「大聲」（🔴 它自己就是一次交付）

1. 印出 `Serial.println("hi")` 的**實際 lift 節點樹**（research 的未查項）
2. `program/execute.ts`：`main` > `setup`／`loop` > **出聲**
3. 加一支測試：**沒有任何進入點 → 出聲**（今天是靜默的，所以它**現在必須紅**）
4. 跑十段語料 → 期望**十段全部大聲失敗**（`UNDEFINED_FUNC`／`UNDECLARED_VAR`）
   🟢 **那是進步**：規格 SC-004 從 0 句話變成 10 句

⚠️ **這一階段結束時功能還不能用，而報表已經誠實了。**

## Phase 1：膠囊（走 skill，不手寫）

5. `/component-pipeline cpp <Arduino 執行期表面>` —— 8 函式 ＋ 常數 ＋ `byte`
6. `Serial` 單獨處理（形狀不同：物件的方法呼叫）
7. 模擬時鐘：`delay`／`millis` 惰性安裝

## Phase 2：目標

8. `topics/arduino.json`——⚠️ **手寫**，而 `findings.md` 要寫明
   「spec 136 的推導判準不適用」的理由（Arduino 是**換掉**不是**扣掉**）
9. `targets/arduino.json`（第四個目標，沿用 `apcs` 風格）
10. 十段語料的 `runnable` 從 `false` 翻成 `true`

## Phase 3：時鐘的第二條路

11. 真實時間模式 ＋ 切換
12. 🔴 **兩條路各一支測試，或在 `findings.md` 明說哪一條沒被測到**（SC-006）

## Phase 4：驗

13. `npm test` 全綠；47 條基線不動；中立性 `total` 仍 0；`io_style` 一個字沒改
14. `npx playwright test`
15. 🔴 **開瀏覽器**，⚠️ **而 server 必須是改動【之後】啟動的**
16. `findings.md`（含「因為知道答案而跳過的」）
17. knowie 反流

---

## 風險

| 風險 | 出處 | 對策 |
|---|---|---|
| 🔴 「跑完了」被當成「成功」 | `draft`§一（我踩過） | Phase 0 步驟 4 錨在**錯誤訊息**，Phase 2 錨在**輸出** |
| 開瀏覽器測到不存在的世界 | spec 136 的誤診 | 步驟 15 的 server 條件 |
| 照猜的節點形狀寫 `Serial` | research 的未查項 | 步驟 1 **先印出來** |
| 手寫膠囊繞過 skill | 使用者的既有回饋 | D2 |
| 兩條時鐘路只有一條被測 | 使用者已接受的代價 | 步驟 12 |
| `loop()` 界是隨手挑的數字 | 規格 Edge Case | D4 兩個界各有理由 |
| Arduino 課程清單手寫 → 漂移 | 雙重真相來源 | ⚠️ **本輪接受**，而 `findings.md` 要寫明它沒有推導判準 |

## Complexity Tracking

**無憲章違規需要辯護。**
⚠️ 唯一接近的是「Arduino 課程清單是**手寫**的」——而 spec 136 的推導判準
（`requires` ∧ 無 `ioRole`）**在這裡不適用**：Arduino 不是「C++ 扣掉什麼」，
是「C++ **換掉**一部分」。🔴 **那個差別要寫下來，否則下一個人會以為漏了判準。**

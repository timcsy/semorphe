# Tasks：目標第二刀——讓它有第一個真消費者

**Feature**: `specs/136-target-first-consumer/` | **Branch**: `136-target-first-consumer`
**Input**: [spec.md](./spec.md)、[plan.md](./plan.md)、[research.md](./research.md)、[quickstart.md](./quickstart.md)

> 🔴 **本任務表有一個不尋常的順序約束**：Phase 2 的護欄**必須在 Phase 3 接上之前跑出紅的**。
> 那不是流程潔癖——`build-guardrail` 6.5 逐字：「**基線是先產生的**（那等於把現況直接封為合格）」。

---

## Phase 1：Setup

- [x] T001 讀 `knowledge/skills/build-guardrail/SKILL.md`，確認第 2 步的三個錨點簽名與 6.8 的硬性零判準

## Phase 2：護欄先行（US3 · P2，🔴 而它必須先做）

**目標**：讓「機制有了沒人接上」下一次自己出聲。
**獨立驗收**：把接上的那行拿掉 → 紅並指名；接回去 → 綠。

- [x] T002 [US3] 建立 `tests/integration/audit-registry-consumers.test.ts`——第四十七條護欄
  - 檔頭四段：**規則** / **自我否證聲明** / **本護欄不檢測什麼** / 出處
  - ⚠️ 自我否證聲明**先寫**，且錨在**合成量**（掃到的登錄表檔數），不可錨在違規數
- [x] T003 [US3] 實作掃描：`src/**/*registry*.ts` → 對每個檔數「`src/` 內有幾個檔 import 它」
  - 報表**印出全部 11 列**（含消費者數為 1 的那兩個），不只印違規
- [x] T004 [US3] 加 `★ 入口條件`：掃到的登錄表檔數 `≥ 8`（合成量）
- [x] T005 [US3] 加 `★ 注入①`：合成一個零消費者的登錄表 → 必須被**指名**
- [x] T006 [US3] 加 `★ 注入②`：全部有消費者的合成輸入 → **不得亂報**
- [x] T007 [US3] 🔴 **跑它，確認紅，並把報表貼進 `findings.md`**
  - **綠的話停下來**——判準寫錯或掃描沒吃到檔案，不要往下走

## Phase 3：Foundational——資料（阻斷 US1 與 US2）

- [x] T008 [P] 建立 `src/languages/cpp/targets/cpp-competitive.json`
  - `{ id, name, topic: "cpp-competitive", style: "competitive" }`
  - ⚠️ 理由是**防功能倒退**（否則競賽課程清單拿不到），不是新功能
- [x] T009 建立 `tests/unit/c-topic-derivation.test.ts`——**判準的執行機構**
  - 斷言：`c-beginner` 概念集合 == { `cpp-beginner` 的概念 } − { requires 到 C 沒有的標頭 **∧** 無 `ioRole` 等價邊 }
  - ⚠️ 這一支的存在理由是**防漂移**：`cpp-beginner` 一改而沒重推 → 紅
- [x] T010 建立 `src/languages/cpp/topics/c-beginner.json`——由 T009 的判準推導產生
  - 樹的形狀（節點 id／label／level／children）與 `cpp-beginner` 相同，只有 `concepts` 被扣
  - 🔴 **人工複核 3 顆最像誤判的**：`math_min`／`var_swap`／`pair_make`，結論寫進 `findings.md`
- [x] T011 `src/languages/cpp/targets/c.json` 的 `topic` 由 `cpp-beginner` 改為 `c-beginner`
- [x] T012 `tests/unit/target.test.ts`：三筆目標都要指得到真的存在的課程清單與風格
  - ⚠️ 既有的「欄位**恰好**是四個」那一支**不得放寬**

## Phase 4：US1 - 老師選一次，而不是三次（P1）

**獨立驗收**：一個選單選「C 語言教學」→ 課程清單與風格同時切換。

- [x] T013 [US1] `src/ui/app.ts`：建立 `TargetRegistry` 實例並註冊三筆目標（**import JSON 資料，照 `topicRegistry` 今天的形狀**）
- [x] T014 [US1] `src/ui/toolbar/topic-selector.ts`：下拉的內容由課程清單改為目標
  - 🌳 分支彈出的職責**不變**
  - ⚠️ 對外仍回吐 `(topic, branches)`，另加風格 → 呼叫端最小改動
- [x] T015 [US1] `src/ui/app-shell.ts`：`setupSelectors` 接受目標清單，回呼帶上風格
- [x] T016 [US1] `src/ui/app.ts`：選目標 → 同時走既有的 `onTopicChange` 與 `onStyleChange` 兩條路
  - 🔴 **不要新寫第三條路**——那會變成第二個真相來源
- [x] T017 [US1] `src/ui/app.ts:604` 存檔加 `targetId`；還原時**優先讀它、沒有就回退 `topicId`**
- [x] T018 [US1] 還原時 `targetId` 指向不存在的目標 → **回退到預設**，不得崩潰
- [x] T019 [US1] 🔴 **重跑 T007 的護欄 → 現在必須綠**（SC-004：1 → 0）

## Phase 5：US2 - C 裡不存在的東西看不到（P1）

**獨立驗收**：選 C → 工具箱找不到 `cout`／`vector`；選 C++ → 找得到。

- [x] T020 [US2] `e2e/c-target.spec.ts` 擴充：**先展開全部層級**
  - 🔴 `★ 入口條件`：展開且選 C++ 時，C++ 專屬概念數 **> 0**
  - ⚠️ 沒有這一行的話，下一行的「0」在功能做出來之前就已經成立（research Q3）
- [x] T021 [US2] 同檔斷言：選 C 之後，工具箱裡 C++ 專屬概念數 **= 0**
- [ ] T022 [US2] 同檔斷言：選回 C++ → 產出與本功能之前**逐字相同**（SC-006）
  - 🔴 **沒做這一支 e2e。** SC-006 改由**全套測試**守（4211 綠，其中含所有 C++ 產出的
    roundtrip 與快照）＋ `lessons/01` 的截圖比對。⚠️ 而那**不等於**逐字比對切換前後，
    真正沒被驗到的是「切到 C 再切回來」這條來回路徑。
- [x] T023 [US2] 選擇器數量護欄：頁面上的 `select` 數量**沒有增加**（SC-009 反目標）

## Phase 6：Polish 與驗

- [x] T024 `npm test` 全綠；**46 條既有基線一個數字都不動**；中立性護欄 `total` 仍是 0
- [ ] T025 `npm run lint`
  - 🔴 **這個腳本不存在**——`CLAUDE.md` 寫著 `npm test && npm run lint`，
    而 `package.json` 的 `scripts` 裡沒有 `lint`。改跑 `npx tsc --noEmit`（過）。
    ⚠️ 一個寫在指引裡而跑不起來的指令，是一種殼。
- [x] T026 `npx playwright test`
- [x] T027 🔴 **開真的瀏覽器走一遍 `quickstart.md` ⑤**——測試綠不代表使用者看到的是對的
- [x] T028 `findings.md`：坑逐條記下，**含「因為知道答案而跳過的」**
- [ ] T029 knowie 反流：`history/` 轉變 ＋ `experience` 教訓 ＋ vision 階段 6.10 收成

---

## Dependencies

```
T001
 └─ Phase 2 (T002…T007)          🔴 必須先跑出紅的
     └─ Phase 3 (T008…T012)      資料
         ├─ Phase 4 US1 (T013…T019)
         └─ Phase 5 US2 (T020…T023)   ← 需要 T010 的 c-beginner
             └─ Phase 6 (T024…T029)
```

**平行機會**：T008 與 T009 可同時（不同檔）。T020–T023 同一個檔案，**必須循序**。

## MVP

**Phase 2 ＋ Phase 3 ＋ Phase 4**（T001–T019）＝ 目標有了消費者、選一次就切換。
Phase 5 是「三分之二的兌現」，⚠️ **而少了它 SC-001 只兌現三分之一**——所以它不是 polish。

## 🔴 這份任務表的兩個閘門

| 閘門 | 在哪 | 沒過的話 |
|---|---|---|
| 護欄第一次**必須紅** | T007 | 停下來查判準，**不要接上** |
| e2e 的**入口條件** | T020 | 那個 0 是空過的，什麼都沒證明 |

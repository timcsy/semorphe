# Tasks: 診斷訊息由「一個字串」改為「規則 ＋ 參數」

**Feature**: `specs/118-diag-rule-params` | **Date**: 2026-08-14

**Input**: [spec.md](spec.md) · [plan.md](plan.md) · [research.md](research.md) ·
[data-model.md](data-model.md) · [contracts/diagnostic.md](contracts/diagnostic.md) ·
[quickstart.md](quickstart.md)

⚠️ **TDD 非妥協**（constitution II）：Phase 2 的兩支測試**必須先看到紅**，
而且要**親眼確認紅的原因是對的**——一支因為入口條件沒成立而紅的測試，
與一支因為功能沒做而紅的測試，訊息長得不一樣。

---

## Phase 1：基線（沒有這一步，後面每個「綠了」都不可信）

- [X] T001 記錄基線：執行 `npm test`、`npx tsc --noEmit`、`npm run test:e2e`，
      把三個數字寫進本檔末尾的「基線紀錄」區塊
- [X] T002 [P] 確認 41 條護欄的當前基線：執行
      `npx vitest run tests/integration/audit-*.test.ts`，記下有非零數字的那幾條

> ⚠️ T001 不是形式——`experience`「改動前後症狀相同」那條的前提是
> **你確定哪一刻是「前」**。

---

## Phase 2：先紅（TDD，阻擋後續所有 Phase）

- [X] T003 在 `e2e/diagnostics.spec.ts` 補一支斷言：同一則診斷在積木面板與程式碼面板的
      文字**不相等**。⚠️ 入口條件錨在「兩個面板各有 ≥1 則診斷」（合成量），
      **不可錨在「不同」**
- [X] T004 執行 `npm run test:e2e`，確認 T003 **紅**，
      且紅的原因是「兩個字串相等」而**不是**「找不到診斷」
- [X] T005 [P] 新建 `tests/integration/audit-diagnostic-labels.test.ts`（第四十二條護欄，硬性零）：
      入口條件「掃到的規則身分數 > 0」；硬性零「規則身分 × 面板 × 語言 的缺漏數 = 0」；
      正向注入（少一份 → 報出來**並指名**哪條規則／哪個面板／哪種語言）；
      反向注入（完整 → 不得亂報）
- [X] T006 執行 `npx vitest run tests/integration/audit-diagnostic-labels.test.ts`，
      確認 **紅**，且入口條件那支是**綠**的
- [X] T007 git commit：`test(118): 兩條先紅的防線——面板訊息必須不同、文案必須完備`

**Checkpoint**：兩支測試都紅，且紅的理由已經人工確認過。

---

## Phase 3：US1 ＋ US2 —— 資料形狀（P1，兩個故事共用同一次型別改動）

> ⚠️ US1（積木側不退步）與 US2（程式碼側不同）**無法拆成兩次交付**：
> 它們共用 `Diagnostic` 這一次形狀改動，拆開會讓中間狀態無法編譯。
> **這是刻意的合併，理由記在這裡而不是留給實作者猜。**

- [X] T008 [US1][US2] 改 `src/core/diagnostics.ts`：`Diagnostic` **刪除 `message`**，
      新增 `rule: string` 與 `params: Record<string, string | number>`；
      `DiagnosticRule.message` 改名為 `rule`
- [X] T009 [US1][US2] 改 `src/core/diagnostics.ts` 的 `runDiagnostics`：
      三處 `push` 帶上參數——`hasInput` 帶 `{ inputName }`；
      `varDeclareNames` 帶 `{ position: i + 1 }`（含 `NAME` 單數那一路）。
      ⚠️ **實作時改名了**：計畫寫的是 `index`（0-based），而兩個面板都是給人看的
      ——一個叫 `index` 的參數會讓文案作者寫出「第 0 個變數」。
      ⚠️ **`switch` 的判定邏輯一行不改**（contracts §四）
- [X] T010 [US1][US2] 改 `src/core/view-host.ts` 的 `DiagnosticsEvent` 內嵌型別
- [X] T011 [US1][US2] 改 `src/languages/cpp/diagnostics.ts`：4 條規則的欄位改名；
      🔴 **把 `DIAG_MISSING_VALUE` 拆成兩個身分**——`cpp_print` → `MISSING_VALUE`、
      `cpp_var_declare` → `MISSING_VAR_NAME`（data-model §實體二）
- [X] T012 執行 `npx tsc --noEmit`——⚠️ **預期整片紅**，那是設計。
      把紅的清單抄進本檔末尾，確認每一處都在計畫的異動範圍內
      （有範圍外的 → 停下來，不要順手改）
- [X] T013 改 `tests/unit/core/diagnostics.test.ts`：斷言改成看 `rule` 與 `params`；
      🔴 **新增一支**：`int , , ;` 產出三則，而三則的 `params.position` 互不相同
- [X] T014 git commit：`refactor(118): Diagnostic 帶規則身分與參數，不再帶組好的訊息`

**Checkpoint**：核心綠，面板仍紅（預期）。

---

## Phase 4：US1 ＋ US2 —— 兩個面板各自組裝（P1）

- [X] T015 [P][US1] `src/i18n/zh-TW/blocks.json`：4 key → 6 份
      （3 個規則身分 × 2 個面板），措辭依 data-model §實體三 的方向
- [X] T016 [P][US2] `src/i18n/en/blocks.json`：同上 6 份
- [X] T017 [US1] 改 `src/ui/panels/blockly-panel.ts` 的 `onDiagnostics`：
      用 `DIAG_<RULE>_BLOCK` 組裝；🔴 **同一顆積木的多則要合併成一段文字**
      （今天 `setWarningText` 後蓋前，三個空變數只顯示一個）；
      **移除 `|| d.message` 的靜默降級**
- [X] T018 [US2] 改 `src/ui/panels/monaco-panel.ts` 的 `onDiagnostics`：
      用 `DIAG_<RULE>_CODE` 組裝；**移除 `?? key` 的靜默降級**
- [X] T019 [US2] 🔴 更正 `src/ui/panels/monaco-panel.ts:222` 的過期註解（FR-007）——
      它今天宣稱訊息該是「學生程度 × 面板」，而「學生程度」已被否決
      （`knowledge/experience.md` 第 99 條）。**第二條軸只有面板**
- [X] T020 [P] 新建 `tests/unit/ui/diagnostic-message.test.ts`：
      對 3 個規則身分逐一斷言**兩個面板組出的字串不相等**（3 條全數，不抽驗）
- [X] T021 執行 `npx tsc --noEmit` ＋ `npm test`——T005 的護欄應轉綠
- [X] T022 執行 `npm run test:e2e`——T003 的斷言應轉綠
- [X] T023 git commit：`feat(118): 積木側與程式碼側各自組裝診斷訊息`

**Checkpoint**：US1 與 US2 都可獨立驗證（步驟六的瀏覽器實測）。

---

## Phase 5：US3 —— 沒有人能靜默地漏掉一種說法（P2）

> T005 已經建好護欄本體。本 Phase 是**證明它會紅**，而不是再建一次。

- [X] T024 [US3] 反向驗證①：暫時拿掉任一份文案 → 護欄必須**紅**，
      且訊息**指名**是哪一條規則／哪個面板／哪種語言。確認後改回
- [X] T025 [US3] 反向驗證②：暫時把兩個面板的組裝改成同一個 →
      T003 的 e2e 與 T020 的單元測試必須**紅**。確認後改回
- [X] T026 git commit：`test(118): 反向驗證兩條防線都真的會紅`

⚠️ **T024／T025 必須真的執行一次**，不可推理。
`experience.md:1155`：一支斷言「檔案裡有這個字串」的測試，全綠不代表行為是對的。

---

## Phase 6：Polish ＆ 跨切關注

- [X] T027 瀏覽器實測（`knowledge/skills/diagnose-in-browser`），三個情境：
      ① `if` 條件空著——兩側訊息不同
      ② 🔴 `int , , ;`——**三個問題都被提到**（今天只顯示一個）
      ③ 切成英文——兩側都變英文，而且仍然不同
- [X] T028 執行 `npx vitest run tests/integration/audit-*.test.ts`：
      🔴 **41 條護欄的基線數字一個都不該動**。有動 → **停下來查**，不要順手改基線
- [X] T029 全套：`npx tsc --noEmit` ＋ `npm test` ＋ `npm run test:e2e`，
      對照 T001 的基線，確認**一支都沒少**
- [X] T030 更新 `knowledge/vision.md` 階段 6.6 驗收④ 標記為完成，
      並記下 research §二 發現的既有缺陷（`int , , ;` 三則不可區分）已一併修掉
- [X] T031 git commit：`docs(118): 階段 6.6 驗收④ 完成`

---

## Dependencies

```
Phase 1 (基線)
   ↓
Phase 2 (先紅) ────────── 阻擋所有後續
   ↓
Phase 3 (資料形狀) ─────── T008→T009→T010→T011 嚴格循序（同一檔／型別連鎖）
   ↓
Phase 4 (面板組裝) ─────── T015/T016 可並行；T017/T018 不同檔可並行
   ↓
Phase 5 (反向驗證) ─────── 需要 Phase 4 綠了才驗得出「會紅」
   ↓
Phase 6 (Polish)
```

**User Story 獨立性**

| Story | 能不能單獨交付 |
|---|---|
| US1（積木側不退步） | 🔴 **不能與 US2 分開**——共用 Phase 3 的型別改動，拆開的中間狀態無法編譯 |
| US2（程式碼側不同） | 同上 |
| US3（文案完備性） | ✅ **可以**——護欄本體（T005）不依賴 Phase 3／4 完成 |

**MVP 範圍**：Phase 1–4（US1 ＋ US2）。US3 是防止未來破掉的機制，不是使用者可見的功能。

---

## Parallel Opportunities

```
T002              與 T001 並行
T005              與 T003 並行（不同檔、不同測試層）
T015 ‖ T016       兩個語言檔互不相干
T017 ‖ T018       兩個面板檔互不相干（⚠️ 但都依賴 Phase 3 完成）
T020              與 T017/T018 並行撰寫，執行要等它們完成
```

---

## 基線紀錄（T001／T002 填寫）

```
npm test          4108 passed + 1 flaky（4109 支）
npx tsc --noEmit  GREEN
護欄              41 檔 / 462 支全綠
```

⚠️ **基線不是全綠的，而那不是迴歸**：`tests/probes/scenario-coverage.test.ts`
的「競賽」在全套平行跑時**逾時**（單獨跑 204s 綠、全套 493s 紅）。
它要呼叫參照編譯器 27 次。**與本功能無關，記在這裡否則之後對不出「前」是哪一刻。**

## tsc 紅名單（T012 填寫）

```
blockly-panel.ts(488,26)  Property 'message' does not exist
blockly-panel.ts(488,40)  同上
monaco-panel.ts(231,19)   同上
```

✅ **3 處，全在計畫的異動範圍內，無範圍外命中。**

---

## 格式驗證

- [X] 每一項都有 `- [ ]`、`Txxx`、以及檔案路徑或可執行指令
- [X] User Story 階段的任務帶 `[US1]`／`[US2]`／`[US3]` 標籤
- [X] Setup／Foundational／Polish 階段**不帶** Story 標籤
- [X] `[P]` 只標在不同檔且無未完成相依的任務上

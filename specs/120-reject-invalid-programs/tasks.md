# Tasks: 寫錯的程式不該跑得起來——先量再擋

**Feature**: `specs/120-reject-invalid-programs` | **Date**: 2026-08-14

**Input**: [spec.md](spec.md) · [plan.md](plan.md) · [research.md](research.md) ·
[data-model.md](data-model.md) · [contracts/execution-gate.md](contracts/execution-gate.md) ·
[quickstart.md](quickstart.md)

🔴 **本檔最重要的一句寫在最前面**：

> **T012 是檢查點，不是任務。** 那 27 段量出來的「程式不合法」數字若是 **0**，
> **停下來**——US2 仍該做（使用者直接點名），而必須在 spec 記下
> 「這個病比想像小」。那句話會改變後面所有的優先序。

⚠️ **US4（型別檢查）已移出本 spec**（research 決策 2）——不要做，
它需要三件事而其中一件是既有架構債。

---

## Phase 1：基線

- [X] T001 記錄基線：`npx tsc --noEmit`、`npm test`、`npm run test:e2e`
      ⚠️ 已知 flaky：`scenario-coverage` 的「競賽」在全套平行跑時逾時——**先記下**
- [X] T002 [P] `npx vitest run tests/integration/audit-*.test.ts`（43 條）
- [X] T003 [P] 🔴 記下 `tests/baselines/*.json` 全部的 md5
      ——本功能**只有 `behavior-error.json` 允許變**，其餘 42 條一個字元都不准動

---

## Phase 2：US1 先紅——判準要先在已知答案的樣本上驗過

> ⚠️ `build-guardrail` 第 6 步：「靜態判斷不能下結論，只能排順序……
> 要用靜態判斷，**先在已知答案的樣本上驗過**」。

- [X] T004 [US1] 在 `tests/integration/audit-behavior-error.test.ts` 加分類判準的測試：
      ★ 合成樣本 A（缺標頭的訊息）→ 必須分成**工具跑不動**；
      ★ 合成樣本 B（編譯器明確拒絕的訊息）→ 必須分成**程式不合法**；
      ★ 對不上任一判準的訊息 → 必須分成**無法確定**，🔴 **不得樂觀歸類**
- [X] T005 執行 T004 → **必須紅**（分類函式不存在），確認理由對
- [X] T006 git commit：`test(120): 分類判準先在合成樣本上驗過`

---

## Phase 3：US1 —— 把那 27 段分類（P1）

- [X] T007 [US1] 實作分類函式：吃 `runCppDetailed` 的 `{ ok, stage, message }`，
      回傳三類之一。⚠️ **純函式**，吃字串不吃檔案——注入才餵得進來
- [X] T008 [US1] `onlyInterpreterRuns` 從一個數字變成
      `{ count, byClass, details }`——⚠️ 形狀**照抄反方向的 `gaps`**
      （`audit-behavior-error.test.ts:119`），不要自己發明
- [X] T009 執行 T004 → 應**轉綠**
- [X] T010 `GENERATE_BASELINE=1` 產基線，並在 `_meta.note` 寫明
      **為什麼這個欄位變了**（第 7 步：理由留在數字旁邊）
- [X] T011 [US1] 把分類結果貼進本檔末尾的「27 段的分類」區塊
- [X] T012 🔴 **檢查點——不是任務**：
      ```
      programIsIllegal > 0  →  US2 的前提成立，照計畫走
      programIsIllegal = 0  →  ⚠️ 停下來。在 spec 記下「這個病比想像小」，
                               而 US2 仍該做（使用者直接點名）
      ```
      **無論哪一種，都要把結論寫進 spec 再繼續。**
- [X] T013 git commit：`feat(120): 那 27 段從一個數字變成三類明細`

---

## Phase 4：US2 ＋ US3 先紅（P1，兩個故事共用同一個閘門）

> ⚠️ US2（擋住）與 US3（不要擋到編輯）**無法分開交付**——
> 它們是同一個閘門的兩面：一個要求它作用，一個要求它**只在那一刻**作用。

- [X] T014 [P][US2] 新建 `tests/unit/core/execution-gate.test.ts`：
      ★ 正向錨點（乾淨的樹 → 可以跑，先證明量得到「可以」）；
      ★ 有 `syntax_error` 的樹 → 不可以跑，且**回得出是哪些節點**；
      🔴 ★ 有 `unsupported`／`nonstandard_but_valid` 的樹 → **可以跑**
- [X] T015 執行 T014 → **必須紅**（函式不存在）
- [X] T016 [P][US2] `e2e/diagnostics.spec.ts` 加：少分號的程式**按執行 → 沒有輸出**。
      ⚠️ 入口條件錨在「這段程式在乾淨版本下按執行**有**輸出」（合成量）
- [X] T017 執行 T016 → **必須紅**（今天會執行），確認理由是「有輸出」不是「找不到按鈕」
- [X] T018 [US3] 🔴 `e2e` 加：同一段程式**只編輯不按執行 → 沒有任何拒絕出現**。
      ⚠️ **今天是綠的**（今天什麼都不擋）——`build-guardrail` 6.5 的警訊，
      靠 T027 的注入證明會紅
- [X] T019 git commit：`test(120): 閘門的三條防線——擋、不誤擋、不早擋`

---

## Phase 5：US2 ＋ US3 實作（P1）

- [X] T020 [US2] `src/core/diagnostics.ts` 匯出 `canExecute(tree)`：
      🔴 **沿用 `DIAGNOSTIC_CAUSES`，不另立清單**——「哪些降級原因是使用者的錯」
      只能有一處定義，兩處的話顯示與執行遲早說不同的話
- [X] T021 [US2] `src/ui/refusal-message.ts` 加執行拒絕的訊息：
      **為什麼** ＋ **你的程式還在**（形狀已存在，抄它）
- [X] T022 [US2][US3] `src/ui/execution-controller.ts`：**兩個** `execute` 呼叫點
      （`:340`／`:679`）之前加閘門。
      🔴 **不放進 `interpreter`**——既有測試直接呼叫 `execute(tree)`，
      放那一層會擋掉一大片與本功能無關的測試（contracts 契約二）
- [X] T023 [P] `tests/unit/ui/refusal-message.test.ts` 加執行拒絕那一則的斷言：
      訊息**必須同時**含「為什麼」與「還在」兩件事
- [X] T024 `npx tsc --noEmit` ＋ `npm test` ＋ 重 build ＋ `npm run test:e2e`
      ——T014／T016 應轉綠，T018 應維持綠
- [X] T025 git commit：`feat(120): 語法錯誤在按執行時被攔住，而編輯不受影響`

---

## Phase 6：反向驗證（🔴 真的跑，不可推理）

- [X] T026 注入①：把閘門移進 `interpreter` → **一大片既有測試紅**
      （證明契約二的理由不是猜的）。確認後改回
- [X] T027 [US3] 🔴 注入②：把閘門掛到編輯的事件上 → **T018 必須紅**。改回
- [X] T028 注入③：讓閘門也擋 `unsupported` → **T014 的第三條必須紅**
      （我們的問題被當成使用者的錯）。改回
- [X] T029 git commit：`test(120): 三個注入都真的跑過`

⚠️ T027 是**唯一防止工具變得不能用**的那一支。**不可省，不可用推理代替。**

---

## Phase 7：Polish

- [X] T030 🔴 **重 build 之後**瀏覽器實測（`experience`：e2e 跑的是產物）：
      ① 少分號 → 按執行 → **不跑**，訊息說得出為什麼＋程式還在
      ② 少分號 → 只打字 → **什麼都不擋**
      ③ 正常程式 → 按執行 → 正常跑
      ④ 積木側 → 按執行 → **不受影響**
- [X] T031 `npx vitest run tests/integration/audit-*.test.ts`
      ——43 條全綠
- [X] T032 🔴 `git diff --stat tests/baselines/`
      ——**只有 `behavior-error.json` 可以出現**。其他任何一個出現 → **停下來查**
- [X] T033 更新 `knowledge/vision.md`：階段 6.7 的第一項有進展；
      ⚠️ 而 **US4 移出的理由要寫進 `draft/2026-08-05-語義診斷系統.md` §七**
      （它的三個前置：元件宣告接收者型別／變數型別表／接收者從字串變引用）
- [X] T034 git commit：`docs(120): 先量再擋做完，而型別那一半的前置寫清楚了`

---

## Dependencies

```
Phase 1 → Phase 2 → Phase 3 →【T012 檢查點】→ Phase 4 → Phase 5 → Phase 6 → Phase 7
                                    ↑
                          🔴 這裡可能改變後面的計畫
```

**User Story 獨立性**

| Story | 能不能單獨交付 |
|---|---|
| US1（先量） | ✅ **可以，而且必須先做**——它有權力改變 US2 |
| US2（擋住） | 🔴 **不能與 US3 分開**——同一個閘門的兩面 |
| US3（不要擋到編輯） | 同上 |
| ~~US4~~ | ⚠️ **已移出本 spec** |

**MVP**：Phase 1–5。而 Phase 6 的 T027 **不是可選的**。

---

## Parallel Opportunities

```
T002 ‖ T003
T014 ‖ T016 ‖ T018     三支測試不同層，可同批寫（分別確認紅的理由）
T023                    與 T020–T022 並行寫，執行要等它們完成
```

---

## 基線紀錄（T001–T003）

```
npx tsc --noEmit     ______
npm test             ______（預期起點 4138）
npm run test:e2e     ______（預期起點 10）
護欄                  ______（預期 43 檔全綠）
baselines md5        ______
```

## 27 段的分類（T011 填寫）

```
工具跑不動      0
程式不合法     25   ← 🔴 而拆開看：22 筆是【語料片段缺標頭】，不是使用者寫錯
無法確定        2

⚠️ 結論見 spec.md 的「T012 檢查點的結論」——那 27 段【量不出這個病】，
而直接量使用者說的那件事得到：四種寫錯，三種順利跑完，一種給出誤導性的錯誤。
```

---

## 格式驗證

- [X] 每一項都有 `- [ ]`、`Txxx`、以及檔案路徑或可執行指令
- [X] User Story 階段帶 `[US1]`／`[US2]`／`[US3]`
- [X] Setup／Polish 不帶 Story 標籤
- [X] `[P]` 只標在不同檔且無未完成相依的任務上

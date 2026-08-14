# Tasks: 語法錯誤走診斷通道 ＋ 診斷帶來源

**Feature**: `specs/119-syntax-error-diagnostic` | **Date**: 2026-08-14

**Input**: [spec.md](spec.md) · [plan.md](plan.md) · [research.md](research.md) ·
[data-model.md](data-model.md) · [contracts/diagnostic-source.md](contracts/diagnostic-source.md) ·
[quickstart.md](quickstart.md)

⚠️ **TDD 非妥協**（constitution II）：Phase 2 的三支測試必須**先看到紅**，
而且要**人工確認紅的理由是對的**。

🔴 **本功能最大的風險寫在最前面**：三種降級原因今天共用同一個 `if (cause)`。
**一起搬走的話，學生會看到「你的程式有 12 個錯誤」而其中 11 個是我們的問題。**
US3 的每一支測試都是為這件事寫的——**不可以省**。

---

## Phase 1：基線

- [X] T001 記錄基線：`npx tsc --noEmit`、`npm test`、`npm run test:e2e`，
      三個數字寫進本檔末尾。⚠️ 已知 flaky：`scenario-coverage` 的「競賽」
      在全套平行跑時會逾時（單獨跑綠）——**與本功能無關，先記下**
- [X] T002 [P] `npx vitest run tests/integration/audit-*.test.ts`（42 條）記下基線
- [X] T003 [P] 🔴 記下 `tests/baselines/projection-residual.json` 的 md5
      ——SC-006 要求它**一個字元都不變**

---

## Phase 2：先紅（阻擋後續所有 Phase）

- [X] T004 [US1] 新建 `tests/unit/core/diagnostics-from-tree.test.ts`：
      ★ 正向錨點（沒有 syntax_error 的樹 → 0 則，先證明量得到「乾淨」）；
      ★ 有 syntax_error 的樹 → 1 則，`severity: 'error'`、`source: 'parser'`、
      `rule: 'SYNTAX_ERROR'`、`params.snippet` 有壞掉的原文；
      🔴 ★ **同一棵樹上的 `unsupported` 節點【不得】被產出**
- [X] T005 執行 T004 → **必須紅**，且理由是「函式不存在」而非別的
- [X] T006 [P][US1] `e2e/diagnostics.spec.ts` 補：少分號的程式 →
      程式碼面板出現 **Error 級**波浪。⚠️ 入口條件錨在「有標記」（合成量），
      **不錨在 severity**——severity 正是這支要推動的東西
- [X] T007 執行 T006 → **必須紅**，且理由是「severity 不對」
      而**不是**「找不到標記」
- [X] T008 [P][US3] 🔴 `e2e/diagnostics.spec.ts` 補：含**不支援寫法**的程式 →
      仍是 **Info 級**、仍在 `semorphe-residual` 那一組。
      ⚠️ **這支今天是綠的**（`build-guardrail` 6.5 的警訊），
      所以它要靠**注入**證明會紅——見 T024
- [X] T009 git commit：`test(119): 三條先紅的防線——語法錯誤要是錯誤、而另外兩種不准跟著搬`

**Checkpoint**：T004／T006 紅、T008 綠（待注入證明），紅的理由都人工確認過。

---

## Phase 3：US1 ＋ US2 —— 資料形狀（P1，兩個故事共用同一次型別改動）

> ⚠️ US1（語法錯誤是錯誤）與 US2（診斷帶來源）**無法拆成兩次交付**
> ——搬進診斷的東西當下就要說得出來源，拆開的中間狀態無法編譯。
> **這是刻意的合併，理由記在這裡而不是留給實作者猜。**

- [X] T010 [US1][US2] `src/core/diagnostics.ts`：`Diagnostic` 加
      **必要**欄位 `source: 'component' | 'parser'`
      （🔴 **不是選用**——選用等於允許「不說是誰的問題」）
- [X] T011 [US1][US2] `src/core/diagnostics.ts`：`runDiagnostics` 的三處 push
      統一帶 `source: 'component'`。⚠️ **`DiagnosticRule` 一行不改**
      ——一個對所有成員都相同的欄位，不該長在成員上
- [X] T012 [US1] 🆕 `src/core/diagnostics.ts` 匯出 `diagnosticsFromTree(tree)`：
      走一遍樹，**只挑** `degradationCause === 'syntax_error'`，
      產出 `{ nodeId, severity:'error', rule:'SYNTAX_ERROR',
      params:{ snippet }, source:'parser' }`。
      🔴 **純函式**——不讀寫外部狀態、不產訊息字串
- [X] T013 [US1][US2] `src/core/view-host.ts` 的 `DiagnosticsEvent` 內嵌型別跟著改
- [X] T014 執行 `npx tsc --noEmit`——⚠️ **預期紅**，把清單抄進本檔末尾，
      確認每一處都在範圍內（有範圍外的 → **停下來**）
- [X] T015 執行 T004 → 應**轉綠**
- [X] T016 git commit：`refactor(119): 診斷帶來源，而樹是第二個產出端`

---

## Phase 4：US1 —— 接上會合點（P1）

- [X] T017 [US1] `src/ui/app.ts`：訂閱 `semantic:update` 快取 tree；
      `runBlockDiagnostics` 改成合併兩個來源
      **一次廣播** `[...規則產出, ...樹產出]`。
      🔴 **不可分兩次**——`setModelMarkers`／`setWarningText(null)` 都是全集取代
- [X] T018 [US3] 🔴 `src/ui/panels/monaco-panel.ts` 的 `renderResidual`
      **濾掉 `syntax_error`**——不濾就會顯示兩次（一紅一灰疊同一行）。
      ⚠️ `unsupported` 與 `nonstandard_but_valid` **一行不動**
- [X] T019 [P][US1] `src/i18n/zh-TW/blocks.json`：加 `SYNTAX_ERROR` 的兩份
      （12 → 14）。措辭依 data-model：積木側用 `{snippet}`、程式碼側不用
- [X] T020 [P][US1] `src/i18n/en/blocks.json`：同上（14 → 16）
- [X] T021 [US1] 🔴 `tests/integration/audit-diagnostic-labels.test.ts`：
      **身分來源要擴**——今天只從 `cppDiagnosticRules` 列舉，
      而 `SYNTAX_ERROR` **不在那張表裡**（它不是一條規則）。
      不擴的話第二個產出端的文案缺漏它看不到
- [X] T022 [P][US1] `tests/unit/ui/diagnostic-message.test.ts`：
      `SYNTAX_ERROR` 的兩個面板文案**必須不同**（沿用既有的全數斷言）
- [X] T023 執行 `npx tsc --noEmit` ＋ `npm test` ＋ `npm run test:e2e`
      ——T006 應轉綠，T008 應維持綠
- [X] T024 git commit：`feat(119): 語法錯誤走診斷通道，而另外兩種留在殘差`

---

## Phase 5：US3 —— 反向驗證（P1，🔴 不可推理，必須真的跑）

- [X] T025 [US3] 注入①：拿掉 `renderResidual` 的濾網 →
      **同一件事顯示兩次**，T008 或新斷言必須紅。確認後改回
- [X] T026 [US3] 🔴 注入②：把 `unsupported` 也送進診斷 →
      **T008 必須紅**（我們的問題變成學生的錯誤）。確認後改回
- [X] T027 [US1] 注入③：拿掉 `SYNTAX_ERROR` 的任一份文案 →
      第四十二條護欄必須紅**並指名**。確認後改回
- [X] T028 [US1] 注入④：把兩個面板的 `SYNTAX_ERROR` 文案寫成同一句 →
      T022 必須紅。確認後改回
- [X] T029 git commit：`test(119): 四個注入都真的跑過，四條防線都會紅`

⚠️ T026 是**本功能唯一防止傷到使用者**的那一支。**不可以省，不可以用推理代替。**

---

## Phase 6：Polish

- [X] T030 🔴 **重 build 之後**做瀏覽器實測（`experience`：e2e 跑的是產物，
      還原原始碼不等於還原產物）：
      ① `int x = 1` → 程式碼面板**紅波浪**、積木紅框 ＋「這塊是照抄的：…」
      ② 含不支援寫法 → **仍是灰色 Info**，主詞仍是「我還不認得」
      ③ 兩者同時出現 → **一紅一灰同時可見**
- [X] T031 `npx vitest run tests/integration/audit-*.test.ts`
      ——42 條基線**一個都不該動**。有動 → **停下來查**
- [X] T032 🔴 `git diff --stat tests/baselines/projection-residual.json`
      ——**必須是空的**（SC-006）。非空 → 改動超出範圍
- [X] T033 全套對照 T001 的基線，確認**一支都沒少**
- [X] T034 更新 `knowledge/vision.md` 階段 6.6 驗收 4.5 標記完成；
      ⚠️ 而 `history/062` 的「處置（未做）」那一節要改成已做，
      **並記下 research §一 的發現**（兩條路今天不可能會合，會合點是新開的）
- [X] T035 git commit：`docs(119): 階段 6.6 驗收 4.5 完成`

---

## Dependencies

```
Phase 1 (基線)
   ↓
Phase 2 (先紅) ────────── 阻擋所有後續
   ↓
Phase 3 (資料形狀) ─────── T010→T011→T012→T013 循序（同一檔／型別連鎖）
   ↓
Phase 4 (會合點) ───────── T017 先；T018–T022 可並行
   ↓
Phase 5 (反向驗證) ─────── 需要 Phase 4 綠了才驗得出「會紅」
   ↓
Phase 6 (Polish)
```

**User Story 獨立性**

| Story | 能不能單獨交付 |
|---|---|
| US1（語法錯誤是錯誤） | 🔴 **不能與 US2 分開**——共用 Phase 3 的型別改動 |
| US2（診斷帶來源） | 同上 |
| US3（另外兩種不准跟著搬） | ✅ **可以**——T008 的防線不依賴 Phase 3／4 完成 |

**MVP 範圍**：Phase 1–4。⚠️ **而 US3 不是可選的** ——
它是唯一防止本功能傷到使用者的那一格。

---

## Parallel Opportunities

```
T002 ‖ T003          與 T001 並行
T006 ‖ T008          同一個 e2e 檔，但斷言互不相干（可同批寫，分別確認）
T019 ‖ T020          兩個語言檔
T021 ‖ T022          不同測試檔
```

---

## 基線紀錄（T001–T003 填寫）

```
npx tsc --noEmit                        GREEN
npm test                                4123 passed（全綠）
npm run test:e2e                        9 支
護欄                                     42 檔 / 462 支 全綠
projection-residual.json md5             b1383fa5e7abe59fbe88fec968baa8b1
```

## tsc 紅名單（T014 填寫）

```
（空）
```

🔴 **而「空」本身是一個發現**：`DiagnosticsEvent` 的內嵌型別是**另一份宣告**，
結構上寬鬆地接受了多出來的欄位——加 `source` 時 tsc **一聲不吭**。
少了 T013 的話視圖讀不到來源，而編譯器不會說。

⚠️ 同族的還有 `tests/` 不在 `tsconfig` 的 `include` 裡：
`diagnostics.test.ts` 的 `toEqual` 漏了 `source`，是**跑測試**才抓到的。

## 交付後的實測結果（T030，瀏覽器）

```
err 2 ／ info 0 ／ warn 0       錯誤級波浪出來了，而且沒有重複顯示
積木  「這一段程式我看不懂，積木上這塊是照抄原文的：1」
程式碼「這一行的語法不完整」      兩個面板措辭不同 ✅
```

🔴 **而「：1」是一個範圍外的缺口**（`rawCode` 取的是 ERROR 節點的文字，
不是那一行），連同「少分號只有某些形狀會被標記」一起記在
`knowledge/history/063-通道接好了而辨識那一層只認得某些形狀.md`。

⚠️ **在那兩個缺口修掉之前，不得宣稱「少分號已經處理好了」。**

---

## 格式驗證

- [X] 每一項都有 `- [ ]`、`Txxx`、以及檔案路徑或可執行指令
- [X] User Story 階段的任務帶 `[US1]`／`[US2]`／`[US3]`
- [X] Setup／Polish 階段不帶 Story 標籤
- [X] `[P]` 只標在不同檔且無未完成相依的任務上

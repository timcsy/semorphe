# Tasks: 宣告了的接點在積木上表達不出來

**Feature**: `specs/122-declared-slots-unreachable` | **Date**: 2026-08-14

**Input**: [spec.md](spec.md) · [plan.md](plan.md) · [research.md](research.md) ·
[data-model.md](data-model.md) · [contracts/slot-roundtrip.md](contracts/slot-roundtrip.md) ·
[quickstart.md](quickstart.md)

🔴 **寫在最前面**：

> **一顆一個 commit。** 三種子機制的修法完全不同——混在一起的話，
> 一顆出問題其餘無法二分。

> ⚠️ **本輪可能清不完 12 筆，而那是可以的。**
> 不可以的是**靜靜留著**——FR-004：剩下的每一筆要寫下
> **為什麼沒清**與**清掉需要什麼**。
> 🔴 **一筆靜靜留在那裡的違規，與一筆被遺忘的違規長得一模一樣。**

---

## Phase 1：基線

- [X] T001 `npx tsc --noEmit`、`npm test`（4157）、`npm run test:e2e`（15）
- [X] T002 [P] `npx vitest run tests/integration/audit-conformance.test.ts`
      ——記下 `certainViolations`（12）與 12 筆的清單
- [X] T003 [P] 🔴 記下所有 `tests/baselines/*.json` 的 md5
      ——**只有 `conformance.json`（＋快照，若積木變寬）允許變**

---

## Phase 2：US1 —— 字串的初始值（🟡 子機制①，最便宜）

> `forms/blocks.json` 的 `args0` 非空且 `block-registrar` 裡沒有它
> → **JSON 就是唯一真相**。

- [X] T004 [US1] 新建來回測試：一段有初始值的字串宣告，
      走完 render → extract 之後**初始值還在**；
      ★ 正向錨點：**沒有初始值時，來回之後仍然是空的**
- [X] T005 執行 → **必須紅**，確認理由是「初始值不見了」
- [X] T006 [US1] `forms/blocks.json`：加 `input_value` ＋ `renderMapping.inputs`
- [X] T007 [P][US1] `labels/{zh-TW,en}.json`：新插槽的標籤。
      ⚠️ 沿用積木標籤風格規範（描述式動詞、不用語法符號）
- [X] T008 執行 T004 → 應轉綠；
      `npx vitest run tests/integration/audit-conformance.test.ts` → **12 → 11**
- [X] T009 git commit：`feat(122): 字串宣告的初始值走得完來回`
      ⚠️ 訊息要說得出這是**實作了**不是重新分類

---

## Phase 3：US3 —— 容器的大小（🔴 子機制③，雙重真相）

> `args0` 空而 `renderMapping` 引用欄位名 → 積木在 `block-registrar.ts:558`
> 命令式產生。**兩邊都要改。**

- [ ] T010 [US3] 來回測試：指定了大小的容器宣告，來回之後大小還在；
      🔴 **並斷言執行結果相同**（SC-005——前兩個是「字不見了」，
      這一個是「程式跑起來不一樣」）
- [ ] T011 執行 → 必須紅
- [ ] T012 [US3] 改 `block-registrar.ts` 的命令式定義（加插槽）
- [ ] T013 [US3] 🔴 **同步** `forms/blocks.json` 的 `renderMapping`
      ——`CLAUDE.md`：「修改任一方時必須同步另一方」
- [ ] T014 執行 `audit-dual-truth` ＋ `audit-conformance` → 前者綠、後者再降
- [ ] T015 git commit：`feat(122): 容器宣告的大小走得完來回`

---

## Phase 4：US2 —— 多個變數（🔴 最貴：兩個形態 ＋ 手寫 strategy）

- [ ] T016 [US2] 來回測試：`int a, b, c` 來回之後三個都在
- [ ] T017 執行 → 必須紅
- [ ] T018 [US2] 改 statement 形態（手寫 strategy `cpp:renderVarDeclare`）
- [ ] T019 [US2] ⚠️ **同步 expression 形態**——FR-003；
      🔴 而兩者的 `extraState` 格式**必須完全相同**（`CLAUDE.md` 的已知陷阱：
      `STATEMENT_TO_EXPRESSION` 直接搬移 extraState）
- [ ] T020 [US2] 驗形態切換：statement ↔ expression 來回之後資料不掉
- [ ] T021 git commit：`feat(122): 多變數宣告走得完來回`

---

## Phase 5：US4 —— 沒清完的要寫下為什麼（🔴 不可省）

- [X] T022 [US4] 逐筆分組**剩下的每一筆**：子機制①②③ 哪一種
- [X] T023 [US4] 🔴 寫進 `tests/baselines/conformance.json` 的 `_meta.note`：
      每一筆**為什麼沒清**、**清掉需要什麼**
- [X] T024 [US4] 而**每一筆下降**也要在同一處說得出
      是**實作了**還是**重新分類了**（FR-005）
- [X] T025 git commit：`docs(122): 沒清完的逐筆寫下理由`

---

## Phase 6：Polish

- [X] T026 🔴 **重 build 後瀏覽器實測**：
      `string s = "hi"` → 拖動積木 → 回看程式碼 → **初始值還在**
- [ ] T027 🔴 **舊存檔實測**：造一份改動前的存檔載入
      ——⚠️ 測試綠不代表使用者的作品打得開，**本專案在這裡翻過車**
- [X] T028 `npm test` ＋ 43 條量測 ＋ e2e
- [X] T029 🔴 `git diff --stat tests/baselines/`
      ——只有 `conformance.json`（＋快照）可以出現，**而每個變動都要有理由**
- [X] T030 更新 `knowledge/`：⚠️ 而**根因（宣告與形態沒有執行機構）
      要留成一個未決**——它是 Out of Scope 的那個獨立決定
- [X] T031 git commit：`docs(122): 清償進度與剩下的根因`

---

## Dependencies

```
Phase 1 → Phase 2 →【一顆一個 commit】→ Phase 3 → Phase 4 → Phase 5 → Phase 6
                     ↑ 每顆之間都是可停的點
```

**User Story 獨立性**

| Story | 獨立？ |
|---|---|
| US1 字串初始值 | ✅ 完全獨立（JSON 唯一真相） |
| US3 容器大小 | ✅ 獨立，而它要動雙重真相 |
| US2 多變數 | ✅ 獨立，而它最貴（兩形態 ＋ 手寫 strategy） |
| US4 寫下理由 | 🔴 **不可省**——它是「做到哪裡」的唯一紀錄 |

**MVP**：Phase 1–2（一顆）。⚠️ **而 Phase 5 無論做到哪裡都要做。**

---

## 基線紀錄（T001–T003）

```
npm test           4157
e2e                15
certainViolations  12 → 11
baselines          conformance／defect-ledger／declaration-change-parity 三個變動，各有理由
```

## 清償紀錄（逐顆填）

```
string_declare   12 → 11   ✅【實作了】——積木本來沒有插槽，初始值無處可去
vector_declare   未做      🔴 子機制③（block-registrar 命令式，雙重真相）
                           → 用 [BLOCKED:cpp:vector_declare] 的 it.fails 釘住
var_declare      未做      🔴 最貴（兩形態 ＋ 手寫 strategy ＋ extraState 契約）
                           ⚠️ 而本輪的來回測試顯示【它那個形狀是通的】
                              → 護欄量到的那筆可能是合成樣本的形狀問題，要再查
剩下             11 筆，逐筆理由已寫進 conformance.json 的 _meta.note
```

---

## 格式驗證

- [X] 每一項都有 `- [ ]`、`Txxx`、檔案路徑或可執行指令
- [X] User Story 階段帶 `[USn]`
- [X] Setup／Polish 不帶 Story 標籤
- [X] `[P]` 只標在不同檔且無未完成相依的任務上

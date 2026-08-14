# Tasks: 辨識層只認得一半的語法錯誤

**Feature**: `specs/121-recognise-all-syntax-errors` | **Date**: 2026-08-14

**Input**: [spec.md](spec.md) · [plan.md](plan.md) · [research.md](research.md) ·
[data-model.md](data-model.md) · [contracts/error-detection.md](contracts/error-detection.md) ·
[quickstart.md](quickstart.md)

🔴 **寫在最前面**：本功能**擴大**了「什麼算語法錯誤」，而
`history/017` 逐字「**加嚴一個檢查，可能讓事情比不檢查更糟**」。

> **第四十三條護欄（合法語料誤標數 = 0）要在【每一次】改動後跑。
> 它不是「別忘了跑測試」，它是這個功能被允許存在的條件。**

---

## Phase 1：基線

- [ ] T001 `npx tsc --noEmit`、`npm test`（預期 4153）、`npm run test:e2e`（12）
- [ ] T002 [P] `npx vitest run tests/integration/audit-*.test.ts`（43 條）
- [ ] T003 [P] 🔴 `npx vitest run tests/integration/audit-false-syntax-error.test.ts`
      ——**必須是 0**。這是本功能的起點與終點

---

## Phase 2：先紅（US1 ＋ US3 ＋ US4）

- [ ] T004 [US1] `tests/unit/core/lift-syntax-error.test.ts` 補三種形狀：
      A（下一行 `return`）、C（下一行是另一個宣告）**必須被標記**；
      B（下一行是輸出）**不得退步**
- [ ] T005 [US3] 同檔補落點斷言：標記的節點**不含** `cpp:program`；
      單一錯誤時**被標記的節點數為 1**
- [ ] T006 [US4] 同檔補原文斷言：B 的 `rawCode` 是完整的一行，不是片段
- [ ] T007 執行 → **A/C 的標記、落點數、B 的原文必須紅**；
      ⚠️ 而 B 的「有被標記」與「不含 program」**今天就是綠的**——確認理由對
- [ ] T008 git commit：`test(121): 三種形狀、落點、原文——三條先紅`

---

## Phase 3：US1 ＋ US3 ＋ US4 實作

- [ ] T009 [US1] `src/core/lift/types.ts`：`AstNode` 加 `hasError?: boolean`。
      ⚠️ **選用而非必要**，理由寫進註解：假樹描述的是**一棵沒有錯誤的樹**
      （而必要欄位在這裡沒有保護力——`tests/` 不在型別檢查範圍內）
- [ ] T010 [US1] `src/core/lift/lifter.ts` 的 `hasErrorDescendant`：
      同時認旗標。⚠️ **落點邏輯（`claimed`）一行不改**——research 決策 1
- [ ] T011 [US4] 同檔 `rawCode`：一律用節點原文。
      ⚠️ A/C 本來就會落到它，**本步是把 B 統一過去**，不是新規則
- [ ] T012 執行 T004–T006 → 應轉綠
- [ ] T013 🔴 **執行第四十三條** → **必須仍是 0**。
      非 0 → **停下來**，那代表旗標把合法程式也標了
- [ ] T014 git commit：`feat(121): 認得解析器標記錯誤的兩種方式`

---

## Phase 4：US2（使用者可見的那一半）

- [ ] T015 [US2] `e2e/diagnostics.spec.ts`：三種漏分號的形狀**按執行都不跑**。
      ⚠️ 入口條件錨在「乾淨版本按執行有輸出」（合成量）
- [ ] T016 重 build ＋ 執行 e2e → 應綠
      （⚠️ **重 build**：e2e 跑的是產物）
- [ ] T017 git commit：`test(121): 三種漏分號按執行都不跑`

---

## Phase 5：反向驗證（🔴 真的跑，不推理）

- [ ] T018 注入①：把 `claimed` 判斷拿掉 → **T005 必須紅**（標記飄到 program）
- [ ] T019 注入②：判定改回只認 ERROR 節點 → **T004 的 A/C 必須紅**
- [ ] T020 🔴 注入③：讓判定也吃 `unsupported` → **第四十三條必須紅**
- [ ] T021 git commit：`test(121): 三個注入都真的跑過`

⚠️ **先 commit 再注入**——上一輪 `git checkout` 掃掉了還沒 commit 的新函式。

---

## Phase 6：US5（逾時）

- [ ] T022 [US5] `tests/probes/scenario-coverage.test.ts`：上限 300000 → 900000，
      ⚠️ 而**理由寫在數字旁**：1.5 倍於最差實測（575 秒），
      而**上限是偵測卡死不是強制速度**
- [ ] T023 git commit：`test(121): 三情境探測的上限調到量得出來的需求之上`

> ⚠️ 與 Phase 3–5 **分開 commit**——兩件無關的事。

---

## Phase 7：Polish

- [ ] T024 🔴 重 build 後瀏覽器實測：三種漏分號按執行**都不跑**；
      積木訊息引用**完整的一行**；正常程式照跑
- [ ] T025 `npm test` ＋ 43 條護欄 ＋ e2e
- [ ] T026 🔴 `git diff --stat tests/baselines/` **必須是空的**
- [ ] T027 更新 `knowledge/`：`history/063` 的第一、二個缺口**關掉**；
      ⚠️ 而 `vision` 階段 6.7 與 `history/064` 那句
      「只能說被辨識出來的語法錯誤不能跑了」**要一起更新**
      ——那句話當時寫在四個地方
- [ ] T028 git commit：`docs(121): 兩個缺口關掉，而那句限定要一起拿掉`

---

## Dependencies

```
Phase 1 → Phase 2 → Phase 3 →【T013 第四十三條，非 0 就停】→ Phase 4 → 5 → 6 → 7
```

**User Story 獨立性**

| Story | 獨立？ |
|---|---|
| US1（三種都認得） | 🔴 與 US3 不可分——同一個判定的兩面（要抓到 ／ 不要抓錯） |
| US3（合法的不准冤枉） | 同上 |
| US2（按執行不跑） | ✅ 但它是 US1 的下游，US1 沒做它不會過 |
| US4（原文） | ✅ 獨立 |
| US5（逾時） | ✅ **完全獨立**，分開 commit |

**MVP**：Phase 1–4。而 Phase 5 的 T020 **不可省**。

---

## 基線紀錄（T001–T003）

```
npm test          ______（預期 4153）
e2e               ______（預期 12）
護欄              ______（預期 43 全綠）
第四十三條         ______（🔴 必須是 0）
```

---

## 格式驗證

- [X] 每一項都有 `- [ ]`、`Txxx`、檔案路徑或可執行指令
- [X] User Story 階段帶 `[USn]`
- [X] Setup／Polish 不帶 Story 標籤
- [X] `[P]` 只標在不同檔且無未完成相依的任務上

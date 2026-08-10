# Tasks：參照元件的讀數要能重新量

**Feature**: `specs/108-residual-error-baselines`
**Input**: [spec.md](spec.md)、[plan.md](plan.md)、[research.md](research.md)、[data-model.md](data-model.md)

## 讀之前先知道兩件事

1. **護欄的「紅」不在最前面，在產基線之前**（`build-guardrail` 6.5）。
   所以每條護欄都有一個 `先跑確認紅` 的 task，而**它不可以與產基線同一個 commit**。
2. **自我否證聲明先寫，量測後寫**（第 2 步，順序不可反）。寫完量測再補聲明，
   會照著已經看到的結果寫它，那句話就失去否證能力。

---

## Phase 1：Setup

- [ ] T001 確認參照編譯器可用並記下版本字串原文，寫入 `specs/108-residual-error-baselines/research.md` 已有欄位（若機器不同則更新）

## Phase 2：Foundational（US2 的阻斷前置）

- [ ] T002 [US3] 建立 `tests/helpers/run-cpp.ts`，提供 `runCpp(code)`、`referenceCompilerInfo()`、`hasReferenceCompiler()`；`hasReferenceCompiler()` 為 false 時 `runCpp` MUST 丟例外而非回傳 null
- [ ] T003 [US3] 改 `tests/integration/fuzz-cpp-strings.test.ts` 改用共用工具，刪除私有 `execSync` 實作
- [ ] T004 [US3] 改 `tests/integration/fuzz-cpp-stacks-queues.test.ts` 同上
- [ ] T005 [US3] 驗收：`grep -rln "execSync.*g++" tests/` 結果為 1，且 T003/T004 兩檔測試結果**逐字不變**（SC-004）→ commit

---

## Phase 3：User Story 1 — 形態的殘差（Priority: P1）

**Goal**：量出「模型不理解多少」，起點 0.23%。
**Independent Test**：拿掉任一顆元件的辨識規則 → 殘差率上升且指名。

- [ ] T006 [US1] 在 `tests/integration/audit-projection-residual.test.ts` **先寫檔頭的自我否證聲明**（錨在「語料載入了幾段」這個合成量，**不得**錨在殘差計數——FR-010）
- [ ] T007 [US1] 實作語料擷取與**兩欄分類**：以 `rootNode.hasError` 分「語法完整／語法有錯（片段）」，只有完整的計入殘差（FR-002）
- [ ] T008 [US1] 實作殘差量測：走語義樹統計 `raw_code`／`unresolved` 的字元數、節點數、`degradationCause` 分佈
- [ ] T009 [US1] 加雙向注入驗證（FR-011）：合成一棵含 `raw_code` 的樹 → 必須被計入；合成一棵全部認得的樹 → 必須不被計入
- [ ] T010 [US1] 加健康檢查：語料段數 > 0（**這是合成量，不是缺陷計數**），否則報「量測壞了不是世界長這樣」
- [ ] T011 [US1] **先跑，把數字印出來確認 ≈ 0.23%**，且兩欄統計合理（≈467／353）→ 這一步**不產基線**
- [ ] T012 [US1] 產基線 `tests/baselines/projection-residual.json`（含 `_meta.note` 說明棘輪方向與「下降的兩種原因」分欄），接上 `assertRatchet` → commit

---

## Phase 4：User Story 2 — 行為的誤差（Priority: P1）

**Goal**：量出「模型理解錯多少」。**這是真正開環的那一半。**
**Independent Test**：把直譯器某個運算子改錯 → 不一致筆數上升。

- [ ] T013 [US2] 在 `tests/integration/audit-behavior-error.test.ts` **先寫自我否證聲明**（同 T006 的錨點限制）
- [ ] T014 [US2] 實作語料擷取：帶 `int main` 的去重片段（實測 312 段）
- [ ] T015 [US2] 實作**四欄**執行統計（FR-005）：兩邊都跑得動／只有參照／只有直譯器／兩邊都不成。⚠️ 分母必須進基線，否則縮分母會讓誤差看起來下降
- [ ] T016 [US2] 實作逐筆明細（FR-004）：語料摘要、直譯器輸出、參照輸出
- [ ] T017 [US2] 實作 `hasReferenceCompiler()` 為 false 時**丟例外**（FR-006）——不得 `it.skip`
- [ ] T018 [US2] 並行編譯（依核心數），並在報告印出實際跑了幾段（research §四：不得靜默抽樣）
- [ ] T019 [US2] 加雙向注入驗證（FR-011）：一段兩邊必定一致的程式 → 不得報；一段兩邊必定不一致的 → 必須報
- [ ] T020 [US2] **🔴 先跑，確認紅，逐項指名**——實測起點 64／276。**這一步單獨 commit**（SC-006），不產基線
- [ ] T021 [US2] 逐筆分類 64 筆，寫進 `tests/assets/behavior-error-decisions.json`，判定 ∈ {真誤差／語料需要標準輸入／語料是故意錯的示範／其他}，**每一筆必須有理由**
- [ ] T022 [US2] 加判定過期檢查：訊號已不再出現卻還留著判定 → **報孤兒**（`build-guardrail` 第 11 步；基線過期會被棘輪抓到，判定過期不會）
- [ ] T023 [US2] 產基線 `tests/baselines/behavior-error.json`（`_meta` 含**參照編譯器版本字串原文**與旗標——FR-007），接上 `assertRatchet` → commit

---

## Phase 5：Polish

- [ ] T024 驗 SC-005：`PATH` 拿掉編譯器後跑誤差護欄 → **紅**（不是綠、不是 skip）
- [ ] T025 `npm test && npm run lint` 全綠
- [ ] T026 更新 `knowledge/draft/2026-08-10-掀出來但還沒做的.md` §三之二：把「19 個檔已經在算了」的錯誤前提改掉，補上實測數字
- [ ] T027 護欄總數 30 → 32，更新相關計數處

---

## Dependencies

```
T001 ──→ T002 ──→ T003 ──→ T005 ──→ ┐
              └─→ T004 ──→ ┘        │
                                    ↓
T006…T012  (US1，不依賴上面)        T013…T023 (US2，需要 T002)
     └──────────────┬───────────────────┘
                    ↓
              T024…T027
```

**US1 與 US2 可並行**，而**建議先做完 US1**（plan §Phase 1）：起點已知、不依賴外部工具，
若 US2 的分類卡在人工判斷，US1 已經是完整交付。

## Parallel 機會

- T003 / T004 可並行（不同檔）
- T007 / T008 需序列（後者吃前者的分欄結果）

## MVP

**US3 ＋ US1**（T001–T012）。它交付「模型不理解多少」這個刻度與一份共用工具，
而 US2 是風險最高、最可能需要人工判斷的一段。

# Tasks: 兩筆宣告與現實不符

🔴 **寫在最前面**：本功能**刪宣告讓數字下降**，而那與
「用宣告刷數字」從外面看一模一樣。

> **唯一的差別是出處。每一筆都要先拿出產生端／消費端的出處，再動手。**

## Phase 1：基線 ＋ 對照組

- [ ] T001 `npm test`（4161）、`npx vitest run tests/integration/audit-conformance.test.ts`（11）
- [ ] T002 🔴 跑 `declaration-change-parity` 記下**移除前**的來回結果
      ——它是 US2 的對照組

## Phase 2：US1 ＋ US2 —— `struct_at_member.obj`

- [ ] T003 [US1] 出處：`generate.ts:6` 用的是 `node.properties.obj`
      ——**它是參數不是接點**
- [ ] T004 [US2] 移除 `component.json` 的 `children.obj`
- [ ] T005 [US2] 🔴 `declaration-change-parity` **逐字相同**；`npm test` 綠
- [ ] T006 `audit-conformance` → 數字降；git commit

## Phase 3：US1 ＋ US2 —— `var_declare.declarators`

- [ ] T007 [US1] 出處：`strategies.ts:365-372` 多變數 lift 成 `_multi_field`
      包一組獨立的 `var_declare`——**從來不產生這個接點**
- [ ] T008 [US2] 移除 `component.json` 的 `children.declarators`
- [ ] T009 [US2] 🔴 對照組逐字相同；⚠️ 而 `generate.ts:11` 的分支變成死程式碼
      → **留著並記下**（plan 的決策）
- [ ] T010 `audit-conformance` → 數字降；git commit

## Phase 4：Polish

- [ ] T011 🔴 `conformance.json` 的說明：這兩筆標為**「宣告與現實不符」**，
      **與「實作了」分開**（FR-004）
- [ ] T012 全套 ＋ 43 條量測；`git diff --stat tests/baselines/`
      ——只有 `conformance.json` 可以出現
- [ ] T013 更新 `knowledge/`；git commit

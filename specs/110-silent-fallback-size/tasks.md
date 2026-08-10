# Tasks：靜默回退掩蓋辨識歧義

## Phase 1：護欄（先蓋）

- [ ] T001 `tests/integration/audit-silent-fallback.test.ts`：**先寫自我否證聲明**（錨在「掃到幾個檔／幾個 return」，不錨在回退筆數）
- [ ] T002 實作掃描：`if (<檢查>) return { …, value: <預設> }`，報檔:行＋條件＋回傳值
- [ ] T003 雙向注入：合成一段有回退的碼必須被報；一段沒有的不得被報
- [ ] T004 判定落點 `tests/assets/silent-fallback-decisions.json`＋每筆必須有理由＋孤兒檢查
- [ ] T005 **先跑確認紅、逐項指名**（預期 7 筆），⚠️ 不產基線
- [ ] T006 逐筆判定（`strcmp` 那 2 筆＝合法），產基線 → commit

## Phase 2：修 ②（讓病灶現形）

- [ ] T007 回歸測試：非容器取長度要出聲；**真空容器仍回 0**（FR-004，反向不可省）
- [ ] T008 修 `cpp:vector_size` → commit

## Phase 3：修 ③（.size() 的辨識）

- [ ] T009 回歸測試：`s.size()`→3、與 `length()` 相同、迴圈跑滿、其他容器不變
- [ ] T010 照抄 `.length()` 的規則形狀補 `.size()` 的字串分派 → commit

## Phase 4：收

- [ ] T011 重跑誤差護欄（預期 19 → 14），下調基線，`_meta` 註明「因為實作了」
- [ ] T012 靜默回退基線下調一筆（`vector:25` 已修）
- [ ] T013 `npm test` ＋ `npx tsc --noEmit` 全綠
- [ ] T014 `knowledge/history/039`

## MVP

Phase 1＋2（T001–T008）。護欄與「讓病灶現形」，而 ③ 的修法依賴 ② 才驗得出來。

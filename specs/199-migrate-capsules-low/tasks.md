# Tasks: 膠囊自證測換判準——第一批（重構 6c-2a）

## Phase 1：改寫（三組並行，不同檔）

- [X] T001 [P] [US1] 範圍與容器（16）：range_find_upper、range_find_lower、range_find、range_min、range_unique、range_remove、container_iter、container_find、container_pop_front、container_push_front、pointer_step、queue_back、deque_declare、map_declare、vector_declare、vector_make（`src/components/cpp/<名字>/spec.test.ts`）
- [X] T002 [P] [US1] 數學、字元、bitset、字串（13）：math_pow、math_unary、math_binary、math_constrain、char_is_alpha、bits_count、bits_declare、bits_fill、string_empty、string_at、string_find_first_not_of、string_find_last_not_of、literal_char
- [X] T003 [P] [US1] I/O 與宣告（8）：io_mode、io_mode_number、io_flush、io_sync、io_tie、pair_declare、var_declare_sequence、set_declare

## Phase 2：驗收

- [X] T004 37 個檔一起跑全綠；`grep -l SemanticInterpreter` 37 個檔無結果
- [X] T005 改了期望值的每一處有依據；疑似 Cella 判錯的整理後回報 cella
- [ ] T006 `npx tsc --noEmit`、`npm run test:guard`；在合併 main 之後的狀態跑全套
- [X] T007 盤點 draft 的 B-1 表標上「6c-2a 已遷」

## 量測紀錄

（實作時填）

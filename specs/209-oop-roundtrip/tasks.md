# Tasks: OOP 來回一趟的四個缺陷

- [X] T001 [US1] 虛擬／覆寫方法的尾端 const：`src/components/cpp/method_virtual`、`method_override` 的 component.json（`is_const`）、forms、labels、generate、formalize；`src/languages/cpp/lang/lifters/strategies.ts` 的 hasOverride／isVirtual 兩支記下 const；測試：來回一趟、在 const 參照上呼叫由 Cella 跑
- [ ] T002 [US1] 解構子的 virtual：`src/components/cpp/destructor`（`is_virtual`）、forms、labels、generate、formalize（mbDtor.virt）；strategies 的 destructor 分支記下 isVirtual
- [ ] T003 [US1] struct 的單一基底：`src/components/cpp/struct_declare`（`base_class`、`base_access`）、forms、labels、generate、formalize（照 class_def）；多重／virtual 繼承照實降級；`cella-oop-semantics` 的 struct 釘子轉正
- [ ] T004 [US1] 方法呼叫的箭號：`src/components/cpp/method_call`（`arrow`）、forms、labels、generate、formalize；`cella-oop-semantics` 的指標釘子轉正；`fuzz-cpp-oop` 那條 it.todo 轉正
- [ ] T005 `final`：lift 照實降級（不送成 virtual／override），一條測試
- [ ] T006 舊存檔：沒有新屬性的四種節點照樣渲染、產碼（一條測試）
- [ ] T007 驗收：`test:guard`、StudyCpp 探針（`STUDYCPP_DIR`，形狀不退步）、重產對照圖（record-blockmaps）、e2e、瀏覽器驗收（四顆積木與同族並排）

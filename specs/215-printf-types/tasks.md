# Tasks: printf 產碼的型別表（spec 215）

- [X] T001 核心：`GeneratorContext.expressionTypes`／`root`、`setExpressionTypes`（`src/core/projection/code-generator.ts`）
- [X] T002 核心：產碼自己加的註明登記處（`src/core/projection/generated-notes.ts`）——行末標註與獨立註解節點都拿掉
- [X] T003 C++：型別表與整支程式的保守條件（`src/languages/cpp/printf-types.ts`）；性狀 `changesStreamFormat`／`unsyncsStdio`（io_mode、io_mode_number、io_sync）
- [X] T004 產生器：`cpp:print`（printf 照型別、換行在原位、`%%`）、`cpp:input`（scanf 照型別、運算式位置比對個數）
- [X] T005 formalize：`cpp:string_as_cstring`（`.c_str()`）、`cpp:input_formatted` 的運算式形態（`eCall scanf`）
- [X] T006 產品：`app.ts` 記下判決帶回的型別、照形狀對到從積木抽回的樹（`carryTypes`）；對不上先保留、新型別到了補產（上一步在程式碼那側時不補產）
- [X] T007 測試：`printf-types`（情境＋三個 Cella 缺口釘住）、`carry-types`、`generators` 的 I/O 段給型別；`form-invariance` I/O 切換的 10 根釘子拔掉；`audit-cin-fail-state` 的 c_str 釘子拔掉
- [X] T008 基線（formalize 工具 ＋ 六份語料基線，各附 note）
- [X] T009 學生語料 I/O 切換量兩輪（58 → 6，剩 Cella 兩個缺口）；修掉量到的三個（io_sync 混用才標、scanf 的 &d[i].x、逗號運算式裡不加註明）→ history 339、vision、draft 退場
- [ ] T010 長測試（全套 ＋ e2e）→ 合併

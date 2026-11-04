# Tasks: 運算式當敘述的包裝積木（spec 214）

- [X] T001 降級登記處加 `expressionStatement`（`src/core/blocks/degradation-blocks.ts`）；C++／Python 宣告名字
- [X] T002 積木註冊：`src/ui/block-registrar.ts` 依宣告建包裝積木（一個值插槽 `EXPR`）；標籤進 `src/i18n/*/blocks.json`
- [X] T003 渲染：`renderStatementChain` 對運算式形態套包裝（`src/core/projection/block-renderer.ts`）
- [X] T004 抽取：`PatternExtractor.extract` 拆包裝、空包裝回 null（`src/core/projection/pattern-extractor.ts`）
- [X] T005 `tests/integration/form-invariance.test.ts`：兩根釘子轉正 ＋ 載得進工作區 ＋ 有敘述形態不套 ＋ 空包裝
- [X] T006 學生語料探針：積木來回 3 → 0；第三支是 `pointer_declare` 在 `for` INIT——補運算式形態並加常駐檢查（反證過：拿掉會紅）
- [X] T007 knowledge：history/338、vision
- [ ] T008 test:unit／capsule／guard → 重產對照圖 → 長測試（全套 ＋ e2e）→ 合併

# Tasks: 深嵌入的 formalize（180）

## 第一批（不需要 Cella 升級）

- [x] T001 靜態作用域走訪（`providers/cella/formalize/scope.ts`）：課文 94 份、852 個參照、0 個落空；方法元件的文字 `obj` 也解析
- [x] T002 formalize 最小子集與形狀判定者（對 Cella repo 的 `syntax.cella`，照 `cpp_to_tree.py` 的 constructor_fields）
- [x] T003 第二～四批：容器、陣列（一維、二維、巢狀初值）、指標、字串、struct、printf／scanf、for／range-for、函式庫呼叫、sort 與迭代器、數字後綴與負數
      ⟹ 課文解答 42 → 56 → 68 → 75 → 79 / 94 翻得出
- [ ] T004 等 cella 回覆的寫法：結構型別名（`tStruct`／`tClass`）、`pair`、容器樣板（queue／stack／set／map／priority_queue）、`auto`
- [x] T005 元件對照表 ＋ 護欄（FR-007、SC-004）：每顆 C++ 元件都有對應或明確的「不送」理由；未對應數棘輪
- [ ] T006 支援清單（Cella 的 `supported`）接上：送出前擋 Cella 還沒做的函式與成員（FR-004）
- [ ] T007 空槽 → 洞（`eHole`／`sHole`，標籤 `<節點>#<槽名>`）的完整處理與測試（FR-005；今天只有 `exprOf` 的缺槽）
- [x] T008 Arduino：`board` 與裝置積木（`dht_declare`、`servo_declare`、`lcd_declare`、腳位）
- [x] T009 C18 語料（`tests/probes/c18-corpus.test.ts`，`C18_CORPUS_OUT=…` 才寫檔）：104 筆 text、93 筆附 program

## 第二批（等 Cella 升級）

- [ ] T010 接判決入口，量 SC-002（`invalid` 為 0）與 SC-003（problem 標得回節點）
- [ ] T011 形狀判定者改讀套件（不依賴姊妹 repo 的路徑）

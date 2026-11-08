# Tasks: 操作者拿得到元件詞彙

- [x] T001 寫 `tests/unit/core/proposals/vocabulary.test.ts`：C++ 詞彙只含 `cpp:`、含 `cpp:print`（values 收 expression、位置是語句）；Python 拿得到；可序列化；筆數等於宣告數；依詞彙組的最小節點插入 main（語句）或 print 的 values（運算式）時不被拒成 unknown-component／unknown-slot／unknown-property
- [x] T002 實作 `src/core/proposals/vocabulary.ts` 的 `vocabularyOf(schema, componentIds)`：屬性與接點從 `OpSchema` 取（與形態檢查同一份），位置從 `positionsOf`
- [x] T003 `OpSchema` 加 `ids()`（它認得的元件身分）；App 的 `proposals.vocabulary()` 依目前語言的前綴過濾
- [x] T004 e2e：`__app.proposals.vocabulary()` 回 C++ 的詞彙、用其中一筆組的提議通過
- [ ] T005 型別、unit、guard（基線手改附 note）、長測試

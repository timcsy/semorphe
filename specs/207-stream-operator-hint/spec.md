# Feature Specification: 串流配錯運算子的提示（6c-4 的前置）

**Feature Branch**: `232-stream-operator-hint`
**Created**: 2026-11-02
**Status**: Done

## 背景

`cin < x`、`cout < "Hi" << endl` 是第一課常見的打錯。JS 直譯器會說「cin 要配 >>」；Cella 給的是「invalid operands to a binary operator」，
`cout` 那例甚至指著 `endl` 說「this construct is not part of C++」——學生更困惑。var_ref/gap 的兩根釘子在等這個。

## Requirements

- **FR-001**: 判決是 reject 時，樹裡「比較運算（`<`、`>`）的左邊是串流」的節點給 `STREAM_OPERATOR_SUGGEST`（stream、op、want）。
  比較運算的左邊是串流在 C++ 裡一定錯（輸出入串流不能比大小），所以不會誤報合法程式；判決不是 reject 時不提示。
- **FR-002**: 取代落在同一個比較運算子樹裡的 Cella reject（CELLA_REJECT、CELLA_OTHER）——不同時顯示一句對的與一句讓人困惑的。
- **FR-003**: 核心只讀節點的 `operator` 屬性與 `left` 那一格第一顆的 `name`；哪些名字是串流、該配什麼由語言給（`LanguagePack.streamOperators`）。
- **FR-004**: 中英文案。

## Success Criteria

- 單元測試 4 條（先紅後綠）；var_ref/gap 兩根釘子轉正向（真的 Cella 判決＋產品同一支 toDiagnostics）。

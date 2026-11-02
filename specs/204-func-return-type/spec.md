# Feature Specification: 一般函式的回傳型別要一字不少（第 229 刀）

**Feature Branch**: `229-func-return-type`
**Created**: 2026-11-02
**Status**: Done
**Input**: 6c-2e 的盲測抓到——main 上一般函式的回傳型別會被改壞。

## 症狀（main 上重現）

| 學生寫 | 轉一圈 |
|---|---|
| `string& k(string& s)` | `string k(string& s)() {`（參考那一層沒剝，名字吞掉參數，**編不過**） |
| `const char* nameOf(int m)` | `char* nameOf(int m)`（`const` 安靜消失） |
| `static const char* h()` | `char* h()`（`static` 與 `const` 都消失） |

類別成員那一條（`liftMethodDef`）第 218 刀修過同一件事，一般函式的 `liftFunctionDef` 沒有跟著修。

## Requirements

- **FR-001**: 回傳型別 MUST 保留宣告子之前的整段原文（storage class、type qualifier），空白正規化。
- **FR-002**: 回傳指標與參考的那幾層 MUST 剝開、符號接回回傳型別，名字與參數照常取得。
- **FR-003**: formalize 送給 Cella 的型別 MUST 剝掉 `static`／`inline`／`extern`／`constexpr`（單一翻譯單元不改變執行結果）。
- **FR-004**: 回歸測試 MUST 斷言原文一字不差、第二趟不動點、身分仍是 `cpp:func_def`，並經變異檢查。

## Success Criteria

- **SC-001**: 九種寫法轉一圈一字不差；回傳參考的函式交給 Cella 判出正確輸出。
- **SC-002**: StudyCpp 218 支：同一棵 218、走樣 0（與修之前相同）。

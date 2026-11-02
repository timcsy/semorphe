# Feature Specification: 近似名的建議搬到判決診斷（6c-4 的前置）

**Feature Branch**: `231-near-miss-in-diagnostics`
**Created**: 2026-11-02
**Status**: Done
**Input**: 6c 測試盤點 F 類：「`near-miss` 提示住在直譯器裡，拆了沒地方放」——6c-4 刪 JS 直譯器之前要先有新家。

## 背景

學生把 `cout` 打成 `Cout`、把 `score` 打成 `scoer` 時，JS 直譯器會說「是不是要寫 cout」（`interpreter/scope.ts` 的 `undeclared` ＋ `interpreter/near-miss.ts`）。
換成 Cella 之後只剩 clang 式的「use of undeclared identifier 'Cout'」——那句建議是資訊，不是修辭（`near-miss.ts` 檔頭）。

## Requirements

- **FR-001**: 近似名演算法搬到語言中立的 `src/core/near-miss.ts`（直譯器改從那裡 import，6c-4 刪直譯器時不受影響）。
- **FR-002**: `toDiagnostics` 遇到 Cella 判「use of undeclared identifier 'X'」時，在**樹裡宣告過的名字**（每顆節點的 `name` 屬性）與**語言給的常用名字**（`LanguagePack.wellKnownNames`）裡找近似名；找到 → 規則 `CELLA_UNDECLARED_SUGGEST`（帶 name、near）。
- **FR-003**: 寧可漏，不可錯——找不到就照原本的 `CELLA_REJECT`，一個字都不多。
- **FR-004**: 中英文案（積木與程式碼兩種）。

## Success Criteria

- **SC-001**: 單元測試 4 條（先紅後綠）：常用名字、樹裡的名字（含相鄰兩字對調）、找不到不亂猜、其他 reject 不受影響。
- **SC-002**: var_ref/gap 的「`Cout` 說不出是 cout」釘子轉成正向（真的 Cella 判決 ＋ 產品同一支 toDiagnostics）。

## 範圍外

- Python：Cella 對未定義的名字給的是 `NameError` 例外（不是 reject），形狀不同——另一刀。
- 「`cout <` 要配 <<」「`cin <` 要配 >>」：判決給的是 invalid operands，要從樹的形狀判（運算子左邊是串流）——另一刀。
- 執行期（工作階段 launch 時被拒）的訊息：這一刀只做編輯時的判決診斷。

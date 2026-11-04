/**
 * C++ 套件裡**不是元件**的樹節點——**產品與護欄載入的是同一份**。
 *
 * 它們沒有概念定義是**刻意的**，而在此之前那與「忘了寫定義」分不出來——
 * 兩者都只是「不在登錄表裡」。見 `src/core/blocks/non-components.ts` 的檔頭。
 *
 * 🔴 2026-10-31 以前這三筆只寫在 `cpp/module.ts`，而那個檔產品從不載入：
 * 產品裡 `nonComponentDecl('param_decl')` 是 undefined，護欄（副作用 import 那個檔）看到的卻有宣告
 * ——**護欄驗的不是產品的世界**。搬到這裡，由 `generators/index.ts` 載入。
 */
import { declareNonComponent } from '../../core/blocks/non-components'

declareNonComponent(
  'param_decl',
  'structural',
  '函式參數的結構化節點（`{type, name}`）。它是 `func_def` 的子節點，不會單獨成為一顆積木；' +
    '把它做成元件會多出一顆只有一路的殼。⚠️ C1（參數規格化）可能把它升級成 ParamSpec 的一部分。',
)
// ⚠️ ~~`cpp_initializer_list` 曾在這裡宣告成 structural~~
// **2026-08-14 升格成元件** `cpp:initializer_list`。原本的理由逐字是
// 「它是宣告的子節點、不獨立存在」，而那句話**只對辨識那一路成立**：
// 積木那一路需要它獨立存在，否則多維初始值表達不出來（`{{1,2},{3,4}}` 要巢狀）。
// 🔴 症狀是使用者開瀏覽器才發現的——積木上沒有初始值，一動就掉。
declareNonComponent(
  '_compound',
  'sentinel',
  '辨識過程的中間產物：pattern 匹配到多個節點時的暫時包裝，攤平後就消失，不會進入最終語義樹。',
)
declareNonComponent(
  '_multi_field',
  'sentinel',
  '一次宣告多個結構成員（`int x, y;`）時的包裝。⚠️ 它**會留在語義樹裡**（struct 的成員；產生器靠它把 `int x, y;` 產回成一行），渲染積木時攤成平行的宣告（2026-11-04 spec 213 更正：原本寫「攤平後就消失」，而渲染端因此沒有處理它、整組欄位走一趟積木就不見）。底線前綴是慣例，而**判準是這份宣告，不是前綴**。',
)

# 模糊測試報告 — C++ — 2026-11-07（元件管線 322：類別外定義成員函式）

## 摘要
- 出題：隔離的出題者（不知道 Semorphe 的實作），10 支 hard，主題「成員只在類別裡宣告、定義寫在類別外」
- 成功編譯執行：10（clang++ -std=c++17）
- 這一族的元件認得：10／10（每支 11～22 顆）
- ROUNDTRIP_DRIFT：第一輪 2 支（fuzz_7、fuzz_9）→ 修好後 0
- 交給 Cella：10 支都還翻不出——**原因全在這一族之外**（見「覆蓋缺口」）；釘在回歸測試裡，哪一條修好了測試會提醒
- 永久測試：`tests/integration/fuzz-cpp-oop-out-of-class.test.ts`（25 支）＋ 語料 `tests/fixtures/fuzz-cpp-oop-out-of-class.json`
- 殘留 it.todo：0

## 發現並修好的 Bug（當場修）

### ① `new int[n]()` 的值初始化被丟掉（fuzz_9，ROUNDTRIP_DRIFT）
陣列 new 的產碼只印 `new int[n]`，`()`／`{}` 不見——每格從歸零變成未初始化。產碼照 `valueInit`／`brace` 印回去；formalize 的 `eNewArr.zero` 照實送（原本一律 false）。

### ② 類別整段因語法錯誤降級時少了結尾的 `;`（fuzz_7，ROUNDTRIP_DRIFT）
`class_specifier` 的 `;` 是它的下一個兄弟 token，不在原文裡；產回去之後跟下一段黏在一起。記原文時補上（只限 class／struct／union／enum）。

### ③ `explicit` 建構子、`virtual`／`override` 的原型照舊降級（fuzz_3、fuzz_5）
各加一格屬性：建構子原型 `is_explicit`（Cella `mbCtor.expl`）、方法原型 `virt`（none／virtual／override → `vVirtual`／`vOverride`）、解構子原型 `is_virtual` 多一個值 `override`。兩個都寫的照舊降級。

### ④ 參數預設值 `nullptr` 翻不出（fuzz_4）
內建常數那顆把 `nullptr`／`true`／`false`／`NULL` 登記成字面（`r.literal`）。

## 覆蓋缺口（不在這一刀；各自是另一刀）

| 缺口 | 用到的 | 備註 |
|---|---|---|
| 運算子多載的原型與類別外定義（`Fraction Fraction::operator+(…) const`） | fuzz_2、6、8 | 一對新元件（同這一刀的形狀） |
| 靜態成員函式的原型（`static int count();`）、靜態成員的類別外定義（`int A::alive = 0;`）、限定名 `Node::created` | fuzz_1、4、8、9 | 既有缺口 |
| `new T(…)`／`new T{…}` 的引數是文字屬性 | fuzz_4、5、9（313 的 fuzz_2、3、5、6 也是） | 屬性升格成運算式槽，判準在〈元件代數〉 |
| 初始化列裡的 `new X*[n]` | fuzz_3、10 | tree-sitter 的容錯解析 |
| 沒有名字的指標參數帶預設值（`Engine* = nullptr`） | fuzz_7 | tree-sitter-cpp 不認得，整段誠實降級 |
| `ostream` 當參數型別 | fuzz_5 | formalize 的型別表 |

## 建議
先做「運算子多載的類別外定義」與「`new T(…)` 的引數升格」——兩件各解掉三四支。

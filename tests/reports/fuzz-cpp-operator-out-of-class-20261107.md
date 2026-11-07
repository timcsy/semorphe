# 模糊測試報告 — C++ 運算子的原型與類別外定義 — 2026-11-07（第 331 刀）

## 摘要
- 出題者：資訊隔離的代理（不讀原始碼），8 支 hard、全部 g++ -std=c++17 編得過
- **運算子這一族：8/8 認得**（每支 22～36 個運算子的原型與定義，名字 `operator⊕`）、0 支因運算子降級、8/8 再 lift 不漂移
- 判決：accept 1（fuzz_1，輸出同 g++）、誠實 unknown 3（fuzz_5 ubElide；fuzz_6、8 orderUncompared——輸出同 g++）、Cella 誤判 2（fuzz_2、7，已回報）、翻不出 2（fuzz_3、4，陣列成員的大括號初始化）

## 發現並修掉的（都在這一族之外，既有缺陷）
| # | 缺陷 | 嚴重度 | 修法 |
|---|---|---|---|
| 1 | `const Vec k(5, 6);` 走一趟變 `const Vec k = 5;`、formalize 只送第一個引數——預設參數補上第二個，**Cella 印出別的值**（fuzz_1 第 4 行 11 → 5）＋再 lift 漂移（fuzz_1、8） | 🔴 SEMANTIC_DIFF | lift 帶 `init_style`、產碼寫建構子形式、formalize 走 `declCtor` |
| 2 | `to_string` 沒有 formalize（fuzz_2、6、8 整支翻不出） | 🟡 | 補 `string_make/formalize.ts` |
| 3 | 成員初始化列只取第一個引數：`c{1, 2, 3}` 走一趟變 `c(1)`、`m(a, b)` 少一個——Cella 判「不能指派」（fuzz_4，P6 誤判） | 🔴 對稱的資料遺失 | 引數不是剛好一個就整個建構子照實降級（等 Cella 的 minit 收 Init） |

（round-trip 階段另修了 `delete[]`、指標陣列參數、多宣告子的建構子初始化三個——見 roundtrip 報告）

## 回報 Cella（2026-11-07，附最小重現）
1. `vector<T> v(arr, arr + n)`：迭代器區間建構子 → 誤判 reject（fuzz_7）
2. 多載 `<<` 串接判 orderUncompared——C++17 起運算子寫法的多載呼叫依內建運算子定序（fuzz_6、8）
3. 成員初始化列的大括號串列：minit 若能收 Init，我們這側接得上（fuzz_3、4）
4. 透過轉換建構子的隱式轉換（`h -= 3`、`num(7)`）→ 誤判 reject（fuzz_2）

## 覆蓋缺口（這一族之外）
- 類別裡的多維陣列欄位（fuzz_3）

## 永久測試
- `tests/integration/fuzz-cpp-oop-operator-out-of-class.test.ts`（20 支：8 支身分／不漂移、8 支判決釘子、3 支修好的回歸、1 支入口條件）
- fixture：`tests/fixtures/fuzz-cpp-oop-operator-out-of-class.json`
- it.todo：0

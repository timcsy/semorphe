# 概念探索：C++ — 運算子多載的原型與類別外定義

## 摘要
- 語言：C++
- 目標：類別裡只宣告運算子（`Fraction operator+(const Fraction&) const;`），定義寫在類別外（`Fraction Fraction::operator+(const Fraction& o) const {…}`）
- 發現概念：2 個（語言特定）
- 來源：`knowledge/draft/2026-11-07-類別外定義之後的缺口.md`——322 的盲測 fuzz_2、6、8 卡在這裡（今天整段誠實降級成原文）
- 歸屬：與 322 的六顆、既有的 `cpp:operator_overload` 同一格（工具箱「結構與類別」／category `oop`、顏色 `#CF63CF`）

## 概念目錄（進階：類別與物件）

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|
| `cpp:operator_declare` | `T operator⊕(P [name]) [const];` | 類別裡**宣告**一個運算子（定義在別處） | 回傳型別、運算子、參數型別、參數名（可空）、const | 特定（lang-core） | `raw_code` | 原型的參數名常常省略（fuzz_2、8：`operator*(const Matrix&)`）——參數名可空 |
| `cpp:operator_def_outside` | `T C::operator⊕(P name) [const] {…}` | 在類別外**定義**類別 C 宣告過的運算子 | 類別名、回傳型別、運算子、參數型別、參數名、const、本體 | 特定（lang-core） | `raw_code` | formalize 接回 C 的成員：原型給 const／存取權，定義給本體與參數名 |

## 依賴關係
- 形狀照抄 `cpp:operator_overload`（類別內定義那一顆：單一參數屬性 `param_type`／`param_name`、`is_const`、運算子下拉）
- 合併機制照抄 322：`src/languages/cpp/member-key.ts` 的 `memberKeyOf(name, 參數型別, const)`——名字用 `operator⊕`
- formalize 引擎 `src/providers/cella/formalize/index.ts` 的 inClassByKey／outsideByKey 已經存在，加兩個身分即可

## Cella 對應
- 有：類別內的運算子就是 `mbMethod { f: fdef { name: 'operator⊕' } }`（`cpp:operator_overload` 已在送）。類別外定義接回之後是同一個形狀——**不需要 Cella 新增任何東西**

## 建議實作順序
1. `cpp:operator_declare`（原型）——類別裡只宣告時，lift 不再把整個類別降級
2. `cpp:operator_def_outside`（類別外定義）——與 1 一起才翻得出

## 跨語言對應
- Python 的 `__add__` 是類別內定義，沒有「宣告與定義分開」——無對應

## 需注意的邊界案例
- 回傳參照：`Matrix& operator=(const Matrix&)`、`Stack& operator<<(int)`——回傳型別帶 `&`
- 原型沒有參數名（`const Fraction&`）——`slotAsField` 那條「沒有名字的多字型別」322 修過
- 一元運算子（`Fraction operator-() const`）：沒有參數——參數型別可空
- 同一個運算子多載兩次（不同參數型別）——memberKey 帶參數型別，不撞
- 非成員運算子（`ostream& operator<<(ostream&, const Fraction&)`）與 `friend` 宣告：**不在這一刀**（不是成員；friend 是 draft 裡另一列）
- 類別外定義寫在 `Fraction::` 但類別裡沒有原型——照 322：誠實降級（「類別外找不到它的宣告」）

## 🟢 產生階段的決定（2026-11-07）：不新增兩顆，重用 322 的「宣告方法／類別外定義方法」

讀過共用判別之後改了做法——運算子的原型與類別外定義**走 `cpp:method_declare`／`cpp:method_def_outside`，名字記成 `operator⊕`**：
- **Cella 端同形**：類別裡的運算子本來就是名字叫 `operator+` 的成員函式（`mbMethod { f: fdef { name: 'operator+' } }`）——合併機制（memberKey）、產碼、formalize 一行都不用改
- 322 的那兩顆已經處理過參數槽（一元／多參數／沒有名字的參數／預設值）、多載、回傳參照；`operator_overload` 那種單一參數屬性的形狀反而窄
- 改動只有共用判別放寬兩個條件 ＋ 名字正規化（原型寫 `operator +`、定義寫 `operator+` 也配得上）
- **代價（記著）**：積木上顯示「宣告方法 operator+」，與類別裡定義運算子那顆的運算子下拉外觀不一致。若要統一成下拉，是另一刀（新增一個形態，不是新身分）
- 最強反方：新增兩顆身分更「一個積木一個概念」——但在語義上它們就是成員函式，身分分開會讓 memberKey 多一套、formalize 多兩份同樣的翻譯

# 概念探索：C++ — 類別外定義成員函式

## 摘要
- 語言：C++
- 目標：類別裡只寫成員的**原型**、定義寫在類別外（`void A::link(B* b) {…}`、`A::A() {…}`、`A::~A() {…}`）
- 發現概念總數：6（全部 C++ 特定、lang-core）
- 今天：313（history/346）之後這一族**誠實降級成原文**（`src/languages/cpp/lang/lifters/strategies.ts` 三處 `degrade`：類別裡的建構子／解構子原型、類別裡的方法原型、類別外帶 const 或建構子／解構子的定義）；
  不帶 const 的一般成員函式類別外定義（`void A::link(B* b) {…}`）今天被 lift 成名字叫 `A::link` 的**頂層函式**——形狀看起來對，身分不對
- 量測：課文 0 處、StudyCpp 0 處（2026-11-06 量過）；313 的盲測十支裡六支用到（fuzz_1、3、6、7、8、10；fuzz_9 只有 `ds::totalWeight`）

## 為什麼要做（教育價值）

這是 C++ 教科書與競賽以外的程式（多檔專案、`.h`／`.cpp` 分開）**最常見的寫法**：類別本體只列介面，實作在後面。
學生從課本抄進來的程式只要用到它，今天整段變成灰色原文——工具箱拿不到、積木改不動。

## Cella 那一側（已確認，不需要新建構子）

參照翻譯 `cella/tools/cfamily/cpp_to_tree.py`：

- 1027–1029 行：`# a member defined outside the class: its definition (the body, the member initializers, its parameters' names); virtual, = 0 and override are written on the declaration in the class` → `m = self.outside.get(m.get("id"), m)`
- 1205 行：類別外定義在頂層**不送任何東西**（`if k in OUTSIDE_KINDS and d.get("previousDecl"): return None`）

⟹ **formalize 的形狀**：類別裡的原型翻成那個成員（`mbMethod`／建構子／解構子），**本體與參數名取自類別外的定義**；類別外的定義在原位置回 `[]`。
找不到定義的原型（只宣告、從沒定義、也沒被呼叫）照 Cella 的規則送宣告——Cella 的 `fdef` 需要 body，所以**沒有定義的原型 → `f.miss`**（照實標翻不出，不猜一個空本體）。

需要的引擎能力（契約新增一項）：`f.outsideDefinition(類別名, 成員鍵)` → 類別外那一顆定義（引擎在開始時掃一遍頂層建索引）。
成員鍵＝名字 ＋ 參數型別串（多載用；解構子用 `~名字`）。

## 概念目錄

### 類別與物件（`cpp-beginner`／`cpp-advanced`／`arduino` 裡 `cpp:class_def` 所在的那個節點）— 進階

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | 降級路徑 | 備註 |
|---|---|---|---|---|---|
| `cpp:method_declare` | `int get() const;`、`void link(B* b);` | 類別裡**宣告**一個成員函式（定義在類別外） | 回傳型別、名字、const、參數（同 `method_def` 的 params） | raw_code | 只出現在類別裡（`insideParentOnly`） |
| `cpp:constructor_declare` | `A(int v);` | 類別裡宣告建構子 | 類別名（隨父節點）、參數 | raw_code | 同上 |
| `cpp:destructor_declare` | `~A();`、`virtual ~A();` | 類別裡宣告解構子 | 類別名、virtual | raw_code | 同上 |
| `cpp:method_def_outside` | `int A::get() const { … }` | 在類別外**定義**類別 A 的成員函式 | 類別名、回傳型別、名字、const、參數、本體 | raw_code | 頂層（`topLevelOnly`） |
| `cpp:constructor_def_outside` | `A::A(int v) : x(v) { … }` | 在類別外定義建構子 | 類別名、參數、成員初始化串列、本體 | raw_code | 初始化串列同 `cpp:constructor` 的 `inits` |
| `cpp:destructor_def_outside` | `A::~A() { … }` | 在類別外定義解構子 | 類別名、本體 | raw_code | |

⚠️ 命名：`declare`／`define` 與既有的 `class_declare`（前置宣告）、`forward_decl`（函式原型）同一組動詞——「宣告」只說有這個東西，「定義」給出本體。

## 依賴關係圖

```
class_def ──包含──▶ method_declare / constructor_declare / destructor_declare
                         ▲ formalize 取本體（成員鍵）
method_def_outside / constructor_def_outside / destructor_def_outside（頂層）
```

## 建議實作順序

1. `method_declare` ＋ `method_def_outside`（六支盲測裡五支只用到這一對；契約的 `outsideDefinition` 在這一步加）
2. `constructor_declare` ＋ `constructor_def_outside`
3. `destructor_declare` ＋ `destructor_def_outside`

一條分支做完三對，各對分開提交。

## 跨語言對應

Python 沒有「類別外定義」；C 沒有類別（`isC` → `f.miss`）。無通用概念。

## 需注意的邊界案例

- **多載**：`void f(int); void f(double);` 兩個原型、兩個類別外定義——成員鍵要帶參數型別，不能只用名字。
- **參數名不同**：原型 `void link(B*);`（沒有名字）、定義 `void A::link(B* b)`——Cella 取**定義的參數名**（1027 行），積木上兩邊各自照原文。
- **預設引數寫在原型上**：`void f(int k = 5);` ＋ `void A::f(int k) {…}`——預設值屬於原型（類別裡那一顆）。
- **回傳指標／參照**：`Node* A::find(int k) {…}`——declarator 外面包 `pointer_declarator`（同 `liftPointerPrototype` 的剝法）。
- **巢狀命名空間或樣板類別**：`ns::A::f`、`A<T>::f`——這一刀不收，照舊降級（記下來）。
- **定義在類別外、而類別裡沒有原型**：C++ 不合法——照實送（formalize 找不到類別成員 → `f.miss`）。
- **靜態成員函式**：`static int count();` ＋ `int A::count() {…}`——`static` 只寫在原型上；這一刀不收（照舊降級），記為後續。
- **`virtual void f();`（非純虛擬）的原型**：virtual 只寫在原型上；這一刀先收 `method_declare` 不帶 virtual 的，帶 virtual 的照舊降級——量過再決定要不要加一格。

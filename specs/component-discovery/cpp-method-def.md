# 概念探索：C++ — 類別成員的一般函式（`cpp:method_def`）

## 摘要
- 語言：C++
- 目標：struct／class 裡的一般成員函式，含尾端 `const`（`int area() const { … }`、`void inc() { … }`）
- 發現概念總數：1（新元件 `cpp:method_def`）
- 通用概念：0、語言特定概念：1
- 建議歸屬：`cpp-advanced` 課程清單，與 `cpp:method_virtual`、`cpp:method_override`、`cpp:operator_overload` 同一節點（`src/languages/cpp/topics/cpp-advanced.json:203` 附近）
- 設計來源：`knowledge/draft/2026-11-02-成員函式的尾端const.md`（使用者 2026-11-02 定 B，`knowledge/history/326-使用者定的五題之三.md`）

## 為什麼是一顆新元件（不是 func_def 加屬性）

- **現況（查證過）**：`src/languages/cpp/lang/lifters/strategies.ts:827`「Regular member function → lift as func_def」——
  一般成員函式被 lift 成頂層的 `cpp:func_def`，它只有 `name`、`return_type`，**尾端 `const` 在這裡丟了**，產碼也不寫。
  ⟹ `int area() const` 來回一趟變 `int area()`，在 `const P&` 上呼叫就編不過（既有的來回一趟缺陷）。
- 同族已經有自己的元件：`cpp:method_virtual`、`cpp:method_override`、`cpp:operator_overload`（都 `memberRole: "method"`）。
  只有「一般的」那種借用了頂層的 `func_def`。
- `const` 只在類別成員上合法——放在 `func_def` 上，頂層函式（含 `main`）會看到一個不合法的選項；`func_def` 也是最常用的積木，對照圖全要重產。
- 語義上不同：成員函式有隱含的 `this`（const 的時候是 `const T*`，[class.mfct.non.static]），頂層函式沒有 ⟹ 照 `元件代數.md` 的判準是身分，不是屬性。

## 概念目錄

### 類別與物件（cpp-advanced 的 OOP 節點）— 進階

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| `cpp:method_def` | `R name(params) [const] { body }`（在 struct／class 的本體裡） | 定義一個成員函式；`const` 表示它不改自己（`this` 指到 const） | 回傳型別、名字、const 下拉（「（會改自己）」／「const（不改自己）」）、參數（statements）、本體（statements） | lang-core | C++ 特定 | `func_def`（今天的行為）→ `raw_code` | `is_const` 照 `operator_overload` 的做法：enum `'false'`／`'true'`、預設 `'false'`（存檔相容） |

## 五路

| 路 | 做法 |
|---|---|
| lift | `strategies.ts:827` 那一支改成 `buildMethodDef({ return_type, name, is_const }, { params, body })`；`is_const` 讀 `function_declarator` 底下的 `type_qualifier`（同 `strategies.ts:800`） |
| generate | `R name(params) const { … }`（`is_const === 'true'` 時補 ` const`） |
| render／extract | `forms/blocks.json`：照 `method_virtual` 的積木，多一個 const 下拉；extract 由 PatternExtractor 自動推導 |
| execute | `skipPaths: ["execute"]`、`skipReasons: consumed-by-parent`——同族三顆都是這樣（類別宣告那顆負責執行期的方法表） |
| formalize | `r.member('cpp:method_def', …)` → `mbMethod { acc: acPublic, isConst, expl: false, virt: vNone, f: fdef }`（同 `operator_overload/formalize.ts`）；參數走 `params` 槽的節點（不是屬性） |

⚠️ execute：今天 `func_def` 在類別裡怎麼被 JS 直譯器執行，要先查清楚——新元件不能讓既有的成員函式呼叫在 JS 那一路壞掉（6c 之前 JS 直譯器仍是執行的來源）。

## 依賴關係
- 依賴：`cpp:struct_declare`／`cpp:class_def`（它只出現在類別本體裡）、`param_decl`（參數）
- 被依賴：`cpp:method_call`（呼叫端不變）

## 建議實作順序
1. `cpp:method_def`（唯一一顆）

## 跨語言對應
- Python 的 `def method(self, …)` 在類別裡——Python 沒有 const，不在本次範圍

## 需注意的邊界案例
- `int get() const;`（只有宣告、定義在類別外 `int P::get() const { … }`）——本次只處理類別本體裡的定義；類別外的定義照舊（看現況再決定，不擴大範圍）
- `static` 成員函式、`inline`、`noexcept`、`= default`／`= delete`、`&`／`&&` ref-qualifier——都不是本次範圍；遇到要照舊走原路（不可被新元件吃掉而丟資訊）
- 建構子、解構子、virtual／override、運算子多載各有自己的元件，判別順序要排在它們**之後**
- 既有存檔：類別裡的 `func_def` 載入時仍是 `func_def`（不做遷移也不壞：產碼與今天相同，只是沒有 const）——要不要附一次性轉換在 integrate 時決定
- 學生語料（StudyCpp）與課文：目前 0 支卡在這裡（draft 記的）——驗收要自己寫有 const 與沒有 const 的兩種

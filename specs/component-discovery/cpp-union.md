# 概念探索：C／C++ — union

## 摘要
- 語言：C／C++（`cpp` 語言套件，C 目標共用）
- 目標：`union` 的定義、型別、成員存取、`typedef union`
- 發現概念總數：1 個新元件（`cpp:union_declare`）＋ 2 處既有元件的延伸（型別文字 `union U`、`typedef union`）
- 通用概念 0、語言特定 1
- 歸屬：`c-beginner`（與 struct 同一節）、`cpp-advanced`（與 struct 同一節）

## 現況（2026-11-08 在 344 上實測）

```
union U { int i; char c; };            → 整句 raw_code（頂層元件沒有對應）
union U u;                             → var_declare，型別「union U」formalize 翻不出
u.i = 65;                              → 既有的成員存取，形狀沒問題
```

Cella 的形狀（cella 2026-11-08，與 struct 對稱）：頂層 `{"k":"iUnion","d":<sdef>}`；型別 `{"k":"tUnion","name":"U"}`；
區塊內 `{"k":"sType","d":{"k":"tdUnion","d":<sdef>}}`。模型（`@cella-lang/c`）：`ctUnion`、`uget`／`uset`、`uactive`，
讀非作用中的成員判 unknown（`model_stricter`，`c.uActiveB`）——C11 6.5.2.3 註 95 允許型別雙關，模型比標準嚴，所以是 unknown 不是 reject。

## 概念目錄

### c-beginner「結構」那一節 ／ cpp-advanced 同一節

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| `cpp:union_declare` | `union U { int i; char c; };` | 定義一個「同一塊記憶體、一次只放一個成員」的型別 | 名字、成員（敘述槽）、另名（typedef） | lang-core | 特定（C／C++） | `raw_code` | 與 `cpp:struct_declare` 平行；**不併成 struct 的一個選項**——語義不同（成員共用儲存、一次一個作用中），Sc3 一個積木一個語義概念 |

既有元件的延伸（不是新身分）：

| 延伸 | 在哪 | 內容 |
|---|---|---|
| 型別文字 `union U`（C）／`U`（C++，宣告過的 union 名） | `providers/cella/formalize` 的 `type()` | → `tUnion{name}`；名字由 `definesUnion`（或同 struct 的登記）收 |
| `typedef union [Tag] { … } Alias;` | `cpp:typedef` 的 lift-strategy | 同 341 的 typedef struct：交給 union 的 lift、記 `typedef_alias` |

## 依賴關係
- 成員宣告沿用 `var_declare`／`array_declare`（同 struct）
- 成員存取沿用既有的 `.`／`->`

## 建議實作順序
1. `cpp:union_declare` 膠囊（lift／generate／render／extract／formalize：頂層 iUnion、區塊內 sType+tdUnion）
2. formalize 的型別 `union U` → tUnion
3. typedef union（沿 341）

## 跨語言對應
- Python：無（`ctypes.Union` 不是語言構造）——不做

## 需注意的邊界案例
- **匿名 union**（struct 裡的 `union { int i; float f; };`）：成員直接掛在外層——照實降級（raw_code）
- **union 帶建構子／成員函式**（C++）：照實降級
- 讀非作用中的成員：Cella 判 unknown（不是 reject）——測試要斷言這個判決，不要寫成「錯」
- C 目標產碼：`union U u;` 要保留 `union` 關鍵字（同 `collectStructNames` 對 struct 的處理）；C++ 可省略
- 初始化 `union U u = { 65 };`（只初始化第一個成員）與指名 `{ .c = 'x' }`：Cella 說 union 的指名初始化判 unknown

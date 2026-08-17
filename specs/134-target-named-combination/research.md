# Research：目標（target）

**Date**: 2026-08-17

本檔只記**查證過的地面真相**與**它推翻了什麼**。所有行號可 grep。

---

## Q1（checklist 的第一個問題）：目標住哪一層？

### 既有的兩個同族東西怎麼放的

```
型別        src/core/types.ts:699  Topic ／ :593  StylePreset      ← 都在【核心】
登錄表      src/core/topic-registry.ts                            ← 核心
資料        src/languages/cpp/topics/*.json ／ styles/*.json      ← 【語言套件】
風格的邏輯   src/languages/style.ts                                ← 語言套件
```

### 而中立性護欄實際上禁的是兩件事，都不禁型別

`tests/integration/audit-neutrality.test.ts:104-111` 逐字：

> 「P9 的原文是『拔掉 C++ 之後，核心**無 `languages/cpp/` import**』。
> 本護欄原本只數**概念身分字串**——一個核心檔直接 import 語言套件，
> 它一個字都看不到。」

```
禁 ①  核心檔裡出現【概念身分字串】（`cpp:xxx`）
禁 ②  核心檔 import `languages/…`
不禁   核心裡有一個【型別介面】——`Topic`／`StylePreset` 今天就在那裡
```

### 決策 1：**型別在核心，資料在語言套件**——照 `Topic`／`StylePreset` 的先例

```
src/core/types.ts            interface Target { … }        型別
src/core/target-registry.ts  登錄與查找                     ⚠️ 照 topic-registry 的形狀
src/languages/cpp/targets/   cpp.json ／ c.json             資料
```

- **Rationale**：這不是一個新的擺法，是**第三個同族的東西照前兩個擺**。
  ⚠️ 而那正是 spec FR-002（不新增機制）的實作面意義：
  **連「放在哪裡」都不發明新的**。
- **Alternatives considered**：
  - **全部塞進語言套件** ❌ 那樣 UI 要 import 語言套件才拿得到型別
  - **目標自己帶資料**（不引用課程清單／風格） ❌ **那就變成新的抽象層了**
    ——spec US2 直接禁止

---

## Q2：標頭名對映表——**幾筆？**

### 🔴 查證結果：**不是 10 筆，而「幾筆」取決於一個沒問過的問題**

實測今天的元件宣告了哪些標頭：

```
grep requires  → 元件宣告的標頭名，全部是 C++ 形式（<iostream>／<vector>／<cstdio>…）
```

⚠️ 而 `c*` 那一族（C++ 對 C 標準庫的包裝）**才有兩個名字**：

```
<cstdio>   ↔ <stdio.h>      <cstring>  ↔ <string.h>
<cstdlib>  ↔ <stdlib.h>     <cctype>   ↔ <ctype.h>
<cmath>    ↔ <math.h>       <ctime>    ↔ <time.h>
…
```

**而 `<iostream>`／`<vector>`／`<string>` 在 C 裡【根本不存在】——它們不是對映，是缺席。**

### 決策 2：對映表**只收 `c*` 那一族**，而**不存在**的那些是另一件事

```
有兩個名字   <cstdio> → <stdio.h>         → 對映表
只有 C++ 有   <iostream>／<vector>         → 🔴 那些概念在 C 目標下【不該可見】
                                             ——而那是 `visible`（課程清單）的責任，不是對映表的
```

> **「同一個東西的兩個名字」與「一個東西在那個世界不存在」是兩件事，
> 而把它們塞進同一張表，會讓表變成一個什麼都能放的地方。**

### ✅ 而數字數出來了——**不是「約 10 筆」，是 5 筆**

實測全部 189 顆膠囊的 `requires`，**共 18 種標頭**：

```
🔴 有兩個名字（c* 族）  5 種
   <cstring> 10顆　<cstdlib> 6顆　<cctype> 4顆　<cmath> 3顆　<cstdio> 2顆

⚠️ 在 C 裡【不存在】     13 種
   <string> 18顆　<algorithm> 10顆　<iostream> 5顆　<vector> 5顆
   <numeric> 5顆　<queue> 5顆　<map> 3顆　<set>／<stack>／<utility>／
   <fstream> 各 2顆　<sstream>／<stdexcept> 各 1顆
```

> **「約 10 筆」估多了一倍，而更重要的是：18 種裡有 13 種根本不是對映問題。**

⚠️ 那 13 種正是 spec 的 Edge Case「一個程式同時用到兩種只有一邊有的東西
→ 不該進分母」——**它們是 `visible` 的責任**。
而 `c-style-parity` 的「中性語料」篩選（`:79`）今天已經在做這件事。

（`build-guardrail`：「一叢違規看起來像一個根因，而那是假設不是結論」
——本輪把「一族對映」拆成了 5 ＋ 13。）

---

## Q3：「切換不改語義樹」怎麼驗？

### 查證：這個專案**沒有**一個現成的「語義樹逐節點比對」

`roundtrip-*` 系列比對的是**個別節點的屬性**
（`expect(node!.properties.key_type).toBe('string')`），
**不是整棵樹**。

### 決策 3：用**同一棵樹**，而不是比對兩棵

```
❌ 產生兩棵樹再比對      要發明一個序列化與比對法
✅ 【同一個樹物件】投影兩次   而「它沒被改到」由物件同一性保證
```

**做法**：`lift` 一次 → 用目標 A 產出 → 用目標 B 產出 → 斷言兩次產出不同，
**而中間沒有任何 lift**。

> **「切換不改語義樹」最強的證明不是「比對後相同」，是【根本沒有第二棵樹】。**

⚠️ 而 `c-style-parity.test.ts` **已經是這個形狀**（同一棵樹兩種投影）
——本輪只是換成用目標選，不發明新做法。

---

## 決策彙總

1. **型別在核心、資料在語言套件**——照 `Topic`／`StylePreset` 的先例，不發明擺法
2. 🔴 **對映表只收 `c*` 那一族**——「不存在」是 `visible` 的責任，不是對映表的
3. **用同一棵樹投影兩次**——不發明序列化比對

---

## 風險與對策

| 風險 | 出處 | 對策 |
|---|---|---|
| 🔴 目標長成新抽象層 | spec US2、五次「機制有了沒人接上」 | SC-005：每個欄位說得出「今天住在哪裡」 |
| 對映表變成什麼都能放的地方 | 本檔 Q2 | 只收「有兩個名字」的；不存在的走 `visible` |
| 為了修 C 而弄壞 C++ | spec US3 場景 2 | `c-style-parity` 兩邊都跑 |
| 🔴 **編得過的漏網測不出來** | spec Edge Cases | ⚠️ 對映表要**逐筆列出**，而不是靠編譯結果反推 |
| 核心 import 語言套件 | 中立性護欄禁 ② | 登錄表用**注入**不用 import——⚠️ 照 `topic-registry` 的做法 |


---

## 🔴 Q4（實作時才現形）：**沒有任何既有欄位標得出「這是 C」**

plan 原本假設「②（修 6/10）在③（target）之前——`c-style-parity` 不需要
target 就修得到」。**動手時發現那是錯的。**

四個 style 的欄位實測：

```
id           io       namespace  header      naming
apcs         cout     using      individual  camelCase
c            printf   explicit   individual  snake_case
competitive  printf   using      bits        snake_case
google       cout     explicit   individual  snake_case
```

```
io: printf          🔴 競賽也是——而它是 C++
namespace: explicit 🔴 google 也是——而它是 C++
兩者的合取          今天只有 c 命中，而那是【巧合，不是宣告】
```

> **一個靠既有欄位「合取」推出來的身分，不是一個身分——
> 它只是今天剛好沒有別人命中。**

### 決策 4：**規則錨在 `target.id`，而不是推論 style 欄位**

```
❌ style.io === 'printf' && style.namespace === 'explicit'   脆弱的推論
✅ target.id === 'c'                                        具名的宣告
```

⚠️ **而這反轉了 plan 的實作順序**：US3（修 6/10）**依賴** US1/US2（target 存在）。

🔴 **而它同時解釋了 `target` 為什麼一直是需要的**：
`draft` 說它「把三個既有欄位綁成一個具名的組合」——
**而「具名」不是便利，是那個組合【本身就是一個身分】**。
沒有名字的時候，只能靠合取去猜它。

⚠️ **而 spec 把 `provides` 排除在本輪之外是對的**：
「C99 的 `bool` 要 `<stdbool.h>`」在完整設計裡是 `provides` 的事，
而本輪用 `target.id` 直接判是一個**刻意的簡化**——
**那個限定要寫進程式碼**，否則下一個人會以為 `provides` 已經做了。


---

## 🔴 Q5（實作時第二次現形）：**那張對映表已經存在，而且是 19 筆**

research Q2 說「標頭名對映表**今天不存在**」，spec 的 Key Entities 也把它列為
「本功能唯一新增的**資料**」。**兩者都錯了。**

`src/languages/cpp/header-aliases.ts` 逐字：

> 「C-style ↔ C++-style header equivalence mapping.
> When the user writes `#include <stdio.h>`, auto-include should recognize
> it as equivalent to `<cstdio>` and not add a duplicate.」

**19 筆，C → C++ 方向**（`stdio.h → cstdio`、`stdbool.h → cstdbool`…）。

### ⚠️ 而我兩次查證都沒找到它，理由值得記

```
第一次   grep requires        → 只看到元件宣告的【C++ 名字】，看不到對映
第二次   數 c* 那一族          → 數的是【元件宣告了什麼】，不是【系統認識什麼】
```

> **「這個東西存在嗎」與「這個東西被誰宣告」是兩個問題，
> 而我兩次都問了第二個。**

🟢 **所以本功能新增的資料是【零】**——只需要用**反向**查那張既有的表。
⚠️ 而那讓 spec 的 Key Entities「標頭名對映……今天不存在」**要更正**。

# 概念探索：C++ — `bitset`（一排位元）

2026-09-19｜分支 `199-cpp-bitset`｜語料 **3 支**

## 摘要

| | |
|---|---|
| 目標 | `<bitset>`——語料 3 支（`AP325/2/2_7_TLE` · `AP325/3/3_11` · `tioj/25_toj126`） |
| 🟢 **新身分** | **1 顆**（`cpp:bits_declare`）＋ **1 顆**（`cpp:bits_clear`） |
| 🟢 **不必新增身分的** | 索引讀寫 · 位元運算子 · `.count()`（**全部由既有的東西吃下**） |
| 🟢 **新詞彙** | **0 個**——`bits`／`declare`／`clear`／`count` 全在表裡 |
| 歸屬 | `cpp-advanced` 的 `L1a: 陣列與排序`（它是「一排固定長度的格子」） |

> **這一族最值錢的發現是：它需要的東西，四分之三已經在了。**

## 先決問題：修好 bitset 之後那三支就跑得完了嗎

**三支的全文都讀過**，除了 bitset 之外用到的東西今天都支援：

| 檔 | 還缺什麼 | 其餘 |
|---|---|---|
| `3_11` | `bs[i]` 讀 ＋ 寫 | `max`／陣列／`cin` 🟢 |
| `25_toj126` | `.reset()` · `bs[i]=1` · `bs>>x\|bs<<x` · `bs[x]==1` | `ios::sync_with_stdio`／`cin.tie` 🟢 |
| `2_7_TLE` | 一陣列的 bitset · `.reset()` · `d1[i][j]=1` · `d1[i]^d1[j]` · `.count()` | `getline`／`x[j]-A` 🟢 |

🟢 **判斷：三支都跑得完。** 而它不是推的——見下面 ② 的實測。

⚠️ `2_7_TLE` 是 O(n²) 且檔名寫著 TLE，而**測資是探針自己生的**（n 很小），
所以複雜度不是問題。

## ① `bitset<N>` 的樣板引數是一個【數字】——它該走哪一條 lift

**查證**（`src/languages/cpp/lang/lifters/strategies.ts:964` 起）：
共用那條容器宣告的路，樣板引數是這樣讀的：

```ts
const innerType = templateArgs ? templateArgs.text.slice(1, -1).trim() : 'int'
…
: { type: innerType, name: nm }
```

🔴 **那條路的契約是「樣板引數是型別」**。`bitset<26>` 走進去會得到
`type: "26"`——**把一個大小裝進一個叫 `type` 的字串屬性**，而第七十二條護欄
（字串屬性不得裝結構）正在追的就是這一族。

🟢 **而這個 repo 已經有「大小」的正確形狀**，而且是**接點不是屬性**：

```
cpp:array_declare      properties: [type, name]   slots: { size: expression, values }
cpp:array_2d_declare   properties: [type, name]   slots: { rows, cols, values }   ← 第 190 刀把維度從屬性換成接點
```

🔴 **判準是「它在執行期是什麼」**：`bitset<26>` 是**26 格固定長度**
——那與 `int a[26]` 同形，不與 `vector<int> v(26)` 同形（後者可以長大）。

> **決定：`cpp:bits_declare` 走自己的 lift，形狀抄 `cpp:array_declare`
> ——`properties: [name]`、`slots: { size: expression }`。
> 不登錄進 `registerContainerTemplate`。**

⚠️ **而「不登錄」有一個代價要確認**：方法分派靠的是「宣告時記下來的型別」，
而那是**從身分推導**的（`container-templates.ts` 的 `recordedTypeIsDevice` 註解逐字：
`cpp:dht_declare` → `'dht'`）。`cpp:bits_declare` → `'bits'`，**與 C++ 的 `bitset` 不同名**
——實作時要確認方法分派讀的是哪一個。

## ② `bs[i] = 1` 需要代理物件嗎——🟢 **不需要，而這是實測的**

C++ 的 `bitset::operator[]` 回傳 `std::bitset::reference`（一個代理）。
在這個直譯器裡**不需要**，因為左值機制是**元件自己宣告**的
（`src/interpreter/lvalue.ts` 檔頭：「問角色不問身分……加一種新的左值形狀
**不改這個檔**」），而 `cpp:array_at` 早就有解析器。

**實測（今天就跑得過，一個字都沒改）**：

```
vector<vector<int>> d(2, vector<int>(3,0)); d[1][2] = 7;     g++ 70  我們 70  🟢
int d[2][3] = {}; d[1][2] = 7;                                g++ 70  我們 70  🟢
int d1[3][26] = {}; d1[0][x[j]-'A'] = 1;   ← 語料真正的形狀   g++ 11  我們 11  🟢
```

> **兩層索引當左值不是這一刀要做的東西——它已經在了。**

🟢 **所以 `bitset` 在執行期就是「一排只裝 0／1 的格子」**，而
`bs[i]`／`d1[i][j]` 走既有的 `cpp:array_at`，讀與寫都不必新增任何機制。

⚠️ **實測也解釋了今天的症狀**：`bitset<8> bs;` 現在 lift 成 **`cpp:var_declare`**
（一個純量！），所以 `3_11` 的 `bs[A[i]]` 去索引一個不是陣列的東西 → `INDEX_OUT_OF_RANGE 4`。

## ③ 位元運算子要吃 bitset——改在哪，以及不得弄壞什麼

**查證**（`src/components/cpp/arithmetic/execute.ts`）：它有**兩條數值路徑**
（bigint 一條、number 一條），`& | ^ << >>` 在兩條裡各一份。

🟢 **改法：在兩條之前加一個前置分支**——任一運算元是「一排位元」時走位元排的路。

```
bs | bs2    逐位元        兩排等長
bs ^ bs2    逐位元
bs & bs2    逐位元
bs >> x     整排位移      右移＝往低位，空出來的補 0
bs << x     整排位移
```

🔴 **不得弄壞整數那一路**，正向錨點（已實測，兩邊都是 `275123`）：

```cpp
int x=6,y=3; cout << (x&y) << (x|y) << (x^y) << (x<<1) << (x>>1);
```

⚠️ **而 `>>`／`<<` 有一個陷阱**：`cout << bs` 也是 `<<`。
那是 `cpp:print` 不是 `cpp:arithmetic`，但實作時要確認兩者分得開
——**⑥ 已經決定不做 `cout << bs`**，所以它應該誠實出聲，不是印出一個怪東西。

## ④ 要做哪些方法——判準，不是偏好

**判準**（從第 197 刀那次翻面來的）：

> **語料 0 處只說明「這批語料的人沒這樣寫」。
> 該問的是：【一個積木做得出來的東西，五路接不接得住】
> ——而那取決於它要不要多一格。**

```
不用多一格（方向／有無）   ⟹ 做。學生切過去就有，而它不佔版面
要多一格（多一個引數）     ⟹ 看語料 ＋ 盲測。多的那一格會常態留空
```

| 方法 | 語料 | 做？ | 理由 |
|---|---|---|---|
| `.reset()` | **2 處** | 🟢 **做** | 語料要 |
| `.count()` | **1 處** | 🟢 **做** | 語料要 |
| `.size()` | 0 | 🟢 **做** | **不多一格**，而它就是宣告時那個數字；同族 `container_size` 已存在 |
| `.any()` / `.none()` | 0 | 🟢 **做** | 不多一格，且是 `.count() > 0` 的自然說法；同族 `container_empty` 已存在 |
| `.set()`（無引數） | 0 | 🟢 **做** | **`.reset()` 的反面**——只做一半的話那顆積木說不出「全設成 1」 |
| `.flip()`（無引數） | 0 | 🟠 **做** | 同上，不多一格。⚠️ 而 `.flip(i)` 的**帶引數形式不做**（見下） |
| `.set(i)` / `.reset(i)` / `.flip(i)` | 0 | 🔴 **不做** | **多一格，而那一格會常態留空**；而 `bs[i] = 1` 是等價寫法且**今天就能跑** |
| `.test(i)` | 0 | 🔴 **不做** | 與 `bs[i]` 完全等價，而 `bs[i]` 語料 4 處、今天就能跑。**兩顆積木同一件事 = 認知負載** |
| `.to_ulong()` / `.to_string()` | 0 | 🔴 **不做** | 見 ⑥ |

🔴 **而「不做」的那幾個要在盲測那一關被檢查**——第 197 刀的教訓逐字：
**語料 0 處的判斷，盲測會告訴你對不對。**

## ⑤ 積木上的字

🟢 **「位元」這個詞在積木上早就用了**（查證，不是猜）：

```
U_ARITHMETIC_OP_BITAND   位元 AND（&）
C_BITWISE_NOT_MSG0       位元反轉 %1 (~)
C_ANALOG_RESOLUTION_MSG0 設定類比讀取解析度為 %1 位元
```

所以用它是**跟隨既有措辭**，不是發明。

| 鍵 | 中文 | 英文 |
|---|---|---|
| `bits_declare` MSG0 | `建立 %1 個位元的一排 %2` | `Create a row of %1 bits named %2` |
| `bits_clear` MSG0 | `把 %1 全部歸零` | `Clear every bit in %1` |
| `bits_count`（既有）MSG0 | `%1 的二進位中 1 的個數`（不動） | 不動 |

✅ 沒有 `bitset`／`reset`／`count()` 的語法
✅ 「迭代器」0 處 ✅ 「位元」是既有措辭

## 命名：**0 個新詞**

詞彙表查證（`src/languages/cpp/naming.ts`）：

```
bits 🟢在   declare 🟢在   clear 🟢在   count 🟢在   size 🟢在   set 🟢在
bitset 🔴   bit 🔴   reset 🔴   flip 🔴
```

🟢 **所以名字全部用既有詞**：`cpp:bits_declare`／`cpp:bits_clear`。

> **「找不到既有詞的時候，問題常常不是詞不夠」**——這裡正是那一條：
> 想寫 `bitset_reset` 要加兩個新詞，而 `bits_clear` 一個都不用，**而且更好讀**。

### 🔴 `.count()` 不是新身分——它是既有那顆多一個形態

**`cpp:bits_count` 已經存在**（`__builtin_popcount(x)`，「數這個整數二進位裡的 1」）。
`bs.count()` 做的是**同一件事**，差別只有**寫法**（內建函式 vs 方法）。

🟢 **前例一模一樣**：`cpp:container_iter` 的 `call` 屬性（`method`／`free`，第 188 刀）
——`v.begin()` 與 `begin(v)` 是同一顆身分的兩種寫法。

> **決定：`cpp:bits_count` 加一個 `form` 屬性（`builtin`／`method`）。
> 不新增身分、不新增詞。**

## ⑥ 不做什麼（每一條都有語料讀數）

| 不做 | 語料 | 理由 |
|---|---|---|
| `bitset<8>("1010")` 字串建構 | **0 處** | 它是「從字串長出一排位元」——**另一個語義動作**（解析），不是宣告 |
| `to_string()` | **0 處** | 需要「整排 → 字串」的表示層決定（要不要補前導零、長度） |
| `cout << bs` 印出整排 | **0 處** | 同上，而且它會與 `<<` 位移撞在同一個語法位置——**先把那個分得開再說** |
| `_Find_first()` | **0 處** | GCC 擴充，不是標準 |
| `.to_ulong()` | **0 處** | 只在 N ≤ 64 時有定義，而語料的 N 是 200007 |

## 五路完備性

| 路 | `cpp:bits_declare` | `cpp:bits_clear` | `cpp:bits_count`（改） |
|---|---|---|---|
| lift | 自己的 `lift.ts`（`template_type` 且樣板引數是數字） | 容器方法表 | 既有 ＋ 方法那一形 |
| generate | `bitset<size> name;` | `obj.reset()` | `x.count()` 或 `__builtin_popcount(x)` |
| render | 一格 `size` 接點 ＋ 一格名字 | 一格接收者 | 既有 ＋ 一格下拉 |
| extract | auto-derive | auto-derive | auto-derive |
| execute | 配置 N 格 0 | 全部寫 0 | 數 1（兩種來源） |

⚠️ 而**位元運算子與索引不是這三顆的路**——它們住在 `cpp:arithmetic` 與 `cpp:array_at`。

## 建議實作順序

```
1. cpp:bits_declare        ← 沒有它，其餘三件事都沒有對象
2. 位元運算子吃一排位元      ← cpp:arithmetic 的前置分支（25_toj126 卡在這）
3. cpp:bits_clear          ← 2_7_TLE 與 25_toj126 都要
4. cpp:bits_count 的方法形態 ← 2_7_TLE 要
5. .size()/.any()/.none()/.set()/.flip()  ← 語料 0，判準見 ④
```

**降級路徑**：`cpp:bits_declare` → D2 `cpp:var_declare`（**今天就是這樣**，而它是錯的：
一個純量接不住 `bs[i]`）→ D3 `raw_code`。

## 跨語言對應

Python 沒有 `bitset`。等價寫法是**整數的位元運算**（`x |= 1 << i`）或 `set`。
⚠️ 兩者都**不是一排固定長度的格子**，所以這不該升格成通用概念——
它是 C++ 特有的形狀（`lang-library`，`<bitset>`）。

## 需注意的邊界案例

1. 🔴 **`bitset<26> d1[50007]`——一陣列的 bitset。** `cpp:array_declare` 的元素型別
   是一個樣板型別。同族前例：`vector<int> ar[3]`（語料有，第 193 刀修過）。
2. 🔴 **`bs >> x` 與 `cout << bs` 在同一個語法位置**（`<<`）。分不開的症狀是
   印出一個怪東西而不出聲。
3. ⚠️ **越界**：`bs[26]` 在 `bitset<26>` 上是 UB。處置照同族——**讓索引那一顆出聲**，
   不要發明答案。
4. ⚠️ **大小是編譯期常數**：`bitset<n>` 的 `n` 必須是常數運算式。
   `slots.size` 接一顆變數積木時**產出的碼編不過**——要在 tooltip 說清楚。
   🟢 而那與 `cpp:array_declare` 是同一個既有問題（C++ 的 VLA 也不標準）。
5. 🟢 **大小不是效能問題**（實測）：`int A[200007]` 配置 **28 ms**、
   `int d[50007][26]` **80 ms**。

---

# 🔴 實作時改掉的三個決定（2026-09-19，階段二）

> **一份探索報告如果不記下它被推翻的地方，下一個讀它的人會照著錯的那一版做。**

## ① 「走自己的 lift.ts，不登錄 `registerContainerTemplate`」→ **改了**

報告說走自己的 lift。而**那會逼我去編輯共用檔**（`template_type` 的宣告只有共用那條路看得到）
——正是膠囊化要治的病。

🟢 **改成 `container-templates.ts` 自己的檔頭給的答案**：核心給機制、套件給資料。
共用檔加一格 `templateArgIsSize`，而它**從宣告推導**：

```
有 `size` 接點、而沒有 `type` 屬性  ⟹  這顆元件的樣板引數是一個大小
```

⚠️ 做法抄它隔壁的 `twoArgKeys`（「**問那顆元件自己宣告了什麼**」），
而不是在登錄表加第四個參數。

## ② `cpp:bits_clear` → **`cpp:bits_fill`**，而它吃三個方法

報告只規劃了 `.reset()`。而 `.set()`／`.flip()` 與它**引數個數（0）、接點、角色全同，
差別只有把整排變成什麼**——照元件代數 250 ⟹ **一顆身分 ＋ 一個參數**。

⚠️ 而那個參數**必須叫 `method`**，那不是取名品味，是機制：共用的方法路由靠
`declaresMethodProp(componentId)` 把**使用者寫的那個方法名**填進 `properties.method`。
第一版取名 `mode`（值 `zero`／`one`／`flip`），於是那一格**從來沒有被填過**。

> **症狀不是報錯：`bs.set()` 安靜地把整排歸零。**

## ③ `bits_count` 的 `form` 屬性——做了，而**插槽要改名**

報告說「一顆身分 ＋ 一個 `form` 屬性」，前例 `container_iter.call`。做了，
**而報告沒看到的一件事**：方法那一路把接收者放進 **`obj`**（由宣告決定，
`io.ts` 的 `receiverInto`），而 `cpp:bits_count` 的插槽叫 `value`。

於是 `bs.count()` 的接收者掉進 `properties.obj` 一串文字，**執行時數出 0 而不出聲**。

🟢 插槽改名 `value` → `obj`（兩種寫法都填它，與 `begin(v)`／`v.begin()` 同形），
內建那一形改用 `registerCallComponent` 指定槽名，舊存檔由 `SHAPE_CHANGES_V23` 處理
（`CURRENT_VERSION` 22 → 23）。

# 🪦 一根釘子：`d1[i].reset()`

依型別分派那張表是**用接收者的原文去查名字**的，而 `d1[i]` 不是名字。

🔴 **第一版的修法是把三個名字也登錄到「以名字為鍵」那一張，而那是錯的**
——那會讓**任何**接收者的 `.reset()` 都被搶走，包括型別查不到的。
抓到它的是既有的「零引數的方法不得憑空多出插槽」那條護欄。

> **型別查不到時不猜——留在通用版。
> 猜一個錯的專屬身分比誠實降級更糟。**（`method-components.ts` 的原話）

**何時該修**：宣告表記得住**陣列的元素型別**的那一天。那是整族共同的限制。

# 讀數（階段二結束）

```
語料四個面向   同一棵 218／走樣 0 · 載不進去 0 · 身分 120 → 123 缺 0
               兩邊都跑完 159 → 161｜一致 153 → 155｜內容真的不同 3（不動）｜解譯器出錯 12 → 10
全套           7576 → 7611 綠（0 紅）· tsc 乾淨 · 孤兒 0
最小重現       183 → 199 條（＋16，拿 g++ 當權威）
膠囊自證       ＋15 支
```

⚠️ **`AP325/2/2_7_TLE` 仍然出錯，而那不是缺陷**：探針生的測資讓
`d1[i][x[j]-'A']` 的索引跑到 34（`x` 不是大寫字母），而 `bitset<26>` 上索引 34 是 UB。
🔴 **而消毒器證不出來**（實測：g++ 印 1、UBSan／ASan 一個字都沒印——`bitset::operator[]`
沒有邊界檢查）。照 `history/256` 的規矩，**沒有外部權威就不從缺陷欄搬走**——它留在計數裡。

# 概念探索：C++ — 容器的兩端、有序查找、以及「允不允許重複」

## 摘要

- 語言：cpp
- 目標：`deque` 的前端操作、`set`/`multiset` 的 `lower_bound` 方法形式、重複性那一軸
- **來源不是文件，是量測**：使用者學生的 218 支競賽練習，拿 g++ 比對執行結果，
  14 支撞在這一族（見 [history/241](../../knowledge/history/241-第五個面向.md)）
- 發現概念總數：**2 個要做、1 個明確不做、1 個是既有元件的缺陷**

## 🔴 先講一件探索本身掀出來的事：那張表已經按位置碎掉了

把 `registerContainerMethodComponent` 全部列出來之後，今天的登錄表長這樣：

```
back       → cpp:vector_back        front      → cpp:queue_front
pop        → cpp:container_pop      pop_back   → cpp:vector_pop
push       → cpp:container_push     push_back  → cpp:container_append
top        → cpp:stack_peek         insert     → cpp:set_insert
size       → cpp:vector_size        erase      → cpp:container_erase
count      → cpp:container_count    empty      → cpp:container_empty
clear      → cpp:container_clear
```

兩件事看得很清楚：

**① 這張表的鍵是【方法名】，不是概念。** 所以 `pop` 與 `pop_back` 已經是兩個身分。
**② 名字會騙人。** `cpp:vector_back` 是**所有容器**的 `back` 的主人，
`cpp:queue_front` 是所有容器的 `front` 的主人，而 `cpp:set_insert`
是**所有容器**的 `insert` 的主人——③ 那個缺陷就是從這裡來的。

> **一個以「方法名」為鍵的登錄表，元件名叫什麼都不影響它的行為
> ——於是名字會慢慢變成一句沒有人維護的話。**

⚠️ 原理說「位置不是身分，是形態」（`concepts/元件代數.md:236`），
而**今天的實作不是那樣**。要收斂成「一個身分 ＋ 哪一端那一軸」是一刀
**獨立的整併**（要動 7 顆元件、它們的積木與課文對照圖）。

🔴 **這一刀不做那個整併**，理由是：整併與「補上缺的操作」混在一起的話，
出事時分不出是哪一邊造成的。新的兩顆**照今天的慣例走**，而這個氣味記在這裡。

## 概念目錄

### 要做：容器的前端操作 — 中級（`L2` 資料結構）

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 語料 |
|---|---|---|---|---|---|---|---|
| `cpp:container_pop_front` | `dq.pop_front()` | 把**最前面**那個拿掉 | 1（容器） | lang-library | 特定 | `raw_code` | **18 支** |
| `cpp:container_push_front` | `dq.push_front(x)` | 從**前面**放進去 | 2（容器、值） | lang-library | 特定 | `raw_code` | 1 支 |

**為什麼是新身分而不是既有元件的新形態**：這張表以方法名為鍵，而
`pop`／`pop_back` 今天就是兩個身分。新的兩顆若做成形態，要先把那 7 顆整併
——見上一節，那是另一刀。

⚠️ **命名刻意用 `container_` 而不是 `deque_`**：它們對 `deque` 與 `list` 都成立，
而今天那張表的教訓正是「名字寫了某一種容器，行為卻涵蓋全部」。

### 明確不做：`lower_bound` 的方法形式 — 理由是它一個人到不了終點

| 概念 | 語法 | 為什麼不做 |
|---|---|---|
| `set::lower_bound` | `st.lower_bound(x)` | **回傳迭代器**，而我們沒有迭代器 |

實測那兩支（`AP325/2/2_11_AC.cpp`、`AP325/4/4_15_2t.cpp`）除了 `lower_bound`
還用了：

```
it != st.end()    2 次
*it               1 次
it->second        2 次
```

**補了 `lower_bound` 之後，錯誤只會往後挪一行。**

> **一個概念如果它的產出沒有人接得住，補上它不會讓任何一支程式跑起來
> ——它只會讓失敗的位置往後移。**

🟠 迭代器（`begin`／`end`／`*it`／`it->`／`prev`／`next`）是**另一刀**，
而它的大小要另外量：語料裡 `.begin(` 33 次、`.end(` 30 次。

### 🔴 既有元件的缺陷：`insert` 對每一種容器做同一件事

`cpp:set_insert` 是「`insert` 這個方法名」的唯一主人，而它的實作是
**去重 ＋ 排序**。於是：

```
multiset<int> ms;  ms.insert(3);  ms.insert(3);    g++ 兩個 ／ 我們一個
vector<int> v;     v.insert(v.begin(), 3);         C++ 是【定位插入】，而我們去重排序
```

而 `multiset` **根本沒有被登錄成容器樣板**（`registerContainerTemplate`）。

語料規模：`multiset<` 13 支、`.insert(` 17 支。

#### 「允不允許重複」住在哪裡——拍板：**住在容器的宣告上**

理由是 C++ 自己的判準：同一個方法名 `insert`，行為由**接收者的型別**決定，
不由方法決定。所以：

```
宣告那一側   set → unique: true   ／   multiset → unique: false
insert 那一側 讀它，不自己決定
```

⚠️ **不是**把 `insert` 拆成兩顆（`set_insert`／`multiset_insert`）：
那會讓同一個方法名有兩個主人，而登錄表會當場拒絕（它逐字寫著
「不自動取其一——靜默覆蓋的症狀是『某個方法被辨識成另一個概念』」）。

> **同一個名字在不同容器上做不同的事，那個差別屬於容器，不屬於名字。**

🟠 **而 `vector.insert` 的定位插入這一刀不做**：它的引數是迭代器
（`v.insert(v.begin()+i, x)`），同樣卡在迭代器那一關。記在這裡。

## 依賴關係圖

```
container_pop_front   ← 無（與 container_pop／vector_pop 平行）
container_push_front  ← 無（與 container_append 平行）
set_insert 的重複性軸  ← set_declare 要先知道自己是 set 還是 multiset
                        ← multiset 要先被登錄成容器樣板
```

## 建議實作順序

1. **`multiset` 登錄 ＋ 重複性軸**（既有元件的缺陷，13 支語料，而且它是「錯的答案」
   不是「跑不動」——錯的答案比跑不動危險）
2. **`cpp:container_pop_front`**（18 支，最大的單一收穫）
3. **`cpp:container_push_front`**（1 支，而它與 ② 是同一族，一起做比較省）

## 跨語言對應

| C++ | Python | 備註 |
|---|---|---|
| `dq.pop_front()` | `dq.popleft()` | `collections.deque`；Python 那側今天也沒有 |
| `dq.push_front(x)` | `dq.appendleft(x)` | 同上 |
| `multiset` | `collections.Counter` | 語義不同，不對應 |

🟠 兩顆新元件**先做 C++**。Python 的 `deque` 在語料裡沒有出現，
而「因為對稱所以一起做」不是需求。

## 需注意的邊界案例

- **空容器上 `pop_front()`** 是未定義行為。⚠️ 判準裡不得放 UB
  （`interpreter-matches-compiler.test.ts` 的檔頭記過：一條拿參照實作當權威的護欄，
  不得把「它也沒有答案的地方」寫進判準）。我們的選擇要**出聲**，不要靜默。
- **`multiset` 的 `erase(x)`** 在 C++ 裡刪掉**全部**等於 x 的，而
  `erase(iterator)` 只刪一個——🟠 這一刀不碰 `erase`，記在這裡。
- **`set_declare` 今天的 `name` 屬性**：加重複性那一軸時要確認它不影響存檔
  （既有存檔裡的 `cpp:set_declare` 沒有那個屬性，要有預設值）。

## 🔴 瀏覽器驗收才看到的一格：`deque` 的宣告沒有身分

2026-09-17，管線 179 的第六關（`verify-in-browser`）。兩顆新積木四項驗收全過，
而把一段真的程式貼進去之後，畫面上多出一件**任何測試都不會問的事**：

```
deque<int> dq;      → 🟠 橘色的「宣告 deque<int> 變數 dq」（cpp:var_declare）
dq.push_front(5);   → 🔵 藍色的「在 dq 前端加入 5」
```

而 `vector`／`queue`／`stack`／`priority_queue` **四個都有自己的藍色宣告積木**。
於是在同一疊積木裡，**造出 dq 的那一行與操作 dq 的那幾行是兩個顏色**
——顏色是分類的視覺編碼，學生讀到的是「第一行不是容器」。

更硬的一面：工具箱的「堆疊與佇列」拿得到「移除 dq 前端元素」，
**而拿不到造出 `dq` 的積木**。學生只能從程式碼那一側造出 deque，
再回來用這兩顆——那條路不是積木使用者的路。

> **「新積木拿不到」有一個對偶：操作拿得到，而它的宣告拿不到。**
> 可拿性護欄兩邊都量不到——它問的是「宣告了的拿不拿得到」，
> 而這裡缺的東西**根本沒有被宣告**。

⚠️ **為什麼探索沒問到**：管線的輸入逐字點名「前端操作」，
而探索照著目標走。宣告不在目標裡，所以它連「要不要做」都沒有被問。

🟠 **這一刀不做**（補一顆 `cpp:deque_declare` 是一次完整的管線，
而且它會連帶碰到 `registerContainerTemplate` 的樣板名登錄）。記在這裡當下一刀的入口。

## 🔴 補量：容器樣板的登錄表有幾個洞（2026-09-17）

第 ③ 項動工時順手把整張登錄表對著語料數了一次——**而那張表比想像中漏得多**：

| 樣板名 | 語料 | 登錄了嗎 | 今天的症狀 |
|---|---|---|---|
| `vector` | 51 支 | 🟢 | |
| `pair` | 27 支 | 🟢 | |
| **`deque`** | **22 支** | 🔴 **沒有** | 執行起來**是對的**（掉到一般變數宣告，而那條路把樣板型別當陣列）；壞的是**畫面**：橘色的變數積木，而它的操作是藍色的 |
| `priority_queue` | 14 支 | 🟢 | |
| **`multiset`** | **13 支** | 🔴 沒有 | `insert` 去重 ⟹ **少一半元素**，程式照常跑完 |
| **`unordered_map`** | **5 支** | 🔴 沒有 | `m[3] = 7` 被當成陣列的第 3 格 ⟹ `INDEX_OUT_OF_RANGE`，**錯誤指著學生沒寫錯的那一行** |
| `set` | 4 支 | 🟢 | |
| `bitset` | 3 支 | 🔴 沒有 | 🟠 另一刀：它的樣板引數是**一個值**（`bitset<32>`），不是型別 |
| `queue`／`stack` | 各 2 支 | 🟢 | |
| `map` | 1 支 | 🟢 | |
| `list`／`unordered_set`／`multimap`／`array` | **0 支** | 🔴 沒有 | 🟠 **不做**：語料量到零。「因為對稱所以一起做」不是需求 |

🔴 **兩個洞的嚴重度差一個量級，而語料大小的排序把它顛倒了**：

```
deque         22 支   跑起來是對的  →  是 UX 缺口
multiset      13 支   少一半元素    →  是錯的答案
unordered_map  5 支   指錯行報錯    →  是錯的答案
```

> **「有幾支程式用到」量的是曝光，不是傷害。
> 排優先序要先問「它錯的時候，使用者看得出來嗎」。**

🟢 **這一刀做掉 `multiset` 與 `unordered_map`**（兩個都是「錯的答案」），
而它們用的是同一個機制：樣板名登錄時附帶屬性，資料回膠囊。
🟠 `deque` 的宣告排在下一刀（見上一節）。

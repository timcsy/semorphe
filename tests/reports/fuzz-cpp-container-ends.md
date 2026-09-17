# 模糊測試報告 — C++ — 容器的兩端（2026-09-16）

## 摘要

- 語言：cpp ／ 難度：medium ／ 範疇：containers
- 產生的程式數：**10**（隔離 worktree 的代理所寫，看不到原始碼）
- 成功編譯執行（g++ -Wall，跑兩次一致）：**10**
- **程式碼 round-trip**（lift → generate → 編 → 跑）：**10/10 PASS**
- 🔴 **解譯器**（第五個面向）：**1/10 → 4/10**
- 找到 bug：**4**（全部當場修好）／ 還開著：**4**（`it.todo`，各附理由）

> **隔離是有作用的，不是形式**——我自己寫的七條自證測全綠，
> 而一個不知道實作長什麼樣的人，第一批就問出四個我沒想到的形狀。

⚠️ 而 **round-trip 10/10 與解譯器 1/10 的落差本身就是一個發現**：
形狀全對，而它印出來的是別的東西。那正是[第五個面向](../../knowledge/history/241-第五個面向.md)的形狀。

## 找到並修好的 bug

### 1. 傳值進函式沒有複製（SEMANTIC_DIFF，5 支受影響）

```cpp
int drain(deque<int> d){ int n=0; while(!d.empty()){ d.pop_front(); n++; } return n; }
deque<int> dq; dq.push_back(1); dq.push_back(2);
drain(dq);  cout << dq.size();        // g++ 2  ／  我們 0
```

`func_call` 的參數綁定是 `scope.declare(param.name, val)`——**val 是呼叫端那個物件本身**。

> **「傳值」與「傳參考」的差別，在解譯器裡就是「有沒有複製」這一個動作
> ——少了它，兩者的行為完全相同，而語言的宣告變成一句空話。**

🟢 修法：`src/interpreter/clone.ts`（中立的值語義複製），非參考參數走它。
順帶把 `vector_declare` 裡那份逐字相同的 `cloneValue` 併過來。

### 2. 🪦 而我第一版修過頭：陣列參數被複製了

```cpp
void feed(deque<int> b[], int v){ b[1].push_back(v); }   // C++ 裡它退化成【指標】
```

模糊測試當場抓到：一支本來通過的程式退步了。

> **一個「傳值就複製」的規則，在陣列參數上是錯的——那是語言的例外，不是我的選擇。**

### 3. 不知道元素型別就假裝是 int

```cpp
deque<string> d; d.push_back("ab"); cout << d.front();   // g++ ab ／ 我們 0
```

`container_append` 寫著 `arr.elemType ?? 'int'`，而 `deque` 至今沒被登錄成容器樣板，
所以它的 `elemType` 是空的——字串被 `coerceType(…, 'int')` 壓成 0。

> **一個「不知道就用預設值」的回退，在預設值剛好是別的型別時不會報錯
> ——它會安靜地把資料換掉。**

### 4. 帶下標的宣告子被字串那一支認領

```cpp
string w[3];               // 🟢 array_declarator，array_declare 接走
string w[3] = {"a","b"};   // 🔴 init_declarator ← 裡面才是 array_declarator
```

`claimsSimpleDeclarator` 只看最外層，於是名字被抽成整串 `w[3]`，`w` 根本沒被宣告。

> **一道只看最外層形狀的閘，會在「同一個形狀多包了一層」時失效
> ——而多包的那一層正是「它有初始值」。**

## 順帶拆掉的一份第二真相

`io.ts` 的 `METHODS_WITH_ARG` ＋ `METHOD_CHILD_SLOT` 兩張手寫表，
與元件自己的 `slots` 宣告**逐字相同**（`value`／`key`）。
新元件宣告了 `slots: { value }` 而表裡沒有它的名字 ⟹ **引數在 lift 時被丟掉**。

> **一顆元件已經說過自己有幾個接點了。共用檔再說一次，就多了一個會忘記更新的地方
> ——而它忘記的那天不會報錯，只會少一個引數。**

## 還開著的（`it.todo`，各附理由）

| 形狀 | 為什麼不是現在修 |
|---|---|
| `hands[i % P].push_back(x)` | 接收者被壓成字串，算下標需要一份文字的算式求值器——這個 repo 有明文反對。真語料 218 支裡**一處都沒有**，所以先把錯誤訊息說對，不先補洞 |
| `rows.front().push_back(9)` | 同一個根，與上一條一起修，不要各修一半 |
| `deque<char>` 傳值後長度不對 | 複製已修，而還有別的差異沒查清楚——**根因未定位前不動它** |
| 巢狀容器的索引越界（格子 BFS） | 根因未定位 |

🟢 全部留在 `tests/integration/fuzz-cpp-container-ends.test.ts`，
修好的是真測試、沒修的是 `it.todo`——**沒有「發現問題卻不留測試」的**。

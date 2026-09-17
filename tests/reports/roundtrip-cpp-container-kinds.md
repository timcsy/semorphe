# Round-Trip 測試結果：C++ — 容器的重複性與有序性兩軸

- 日期：2026-09-17
- 目標：`cpp:set_declare` 的 `unique` 軸（`set`／`multiset`）、
  `cpp:map_declare` 的 `ordered` 軸（`map`／`unordered_map`）
- 語料：使用者學生的 218 支競賽練習，其中 `multiset<` **13 支**、`unordered_map<` **5 支**

## 真語料（那 18 支）

| 面向 | 結果 |
|---|---|
| ① lift 認得（不落殘差） | **18/18** |
| ② 產碼保住種類（multiset 不變 set、unordered_map 不變 map） | **18/18** |
| ③ 語義不動點（再 lift 是同一棵樹） | **18/18** |

## 🔴 而這個 18/18 有一半是假的安慰——值得寫下來

①②③ 在**修之前也會是綠的**。沒登錄的樣板會掉到一般變數宣告那條路，
而那條路**原樣保留型別文字**：`multiset<int> st;` 進去，`multiset<int> st;` 出來。

```
              修之前          修之後
語義樹身分     cpp:var_declare   cpp:set_declare（unique: 'false'）
產出的文字     multiset<int>     multiset<int>        ← 一模一樣
跑出來         少一半元素        對
```

> **一個容器被當成別的東西處理時，它的【文字】可以是完美的。
> 分得出來的只有兩樣：語義樹裡的身分，與跑出來的東西。**

所以常駐測試的重量放在**身分斷言**與**行為**，而不在產碼。
⚠️ 這也是一個對「面向」這張表本身的補充：①②③ 三個都是形狀，
而**形狀對「認錯了」保持沉默**——那正是 `knowledge/history/241` 的結論再一次成立。

## 蒸餾出來的常駐測試

`tests/integration/roundtrip-cpp-container-kinds.test.ts`（8 支，全綠）

| # | 驗什麼 | 結果 |
|---|---|---|
| 1 | 身分：`multiset` 走集合那顆元件，且 `unique: 'false'` | ✅ |
| 2 | 身分：`unordered_map` 走對照表那顆元件，且 `ordered: 'false'` | ✅ |
| 3 | 產碼：種類不得被換掉 | ✅ |
| 4 | 語義不動點 | ✅ |
| 5 | **存檔相容**：屬性不存在時，產碼與執行**兩條預設路**都當它是去重的 | ✅ |
| 6 | 行為：`multiset` 與 g++ 一樣（插入 5 個含重複，印 size ＋ 有序走訪） | ✅ |
| 7 | 行為：`unordered_map` 與 g++ 一樣（`mp[x]++` 數次數） | ✅ |
| 8 | 行為：字串當鍵（語料 `21_toj55_2` 的形狀） | ✅ |

`tests/integration/roundtrip-l2.test.ts` 另加 4 支：兩顆各驗
「產碼不得換種類」與「**舊存檔（沒有那一格）仍然渲染得出來、抽得回去**」（面向③）。

## ⚠️ 判準裡刻意沒有的

🔴 **沒有任何一題走訪 `unordered_map`**。真的 `unordered_map` 走訪順序是
**未指定的**，拿 g++ 當權威量它，量到的是「我們有沒有跟它做出同一個未指定的選擇」。
`m[k]`／`size()`／`count()` 是良好定義的，那些進判準。

## 🟠 這一刀沒有做的（語料裡真的用到，而它們卡在同一個地方）

那 13 支 `multiset` 的用法遠不只 `insert`：

```
st.erase(st.begin())          迭代器
l.erase(l.find(p[r1]))        迭代器
st.lower_bound({y-d, -2e9})   迭代器 ＋ pair 的比較
```

🟠 **迭代器是另一刀**（語料裡 `.begin(` 33 次、`.end(` 30 次）。
探索報告已經拍板過同一件事：「一個概念如果它的產出沒有人接得住，
補上它不會讓任何一支程式跑起來——它只會讓失敗的位置往後移。」

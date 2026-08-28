# 圖與 BFS

> 一層一層走出去，先碰到的就是最近的。 · ⏱ 約 40 分鐘

## 你會學到三件事

1. 圖怎麼存：**鄰接表**
2. BFS 用 `queue`，而它找到的是**最短步數**
3. `dist` 陣列同時當「走過沒」和「幾步」

## 開始之前

前面的資料都是一排或一張表。**圖不是**——它是「誰連到誰」。

地圖、社交關係、迷宮、課程先修——這些都是圖。

## 一、鄰接表

```cpp
vector<vector<int>> g;      // g[u] ＝ u 連到哪些點
```

`g[0] = {1, 2}` 的意思是「0 連到 1 和 2」。

| 存法 | 空間 | 適合 |
|---|---|---|
| **鄰接表** `vector<vector<int>>` | O(點 + 邊) | **邊少**（大部分題目） |
| 鄰接矩陣 `bool g[n][n]` | O(點²) | 邊很多、要頻繁問「這兩點有沒有連」 |

⚠️ 無向圖要**兩邊都加**：

```cpp
g[a].push_back(b);
g[b].push_back(a);      // ← 漏了就變成單向
```

## 二、BFS：一層一層

```cpp
vector<int> dist(4, -1);
queue<int> q;
q.push(0);
dist[0] = 0;
while (!q.empty()) {
    int u = q.front();
    q.pop();
    vector<int> nb = g[u];
    for (int v : nb) {
        if (dist[v] == -1) {
            dist[v] = dist[u] + 1;
            q.push(v);
        }
    }
}
```

流程：

```
起點進佇列 → 拿一個出來 → 把它沒走過的鄰居都放進去 → 重複
```

因為 `queue` 是先進先出，**距離 1 的會在距離 2 的前面全部處理完**——
所以它是**一層一層**擴散的。

## 三、🔴 `dist` 一個陣列做兩件事

```cpp
if (dist[v] == -1) {
    dist[v] = dist[u] + 1;
    q.push(v);
}
```

`-1` 代表「**還沒走過**」，其他值代表「**幾步到得了**」。

⚠️ **標記要在 `push` 的時候做，不是 `pop` 的時候。**

在 pop 時才標記的話，同一個點可能被 push 好幾次——
佇列會爆掉，而答案還是對的（**所以很難發現**）。

## 四、🔴 BFS 找到的就是最短

**第一次碰到某個點時，那個距離就是最短的。**

因為 BFS 是一層一層走：距離 1 的全部處理完，才會處理距離 2 的。
所以你不可能「先用 3 步走到、之後才發現 2 步可以到」。

⚠️ **前提是每條邊的長度一樣**。邊有不同權重的話 BFS 會給出錯的答案，
那時要用 Dijkstra——做法是把 `queue` 換成第 7 課的 `priority_queue`，
每次先拿「目前已知距離最短的那個點」。

| | 用什麼 | 走法 |
|---|---|---|
| **BFS** | `queue` | 一層一層 → **最短步數** |
| **DFS** | 遞迴 / `stack` | 一路走到底再回頭 → **連通性、路徑** |

**兩者的程式碼幾乎一樣**，差別只在那個容器——而結果完全不同。

## 完成的樣子

```cpp
int main() {
    vector<int> a0;
    a0.push_back(1);
    a0.push_back(2);
    vector<int> a1;
    a1.push_back(3);
    vector<int> a2;
    vector<int> a3;
    vector<vector<int>> g;
    g.push_back(a0);
    g.push_back(a1);
    g.push_back(a2);
    g.push_back(a3);
    vector<int> dist(4, -1);
    queue<int> q;
    q.push(0);
    dist[0] = 0;
    while (!q.empty()) {
        int u = q.front();
        q.pop();
        vector<int> nb = g[u];
        for (int v : nb) {
            if (dist[v] == -1) {
                dist[v] = dist[u] + 1;
                q.push(v);
            }
        }
    }
    cout << dist[3] << endl;
    return 0;
}
```

（`0 → 1 → 3`，所以 `dist[3]` 是 **2**。）

## 換你了

把 `queue` 換成 `stack`（`q.front()` 改成 `q.top()`），
執行看看 `dist[3]` 變成什麼。

**同一段程式，換一個容器，就從 BFS 變成 DFS**——
而 DFS 找到的**不保證是最短的**。

## 這一課你做了什麼

- 你用鄰接表存了一張圖
- 你用 `queue` 一層一層走出去
- 你用一個 `dist` 陣列同時記了「走過沒」和「幾步」

## 如果卡住了

| 你看到 | 多半是因為 |
|---|---|
| 有些點走不到 | 無向圖只加了單邊 |
| 佇列越來越大 | 標記時機錯了——要在 push 時標 |
| 距離不是最短 | 用了 stack（那是 DFS），或邊有不同權重 |
| 程式停不下來 | 沒有標記走過的點 |

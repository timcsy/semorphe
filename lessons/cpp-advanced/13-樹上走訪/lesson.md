# 樹上走訪

> 樹是沒有環的圖，所以走它只要記住「從哪來」。 · ⏱ 約 35 分鐘

## 你會學到三件事

1. 樹是一種特別的圖：**n 個點、n−1 條邊、沒有環**
2. DFS 走樹只要記 `parent`，不用 `visited` 陣列
3. 深度是一路傳下去的

## 開始之前

第 11 課的 BFS 需要一個 `dist` 陣列擋住走過的點。

**樹上不用。** 因為沒有環——你只可能從來的那條邊走回去。

## 一、樹的三個等價說法

| 說法 | |
|---|---|
| n 個點、**n−1 條邊**、連通 | |
| 任兩點之間**恰好一條路徑** | 所以「最短路」就是「那條路」 |
| 連通且**沒有環** | |

⚠️ **三個是等價的**——證明其中一個就有另外兩個。
題目說「保證是一棵樹」時，這三件事你都可以用。

## 二、DFS 只要記 parent

```cpp
void dfs(int u, int parent) {
    vector<int> nb = g[u];
    for (int v : nb) {
        if (v == parent) continue;      // 🔴 唯一要擋的
        depth[v] = depth[u] + 1;
        dfs(v, u);                      // 我是 v 的 parent
    }
}
```

一般的圖要 `visited` 陣列，而樹上**只要擋住「回頭那一步」**。

因為沒有環，除了來的那條邊，其他邊都通向沒去過的地方。

⚠️ 呼叫時根的 parent 給 `-1`（一個不存在的點）：

```cpp
dfs(0, -1);
```

## 三、深度是傳下去的

```cpp
depth[v] = depth[u] + 1;
```

⚠️ **這一行要在 `dfs(v, u)` 之前**——先設好，再往下走。

放在後面的話，子節點在計算時拿到的是舊值（多半是 0）。
**症狀是所有深度都變成 0 或 1**，而程式不會報錯。

```
    0        depth = 0
    |
    1        depth = 1
    |
    2        depth = 2
```

## 四、同一個形狀，換一個地方做事

樹上的 DFS 有兩個時機：

```cpp
void dfs(int u, int parent) {
    // ① 【進入】u 的時候——由上往下傳的東西（深度、從根到這裡的和）
    for (int v : g[u]) {
        if (v == parent) continue;
        dfs(v, u);
        // ② 【子樹處理完】——由下往上收的東西（子樹大小、子樹最大值）
    }
}
```

| 放在哪 | 算得出什麼 |
|---|---|
| ① 進入時 | 深度、到根的距離、祖先 |
| ② 回來時 | **子樹大小**、子樹的和、樹的直徑 |

```cpp
size[u] = 1;
for (int v : g[u]) {
    if (v == parent) continue;
    dfs(v, u);
    size[u] += size[v];      // ← 在②，因為要等 v 算完
}
```

> **「往下傳」和「往上收」是樹上演算法的兩個方向，
> 而它們只差在你把那行程式寫在遞迴呼叫的前面還是後面。**

## 五、⚠️ 遞迴深度

一條鏈狀的樹（每個點只有一個小孩），n = 10⁵ 的話遞迴會疊 10⁵ 層——
**可能 stack overflow**（第 5 課）。

競賽裡多半沒事，而真的爆了就要改成用 `stack` 的迴圈版本。

## 完成的樣子

```cpp
vector<vector<int>> g;
vector<int> depth(3, 0);

void dfs(int u, int parent) {
    vector<int> nb = g[u];
    for (int v : nb) {
        if (v == parent) continue;
        depth[v] = depth[u] + 1;
        dfs(v, u);
    }
}

int main() {
    vector<int> a;
    a.push_back(1);
    vector<int> b;
    b.push_back(0);
    b.push_back(2);
    vector<int> c;
    c.push_back(1);
    g.push_back(a);
    g.push_back(b);
    g.push_back(c);
    dfs(0, -1);
    cout << depth[2] << endl;
    return 0;
}
```

## 換你了

加一個 `size` 陣列，算出每個節點的**子樹大小**。

⚠️ 記得它要放在**遞迴呼叫的後面**——那是「往上收」。

## 這一課你做了什麼

- 你知道樹是 n−1 條邊、沒有環的圖
- 你用 `parent` 取代了 `visited` 陣列
- 你分得出「往下傳」和「往上收」該寫在哪裡

## 如果卡住了

| 你看到 | 多半是因為 |
|---|---|
| 遞迴停不下來 | `if (v == parent) continue;` 漏了 |
| 深度全是 0 或 1 | 那一行寫在 `dfs(v, u)` 後面了 |
| 子樹大小不對 | 累加寫在遞迴呼叫**前面**了 |
| 有些點沒走到 | 無向邊只加了一邊（第 11 課那件事） |
| stack overflow | 樹太深。改成迴圈 ＋ `stack` |

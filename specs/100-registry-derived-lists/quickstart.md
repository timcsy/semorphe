# Quickstart：驗證登錄表導出

## 前置

```bash
npm test          # 動工前必須全綠
```

## 驗證順序（護欄先、導出後——順序刻意）

### 1. 護欄立刻抓到 4 顆拿不到的積木

```bash
npx vitest run tests/integration/audit-toolbox-reachability.test.ts
```

**期望（第一次跑）**：**紅**，並指名

```
cpp_string_find_first_not_of · cpp_string_find_last_not_of
c_map_assign · cpp_istringstream_declare
```

⚠️ **如果它一開始就綠，那是護欄壞了**——動工前實測確認這 4 顆真的拿不到。

> 順序刻意反過來：先導出的話，那 4 筆會被「順便」修掉，而**我們永遠不會知道它們曾經存在**。

### 2. 補完之後轉綠

```bash
npx vitest run tests/integration/audit-toolbox-reachability.test.ts
```

**期望**：綠。中性形態（`c_container_push`／`c_container_pop`）仍**不在**工具箱——那是刻意的。

### 3. 加一顆元件不必編輯清單

```bash
npx vitest run tests/integration/audit-toolbox-reachability.test.ts -t 合成
```

**期望**：合成一顆元件宣告，它**自動**出現在產出裡。

⚠️ **這一支是「導出」與「把手寫換個地方」的分界線。** 它紅的話，就是還在手寫。

### 4. 產出一字不差

```bash
npx vitest run tests/integration/toolbox-snapshot.test.ts
```

**期望**：分組、順序、成員與改動前完全相同。

⚠️ **順序是教學設計。** 這一支若紅，先看是不是排序被演算法接管了——那比少一顆積木更難發現。

### 5. 課程清單：引用不得懸空，未收錄要報出

```bash
npx vitest run tests/integration/audit-curriculum-coverage.test.ts
```

**期望**：懸空引用 0（紅）；未收錄的元件**列出來但不算違規**。

### 6. 護欄全部不上升

```bash
npx vitest run tests/integration/audit-*.test.ts
```

⚠️ **就近性的數字會下降**（課程清單改歸「清單」不算實作擴散）。
**下降要說明原因並在基線註記**——`history/018` 的直接處方：混在同一個數字裡的話，
用改量測刷分數看起來會像進步。

### 7. 全套

```bash
npm test
```

⚠️ **不要用 `head` 看 FAIL 列**——截斷輸出等於沒有讀。

## 手動驗（機器驗不到的那一格）

開瀏覽器，打開工具箱，逐個分類看過去：

- **順序看起來還是教學順序嗎？**（不是字母序、不是登錄表順序）
- 新出現的四顆（字串搜尋兩顆、map 指定、istringstream）**放對分類了嗎？**

第二個問題機器答不了——它只能保證「在某個分類裡」，不能保證「在**對的**分類裡」。

## 如果卡住

| 症狀 | 先看哪裡 |
|---|---|
| 護欄一開始就綠 | 掃描是不是把 `extraTypes` 的物件形態當成字串（研究階段的腳本就犯過） |
| 少了帶 `extraState` 的入口 | 那類**不該**被導出消掉（`{ type: 'u_if', extraState: {…} }` 是教學設計） |
| `maps_sets`／`stacks_queues` 空了 | 那兩個分類的 `registryCategories` 原本是空的，全靠 `extraTypes` |

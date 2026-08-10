# Quickstart：怎麼驗證這件事做對了

## 前置

```bash
npm install
```

## 一、護欄——**第一次跑必須是紅的**

```bash
npx vitest run tests/integration/audit-block-type-derive.test.ts
```

**預期（實作前）**：紅，逐項指名 **153** 顆不導出的積木。

⚠️ **一開始就綠代表護欄壞了**，有三種可能，沒有一種是好消息：
判準寫錯了、資料沒載入、或**基線是先產生的**。

**預期（實作後）**：綠，數字 0。

## 二、兩個方向都要釘

```bash
npx vitest run tests/integration/audit-block-type-derive.test.ts -t 注入
```

| 注入 | 證明 |
|---|---|
| 一顆積木型別改成不導出的名字 | **會報，而且指名是哪一顆** |
| 全部符合 | **不亂報** |

基線是 0 的時候這一步是唯一的健康檢查——**一條回報零違規的健康護欄，
與一條什麼都沒量到的護欄，產出完全相同。**

## 三、存檔轉換

```bash
npx vitest run tests/integration/save-migration-v10.test.ts
```

四個契約各一支：換得乾淨（C1）、冪等（C2）、未知型別**出聲**（C3）、
語義樹不被碰（C4）。

## 四、⚠️ 瀏覽器實測——**這一步不能用測試代替**

```bash
npm run dev
```

1. 開 devtools，把 `tests/assets/` 裡那份 v9 存檔貼進
   `localStorage['semorphe-state']`
2. 重整
3. **看**：積木長出來了嗎？有沒有任何一顆是未知型別？
4. **按執行**：輸出與 `tests/assets/` 記的預期相同嗎？
5. **切 iostream ↔ printf**：IO 積木的排序有沒有變
   （研究三：`toolbox-builder` 的前綴判斷被改掉了，這是它的回歸點）

> **測試綠不代表使用者看到的是對的。** 存檔遷移尤其如此——
> 測試餵的是它自己造的資料，而使用者的存檔是真的。

## 五、全套

```bash
npm test
```

## 完成的判準

- [ ] 護欄第一次跑是紅的，逐項指名 153 顆
- [ ] 修完之後是 0，基線 `_meta` 註明下降是「**因為實作了**」
- [ ] 兩個注入方向都過
- [ ] v9 存檔在瀏覽器裡打得開，積木／輸出/排序三者都對
- [ ] 那份 v9 存檔留在 `tests/assets/` 當回歸樣本
- [ ] `npm test` 全綠

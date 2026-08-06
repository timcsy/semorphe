# 驗收指引：執行那一路搬回它的模組

```bash
npx vitest run tests/integration/executor-inventory.test.ts \
              tests/integration/audit-completeness.test.ts \
              tests/integration/audit-neutrality.test.ts
npm test
```

---

## 情境 0（先跑）：把搬移前的概念集合固定下來

**這是第一個任務，不是最後一個。** 搬移之後才想比對就沒有基準了。

驗收：一份測試資產記著搬移前執行引擎認得的所有概念；一支測試斷言現況與它相同。

## 情境 1：58 個一個不漏

搬移後集合**完全相同**。失敗訊息要說得出**少了誰／多了誰**。

## 情境 2：兩份跨模組的有真的拆開

- 字串 → `std/string` 17 ／ `std/cstring` 10
- 容器 → 五個標準函式庫模組 13 ＋ 語言核心 7

**驗法**：只載入其中一個模組時，不得連帶載進另一個模組的執行器。

## 情境 3：模組的五面牆齊了

`std/string`、`std/cstring`、`std/cmath`、`std/vector`、`std/queue`、`std/map`、`std/set`、`std/stack` 八個模組各自有 `executors.ts`，與其他四路並列。

**同時驗執行機構**：在模組型別上拿掉某個模組的 `registerExecutors` → **應該編不過**。

## 情境 4：執行結果完全相同

任一原本能執行的程式，輸出一字不差。

## 情境 5：忘了載入語言套件時說得出原因

- 沒載入 → 錯誤訊息含「可能是沒有載入語言套件」
- 已載入 → 該提示不出現，行為與現況相同

## 情境 6：數字下降且可歸因

- 語言中立性 **174 → ≤120**，且說得出下降來自哪些概念
- 五路完備性的執行欄「缺」**未增加**
- 重複註冊**未增加**
- 其餘量測未上升

## 情境 7：既有行為零回歸

`npm test` 全綠；`src/interpreter/executors/` 少掉四個檔。

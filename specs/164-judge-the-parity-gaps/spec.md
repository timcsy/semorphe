# spec 164：判那 19 筆落差——而還完的方式是「把對的那一份補齊」

**路線圖位置**：階段 7 第 0 刀餘下的 28 筆 ｜ **前一步**：spec 163

## 結果

| | 之前 | 之後 |
|---|---|---|
| 落差 | 19 | **17** |
| 中立性第二維 | 28 | 🎯 **25** |
| 雙重真相 | 29 | 🎯 **26** |
| 退場 | — | `cpp_break`／`cpp_return`／`cpp_var_ref` |

> **不是「刪掉就降」——是「把對的那一份補齊，另一份才變成多餘的」。**

## 三顆各自需要不同的東西

**① `cpp_break`／`cpp_return`：修宣告**
宣告多了 `nextStatement`，而 `break`／`return` 之後接東西是**不可達的程式碼**。
🔴 **而我第一次判它時判反了**（寫成「命令式才是錯的」）——已更正並記在 `history/114`。

**② `cpp_var_ref`：補機制**
它的下拉是**跟著工作區長的**（`createOpenDropdown(() => getNameRefOptions())`），
而宣告只表達得出一個死的文字框。
→ 新增 `src/ui/dynamic-dropdown-field.ts`：`field_dynamic_dropdown` ＋ `source` 由組裝點注入。

## 🔴 順手拆掉的一顆地雷

```
cpp_func_call             form 無（敘述版）        宣告 output: Expression   ← 錯
cpp_func_call_expression  form={role:expression}   宣告【什麼都沒有】         ← 錯
                                                   —— 兩顆【完全對調】
```

⚠️ **使用者看不到它**（命令式蓋住了），而**這一系列刀正在做的就是刪掉那些命令式定義**
——輪到這一顆的那天，函式呼叫積木會**變成運算式**。

> **一個被覆蓋著的錯誤宣告，是一顆等著下一次清理踩上去的地雷。**

## ⚠️ 兩次「訊息沒到齊」被誤讀成「宣告寫錯」

```
第一次（163）  jsonInit 說「Message does not reference all N args」  ← 膠囊標籤沒載
第二次（164）  比對報表寫「變數,(自訂) vs %{BKY_U_VAR_REF_LABEL}」   ← src/i18n 沒載
```

**同一種病的兩次發作**：訊息來源不完整時，`%{BKY_X}` 展不開，
而症狀長得像「宣告是壞的」。**兩個來源（膠囊 `labels/` ＋ 共用 `src/i18n/`）都要載。**

## ⚠️ 而我在瀏覽器實測時又踩了一次「量錯了」

Block Style 切換之後我報「積木集合不一樣」兩次——**而積木一顆不少**。
原因是我**拿著切換前的 workspace 參照**，而切換會**重建工作區**。

> **一個在重建之後還拿著舊參照的量測，量到的是一個已經不存在的東西。**

🟢 改成每次重新 `app.blocklyPanel.workspace` 取得之後：
切換前後 13 顆、型別集合相同、`DynamicDropdown` 還在、選項還是 `x,y`、程式碼一字不差。

## 驗收

- [x] 落差 19 → 17；中立性 28 → 25；雙重真相 29 → 26
- [x] 🔴 `cpp_var_ref` 在瀏覽器裡**真的還是活下拉**（`DynamicDropdown`，選項 = 工作區的變數）
- [x] Block Style 切換前後一致（`CLAUDE.md` 指名的地方）
- [x] 4793 綠、e2e 37 全過、截圖確認標籤與下拉三角形都在

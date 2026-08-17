# Quickstart：怎麼驗這個功能真的做到了

> ⚠️ **不產 `data-model.md` 與 `contracts/`**：本功能不新增實體
> （`Target` 型別 spec 134 已定，四個欄位**恰好**由 `tests/unit/target.test.ts` 釘住），
> 也沒有對外介面。**憑空補兩份檔案只會讓下一個人以為那裡有東西要讀。**

## 前置

```bash
npm install && npx playwright install chromium   # 只有第一次
```

## ① 護欄——順序是驗收的一部分

```bash
# 🔴 Phase 0：接上【之前】必須紅，且指名 target-registry
git stash && npx vitest run tests/integration/audit-registry-consumers.test.ts
#   期望：FAIL，報表印出 11 個登錄表的消費者數，target-registry 那一列是 0

git stash pop && npx vitest run tests/integration/audit-registry-consumers.test.ts
#   期望：PASS
```

**若第一步就綠 → 停下來。** 那代表判準寫錯或掃描沒吃到檔案
（`build-guardrail` 6.5：「第一次綠有三種可能，**沒有一種是好消息**」）。

## ② 課程清單沒有漂移

```bash
npx vitest run tests/unit/c-topic-derivation.test.ts
```

期望：`c-beginner` 的概念集合 == 由判準（requires ∧ 無 ioRole 對應）推出來的集合。
⚠️ 改了 `cpp-beginner` 而沒重推 `c-beginner` → **這一支會紅**。

## ③ e2e——⚠️ 而它的入口條件比結論重要

```bash
npx playwright test e2e/c-target.spec.ts
```

它會**先展開全部層級**，再斷言：

```
展開後、選 C++ 時   C++ 專屬概念數 > 0     ← 🔴 入口條件。不成立的話下一行是空過的
選 C 之後            C++ 專屬概念數 = 0
```

**理由**（research Q3）：開機預設只開 L0，而 L0 一顆都不用排除
——不展開的話「0」在功能做出來之前就已經成立了。

## ④ 全套 ＋ 基線

```bash
npm test        # 期望 4201 綠（+ 本輪新增），46 條既有基線【一個數字都不動】
npm run lint
```

## ⑤ 🔴 開真的瀏覽器

```bash
npm run dev
```

1. 目標下拉 → 選「**C 語言教學**」
2. 貼一段 C++：`int main(){ int n = 3; cout << n << endl; return 0; }`
3. 按「程式碼→積木」，看產出

**期望**：`#include <stdio.h>`、`printf`，**沒有** `iostream`／`using namespace std;`
**而工具箱裡找不到** `vector`／`string` 那族。

4. 重新整理 → **仍然是「C 語言教學」**
5. 切回「C++（預設）」→ 產出與本功能之前**逐字相同**

⚠️ **這一步不能省。** `history/072`§三：`c-style-parity` 10/10 全綠時，
瀏覽器上仍然產出 `<iostream>`——**測試走的是另一條路徑**。

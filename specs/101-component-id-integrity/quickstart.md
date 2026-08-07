# Quickstart：驗證引用完備性

```bash
npm test    # 動工前必須全綠
```

## 1. 護欄第一次跑——**必須紅，且指名四筆**

```bash
npx vitest run tests/integration/audit-component-id-integrity.test.ts
```

期望：紅，並列出

```
var_declare_expr            extract-strategies.ts:126
cpp_priority_queue_declare  strategies.ts:656
cpp_initializer_list        strategies.ts:62
param_decl                  strategies.ts:359 (+2)
```

⚠️ **一開始就綠 = 護欄壞了。** 少報或多報都是判準寫錯——規劃階段的靜態掃描
第一版報了 27 筆（把積木型別與 AST 節點型別當成元件身分）。

## 2. 宣告完非元件之後，違規欄只剩真的幽靈

```bash
npx vitest run tests/integration/audit-component-id-integrity.test.ts
```

期望：`raw_code`／`unresolved`／`param_decl`／`cpp_initializer_list`／`_compound`／`_multi_field`
移到「明確宣告的非元件」欄；違規欄剩 `var_declare_expr` 與 `cpp_priority_queue_declare`。

## 3. B 項的尾巴修好

```bash
npx vitest run tests/integration/identity-merge-expr-pairs.test.ts
```

期望：拖一顆 `c_var_declare_expr` 抽取出來，得到的是 **`var_declare`**，不是 `var_declare_expr`。

## 4. `priority_queue` 五路

```bash
npx vitest run tests/integration/priority-queue.test.ts
```

⚠️ **執行那一路的期望值來自 `g++ -std=c++17`**，不是我推的：

```cpp
priority_queue<int> pq;
pq.push(1); pq.push(5); pq.push(3);
cout << pq.top();     // 5 ← **不是 1**
```

**抄 `queue` 的執行器會得到 1。** 那是「共用一個實作可能是差別沒被模型化」的第二次。

## 5. 工具箱自動收錄——E 項的第一次回報

```bash
npx vitest run tests/integration/audit-toolbox-reachability.test.ts
```

期望：`cpp_priority_queue_declare` **自動**出現在「堆疊與佇列」，
而 `toolbox-categories.ts` **一個字都沒改**。

## 6. 全套 ＋ 護欄複查

```bash
npm test
npx vitest run tests/integration/audit-*.test.ts
```

⚠️ **不要用 `head` 看 FAIL 列**——截斷輸出等於沒有讀。

# 兩個 lift 來源，讓改對的那一個沒有反應

*2026-09-18 · 接收者從文字屬性換成接點（第 181 刀）*

## 事情

`copy.begin()->second` 的接收者被 `.text` 抄成字串，於是執行時
`scope.get("copy.begin()")` 說「這個變數尚未宣告」。

修法很清楚：把 `cpp:struct_at_ptr` 的接收者換成接點。三路都改了
（`lift.ts` 的分支 lift 那棵樹、`generate.ts` 產回去、`execute.ts` 求值），
`tsc` 乾淨。

**而樹一個字都沒變。**

```
cpp:struct_at_ptr {"obj":"p","member":"x"} slots=[]     ← 改完之後還是這樣
```

## 為什麼

那顆積木的 **BlockSpec 上還有一個 `astPattern`**：

```jsonc
"astPattern": {
  "nodeType": "field_expression",
  "constraints": [{ "field": "operator", "text": "->" }],
  "fieldMappings": [
    { "semantic": "obj", "ast": "argument", "extract": "text" },   // ← 這裡
    { "semantic": "member", "ast": "field", "extract": "text" }
  ]
}
```

**同一個概念有兩個 lift 來源**，而贏的是這一份。膠囊自己的
`registerAstBranch` 分支從頭到尾沒有被問過。

> **一個概念有兩個 lift 來源時，改對了其中一個不會有任何反應
> ——而那讓人以為自己改錯了地方。**

⚠️ 而它**不會出現在任何測試上**：兩份說的是同一件事（只差接收者的形狀），
所以在接收者還是文字的年代，兩份是一致的。**雙重真相在兩份一致的時候是隱形的。**

## 這個 repo 早就在看這件事

`component-refactor` skill 的 A3 節逐字列了四個 lift 來源，
而 BlockSpec 的 `astPattern` 是其中之一，標記是「最低（-5 penalty）」。
**低優先權不等於不會贏**——它只在有人競爭時才低。

## 判準

改一顆元件的 lift 之前，先問「**這個概念有幾個 lift 來源**」，
而不是「lift 寫在哪裡」。前者的答案可能是 2。

```bash
# 膠囊自己的
ls src/components/*/<name>/lift*.{ts,json}
# BlockSpec 上的
python3 -c "import json;print([b.get('astPattern') for b in json.load(open('.../forms/blocks.json'))])"
```

## 相關

- [[246-一個缺陷修好之後才看得見的缺陷]]——同一輪的另一個形狀
- `knowledge/concepts/元件.md` 的五槽：**lift 是一路，不是一個檔**

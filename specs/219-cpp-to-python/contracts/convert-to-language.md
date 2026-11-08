# Contract：`LanguagePack.convertToLanguage`（spec 219）

```ts
convertToLanguage?: (
  tree: SemanticNode,                       // 來源語言的語意樹（換目標之前那一棵）
  toLanguage: string,                       // 目標語言（第一版只認 'python'）
  types: Readonly<Record<string, string>>,  // Cella 給的、來源程式的運算式型別（拿不到時是 {}）
) => {
  tree: SemanticNode                        // 換好的目標語言樹；整支不換時是原樹
  converted: number                         // 換了幾處（語句數）
  kept: number                              // 保留了幾處
  reasons: { nodeId: string; line?: number; kind: KeepKind; detail: string }[]
} | null                                    // null ＝ 這一對不歸這個套件管
```

`KeepKind`：`overflow` · `division` · `modulo` · `char` · `pointer` · `class` · `template` · `outside-subset` · `needs-types`。

## 不變式

- C1 **整支換或不換**：`reasons.length > 0` ⟺ 回傳的 tree 就是傳進來的那一棵（`converted = 0`）。
- C2 **只用身分在膠囊裡的建構子**：共用檔不寫 `cpp:*`／`python:*` 的身分字串（同 357 的 `isNew`／`buildFree` 做法）。
- C3 **意思不變的判準是 Cella**：護欄對每一支換過去的程式比判決、輸出、assumes；換法自己不宣稱「沒問題」。
- C4 **app 只做三件事**（同第一對）：問型別、寫回兩個投影、說出結果；等型別時使用者改了程式或又換目標 ⟹ 這一次作廢。

# Contract：身分格式

## 提供者

元件宣告（`*concepts*.json` 的 `conceptId`／`abstractConcept`）與所有建出語義節點的程式碼。

## 契約

1. 每一顆身分 **MUST** 形如 `<scope>:<name>`，兩段都非空
2. `scope` **MUST** 在白名單內（`lang`｜`cpp`）
3. `name` 內 **MUST NOT** 含 `:`
4. **MUST NOT** 有裸名。沒有「沒有冒號就是核心」這條特例
   ——特例是偵測，統一格式是**消除**

## 消費者

- 身分格式護欄（新增）：違規時**指名元件與檔案位置**，不只給數字
- `C3` 引用完備性護欄（既有）：程式碼不得建出登錄表裡沒有的身分
- 存檔轉換：v2→v3 的目標格式

## 已知的相容性衝突

`src/languages/cpp/core/generators/statements.ts:46` 用冒號把 `conceptId` 與
其他資訊組成複合鍵：

```ts
const key = `${n.conceptId}:${normalizeHeader(String(n.properties.header))}`
```

身分含冒號後 `cpp:include:iostream` 的切法曖昧。**全樹只有這一處**（其餘六處
組字串都只是給人看的訊息）。處置：換一個不會出現在身分裡的分隔符。

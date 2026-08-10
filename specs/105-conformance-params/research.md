# Research：三個未知

## R1：新機制掛在哪——已經有先例，照抄那個位置

### 查到什麼

`src/core/types.ts:291` 的 `RenderMapping` 已經是**宣告式投影規則的家**：

```ts
dynamicRules?: DynamicRule[]
/** Extra state flags: set extraState[key] = true when children[childSlot] is non-empty */
extraStateFlags?: Record<string, string>
```

而 render 與 extract **各自消費同一份宣告**：
`pattern-renderer.ts:202 → renderDynamicRules()`、
`pattern-extractor.ts:128 → extractDynamicRules()`。

### 決定：新增 `childrenAsField`，與 `dynamicRules` 平行

```jsonc
"renderMapping": {
  "fields": { "CAPTURE": "capture" },
  "statementInputs": { "BODY": "body" },
  "childrenAsField": [{
    "field": "PARAMS",          // Blockly 欄位
    "childSlot": "params",      // 語義接點
    "childConcept": "param_decl",
    "parts": ["type", "name"]   // 每個子節點怎麼寫成文字
  }]
}
```

**理由**：一個機制、六份宣告——FR-002 直接兌現。而它與 `dynamicRules`
是**兩種不同的形態**（每項一組欄位 vs 全部擠進一個文字欄位），
並列在同一層讓「這顆元件的參數長什麼樣」看得見。

**否決的替代方案**

| 方案 | 為什麼不 |
|---|---|
| 六顆各寫一個 `renderStrategy` / `extractStrategy` | 六份會漂移的程式碼——這階段的頭號病 |
| 把六顆改成 `dynamicRules` ＋ 動態積木 | 82 行 Blockly 碼 × 6，且**改變積木外觀**（spec 明確排除） |
| 擴充 `dynamicRules` 讓它支援「單一欄位」模式 | 兩種形態擠進一個型別，讀的人要先判斷是哪一種——**並列比較誠實** |

---

## R2：`map<int,int> m` 的分隔符——這是這個方向最明顯的失敗模式

### 問題

參數之間用 `, ` 分隔，而型別自己可以含逗號：`map<int,int> m, int k`。
天真的 `split(',')` 會把它拆成三段。

### 決定：**分割時追蹤角括號深度**，深度 > 0 的逗號不是分隔符

```
map<int,int> m, int k
        ↑ 深度 1，不切        ↑ 深度 0，切
```

同一個處理也涵蓋 `pair<int, pair<int,int>>`（巢狀）。

**不涵蓋、且要明確記錄**：函式指標型別 `void (*f)(int, int)` 的圓括號。
→ 一併追蹤圓括號深度，成本一樣。**方括號**（`int a[10]`）也一起。

⚠️ **這一條必須有測試**（SC-003）。允許「明確不支援」，
**不允許靜默拆錯**——拆錯的症狀是參數數量變多，而每一個都是垃圾。

### 型別與名字怎麼切

`parts: ["type", "name"]` 對 `long long n` 要切成 `{type: "long long", name: "n"}`。
→ **最後一個空白分隔的詞是名字，其餘全是型別。** 不是 `split(' ')` 取前兩個。

⚠️ 不支援、且要記錄：`int *p`（星號黏在名字上）、`int a[10]`（陣列宣告子）。
判不出來的**保留原字串當名字**並讓來回轉換抓到，不要猜。

---

## R3：零參數不得產生「空的參數表示」

### 查到什麼

`c_lambda` 的訊息是 `"匿名函式 擷取 %1 參數 %2"`——參數欄位**永遠顯示**，
零參數時它是空字串。而產生器讀的是**語義樹**不是欄位，所以零參數時
產出 `[]()`，正確。

### 決定：零參數時 `childrenAsField` **不寫欄位、也不建立子節點陣列**

- render：`childNodes.length === 0` → 不設 `fields[field]`（維持積木定義的預設空字串）
- extract：欄位是空字串或全空白 → **不建立** `children.params`，
  而不是建立一個空陣列

**理由**：`{}` 與 `{params: []}` 在來回比對上是不同的東西，
而 SC-002 要求**逐字相同**。空陣列會讓某些產生器印出 `()` 之外的東西。

---

## 未驗的一項

**`method_virtual_pure` 沒有 `body` 接點**，只有 `params`。
修好之後它會不會因為缺 `body` 而走不過渲染，**沒有實測**。
→ 進 tasks：它單獨一個樣本。

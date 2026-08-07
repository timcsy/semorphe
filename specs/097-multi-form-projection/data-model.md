# Phase 1 資料模型：多形態

## 實體

### 形態集合（FormSet）

一個 componentId 可對應的所有積木形態，以及**怎麼選**。

```
FormSet
  conceptId : string          擁有這組形態的元件身分
  axis      : FormAxis | null 選擇軸；null 表示只有一個形態
  forms     : Map<軸值, blockType>
  default   : blockType       選不出時用的那個
```

**不變式**

| | |
|---|---|
| **FS-1** | `forms` 非空 |
| **FS-2** | `default` ∈ `forms` 的值域 |
| **FS-3** | `axis` 為 null ⟺ `forms` 只有一項 |
| **FS-4** | 同一個 `blockType` MUST NOT 出現在兩個不同 conceptId 的 FormSet 裡 |

FS-4 是反向投影的基礎：抽取以 blockType 為鍵，一個 blockType 對到兩個概念就無法反推。

---

### 選擇軸（FormAxis）

**具名**，而不是寫死的兩個欄位（研究決定 5）。

```
FormAxis
  name : string    軸名，例如 'role' | 'container_kind'
  from : string    依據哪個節點屬性取值
```

已知的兩條軸：

| 軸名 | `from` | 值 | 現況 |
|---|---|---|---|
| `role` | 由呈現位置決定（不是節點屬性） | `statement` / `expression` | **已存在**，靠 `expressionCounterpart` ＋ 自動推導的 statement/expression-only 集合 |
| `container_kind` | `properties.container_kind` | `stack` / `queue` / … | **本功能新增** |

> ⚠️ **兩條軸的取值來源不同**：`role` 來自**呈現位置**（呼叫端知道現在要放進敘述槽還是運算式槽），`container_kind` 來自**節點屬性**。
> 這不是缺陷——軸的定義本來就要說「值從哪來」。但它意味著 `from` 不能只是「屬性名」，還要能表示「由呈現位置決定」。

---

### 節點屬性的新增：`container_kind`

`cpp_container_push` / `cpp_container_pop` 的節點在**辨識時**寫入。

```
container_kind : 'stack' | 'queue' | undefined
```

**不變式**

| | |
|---|---|
| **CK-1** | 辨識時查得到宣告型別才寫；查不到**不寫**（不猜） |
| **CK-2** | `undefined` 是合法值，對應到 `FormSet.default`（不宣稱位置的中性標籤） |
| **CK-3** | 它是**投影用的**，執行器 MUST NOT 讀它——行為由容器的實際內容決定，不由這個標記決定 |

CK-3 是防「多形態退化成複製實作」的第一道：**只要執行器不讀它，行為就不可能分岔。**

---

## 狀態轉移：存檔版本

```
version 1  ──UPGRADES[1]──▶  version 2
（統一的 cpp_container_push 積木）      （依容器分開的積木型別）
```

**不變式**

| | |
|---|---|
| **SV-1** | 轉換是**一次性**的：載入時升級、存回去就是新版，舊格式不再保留 |
| **SV-2** | 轉換不得靜默丟東西——轉不動要出聲（`judge` 已有 `not-a-save` / `too-new` 兩種判定可沿用形狀） |
| **SV-3** | `CURRENT_VERSION` 每往上一階，`UPGRADES` 就要多一階——**既有測試已經釘住這條** |

---

## 與既有型別的關係

| 既有 | 本功能怎麼動它 |
|---|---|
| `RenderMapping.expressionCounterpart` | **保留**，但成為 `FormSet` 的一個特例來源——一般化不刪舊路徑，因為 5 個活的使用者 |
| `PatternRenderer.renderSpecs: Map<conceptId, RenderSpec>` | → 每個 conceptId 對一個 `FormSet`。**這是活的路徑，改它才會改變行為** |
| `BlockSpecRegistry.byConceptId: Map<string, BlockSpec>` | → 一對多。**零呼叫者**，改它只是讓宣告與實作不分歧 |
| `PatternExtractor.extractSpecs: Map<blockType, ExtractSpec>` | **不動**——鍵是 blockType，多形態天然成立（研究決定 2） |

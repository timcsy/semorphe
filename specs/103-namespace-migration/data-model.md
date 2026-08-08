# Data Model：元件身分命名空間

## 元件身分（componentId）

```
<scope> ":" <name>
```

| 欄位 | 規則 |
|---|---|
| `scope` | 必填、非空、必須在**白名單**內 |
| `name` | 必填、非空、`[a-z][a-z0-9_]*`（保持現行風格） |
| 分隔符 | 恰好一個 `:`，且 `scope` 與 `name` 內都不得含 `:` |

`scope` 表示**所有權**，不是分類也不是位置。域已經是宣告裡的欄位，
把它再編進 id 就是雙重真相——而且是最糟的那種，因為 **id 進了存檔改不動**。

### scope 白名單（本次）

| scope | 裝什麼 | 顆數 |
|---|---|---|
| `lang` | 跨語言的軟體元件 | 32 |
| `cpp` | C++ 語言套件 | 145（142 遷移 ＋ 3 已是新格式） |

未落地（域尚不存在，列出是為了說明白名單為何要明列）：`hw`（硬體）、`@<user>`（第三方）。

> **白名單不是形式主義**：沒有它，`cpp:foo` 打成 `cop:foo` 會被當成一個
> 合法的新命名空間，而不是錯字。

## 轉換表（v2 → v3）

`Record<舊身分, 新身分>`，174 筆（142 `cpp_` ＋ 32 裸名）。

| 性質 | 要求 |
|---|---|
| 冪等 | 已是新格式的身分原樣通過（樹裡本來就有 3 顆 `cpp:math_*`） |
| 保守 | 表裡沒有的身分**原樣保留**，不丟棄、不猜測 |
| 範圍 | 只改寫語義樹的 `conceptId`，**不碰積木型別** |

## 角色分類（同時是棘輪的計數器與改寫器的定位器）

一個字串字面在什麼位置出現，決定它是不是身分引用。

| 角色 | 位置 | 處置 |
|---|---|---|
| **conceptId** | `createNode(_, …)`、`getByConceptId(_)`、產生器／執行器註冊的第一引數、`conceptId:`／`abstractConcept:` 屬性、與 `.conceptId` 的比較、概念對應表的值 | 改寫 |
| **blockType** | `registerExtractStrategy(_)`、`newBlock(_)`、`getByBlockType(_)`、JSON 的 `blockDef.type` | **不得改寫** |
| **非身分** | 其餘（`document.createElement('input')`、tree-sitter 節點型別、產生出來的原始碼文字） | 不動 |

### JSON 側：靠欄位位置，零曖昧

| 欄位 | 處置 |
|---|---|
| `conceptId` | 改寫 |
| `abstractConcept` | 改寫 |
| 課程清單（topics）的身分陣列 | 改寫 |
| `blockDef.type` | **不得改寫**（66 處與身分同名） |

### 已知低報（判定保守）

- 變數指派：`concept = 'arithmetic'`
- 未列入白名單的註冊函式：`registerConceptMapping('print', …)`

低報會讓棘輪**提早喊零**，所以硬性零之前必須擴充規則並逐筆複核殘留清單。

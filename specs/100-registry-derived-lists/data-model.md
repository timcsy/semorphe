# Phase 1 資料模型：登錄表導出

## 兩種清單，兩種真相

| | 誰知道 | 處置 |
|---|---|---|
| **導得出來的** | 登錄表（「這顆積木屬於 containers 分類」） | **導出** |
| **人決定的** | 教學設計（順序、分組、預設狀態、課程層級） | **保留為宣告** |

這條線貫穿整個功能。判準：**問「登錄表知道嗎」，不問「這是不是一份清單」。**

---

## 實體

### 工具箱分類（ToolboxCategoryDef，既有）

```
key            分類鍵
nameKey        i18n 鍵          ← 人決定
fallback       退路標題          ← 人決定
colorKey       顏色             ← 人決定
registryCategories: string[]    ← **導出的來源**
extraTypes?: ExtraBlockDef[]    ← 現況混著兩種東西（見下）
excludeTypes?: string[]         ← 人決定（明確排除）
```

**不變式**

| | |
|---|---|
| **TB-1** | 每一顆有積木投影的元件，其積木型別 MUST 至少出現在一個分類的內容裡 |
| **TB-2** | 分類產出的每一個積木型別 MUST 在登錄表裡存在 |
| **TB-3** | **中性形態 MUST NOT 出現**——它是型別查不到時的退路，不是選項 |
| **TB-4** | 分類的**順序**與**標題** MUST 是宣告的資料 |

TB-1 是這個功能的主張；TB-2 是它的反向（不得指向幽靈）；TB-3 是 097 定下的原則。

---

### `ExtraBlockDef` 的兩種形態

```
純字串等價：  { type: 'cpp_abs' }                          ← 登錄表知道 → 導出
帶狀態：      { type: 'u_if', extraState: { hasElse: 1 } }  ← 教學設計 → 保留
```

**不變式**

| | |
|---|---|
| **EX-1** | 沒有 `extraState` 的項目 MUST 能從登錄表導出——留著就是雙重真相 |
| **EX-2** | 有 `extraState` 的項目 MUST 保留——那是「這個預設狀態值得一個入口」的判斷 |

---

### 課程清單（levelTree，既有）

```
id / level / label     ← 人決定
concepts: string[]     ← **人決定**（教學漸進線）
children: Level[]      ← 人決定
```

**不變式**

| | |
|---|---|
| **TP-1** | `concepts` 引用的每一顆 MUST 在登錄表裡存在 |
| **TP-2** | 未被任何課程收錄的元件 MUST 被報出，MUST NOT 算違規 |

TP-2 刻意不是違規——做成違規會逼出「為了讓護欄綠而亂塞課程」。

---

### 檔案分類（跨護欄共用）

`audit-component-identity-review` 已經有這份分類；本功能**抽出來共用**，不再寫第二份。

```
宣告   concepts.json / blocks.json          元件自己的定義
清單   topics/*.json / toolbox-categories   登錄表的視圖／策展
實作   其餘 src/                            真的實作
清冊   tests/baselines / assets / reports    產生出來的紀錄
```

**不變式**

| | |
|---|---|
| **FC-1** | 分類 MUST 由**路徑規則**判定，MUST NOT 是一份檔名清單 |
| **FC-2** | 同一份分類 MUST 被所有需要它的護欄共用——兩份會漂移 |

---

## 狀態轉移：無

本功能不動存檔格式。工具箱與課程清單都不進存檔。

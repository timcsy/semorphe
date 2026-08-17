# Data Model：擴充長成能用的

**Feature**: 139-vscode-two-way　**Date**: 2026-08-17

---

## 🔴 先說一件反直覺的：**這一輪的資料模型主要是在【拿掉】東西**

```
網頁版          SavedState 一個 blob：tree ＋ blocklyState ＋ code ＋ 組態 ＋ 偏好
這一輪          那個 blob 在 VSCode 這一側【不存在】
```

**因為它的第一類欄位在這裡有真相了**——檔案。

> **一個儲存服務在換宿主之後最好的下場，是【不需要被搬】。**

⚠️ 而 `core/storage.ts` **一個字都不改**：網頁版還在用它。
🔴 **本輪要驗的是「VSCode 這一側不呼叫它」**，不是改它。

---

## 一、既有實體（沿用，零欄位變更）

| 實體 | 出處 | 本輪怎麼用 |
|---|---|---|
| `SemanticNode` | `core/types.ts` | 唯一真實。兩個視圖投影的都是它 |
| `metadata.sourceRange` | `core/types.ts:49` | 🟢 實測 98.5% 有 → 高亮的兩個方向 |
| `node.id` | 同上 | 🟢 100% 有 → 節點身分 |
| `CodeMapping{nodeId,startLine,endLine}` | `code-generator.ts:12` | 積木 → 程式碼 |
| `ExecutionAtNodeEvent{nodeId,follow}` | `view-host.ts:120` | 🔴 **執行高亮的唯一真實**——原生編輯器只是第三個消費者 |
| `BlockSpec` | `core/block-spec-registry.ts` | 工具箱與積木註冊 |

---

## 二、本輪新增的四個**純資料**形狀

⚠️ **四個都不持有邏輯，四個都測得到。**

### ① `RewriteSpan` —— 一次修改真正要覆蓋的那一段

```
startLine   number    要覆蓋的第一行（0-based）
endLine     number    要覆蓋的最後一行的下一行
text        string    要寫進去的內容
```

🔴 **它是從【文件的實際文字】與【新產出】比出來的**，
不是從 `generate(原樹)` 比——理由見 `research.md` 第一節。

```
第 1 次編輯   跨距 ≈ 整檔（把使用者的排版換成我們的；＝ 今天的行為）
第 2 次之後   跨距中位 1 行
```

⚠️ **兩段都要能被觀察到**——面板讀數要顯示「這次改了幾行」。

### ② `EchoGuard` —— 我們產生了哪些文件版本

```
pending   Set<number>   我們送出的編輯所產生的 version
```

**規則**
```
送出編輯後      把產生的 version 放進來
變更事件進來    version 在集合裡 → 是回音，移除並忽略
                不在集合裡       → 外來變更，重新 lift
上界            🔴 用【數量】不用時間（FR-005）
```

> ⚠️ **為什麼是集合不是一個變數**：連續快速編輯會產生多個版本，
> 而事件是非同步送達的。只記「上一個」會把第一次的回音誤判成外來變更。

### ③ `PanelConfig` —— 從設定解析出來的組態

```
targetId       string
topicId        string | undefined
styleId        string | undefined
blockStyleId   string | undefined
locale         string
```

**解析的優先序**（純函式，測得到）
```
語言層級的覆寫  >  專案層級  >  使用者層級  >  內建預設
```

### ④ `ViewState` —— per-uri 的**外觀**

```
scrollX / scrollY   number
scale               number
blockPositions      Record<blockId, {x,y}>
```

> 🔴 **它是外觀不是真相。** 網頁版沒有檔案，所以積木擺放**就是**真相；
> 在這裡程式碼是真相，擺放只是外觀。
> **同一份資料，換一個宿主就從真相降級成快取。**

⚠️ **而它的 key 會變**：暫存分頁存檔那一刻
`untitled:Untitled-1` → `file:///…`，狀態要跟著搬（SC-012）。

---

## 三、狀態轉移——**兩條線，而它們刻意不對稱**

### 積木 → 程式碼（使用者動了積木）

```
積木事件 → 這次動的有沒有改變語義？
   沒有（純移動）→ 🔴 只更新 ViewState，【不碰文件】
   有             → 產生新全文 → 與文件文字比出 RewriteSpan
                  → 套用（一個復原步驟）→ 記下產生的 version
```

### 程式碼 → 積木（文件變了）

```
文件變更事件 → version 在 EchoGuard 裡？
   在   → 回音，移除並【停止】
   不在 → parse ＋ lift → 重繪積木（🔴 不進 Blockly 的 undo 堆疊）
```

⚠️ **兩條線不對稱是刻意的**：只有「積木 → 程式碼」會產生回音，
因為只有它會寫文件。**反過來不需要對稱的守衛。**

### 切換文件

```
舊文件 → 存 ViewState
新文件 → parse ＋ lift（量過 ≈ 13 ms）→ 讀 ViewState → 套用
```

🔴 **那 18 個 per-document 欄位在這裡【重建】而不是保存**——
它們從文件導得出來，所以它們不是狀態，是快取。

---

## 四、⚠️ 一個本輪不建模、但會被撞到的東西

```
文件被外部改掉，而畫布上有還沒同步的改動
```

本輪的處置是**以文件為準並提示**——
🔴 **而那是一個決定，不是一個機制**：更好的合併策略沒有想。
記在 `research.md` 的「未解」。

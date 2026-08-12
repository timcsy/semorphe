# Implementation Plan：目錄結構的四件小整理

**Spec**: [spec.md](spec.md) ｜ **Research**: [research.md](research.md)
**Branch**: `117-dir-structure-tidy` ｜ **Created**: 2026-08-12

## ⚠️ Phase 0 把四項砍成兩項——先講這個

| | 原 spec | 查證結果 | 結論 |
|---|---|---|---|
| ① `blocks/` 改名 | 整包改成一個名字 | 五個檔裡**只有三個是遷移表** | ✅ **改做「拆三份」** |
| ② 合併兩對分裂 | 分裂是遺留混亂 | ❌ **兩對都是刻意的，理由今天仍成立** | ❌ **取消** |
| ③ `views/` 搬走 | — | 只有一支測試在用 | ✅ 做 |
| ④ `ui/` 分層 | 兩個 Blockly 專屬檔 | ❌ **`toolbox-builder` 碰 Blockly 0 次** | ❌ **取消**，理由見下 |

**兩項取消的理由不同，而兩個都值得記著。**

### ② 為什麼取消：分裂是防禦，不是遺留

兩份 `id-migrations` 的檔頭**都已經寫著**理由（逐字見 research.md）：兩張表的
**鍵長得幾乎一樣而內容完全不同**，放在一起會讓下一次改名腳本的誤傷面積加倍。

而 `block-input-names` 分開是 **P9 的直接後果**：核心側那份若要涵蓋語言積木，
就得 import 語言套件。**合併它們 = 違反 P9 = 第三十九條護欄會紅。**

> **同名不是重複的證據，它只是重複的一種可能長相。**

### ④ 為什麼取消：只有一個檔，而 YAGNI

```
ui/block-registrar.ts   Blockly 388 次   ← 唯一一個
ui/toolbox-builder.ts   Blockly   0 次   ← 只 import core
ui/step-controller.ts   Blockly   0 次
ui/debug-toolbar.ts     Blockly   0 次
```

原本的理由是「2D 面板進來時有乾淨的位置」——而 constitution I 逐字：

> 「**不得過度設計：僅實作當前需求，禁止為假設性未來需求預留擴充**」

而更關鍵的是**那個理由本身站不住**：2D 面板的正確位置是 `ui/panels/`
（那一層是按角色切的，`blockly-panel` 也在那裡），**它不會落在 `ui/` 頂層**
——所以 `block-registrar` 在哪裡不影響它。

⚠️ 保留的觀察：`block-registrar.ts` 2296 行 / 388 次 Blockly，
與旁邊 0 次的檔平起平坐，**確實是誤導的**。而正確的處置是
**把它變小**（宣告化，見 draft），不是搬家。搬家只會讓 2296 行換一個位置。

## 修正後的範圍：兩項

### A. `src/blocks/` 拆三份（FR-001／FR-002／FR-008）

五個檔各歸其位：

```
src/migrations/            ← 三份凍結明表
  block-type-migrations.ts   213 行  v9→v10
  id-migrations.ts           147 行  v2→v5（通用層那半）
  merged-identities.ts        49 行  v1→v2
src/core/block-input-names.ts   85 行  ⚠️ 它住核心側（檔頭明說）
src/languages/universal.ts      19 行  ⚠️ 與既有的 languages/style.ts 同層
src/blocks/                     ← 消失，含兩個空目錄
```

**驗收**：SC-001（無空目錄）、SC-005（`tsc` 綠）、SC-006／SC-007（測試綠）

### B. `src/views/` 併進它唯一的測試（FR-006）

`SemanticTreeView` 36 行，只有 `tests/unit/views/semantic-tree-view.test.ts` 在用。
它是那支測試的 **fixture**，不是可重用的 helper → **併進測試檔**，
`src/views/` 消失。

⚠️ 而它保護的性質（「不靠 Blockly 也能做視圖」）**要確認仍有東西在保護**
——`tests/unit/core/view-registry.test.ts` 的假視圖做的正是同一件事。

## Constitution Check

| 條 | 本計畫 |
|---|---|
| **I. 簡約優先／YAGNI** | ✅ 而它**砍掉了 ④**（為假設性未來預留） |
| **II. TDD（非妥協）** | ⚠️ **這是純搬移，行為不變**——既有 3956 支測試就是那條紅線。不新增測試，而**每一步都要跑全套**（見 tasks 的節奏） |
| **III. Git 紀律** | ✅ 每一個子步驟一個 commit |
| **IV. 規格文件保護** | ✅ 不動 spec/plan/tasks |

⚠️ **II 需要說明**：constitution 說「測試 MUST 在實作程式碼之前撰寫」。
本計畫**不寫新測試**，因為它不新增行為——它的 Red/Green 是
「搬之前全綠 → 搬之後仍全綠」。**若某一步之後測試紅了，那就是它抓到了。**
而 SC-008（存檔實測）是這個計畫唯一需要**新增驗證**的地方。

## Phase 1：搬移順序（由風險低到高）

1. **`views/`**（最低風險：36 行、零產品呼叫者）
2. **`universal.ts` → `languages/`**（8 處 import，全是明確的）
3. **`block-input-names.ts` → `core/`**（2 處 import）
4. **三份遷移表 → `migrations/`**（⚠️ 它們被 `storage-version.ts` import，
   而那是存檔升級路徑的入口）
5. **刪 `src/blocks/`**（含兩個空目錄）
6. **SC-008 存檔實測**

⚠️ **4 與 6 之間不要插入其他工作**——存檔路徑動過之後要立刻驗。

## 不在範圍

- ② 合併遷移表、④ `ui/` 分層 —— 見上方，**兩項都被 Phase 0 否決**
- `interpreter/` 改名、`languages/` 重切、`block-registrar` 宣告化
  —— 原 spec 就排除了，理由見 `draft/2026-08-12-目錄結構對硬體的適配.md` §四

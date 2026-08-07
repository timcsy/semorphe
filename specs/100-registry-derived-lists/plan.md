# 實作計畫：登錄表導出——使用者選得到的東西不該是手寫清單

**Feature**: `100-registry-derived-lists` ｜ **Spec**: [spec.md](spec.md) ｜ **Created**: 2026-08-07

## Summary

補上系統缺的那一格檢查：**使用者拿不拿得到**。

既有的十八條護欄全部在量「做得出來」（五路完備、就近性、中立性、身分健檢）。研究階段實測：**4 顆積木使用者拿不到，其中 3 顆是這個 session 加的**——而其中一顆是在寫完「機制做對了，而使用者拿不到它」那條教訓**之後**加的。

> 一條教訓寫進知識庫，不會讓下一次不發生。**只有機械檢查會。**

## Technical Context

| | |
|---|---|
| 語言／工具 | TypeScript 5.x、Blockly 12.4.1、Vitest |
| 工具箱 | `ToolboxCategoryDef[]`——`registryCategories`（已導出）＋ `extraTypes` **80 筆手寫** |
| `ExtraBlockDef` | **不只是字串**：`{ type, extraState? }`。帶狀態的是教學設計 |
| 課程清單 | `levelTree`，四層 19／20／33／25 顆——**教學漸進線，導不出來** |
| 檔案分類 | `audit-component-identity-review` 已有一份（宣告／清單／實作／清冊）——**抽出來共用** |
| 已知違反 | `cpp_string_find_first_not_of`、`cpp_string_find_last_not_of`、`c_map_assign`、`cpp_istringstream_declare` |

**無 NEEDS CLARIFICATION**——研究階段五個決定全部有實測依據。

## Constitution Check

| 原則 | 判定 | 說明 |
|---|---|---|
| **I. 簡約優先** | ✅ | **不是從零建**——`registryCategories` 已在導出，工作是把 `extraTypes` 的純字串那半消掉。帶 `extraState` 的保留（YAGNI 的反面：不為了「一致」而砍掉教學設計）。 |
| **II. TDD（非妥協）** | ✅ | **護欄先於導出**——順序刻意反過來，見下。 |
| **III. Git 紀律** | ✅ | 護欄／補齊／導出／量測分類 各一個 commit。 |
| **IV. 規格文件保護** | ✅ | 不動 specs/ 既有檔。 |
| **V. 繁體中文優先** | ✅ | |

**設計後複查**：`Complexity Tracking` 記著唯一需要辯護的那一筆。

## Project Structure

### Documentation

```
specs/100-registry-derived-lists/
  spec.md          需求（含對輸入的一處更正）
  plan.md          本檔
  research.md      五個決定，全部有實測
  data-model.md    兩種清單兩種真相；TB／EX／TP／FC 不變式
  contracts/
    toolbox-reachability.md   R-1..R-5 與已知違反
  quickstart.md    護欄先、導出後的驗證順序
```

### Source Code

```
src/languages/cpp/
  toolbox-categories.ts        extraTypes 的純字串那半 → 導出

tests/helpers/
  file-classification.ts       + 抽出共用（宣告／清單／實作／清冊）

tests/integration/
  audit-toolbox-reachability.test.ts   + 新護欄（第十九條）
  audit-curriculum-coverage.test.ts    + 課程清單的兩道檢查
  toolbox-snapshot.test.ts             + 產出一字不差
  audit-locality.test.ts               清單不計入實作擴散
  audit-component-identity-review.test.ts  改用共用的分類
```

## 實作順序（護欄先——順序刻意反過來）

```
① 拍工具箱與課程清單的完整快照（改動前）
      ↓
② 蓋「拿得到」護欄 → **立刻紅 4 筆**，逐一指名
      ↓   ← 先導出的話這 4 筆會被順便修掉，而我們永遠不會知道它們存在
③ 補那 4 筆進工具箱 → 綠
      ↓
④ 課程清單的兩道檢查（懸空引用 → 紅；未收錄 → 報出不算違規）
      ↓
⑤ extraTypes 的純字串那半 → 導出；帶 extraState 的保留
      ↓   ← 快照比對：一字不差
⑥ 檔案分類抽出共用；就近性把「清單」與「實作」分開計
      ↓   ← 數字會下降，**要說明原因並在基線註記**
⑦ 全套 ＋ 護欄複查
```

**② 先於 ⑤ 是硬條件。** 這條與 097 的「先寫轉換再改型別」同一個形狀，但理由不同：那次是為了不弄壞使用者的存檔；**這次是為了不讓缺陷被靜默修掉**。

一個被順便修掉的缺陷，不會留下任何紀錄——而它的同類還會再來。

## Complexity Tracking

| 複雜度 | 為什麼賺得起 | 更簡單的做法為何不夠 |
|---|---|---|
| **`extraTypes` 只消一半** | 帶 `extraState` 的入口（`{ type: 'u_if', extraState: { hasElse } }`）是**教學設計**——「有 else 的 if 值得一個獨立入口」導不出來 | 「全部消掉，一致就好」——那會刪掉三個 if 變體入口，而**沒有測試抓得到那個損失**，它只會讓課程變難教 |

**明確不做的**：把積木 JSON 的 `category` 細分成工具箱分類。那會動 183 顆積木的宣告，而那個欄位還有別的消費者；且「映射與堆疊該分兩個工具箱分類」是教學設計，本來就該是宣告。

## 風險與已備的緩解

| 風險 | 緩解 | 誰會叫 |
|---|---|---|
| 導出後順序被演算法接管 | 步驟 ① 的完整快照 | `toolbox-snapshot.test.ts` |
| 「導出」只是換個地方手寫 | **合成一顆元件**驗證它自動出現 | 新護欄的 R-3 那一支 |
| 課程清單被當全集導出 | 成員不動，只補兩道檢查 | `audit-curriculum-coverage` |
| 為了讓數字好看而改量測 | 分類規則可機械判定 ＋ 雙向注入；**下降要註記原因** | `history/018` 的處方 |
| 那 4 筆被順便修掉 | **② 先於 ⑤** | 護欄第一次跑必須是紅的 |

## Out of Scope

見 [spec.md](spec.md)。特別提醒：**課程清單的成員不動**——只改「怎麼表達」，不改「選了哪些」。

# Research：Phase 0

## ⚠️ 最重要的結果：spec 的 User Story 2 前提是錯的，那一項要取消

spec 寫著：

> 「兩對分裂的遷移表合併——分裂的依據 `layer: universal` **已經是零生產消費者**」

**查證後，那句話的兩半都錯**：分裂的依據不是 `layer: universal`，
而兩對各有各的理由，且**理由今天都仍然成立**。

### ① `id-migrations` 分開，是因為兩張表的鍵長得一樣

兩份的檔頭**都已經寫著**（逐字）：

> 「兩張的內容**完全不同**：一張是通用層的身分、一張是 C++ 的。
> 它們的鍵**長得幾乎一樣**。
>
> spec 116 的改名腳本正是被這種東西咬過——『一個字串在描述現在的世界，
> 還是在描述一個已經過去的世界？**而它們往往長得一模一樣**』」

**那是防禦性的分離**：把兩張鍵幾乎相同、內容完全不同的凍結明表放進同一個檔，
下一次改名腳本掃過來時，誤傷面積加倍。

⚠️ 而分裂只發生在 **V2→V3 與 V3→V4 兩代**：

```
blocks/        UNIVERSAL_V2_TO_V3  UNIVERSAL_V3_TO_V4  V4_TO_V5
languages/cpp/ CPP_V2_TO_V3        CPP_V3_TO_V4        V5_TO_V6 V6_TO_V7 V7_TO_V8 V8_TO_V9
```

**V5 之後就統一了**——也就是說，**這個分裂是歷史的產物，而它已經自己停止了**。
合併它不會讓未來變乾淨（未來本來就統一），只會把兩張危險的表推到一起。

### ② `block-input-names` 分開，是 P9 的直接後果

`languages/cpp/block-input-names.ts` 的檔頭逐字：

> 「## 為什麼要分兩個模組
>
> 那一個只載入 universal 積木——要讓它涵蓋語言積木，它就得引用語言套件，
> 而它住在核心側。**核心不認識語言（P9）**。
>
> 所以正確的形狀是：**語言套件自己提供一份**。語言套件引用自己的宣告檔沒有
> 任何問題，而積木註冊處（在介面層）從兩邊各取所需。
>
> 見 specs/057-single-source-input-names」

**合併它們 = 核心 import 語言套件 = 違反 P9**，而那正是第三十九條護欄在守的東西。

## 教訓：兩個檔名一樣，會讓人以為它們是同一件事

我在提規格時看到

```
block-input-names.ts   blocks/ 85 行   ┃  languages/cpp/ 56 行
id-migrations.ts       blocks/ 147 行  ┃  languages/cpp/ 358 行
```

就判定「這是分裂」，**而沒有打開它們的檔頭**——那兩個檔頭都用一整節在解釋
為什麼分開。

> **同名不是重複的證據，它只是重複的一種可能長相。**

（同族：`experience.md`「一個名字取得夠好，會讓人以為自己已經讀過它了」。
那次是從函式名推行為，這次是從**檔名相同**推「同一件事」。）

⚠️ **而這個錯誤是 spec-kit 的 Phase 0 抓到的**。若直接動手，第一個症狀會是
第三十九條護欄變紅（核心 import 語言套件），而那時已經改了兩個檔。

## 其餘三項的地形

### `blocks/` 改名

`src/blocks/` 被 **20+ 處** import（含 `tests/`）。五個檔的性質：

| 檔 | 行 | 性質 |
|---|---|---|
| `block-type-migrations.ts` | 213 | 凍結明表（v9→v10） |
| `id-migrations.ts` | 147 | 凍結明表（v2→v5） |
| `merged-identities.ts` | 49 | 凍結明表（v1→v2） |
| `block-input-names.ts` | 85 | ⚠️ **不是**遷移表——是插槽名的唯一真相 |
| `universal.ts` | 19 | ⚠️ **不是**遷移表——是通用積木的唯一入口 |

**三份是遷移表，兩份不是。** 所以「整個資料夾改名成 `migrations/`」會製造兩個孤兒。

→ **修正後的做法**：
- `src/migrations/` ← 三份凍結明表
- `block-input-names.ts` 與 `universal.ts` **各自搬到它們該去的地方**

`universal.ts` 的去處：它是「通用積木與概念的唯一入口」，被
`interpreter`／`languages/cpp/all-declarations`／`languages/cpp/module` import。
→ `src/languages/universal.ts`（與既有的 `languages/style.ts` 同層，
那是既有的語言中立檔）。

`block-input-names.ts` 的去處：它住在核心側（檔頭明說），而它讀
`BlockSpecRegistry`。→ `src/core/block-input-names.ts`。

### `views/` 搬走

`SemanticTreeView` 只有 `tests/unit/views/semantic-tree-view.test.ts` 在用。
→ 搬到 `tests/helpers/` 或直接併進那支測試。**併進去更好**——它是那支測試的
fixture，而不是一個可重用的 helper。

### `ui/` 分層

```
ui/block-registrar.ts  2296 行  import Blockly ✓
ui/toolbox-builder.ts           import Blockly ?
```

需要先確認 `toolbox-builder` 是否真的 Blockly 專屬（它可能只產資料結構）。
→ 見 Phase 1 的第一個檢查。

## 修正後的範圍

| | 原 spec | 修正後 |
|---|---|---|
| ① `blocks/` 改名 | 整包改成一個名字 | **拆三份**：遷移表／核心的插槽名／語言中立的入口 |
| ② 合併兩對分裂 | 做 | ❌ **取消**——分裂是刻意的，理由今天仍成立 |
| ③ `views/` 搬走 | 做 | 做（併進它唯一的測試） |
| ④ `ui/` 分層 | 做 | 做（先確認 `toolbox-builder` 的性質） |

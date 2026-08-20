# 155 — P9 的第三個維度：import 耦合

**日期**：2026-08-20 · **上游**：spec `153`／`154` 之後剩下的最後一個盲點

## 出發點：同一族護欄的第三個盲點

```
① 概念身分字面（cpp:print）   中立性護欄掃          → 0 筆
② 積木型別字面（cpp_print）   spec 153 才加         → 33 筆
③ 【import】                 🔴 沒有任何護欄在掃    → 1 筆
```

- **中立性護欄**掃的是**字串字面**——看不到 `import`
- **四項獨立性**只掃 `src/views`／`src/ui`——**不掃 `src/core`／`src/interpreter`**

> **一條護欄的維度是被發現的，不是被設計的**——同一個問題，三次量測才量全。

🔴 **而「無 import」是 P9 原文就寫著的判準**（`principles.md:158` 逐字）：

> 「拔掉 C++，只裝 Python stub → 所有視圖仍啟動，**無 `languages/cpp/` import**」

## 那一筆的實際大小

```ts
src/core/lift/lifter.ts:10    import { buildBlock } from '../../components/cpp/block/lift'
                      :314    if (standalone) results.push(buildBlock(lifted.children.body ?? []))
```

`buildBlock` 全文三行：`createNode('cpp:block', {}, { body })`。
它的檔頭自己寫著「**這裡只提供建構子，讓那一處不必寫死身分字串**」
——⚠️ **而那個「不寫死字串」是靠 import 換來的：字面耦合換成模組耦合。**

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 🔴 第三維被量到 (Priority: P1)

**驗收**：中立性護欄多一維，掃 `NEUTRAL_DIRS` 的**真 import**
（`^import|export … from '…languages/*|components/*'`）；基線 **1**。
⚠️ **組裝點 `src/ui/app.ts` 明確豁免**，而豁免要**印出來**——
否則它的 35 處會讓這一維永遠不是 0。

### User Story 2 - 🔴 那一筆清掉 (Priority: P1)

**驗收**：第三維 1 → 0；`buildBlock` 改由語言套件**宣告**進來
（與 `degradation-blocks` 逐字同形）。

### User Story 3 - 🔴 沒宣告時不得靜靜產生錯的樹 (Priority: P1)

`lifter` 是**每次 lift 都會走**的主路徑。
**驗收**：沒有語言套件宣告時**當場拋錯**，⚠️ **不是**猜一個 `'block'` 身分
——那會靜靜地產生錯的語義樹。

### Edge Cases

- **`src/interpreter` 從來沒被量過** → 一併納入（今天 0，而**那是量出來的 0**）
- **JSON import**（`targets/*.json`）也算 import → ⚠️ 而它們全在 `app.ts`（豁免）

## Requirements *(mandatory)*

- **FR-001**：中立性護欄 MUST 增加第三維，基線 1、只准降
- **FR-002**：三個數字 MUST 一起印——單看任一個都會誤判
- **FR-003**：`lifter` 的 `buildBlock` MUST 改成宣告；未宣告 MUST 拋錯
- **FR-004**：組裝點的豁免 MUST 明確且印出來

## Success Criteria

- **SC-001**：三維 = `0 / 33 / 0`，全部印在同一份報表上
- **SC-002**：另外兩維不得上升
- **SC-003**：全套綠 ＋ e2e 綠 ＋ 瀏覽器實測

## 明確排除

- **`app.ts` 的 35 處**（組裝點）· **`block-registrar` 的 33 筆**（由 Python 逼出來）

## 已知的坑

1. 🔴 **佔位不是預設**（spec 154 的病歷）——而這裡更嚴重：lifter 是主路徑
2. **182 支測試用 `createTestLifter`** → 宣告要放在 `registerCppLifters()` 裡，
   讓兩個組裝點（產品與測試）**自動都有**
3. ⚠️ **注入要編得過**（spec 154 的病歷）——否則「沒跑起來」會被讀成綠的

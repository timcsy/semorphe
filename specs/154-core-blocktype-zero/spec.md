# 154 — 核心層的積木型別歸零

**日期**：2026-08-20 · **上游**：spec `153` 加出來的第二維（基線 44）

## 出發點：核心裡有 11 個 cpp 積木型別

```
src/core/block-input-names.ts          9 筆   getInputs('cpp_if') …
src/core/projection/block-renderer.ts  2 筆   'cpp_raw_code' / 'cpp_raw_expression'
```

🔴 **P9 的驗收是「拔掉 C++ 之後視圖仍能啟動」**——而核心層的違規比視圖層更硬，
因為**核心是所有語言共用的那一份**。

## 🔴 而查清楚之後，那個檔根本不是核心

`src/core/block-input-names.ts` 的 9 個常數：

```
唯一的生產消費者   src/ui/block-registrar.ts（8 個；ARRAY_DECLARE_INPUTS 只剩註解提到）
另外兩個匯出       extractInputNames / getInputs ——只有【測試】在用
```

> **一個只服務單一語言的模組，住在 `core/` 只是位置，不是身分。**

而 `src/languages/cpp/block-input-names.ts` **已經存在**，檔頭逐字：
「與 `src/core/block-input-names.ts` **同一個形狀**，只是涵蓋**語言專屬**的積木。」

🟢 **兩份同形狀的東西，其中一份放錯層。**

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 🔴 核心不再認得任何 cpp 積木型別 (Priority: P1)

**驗收**：中立性第二維 **44 → 33**，而 `src/core/` 那兩檔**歸零**。

### User Story 2 - 🔴 而第一維不得因此上升 (Priority: P1)

⚠️ 把常數搬去 `languages/cpp/` 而讓 registrar **直接 import**，
會讓「其餘 UI 檔」0 → 1——**那是把耦合換個地方**。

**驗收**：`視圖 import 語言 0` 與 `其餘 UI 檔 0` **都不變**；
常數由**組裝點注入**（`setLanguageInputNames`，spec 153 已建好，擴充到 12 個）。

### User Story 3 - 🔴 降級積木的型別由語言套件宣告 (Priority: P1)

`block-renderer` 硬編 `cpp_raw_code`／`cpp_raw_expression`——那是**降級**用的積木。
**驗收**：改成語言套件宣告（與 `comment-syntax`／`variable-dropdown-blocks` 同一個形狀）；
⚠️ **沒有宣告時的行為要誠實**——不是猜一個型別名。

### Edge Cases

- **匯入循環**：`getInputs` 讀 `BlockSpecRegistry`（core）——⚠️ 搬檔案可能讓
  `languages/cpp` ↔ `core` 互相依賴。→ **`getInputs` 這個通用工具留在核心**，
  搬的只是**常數的定義**
- **`ARRAY_DECLARE_INPUTS` 沒有消費者**（只剩一段註解提到它）→ 一併退場
- **`extractInputNames`／`getInputs` 只有測試在用** → 留著（它們是**通用工具**，
  不含任何語言專屬的字）

## Requirements *(mandatory)*

- **FR-001**：`src/core/` MUST 不出現任何元件的積木型別字面
- **FR-002**：registrar 的常數 MUST 由組裝點注入，**不得直接 import 語言套件**
- **FR-003**：降級積木型別 MUST 由語言套件宣告；未宣告時 MUST 誠實降級
- **FR-004**：🔴 兩個維度 MUST 一起看——任一個上升都不算清償

## Success Criteria

- **SC-001**：第二維 44 → 33；`src/core/` 貢獻 0
- **SC-002**：第一維維持 0／0；`直接呼叫視圖` 維持 67
- **SC-003**：全套綠 ＋ e2e 綠 ＋ 瀏覽器雙向實測

## 明確排除

- **`block-registrar` 那 33 筆**（40 顆命令式 cpp 積木）——獨立的大工程，
  🔴 **應該由 Python 逼出來，而不是憑空重寫**
- **`app.ts` 的 35 處組裝點**

## 已知的坑

1. 🔴 **只看一個數字會把搬家當清償**（spec 153 的病歷，第二維就是為它加的）
2. **降級路徑平常跑不到**——`block-renderer` 的 raw_code 是「認不出來」才走到的，
   ⚠️ 改壞了測試多半仍是綠的 → **要有一支直接餵 unresolved 節點的測試**
3. **`getInputs` 的相依方向**——搬錯會製造匯入循環

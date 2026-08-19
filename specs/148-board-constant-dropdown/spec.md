# 148 — 腳位常數的下拉跟著板子走

**日期**：2026-08-19 · **上游**：階段 6.11「屬性的候選值由目標提供」**第四步**

## 出發點：下拉給的是 Uno 的世界

```
今天   cpp_pin_constant 的 VALUE 欄位：HIGH LOW OUTPUT INPUT INPUT_PULLUP A0
       ——六個選項，靜態寫在 forms/blocks.json

而 spec 147 之後                A0 = 14 / 14 / 36 / 0 / 1 / 17 / 17（五個值）
                                D1 mini 還多九個 D 系名字
                                ESP32 真的沒有 A1／A2
```

🔴 **於是 UI 列出一個這塊板子上不存在的名字**——那是**發明**，不是發現。
而學生選了它，執行期會說「`cpp:pin_constant` 不認得這個名字」。

## 🔴 這一刀不是發明機制，是接一條線（前置已對著程式碼驗過）

```
🟢 createOpenDropdown(optionsGenerator)      block-registrar.ts —— 選項是【惰性函式】
                                             → 換目標【不必重註冊積木】
🟢 doClassValidation_ 已覆寫                  不在選項裡的值會被 push 回選項【而不是丟掉】
                                             → 誠實降級所需的機制【已經建好了】
🟢 currentBoard: () => this.currentTarget.board   app.ts:311 —— 提供者模式已在用（執行那側）
🟢 variable-dropdown-blocks.ts（spec 064）    「介面層給機制／語言套件給名單」的分工模板
🔴 BlockRegistrar 拿不到 currentBoard         —— 唯一缺的接線
```

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 學生看到的是自己那塊板子的名字 (Priority: P1)

**驗收**：ESP32 的下拉含 `A0`／`A3–A7`／`A10–A19`，**不含 `A1`／`A2`**；
D1 mini 含 `D0–D8` 與 `A0`，**不含 `A1–A7`**；Uno 含 `A0–A7`，**不含 `D1`**。

### User Story 2 - 🔴 已經放在畫布上的積木不得被靜默改掉 (Priority: P1)

學生在 Uno 下放了一顆 `A6`，切到 C3（沒有 `A6`）。
**驗收**：那顆積木的值**仍然是 `A6`**，不得變成 `HIGH`。
> 一個下拉如果會把它不認得的值換掉，它就會在使用者沒看的時候改掉他的程式。

### User Story 3 - 🔴 沒有板子的目標行為不變 (Priority: P1)

`cpp`／`c`／競程沒有板子；`arduino`（不指定板子）也沒有。
**驗收**：那些目標下這顆積木的選項**與今天逐字相同**（五個共通常數）。

### Edge Cases

- **常數不只腳位**：`HIGH`／`LOW`／`INPUT`／`OUTPUT`／`INPUT_PULLUP` 也在
  `board.constants` 裡 → 它們**每塊板子都在**，所以「選項 ＝ 常數表的鍵」直接成立
- **順序**：常數表的鍵順序來自 JSON，而 `HIGH`／`LOW` 在前是刻意的
  ——⚠️ **不要排序**，那會把最常用的推到 `A10` 後面

## Requirements *(mandatory)*

- **FR-001**：`cpp_pin_constant` 的 `VALUE` 選項 MUST 來自**目前目標的** `board.constants`
- **FR-002**：🔴 `forms/blocks.json` 的靜態 `options` MUST **刪掉**，不得留作備援
      （spec `144` 才因為同一個形狀刪掉 `properties.values`；這次錯的方向會反過來）
- **FR-003**：介面層 MUST 不認識任何具體的目標名字——名單由**宣告**來
- **FR-004**：沒有板子時 MUST 退回今天的五個共通常數
- **FR-005**：不在選項裡的既有值 MUST 保留（機制已存在，這裡只是不得破壞它）

## Success Criteria

- **SC-001**：四塊板子的下拉內容互不相同，且與各自的 `board.constants` 逐鍵相符
- **SC-002**：切目標之後，畫布上的積木值不變、積木不消失
- **SC-003**：`pin_constant` 的靜態 options 歸零
- **SC-004**：全套測試綠，非硬體目標零變更

## 明確排除

- **其餘 39 個 enum 屬性**——沒有第二個消費者（憲法第一條）
- **`pinMode` 的腳位**——是 `input_value`，**沒有下拉**（vision 已實測否決）
- **被佔用的腳位／腳位方向**——spec 147 已列為已知缺口

## 已知的坑

1. 🔴 **這一刀最可能製造的錯是【留著備援】**：blockDef 的 options 會變成過期的那份
2. **可拿性護欄量不到下拉內容**（它只問「宣告了拿不拿得到」）→ **必須開瀏覽器**
3. **四項獨立性 #39**：介面層要板子資料，而 `BoardPinModel` 住在 `core/types.ts`——別搬
4. **`createOpenDropdown` 目前是 private**，且只被變數下拉用——共用時不要改它的驗證行為

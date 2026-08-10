# Feature Specification: 參數列工廠——把已經重複的兩份合成一份

**Feature Branch**: `107-params-row-factory`
**Created**: 2026-08-10
**Status**: Draft

**Input**: `u_func_def` 與 `c_forward_decl` 的參數列是同一份程式碼的兩份拷貝，而且已經漂移。

---

## 問題

```
loadExtraState   100% 相同
minusParam_       96%
saveExtraState    92%
plusParam_        89%
rebuildParamLabels_ 33%   ← 一半是假的差異（分支順序、中間變數）
```

三個變異點**全部是資料不是邏輯**：要不要名字欄位／括號的標籤／插在哪個 input 之前。

**而它已經漂移**：`c_forward_decl` 的括號寫死 `"("`／`")"`，
`u_func_def` 走 `Blockly.Msg`。**那是抄過去時漏掉的，不是設計。**

> 抽出工廠不是為了讓別的積木好升級，是**因為它已經重複了**——
> 而重複的兩份已經開始各自演化。

## ⚠️ 這次沒有自動化安全網

`block-registrar.ts` 的 12 對 `plus_`／`minus_` **零行為覆蓋**：

- `happy-dom` 跑不動 Blockly 12 的 FocusManager（vision 記過）
- `renderToBlocklyState` 產的是純 JSON，**完全不經過 `Blockly.Blocks`**
- `block-registrar.test.ts` 的四支測試是 **grep 檔案文字**
  （「檔案裡要有 `saveExtraState` 這個字串」），不是行為

**唯一的 oracle 是瀏覽器。** 這不是可省的一步，是這次的**主要驗收手段**。

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 兩顆積木的行為完全不變 (Priority: P1)

**Independent Test**：在瀏覽器裡對兩顆積木各做一輪「加三個參數 → 減兩個 →
存檔 → 重載」，行為與改動前一致。

**Acceptance Scenarios**:

1. **Given** 函式定義積木，**When** 連按三次 `+`，**Then** 出現三組
   「型別下拉 ＋ 名字輸入」，以逗號分隔，外面包著括號標籤。
2. **Given** 前向宣告積木，**When** 連按三次 `+`，**Then** 出現三個
   **只有型別下拉**的欄位（前向宣告不需要名字）。
3. **Given** 任一顆有參數的積木，**When** 存檔後重新載入，
   **Then** 參數的數量與內容都回得來。
4. **Given** 參數數量為 0，**When** 看減號按鈕，**Then** 它是**停用**狀態。
5. **Given** 兩顆積木各自產生的程式碼，**When** 與改動前比對，**Then** 逐字相同。

---

### User Story 2 - 第三顆要用參數列時，只寫宣告 (Priority: P2)

**Why this priority**: 這是抽工廠的**唯一長期收益**。

**Acceptance Scenarios**:

1. **Given** 一顆新積木要參數列，**When** 加上它，
   **Then** 只需要提供三個變異點的值，不複製任何行為程式碼。

---

### Edge Cases

- **`c_forward_decl` 的括號目前沒有 i18n**：統一走 `Blockly.Msg` 之後，
  **在對應的翻譯鍵不存在時 fallback 必須是原本那兩個字元**，
  否則這是行為改變而不是修正。
- **`u_func_def` 的 `PARAMS_END` 要移到 `BODY` 之前，而 `c_forward_decl` 沒有 body**：
  工廠必須能接受「不移動」。
- **`loadExtraState` 靠反覆呼叫 `plusParam_` 重建**：工廠不得改變這個機制，
  否則舊存檔載不回來。
- **那四支 grep 測試釘的是檔案文字**：把行為搬到別的檔案會讓它們變紅，
  而那是**錯誤的理由**——能力沒有消失，只是被共用了。

---

## Requirements *(mandatory)*

- **FR-001**: 兩顆積木的參數列行為 MUST 由**同一份**程式碼提供。
- **FR-002**: 三個變異點 MUST 以**宣告**的形式傳入，不得以分支判斷積木型別實作。
- **FR-003**: 兩顆積木的**可見行為 MUST 完全不變**，包含括號標籤的實際顯示文字。
- **FR-004**: 舊存檔（含 `paramCount`）MUST 仍然載得回來。
- **FR-005**: 本次改動 MUST NOT 改變任何積木型別名或元件身分，
  因此 MUST NOT 需要存檔遷移。
- **FR-006**: 驗收 MUST 包含瀏覽器實測——這次沒有自動化替代品。

---

## Success Criteria *(mandatory)*

- **SC-001**: 參數列的行為程式碼從 **2 份變 1 份**。
- **SC-002**: 兩顆積木的瀏覽器實測（加／減／存檔重載）全部通過。
- **SC-003**: 產生的程式碼與改動前**逐字相同**。
- **SC-004**: 全套測試綠（含那四支 grep 測試——若變紅要證明是**文字**問題而非行為問題）。
- **SC-005**: 加第三顆參數列積木**不需要複製任何行為程式碼**。

---

## Assumptions

- **工廠放在 `block-registrar.ts` 內**，不另開檔案。理由：只有這個檔用得到它，
  而那四支 grep 測試釘著這個檔的文字——搬走會讓它們因為錯誤的理由變紅。
- **括號改走 `Blockly.Msg` 並附原字元 fallback**，所以在翻譯鍵補上之前顯示完全不變。
- **不碰 B／C 家族**（另外十份），也不碰 lambda 那六顆。

---

## Out of Scope

- B 家族（運算式列，5 份）與 C 家族（變數選擇列，5 份）
- lambda 等六顆從文字欄位升級成參數列——**那是教學決定**，判準見 `specs/105`
- 積木型別改名／`u_` 前綴（要綁在 F 裡做，見 `draft/掀出來但還沒做的`）
- 給那 12 對 `plus_`／`minus_` 補行為測試——需要真瀏覽器 ＋ CI，要人拍板

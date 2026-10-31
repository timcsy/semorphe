# Feature Specification: Cella 的除錯工作階段——跑、停、看變數、改輸入改走 Cella

**Feature Branch**: `183-cella-debug-session`
**Created**: 2026-10-31
**Status**: Draft
**Input**: 重構階段 5b（vision：「`session` 走 `cella-lang/dap`（變數、步數、輸入）」）。5a（spec 182）已讓 Cella 的判決被學生看到；
這一段讓**執行與除錯**也由 Cella 給——同一個模型同時回答「對不對」與「跑起來怎樣」，不再是兩份語意。
設計來源：`knowledge/draft/2026-10-31-重構的設計-能力介面與降級路徑.md`（二、形狀；四；五之一）。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 執行與單步由 Cella 跑（Priority: P1）

學生按「執行」或「單步」，程式由 Cella 跑：輸出一樣出現在主控台、單步時那一塊積木亮起來、變數面板有每個變數的值。
停下來的原因（中斷點、單步、等輸入、未定義行為、未捕捉的例外）都看得到「停在哪一塊、為什麼」。

**Why this priority**: 這是 5b 的本體。判決（5a）與執行若各走一份語意，學生會看到「判決說越界、執行卻印出一個數字」——同一支程式兩種說法。

**Independent Test**: 寫一支有迴圈與變數的程式，按單步走完：每一步亮的積木、變數面板的值、最後的輸出，與 Cella 的判決（`out`）一致。

**Acceptance Scenarios**:

1. **Given** 判斷功能已就緒、一支翻得出來的程式，**When** 按「執行」，**Then** 輸出與 Cella 判決的 `out` 逐字相同，狀態列標出由 Cella 執行
2. **Given** 在某一塊設了中斷點，**When** 執行，**Then** 停在那一塊、那一塊亮起、變數面板有值
3. **Given** 停在中斷點，**When** 按單步，**Then** 下一塊亮起、變數面板更新
4. **Given** 一支越界讀取的程式，**When** 執行，**Then** 停在那一塊、說明是未定義行為並附條文，不印出一個假的數字

---

### User Story 2 - 讀輸入時停下來等（Priority: P1）

程式讀輸入而輸入不夠時，執行停下來、主控台出現輸入框；學生打字送出後繼續。課文題目有測資時，照測資餵。

**Why this priority**: 課文大半的程式會讀輸入；這一條不通，5b 等於只對一半的課有效。

**Independent Test**: 一支 `cin >> n` 的程式，執行 → 停在讀取那一塊、跳出輸入框 → 輸入 `3` → 印出依 3 算的結果。

**Acceptance Scenarios**:

1. **Given** 讀輸入的程式、沒有預先給的輸入，**When** 執行，**Then** 停在讀取的那一塊並等輸入
2. **Given** 停下等輸入，**When** 送出一行，**Then** 從那裡繼續，輸出反映那一行
3. **Given** 停在中斷點，**When** 在變數面板改一個變數的值再繼續，**Then** 之後的輸出反映改過的值，且這次執行標記為「有人插手過」

---

### User Story 3 - Cella 判不了的程式誠實退回（Priority: P1）

Cella 還翻譯不了的程式（例如用到還沒建模的容器）照樣跑得動——由今天的 JS 直譯器跑，**而畫面上看得出來這次是誰跑的、為什麼**。

**Why this priority**: 階段 6 之前兩個提供者並存；不退回的話，一半的課文跑不動。退回而不標，就違反 P6「必須可見」。

**Independent Test**: 一支用 `map` 的程式，執行 → 照常跑完，狀態列寫著由 JS 直譯器執行、原因是 Cella 還不支援哪一塊。

**Acceptance Scenarios**:

1. **Given** formalize 翻不出來的程式，**When** 執行，**Then** 由 JS 直譯器跑完，並標出處與原因
2. **Given** Cella 還在載入或無法使用，**When** 執行，**Then** 由 JS 直譯器跑，標出處；不等 Cella
3. **Given** 同一支程式改成翻得出來的寫法，**When** 再執行，**Then** 改由 Cella 跑

---

### Edge Cases

- 無窮迴圈：步數用盡時停下，說「跑太久了」，不凍住頁面（worker 裡跑，主執行緒不卡）
- 執行到一半學生改了程式：照今天的行為（停止這次執行），舊的工作階段丟掉
- 「停止」按鈕：任何時候都能結束工作階段
- 加速／跳過一整層（`e2e/debug.spec.ts` 的第三支）：保留，或在 spec 裡明說 Cella 路徑上暫不支援並退回
- 板子上的程式（Arduino）：本段只做到「跑得動、輸出正確」；腳位與時間軸是 5c

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Cella 提供者 MUST 宣告 `session`（粒度 node、`setInput` 是、`setVariable` 是、`steps` 是），排在 JS 直譯器前面
- **FR-002**: 執行、單步、中斷點、繼續、停止 MUST 能由 Cella 的工作階段完成，主執行緒不因執行而卡住
- **FR-003**: 每一種停下的原因 MUST 帶出「停在哪一塊」與當時的變數（`experience`〈一個「暫停」如果沒有把狀態一起帶出來，它只是一個比較慢的錯誤〉）
- **FR-004**: 讀輸入不夠時 MUST 停下來等，送出後繼續；課文有測資時照測資餵
- **FR-005**: 改變數值後繼續 MUST 影響之後的執行，並記錄為「有人插手過」
- **FR-006**: 未定義行為、未捕捉的例外 MUST 停在那一塊並說明（中文＋條文）
- **FR-007**: Cella 無法執行這支程式（翻不出來、尚未就緒、無法使用）時 MUST 退回 JS 直譯器，並在畫面上標出處與原因
- **FR-008**: 執行結果 MUST 帶出處（哪個提供者跑的）——核心與介面不認得提供者的名字，只顯示它給的出處
- **FR-009**: 既有的除錯與執行 e2e MUST 照樣綠（不論由哪個提供者跑）

### Key Entities

- **工作階段（Session）**：一次執行；有狀態（跑、停、結束）、目前的位置（節點）、變數、已給的輸入、插手紀錄
- **停下的原因**：中斷點／單步／等輸入／未定義行為／例外／步數用盡／停止
- **出處（Provenance）**：哪個提供者跑的、退回時的原因

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 翻得出來的課文解答，由 Cella 執行的輸出與課文宣告的答案逐字相同的比例，不低於今天由 JS 直譯器執行的比例
- **SC-002**: 既有的執行與除錯 e2e 零支因這一段變紅
- **SC-003**: 單步一次（從按下到積木亮起）在一般課文程式上 0.3 秒內
- **SC-004**: 每一次退回 JS 直譯器，畫面上都看得到出處與原因（e2e 斷言）

## Assumptions

- 5a 的 worker、快取、`entry.ts`、formalize 都直接沿用；DAP 模組與判決模組一樣可以編好後快取（cella 確認「編好的模組可獨立載入」是承諾的介面）
- 判題（課文 check）仍走今天的路；改用 `verdict` 是階段 6 的事
- VSCode webview 不在這一段驗（與 5a 同）
- 範圍外：硬體時間軸與腳位（5c）、拆 JS 直譯器（6）、Python（7）

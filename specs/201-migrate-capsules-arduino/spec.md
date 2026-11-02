# Feature Specification: 膠囊自證測換判準——第三批：Arduino（重構 6c-2c）

**Feature Branch**: `226-migrate-capsules-arduino`
**Created**: 2026-11-02
**Status**: Draft
**Input**: 6c 測試盤點 B-1 難度「中」裡讀腳位、時鐘、Serial、零件模擬的 15 個膠囊自證測，執行判準從 JS 直譯器（`runtime/arduino-pins`、`arduino-clock`）換成 Cella 的板子判決。

## 背景

`@cella-lang/arduino` 的判決除了 `out` 之外帶 `pins`（每一次腳位變化 `{t, pin, value}`）與 `env`（結束時的硬體：`clockUs`、`loops`、每支腳的 mode／level／pwm／toneHz、servos、lcds、eeprom）。
環境輸入（類比讀值、數位準位、`pulseIn` 的脈衝寬度、DHT…）放在程式 JSON 的 `inputs`。有 setup／loop 而沒有 main 的程式照草稿碼跑：setup 一次、loop 跑到模擬的 5 秒。

這一批：tone、pwm_write、ultrasonic_trigger、micros、delay、pin_mode、analog_read、pulse_read、servo_write、pin_attach、pin_constant、serial_print、serial_count、analog_resolution、time。

範圍外：`program`（進入點語義）與 `var_ref/gap`（錯誤訊息）屬 6c-3。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Arduino 膠囊的執行斷言改由 Cella 的板子判決背書（Priority: P1）

**Independent Test**: 15 個檔各自單獨跑全綠；檔內不再引用 JS 直譯器與 `runtime/arduino-*`。

**Acceptance Scenarios**:

1. **Given** 斷言 Serial 輸出的測試，**When** 換成 `runCella(code, { board })`，**Then** 同一個期望值成立（注意 `println` 印 `\r\n`）。
2. **Given** 斷言腳位狀態（模式、準位、PWM、音調頻率）的測試，**When** 改讀 `boardPin(r, pin)`／`r.raw.pins`，**Then** 斷言照樣成立。
3. **Given** 斷言時鐘的測試，**When** 改讀 `boardEnv(r).clockUs` 或輸出的 `millis()`／`micros()`，**Then** 依 Cella 的板子模型（例如 Uno 的 millis 每 1.024ms 一跳）判斷期望值；改了期望值要附依據。
4. **Given** 讀感測器的測試，**When** 改用 `inputs`（`analog:A0`、`echo:10`…），**Then** 讀到給定的值。
5. **Given** Cella 判錯、未支援、或我們缺 formalize，**Then** 用 `knownCellaGap` 釘住；能補的 formalize（照 Cella 的 README 形狀）就補。

### Edge Cases

- 斷言的是 JS 直譯器的模擬細節而真實板子不是這樣 → 依板子模型改期望值並附依據。
- `time(0)`（與 JS 時鐘比）：Cella 是確定性模型——判斷 Cella 的答案是否合理（例如固定值或 unknown），改成斷言那個性質。

## Requirements *(mandatory)*

- **FR-001**: 15 個檔的執行斷言 MUST 改用 `tests/helpers/cella-run.ts`（`runCella` 的 `board`／`inputs`、`boardEnv`、`boardPin`）。
- **FR-002**: 改完的檔 MUST NOT 引用 JS 直譯器（`SemanticInterpreter`、`src/interpreter/*`、`runtime/arduino-*`）。
- **FR-003**: lift／generate／round-trip 那幾條 MUST 不動。
- **FR-004**: 期望值改動 MUST 逐條附依據；反向測試 MUST 斷言具體判決種類或原因。
- **FR-005**: Cella 那側的問題 MUST 回報；我們這側能補的 formalize 補上（對應基線照實調）。

## Success Criteria *(mandatory)*

- **SC-001**: 15 個檔全綠，零 skip。
- **SC-002**: 15 個檔對 JS 直譯器的引用歸零。

## Assumptions

- 從 225 分出（帶 knownCellaGap）；Cella 0.1.202611020258。
- `pin_constant` 從 `./execute` import `PIN_CONSTANTS`：測試若只為拿表而 import execute，可保留到 6c-4 刪 execute.ts 時一起搬（這一刀不刪 execute.ts）。

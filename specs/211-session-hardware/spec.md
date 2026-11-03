# Feature Specification: 執行工作階段交出板子紀錄（狀態流頻道 (b)）

**Feature Branch**: `249-session-hardware`
**Created**: 2026-11-04
**Status**: Implemented
**Input**: cos-mos 階段 3 第 1 條「UI 協定的搬運」的狀態流頻道（history/003 Q14）。semorphe 推薦 (b)：只能跑到底的提供者**跑完一次交出**整條時間軸，形狀沿用判決那一路的 `HardwareRecord`；cos-mos 2026-11-04 照做（上限 1000 筆、超過標 truncated；`end` 給 null；`t` 是 delay 推進的虛擬毫秒；`value` 0／1，沒有 PWM）。

## 背景
硬體分頁的時間軸今天**從判決來**（`check` 的 `pins`／`env` → `hardwareOf`），不是從「執行」那一次。cos-mos 的宿主跑學生程式時逐筆記下 pin-write 與 delay，要能交給面板。

## Requirements
- **FR-001**: `SessionDetails` MUST 有 `hardware`（必填）；`ExecutionSession` 有選用的 `hardware(): HardwareRecord | null`——跑之前 null，`ended`／`failed` 之後交出。
- **FR-002**: 控制器在跑完或出錯時，提供者給得出紀錄就送 `execution:hardware-record`，**排在「回到判決那一份」之後**；硬體分頁優先畫它，下一次判決再換回。
- **FR-003**: 契約有一條依 `hardware` 宣告的條目（跑之前 null、ended 之後交出、`t` 由 delay 推進）。
- **FR-004**: Cella 今天宣告 `hardware: false`（時間軸照舊從判決來），行為不變。

## Success Criteria
- **SC-001**: 兩個 Cella 提供者照宣告跳過那一條；cos-mos 的提供者試接時那一條要過。

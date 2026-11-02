# Implementation Plan: 膠囊自證測換判準——第三批：Arduino（6c-2c）

**Branch**: `226-migrate-capsules-arduino` | **Spec**: [spec.md](spec.md)

## 技術脈絡

TypeScript 5.x、Vitest。`tests/helpers/cella-run.ts` 這一刀加了：`runCella` 的 `board`（有板子時步數預設 5,000 萬，與產品同）、`inputs`；結果帶 `raw`（判決 JSON 原樣）；`boardEnv(r)`、`boardPin(r, pin)`。

## 憲章檢查

- 測試先行：改的就是測試；紅了逐條判斷誰對。P6：判不出來不得算過（knownCellaGap 要求原因吻合）。

## 做法

分兩組並行（不同檔）：腳位與零件（tone、pwm_write、ultrasonic_trigger、pin_mode、analog_read、pulse_read、servo_write、pin_attach、pin_constant）；時間與 Serial（micros、delay、serial_print、serial_count、analog_resolution、time）。
缺 formalize 的（pwm_write、micros、pin_attach、analog_resolution）先查 Cella 的 Arduino 模型有沒有那個函式，有就補。

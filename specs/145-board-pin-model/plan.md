# 實作計畫：腳位的界由板子決定

**Branch**: `145-board-pin-model` · **Date**: 2026-08-19 · **Spec**: [spec.md](spec.md)

## Summary

`Target` 多一格 `board?: { maxPin, constants }`，執行器透過
`SemanticInterpreter` 的既有組態拿到它。⚠️ **越界仍然拋錯**，而訊息說得出是哪一塊板子。

## Technical Context

**依賴**：無新增 · **測試**：`npm test`（護欄 53 條）
**規模**：`Target` 一格 · `arduino-pins.ts` 收斂成可注入 · 三個板子 JSON 各一段 · 測試一支

**Unknowns**：無（四個問題見 [research.md](research.md)）。

## Constitution Check

| 條 | 判定 |
|---|---|
| **I. 簡約優先** | 🟢 只做「界 ＋ 常數表」；🔴 **明確否決**「只能輸入的腳位」「PWM 通道數」——無當前需求 |
| **II. TDD** | 🟢 測試先寫，⚠️ **US2（越界仍拋錯）先於 US1** |
| **III. Git 紀律** | 🟢 |
| **IV. 規格文件保護** | 🟢 |
| **V. 繁中優先** | 🟢 |

### Phase 0 這次改了規格嗎

**沒有**——而理由與 spec 143 相同：**規格自己就是一次量測的產物**
（它的出發點整節在講「路線圖寫的那件事不存在」）。
Phase 0 查的是**下游**（那格放哪、怎麼流過去），而規格**刻意沒有決定**那些
（坑 #2 明寫「plan 要論證，不得默默塞進去」）。

## 🔴 不可交換的順序

```
① US2 的測試（越界仍拋錯）   ← 先寫，此時是【綠】的
② Target.board ＋ 注入
③ US1 的測試（ESP32 25 號腳位跑得起來）
```

⚠️ **①先於②**：這一刀最可能的失敗是**把界拿掉就不會錯了**。
①先在「還沒有板子模型」的世界裡釘住「越界會拋錯」，②之後它才是真的防線。
🟡 而 ① 第一次跑是綠的——靠 ③ 當它的注入（②之前 ③ 必須紅）。

## Project Structure

```
src/core/types.ts                              Target 加 board?
src/languages/cpp/core/runtime/arduino-pins.ts 收斂成可注入（今天寫死 Uno）
src/languages/cpp/targets/{arduino-uno,arduino-nano,esp32}.json   各加 board
src/interpreter/…                              組態多一格 board
tests/integration/board-pin-model.test.ts      US1 ＋ US2
```

## Complexity Tracking

| 新增的複雜度 | 當前需求 | 為什麼不能更簡單 |
|---|---|---|
| `Target.board` 一格 | ESP32 學生的 25 號腳位被擋 | 🔴 **不塞進 `provides`**——那是「有沒有」，這是「是多少」（R1） |
| 執行期組態多一格 | 執行器today 不認識目標 | 走**既有的** `SemanticInterpreter({...})`，不新開通道 |
| ~~方向能力（只能輸入）~~ | ❌ 無當前需求 | 憲法 I 否決 |

## 風險與對策

| 風險 | 對策 |
|---|---|
| 🔴 把界拿掉 | US2 先寫（順序①）；`arduino-pins.ts` 檔頭記著界存在的理由 |
| 三塊板子從一塊推論 | Uno／Nano 逐塊斷言 |
| 非 Arduino 目標受影響 | 省略 `board` ＝ 沒有板子；C／C++／競程測試逐支比對 |
| ESP32 給錯的 `A0` | R4：**查不到**而不是給 Uno 的值 |

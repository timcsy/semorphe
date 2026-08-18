# Round-Trip 測試結果：C++ — Arduino 零件（第 1 批）

> 對象：`cpp:pin_attach` · `cpp:ultrasonic_trigger`
> 測試檔：`tests/integration/roundtrip-cpp-arduino-components.test.ts`（永久，7 條）
> 上游：`specs/concepts/cpp-arduino-components.md`　同批：`roundtrip-cpp-arduino-builtins.md`（第 0 批）

## ⚠️ 宣稱範圍：**不含編譯與執行比對**

`g++` 編不動 sketch（沒有 `Arduino.h`），而本專案沒有接 `arduino-cli`。
本檔量的是**辨識、產生、round-trip 穩定性、與概念身分**——**不是**行為等價。
（第 0 批的報告有同一段聲明。）

## 結果

| # | 場景 | 概念 | 結果 |
|---|---|---|---|
| ① | 完整 HC-SR04 | pin_attach ×3 · ultrasonic_trigger · pulse_read · tone · tone_stop · pin_mode · serial_* · delay | ✅ PASS |
| ② | 紅綠燈 | pin_attach ×3 · digital_write · delay · pin_mode | ✅ PASS |
| ③ | L298N 馬達 | pin_attach ×3（device 全 unknown）· analog_write · digital_write | ✅ PASS |
| ④ | 混合陷阱 | pin_attach ×1 ＋ var_declare_const ×2 | ✅ PASS |
| ⑤ | 回歸：入口條件 | — | ✅ PASS |
| ⑥ | 回歸：不相干語料不得誤認 | — | ✅ PASS |
| ⑦ | 回歸：殘差零 | — | ✅ PASS |

**摘要：7/7 PASS · 文字漂移 0 · 結構漂移 0 · 殘差 0**

## 🔴 這一批的假陽性形狀特別，所以測法不同

`pin_attach` 降級成常數宣告時，**產出的程式碼一字不差**：

```cpp
const int ledPin = 13;      ← 兩種身分產出的文字完全相同
```

> **當兩個身分的投影一字不差時，只驗投影的測試永遠是綠的。**

所以每一段都斷言**身分與屬性**（`device` / `pin` / `name`），不只斷言輸出。
④ 那段就是為此存在：三個 `const int`，只有一個該被認走，而**三行輸出都一樣**。

## 🔴 只有這一批才有的軸：不該認的時候，不認

`ultrasonic_trigger` 的策略跑在**每一個 `compound_statement` 與每一個
`translation_unit`** 上——它有能力改變任何一支程式的辨識結果。

⑥⑦ 拿真實語料（挑掉真的用到這兩顆的段落）斷言兩件事：

```
誤認     這兩顆的身分一次都不得出現
吃掉別人  殘差（raw_code／raw_expression）必須是零
```

⚠️ 兩條都先釘正向錨點（`totalNodes > 200`）——**一支空過的測試與健康的長得一樣**。

## 場景 ③ 是設計本身的證據

```
const int ENA = 5;  IN1 = 6;  IN2 = 7;   ＋ analogWrite / digitalWrite
→ 三顆都是 pin_attach，而 device 三顆都是 unknown
```

L298N 的慣例腳位名在 100 段語料裡是**成系統的一族**（`ENA`／`IN1`／`IN2`／
`GATE_R/G/B`）——名字裡真的沒有零件資訊。

> **退的是標籤，不是結構。**

而那正是「辨識不出來 → 退回原始積木打底」的精確版本：學生看到三顆
「接上零件到腳位」，而不是三顆猜錯的 LED。

## 沒有發現需要修的 bug

⚠️ 這一階段**零 `it.todo`**。
（階段二已經修掉兩個：執行器沿用錯誤、`PatternLifter` 的落空分支。）

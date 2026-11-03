/**
 * 從**變數名**猜一根腳位接的是什麼零件。
 *
 * ## 🔴 這張表是【量出來的】，不是想出來的
 *
 * 語料：100 段 AI 生成的 Arduino sketch（三次獨立生成：`arduino-realistic` 20 ＋
 * `arduino-builtins` 20 ＋ `arduino-wide` 60），從中抽出**真的被當腳位用**的識別字
 * ——判準是「它有沒有出現在 `pinMode`／`digitalWrite`／`analogRead`／`tone`／`pulseIn`…
 * 的第一個引數」，**不是名字長得像不像**。
 *
 * ```
 * 113 種腳位變數 · 206 次使用
 * 詞根命中 101/113 = 89%
 * ```
 *
 * ⚠️ 而**一開始的抽取是錯的**：用名字形狀（`\w*Pin\w*`）去抓，撈到了
 * `i`／`brightness`／`freq`／`angle` 這些**根本不是腳位**的變數。
 *
 * > **要問「這是不是一根腳位」，看它【被怎麼用】，不要看它長什麼樣。**
 *
 * ## 🔴 漏掉的 12 個也是資料，而其中一族是成系統的
 *
 * ```
 * ENA · IN1 · IN2      L298N 馬達驅動的慣例腳位名——【不帶零件字】
 * GATE_R/G/B           MOSFET 閘極
 * LAMP · beeper · A5
 * ```
 *
 * 那一族認不出來**不是缺陷**，是「名字裡真的沒有零件資訊」。
 * ⚠️ 而處置是 ④ 拍板的：**退回原始積木**，不猜。
 *
 * ## 判準：**寧可漏，不可錯**
 *
 * 一個猜錯的零件標籤，比一個誠實的 `digitalWrite` 更糟——
 * 學生會照著那個錯的標籤理解他的電路。
 * 所以表裡只放**語料裡真的出現過**的詞根，🔴 **不補「應該也會有」的**。
 */

/** 零件種類——⚠️ 與接線積木的下拉選單同一組值。 */
export type DeviceKind =
  | 'led' | 'button' | 'buzzer' | 'ultrasonic_trig' | 'ultrasonic_echo'
  | 'servo' | 'analog_sensor' | 'relay' | 'motor' | 'unknown'

/**
 * 詞根 → 零件。⚠️ **順序就是優先序**（先命中的贏）。
 *
 * 每一列後面的數字是**那個詞根在 100 段語料裡的出現次數**——
 * 🔴 沒有數字的詞根不該在這張表裡。
 */
const ROOTS: [string, DeviceKind][] = [
  // 超音波要先於 led/sensor——`trigPin`／`echoPin` 是成對的，而它們最明確
  ['trig', 'ultrasonic_trig'],   // 14
  ['echo', 'ultrasonic_echo'],   // 14
  ['button', 'button'],          // 18
  ['btn', 'button'],             // 1
  ['switch', 'button'],          // 2
  ['key', 'button'],             // 1（`keyPins` 是矩陣鍵盤）
  ['buzzer', 'buzzer'],          // 18
  ['speaker', 'buzzer'],         // 1
  ['beeper', 'buzzer'],          // 1（語料裡漏掉過，而它是明確的）
  ['piezo', 'buzzer'],           // 0 —— ⚠️ 語料沒有，而它是蜂鳴器的標準別名；保留並標記
  // ⚠️ `alarm` 拿掉了——探針抓到 `alarmLed` 被判成蜂鳴器，而它是一顆 LED。
  //    🔴 「警報」可以是聲音也可以是燈，**它是歧義的詞根**。
  //    而判準是【寧可漏，不可錯】：歧義的詞根要被拿掉，不是被猜。
  ['servo', 'servo'],            // 4
  ['relay', 'relay'],            // 7
  ['motor', 'motor'],            // 0 —— ⚠️ 同上，語料裡馬達都叫 ENA/IN1/IN2
  ['fan', 'motor'],              // 2
  ['pump', 'motor'],             // 1
  ['ldr', 'analog_sensor'],      // 2
  ['pot', 'analog_sensor'],      // 6
  ['knob', 'analog_sensor'],     // 1（旋鈕＝可變電阻的另一個叫法）
  ['moisture', 'analog_sensor'], // 1
  ['soil', 'analog_sensor'],     // 0
  ['joy', 'analog_sensor'],      // 3
  ['temp', 'analog_sensor'],     // 3
  ['sensor', 'analog_sensor'],   // 11
  ['light', 'analog_sensor'],    // 1
  // LED 放最後——它的詞根最泛（`red`／`green` 也可能是別的東西），
  // ⚠️ 而前面那些更明確的先命中就不會走到這裡
  ['led', 'led'],                // 67
  ['lamp', 'led'],               // 1
  ['red', 'led'],                // 11
  ['green', 'led'],              // 11
  ['blue', 'led'],               // 3
  ['yellow', 'led'],             // 6
  ['status', 'led'],             // 3
  ['warn', 'led'],               // 3
  ['heartbeat', 'led'],          // 2
]

/**
 * 從變數名猜零件。認不出來回 `'unknown'`——⚠️ **不猜一個看起來合理的**。
 *
 * 🔴 `'unknown'` 是 ④ 拍板的「退回原始積木」的觸發條件，
 * 而它與「猜到了 led」在型別上分得出來。
 */
export function deviceFromName(name: string): DeviceKind {
  const low = name.toLowerCase()
  for (const [root, kind] of ROOTS) if (low.includes(root)) return kind
  return 'unknown'
}

/** ⚠️ 匯出給探針用——它要量「這張表在語料上的命中率」。 */
export { ROOTS as DEVICE_ROOTS }

# 概念探索：C++ — Arduino 內建函式的覆蓋缺口（第 0 批）

> 路線圖：[階段 6.16](../../knowledge/vision.md) 的地基　branch `141-cpp-arduino-builtins`
> 🔴 **這不是開放式探索**——範圍由路線圖框定，探索要做的是**確認與補完**。

## 摘要

- 語言：C++（Arduino 方言）　目標：內建函式的覆蓋缺口
- 概念數：**9**（全部 `lang-library`，全部語言特定）
- 落點：**L0 五顆** / **L1a 四顆**
- 🔴 **而查證推翻了三個進來時帶著的假設**（見第三節）——這是本次探索的主要產出

## 一、概念目錄

### L0：基礎（與 `delay`／`millis` 同一關）

| 概念 | 語法 | 語義 | 積木輸入 | 形狀 | 降級路徑 |
|---|---|---|---|---|---|
| `cpp:tone` | `tone(pin, freq[, dur])` | 在腳位上發出方波 | 2–3 | `registerCallConcept` | `cpp:func_call` |
| `cpp:no_tone` | `noTone(pin)` | 停止發聲 | 1 | 同上 | `cpp:func_call` |
| `cpp:delay_microseconds` | `delayMicroseconds(us)` | 等待微秒 | 1 | 同上 | `cpp:func_call` |
| `cpp:micros` | `micros()` | 開機經過的微秒 | 0 | 同上 | `cpp:func_call` |
| `cpp:constrain` | `constrain(x, lo, hi)` | 夾在範圍內 | 3 | 同上 | `cpp:func_call` |

### L1a：函式與迴圈（與 `analogRead`／`map` 同一關）

| 概念 | 語法 | 語義 | 積木輸入 | 形狀 | 降級路徑 |
|---|---|---|---|---|---|
| `cpp:pulse_in` | `pulseIn(pin, HIGH[, timeout])` | 量脈衝長度（µs） | 2–3 | `registerCallConcept` | `cpp:func_call` |
| `cpp:serial_available` | `Serial.available()` | 緩衝區有幾個位元組 | 0 | 🔴 `registerMethodBranch` | `cpp:method_call` |
| `cpp:serial_read` | `Serial.read()` | 讀一個位元組 | 0 | 🔴 同上 | `cpp:method_call` |
| `cpp:analog_read_resolution` | `analogReadResolution(bits)` | 設定 ADC 位元數 | 1 | `registerCallConcept` | `cpp:func_call` |

🟢 **先備檢查通過**：`pulseIn` 需要 `HIGH` 常數，而 `cpp:builtin_constant`／`cpp:pin_constant` **在 L0**
（查證：`topics/arduino.json` 的 L0 `concepts[]`）——判準「它需要的東西在同關或更前面嗎」成立。

## 二、四題的答案（**看程式碼回答的**）

### Q1　`tone`／`noTone` 進哪一格？→ **不新開分類，進「腳位與時間」**

工具箱由 `component.json` 的 `category` ＋ `owner` 導出（`toolbox-categories.ts:183`）：

```
hardware_pins   「腳位與時間」  ← from '(arduino)', category 'hardware'
hardware_serial 「序列埠」      ← from '(arduino)', category 'io'
```

現存那兩段的分家理由逐字（`toolbox-categories.ts:180`）：

> 學生找「怎麼印東西到序列埠」時，不該在一堆腳位積木裡翻。

⚠️ 判準是**學生帶著任務來找時翻不翻得到**。而「聲音」今天只有 **2 顆**——
🔴 **不夠，而且它會白搬一次**：第 1 批要做「蜂鳴器」零件積木，那時分類軸整個會重排。

→ **`category: 'hardware'`**，`serial_available`／`serial_read` 走 `'io'`（與 `serial_print` 同段）。

### Q2　🔴 `pulseIn` 不可以 `skipPaths` —— 而我進來時的提案是錯的

**查證一**（`interpreter.ts:281`）：`if (isSkipped(concept, 'execute')) return` ——
🟢 跳過**不會**中止程式，它安靜 return。所以「skipPaths 會撞上 unknownConceptHandler」這個顧慮**不成立**。

**查證二**（掃 189 顆膠囊）：用 `skipPaths: ["execute"]` 的有 **26 顆，全部 `role: statement`，零顆 expression**。

**而 `pulseIn` 是 expression** → 安靜 return `undefined` → 呼叫端
`distance = pulseIn(...) * 0.034 / 2` 會把 `undefined` 餵給 `ctx.toNumber`，而它第一行就讀 `val.type`。

> **一個對語句安全的「不執行」，對運算式是一顆未爆彈——
> 因為語句的回傳值沒有人接，而運算式的有。**

**查證三**（先例，`digital_read/execute.ts` 檔頭逐字）：

> ⚠️ **沒接東西的腳位讀回 0**——那與真板子不同（真板子會浮動），
> 而**可重現比擬真重要**：一個每次讀到不同值的模擬器，測不出任何東西。

🟢 **而這條先例正好給了 `pulseIn` 一個誠實的答案**：真的 `pulseIn` **在超時沒有回音時就回 0**。
所以「沒接超音波 → 回 0」**不是假造的讀數，是正確的模型行為**。

→ **`pulseIn` 有真的 execute，回 `0`**，檔頭寫明「0 ＝ 超時沒有回音，而那正是真板子在沒接東西時的行為」。

### Q3　🔴 `tone` **不印到主控台** —— 這也推翻了進來時的拍板

`ctx.io.write()` 是**程式的輸出**（`io.ts:18` → `outputCallback`），而學生的 `Serial.println` 走同一條。

> **把模擬器的旁白寫進程式的輸出，會讓程式的輸出變成錯的
> ——而輸出比對是這個專案量正確性的方式之一。**

先例（`analog_write/execute.ts`）：它**寫進腳位狀態**（`state.value`），不印任何東西。

→ **`tone` 寫進 `PinState`**（新增 `toneHz` / `toneMs` 兩格），`noTone` 清掉。零輸出。

⚠️ **已知後果**：學生按執行，蜂鳴器**什麼都不會發生**。
🔴 而那是**視圖層的問題，不是執行器的問題**——板子視圖（階段 6.11 第 4 項，已推遲）是它的家。
**用汙染 stdout 去解一個視圖的缺口，是把問題搬到更難拆的地方。**

### Q4　層級樹落點　→ 見第一節，先備檢查已通過

## 三、🔴 進來時帶著的三個假設，全部被查證推翻

```
① 「skipPaths 會讓程式中止」          ❌ 不會（interpreter.ts:281 安靜 return）
② 「pulseIn 該 skipPaths」            ❌ 它是運算式，回 undefined 會炸；而回 0 才是【對的模型】
③ 「tone 印到主控台」                 ❌ 那會汙染程式的輸出；先例是寫進腳位狀態
```

> **一份「已查證，不要重推」的清單，本身也要被查證一次
> ——而三條裡有三條是錯的。**

## 四、依賴與實作順序

```
無互相依賴。而建議順序照【風險】排：

1  micros · delayMicroseconds      要接既有時鐘 —— 錯了會有第二份時間
2  tone · noTone                   要動 PinState（唯一碰共用結構的）
3  pulseIn                         Q2 的結論要落實成檔頭
4  constrain · analogReadResolution 最單純
5  serial_available · serial_read  形狀不同（方法呼叫）
```

## 五、邊界案例

- `tone(pin, freq)` **兩引數**與 `tone(pin, freq, dur)` **三引數**是同一顆概念的兩種用法
  ——`argSlots` 要能吃可選的第三格（對照 `cpp:pulse_in` 的 timeout）
- `micros()` 會在約 **70 分鐘**溢位回 0（真板子行為）——模擬時鐘要不要模這個？
  🟡 **本輪不做**，而檔頭要寫明它沒模
- `Serial.read()` 在沒有資料時回 **-1**（不是 0）——這是常見的初學者陷阱，
  執行語義要照做，而它與 `Serial.available()` 是成對使用的

## 六、跨語言對應

九顆全部是 **Arduino 方言專屬**，`layer: lang-library`，`owner: '(arduino)'`。
⚠️ `constrain` 是唯一有跨語言相貌的（等同 `clamp`），
🔴 **而本輪不升格為 universal**——`layer: universal` 今天是「還沒被驗證的外延主張」
（跨語言等價要等第二個語言進來才驗得了）。

🏁 SKILL_COMPLETE: component-discover | cpp | Arduino 內建函式（第 0 批） | 發現 9 個概念 | 報告：specs/concepts/cpp-arduino-builtins.md

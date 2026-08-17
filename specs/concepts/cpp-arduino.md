# 概念探索：C++ — Arduino 執行期表面（腳位 ＋ 時間 ＋ Serial）

**日期**：2026-08-17　**規格**：`specs/137-arduino-execution-model/`

## 摘要

- 語言：`cpp`（🔴 **不是新語言**——實測十段 Arduino 語料**辨識殘差 0/10**）
- 目標：讓 Arduino sketch **真的跑得動**所需的執行期表面
- 發現概念總數：**12**
- 通用概念：**0**、語言特定（`cpp:`）：**12**
- ⚠️ **既有身分 189 顆，本輪 +12 → 201**

---

## 🔴 兩個查證改變了設計，先講

### ① `cpp:builtin_constant` 已經存在——**而不能拿它裝 `HIGH`**

`components/cpp/builtin_constant/component.json` 有一個 `enum`：

```
true / false / EOF / NULL / nullptr        （而 builtins.ts 的表另有 INT_MAX 等）
```

**看起來** `HIGH`／`OUTPUT`／`A0` 該加進去——它們正是「環境提供的具名常數」。

🔴 **而那會讓目標機制失效**：

> **目標可以隱藏一顆【概念】，而隱藏不了一顆概念裡的一個【列舉值】。**

加進去的話，一個學 C++ 的學生會在下拉選單裡看到 `HIGH`／`INPUT_PULLUP`
——而課程清單（`levelTree`）**過濾的單位是概念，不是列舉值**。

→ **決定：另立 `cpp:pin_constant`**，讓 Arduino 課程清單收得到它、C++ 的收不到。
⚠️ 這與 spec 136 的 C 課程清單是**同一條理由**。

### ② 🔴 `map` 這個名字**已經被佔用了**

```
既有   cpp:map_declare / map_at / map_assign     ← std::map（關聯容器）
Arduino  map(v, 0, 1023, 0, 255)                 ← 數值區間重映射
```

**兩個 `map` 語義毫無關係**，而它們會出現在同一個工具箱裡。

→ **決定：命名為 `cpp:range_remap`**，不叫 `cpp:map`。
> **一個與既有概念同名而語義無關的新概念，會讓兩邊的搜尋都變不準。**
⚠️ 而 lift 那一路仍然認 `map(` 這個**語法**——**名字是給人看的，不是給 parser 看的**。

---

## 概念目錄

### L0 級（Arduino 課程清單的基礎）— 拉出來就會動

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 降級路徑 |
|---|---|---|---|---|---|
| `cpp:pin_mode` | `pinMode(13, OUTPUT)` | 設定腳位是輸入還是輸出 | 2 | lang-library | `func_call` |
| `cpp:digital_write` | `digitalWrite(13, HIGH)` | 把腳位設成高／低電位 | 2 | lang-library | `func_call` |
| `cpp:digital_read` | `digitalRead(2)` | 讀腳位是高還是低 | 1 | lang-library | `func_call` |
| `cpp:pin_constant` | `HIGH` / `OUTPUT` / `A0` | 腳位領域的具名常數 | 1（enum） | lang-library | `var_ref` |
| `cpp:delay` | `delay(1000)` | 等待（模擬時鐘） | 1 | lang-library | `func_call` |
| `cpp:serial_print` | `Serial.println("hi")` | 從序列埠輸出 | 1 ＋ 換行旗標 | lang-library | `method_call` |

### L1 級（中級）— 需要理解數值與初始化

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 降級路徑 |
|---|---|---|---|---|---|
| `cpp:serial_begin` | `Serial.begin(9600)` | 開啟序列埠 | 1 | lang-library | `method_call` |
| `cpp:analog_read` | `analogRead(A0)` | 讀類比值（0–1023） | 1 | lang-library | `func_call` |
| `cpp:analog_write` | `analogWrite(9, 128)` | 輸出類比值（PWM，0–255） | 2 | lang-library | `func_call` |
| `cpp:millis` | `millis()` | 開機到現在的毫秒數 | 0 | lang-library | `func_call` |
| `cpp:range_remap` | `map(v, 0, 1023, 0, 255)` | 數值從一個區間換到另一個 | 5 | lang-library | `func_call` |

⚠️ `cpp:range_remap` 有 **5 個輸入**——超過準則說的「4+ 就考慮拆分」。
🔴 **而它不能拆**：五個數就是它的語義（來源區間、目標區間、值）。
→ 標為 L1 而不是 L0，並在積木上用**兩組成對的欄位**降低認知負載。

### 不做成概念的（而理由要留下）

| | 為什麼不做 |
|---|---|
| `byte` | 🟢 **已經動了**——`byte b = 255` 已 lift 成 `cpp:var_declare{type:'byte'}`，型別是字串 |
| `String` | 🟡 同上（`type:'String'`）。⚠️ **執行期要把它當字串處理，而那是一個簡化**（`+=`／`length()` 不保證） |
| `Serial.print`（不換行） | 與 `println` 同一顆概念的兩個形態——**用一個旗標，不是兩顆概念**（Sc3 認知一致性） |

---

## 依賴關係圖

```
cpp:pin_constant ──┬─▶ cpp:pin_mode
                   ├─▶ cpp:digital_write
                   └─▶ cpp:analog_read（A0）

arduino-clock ─────┬─▶ cpp:delay
（已存在）          └─▶ cpp:millis

主控台（已存在）────┬─▶ cpp:serial_print
                   └─▶ cpp:serial_begin

腳位狀態機（新）────┬─▶ pin_mode / digital_write / digital_read
                   └─▶ analog_read / analog_write
```

## 建議實作順序

```
1  cpp:pin_constant      沒有它，其餘腳位概念的引數是裸識別字
2  cpp:pin_mode          它建立腳位狀態機
3  cpp:digital_write     ＋ cpp:digital_read
4  cpp:delay / cpp:millis  接既有的 arduino-clock
5  cpp:serial_begin / cpp:serial_print   接既有的主控台
6  cpp:analog_read / cpp:analog_write
7  cpp:range_remap       純函式，無依賴，最後做
```

## 跨語言對應

**沒有。** 🔴 這 12 顆**全部是 `cpp:` 專屬**，一顆通用概念都沒有。

⚠️ 而那**不是疏忽，是這一輪的性質**：`history/075` 記著先做 Arduino 的代價
——「Arduino 驗的是面板／新槽／執行模型，而**不驗語言無關性**，因為它就是 C++」。
**在 Python 進來之前，這 12 顆會不會該升格成通用概念，今天答不了。**

## 需注意的邊界案例

- 🔴 **`map` 名字衝突**（見上）——概念叫 `range_remap`，而語法認 `map(`
- 🔴 **`HIGH` 不能塞進 `builtin_constant` 的 enum**（見上）——目標過濾不了列舉值
- ⚠️ **沒 `pinMode` 就 `digitalWrite`**：真板子上是未定義行為。
  **本輪要說得出來**（照做、或出聲），不得靜默
- ⚠️ **腳位號碼超範圍**（`digitalWrite(999, HIGH)`）→ 出聲
- ⚠️ **`analogWrite` 不模擬 PWM 波形**——只存值
- ⚠️ **`Serial.print` 的引數可以是任何型別**（數字／字串／變數）——與 `cpp:print` 同族

## 五路完備性

| 概念群 | lift | render | extract | generate | execute |
|---|---|---|---|---|---|
| 8 個具名函式 | `registerCallConcept` 一行 | blockDef | 自動推導 | 需寫 | 需寫 |
| `cpp:pin_constant` | pattern（照 `builtin_constant`） | blockDef（enum） | 自動推導 | 需寫 | 需寫 |
| `serial_*` | ⚠️ **形狀不同**（`cpp:method_call`） | blockDef | 自動推導 | 需寫 | 需寫 |

🔴 **`serial_*` 的 lift 不能用 `registerCallConcept`**——那是給 `call_expression` 的，
而 `Serial.println(...)` 是 `cpp:method_call{obj, method}`。**要另一條路。**

---

🏁 SKILL_COMPLETE: component-discover | cpp | Arduino 執行期表面 | 發現 12 個概念 | 報告：specs/concepts/cpp-arduino.md

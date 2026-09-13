# 概念探索：C++ — 套件物件（第 2 批）＋ ESP32（第 3 批）

> 路線圖：階段 6.16 第 2／3 批　上游：`cpp-arduino-components.md`（第 1 批）
> 🔴 **這一輪的主要產出是：那份「擋住第 2 批」的 draft，擋的其實是【執行】不是【積木】。**

## 摘要

```
發現概念數  22（第 2 批 15 ＋ 第 3 批 7）
新機制      0  ← 🟢 三個登錄機制【全部已存在】
新分類      0  ← 判準同前兩批
🔴 順帶修   1  ← dht.begin() 被容器迭代器搶走（draft 第六節，今天仍然如此）
```

## 一、🔴 第 2 批沒有被擋住——重讀之後改判

`draft/2026-08-17-套件的物件在執行期是什麼.md` 檔頭逐字：

> 🔴 **於是「執行」不再是缺口，而是【由真板子提供】**——本檔留著，**而它等的是虛擬硬體**

第一節逐字：

> `Servo myServo;` → `cpp:var_declare{ type:'Servo' }` … 🔴 **沒有一個新概念需要被加。**
> 樹已經是對的形狀，殘差 0。**問題只在 execute**

⚠️ **所以它卡的是執行那一路。** 而 vision 明寫「型別辨識那一列可以先做」。

**而積木那一側仍然需要新概念**，理由與第 1 批完全相同：
`myServo.write(90)` lift 成通用的方法呼叫**產出正確的程式碼**，
而學生在畫布上看到的是一顆通用積木，不是「讓伺服馬達轉到 90 度」。

> **殘差為零，不代表學生看得懂。**

## 二、三個登錄機制全部已存在——**一個都不必新造**

| 形狀 | 機制 | 既有的使用者 |
|---|---|---|
| `Servo myServo;` 宣告型別 | `registerPlainTypeConcept(型別, 身分, 來源)` | `string_declare`／`ifstream_declare` |
| `myServo.write(90)` 型別上的方法 | `registerTypedMethodConcept(型別, 方法, 身分, 來源)` | `string_clear`／`priority_queue_peek` |
| `EEPROM.read(0)` 全域單例 | `registerMethodBranch`（看得到 `obj`） | `serial_print`（`obj === 'Serial'`） |
| `ledcWrite(0, 128)` 自由函式 | `registerCallConcept` | 第 0 批九顆 |

🟢 **型別是宣告出來的，不是猜的**——這一批的辨識比第 1 批**更穩**：
第 1 批要從變數名猜零件（90.2%），這一批從 `Servo myServo;` 直接讀到型別（100%）。

## 三、🔴 `dht.begin()` 今天仍然被容器迭代器搶走，而登錄型別方法【不足以】修它

`container_iter/lift.ts` 的分支：

```ts
if (method !== 'begin' && method !== 'end') return null
if (argChildren.length > 0) return null      // ← Serial.begin(9600) 因此逃過
```

`dht.begin()` **零引數** → 被認成迭代器。

⚠️ 而 `io.ts` 的解析順序是 **`tryMethodBranches` 跑在 `typedMethodConcept` 之前**
（`io.ts:46` vs `io.ts:159`）——所以登錄 `DHT`／`begin` 也搶不回來。

**處置**：`container_iter` 自己加一道「這個接收者的型別有沒有被別人認領」的判斷
（問核心的 `plainTypeConcept(型別)`，不提任何別顆元件的身分）。
🔴 而那正是它檔頭自己寫的判準：**「判不出來就說不是我。」**

> **一個靠方法名認人的樣式，會把別人的方法搶走**
> ——與腳位常數那顆付過的學費是同一條，只是這次是**方法名**不是識別字名。

## 四、執行那一路——**逐顆問，不用一條通則蓋過去**

draft 第五節卡住的是「方法回傳什麼」。⚠️ **而它不必一次答完**：
新概念是**具體的**，所以每一顆的來源各自查得到。

| 概念 | 執行怎麼做 | 誠實嗎 |
|---|---|---|
| `servo.write(90)` | 記角度（照 `arduino-pins` 的 `WeakMap` 形狀） | 🟢 真的狀態 |
| `servo.read()` | 回**上次寫進去的**角度 | 🟢 真的可算 |
| `EEPROM.read/write` | 一個 1024 位元組陣列 | 🟢 **完全模擬得了**（它就是記憶體） |
| `lcd.print/setCursor/clear` | 記游標與內容（不進 `ctx.io`——那是程式的輸出） | 🟢 真的狀態 |
| `ledcWrite(pin, duty)` | 記 duty 到腳位狀態 | 🟢 同 `analogWrite` |
| `touchRead(pin)` | 回一個固定值（沒碰到時的典型讀數） | ⚠️ 見下 |
| `wifi.status()` | 回 `WL_CONNECTED`（模擬環境視為已連上） | ⚠️ 見下 |
| **`dht.readHumidity()`** | **回 `NaN`** | 🟢 **見下——這是查證過的** |

### 🔴 `dht.readHumidity()` 回 NaN 是**真板子的行為**，不是投降

查證（Adafruit DHT 官方 issue ＋ 多份教學）：讀取失敗（逾時／校驗錯）時
`readHumidity()`／`readTemperature()` **回 NaN**，而**教材一律教學生寫**：

```cpp
float h = dht.readHumidity();
if (isnan(h)) { Serial.println("Failed to read from DHT sensor!"); return; }
```

⚠️ **而模擬環境就是「沒有接感測器」**——回 NaN 與真板子在那個情境下**完全一致**。
判準與 `pulse_read` 沒接東西回 0 相同：

> **回的不是編出來的數字。**

🟢 而它**不是**「回 NaN 而不出聲」那個反模式：學生的程式**本來就會檢查它**，
而檢查會成功。**那條路徑因此被真的執行到了。**

### ⚠️ `touchRead` 與 `wifi.status()` 是**弱一點**的，要說出來

它們沒有 DHT 那種「官方文件寫明的失敗值」。處置：
- `touchRead` → 回一個**固定**的未觸碰讀數，`_execute_why` 寫明「可重現比擬真重要」
- `wifi.status()` → 回 `WL_CONNECTED`。⚠️ **理由要誠實**：回「未連上」的話
  所有 WiFi 教學程式都會卡在 `while (WiFi.status() != WL_CONNECTED)` 的無窮迴圈裡，
  而那對教學更糟。**這是一個取捨，不是一個模擬。**

## 五、ESP32 的 PWM 有**兩個世代**，而兩個都要認

查證（Espressif 官方遷移指南）：core **3.0 移除**了 `ledcSetup` 與 `ledcAttachPin`，
併成 `ledcAttach(pin, freq, resolution)`；`ledcWrite` 的第一個參數由**通道**改成**腳位**。

```
2.x（語料裡是這版）   ledcSetup(ch, freq, res)  ＋ ledcAttachPin(pin, ch) ＋ ledcWrite(ch, duty)
3.x（今天的板子）      ledcAttach(pin, freq, res)                          ＋ ledcWrite(pin, duty)
```

🔴 **兩版都要認**：語料（AI 生成的）用舊版，而學生手上的板子是新版。
⚠️ 而 `ledcWrite` **同名同形**，一顆概念吃兩版；差別在第一個參數的**語義**，
而那個差別**在程式碼裡看不出來**——所以不做成兩顆身分。

## 六、概念目錄

### L1a（函式與迴圈）——第 3 批 ESP32

| 概念 | 語法 | 語義 | 輸入 | Layer | 降級 |
|---|---|---|---|---|---|
| `cpp:pwm_attach` | `ledcAttach(pin,freq,res)` | 設定腳位的 PWM | 3 | lang-library | `func_call` |
| `cpp:pwm_setup` | `ledcSetup(ch,freq,res)` | 設定 PWM 通道（舊版） | 3 | lang-library | `func_call` |
| `cpp:pwm_bind` | `ledcAttachPin(pin,ch)` | 把腳位接到通道（舊版） | 2 | lang-library | `func_call` |
| `cpp:pwm_write` | `ledcWrite(x,duty)` | 輸出 PWM | 2 | lang-library | `func_call` |
| `cpp:touch_read` | `touchRead(pin)` | 讀觸摸感應值 | 1 | lang-library | `func_call` |

### L1a——WiFi（全域單例）

| 概念 | 語法 | 語義 | 輸入 | Layer | 降級 |
|---|---|---|---|---|---|
| `cpp:wifi_connect` | `WiFi.begin(ssid,pw)` | 連上無線網路 | 2 | lang-library | `method_call` |
| `cpp:wifi_state` | `WiFi.status()` | 無線網路的連線狀態 | 0 | lang-library | `method_call` |
| `cpp:wifi_address` | `WiFi.localIP()` | 取得本機位址 | 0 | lang-library | `method_call` |

### L1a——EEPROM（全域單例）

| 概念 | 語法 | 語義 | 輸入 | Layer | 降級 |
|---|---|---|---|---|---|
| `cpp:eeprom_read` | `EEPROM.read(addr)` | 從內建記憶體讀一個位元組 | 1 | lang-library | `method_call` |
| `cpp:eeprom_save` | `EEPROM.write(addr,v)` | 寫一個位元組到內建記憶體 | 2 | lang-library | `method_call` |

### L2a（陣列與字串）——第 2 批 物件

| 概念 | 語法 | 語義 | 輸入 | Layer | 降級 |
|---|---|---|---|---|---|
| `cpp:servo_declare` | `Servo myServo;` | 宣告一顆伺服馬達 | 1 | lang-library | `var_declare` |
| `cpp:servo_attach` | `myServo.attach(9)` | 把伺服接到腳位 | 2 | lang-library | `method_call` |
| `cpp:servo_turn` | `myServo.write(90)` | 讓伺服轉到某個角度 | 2 | lang-library | `method_call` |
| `cpp:servo_angle` | `myServo.read()` | 伺服目前的角度 | 1 | lang-library | `method_call` |
| `cpp:dht_declare` | `DHT dht(2,DHT11);` | 宣告一顆溫濕度感測器 | 3 | lang-library | `var_declare` |
| `cpp:dht_start` | `dht.begin()` | 啟動溫濕度感測器 | 1 | lang-library | `method_call` |
| `cpp:dht_humidity` | `dht.readHumidity()` | 讀濕度（百分比） | 1 | lang-library | `method_call` |
| `cpp:dht_temperature` | `dht.readTemperature()` | 讀溫度（攝氏） | 1 | lang-library | `method_call` |
| `cpp:lcd_declare` | `LiquidCrystal lcd(...)` | 宣告一片字元液晶 | 動態 | lang-library | `var_declare` |
| `cpp:lcd_start` | `lcd.begin(16,2)` | 設定液晶的行列數 | 3 | lang-library | `method_call` |
| `cpp:lcd_print` | `lcd.print(x)` | 在液晶上顯示 | 2 | lang-library | `method_call` |
| `cpp:lcd_cursor` | `lcd.setCursor(c,r)` | 把游標移到某一格 | 3 | lang-library | `method_call` |
| `cpp:lcd_clear` | `lcd.clear()` | 清空液晶 | 1 | lang-library | `method_call` |

⚠️ **每一顆的降級路徑都是「回到它今天已經是的樣子」**（`var_declare`／`method_call`）
——🟢 **那讓這一批的風險特別低**：做壞了就退回今天的行為，而今天的殘差是 0。

## 七、明確不做

```
Adafruit_SSD1306（OLED）   語料只有 1 段，而它要 Wire ＋ GFX 兩層相依 → 不做
Stepper.h                  語料 1 段 → 不做
Wire / SPI                 匯流排層，不是零件 → 不做
WebServer（ESP32）          它是一個伺服器框架，不是一顆零件 → 不做
虛擬硬體                    使用者往後推過
```

## 八、需注意的邊界案例

- `Servo` 與 `ESP32Servo.h` 的 `Servo` **是同一個型別名**——🟢 一顆概念吃兩個套件
- `LiquidCrystal lcd(12,11,5,4,3,2)` 與 `LiquidCrystal_I2C lcd(0x27,16,2)` 是**兩個型別**，
  ⚠️ 建構參數數量也不同 → `lcd_declare` 的參數要**動態**（照 `dynamicRules`）
- `dht.begin()` 與 `lcd.begin(16,2)` 都叫 `begin`——🔴 而 `Serial.begin` 已經有主了。
  **型別作用域的方法登錄剛好把三者分開**，前提是第三節那個修法先做
- `EEPROM.write` 與 `Serial.write` 同名 → **必須綁 `obj`**（照 `serial_print` 的做法）

🏁 SKILL_COMPLETE: component-discover | cpp | 套件物件（第 2 批）＋ ESP32（第 3 批） | 發現 22 個概念 | 報告：specs/concepts/cpp-arduino-libraries.md

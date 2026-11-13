# 概念探索：C++（Arduino）— `String` 方法與序列埠讀取

## 摘要
- 語言：C++（Arduino 執行環境，owner `(arduino)`）
- 目標：Arduino 核心的 `String` 類別（`WString.h`）常用方法、`Stream`（`Serial`）的文字讀取
- 發現概念總數：6（全部語言特定）
- 來源：五份 Arduino 探針語料（`tests/probes/arduino-*-corpus.json`，140 支）——`trim` 7、`substring` 5、`indexOf` 5、`toInt` 4、`readStringUntil` 4、`parseInt` 4 次；今天都 lift 成通用的 `cpp:method_call`
- Topic：`src/languages/cpp/topics/arduino.json`（扁平清單，放在 `cpp:serial_read` 後面）

## 概念目錄

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | 角色 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|
| `cpp:arduino_string_trim` | `s.trim();` | 就地去掉頭尾空白 | 接收者 | 敘述（回傳 void） | `method_call` | 與 Python `strip()`（回傳新字串）不同：**就地改** |
| `cpp:arduino_string_find` | `s.indexOf(x)`、`s.indexOf(x, from)` | 找第一次出現的位置，找不到 **-1** | 接收者、要找的、（起點） | 運算式 | `method_call` | 與 `std::string::find`（找不到回 npos）不同身分 |
| `cpp:arduino_string_substr` | `s.substring(from)`、`s.substring(from, to)` | 取 [from, to) 那一段 | 接收者、起點、（終點） | 運算式 | `method_call` | ⚠️ 第二個引數是**終點**，`std::string::substr` 是**長度** |
| `cpp:arduino_string_as_int` | `s.toInt()` | 轉成整數（`long`；開頭不是數字回 0） | 接收者 | 運算式 | `method_call` | 與 `stoi`（失敗丟例外）不同 |
| `cpp:serial_read_string` | `Serial.readStringUntil(c)` | 讀到某個字元為止，回傳 String（不含該字元） | 終止字元 | 運算式 | `method_call` | 與 `serial_read` 同族，判 `obj === 'Serial'` |
| `cpp:serial_read_number` | `Serial.parseInt()` | 跳過非數字、讀一個整數 | — | 運算式 | `method_call` | 同上；帶引數的多載（lookahead 模式）不認，留通用版 |

## Lift 判別（為什麼不用純方法名表）

`registerMethodComponent` 只看方法名——使用者自己的類別寫了 `trim()`／`indexOf()` 會被搶走。
改走 `registerMethodBranch`，接收者要是：
1. 宣告型別記成 `String` 的名字（`lifter.ts` 的 `recordDeclaration`：`String s` → `String`），或
2. 本身就是我們回傳 `String` 的元件（`arduino_string_substr`、`serial_read_string`）——`line.substring(comma + 1).toInt()` 是語料裡的寫法。

型別查不到就**不認**（留通用版）——猜一個錯的專屬身分比誠實降級更糟（`servo_attach/lift.ts` 的同一條）。
引數數量超出宣告的槽位也不認（不安靜地丟引數）。

## Formalize
`eMCall`（同 `cpp:string_size`），方法名照原文；433 起板子上的 `String` 送 `tClass`，Cella 的 Arduino 核心有這幾個方法（433 的 `arduino-sketch-formalize` 已在 Uno／ESP32 跑過 `trim`／`indexOf`／`substring`／`toInt`／`readStringUntil`）。

## 依賴關係
- `serial_read_string` → 常被 `arduino_string_trim`／`_find`／`_slice` 接著用
- 實作順序：`arduino_string_trim` → `_find` → `_slice` → `_as_int` → `serial_read_string` → `serial_read_number`

## 邊界案例
- `s.indexOf(',', 3)`：第二個引數是起點——要進 `from` 槽，不能丟
- `s.substring(3)`：只有起點
- `s.trim()` 在運算式位置（`x = s.trim()`）不合法（void），不做運算式形態
- `Serial1.readStringUntil(...)`（ESP32 的第二個序列埠）：`serial_read` 只認 `Serial`，同步維持只認 `Serial`
- 接收者是陣列格／成員（`cmds[i].trim()`）：型別查不到 → 通用版（誠實）

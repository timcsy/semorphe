# 模糊測試報告 — C++ Arduino 內建函式（第 0 批） — 2026-08-18

> branch `141-cpp-arduino-builtins`　語料：`tests/probes/arduino-builtins-corpus.json`
> 探針：`tests/probes/arduino-builtins.test.ts`　回歸：`tests/integration/fuzz-cpp-arduino-builtins.test.ts`

## 摘要

```
語料      20 段（出題者跑在隔離 worktree，看不到原始碼）
          語法完整 20／片段 0
          板子：Uno 14｜Nano 3｜ESP32 3　　套件 1 種（Servo）

殘差      0 / 1683 節點 = 0.00%
round-trip　樹漂移 0/20　文字漂移 0/20     ← **修完之後**
🔴 修之前   樹漂移 2/20　文字漂移 20/20
```

## 🔴 出題者沒有被告知那九個函式名

提示裡只寫了**四個主題**（蜂鳴器／超音波／序列埠互動／非阻塞計時），
而九顆裡 **7 顆自然出現**：

| 概念 | 語料裡出現 |
|---|---|
| `delayMicroseconds` | 12 |
| `tone` | 11 |
| `noTone` | 9 |
| `pulseIn` | 6 |
| `Serial.available` | 6 |
| `constrain` | 2 |
| `Serial.read` | 2 |
| **`micros`** | **0** |
| **`analogReadResolution`** | **0** |

> **一份「照著清單寫」的語料，量出來的覆蓋率是自己給自己的分數。**

⚠️ 而那兩個 0 **也是資訊**：`millis` 幾乎壟斷了非阻塞計時，而解析度設定是 ESP32 專屬的少數寫法。
🔴 **那不代表它們不該做**（貼進來的程式一旦有就必須認得），
而是**不該用它們來宣稱覆蓋率**——它們今天只有各自的 `spec.test.ts` 在守。

## 發現並**當場修好**的兩個 bug

兩個都有同一個形狀：**單看一次轉換是對的**。

### Bug 1：區塊註解每轉一次多一顆星號

```
/*                          /*                        /*
 * HC-SR04 距離計      →     * * HC-SR04 距離計   →     * * * HC-SR04 距離計
 */                          */                        */
```

**根因**：`cpp:stripBlockComment` 剝掉了 `/*` `*/`，**而沒有剝掉每一行開頭的 `*` 裝飾**；
產生那一側（`cppCommentSyntax.block`）每一行都會加回 ` * `。一加一不減 → 單調成長。

**修法**：剝除時一併拿掉行首的一顆 `*`（⚠️ 只剝行首——內文的 `*`（乘法、指標）不得被動到，有測試）。

### Bug 2：🔴 `int a[] = {…}` 被編出一個大小——**而那改變語義**

```cpp
int melody[]   = {262, 294, 330, 349, 392, 440, 494, 523};   // 原文
int melody[10] = {262, 294, 330, 349, 392, 440, 494, 523};   // 產出
```

**根因**：`array_declare/generate.ts` 的 `node.properties.size ?? '10'` ——
一個**寫死的預設值**把「這裡沒有資料」偽裝成「這裡的資料是 10」。

**後果不是排版**：`sizeof(melody)/sizeof(melody[0])` 從 **8 變 10**
→ 學生的旋律迴圈**多播兩個垃圾音**。而那正是蜂鳴器教學的招牌範例。

**修法**：沒有大小就產出 `[]`（C++ 合法，大小本來就由初始值決定）。

> 🔴 這是專案自己命名過的「**靜默降級反模式**」的又一個實例。

## ⚠️ 為什麼是 fuzz 抓到，不是既有測試

```
既有語料   用 // 行註解；陣列都寫了大小
AI 生的    幾乎都以 /* … */ 開頭；旋律陣列幾乎都不寫大小
```

> **一批「我們自己寫的」語料，量到的是我們自己想得到的用法。**

## 降級成通用呼叫（覆蓋缺口，**不是 bug**）

38 個節點降級成 `cpp:func_call`／`cpp:method_call`，而**第 0 批九顆一個都沒有**。
它們是這一批**明確不做**的東西，記在這裡當下一批的輸入：

```
ESP32 的 PWM      ledcSetup · ledcAttachPin · ledcWriteTone     6 節點（real_4）
Servo             attach · write                                6 節點（real_10）
String 與序列埠   readStringUntil · trim · indexOf · substring · toInt · parseInt
其他              sizeof 之外的零星呼叫
```

🔴 `ledc*` 那組正好對應 vision 階段 6.16 第 3 批（ESP32），而 `Servo` 是第 2 批。

## 分類

| 結果 | 數 |
|---|---|
| ✅ PASS | 20/20 |
| ❌ SEMANTIC_DIFF | **2 → 0**（兩個都當場修好） |
| ❌ ROUNDTRIP_DRIFT | **22 → 0** |
| ❌ WRONG_CONCEPT | 0（九顆都沒降級） |
| 🟡 EXPECTED_DEGRADATION | 38 節點（覆蓋缺口，見上） |
| **`it.todo` ／ `it.skip`** | **0** |

## ⚠️ 不在宣稱範圍內

🔴 **沒有跑 g++／arduino-cli**：`g++` 編不動 sketch，而 `arduino-cli` 這個專案沒有接。
**所以「編得過」與「執行結果相同」不在本報告的宣稱範圍內**——
它由使用者在 Arduino IDE 實測（2026-08-18 已回報 `.ino` 編得過）。

## 與姊妹語料的關係

```
arduino-realistic（2026-08-17）  泛用主題  20 段  殘差 0.07%
arduino-builtins（本輪）         主題集中  20 段  殘差 0.00%
```

⚠️ **兩份的數字不可直接互比**（母體不同），而**兩份都要留**：
一份主題集中的語料量出來的殘差代表不了泛用情況，反之亦然。
🟢 而本輪修好的兩個 bug **對兩份都生效**——姊妹探測跑完仍是 0 漂移。

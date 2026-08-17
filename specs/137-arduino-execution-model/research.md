# Research：Arduino 第 1–3 項

**日期**：2026-08-17　**規格**：[spec.md](./spec.md)

> ⚠️ 本檔每一條都是**跑出來的**。
> 🔴 **而第一條推翻了我自己在 `/knowie-next` 那份 brief 裡寫的「本輪真正的閘門」。**

---

## Q1：🔴 我說的那個閘門**不存在**

**brief 裡寫的**（逐字）：

> 「🔴 執行路【不知道目標】 `ExecutionContext`（executor-registry.ts:9-48）
> 沒有 style、沒有 target ← **本輪真正的閘門**」

**而實測**：把 `cpp:program` 的執行路改成「沒有 `main` 就找 `setup`／`loop`」
——**六行，而十段語料全部從「安靜」變成「大聲失敗」**。

```
今天        out=""  err=""       ← 🔴 十段全部，安靜地什麼都不做
六行之後    out=""  err="RUNTIME_ERR_UNDEFINED_FUNC: pinMode"   （6 段）
                    err="RUNTIME_ERR_UNDECLARED_VAR: Serial"    （4 段）
```

**為什麼不需要目標**：`cpp:program/execute.ts` **是一顆膠囊，不是核心**
（`src/components/` 不在 `NEUTRAL_DIRS` 裡），
而它的檔頭**早就寫著**這件事屬於它：

> 「哪一個函式是進入點是**這顆（整個程式）的知識**，不是那顆函式的性質。
> 一個叫 `main` 的函式在別的語言裡可能什麼都不是。」

🟢 **所以進入點由「樹裡有哪些函式」決定，而不是由目標決定。**
FR-008（核心不得認識 arduino）**因此是免費的**——沒有任何核心檔案要動。

> **我把「這個功能需要什麼資訊」錯認成「這個資訊要從哪裡傳進來」
> ——而正確答案是【它已經在樹裡了】。**

⚠️ **而這不是說目標沒用**：目標仍然決定**哪些積木看得到**（課程清單）
與**產出的形狀**。它只是**不決定進入點**。

**優先順序**（規格的 Edge Case）：`main` > `setup`／`loop` > **出聲**。
🔴 第三段是 FR-003，而今天它是靜默的。

---

## Q2：修好入口之後，缺的東西**恰好兩種**

```
UNDEFINED_FUNC   pinMode digitalWrite digitalRead analogRead analogWrite
                 delay millis map                     ← 它們是【函式】
UNDECLARED_VAR   Serial                               ← 它是【物件】，形狀不同
```

**十段語料的完整表面**（機械掃出來的）：

```
函式 8   pinMode digitalWrite digitalRead analogRead analogWrite delay millis map
物件 1   Serial（.begin / .println）
常數 6   HIGH LOW OUTPUT INPUT INPUT_PULLUP A0
型別 2   byte String        ⚠️ 各出現一次
```

---

## Q3：🟢 一顆「具名呼叫」概念的 lift 是**一行資料**

`components/cpp/math_abs/lift.ts` 全文（去掉註解）：

```ts
registerCallConcept('abs', { conceptId: 'cpp:math_abs', argSlots: ['value'], source: 'cpp/math_abs' })
```

檔頭逐字：「**一筆資料，不是函式**……判別邏輯留在共用檔，資料回家。」

**決定**：那 8 個函式走同一條路。⚠️ 而 `Serial` **不是這個形狀**
（它是物件的方法呼叫），要另外處理。

---

## Q4：🔴 新概念**必須走 `component-pipeline`**，不可手寫

使用者的既有回饋（記在專案記憶裡）：

> 「**必須用 Skill tool 調用 component skills，不可用 agent 精簡代替**」

而 `component-pipeline/SKILL.md` 的「⛔ 強制執行規則」列了五種違規，其中包括
「❌ 自己寫程式碼代替 skill 的工作」與「❌ 聲稱『已經做過等效工作』來跳過」。

**決定**：第 2、3 項的新概念**一律走 `/component-pipeline`**，
target 是**一個特性**（Arduino 執行期表面），不是一顆一顆跑。

---

## Q5：時鐘住哪裡——而它**不需要動核心**

`delay`／`millis` 是**膠囊**，而膠囊可以**惰性安裝自己的執行期到 `ctx`**
——這個模式今天就在用：

```ts
// components/cpp/lambda/execute.ts:8
installLambda(ctx)          // ← 執行到 lambda 節點時才裝
```

`ExecutionContext` 的欄位註解逐字：「**由語言套件安裝**……沒安裝時行為與
加入本機制之前完全相同。」

**決定**：模擬時鐘由 `delay`／`millis` 的膠囊惰性安裝。
**真實／模擬的切換**放在**語言套件的模組層級設定**（照 `setScaffoldConfig` 的形狀），
🔴 **不加進 `src/core/types.ts`**。

⚠️ **而使用者已接受的代價在這裡具體化**：切換是一個**開關**，
所以有**兩條執行路徑**，而只有一條會在全套測試裡跑。
→ 規格 SC-006 要求**說得出被測到幾條**。

---

## Q6：`loop()` 的界，理由是什麼

`loop()` 依定義不終止。三種界，各自的理由：

| 界 | 理由 | 問題 |
|---|---|---|
| 圈數（`k < 2`） | 簡單 | 🔴 **隨手挑的數字**——規格的 Edge Case 明說不接受 |
| `maxSteps` | 已存在（10_000_000） | ⚠️ 它是**防卡死**的上限，不是語義 |
| **模擬時鐘的上限** | 🟢 **它是使用者看得懂的量**（「跑 5 秒」） | 要新增一個設定 |

**決定**：**測試用「模擬時間上限」**（例如 5000 毫秒），
而 UI 用**使用者的停止鍵**。
理由：`delay(1000)` × 2 的 sketch，「跑 5 秒」＝ 大約兩圈半
——**那個數字說得出理由，而「兩圈」說不出**。

⚠️ `maxSteps` **仍然留著當防卡死的網**（一個沒有 `delay` 的 `loop()`
在模擬時鐘下永遠到不了時間上限）。🔴 **兩個界都要有，而理由不同。**

---

## Q7：`byte` 與 `String` ——各出現一次，而成本差很多

```
byte b = 255;        →  `byte` 只是 `unsigned char` 的別名  ⚪ 便宜
String msg = "hi";   →  Arduino 的 String 是一個【類別】    🔴 貴
```

⚠️ 而 `cpp:string_declare`（`std::string`）**已經存在**。
`String` 與它**行為幾乎相同**，差別在名字。

**決定**：`byte` 做（型別別名）。
🔴 **`String` 本輪【映射到既有的字串概念】，而不是新做一個類別**
——⚠️ **並在 `findings.md` 裡寫明那是一個【簡化】**：
Arduino 的 `String` 有 `+=`／`length()` 等方法，本輪不保證。

---

## Q8：Arduino 目標需要什麼資料

```
target: { id: 'arduino', name: 'Arduino', topic: ?, style: ? }
```

- **topic**：需要一份新的課程清單（`setup`／`loop`／腳位可見，而 `main` 不該顯眼）
  ⚠️ 而 spec 136 的推導判準（`requires` ∧ 無 `ioRole`）**不適用**
  ——Arduino 不是「C++ 扣掉什麼」，是「C++ 換掉一部分」。**本輪用手寫清單，並寫明理由。**
- **style**：⚠️ **未答**——Arduino 的排版接近 `apcs`，
  而 `io_style` 只有 `'cout' | 'printf'` 兩個值，**Serial 不是其中之一**。
  🔴 **而使用者已拍板：Serial 走語言套件的 `ioStyle` trait，核心的 `io_style` 不動。**
  → 所以 Arduino 目標**沿用 `apcs` 風格**，而「用 Serial 而不是 cout」
  由**概念層的等價邊**（`ioRole`）決定，不是由風格決定。

---

## 沒有查、而知道自己沒查的

- ⚠️ **`Serial.println` 的 lift 節點形狀**——只知道它會去評估 `Serial` 這個變數
  （錯誤是 `UNDECLARED_VAR`），**沒有印出實際的節點樹**。
  → 實作第一步就要印它，**不要照猜的形狀寫**。
- ⚠️ **`analogWrite` 的 PWM 語義**——本輪只存值，不模擬波形。
- 🔴 **中斷、`EEPROM`、`Wire`／`SPI` 完全沒查**——規格已排除。

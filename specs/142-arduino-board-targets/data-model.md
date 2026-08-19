# 資料模型：板子成為目標

## 新增：能力（capability）

一個**具名的性質**，字串。**用功能命名，不用板子命名**（見 [research.md](research.md) R1）。

本刀需要的（從語料與現有元件導出，不是發明的）：

| 能力 | 意思 | 誰需要它 |
|---|---|---|
| `touch` | 有電容觸摸感應腳位 | `cpp:touch_read` |
| `ledc-pwm` | 有 LEDC 硬體 PWM 控制器 | `cpp:pwm_attach`／`pwm_setup`／`pwm_bind`／`pwm_write` |

⚠️ **就這兩個。** 憲法第一條：不為假設性需求預留——第三個能力等**它的第一顆元件**出現。

---

## 改動一：元件宣告「我需要什麼能力」

`src/components/<scope>/<name>/component.json` 的既有 `traits` 多一個鍵：

```jsonc
{
  "conceptId": "cpp:touch_read",
  "traits": { "needsCapability": "touch" },
  "_traits_why": "**觸摸感應是板子的硬體能力**，不是這顆概念的語法性質——沒有那顆電容感應電路的板子上，這個函式不存在。與 `ioStyle` 同一個形狀：宣告「我只在某種世界裡有意義」。"
}
```

**規則**

- **沒宣告 ＝ 所有板子都有**（FR-007）。⚠️ 這是預設值的方向：
  否則每加一顆元件都要在三個地方登記，而那正是階段 6.5 要治的病。
- 一顆元件**最多一個** `needsCapability`。⚠️ 需要兩個的那天再改成陣列
  ——今天沒有那樣的元件（YAGNI）。

---

## 改動二：目標宣告「我提供什麼能力」

`src/core/types.ts` 的 `Target` 介面多一格：

```ts
export interface Target {
  id: string
  name: string
  topic: string
  style: string
  scaffold?: 'main' | 'none'
  /**
   * 這個目標提供哪些**能力**。
   * ⚠️ 省略 ＝ **全部提供**——非硬體目標（cpp／c／競程）不該因為
   * 多了這一格就開始少東西（FR-006）。
   */
  provides?: readonly string[]
}
```

**三塊板子**

| 目標 id | 名稱 | topic | provides |
|---|---|---|---|
| `arduino-uno` | Arduino Uno | `arduino` | `[]` |
| `arduino-nano` | Arduino Nano | `arduino` | `[]` |
| `esp32` | ESP32 | `arduino` | `['touch', 'ledc-pwm']` |

🔴 **三塊板子共用同一份 `arduino` 課程清單**——差別只在 `provides`
（[research.md](research.md) R1 否決了三份清單的方案）。

⚠️ 既有的 `arduino` 目標怎麼辦：**保留**，`provides` 給全部
（它是「不指定板子」的意思）。⚠️ 移除它會讓既有使用者的設定失效，
而 P8「不做向後相容」管的是投影與程式碼，**不管語義詞彙本身**。

---

## 可見集合的計算

```
工具箱可見 = 分類定義導出的積木
             ∩ 課程清單（topic）
             ∩ { 沒宣告 needsCapability，或 目標 provides 含它 }
```

⚠️ **只作用在工具箱**。`lift`／`generate`／`execute`／畫布上的既有積木**全部不受影響**
（[research.md](research.md) R4、R5）。

---

## 不在本刀的

| | 為什麼 |
|---|---|
| `Target.reference` | 另一半債，等第一個真消費者 |
| 屬性候選值隨目標變（腳位常數） | 需要一個不存在的機制，[research.md](research.md) R3 |
| 核心版本（2.x／3.x） | 同一塊板子的兩個工具鏈，不是兩塊板子 |

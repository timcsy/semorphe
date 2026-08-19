# 驗證指南：板子成為目標

> **這一份是「怎麼證明它真的做到了」，不是「怎麼實作」。**
> 實作細節在 `tasks.md`。

## 前置

```bash
npm test            # 起點必須全綠
```

---

## ① 機械驗證（CI 會跑）

```bash
# 能力供給完備性——每個被需要的能力都有目標提供
npx vitest run tests/integration/audit-capability-supply.test.ts

# 可拿性【不得】退步——它不必改判準（research.md R2）
npx vitest run tests/integration/audit-toolbox-reachability.test.ts

# 工具箱快照——三個非 Arduino 目標必須逐位元組不變（FR-006 / SC-003）
npx vitest run tests/integration/toolbox-snapshot.test.ts

# 本刀自己的
npx vitest run tests/integration/board-target-visibility.test.ts
```

**預期**

| | |
|---|---|
| `arduino-uno` 的工具箱 | **不含** `cpp_touch_read`、`cpp_pwm_*`（5 顆） |
| `esp32` 的工具箱 | 含那 5 顆 |
| `arduino-nano` | 與 `uno` **相同**（⚠️ 逐塊斷言，不從 uno 推論） |
| `cpp-beginner`／`c-beginner`／`cpp-competitive` | 快照**不變** |

---

## ② 🔴 最容易做錯的方向（US2）

```bash
npx vitest run tests/integration/board-target-lift-unaffected.test.ts
```

在 **`arduino-uno`** 目標下 lift 這一段：

```cpp
void setup() { Serial.begin(9600); }
void loop()  { int v = touchRead(T0); Serial.println(v); }
```

**必須**：語義樹含 `cpp:touch_read`，**且沒有** `raw_code`／`raw_expression`，
且 generate 回去**一字不差**。

> **把「拿不到」實作成「認不得」是這一刀最自然的錯法**
> ——而它違反 P4「這是過濾，不是簡化」。

---

## ③ 人工驗收（`skills/manual-acceptance` 的三段式）

⚠️ **開瀏覽器**，照 `knowledge/draft/2026-08-18-收工前的瀏覽器驗收.md` 的清單。

| # | 這在測什麼 | 怎麼按 | 好／壞長什麼樣 |
|---|---|---|---|
| **1** | 學生換板子只要一個動作（SC-004） | 目標選 `Arduino Uno` → 展開左邊每一個分類 | 🟢 找不到「觸摸」「PWM 通道」那幾顆<br>🔴 還在，或**整個分類消失了**（過濾過頭） |
| **2** | 切回去要復原 | 目標改 `ESP32` → 再展開 | 🟢 那 5 顆回來了<br>🔴 沒回來（過濾有殘留狀態） |
| **3** | 貼上的程式碼仍被理解 | 在 `Uno` 下貼上面那段 `touchRead` 的程式碼 | 🟢 出現**專屬**的觸摸積木<br>🔴 變成灰色的 `raw_code` 方塊 |
| **4** | 既有積木不消失 | 在 `ESP32` 下拉一顆觸摸積木到畫布 → 切到 `Uno` | 🟢 **積木還在畫布上**<br>🔴 它不見了（那會吃掉學生的作品） |

⚠️ **第 4 條是保護性的**——它驗的是「我們沒有順手做多」。

---

## ③ 收工前

```bash
npm test                    # 全綠
npx tsc --noEmit            # 過
```

🔴 **而 tasks.md 的第一批任務是護欄**（見 `plan.md` 的順序約束）——
如果你發現護欄是最後才寫的，那一刀的順序已經錯了。

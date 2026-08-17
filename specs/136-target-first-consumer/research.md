# Research：目標第二刀

**日期**：2026-08-17　**規格**：[spec.md](./spec.md)

> ⚠️ 本檔的規矩：**每一條都是跑出來的**。
> 推論寫成推論，量測寫成量測，而**兩個假設在這一輪就被推翻了**（Q2、Q4）。

---

## Q1：哪些登錄表沒有產品消費者？——護欄的第一個紅

**做法**：對 `src/` 底下每一個 `*registry*.ts`，數「`src/` 裡有幾個檔 import 它」。

| 登錄表 | src 內 import 它的檔數 |
|---|---:|
| `component/registry.ts` | 212 |
| `interpreter/executor-registry.ts` | 175 |
| `registry/lift-strategy-registry.ts` | 16 |
| `core/block-spec-registry.ts` | 7 |
| `registry/render-strategy-registry.ts` | 5 |
| `registry/transform-registry.ts` | 5 |
| `languages/cpp/std/module-registry.ts` | 2 |
| `core/topic-registry.ts` | 2 |
| `core/concept-registry.ts` | 1 |
| `core/view-registry.ts` | 1 |
| 🔴 **`core/target-registry.ts`** | **0** |

**決定**：護欄用「import 計數」判定，硬性零。
**理由**：11 個登錄表裡**恰好 1 個是 0**——判準乾淨，不需要例外清單。
⚠️ 而 `concept-registry` 與 `view-registry` 各只有 1 個消費者
——`experience.md:1030` 逐字說「**只有一個的更難發現，因為它看起來是在用的**」。
🔴 **本輪不管它們**（那是另一條規範），但護欄的報表要**印出全部的數字**，
讓「1」這件事看得見。

---

## Q2：🔴 假設被推翻——「requires 到 C 沒有的標頭」不等於「C 裡不存在」

**原本的計畫**：用 `requires` 推導排除清單，避免手抄（雙重真相來源）。

**量到的**：189 顆元件，**86 顆有 `requires`**。對照 `header-aliases.ts` 的
`C_TO_CPP`（19 筆）：

```
🟢 C 有對應標頭   <cstring> <cstdlib> <cctype> <cmath> <cstdio>              25 顆
🔴 C 根本沒有     <string> <algorithm> <numeric> <vector> <iostream>
                  <queue> <map> <stack> <utility> <set> <fstream>
                  <sstream> <stdexcept>                                      61 顆
```

### 而那 61 顆裡有 3 顆**不能排除**

```
cpp:print   requires <iostream>     ← 排掉它，C 就【印不出東西】
cpp:input   requires <iostream>
cpp:endl    requires <iostream>
```

> 🔴 **`requires` 記的是【C++ 投影所需的標頭】，不是【這個概念只存在於 C++】。**
> 而那兩件事在 185 顆上剛好一致，在這 3 顆上**剛好相反**。

⚠️ 這與 `history/072`§二 是同一族的錯誤：
「**這個東西存在嗎**」與「**這個東西被誰宣告**」是兩個問題。

### 🟢 而正確的判準已經存在，不需要發明

`components/cpp/print/component.json:23` 與 `print_formatted/component.json:28`：

```
cpp:print            { ioRole: 'print', ioStyle: 'iostream' }
cpp:print_formatted  { ioRole: 'print', ioStyle: 'cstdio'   }
```

`toolbox-builder.ts:119` 逐字：「`cpp:print` 與 `cpp:print_formatted`
宣告了同一個 `ioRole`（＝同一個等價類）與不同的 `ioStyle`（＝哪個成員）」。

**所以判準是兩個條件的合取**：

```
在 C 裡看不到  ⟺  requires 到 C 沒有的標頭
                ∧  【在 C 的風格家族裡沒有對應成員】（沒有 ioRole 等價邊）
```

**61 − 3 = 58 顆**排除。

⚠️ 而 `cpp:endl` 的元件檔第 20 行**早就寫了這件事**：

> 「我有 `ioStyle` 而**沒有 `ioRole`**——那不是漏了：`printf` 那邊沒有我的對應物
> （換行在格式字串裡是兩個字元，不是一顆節點）。**屬於一個家族，而在家族裡沒有對應物。**」

🔴 **所以 `endl` 兩個條件都滿足，照判準該被排除——而排掉它 C 也還是印得出東西**
（換行走格式字串）。**判準自己處理掉了這顆最難的**，不需要例外。
→ 最終排除 **59 顆**（58 ＋ `endl`），保留 `print`／`input`。

**決定**：C 課程清單 = `cpp-beginner` 的樹，**每個節點的 concepts 扣掉那 59 顆**。
**替代方案（否決）**：手寫一份完整清單 → 雙重真相來源，`cpp-beginner` 一改就漂移。

---

## Q3：🔴 第二個假設被推翻——預設只看得到 L0，而 L0 一顆都不用排除

`app.ts:118` 逐字：

```ts
this.enabledBranches = new Set([this.currentTopic.levelTree.id])
```

**開機時只有 L0 是開的。** 而 L0 的 19 顆概念裡，
requires 到 C 沒有的標頭的**只有 `print`／`input`／`endl`**——
而前兩顆正是判準保留的那兩顆。

```
🔴 所以「選 C → 工具箱裡的 C++ 專屬概念從 N 掉到 0」在預設狀態下是
   【19 → 19，一顆都沒少】——而那個 0 是【真的】，只是它什麼都沒證明。
```

> **一個在預設狀態下必然通過的驗收，量的是預設狀態，不是那個功能。**

⚠️ 這正是 `build-guardrail` 第 10 步：「測試通過之前，**先證明它真的測到了東西**」。

**決定**：SC-002 的測試**必須先把層級樹全部展開**，並**先斷言展開後 C++ 專屬概念 > 0**
（入口條件），再斷言切到 C 之後是 0。

---

## Q4：選擇器怎麼收攏，而總數不增加

**今天的工具列**：課程清單選擇器（下拉 ＋ 層級樹彈出）｜風格｜積木外觀｜語言

| 方案 | 選擇次數 | 選擇器數 | 問題 |
|---|---:|---:|---|
| A **目標下拉取代課程清單下拉**，層級樹彈出留著 | 1 | **不變** | 🟢 |
| B 目標取代**風格**選擇器 | 1 | 不變 | 🔴 `google`／`competitive` 風格**拿不到了**——違反第十九條護欄「可拿性」 |
| C 加一個目標選擇器 | 1 | **+1** | 🔴 違反 SC-009（反目標） |

**決定：A。** 目標下拉列出目標，選一個 → 同時設定課程清單與風格；
風格選擇器**留著**當微調（`google`／`competitive` 仍拿得到）。
層級樹彈出的職責不變（它本來就是「分支開關」，不是「選課程清單」）。

⚠️ **而 A 有一個副作用**：`cpp-competitive` 這份課程清單**沒有對應的目標**，
於是它會**拿不到**——那是功能倒退。
→ **加第三筆目標資料** `{ id:'cpp-competitive', topic:'cpp-competitive', style:'competitive' }`。
🟢 **那是資料不是機制**，不違反「目標不是新的抽象層」。

---

## Q5：存檔要怎麼加一格而不弄壞舊檔

`app.ts:604` 逐字：

```ts
topicId: this.currentTopic.id, enabledBranches: [...this.enabledBranches],
```

**決定**：加 `targetId`，而**還原時以 `targetId` 優先、沒有就回退到 `topicId`**。
**理由**：`history/026` 已經釐清 P8「不做向後相容」**不管語義詞彙本身**——
存檔遷移不在 P8 的豁免範圍內。
⚠️ 而 `targetId` 指向不存在的目標時**回退到預設**，不得崩潰（規格的 Edge Case）。

---

## Q6：中立性——目標資料怎麼進到核心

`target-registry.ts:5-8` 的檔頭**已經寫明**：

> 「**注入而不是 import**：中立性護欄禁『核心 import `languages/…`』
> （`audit-neutrality.test.ts:104`）。資料由語言套件在載入時 `register`。」

**決定**：照 `topicRegistry` 今天的做法（`app.ts:113-114` 在 UI 層 import JSON 再 `register`）。
🟢 `src/ui` 也在 `NEUTRAL_DIRS` 裡，**而 topic 今天就是這樣做且基線是 0**
——所以那條護欄放行的是「import JSON 資料」，不是「import 語言邏輯」。
⚠️ **本輪要照抄那個形狀，不要自己發明**（發明會撞上一條我沒讀完的規則）。

---

## 沒有查、而知道自己沒查的

- ⚠️ **59 顆排除清單的每一顆都對嗎**——判準是機械的，而我**沒有逐顆人工複核**。
  → 實作時把清單印出來，找 3 顆最像誤判的（`math_min`／`var_swap`／`pair_make`）人工看。
- ⚠️ **`concept-registry` 與 `view-registry` 各只有 1 個消費者**是不是真的健康——
  🔴 **沒查**，本輪不管，但護欄報表會讓它看得見。

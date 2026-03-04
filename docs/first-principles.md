# First Principles：程式碼與積木雙向轉換系統

**建立日期**: 2026-03-04
**適用範圍**: i18n、coding style、多語言支援、雙向轉換——所有子系統共用

---

## 第零觀察：程式 ≠ 程式碼 ≠ 積木

一個程式有三種存在形態：

```
「把 x 加 1」          ← 意圖（人腦中的想法）
「x++;」              ← 文字投影（程式碼）
[變數 x 加1（++）]     ← 視覺投影（積木）
```

程式碼不是程式本身，積木也不是程式本身。它們都是同一個**語義**的不同投影。這是整個系統最根本的洞察，以下所有原則都從這裡推導出來。

---

## 六個基本原則

### P1：語義模型是唯一真實（Single Source of Truth）

> 系統中存在且僅存在一個權威的程式表示——語義模型。程式碼和積木都是它的衍生視圖。

```
             Semantic Model
            （唯一的真實）
           ╱              ╲
     投影 A                投影 B
    程式碼                  積木
```

- 使用者在積木編輯器拖積木 → 修改語義模型 → 重新投影成程式碼
- 使用者在程式碼編輯器打字 → 解析成語義模型 → 重新投影成積木
- 兩邊永遠從同一個 model 衍生，不可能不一致

---

### P2：投影是參數化的（Parameterized Projection）

> 每一個投影都是一個函數：`f(語義, 參數) → 輸出`。改變參數會改變輸出的外觀，但不改變程式的意義。

```
程式碼 = generate(semantics, language, style)
積木   = render(semantics, language, locale)
```

**三個正交參數**：

| 參數 | 影響什麼 | 不影響什麼 |
|------|---------|-----------|
| **Language**（程式語言） | 兩邊都影響：能用的概念、型別、語法 | — |
| **Style**（編碼風格） | 只影響程式碼：格式、命名、慣例 | 不影響積木外觀 |
| **Locale**（介面語言） | 只影響積木：message、tooltip、dropdown label | 不影響程式碼 |

**正交性判定**：改了一個參數卻要連帶改另一個 → 關注點沒有分離乾淨。

---

### P3：投影必須可逆（Invertibility）

> 每個投影都必須有逆函數，否則雙向轉換不可能。

```
正向：semantics → code     (Generator)
逆向：code → semantics     (Parser)

正向：semantics → blocks   (Renderer)
逆向：blocks → semantics   (Reader)
```

**無損來回條件**：

```
parse(generate(S, lang, style), lang) ≡ S
read(render(S, lang, locale), lang)   ≡ S
```

不管怎麼投影再逆投影，語義不能丟失。但呈現資訊可以丟失（可接受）：
- 程式碼的縮排、空行 → 投影到積木再投影回來，格式可能不同（語義相同）
- 積木的位置、排列 → 投影到程式碼再投影回來，位置可能重排（語義相同）

---

### P4：語義與呈現分離（Semantic vs. Presentation）

> 資訊分兩種：**語義資訊**（改了程式會做不同的事）和**呈現資訊**（改了程式看起來不同但做一樣的事）。兩者必須分開儲存。

| | 語義資訊 | 呈現資訊 |
|---|---------|---------|
| **程式碼側** | 變數名、型別、邏輯 | 縮排、空行、命名風格、大括號位置 |
| **積木側** | 連接關係、field 值 | 積木位置 (x,y)、顏色、tooltip 文字 |
| **儲存** | 在語義模型中 | 在各自的 metadata 中 |

**特殊案例——變數命名**：變數名是語義資訊（`myVar` 和 `my_var` 是不同變數）。風格轉換必須在整個程式的所有引用點一致轉換才合法，需要理解作用域和引用關係。

---

### P5：概念分層（Concept Layering）

> 程式設計的概念有層次：有些是所有語言共通的（universal），有些是特定語言才有的（language-specific）。系統必須明確區分這兩層。

```
Universal 概念（所有語言都有）：
  變數、賦值、條件判斷、迴圈、函式、輸入輸出

Language-specific 概念：
  C++: 指標、struct、template、operator overloading
  Python: list comprehension、decorator、generator
  Java: interface、abstract class、exception hierarchy
```

**推論**：
- Universal 積木定義「概念的結構」，但不定義「型別清單」。型別清單由語言模組注入。
- Universal 積木的 tooltip 可以有預設文字（概念說明），但語言模組可以覆蓋（加入語言特定的細節）。
- 型別系統是 language-specific 的（C++ 有 `double`/`char`/`long long`，Python 沒有）。

---

### P6：優雅降級（Graceful Degradation）

> 當語義模型中的概念在目標投影中不存在時，系統不應崩潰，而應提供最佳近似。

**降級策略（按優先順序）**：

```
Level 1: 精確對應     → 用對應的積木/語法
Level 2: 近似對應     → 用最接近的積木/語法 + 警告
Level 3: 原始碼退回   → 用「直接寫程式碼」積木包住
Level 4: 不支援標記   → 標記為不支援，保留在模型中不丟失
```

**最重要的是 Level 4**：即使無法顯示，也**絕不丟失語義資訊**。

---

## 原則之間的關係

```
P1 (唯一真實)
 ├── P2 (參數化投影) ── 真實如何變成不同的外觀
 │    └── 正交性：Language × Style × Locale
 ├── P3 (可逆性) ────── 外觀如何變回真實
 │    └── 雙向轉換的數學基礎
 ├── P4 (語義/呈現分離) ─ 什麼是真實，什麼不是
 │    └── 決定什麼存在 model，什麼存在 metadata
 ├── P5 (概念分層) ───── 真實本身的結構
 │    └── universal vs language-specific
 └── P6 (優雅降級) ───── 當投影無法完美時怎麼辦
      └── 絕不丟失語義
```

---

## 四維架構

```
┌─ Locale（zh-TW / en）─── 控制人看的文字 ──────────┐
├─ Concept Layer ──── 積木結構、概念 ─────────────── ┤
├─ Language Layer ─── 型別、語言專屬積木 ──────────── ┤
├─ Style Layer ────── 程式碼生成風格 ─────────────── ┤
└──────────────────────────────────────────────────┘
```

每一層獨立可配置、獨立可擴充：
- 加新 locale = 加翻譯檔
- 改積木結構 = 只動 Concept Layer
- 加新語言 = 加 Language Layer
- 加新風格 = 加 Style preset

---

## 各子系統的應用指引

### 做 i18n（積木文字國際化）時

```
P2 → Locale 是投影參數，不是寫死的字串
P4 → message/tooltip 是呈現資訊，不屬於積木結構定義
     → 分離到 locale 檔案
```

### 做 coding style（編碼風格切換）時

```
P2 → Style 是投影參數，generator 接受 style config
P4 → 縮排、命名、大括號位置是呈現資訊
P3 → Parser 必須能辨識不同風格（可逆性）
P1 → 切換風格 = 用不同參數重新投影，model 不動
```

### 做多語言支援時

```
P5 → 區分 universal 概念和 language-specific 概念
P2 → Language 是投影參數，型別清單由語言模組注入
P6 → 跨語言轉換時，無法對應的概念用降級策略處理
```

### 做雙向轉換時

```
P1 → 建立顯式的語義模型，不要讓 workspace 直接當 model
P3 → parse(generate(S)) ≡ S 是正確性的判定標準
P4 → Parser 需要額外輸出 style metadata（偵測到的風格）
P6 → 無法解析的程式碼不是 error，是降級成 raw_code
```

---

## 積木文字設計準則（從 P2 + P4 推導）

### Message 設計

- **動詞 + 身份 + 名稱**：每個 message 回答「對誰做什麼」
- 身份標示系統：變數、函式、陣列、列表、指標、結構
- 用概念詞不用語言術語（型別名稱只出現在 dropdown 裡）
- 積木串起來讀起來要像一段中文敘述

### Tooltip 設計

- 統一公式：**一句定義 + 一句場景 + （注意事項）**
- Universal 積木用生活比喻，Advanced 積木重點放在「什麼時候用」
- 語言模組可覆蓋 tooltip（加入語言特定細節）

### Dropdown 設計

- 型別格式統一：`英文術語（中文）`，如 `int（整數）`
- 型別清單由語言模組提供，不寫死在 universal 積木裡
- 運算子格式：`中文（符號）`，如 `加上（+=）`

### 認知分層

| 層級 | 積木類型 | Message 策略 | Tooltip 策略 |
|------|---------|-------------|-------------|
| L0 初學 | Universal | 完全口語 | 生活比喻 |
| L1 進階 | Basic | 保留關鍵術語 | 技術說明 + 場景 |
| L2 高階 | Advanced | 可用更多術語 | 重點放在「什麼時候用」 |

---

## Coding Style 配置結構

### Style Preset 範例

```
APCS 考試:    cout/cin, camelCase, K&R, 4-space, using namespace std
競賽:         printf/scanf, snake_case, K&R, 4-space, bits/stdc++.h
Google Style: cout/cin, snake_case, K&R, 2-space, 不用 using namespace
```

### Style 三大功能

1. **使用者選擇**：切換 preset → 積木不動，重新生成程式碼
2. **自動偵測**：貼入程式碼 → 分析 I/O 方式、命名、縮排、namespace → 匹配最接近的 preset
3. **風格互轉**：Code(Style A) → Parser → 積木(無風格) → Generator(Style B) → Code(Style B)

### Style 對工具箱的影響

- APCS 風格 → 顯示 u_print (cout)，隱藏 c_printf
- 競賽風格 → 顯示 c_printf，隱藏 u_print
- 混合 → 兩者都顯示

---

## 一句話總結

> **程式碼和積木都不是程式，它們是同一個語義的兩種投影。投影由三個正交參數控制（Language, Style, Locale），必須可逆、無損、且語義與呈現嚴格分離。**

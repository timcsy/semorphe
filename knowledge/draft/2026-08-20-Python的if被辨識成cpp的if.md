# Python 的 `if` 被辨識成 `cpp:if`——而降級數是 0

> 2026-08-20　目標「把 Python 基本功能的積木做完」的第一次量測
> ## ✅ **已解決（2026-08-21，spec 167）**
>
> 修法走「**每一筆 pattern 明說文法**」，而**不是**從資料夾／`componentId` 推導
> ——使用者當場擋下了推導那一版，理由見第四節。
> 完整轉變見 `knowledge/history/118`。**本檔留作根因的量測紀錄。**

## 一、量測（貼一段真的 Python，走 lift）

```python
x = 5
y = x + 3
if y > 6: print("big", y)
else:     print("small")
while x > 0: x = x - 1
for i in range(3): print(i)
def add(a, b): return a + b
```

```
18×  unresolved
14×  cpp:var_ref          🔴
 5×  python:literal_number
 3×  python:print
 2×  python:literal_string
 1×  python:program
 1×  cpp:if               🔴
 1×  cpp:loop_while       🔴
 1×  cpp:loop_for         🔴
 1×  cpp:return           🔴
────────────────────────────
總節點 47，**其中降級 0**
```

## 二、🔴 「降級 0」不是好消息，它是這一條的核心

P6 誠實降級說：認不出來就變 `raw_code`，**灰色方塊，學生看得見**。

而這裡**一個降級都沒有**——不是因為都認對了，是因為**都被自信地認錯了**。

> **一個錯的身分比一個誠實的降級更糟，因為它不出聲。**
> 降級是一個**可見的**認知邊界；錯的身分是一個**不可見的**謊。

⚠️ 而它會通過所有現有的檢查：積木畫得出來（`cpp:if` 有形態）、
程式碼產得回去（`cpp:if` 的 generate 會吐 C++ 的 `if (…) { … }`）
——**於是一段 Python 貼進去，產出來會是 C++。**

## 三、根因：pattern 不知道自己屬於哪個語言

`src/core/types.ts:600`：

```ts
export interface LiftPattern {
  id: string
  astNodeType: string        // ← 只比對這個
  component?: { componentId: string }
  …                          // 🔴 沒有 language
}
```

而 tree-sitter-python 與 tree-sitter-cpp **有大量同名節點**：
`if_statement`／`while_statement`／`for_statement`／`return_statement`／`identifier`／`call`…

> **兩個文法各自獨立命名，而它們自然會撞名——
> 因為它們描述的是同一批程式語言概念。**
> **撞名不是巧合，是必然。而 pattern 的比對鍵剛好只有那個名字。**

### 語言歸屬的資訊**已經在系統裡**，只是沒被用

```
componentId 的前綴      cpp: / python:        237/237 都有
forms/blocks.json       "language"            cpp 215 · python 3 · universal 27
component.json          ❌ 沒有 language      （身分前綴就是它）
LiftPattern             ❌ 沒有                ← 缺口在這裡
```

## 四、修法（未定，三個候選）

| | 做法 | 評 |
|---|---|---|
| **A** | `LiftPattern` 加 `language` 欄位，每筆手寫 | ⚠️ 97+ 筆要編輯，而資訊是**導得出來的**——那是冗餘 |
| **B** | 🟢 **從 `component.componentId` 的前綴導出**，`PatternLifter` 依當前語言過濾 | 零編輯。而 `universal` 那 27 顆要有對應處理 |
| **C** | Parser 端就分開，兩套 PatternLifter | ⚠️ 兩份組裝，而 universal 的東西要複製 |

### 🟢 選 B，而兩個未決都量掉了（2026-08-20）

```
膠囊 lift-pattern     65 筆   cpp 55 · python 5 · 無 componentId 5
                              ⚠️ 那 5 筆全在 src/components/cpp/ 底下
                                 negate / logic_not / logic / compare / arithmetic
                                 —— 它們用 operatorDispatch，componentId 依運算子而定
共用 cpp/lift-patterns.json  5 筆   已經住在 src/languages/cpp/，位置就是歸屬
universal 的 lift pattern    0 筆   🟢 這一側根本不存在，不必設計
```

🔴 **所以歸屬不要從 `componentId` 導，要從【膠囊住在哪個資料夾】導。**

理由是那 5 筆 operatorDispatch：它們**沒有 componentId**，而資料夾說得出它們是 C++ 的。
而 `componentLiftPatternOwners()` **已經存在**（`lift-patterns.ts` 的「護欄用：每一筆是哪顆膠囊帶的」）
——**資訊已經在了，只是今天只有護欄在讀。**

> **一個「只有護欄在讀」的資訊，通常代表產品那側漏了一件事。**

⚠️ **而 scope ≠ language 這條仍然成立**（`hw` 在白名單上）。
今天 scope ∈ {cpp, python}，所以「scope 就是語言」是對的**而它是暫時的**。
🟢 **不要現在就替 `hw` 設計映射**——那是「為想像中的使用者設計介面」。
`hw` 進來的那天它會帶著自己的消費者。

## 五、驗收（它就是護欄）

```
一段 Python 程式碼 lift 出來，不得出現任何 cpp: 元件
```

🔴 **而它今天必須是紅的**（14× `cpp:var_ref` ＋ 4 顆語句），這符合
[build-guardrail](../skills/build-guardrail/SKILL.md) 6.5：護欄第一次跑必須紅。

⚠️ **反向也要**：C++ 那 4700+ 支測試一支都不准變——這是一個**過濾器**，
而過濾器最常見的壞法是「順便濾掉了本來該過的」。

## 六、它擋住什麼

🔴 **在這一條修好之前，加任何一顆 Python 元件都是徒勞**：
`python:if` 與 `cpp:if` 會在同一個 `astNodeType` 上競爭，
**而勝負由 `priority` 決定——那是一個沒有人設計過的排序。**

> **加積木之前要先讓辨識分得出語言，否則新積木只是多一個競爭者。**

## 相關

- [concepts/降級與認知邊界](../concepts/降級與認知邊界.md)——P6，而本條是它的反面
- [principles](../principles.md)「四項獨立性」——語言獨立性
- [通解與特解和小世界模型](2026-08-20-通解與特解和小世界模型.md)——等價與觀察集；
  ⚠️ 而本條說明**同名不等於同類**，那正是觀察集要回答的事


---

## 🔴 修的過程掀出四層，而**只有第一層是我原本以為的**

| # | 哪一層 | 為什麼護欄看不到它 |
|---|---|---|
| ① | lift pattern 沒有文法 | ← 原本以為只有這個 |
| ② | `app.ts` 硬編 C++ 的跳過清單 ＋ **寫死 import** C++ 的共用 pattern 檔 | 組裝點是護欄的豁免區 |
| ③ | **手寫 lifter 完全繞過 `PatternLifter`** | 過濾器裝在 pattern 那條路上，而 `for_statement` 走另一條 |
| ④ | `restoreState` 不走 `handleTargetChange` | 「切目標要做的事」在兩個地方各寫一次 |

> **一條繞過過濾器的路，會讓過濾器的報告變成一份【它看得到的範圍內】的報告。**

而 ③ 是**瀏覽器實測抓到的，測試全綠**——因為量測助手沒有註冊 C++ 的手寫 lifter：

> **一個比產品乾淨的量測環境，量到的是一個不存在的系統。**

④ 的症狀最兇：**存檔存的是 Python，重開之後整棵樹 `unresolved`，畫面一片空白。**

## 🟡 這一刀揭露、而**沒有修**的：降級積木也是全域單槽

`src/core/degradation-blocks.ts` 的 `let declared` 是**一個值**，
`src/languages/cpp/generators/index.ts:64` 宣告 `cpp_raw_code`／`cpp_raw_expression`
——於是**Python 的降級積木是 C++ 的**。

瀏覽器實測（修完之後）：一段 Python 產出 5 顆 `cpp_raw_code`。
🟢 **降級本身是對的**（誠實、看得見），而**那顆積木的身分是別的語言的**。

⚠️ **這不是這一刀造成的，是這一刀讓它現形**——在此之前那些節點根本沒降級，
它們被套上了 `cpp:if`／`cpp:loop_for` 這些**看起來正常**的身分。

→ 下一刀（Python 基本元件）要一起收：登記處改成**依語言**，並給 Python 自己的降級元件。

---

## 🟡 spec 168 順帶量到、而**未修**：網頁版會吃掉空行

實測（2026-08-21，瀏覽器）：貼一段有空行分段的程式碼 → 積木 → 產生回來，**空行不見了**。
⚠️ **C++ 與 Python 都一樣**——那不是這一刀造成的，也不是語言的問題。

```
src/core/projection/preserve-blank-lines.ts     機制【已經存在】（spec 140 那批）
src/vscode/webview/vscode-code-view.ts:229      🟢 擴充那側接上了
網頁版                                          🔴 沒有接
```

> **一個機制只接了一個宿主，那它的另一半是不存在的——
> 而「不存在」與「這個宿主不需要」在畫面上完全相同。**

⚠️ 而它**可能是刻意的**：擴充那側動的是**使用者的檔案**（排版屬於他），
網頁版的程式碼面板是產出來的。要不要接，是一個**設計決定**不是一個 bug 修法
——所以留在這裡等人拍板，而不是順手接上去。

判準：**網頁版的程式碼面板，是使用者的東西還是投影的產物？**
（同一個問題在 [面板協定的三個頻道](2026-08-20-面板協定的三個頻道.md) §二有另一個實例：
接線圖的擺放位置。）

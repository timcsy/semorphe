# spec 160：Python 的第一顆積木——雙向都要走得到，而 wasm 出貨

**路線圖位置**：階段 7 第三格（`vision.md:325`：「Python code ↔ **blocks** roundtrip 成功
—— ⚠️ 這一格要的是**積木**，而 spec 157 只走到程式碼那一側」）

## 為什麼是這一刀

`vision.md:289` 逐字：

> 剩下的 33 筆……**它等的是 Python 的第一顆【積木】，不是第一顆元件**
> ⚠️ **應該由 Python 逼出來，而不是憑空重寫**：重寫一個沒有第二個消費者的抽象，等於用猜的決定介面。

**這一刀是那 33 筆唯一的解鎖條件。**

## 動手前的基線（量出來的）

```
完備性缺       3   python:print 的 render／extract／execute
中立性三維     0 / 33 / 0
wasm           tests/assets/tree-sitter-python.wasm（460KB，不出貨）
python 套件    src/languages/python/ 只有 types.ts 一個檔
積木機制       🟢 宣告式：cpp/print/forms/blocks.json → registerBlocksFromSpecs()
```

## 🔴 出貨 wasm 的硬條件（第四十六條護欄）

`e2e/shipped-assets.spec.ts:2` 逐字：

> **第四十六條護欄**：出貨的每一個 wasm，都要有人真的去要它。

⚠️ **所以「把 wasm 搬進 public/」不是一個獨立動作**——它必須連著一個
**真的會在瀏覽器裡載入它**的 Python target。護欄會擋住「搬進去但沒人要」。

> 這正是這一刀該有的形狀：**出貨的理由是有人要它，不是我們想出貨。**

## 要做的

1. **`python:print` 的 `forms/blocks.json` ＋ `labels/`**——走**宣告式**
2. **render 與 extract 兩路補實**（完備性缺 3 → 1，只留 `execute`）
3. **最小 Python target ＋ `registerLanguage('python', …)`**，讓瀏覽器真的載入 wasm
4. **wasm 出貨**：`tests/assets/` → `public/`，`build:wasm:python` 的輸出改路徑
5. 🔴 **產出「block-registrar 對 cpp 的假設」清單**——這一刀真正買的東西

## 兩條到達路徑都要走

`experience.md:4618` 逐字：

> 一顆積木可以有兩條到達路徑（**工具箱拖出來** vs **貼上程式碼 lift 出來**），
> 而**修好其中一條，另一條上的學生什麼都沒感覺到**。

- **①** 從工具箱拖一顆 → 產出 `print(...)`
- **②** 貼 `print("hi")` → lift → **出現 `python_print` 積木**，不是降級的 `raw_code`

🔴 **②走不到那顆積木，本身就是一個發現**——而它多半是**身分**的問題。

## 明確排除（防蔓延）

- **Python 的執行期**——`execute` 留成**誠實的缺**，理由已寫在膠囊裡
- **第二顆 Python 元件**（`python:input` 是分歧點，價值高，但它要等積木機制先通）
- **重寫 `block-registrar` 的 33 筆**——⚠️ 這一刀的產出是**清單**，重寫是下一刀
- **完整 Python 語言套件**（cpp 有 59 個 `.ts`）
- **Python 的 topic／課程清單**——除非路徑①需要它才做最小的

## 已知的坑

1. 🔴 **假綠**：spec 157 抓到三個（護欄誤報／roundtrip 走降級路徑／只釘了「會報」）。
   → 斷言 `componentId === 'python:print'`，**不只比字串**（`history/108`）
2. 🔴 **只在測試裡綠**——要開瀏覽器貼真的 Python
3. 🟡 **`skipPaths` 沒有「建構中」**（`history/107`）——render／extract 補完就不需要它
4. **中立性三維不得上升**（0/33/0）

## 驗收

- [x] 🔴 `python_print` **沒有在 `block-registrar` 加任何一行命令式註冊**（P3 通過）
- [x] 🔴 路徑①：工具箱「輸入輸出」拿得到 → 拖一顆 → `print()`（**瀏覽器實測**）
- [x] 🔴 路徑②：貼 `print("hi")` → **`python_print` 積木**（**瀏覽器實測 ＋ 截圖**）
- [x] 積木 → extract → 樹 → generate 一字不差
- [x] 完備性缺 3 → **4**（⚠️ 不是 1——見下）；中立性三維維持 0/33/0
- [x] 🔴 wasm 出貨且 **e2e 第四十六條護欄綠**
- [x] 🔴 **假設清單產出：9 筆**
- [x] 反向：4777 綠、e2e 37 全過

## ⚠️ 一項驗收沒有照原本的數字達成

「完備性缺 3 → 1」**沒有達成，實際是 3 → 4**——而它是**兩個相反動作的淨值**：

```
🟢 -2   python:print 的 render／extract 補實了
🔴 +3   新的 python:program（程式根）——它是路徑②的結構前提，被逼出來的
```

spec 寫「不做第二顆 Python 元件」時，**沒有預見路徑②在結構上需要一個程式根**：
`renderToBlocklyState` 的第一行問「這顆是不是程式根」，Python 沒有 → **回空清單、零錯誤**。

> **它不是第二個功能，是路徑②的結構前提。**

---

# 🔴 交付：`block-registrar` 與核心對 C++ 的假設清單

**這是這一刀真正買的東西。** 每一筆都是**被 Python 撞出來的**，不是想出來的。

| # | 位置 | 假設 | 症狀 | 本刀處置 |
|---|---|---|---|---|
| 1 | `component.json` 的 `children` | — | `python:print` 宣告 `{}` 而 lift 一直產出 `values`，**沒有東西說話**（宣告完整性護欄的語料是 C++ 的） | 補宣告 ＋ **新增一支「宣告↔實際」的斷言**（注射逼出來的） |
| 2 | 可拿性護欄 → `cppCategoryDefs` | 工具箱分類只有 cpp 那一份 | `python_print`「使用者拿不到」 | 新增 `core/toolbox-categories.ts` 宣告登記處 |
| 3 | `audit-curriculum-coverage` 的 glob | `languages/cpp/topics/*.json` | Python 收錄了而護欄說「不在任何課程裡」 | glob 改成 `languages/*/topics/` |
| 4 | `audit-completeness` 的 `tsParser` | **用 C++ 解析器量所有元件** | `python:program` 被判成「lift 殼」 | 非 cpp 判「無法確定」＋理由 |
| 5 | `componentWithTrait('programRoot')` | **全域只有一個程式根** | 回傳第一個匹配 → 第二個語言**靜默失效**，畫布空白零錯誤 | 改成 `isProgramRoot()`（**問宣告，不比全域單值**） |
| 6 | `cppStripScaffoldNodes` | 剝 C++ 的 `main` 外殼 | 套在 Python 樹上（目前無害，`buildProgram` 重建根） | 記錄，未動 |
| 7 | `Target.entryShell` 預設 `'main'` | 沒宣告就是 C++ | 切到 Python 產出 `int main(){ print("hi") return 0; }` | Python target 宣告 `entryShell: 'none'` |
| 8 | 🎯 **`block-registrar` 的可變參數機制** | `appendValueInput('EXPR'+idx)` 是**命令式的、只認 cpp** | `The block "python_print" is missing a(n) EXPR0 connection` | **不重寫**（vision 明令）——改成固定單參數，把界線**變成可量的** |
| 9 | `audit-projection-loss` 只認 `skipPaths` | 「沒有 render」只有一種表達方式 | 程式根被報成「body 找不到落點」 | 認得「render 記成誠實的缺」這個形狀 |

## 🔴 第 8 筆就是 vision 那 33 筆

`vision.md:289` 逐字：「**它等的是 Python 的第一顆【積木】**……**應該由 Python 逼出來，
而不是憑空重寫**」——**它等到了，而且症狀是具體的**：可變參數的 `print(a, b)` 走不完，
固定單參數的 `print(x)` 走得完。那條界線現在**看得見、量得到**。

## 鄰域的邊界（階段 7 的第二個交付）

| 邊界 | 內容 |
|---|---|
| ① 字面常數 | `print("hi")` 的引數降級成 `raw_code`——**沒有語言中立的字面常數元件**，233 顆全是 `cpp:` |
| ② 程式的入口 | `cpp:program`（`int main(){…}`）與 `python:program`（什麼都不包）**在觀察集「產出的形式」下不落在同一類**——`abstractComponent` 誠實地留 `null` |
| ③ 參數的元數 | 可變 vs 固定——第 8 筆 |

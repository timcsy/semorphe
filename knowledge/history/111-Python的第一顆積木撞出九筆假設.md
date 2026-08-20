# 111：Python 的第一顆積木——它撞出九筆核心對 C++ 的假設

**日期**：2026-08-20 ｜ **spec**：160 ｜ **前一步**：[108](108-讀了而不驗而等價升級成行為時抓到三個假綠.md)

## 轉變

| | 之前 | 之後 |
|---|---|---|
| Python 的積木 | 🔴 零 | 🟢 `python_print`，**宣告式**（`block-registrar` 一行沒動） |
| 兩條到達路徑 | 🔴 都走不到 | 🟢 **瀏覽器實測**：工具箱拿得到 ／ 貼程式碼出得來 |
| wasm | 🔴 `tests/assets/`，不出貨 | 🟢 `public/`，**而它出貨的理由是有人要它** |
| Python 的課程 | 🔴 沒有 | 🟢 `python-beginner`（一顆積木——**那正是它要說的話**） |
| 核心對 cpp 的假設 | 🔴 **不知道有幾筆** | 🟢 **九筆，逐筆指名**（清單在 spec 160） |

## 為什麼這一刀值得

`vision.md:289` 逐字：

> 剩下的 33 筆……**它等的是 Python 的第一顆【積木】，不是第一顆元件**
> ⚠️ **應該由 Python 逼出來，而不是憑空重寫**。

**它等到了，而且症狀是具體的**：可變參數的 `print(a, b)` 走不完，
固定單參數的 `print(x)` 走得完——因為 `appendValueInput('EXPR'+idx)` 那段機制
**是命令式的、寫死在 `block-registrar` 裡**。

> 那條界線現在**看得見、量得到**，不是一句猜測。而這一刀**沒有重寫它**。

## 最深的一筆：一個全域單值

```ts
if (tree.componentId !== programRootComponent()) return { blocks: [] }
//                       ↑ componentWithTrait('programRoot') → 回傳【第一個匹配】
```

第二個語言宣告 `programRoot` 之後，**其中一個會靜默失效**——回空清單、零錯誤，
使用者看到**空白畫布**。已改成 `isProgramRoot()`：**問這顆自己的宣告，不跟全域單值比**。

教訓進了 [experience](../experience.md)：
> **一個「全域只有一個」的假設，在第二個成員出現時不會報錯——它會挑一個。**

## 鄰域的邊界（階段 7 的第二個交付）

| 邊界 | 內容 |
|---|---|
| ① 字面常數 | 引數降級成 `raw_code`——**沒有語言中立的字面常數元件**，233 顆全是 `cpp:` |
| ② 程式的入口 | 兩顆都叫「程式的根」，而在觀察集「產出的形式」下**不落在同一類**（`abstractComponent` 誠實留 `null`） |
| ③ 參數的元數 | 可變 vs 固定 |

## 兩個順帶做成的決定（判官逼出來的補記）

**① `core/toolbox-categories.ts`——第九個宣告登記處**

「這個語言的工具箱有哪些分類」原本寫死成 `cppCategoryDefs`，`app.ts` 與可拿性護欄
各自 import 它。加一個登記處（**語言套件推、核心讀**）之後，`app.ts:640` 依
`currentTopic.language` 選，工具箱切語言就跟著換。

⚠️ 而這個形狀**已經是第九次**了（`comment-syntax`／`skip-declarations`／
`degradation-blocks`／`standalone-block`／`language-executors`／`non-components`／
`board-constant-dropdown`／`variable-dropdown`／`toolbox-categories`）
——它在這一輪被升格成一個概念：[宣告登記處](../concepts/宣告登記處.md)。

**② `Target.entryShell: 'none'`**

`app.ts` 三處寫著 `target.entryShell ?? 'main'`——**沒宣告就是 C++**。
於是切到 Python 貼 `print("hi")`，使用者拿到
`int main() { print("hi") return 0; }`，**而全套測試是綠的**（測試繞過了外殼）。

🟢 處置是讓那個目標**自己說**它沒有外殼，不是在核心加分支。

## 代價，要誠實記

驗收的「完備性缺 3 → 1」**沒有達成，實際 3 → 4**。那是 **-2（補實兩路）＋3（新的程式根）**
的淨值——spec 寫「不做第二顆 Python 元件」時，**沒有預見路徑②在結構上需要一個程式根**。

> **它不是第二個功能，是路徑②的結構前提。**

而九條護欄的棘輪／凍結清單全部**顯式處置並註明原因**，無一靜靜重產。

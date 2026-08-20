# spec 161：manifest 驅動的語言載入——加一個語言，`app.ts` 一行都不用改

**路線圖位置**：階段 7 的**最後一格**（`vision.md:342`）

## 為什麼有這一刀——而它先講一件上一刀弄壞的事

spec 160 把 Python 接進 `app.ts`，加了 **5 個 import ＋ 3 行註冊 ＋ 一個
`language === 'python'` 分支**。加第三個語言就是再五處。

`principles.md:65` 逐字：

> 系統可以在**不修改既有程式碼**的前提下加入新元件、新語言、新套件。

🔴 spec 160 證明了「加一顆**積木**」成立（`block-registrar` 一行沒動），
而「加一個**語言**」**今天不成立**——**而沒有任何東西說話**：
`app.ts` 是中立性護欄豁免的組裝點，報表只印一句
「組裝點明確豁免——它知道自己裝了什麼是正常的」，**它不印數字**。

> `experience.md:4799` 逐字：「一條護欄的每個**例外**，都要能回答
> **『它今天豁免了幾筆』**與『理由是什麼』。」

**`app.ts` 今天答不出第一個問題。**

## 動手前的基線（量出來的）

```
app.ts 指名語言的行    🔴 47
有 manifest 的語言      🔴 1 / 2（python 沒有）
cpp manifest 的 provides  components / blocks（缺 topics / targets / styles / categories）
宣告登記處              9 個，而【8 個只有一個宣告者，全是 cpp】
toolbox-categories      🔴 不對稱：cpp 繞過自己的登記處（app.ts 直接 import cppCategoryDefs）
中立性三維              0 / 33 / 0
```

## 判準：不是「有幾個字串」，是「加一個語言要編輯幾處」

⚠️ **組裝點知道自己裝了「一些語言」是正常的**，所以數字串會誤判。
真正該零的是**每個語言各自一份的接線**——它才是「加第三個語言的代價」。

## 要做的

1. **Python 的 `manifest.json`**；cpp 的 manifest 補 `topics` / `targets` / `styles` / `categories`
2. `app.ts` 改成**從 manifest 載入語言**，不逐個 import
3. 順手收掉 `toolbox-categories` 的不對稱（**cpp 也走登記處**）
4. 中立性護欄對 `app.ts` 的豁免**改成附數字**

## 明確排除

- **`print(a, b)` 與那 33 筆**——它是**下一刀**。順序不能反：重寫那 33 筆要先知道
  「積木定義怎麼從 manifest 來」，否則會**再猜一次介面**
- **第三個真的語言**——驗收用 **stub**
- **把 34 個 cpp import 全清光**——多數是元件與產生器，不是語言套件的接線

## 已知的坑

1. 🔴 **`app.ts` 是最大的檔** —— spec 160 有三次「測試綠而瀏覽器紅」。**看截圖**，不只讀 log
2. 🔴 **`__app` 逃生口型別檢查看不到**（`component-rename` skill 最後一節）
3. 🟡 **`import.meta.glob` 的樣式必須是字面常數**（`core/component/registry.ts` 檔頭）
   —— 沿用膠囊登錄表的既有形狀

## 驗收

- [ ] 🔴 `app.ts` 指名語言的行 **47 → 0**
- [ ] 🔴 兩個語言都有 `manifest.json`，`provides` 六項齊全
- [ ] 🔴 中立性護欄的 `app.ts` 豁免**附上數字**
- [ ] `toolbox-categories` 的宣告者從「只有 python」變成 **cpp ＋ python**
- [ ] 中立性三維不上升；4777 綠；**e2e 綠 ＋ 瀏覽器截圖**

---

# 結果

| | 動手前 | 之後 |
|---|---|---|
| **選單接線**（topic/target/style/分類/解析器） | 🔴 — | 🟢 **硬性零** |
| **語言管線**（產生器/lifters/鷹架/診斷） | 🔴 — | 🟡 **12，棘輪**（另一刀） |
| 兩者合計 | 🔴 47 | 🟡 12 |
| 有 manifest 的語言 | 🔴 1 / 2 | 🟢 2 / 2，`provides` 六項齊全 |
| `app.ts` 的豁免 | 🔴 只有一句話 | 🟢 **附數字** |
| `toolbox-categories` 的宣告者 | 🔴 只有 python | 🟢 cpp ＋ python |

## ⚠️ 驗收的「47 → 0」拆成了兩個數字，而那不是搬目標

原本的一個數字**把兩種債加在一起**：

```
選單接線   spec 160 弄壞的，當天就還得完
語言管線   既有的，要把整個 bootstrap 搬進安裝鉤——而它們與 app.ts 自己的物件深度交織
```

> **一個把兩種債加總的數字，會讓還完的那一半看起來沒還。**

🟢 而**兩個數字都印出來**，語言管線那一半有自己的棘輪與基線。

## 🎯 核心驗收：真的加一個語言

一次性實測：建 `src/languages/stub/pack.ts`（一個檔）之後 —

```
app.ts   🟢 一個 byte 都沒動（diff -q）
登記表   🟢 stub 進了語言登記表與目標登記表
```

stub 當場刪掉——留在 `src/languages/` 裡的話每一條吃語言清單的護欄都會多一筆假資料。
常設的那一支改成**檢查機制的形狀**（載入器的 glob 不得指名任何語言）。

## 🔴 四件測試綠而瀏覽器紅

| 症狀 | 根因 |
|---|---|
| 預設目標變成 **Python** | `allLanguagePacks()[0].targets[0]`——靠陣列位置。而 `default: true` **早就宣告在 topic 上** |
| 選單順序亂掉 | 載入器裡的 `void Object.keys(mods).sort()` **一行效果都沒有**：eager glob 在取得鍵之前就 import 完了 |
| 狀態列一直說「C++」 | `app-shell.ts:799` 把 `'C++'` **寫死在字串裡**——只有截圖抓得到 |
| 板子護欄說「板子沒註冊」 | 它掃 `app.ts` 的**文字**，而註冊搬家了 → 改成**問登記表** |

## 另外兩件

- 🔴 **循環初始化**：`import.meta.glob({eager:true})` 被提升成靜態 import，
  登記表**不能自己 glob 自己的宣告者** → 拆成 `load-language-packs.ts`
- 🔴 **修好一個真缺陷**：切目標可能就是切語言，而**沒有人叫 `setLanguage`／`setCodeContext`**
  ——`generateCodeWithMapping(tree, 'cpp', …)` 對 Python 的樹照樣產得出東西，只是語言參數是錯的

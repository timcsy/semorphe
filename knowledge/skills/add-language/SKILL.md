---
name: add-language
description: >
  加一個**新語言**（不是加一顆元件）——語言套件、解析器、文法歸屬、
  以及四個「全域只有一份」的登記處。
  ⚠️ 它與 component-pipeline 是**不同的路**：那條假設語言已經在了。
user-invocable: true
---

> **語言指示**：所有輸出文件（報告、摘要、註解）必須使用**當前對話的語言**撰寫。

# 加一個語言

## ⛔ 先問一句：你要加的是語言，還是**教學語言**？

```
教學語言   c-beginner / cpp-beginner / cpp-competitive / arduino   ← 四個【共用一個文法】
語言       cpp / python                                            ← 各自一個文法
```

🔴 **加一個教學語言不走這支**——那是加一份 `topics/*.json` ＋ 一份 `targets/*.json`，
`cpp` 套件底下就做得完。

> **語言是套件的邊界，文法是 `astNodeType` 那個字串的命名空間，
> 而教學語言是課程的邊界——三個不同的東西。**

## 這一支的來源

Python 從 0 到 23 顆元件（specs `156`／`157`／`160`／`161`／`167`／`168`），
而**那條路的清單當時只存在於六條 history 裡**。

> **一張「加一個語言要做什麼」的清單，如果只存在於幾條護欄的失敗訊息裡，
> 那麼每一個新來的人都要把那幾條各撞一次才學得會。**

---

## 一、順序——**它不是任意的**

```
① 文法（解析器 ＋ wasm）           沒有它，後面每一步都驗不了
② 語言套件的骨架（pack.ts）        🔴 而 grammar 是其中最重要的一格
③ 程式根元件 ＋ 結構性 lift pattern  沒有它，任何程式碼都 lift 不出樹
④ 降級的落點                       沒有它，「認不出來」會用【別的語言的積木】
⑤ 工具箱分類                       沒有它，積木全做好而使用者一顆都看不到
⑥ 第一顆真的元件                   走 component-pipeline
```

⚠️ **③④⑤ 很容易被跳過**，因為它們**不會讓任何測試變紅**——
它們的症狀是「做完了而使用者看不到／看到的是別的語言的東西」。

---

## 二、🔴 第一件要決定的事：**文法不是語言**

```jsonc
declareLanguagePack({
  id: 'python',
  grammar: 'tree-sitter-python',   // 🔴 這一格
  …
})
```

⚠️ **它與 `id` 不是同一件事，而今天就已經不是**：`cpp` 這一個套件服務四個教學語言，
而它們共用**一個**文法。以 `id` 當過濾鍵會讓 `c-beginner` 拿不到 C++ 的 pattern。

### 而**每一筆 lift pattern 都要宣告它寫給哪個文法**

```jsonc
{ "id": "…", "grammar": "tree-sitter-python", "astNodeType": "if_statement", … }
```

🔴 **這是這條路上最貴的一課**（`history/118`）。沒有它時的症狀**不是報錯**：

```
貼一段真的 Python 進去 →  18× unresolved · 14× cpp:var_ref
                          1× cpp:if · cpp:loop_while · cpp:loop_for · cpp:return
                          ────────────────────────────
                          總節點 47，【其中降級 0】
```

> **「降級 0」不是好消息**——不是都認對了，是**都被自信地認錯了**。
> **一個錯的身分比一個誠實的降級更糟，因為它不出聲。**

原因是必然的：

> **兩個文法各自獨立命名，而它們自然會撞名——因為它們描述的是同一批
> 程式語言概念。撞名不是巧合，是必然。而 pattern 的比對鍵剛好只有那個名字。**

⚠️ **不要從資料夾或 `componentId` 前綴推導文法**——
「命名慣例不是契約」，而這個專案在那上面付過三次學費（全部靜默失效）。

### ⚠️ 而 pattern 不是唯一一條路

**手寫的 lifter 繞過 `PatternLifter`**，所以它們也要文法：

```ts
lifter.registerFor('tree-sitter-cpp', () => registerCppLiftersInner(lifter, …))
```

> **一條繞過過濾器的路，會讓過濾器的報告變成一份【它看得到的範圍內】的報告。**

---

## 三、🔴 四個「全域只有一份」的登記處——**每一個都要宣告**

```ts
declareLanguagePack({ id, name, grammar, order, topics, targets, styles, categories,
                      createParser, liftPatterns, liftTransforms, liftSkipNodeTypes,
                      programRoot,   // 🔴 見下
                      install })     // 🔴 見下
declareToolboxCategories('<lang>', …)
declareDegradationBlocks('<lang>', { statement: '<lang>_raw_code', expression: '<lang>_raw_expression' })
declareCommentSyntax('<lang>', <lang>CommentSyntax)
```

⚠️ **後兩個原本是全域單槽**（`history/119`），而症狀是：

```
降級積木沒宣告   一段新語言的程式碼降級之後，產出【別的語言的】灰色方塊
註解語法沒宣告   核心誠實地回退到 ⟨comment: …⟩ ——而那不是錯誤，是設計
```

> **一個「全域只有一份」的登記處，等於宣告了「這個系統只有一個語言」。**

🔴 **而宣告的【時機】要一致**：全部在**模組頂層**，不要在工廠函式裡。
一個語言在載入時宣告、另一個在第一次用時宣告
→ **登記處的內容依賴呼叫順序，而呼叫順序不是任何人設計的。**

#### 🔴 `programRoot` 與 `install`——這兩格漏掉的症狀是**一段看不懂的訊息**

使用者 2026-08-21 回報：切到新語言之後程式碼面板顯示
`⟨unknown component: cpp:program⟩`——**積木是對的、執行結果是對的**。

```
漏了 programRoot   組裝點只能用「第一個宣告了 traits.programRoot 的元件」
                   —— 而 `componentWithTrait` 回傳第一個匹配，它會挑到別的語言的
漏了 install       這個語言的產生器【從來沒有被註冊過】
                   —— 根對了，而沒有人認得它
```

⚠️ **兩層，而第二層藏在第一層的錯誤訊息後面**：訊息一模一樣，只差前綴。

> **一個「未知的 X」錯誤修好之後，再跑一次同一個情境
> ——訊息「變了」與訊息「消失了」是兩件事。**

⚠️ 而 `programRoot` 是**兩份宣告**：元件說「我是一個程式根」，
套件說「我的程式根是它」。**它們說的不是同一句話**，由護欄互相對帳
（`audit-program-root`）。

### 判準：還有沒有別的登記處要宣告？

```bash
grep -rn "^export function declare" src/core/*.ts src/core/*/*.ts
```

**每一個 `declareXxx` 都問一次「這個語言要不要宣告」**——
而「不用」也要**在 pack.ts 裡留一句話**，否則下一個人分不出「不用」與「忘了」。

---

## 四、🔴 結構性的 lift pattern——**不屬於任何一顆元件，而少了它接點會裝垃圾**

每個文法都有「殼」要拆，而它們不是元件：

```jsonc
// languages/<lang>/lift-patterns.json
{ "astNodeType": "block",                "component": { "componentId": "_compound" },
  "fieldMappings": [{ "semantic": "body", "ast": "$text", "extract": "liftChildren" }] }
{ "astNodeType": "expression_statement",  "patternType": "unwrap", "unwrapChild": 0 }
```

⚠️ 沒有 `block → _compound` 的症狀（實測）：

```
else_body: [unresolved]     接點【在】、長度是 1、而裡面是一顆認不出來的節點
```

> **「接點空了」與「接點裡是垃圾」，在斷言 `length === 1` 時完全相同。**

🔴 **而 `liftSkipNodeTypes` 也是文法的性質**——它原本是組裝點裡一串硬編的
C++ 節點型別，**而那一串套用在所有語言上**。

---

## 五、⚠️ 探 AST **不要猜**——猜錯的症狀是「安靜地少做」

```ts
// 寫一支拋棄式測試，把真的 AST 印出來
const t = await parser.parse('if a:\n  b\nelif c:\n  d\nelse:\n  e\n')
dump(t.rootNode)   // 印出 type ＋ childForFieldName 的每一格 ＋ namedChildren
```

實測撞到的三個（**全部是猜出來的**）：

| 猜的 | 實際 |
|---|---|
| `elif` 像 C 那樣**遞迴巢狀** | 🔴 `if_statement [識別字, block, elif_clause, elif_clause, else_clause]`——**全是兄弟** |
| `comparison_operator` 有 `left`／`right` | 🔴 只有 `operators`，運算元是**位置式**的 |
| `binary_operator` 的運算子要拿未具名子節點 | 🟢 它**有**具名的 `operator` 欄位（C++ 那個沒有） |

> **一個結構猜錯了，症狀不是崩潰，是【安靜地少做】。**
> 第一個的後果：只拿到第一個 elif、else 永遠拿不到——而產出來的是一個
> 「少了兩個分支」的 if，**看起來完全正常**。

⚠️ **同一族的節點，在同一個文法裡也未必是同一個形狀。**

---

## 六、wasm 要**出貨**，而且要**有人去要它**

```
public/<lang>.wasm    放進去
vite 的 build         確認 dist/ 也有
🔴 而第四十六條護欄問的是另一件事：「出貨的每一個 wasm，都要有人真的去要它」
```

**一個放進 `public/` 而沒有任何程式碼會去抓的 wasm 是死重**——
那條護欄會抓它，而它抓到的其實是「解析器還沒被接上」。

---

## 七、量測環境**必須與產品走同一條路**

新語言的測試助手很容易寫得**比產品乾淨**：

```
🔴 實測：助手沒有註冊 C++ 的手寫 lifter，於是它比產品乾淨
        護欄說「0 個外語身分」，而瀏覽器裡 `for i in range(3)` 仍是 cpp_loop_for
```

> **一個比產品乾淨的量測環境，量到的是一個不存在的系統。**

→ 助手要**照產品的組裝點做**：同樣的登記處、同樣的手寫 lifter、同樣的 skip 清單。

⚠️ 而 `generateCode(tree, language, style)` **自己會設依語言的登記處**——
lift 那一側沒有 `language` 參數，所以助手要明說。

---

## 八、切語言時**兩條路都要切**，而還原是第三條

```ts
handleTargetChange()   → setActiveGrammar / setLanguage / setTopic / reloadBlockSpecs …
restoreState()         🔴 它【刻意不走】上面那條（註解逐字：「WITHOUT triggering resync」）
```

> **一條「只在還原時走」的路，會安靜地漏掉每一件在另一條路上做的事。**

實測的症狀：**存檔存的是新語言，重開之後整棵樹 `unresolved`，畫面一片空白。**

---

## 九、驗收——**兩個數字，不是一個**

```
選單接線（topic／target／style／分類／解析器）   🟢 硬性零
語言管線（產生器／lifters／鷹架／診斷）           🟡 棘輪
```

⚠️ **第一版把兩者混成一個數字（47），而那讓「做完了沒」問不出答案。**

而真正的驗收是**貼一段真的程式碼**：

- [ ] 🔴 一段該語言的程式碼 lift 出來，**不得出現任何別的語言的元件身分**
- [ ] 🔴 認不出來的走**誠實降級**，而那顆積木是**這個語言自己的**
- [ ] 🔴 **反向**：既有語言的測試一支都不變
- [ ] 🔴 **兩個方向各走一次**——`程式碼 → 積木` 與 `積木 → 程式碼`
      ⚠️ 它們**各自有組裝**：只驗一個方向會漏掉另一個（2026-08-21 實測，
      而使用者是**按了執行**才走到第二個方向）。
      > **一個缺陷如果只在某一條投影上出現，任何不經過那條投影的檢查都會是綠的。**
- [ ] 🔴 **開瀏覽器**——工具箱每個分類截圖、拖一顆出來看、與既有語言的同族並排
      （走 [[verify-in-browser]]。`length` 答得出「有幾個」，答不出「長對了沒」）
- [ ] 🔴 **跑一支真的程式**——按執行鍵，看主控台
      （宣告完整 ≠ 那一路跑過。見 `history/121`：17 顆執行器存在而從沒被跑過）

---

## 十、然後才是元件

第一顆走 [[component-pipeline]]，而 [[component-generate]] 有一節
「**第二個語言的第一顆**」——`owner` 要蓋這個語言的章、顏色抄同族的既有元件。

⚠️ **第一顆走完整條路（含瀏覽器）才批次寫其餘**：
實測批次寫 16 顆之後才看，於是 `owner` 與顏色兩個錯**複製了 16 份**。

> **可以批次的是「寫」，不可以批次的是「驗」。**

---

## 明確否決的做法

| 做法 | 為什麼不行 |
|---|---|
| 從資料夾／`componentId` 前綴推導文法 | 命名慣例不是契約——三次靜默失效的前科 |
| 「先讓它跑起來，過濾之後再加」 | 「暫時寬鬆」的預設會在**第二個語言進來的那天**變成錯的答案 |
| 照抄既有語言的整包目錄 | 抄到的可能是那個語言的**教學設計**（分類、課程），不是機制 |
| 先擺好空的工具箱分類等積木 | 空段落與「這個分類就是這麼小」長得一模一樣 |
| 憑 grammar 文件寫 AST 形狀 | **探針印出來**——三次猜錯，三次都是「安靜地少做」 |

## 相關

- `knowledge/history/118`——文法不是語言，而歸屬要用宣告的
- `knowledge/history/119`——全域單槽是在宣告這個系統只有一個語言
- `knowledge/history/120`——三個宣告式建構子，以及「開瀏覽器不是動作，是用眼睛」
- [[component-pipeline]]／[[component-generate]]——語言就位【之後】的路
- [[verify-in-browser]]——收工前的那一步
- `concepts/等價與觀察集.md`——「這兩個語言的 X 是同一個概念嗎」怎麼問

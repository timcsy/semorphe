# 整合關卡：`cpp:pointer_step`（管線 197・階段五）

2026-09-19｜分支 `197-cpp-iter-step`

## 這一關問的八個問題，逐條量出來的答案

### ① 十一本清冊有沒有一本是我推出來的

**24 本**都真的有它（`grep` 掃 `tests/baselines/` ＋ `tests/assets/`）：

```
anchor-rot · block-instantiable · category-colour · completeness ·
component-parity-vector-declare · curriculum · declaration-assembly ·
declared-props · declared-slots · dropdown-domain · flow-vocabulary ·
identity-namespace · layering · lesson-vocabulary · locality ·
projection-residual · refcc-headers · silent-downgrade · silent-fallback ·
string-property · toolbox ＋ blocks-without-name-decisions ·
dropdown-domain-decisions · executor-inventory
```

課程清單：`cpp-advanced.json:142`。詞彙表：`naming.ts:146` 的 `'step'`。

### ② 「不需要 `SHAPE_CHANGES`」這個判斷成立嗎

🟢 **成立，而且是量出來的**：

```
git grep -l pointer_step HEAD   → 0 個檔
git grep -l iter_step    HEAD   → 0 個檔
```

**沒有任何已發佈的存檔裝得下這塊積木**，所以「純新增、無欄位退場」的推論
不必靠推論——它是一個事實。（`CURRENT_VERSION` 停在 22，不動。）

### ③ 引數個數那條閘的爆炸半徑

它只在 `src/components/cpp/func_call/execute.ts`；Python 那顆是**另一個檔**，沒碰。
函式指標走的是**閘之前**的 `ctx.scope.has(name)` 那一支（`invokeCallable`），不受影響。
預設引數的正向錨點在 7 個測試檔裡，含這一輪新加的那一支。
全套 **7568 綠**——那是這條閘最實在的證據。

### ④ 四顆核心產碼路徑

`cpp:cast`／`pointer_deref`／`address_of`／`bitwise_not` 全改走 `genChild`。
語料的語義不動點 **同一棵 218／走樣 0**，`audit-projection-*` 一族全綠。

### ⑤ 停用測試逐條覆核 — 🎯 **抓到三根死的**

五根新釘子的阻斷者**今天確實都不存在**（`ls src/components/cpp/*distance*` 等全部落空）。

🔴 **而覆核順手抓到三根躺了半年的 `describe.skip`，底下每一件事都早就修好了**：

```
[BLOCKED:cpp:cast]       (char)65 → A · sizeof(a)/sizeof(a[0]) → 5 · 列舉常數 → 1
[BLOCKED:cpp:increment]  int b = ++a; → 22（而且是不動點）
[BLOCKED:cpp:enum]       enum { APPLE = 10 } → 10 20
```

三根**都只有標題、沒有本體**——所以它們**不會在修好的那天變紅**。

> **一個只有標題的停用測試，與一個修好了的缺陷長得一模一樣
> ——而它們的差別只有去跑一次才知道。**

換成五支真的測試。缺陷帳 **61 → 58**（這一刀淨額 56 → 58）。

⚠️ 第一版把那五支寫成**單行帶字面 `\n`** 的樣板字串，於是語料掃描器拿到編不過的一行，
「兩邊都不成」+5——**那是我自己造的雜訊**。改成真的多行之後
「兩邊都跑得動」442 → **447**，那才是真的覆蓋。

> **一份「語料變大了」的讀數，要先問長在哪一欄。**

### ⑥ `abstractComponent: null` 說得通嗎

同族五顆並排量過，**全部是 `null`**：

```
container_iter   null  (core)   無 requires
pointer_step     null  (core)   無 requires
pointer_deref    null  (core)   無 requires
container_erase  null  (core)   無 requires
range_find       null  —        <algorithm>
```

### ⑦ `_why` 寫的是理由還是描述 — 🔴 **抓到一句過期的**

`_properties_why` 原本寫著「引數個數（**1**）」，而階段四之後引數可以是 1 或 2。

> **一個理由如果描述的是「它現在長什麼樣」，
> 那它會在那個樣子變了的那天變成一句錯話——而宣告本身照樣通過。**

已更正，並把翻面那件事寫進去。

### ⑧ i18n — 🔴 **抓到一個過期的標題與一個缺漏**

```
FLOW_TITLE_CPP_POINTER_STEP   「取相鄰位置」→「取移動後的位置」   （能跳 N 格了，「相鄰」過期）
FLOW_SLOT_COUNT               🔴 缺 → 「幾格」／「Count」          （新接點沒有詞）
```

🟢 **沒有雙重真相**：共用的 `src/i18n/*/blocks.json` 只有 `FLOW_*`（流程視圖），
積木標籤住在膠囊自己的 `labels/`。
🟢 **「迭代器」三個字在標籤裡 0 處**（只在 `execute.ts` 的註解引用直譯器檔頭）。

同族並排：
```
container_iter   %1 的 %2（%3）        %2 of %1 (%3)
pointer_step     %1 往 %2 移 %3 格      %1 moved %2 by %3
container_erase  從 %1 移除 %2 到 %3    Remove %2 through %3 from %1
```
⚠️ `count` 是**常態留空**的插槽，空著時讀作「it 往 前 移 ▢ 格」
——與同族 `container_erase` 的「移除 %2 到 ▢」是同一個形狀。
**刺不刺眼由第六關用眼睛判。**

## 步驟六：樣式衝突

`prev`／`next` 的認領者**只有這一顆**（掃 `registerCallBranch` 的十個認領者 ＋
全文 grep）。沒有搶別人的 AST 節點。

## 最終讀數

```
npm test        7568 綠（0 紅）· 631 檔 · it.todo 21 · skipped 16
npx tsc --noEmit  乾淨
孤兒行程          0
語料五個面向      同一棵 218／走樣 0 · 載不進去 0 · 身分 120 缺 0
                  兩邊都跑完 159｜一致 153｜內容真的不同 3｜解譯器出錯 12｜UB 3
課文對照圖        71 張重產
```

---

## 🔴 這一關最貴的東西：**CI 從第 194 刀起就是紅的，而我在紅的上面合併了 196**

```
gh run list --limit 4
  failure  merge: 第 196 刀      Deploy to GitHub Pages   15m
  failure  merge: 第 194–195 刀  Deploy to GitHub Pages   15m
```

`CLAUDE.md` 有一整列在講這件事（「🔴 **push 之後** → `gh run list --limit 3`」），
而那一列**本身就是上一次同樣的事留下來的**：

> CI 從第 182 刀起紅，**連續四次合併**，而每一次我都跑了全套（7000+ 綠）、
> 每一次都沒有看 CI。使用者只說了三個字：「CI失敗」。

**我又犯了一次。**

### 紅在哪：一條我自己寫的、綁在本機那台編譯器上的判準

```
tests/integration/interpreter-matches-compiler.test.ts
  × 🔴 除法②：`0.0/0.0` 是 `nan`
    expected 'nan' to be '-nan'

  本機  Apple clang（libc++）   nan
  CI    GNU g++（libstdc++）    -nan
```

`0.0/0.0` 得到的 NaN，**正負號是未指定的**——所以「印出來的字串」不是一個判準。
這與 2026-09-17／09-18 的標頭那兩次是**同一個形狀**，而那兩次的教訓就寫在同一份文件裡：

> **本機那一台比 CI 那一台寬鬆的地方，量不出來的不是缺陷
> ——是【我的判準有多寬】。**

🟢 **修法**：判準換成 C++ 真的保證的那一件事——**那個值不等於它自己**
（`c != c` 印 `1`，兩台機器都一樣）。而「是不是 `inf`」有定義，除法①③照舊比字串。

### 第二個：課文承諾學生會看到 `NaN`，而機器印 `nan`

`lessons/arduino/13-溫濕度/lesson.json` 的 `check.stdout` 是 `"NaN"`（JavaScript 的拼法），
而第 194 刀把輸出改成 C++ 真正印的 `nan`——**課文沒有跟著改**。
e2e 的 441/1 就是它。

🟢 `lesson.json` 的 `check.stdout` ＋ `lesson.md` 的輸出區塊都改成 `nan`，
並在課文裡說明「印出來是小寫，我們談它的時候寫 `NaN`，那是 C++ 的規定不是打錯字」。

> **一次「輸出的文字表示變了」的改動，會讓每一份【寫死了那段文字】的東西過期
> ——而課文是其中一種，它不在 `npm test` 裡。**

⚠️ `CLAUDE.md` 的觸發表今天只寫「改了**會被 lift 成哪些元件** → e2e」。
**「改了輸出的文字表示」也該觸發 e2e**，而那一列還沒有人加。

## e2e

```
第一次  441 passed · 1 failed（arduino/13-溫濕度）· 25 分鐘
修完後  只重跑那一支 + 它的鄰居：2 passed
```
⚠️ 重跑只跑失敗的那幾支（`playwright.config.ts` 檔頭：「一個用固定秒數等待的測試，
它的正確性綁在機器現在有多閒上」）。

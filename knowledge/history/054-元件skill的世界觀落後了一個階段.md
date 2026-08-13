# 054　元件 skill 的世界觀落後了一個階段——而路徑全都還活著

> 日期：2026-08-13
> 觸發：使用者問「現在 component 相關的 skill 會不會已經過時了？」
> 一句提問，查出四份 skill 指著一個**已經不存在的世界**。

## 轉變

```
old  一顆新元件 ＝ 把五路分別加進五個既有的共用檔
new  一顆新元件 ＝ 新增一個資料夾（膠囊），零編輯
```

那個轉變在 **F 步完成時就發生了**（177 顆全部膠囊化，
`tests/baselines/component-locality.json` 的 `notEncapsulated` 是 `0`），
而**指著它的四份說明書沒有跟著改**。

## ⚠️ 第一個判準沒抓到任何東西——而它看起來很合理

我先問的是「**skill 裡提到的檔案路徑，今天還在不在**」：

```
component-discover       路徑  1 筆，死  0
component-generate       路徑  5 筆，死  0
component-refactor       路徑  5 筆，死  0
…九支全綠，零筆死路徑
```

**全綠，而四份是壞的。** 兩個原因：

1. 那些路徑指的共用檔**大多還在**（`core/generators/`、`core/lifters/`、
   `interpreter/executors/` 都還在，只是**身分不該再寫進去**）
2. ⚠️ 帶佔位符的路徑（`src/languages/{lang}/core/concepts.json`）**我的 regex 抓不到**
   ——而那一條正是死的（`concepts.json` 今天不存在）

> **路徑活著不代表做法還對。
> 一份指著存在檔案的過時說明書，比指著不存在檔案的更難發現。**

## 有效的判準：**對今天的結構特徵提及幾次**

| skill | `src/components/` | `component.json` | form 軸 | 登錄表 |
|---|---|---|---|---|
| `discover` | 1 | 0 | 0 | 0 |
| **`generate`** | **0** | **0** | **0** | **0** |
| `refactor`／`integrate`／`pipeline`／`roundtrip`／`fuzz` | 0 | 0 | 0 | 0 |

⚠️ **而我第一版的特徵表裡有一項是錯的**：我列了「ParamSpec」，
而真實的欄位是 `properties[].kind/values/required`——**那一欄的 0 是誤報**。
記下來是因為它示範了同一件事的另一半：**判準本身也會過時**。

## 四份各自壞在哪

| skill | 症狀 |
|---|---|
| **`generate`** | 教「五路寫進共用檔」；`:312` 叫人更新 `UniversalConcept` 型別，**而那個型別在 `58d64eb` 已刪**，只剩墓碑註解 |
| **`refactor`** | 第一步是 `cat …/concepts.json`，**而那個檔今天不存在**——整條 audit 從空清單開始 |
| **`pipeline`** | ⚠️ **第一棒與第二棒互相矛盾**：`discover:134` 逐字「一顆新元件今天的家是膠囊」，而 `generate` 說寫進 `core/blocks.json`。**而 pipeline 會照跑** |
| **`encapsulate`** | description 逐字「階段 6.5 的 F 步，**要重複 176 次**」——而它已經跑完 177 次 |

`discover` 是唯一被更新過的。**一份被改了、下一份沒有——管線斷在中間，而斷點看不出來。**

## ⚠️ 這是「執行機構」的鏡像，而它是第二次

`concepts/執行機構.md` 記的十個實例全是**機制有了沒人接上**。這一次是反的：

> **機制升級了，而指著它的說明書沒有跟上。**

而 `76a0fa8` 的訊息逐字：「judge 對帳——**一份會被照著做的 skill，指著一個不存在的目錄**」
——**同一個病，五天前才犯過一次**。上次是一個目錄，這次是整個世界觀。

⚠️ **它比一般的知識腐爛嚴重，因為 skill 會被執行**：
`knowie-judge` §5 逐字「**a stale skill acts, a stale doc just misleads**」。

**而這次有一個緩衝**：照著舊 skill 做會產出違反就近性的元件，
`npm test`（40 條護欄）會擋下。**所以代價是浪費一輪，不是靜默錯誤。**
🔴 但那個緩衝是**別人蓋的護欄**，不是 skill 自己的健康度。

## 處置

- **`generate` 重寫**：膠囊形狀、`component.json` 六個必要鍵、`_why` 慣例、
  `skipPaths`、form 軸、lift 的三種形狀、五路完備性。
  ⚠️ **保留 i18n 標籤風格規範與信心等級規則**——那兩塊與元件住哪無關，一直是對的
- **`refactor` 改向**：審計的主力交給 40 條護欄（新增一張對照表），
  只保留護欄不覆蓋的兩項（**i18n 標籤風格**與**信心等級合規**）；
  `concepts.json` → `component.json`；宣告性概念從「寫 noop」改成「宣告 `skipPaths`」
- **`pipeline` 對齊**：關卡從「6 個產出物」改成「膠囊五路 ＋ 身分沒留在共用檔」
- **`encapsulate` 退休**——見下

## `encapsulate` 的退休是一次 dispatch，不是刪除

它的任務結束了（`notEncapsulated: 0`）。

### ⚠️ 而「退休」的具體做法被查證改了一次

第一版的打算是**刪掉資料夾**。grep 之後發現它被 **20 處引用**：
`vision.md:360`、`experience.md:514`／`:1549`、5 份 `history/`、
`specs/104` 的 spec／plan／tasks／slice-record、3 份 `draft/`、
以及 `component-discover:136`。

**其中多數是歷史記載**——`history/043` 的交付欄逐字寫著
「**交付**：`component-encapsulate` skill ＋ 第二顆膠囊」。
刪掉會製造死連結，改掉會竄改歷史。而 knowie 的 invariant 早就寫了：

> 「**mark the old one `superseded` and link to the new — don't delete.**」

→ **實際處置**：
1. frontmatter 加 `status: superseded`、`superseded-by: component-generate`、
   `user-invocable: false`
2. 檔案開頭加退休標頭，說明「下面描述的是從共用檔剪出來的世界，**不是為了照著做**」
3. **移除 `.claude/skills/` 的 symlink**——源檔留著當紀錄，但**不再可調用**

> **退休一份 skill ＝ 斷掉它的可執行性，不是刪掉它的記憶。**

而它學到的東西**分頭找到家**：

| 它教的 | 去了哪 |
|---|---|
| 每條負向前先釘一個正向錨點 | → `component-generate` 步驟六 |
| **資料不需要被登錄，它需要被找到**（glob 直讀 vs 登錄呼叫） | → `component-generate` 步驟四 |
| lift 的三種形狀（分派表一列／純資料／具名策略） | → `component-generate` 步驟四的表 |
| 顯式的空 vs 遺漏的空（`skipPaths` 不寫 noop） | → `generate` 步驟五、`refactor` 修復策略 |
| 搬移不重寫，重寫另開 commit | → `component-generate` 準則 |
| 錄完基準要打開檔案看內容 | → `build-guardrail` 第 10 步**早就有**（它自己說是那條的實例） |
| 工具箱順序重不重要 | → `draft/2026-08-10-工具箱順序重不重要.md`**已有** |

### ⚠️ 而有一條它獨有的，還沒有家

> **一個沒有被宣告的意圖，會在承載它的機制改變時安靜消失。**

出處：`vector_declare` 排在「陣列與列表」第一**不是偶然**，是有人這樣放的，
而那個意圖**只存在於陣列位置裡**——膠囊化把陣列換掉，意圖就沒了。

⚠️ 它與本檔是同一個形狀的兩個實例：**skill 裡的世界觀也是一種沒有被宣告的意圖**
——它只存在於「寫的時候大家都知道」，而機制改了它不會出聲。

→ **提議進 `experience.md`**（待人確認）。

## 🔴 而我新寫的 skill，第一次跑驗收就錯了——兩層

改寫完 `component-generate` 之後，我把自己寫進去的驗收指令跑了一遍
（`build-guardrail` 6.5 的精神：**第一次跑必須是有意義的**）。它兩層都壞：

**第一層：指令根本沒執行。**

```bash
grep -rn "cpp:vector_declare" src/ --include=*.ts --include=*.json | grep -v "src/components/"
# zsh: no matches found: --include=*.ts     ← grep 沒跑
# 輸出：0 筆                                 ← 而它看起來像「乾淨」
```

> **一個失敗的檢查與一個通過的檢查長得一樣**——這正是本專案追了一整年的
> 靜默回退，只是這次發生在一句 shell 指令裡。

**第二層：加了引號真的跑之後，判準本身是錯的。**

```
cpp:vector_declare   8 筆
cpp:if              21 筆      ← 一顆「已經正確膠囊化」的元件
```

那 21 筆全部合法：**凍結的歷史明表**（`migrations/id-migrations.ts:130`
`'lang:if': 'cpp:if'`——一個字都不准改）、**課程清單**（`topics/*.json`，
**本 skill 自己叫人加的**）、**註解裡的提及**。

> ⚠️ **我寫了一條驗收，它會叫人去改「一個字都不准改」的凍結明表。**

→ 三份 skill 的那條 grep 全部改成「**跑護欄**」
（`audit-component-locality`／`audit-locality`），並把三類合法命中列出來。

**教訓**：本檔上半段講的是「別人的文件過時了」，而下半段是
**我在同一輪寫出一份新的壞文件**。

> **一份說明書裡的每一條指令，寫的人都必須自己執行過一次
> ——而「跑出 0」不算執行過。**

## 還開著的

- **skill 的過時能不能機械化偵測？** 今天的答案是「路徑判準不行」（見上）。
  可能的方向：**skill 提到的結構特徵 vs 真實程式碼的結構特徵**——
  而 ⚠️ 那需要先有「今天的結構特徵」這份清單，**而那份清單本身也會過時**。
  在有第二個 scope（`hw`）之前不做——一個樣本推不出判準。
- `README.md` 的「什麼還不該進來」把 `encapsulate` 列為候選（`:22`），
  **而它早就固化了，且第二、三顆都驗過**——本輪一併更正。

## 相關

- [concepts/執行機構](../concepts/執行機構.md)——本檔是它的**鏡像形狀**，已加為實例
- `knowledge/skills/component-generate`／`component-refactor`／`component-pipeline`——本輪重寫
- [history/034](034-F第一顆膠囊-只存在於正式路徑的宣告來源.md)——F 的第一顆，`encapsulate` 的來源
- `tests/baselines/component-locality.json`——`notEncapsulated: 0` 是這次判斷的地面真相

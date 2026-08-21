# skills —— 程序記憶（學到的能力／小腦）

放這個專案**學會的領域 skill**——反覆做的工作蒸餾成可執行的能力（像小腦：靠重複學會、自動化）。

## 什麼進這裡
- 一件領域工作**反覆做**（爬蟲建題庫、批量轉譯…）→ capture 記成「候選 skill」進 `draft/` → 成熟、**人確認** → 固化成這裡的一個 skill。
- skill ＝ 知識，只是使用意圖是「執行」；高 stakes（會 acts、可能靜默作惡）→ 固化比知識定案**更慎**（人確認）。

## 格式與安裝
- 每個 skill = 一個資料夾 + `SKILL.md`（[agentskills.io](https://agentskills.io) 開放標準）。
- 這裡是**真相源**；固化時 **AI 把每個 skill 投影（per-skill symlink，Windows 退化 copy）到目前在場工具的 skill 目錄**（`.claude/skills`、`.agents/skills`…）讓它**立刻可用**——可逆故 AI 直接做（非 CLI）。`judge` re-ensure 這些投影（fresh clone／新工具）。單一源、零漂移。

## 與 knowie 自己的 skill 的差別
- 這裡：**這個專案學到的** domain skill。
- knowie 內建的 init/capture/next/judge/update 是**協議 meta skill**，不住這（從 knowie 安裝）。

## 什麼**還不該**進來

一個操作值不值得固化，看的不是它重複幾次，而是**重做時會不會漏掉上次學到的東西**
（見 [history/033](../history/033-draft退場與改名固化成skill.md)）。

今天沒有排隊中的候選。

## ⚠️ 而 skill 也會**過時**——而且比知識危險

`knowie-judge` §5 逐字：「**a stale skill acts, a stale doc just misleads**」。
2026-08-13 一次對帳查出**四份**指著一個已經不存在的世界
（見 [history/054](../history/054-元件skill的世界觀落後了一個階段.md)）。

> **路徑活著不代表做法還對**——那一次「skill 裡的檔案路徑還在不在」九支全綠，
> 而四份是壞的。有效的判準是**「它對今天的結構特徵提及幾次」**。

退休的做法是 **`status: superseded` ＋ `user-invocable: false` ＋ 移除投影**，
**不是刪除**——引用它的 `history/` 是歷史記載。

（只是想讀懂專案？這層可忽略——它是能力庫，不是 why。）

## 清單

**通用**

- `build-guardrail`——把一條規範變成會變紅的機械檢查（緣起：一天七條護欄、四次翻車）
- `over-justify`——上游的價值判斷：這條規範賺不賺得起位置
- `diagnose-in-browser`——測試綠但使用者看到的是錯的，在瀏覽器裡定位
- `ship-extension`——把擴充的一次改動交到兩個 IDE 手上（這條流程跑了九次才被固化，而三次災難是流程本身的洞造成的）

**加一個語言**（元件管線的**上游**——那條路假設語言已經在了）

- `add-language`——語言套件 ＋ 解析器 ＋ **文法歸屬** ＋ 四個「全域只有一份」的登記處
  （緣起：Python 從 0 到 23 顆走了六支 spec，而那條路的清單當時**只存在於六條 history 裡**。
  最貴的一課：沒有文法歸屬時，一段新語言的程式碼會被**自信地認成舊語言**，而**降級數是 0**）

**元件管線**（`component-pipeline` 串起六個階段）

- `component-discover`——研究函式庫／語言特性，提出概念與命名
- `component-generate`——產一顆**膠囊**：`component.json` ＋ 五路 ＋ 形態 ＋ 標籤 ＋ 測試
- `component-roundtrip`——原始碼 → lift → generate → 執行，比對 stdout
- `component-fuzz`——雙代理資訊隔離的模糊測試
- `component-integrate`——最終關卡：全部驗證跑完才算數
- `verify-in-browser`——🔴 **第六階段**（2026-08-21 接進管線）：在那之前整條管線
  「瀏覽器」出現 **0 次**，出口是「測試全綠」——而那天使用者一口氣回報五個缺陷
- `component-refactor`——審計與修復既有膠囊（⚠️ 審計主力是 40 條護欄，它讀報表）
- `component-rename`——大規模改元件身分／參數名，上千處引用 ＋ **必附存檔遷移**（緣起：同一支工具重建八次，重建時漏欄位；見 [history/033](../history/033-draft退場與改名固化成skill.md)）

**已退休**

- ~~`component-encapsulate`~~——把元件從共用檔搬進膠囊。**177 顆全部搬完**
  （`notEncapsulated: 0`），檔案保留為紀錄，投影已移除。接手的是 `component-generate`

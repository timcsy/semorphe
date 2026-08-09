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

⏳ **候選：`component-encapsulate`**（搬一顆元件進膠囊）——九個步驟已寫在
`specs/104-component-vertical-slice/slice-record.md`，每一步都指得回真的發生過的
一次操作或卡點。**等第二顆驗證過再固化**：目前只有一個樣本，而那個樣本是我挑的
（五路齊全 ＋ 已在模組資料夾），不代表其餘 176 顆。
見 [history/034](../history/034-F第一顆膠囊-只存在於正式路徑的宣告來源.md)。

（只是想讀懂專案？這層可忽略——它是能力庫，不是 why。）

- `build-guardrail`——把一條規範變成會變紅的機械檢查（緣起：一天七條護欄、四次翻車）
- `component-rename`——大規模改元件身分／參數名，上千處引用 ＋ 必附存檔遷移（緣起：同一支工具重建八次，重建時漏欄位；固化的理由見 [history/033](../history/033-draft退場與改名固化成skill.md)）
- `diagnose-in-browser`——測試綠但使用者看到的是錯的，在瀏覽器裡定位

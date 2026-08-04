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

（只是想讀懂專案？這層可忽略——它是能力庫，不是 why。）

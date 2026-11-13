# 404：進行中檔與開場指示搬出 draft，成為「工作空間」（445）

> 決定：建 `knowledge/workspace/`（中文「工作空間」），`local/` 不進版控；knowie 改概念檔的描述、`draft/` 名字不動；窗口筆記拆兩半——接續狀態進 `workspace/進行中.md`（版控、只寫狀態），流水帳進 `workspace/local/`，教訓蒸餾成 episodes；已推上 main 的筆記整份移除、只留規則、歷史不改寫｜使用者 2026-11-13 23:1x 在 cos-mos-main 的選單三題都選 Recommended，經 cos-mos-main → semorphe-main → 工人轉達｜取代：11-13 22:4x「新筆記寫進 `.git/window-notes/`」。

**之前**：`draft/2026-11-05-進行中.md` 與 `draft/2026-11-05-窗口的開場指示.md` 住在 `draft/`。但 `draft/` 的意思是「還沒定、預設會衰減的想法」，這兩份卻是**每天都在改的現況**，從來不會衰減。開場指示的後半是窗口的流水帳（11-05～11-13，約 660 行），而 repo 是公開的。

**之後**：
- `knowledge/workspace/` 放 README（名字出處、讀的順序、`local/` 的規則）、`進行中.md`、`開場指示.md`（只剩規則）、`聯絡本.md`（只放角色與職責，不放 session 位址）。
- `.gitignore` 擋 `knowledge/workspace/local/`；流水帳移到那裡。
- `tools/knowie-scan.ts` 不走進 `workspace/local/`：那裡本機有、CI 沒有，掃到它會讓同一支護欄在兩台機器上讀數不同。
- 公開的流水帳從 main 移除，**git 歷史不改寫**——舊提交裡仍看得到，這是使用者選的（改寫歷史是「永久毀掉歷史」，屬於使用者保留的那一類）。

**為什麼**：接手（壓縮、換 session、換電腦）時真正要讀的只有「做到哪、等誰、已轉過、待決幾件」；這些放在版控裡才會跟著 repo 走。流水帳對接手沒用、對公開 repo 還有害。三個專案（semorphe、Cella、cos-mos）照同一份搬家步驟做，步驟在 knowie 的提案草稿「工作記憶放哪與接手協定」。

**沒有併回的東西**：流水帳最後一筆是 11-13 08:50，那時的接續狀態早已寫進進行中檔，所以沒有要併回的行。

# 332 · 判決的第六類 invalid、cos-mos 階段 3 的成功標準、課程當設計判準

> 日期：2026-11-03
> 轉變：使用者在 cos-mos 主持下定了三題，原話與完整紀錄在 cos-mos 的 `knowledge/history/009`；這裡只記改到 semorphe 的部分。
> 前情：[330](330-三方會議第二輪UI協定判決類別與第一版.md)（判決帶類別；`class` 後改名 `category`）、[331](331-semorphe往面板與編輯器收學生入口分階段移到cos-mos.md)（分階段轉型）。

## 改到 semorphe 的決定

| 題 | 之前 | 使用者選擇 | 對 semorphe 的意思 |
|---|---|---|---|
| 判決的第六類 `invalid` | 會議裡未定；Cella 先照獨立一類實作 | 「獨立成第六類」 | 程式資料的格式不合法＝**系統之間的問題**（semorphe 送給 Cella 的格式有誤），不算學生寫錯。`category` 共六個值，認不得的值要明說（`CELLA_UNCLASSIFIED` 已在） |
| cos-mos 階段 3（瀏覽器宿主的執行）的成功標準 | 草案 | 「照草案定案」 | 學生在 semorphe 按「執行」→ cos-mos 的瀏覽器宿主載入、驗證、執行，照三態政策：Accept 直接跑；Unknown 在沙盒跑、標「沒有保證」附原因；Reject 不跑、指出原因。畫面標 category、核對 assumes、量首次載入時間（只量不設門檻）。這是分階段轉型的**第 2 步**；開工看 cos-mos 2b 與 Cella 元件版的進度，屆時對介面 |
| 課程 | 第 12 題已定「課程跟著領域應用、semorphe 保留通用教學機制」 | 「先當課程套件的設計判準」 | 課程要宣告前置概念、每個單元引入幾個新概念；cos-mos 檢查與呈現，先不做自動安排進度。semorphe 這邊沒有立即的工作 |

## semorphe 做了什麼

- 第 244 刀：`invalid` 的問題一律用新規則 `CELLA_INVALID` 呈現——「這不是你的錯：semorphe 送給判斷功能的程式格式有誤」，嚴重度 info（不是紅的），不看 kind 的文案（那些是說給學生的程式聽的）。

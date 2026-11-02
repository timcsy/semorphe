# 331 · semorphe 往「面板與編輯器」收，學生入口分階段移到 cos-mos

> 日期：2026-11-02
> 轉變：使用者提議「或許可以跟semorphe那邊提議，未來semorphe只負責面板、編輯器或是介面的部分，真正給學生用的會由cos-mos啟動」，
> 經 cos-mos 主持人轉來；semorphe 整理事實、四個選項與推薦交回，使用者選第 19 題「B 分階段轉型」。
> 完整紀錄在 cos-mos 的 `knowledge/history/004`。前兩輪見 [329](329-三方會議第一輪定了semorphe的邊界.md)、[330](330-三方會議第二輪UI協定判決類別與第一版.md)。

## 之前 → 之後

| | 之前 | 之後 |
|---|---|---|
| semorphe 的角色 | 一個完整的應用：semorphe.com、VSCode 擴充、Arduino IDE 三個學生入口，共用 `src/ui/app.ts` | 面板與編輯器：`@semorphe/core` ＋ `@semorphe/panel-*`；應用殼（⑤）未來歸 cos-mos |
| 盟約「各自可單獨使用」對 semorphe 的意思 | semorphe.com 本身 | 開發者直接引用 semorphe 的套件；semorphe.com 留成 playground，也是 semorphe 自己的 e2e 宿主 |
| VSCode／Arduino IDE | semorphe 的擴充 | 第 3 步交給 cos-mos 的宿主適配 |

## 三步（使用者採用的就是 semorphe 提的順序）

1. semorphe 把面板拆成可獨立掛載的視圖套件；semorphe.com 與擴充照舊 → vision〈階段 8〉新增一項
2. cos-mos 階段 3：semorphe 殼裡的「執行」改走 cos-mos 的瀏覽器宿主
3. cos-mos 應用殼可用、課堂上跑過一輪後：semorphe.com 轉址到 cos-mos，原址留成 playground；擴充交給 cos-mos。**不在學期中換入口**

## 為什麼選分階段

- 全面轉型會讓學生在 cos-mos 第一版出來前沒有入口；只交執行則殼留在 semorphe，跟「semorphe 是 UI 角色」有落差，之後還要再談一次
- 第 1 步不管最後怎麼走都用得上：vision〈出貨：五層〉本來就有「④ 視圖套件」，這次等於確認 ⑤ 應用的家在 cos-mos
- semorphe 列的風險（舊網址轉址、`semorphe-state` 自動存檔綁網域、首屏與暖機、e2e 宿主）進了 cos-mos 階段 4 的成功標準

## 排程（semorphe 自己定，照推薦）

第 1 步排在〈重構〉階段 6 之後：6c 還在把執行切到 Cella，而第 2 步也要等 Cella 切完才有意義；cos-mos 階段 4 開始之前要完成。

## 還沒定（由主持人到時再問）

- 課程導覽與診斷呈現：跟著殼走，還是做成一種面板
- 第 3 步的時間點、擴充 ID 要不要沿用

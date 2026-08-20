# spec 163：兩份定義逐項比對——先證明一樣，才准刪

**路線圖位置**：階段 7 第 0 刀餘下的 32 筆 ｜ **前一步**：spec 162

## 為什麼先做比對，不直接刪

`CLAUDE.md` 逐字：

> **雙重真相來源**：`universal.json` blockDef 和 `app.ts` 動態註冊定義相同積木的
> input names。修改任一方時**必須同步另一方**。
> **PatternRenderer fallback**：若 JSON 名稱錯誤，
> **只在 Block Style 切換（serialize→deserialize）時才暴露**。

而今天的真相是：

```
命令式那份【沒有守衛】   Blockly.Blocks['x'] = {...}         直接賦值、後跑 → 使用者看到它
宣告式那份【有守衛】     if (Blockly.Blocks[type]) continue   先跑 → 被蓋掉、躺著
```

**所以「刪掉命令式」＝「換成宣告式」，那是一次行為改動，不是清理。**

## 交付：真的建兩次積木，逐項比

新增 `tests/integration/audit-block-def-parity.test.ts`
——**第一支真的跑 `BlockRegistrar.registerAll()` 的測試**
（在此之前所有 `block-registrar` 的測試都只掃檔案文字）。

比對項：插槽名 · 欄位文字 · output · previous/next · 顏色。

```
🟢 一模一樣（可刪）    4 顆   cpp_array_at cpp_continue cpp_endl cpp_literal_string
🔴 有差異（不准刪）   19 顆   每一筆都印出【差在哪】
```

## ⚠️ 兩個把我自己騙過去的地方

**① 第一版報「207 顆一模一樣」——灌水的。**
比對跑遍全部 229 顆，而其中 200 多顆**根本不在 `block-registrar` 裡**：
`Blockly.Blocks[t]` 就是宣告式自己建的那顆，**等於拿它跟自己比**。

> **一個把「沒有對照組」也算進「一致」的比對，數字會漂亮而且沒有意義。**

**② 第一版報 8 顆「宣告不完整」——測試環境少了一步。**
`jsonInit` 要把 `%{BKY_X}` 展開成訊息文字，而**訊息沒載入時它展不開**，
於是「訊息裡沒有 `%1`」。載入膠囊標籤之後，229 / 243 顆的宣告都建得起來。

## 那 19 筆落差的性質（逐筆判，不准刷數字）

```
cpp_break        statement true/false vs true/true   ← 🔴 **命令式才是對的**：break 之後接東西是不可達的程式碼
cpp_comment      「註解：」vs「備註：」                ← 標籤字不同
cpp_func_call    output null vs Expression           ← 命令式是語句版、宣告是運算式版（兩顆積木被比在一起）
cpp_func_def     插槽 4 個 vs 1 個                    ← 形狀差很多，宣告表達不完
```

🔴 **不准用「把宣告改成跟命令式一樣」來還數字**——那是在假設命令式是對的，
而每一筆都要**分開判**——`cpp_break` 那筆**宣告多了 `nextStatement`**（`break` 之後不該接東西），
是**宣告錯了**。

## 驗收

- [x] 比對護欄存在且**真的建積木**（不是掃檔案文字）
- [x] 母體收窄到真的有命令式定義的那群（錨點擋灌水）
- [x] 落差 19 進基線，**只准下降**
- [x] 兩針注射：改一顆宣告的顏色 → 紅；不收窄母體 → 紅

---

# 第二段：刪掉那四顆

比對護欄說「一模一樣」的四顆，命令式定義刪除：
`cpp_array_at`／`cpp_continue`／`cpp_endl`／`cpp_literal_string`。

| | 之前 | 之後 |
|---|---|---|
| 中立性第二維 | 32 | 🎯 **28** |
| 雙重真相 | 33 | 🎯 **29** |
| 比對報表的「一模一樣」 | 4 | 0（刪掉了，不再有兩份） |
| 落差 | 19 | 19（**一筆都沒動**） |

🪦 順帶：`setLanguageInputNames` 的 `arrayAccess` 欄位移除——**它的唯一消費者退場了**。
> **一個沒有消費者的注入欄位，會讓組裝點以為它還要提供那份資料**——而那份資料從此沒有人驗。

## 瀏覽器實測（因為沒有測試在看標籤）

```
cpp_array_at        插槽 INDEX ｜ 欄位「陣列, a, 的第 [, ] 格」
cpp_continue        欄位「跳至下一次」
cpp_endl            欄位「換行」
cpp_literal_string  欄位「", hi, "」
Block Style 切換     積木集合與程式碼【前後一模一樣】
```

⚠️ 最後一項是 `CLAUDE.md` 指名的地方：「若 JSON 名稱錯誤，
**只在 Block Style 切換（serialize→deserialize）時才暴露**」。

## 🔴 而我在這一段做過一次錯誤的歸因

第一次瀏覽器實測看到**整段降級成 `cpp_raw_code`**，我做了「對照實驗」（`git stash`）
並得出「是我造成的迴歸」——**而那是錯的**。

真相：那次的目標停在 **Python**，用 Python 的文法解析 C++ 當然全降級。

> **一個變因不只一個的對照實驗，證明不了任何事**
> ——我同時換了程式碼（stash）和頁面狀態（reload 重讀 localStorage）。

🟢 正確的做法是**先把環境釘死**（明確切到 C++ 目標）再比。

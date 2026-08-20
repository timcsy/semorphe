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
cpp_break        statement true/false vs true/true   ← 🔴 命令式【少了 nextStatement】，宣告才是對的
cpp_comment      「註解：」vs「備註：」                ← 標籤字不同
cpp_func_call    output null vs Expression           ← 命令式是語句版、宣告是運算式版（兩顆積木被比在一起）
cpp_func_def     插槽 4 個 vs 1 個                    ← 形狀差很多，宣告表達不完
```

🔴 **不准用「把宣告改成跟命令式一樣」來還數字**——那是在假設命令式是對的，
而 `cpp_break` 那筆**命令式才是錯的**。

## 驗收

- [x] 比對護欄存在且**真的建積木**（不是掃檔案文字）
- [x] 母體收窄到真的有命令式定義的那群（錨點擋灌水）
- [x] 落差 19 進基線，**只准下降**
- [x] 兩針注射：改一顆宣告的顏色 → 紅；不收窄母體 → 紅

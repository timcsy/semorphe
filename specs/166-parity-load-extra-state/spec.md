# spec 166：堵住比對護欄的 `loadExtraState` 盲點

**路線圖位置**：階段 7 第 0 刀餘下的 20 筆 ｜ **前一步**：spec 165

## 🔴 這一刀的理由是一次**差點出貨的迴歸**

spec 165 裡 `cpp_raw_code` 的比對報告「**一模一樣，可刪**」——而它**不能刪**：
`loadExtraState` 會依 `degradationCause` 換顏色與 tooltip。

⚠️ **而我發現它的方式是 `tsc` 抱怨 `DEGRADATION_VISUALS` 變成未用的 import**
——**不是護欄告訴我的**。

> **一次靠運氣攔下的迴歸，下一次不會有那個運氣。**

而同一個盲點**現在就有第二顆**：`cpp_var_assign_compound` 的 `hasIndex_`
會在載入時**加／移除一個插槽**，而比對報表說它只差一個下拉。

## 動手前的量測

```
命令式裡有 loadExtraState 的      19 顆
宣告表達得出 extraState 的        15 顆（dynamicRules／extraStateFlags／childrenAsField）
🔴 表達不出的                     4 顆：var_declare · if · raw_code · doc_comment
```

⚠️ **而這個量測本身就不準**：`cpp_var_assign_compound` 被判成「表達得出」，
因為它**有** `dynamicRules`——而它的 extraState 是 `{hasIndex}`，與 `dynamicRules` 無關。

> **一個「有沒有宣告某種 extraState」的檢查，答不出「宣告的是不是【同一個】extraState」。**

## 做法：比**鍵**，不比「有沒有」

- 從命令式的 `saveExtraState.toString()` 取出它**真的會吐出的鍵**（執行期的函式，不是掃檔案）
- 從宣告的 `renderMapping` 算出它**表達得出的鍵**（`countSource` ＋ `extraStateFlags`）
- **命令式的鍵有一個不在宣告能表達的集合裡 → 那是一筆落差**

## 明確排除

- **修那 4 顆的宣告**——那需要一個「依 extraState 換視覺」的宣告機制，**它還沒被設計**。
  這一刀只讓落差**看得見**。
- **`prefixFields`** ——⚠️ **順序不能反**：現在做，等於在一個會說謊的護欄上再刪 6 顆。

## 驗收

- [ ] 🔴 `cpp_raw_code` 從「可刪」變成「有差異」——**護欄自己抓到它**
- [ ] 🔴 `cpp_var_assign_compound` 的 `hasIndex` 落差被印出來
- [ ] 落差基線**顯式上調**並註明「這不是惡化，是護欄第一次看得見」
- [ ] 順手修 `cpp_doc_comment` 的英文預設值 `description`（與 `loop_count` 同類的 i18n 缺陷）
- [ ] 4793 綠、e2e 綠

---

# 結果

| | 之前 | 之後 |
|---|---|---|
| 比對的維度 | 4（插槽／欄位／output／statement／顏色） | **5（＋載入時的狀態）** |
| `cpp_raw_code` | 🔴 被判「一模一樣，可刪」 | 🟢 **「載入時的狀態 nodeType,unresolved —— 宣告表達不出」** |
| 中立性第二維 | 20 | **19** |
| 雙重真相 | 20 | **19** |
| 落差 | 10 | 10（⚠️ **一顆退場、一顆現形，剛好抵銷**） |

## 🔴 而這一刀的第一版**沒有讓任何東西變紅**

注射實測：拿掉宣告的 `extraStateFlags`、甚至**整條關掉新那一維**，
`differ` 的棘輪**都是綠的**——因為那兩個注射讓數字**下降**，而棘輪只擋上升。

> **一條只擋「變差」的棘輪，擋不住「量得更少」。**

🟢 所以加了一支**指名**的斷言：「載入時的狀態」這一維今天抓到誰
（`cpp_doc_comment`／`cpp_if`／`cpp_if_else`／`cpp_raw_code`）。
任何一顆從清單消失，**要嘛是宣告補上了（改清單），要嘛是這一維瞎了（護欄壞了）
——而兩者長得一樣，所以要指名**。

四針注射：
```
① 拿掉宣告的 extraStateFlags   → 🟢 紅（那顆會進清單）
② 關掉 diffs 那一行            → 綠（新斷言走自己的路徑，兩條互相獨立）
③ 取鍵器變瞎                   → 🟢 紅
④ 假裝宣告表達得出（刷數字）    → 🟢 紅  ← 最重要的那針
```

## 兩個我猜錯、而護欄糾正的

- **猜**：`cpp_var_assign_compound` 像 `cpp_raw_code` 一樣有「載入時才長出來的東西」。
  **錯**——它的 `hasIndex` 由 `extraStateFlags` 表達得出，**護欄正確地沒報它**。
  > **一個猜測被護欄否證，比被護欄證實更有價值。**
- **猜**：表達不出的是 `var_declare`／`if`／`raw_code`／`doc_comment`。
  **錯**——實際是 `doc_comment`／`if`／`if_else`／`raw_code`。**我先前的量測用的是不同的判準。**

## 順手

- `cpp_doc_comment` 的英文預設值 `description` → 「說明」（**與 `loop_count` 同類的第二次**）
- `cpp_var_assign_compound` 退場（只差活下拉）
- 🪦 `setLanguageInputNames` 又移除一個孤兒欄位（`compoundAssign`）
- 🔴 修一個**錨點自己會說謊**的問題：它寫 `> 10`，而清到剩 10 顆的那天它紅了，
  訊息還說「registerAll 沒跑起來」。
  > **一個錨在「今天有多少」的錨點，會在事情變好的那天說謊。**

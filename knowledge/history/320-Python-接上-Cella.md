# 320 · Python 接上 Cella——翻譯照 Cella 寫好的對照表，而第一次照產品的規則判，就判出兩個舊缺陷

> 日期：2026-11-01（spec 195）
> 轉變：使用者定「階段 6 等 Python 也有 Cella 再一起切」（history 317）。`@cella-lang/python` 已經有判決、型別查詢、除錯（draft 五之九）；
> 這一刀做我們這側：Python 的 formalize 與提供者的 Python 分支。

## 翻譯不是我們發明的

Cella 寫好一張「semorphe 的 Python 元件 → python.ast」對照表（99 顆，模板＋18 種具名轉換），參考實作被 140 個範例驗過
——每個範例的預期樹是我們 `generate.ts` 產生的 Python 經 CPython `ast` 轉出的，**兩條獨立的路**。

做法：模板同步進**每顆元件自己的膠囊**（`formalize.json`；第 389 刀：formalize 是元件自己的動詞，不是一張中央大表），
展開器移植成 TS。C 家族是每顆手寫 `formalize.ts`——Python 改成宣告式，因為那張表已經被驗過，手寫 99 份只會與它漂移。

## 讀數

```
Cella 的範例           140 / 140 對上
Python 課文解答         翻得出 47 / 48；47 筆 accept；輸出（產品的 compareOutput）全部一致
剩的 1 份               對照表的缺口：math_max 用 $slots 收引數，`max(xs, key=…)` 的 key= 進不去——回報 cella
會話契約（Python）      JS 直譯器與 Cella 都過
```

## 第一次照產品的規則判，判出的兩個舊缺陷

1. **「排回去」過不了**（python-beginner 08、12）：Parsons 題打散的是 `solutions/rebuild.py`，而它的 `check.stdout` 少了後半段輸出
   ——學生排對了，產品逐行比，**判他沒過**。e2e 一直綠，因為它用「包含」比。
2. **Python 的 `print` 上設中斷點不會停**（JS 直譯器）：停點由元件的 `debug_step` 標註決定，Python 只有 14 顆標了，`print` 不在裡面。
   C++ 那一側的契約從 5b 起就在跑；**Python 從來沒有人用契約量過**。

> 兩個都是「一條路有人量、隔壁那條沒人量」：e2e 量了輸出「有沒有出現」而沒量「是不是剛好」；契約量了 C++ 而沒量 Python。

## 刻意留著的

- Python 編進同一個判決模組：第一次載入變久（之後改成用到才編）。
- 參數預設值只認字面量與名字（對照表的備註本來就建議改成運算式的槽）。

# 模糊測試報告：cpp／自訂 operator<<／2026-11-10

- 語言：C++；隔離出題 4 支（hard），編譯器標準答案 4 支。
- 來回：4 支產回去都編得過、輸出相同（修完之後）。
- 判決：fuzz_2 Cella 判 unknown（類別有接 string 的建構子 ＋ 自訂 operator<<，候選跨命名空間，已回報，knownCellaGap 釘住）；fuzz_1（類別內帶本體的 static）、fuzz_3（帶本體的 friend、ostringstream）、fuzz_4（ostringstream、左端是函式呼叫）照實 untranslated。

## 發現並修復

| # | 缺陷 | 類別 | 修法 |
|---|---|---|---|
| 1 | 回傳參照的類別內運算子落到一般函式，尾端 const 掉了，兩個多載編不過 | COMPILE_FAIL | 運算子那條路剝一層宣告子；放不下的（多參數、noexcept）不收，照實降級 |
| 2 | 類別成員函式參數沒登記型別，os << x 是位移，合法程式判 reject | 誤判 | 成員函式本體前登記參數 |
| 3 | 參照欄位名字存成 `& out`，合法程式判 reject | 誤判 | 參照符號歸型別 |
| 4 | `Logger log(cout);` 被當成函式原型 | 誤判 | cout／cerr／clog 不是型別 |

## 覆蓋缺口

帶本體的 friend、類別內帶本體的 static、ostringstream、`P{1}` 暫存值、左端是函式呼叫的串流寫入（Cella 的 sOut 不執行該呼叫，已回報）。

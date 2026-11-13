# 概念探索：C++（Arduino）— 中斷旗標與中斷函式

## 摘要
- 語言：C++（Arduino 板子目標）
- 目標：`volatile` 變數宣告、ESP32／ESP8266 的 `IRAM_ATTR` 函式屬性
- 發現概念：2（一顆新元件、一個既有元件的新屬性＋形態）
- 來源：五份 Arduino 探針語料——`volatile` 3 處（`volatile unsigned long press`、`volatile unsigned long last`、`volatile` 旗標）、`IRAM_ATTR` 1 處；434 讓兩者誠實降級成原文
- Cella：11-13 與 cella 談定——volatile 判決當作沒有（單執行緒、中斷只在等待點跑），日後送 `tVolatile` 包住型別，之前送出時去掉；IRAM_ATTR 只決定函式放哪段記憶體，送出時去掉

## 概念目錄

### 資料（進階：中斷）

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|
| `cpp:var_declare_volatile` | `volatile T x = v;`、`volatile T x;` | 宣告一個會被中斷改動的變數：每次讀寫都真的去記憶體拿 | 型別、名字、初值 | C/C++ 特定（abstractComponent `cpp:var_declare`） | raw_code（今天 434 的整句降級） | 照 `cpp:var_declare_static` 的膠囊；只收單一宣告子；`volatile const` 等組合照舊降級 |
| `cpp:func_def` 的 `attribute` 屬性 ＋ 形態 `cpp_func_def_iram` | `void IRAM_ATTR f() {…}`、`ICACHE_RAM_ATTR` | 這個函式放進 IRAM，中斷發生時才叫得動它 | 同 func_def（回傳型別、名字、參數、本體） | Arduino（ESP32／ESP8266 核心的巨集） | raw_code（434） | 形態軸 = 屬性 `attribute`（先例：`var_declare_const` 的 `init_style`）；預設形態不動；extraState 與一般 func_def 相同 |

## 決策：IRAM_ATTR 為什麼不是新元件
- 它不改變函式是什麼（P2：身分不變、形態不同）——一個帶屬性的函式定義仍然是函式定義：呼叫它、傳它給 `attachInterrupt` 都照函式。做成新身分，呼叫端的參照解析、formalize 的函式表都要多認一個身分。
- 做成屬性：語義樹記得它（來回一字不差），formalize 照 func_def 送、略過屬性（cella 同意）；積木靠形態軸換成「定義中斷函式」那顆，學生看得到它的意思。
- 被否決：在每顆 func_def 積木加一格下拉——99% 的函式不需要它（P4 漸進揭露）。

## 建議實作順序
1. `cpp:var_declare_volatile`（獨立，最小）
2. `func_def.attribute` ＋ `cpp_func_def_iram` 形態

## 邊界案例
- `volatile` 在型別前或後（`bool volatile f`）、與 `static`／`const` 並用 → 照舊降級
- 多宣告子 `volatile int a = 0, b = 0;` → 照舊降級（static 那顆也只收一個）
- 解析器對 `IRAM_ATTR` 補了 MISSING 的 `::`（434 的病歷）——lift 要從那個形狀認出屬性與真正的名字
- 板子外（純 C++）：`IRAM_ATTR` 不是標準 C++，formalize 照實翻不出

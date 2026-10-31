# 概念探索：C++ — `time(0)`（`<ctime>` 的目前時間）

## 摘要

- 語言：C++
- 目標：`std::time`（`<ctime>`），課文裡的用法只有 `time(0)`——當亂數種子
- 發現概念總數：1（語言特定 1、通用 0）
- 歸屬：`cpp-beginner`（與 `cpp:random_seed`／`cpp:random_next` 同一處）；`c-beginner` 也該有（C 的 `<time.h>`，同一個函式）
- 來由：使用者 2026-10-31 照推薦定（設計 draft 五之六）——今天 `time(0)` 落到通用的函式呼叫，
  相依解析只認元件身分，所以 `<ctime>` 從來補不到；產出的程式碼靠遞移 include 才編得過

## 研究

`std::time_t time(std::time_t* arg);`（cppreference，`<ctime>`；C 是 `<time.h>`）
- 回傳目前的日曆時間，通常是從 1970-01-01 起的秒數；`arg` 不是空指標時也寫進 `*arg`。
- 教學裡幾乎只出現 `time(0)`／`time(NULL)`／`time(nullptr)`，而且幾乎只在 `srand(...)` 裡當種子。
- 初學者常見錯誤：把 `srand(time(0))` 放進迴圈（同一秒內種子相同，每次抽到一樣的數）——課文第 12 課的除錯表已列。

## 概念目錄

### cpp-beginner（與亂數同處）

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| `cpp:time` | `time(0)`（亦認 `time(NULL)`／`time(nullptr)`） | 現在的時間（從 1970 年算起的秒數） | 0 | lang-library | 特定 | `func_call` | 運算式；`requires: ["<ctime>"]`；`time(&t)` 不收（降級到 `func_call`） |

**命名**：`time` 列為**單字名**，與 `millis`／`micros` 同一類——「讀時鐘」沒有作用對象可拆成主體＋操作
（`naming.ts` 的 `ATOMIC_NAMES` 對 `millis` 的理由逐字是「沒有主體可拆」）。
⚠️ 不用 `time_now`：那要同時新增主體 `time` 與操作 `now` 兩個詞，而這兩個詞都只服務這一顆。

**引數的寫法**：`time(0)`、`time(NULL)`、`time(nullptr)` 語義相同。要不要保留學生寫的那一種（屬性）留給產生階段決定；
預設的推薦是**保留**——產出不得與學生寫的不同（第 394 刀 char 陣列大括號那一次的教訓）。

## 五路

| 路 | 做法 |
|---|---|
| code.lift | `call_expression`，函式名 `time`，一個引數且是 `0`／`NULL`／`nullptr` |
| code.render | `time(0)`（或保留的原寫法） |
| blocks.render／lift | 一塊無輸入的運算式積木「現在的時間（秒）」 |
| execute | 回傳目前秒數（`Math.floor(Date.now() / 1000)`）——每次執行不同，與真實程式一致 |
| formalize | `eCall "time"`，引數照原寫法（`eNum 0`／`eNull`／`eNullptr`）；Cella 沒有模型時回 unknown／unsupported（cella 2026-10-31 的規則） |

## 依賴關係

- 依賴：無（運算式積木）
- 被誰用：`cpp:random_seed` 的 `seed` 槽（課文 12 的 `srand(time(0))`）

## 建議實作順序

1. `cpp:time`（唯一一顆）

## 跨語言對應

- C：同一個函式（`<time.h>`）；`c-beginner` topic 要一併收，補丁器在 C 方言下照 `toCHeader` 換成 `<time.h>`（`<ctime>` → `<time.h>` 已在 `header-aliases.ts` 的對照裡嗎？產生時查證）
- Python：`time.time()`（浮點秒）——語義不同（浮點、要 import），不併成通用概念
- Arduino：`millis()` 是開機至今的毫秒，不是日曆時間——不同概念

## 需注意的邊界案例

- 🔴 **課文第 12 課拿 `time(0)` 當「呼叫函式」的第一個例子**（`lesson.md:143`：「`time(0)` 這種『名字後面接一對括號』的寫法叫**呼叫函式**」），
  而課文宣告的元件裡有 `cpp:func_call`。有了專屬積木之後，畫面上 `time(0)` 是「現在的時間」這塊，不再是通用的呼叫積木——
  課文的那一句說的是**程式碼的形狀**，仍然成立；但課文的 `components` 要加 `cpp:time`，`cpp:func_call` 還有沒有別處用到要查（整合階段）。
- `time(&t)`（引數是位址）：不收，降級到 `func_call`。
- 補丁器：加了 `requires` 之後，`srand(time(0))` 的產出會多一行 `#include <ctime>`——**輸出的文字表示變了**，要跑 e2e 與課文對照圖的檢查。

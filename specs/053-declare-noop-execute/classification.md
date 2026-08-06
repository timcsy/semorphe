# 分類結果（T003）

**依據**：`tests/integration/noop-classification.test.ts` 的實測，不是意見。
**日期**：2026-08-06

---

## 一句話

核心層那份清單有 34 個條目。**只有 12 個配得上宣告。**

| 判定 | 數量 | 能不能拿到 `skipPaths` |
|---|---|---|
| ✅ 真的不執行（`declarative`） | 10 | **可以** |
| ✅ 由父概念消費（`consumed-by-parent`） | 2 | **可以** |
| 🔴 還沒實作（跑起來是錯的） | 14 → **10**（US1b 修好 4 個） | **不可以** |
| ⬜ 判不出來（概念沒出現在語義樹裡） | 5 | **不可以** |
| ⚰️ 死條目（概念註冊表中不存在） | 3 | 直接刪 |

**天真的做法會宣告 31 個，實測只有 12 個站得住。** spec 的自我否證提示（「若全部可宣告，那是判準太鬆」）在這裡沒有觸發——這是好消息。

---

## ✅ 可宣告：真的不執行（`declarative`）10 個

程式加上這個概念之後，輸出與沒有它時相同——它在執行期沒有可觀察效果。

| 概念 | 最小程式 | 期望／實得 |
|---|---|---|
| `comment` | `// 註解` + `cout << 1` | 1／1 |
| `block_comment` | `/* 區塊 */` + `cout << 1` | 1／1 |
| `doc_comment` | `/** doc */` + `cout << 1` | 1／1 |
| `cpp_include` | `#include <iostream>` | 1／1 |
| `cpp_using_namespace` | `using namespace std;` | 1／1 |
| `cpp_define` | `#define N 5` | 1／1 |
| `cpp_stringstream_declare` | `stringstream ss;` | 1／1 |
| `cpp_ifstream_declare` | `ifstream f;` | 1／1 |
| `cpp_ofstream_declare` | `ofstream f;` | 1／1 |
| `cpp_pair_declare` | `pair<int,int> p;` | 1／1 |

> 三個檔案流／pair 的宣告目前**只是不執行，不是不需要**——它們宣告了變數卻沒有建立任何執行期物件。**現況下沒有任何程式能觀察到差別**（沒有對應的讀寫概念），所以判為 `declarative` 成立。**若日後加入檔案讀寫，這三個必須重新分類。** 已記在下方「複查觸發條件」。

## ✅ 可宣告：由父概念消費（`consumed-by-parent`）2 個

有子槽，但子槽由父概念的執行器負責走訪。

| 概念 | 誰消費它 | 最小程式 | 期望／實得 |
|---|---|---|---|
| `cpp_case` | `cpp_switch`（`control-flow.ts:129`） | `switch(x){ case 2: cout << 22; }` | 22／22 |
| `cpp_default` | 同上 | `switch(x){ default: cout << 99; }` | 99／99 |

> **靜態掃描把這兩個判成「還沒實作」——判反了。** 見 research F2b。

---

## 🔴 不可宣告：還沒實作（14 個）

概念出現在語義樹裡，跑起來**結果是錯的**。做成空操作讓它看起來像刻意的。

| 概念 | 期望 | 實得 | 性質 |
|---|---|---|---|
| ~~`cpp_static_cast`~~ | 3 | ✅ **3** | **US1b 已修**——實作在 `operators.ts`，被另外兩處覆蓋 |
| ~~`cpp_const_cast`~~ | 5 | ✅ **5** | US1b 已修 |
| ~~`cpp_dynamic_cast`~~ | 2 | ✅ **2** | US1b 已修 |
| ~~`cpp_reinterpret_cast`~~ | 1 | ✅ **1** | US1b 已修 |
| `cpp_ifdef` | 7 | （空） | `#define N` 後 `#ifdef N` 的 body 沒跑 |
| `cpp_ifndef` | 7 | （空） | body 沒跑 |
| `cpp_namespace_def` | 7 | （空，`UNDEFINED_FUNC`） | namespace 內的函式呼叫不到 |
| `cpp_lambda` | 42 | （空，`UNDEFINED_FUNC`） | lambda 呼叫不到 |
| `cpp_struct_declare` | 8 | `void` | 成員存取不到 |
| `cpp_class_def` | 3 | `void` | 成員存取不到 |
| `cpp_constructor` | 4 | `void` | 建構式 body 沒跑 |
| `cpp_destructor` | 51 | 1 | 解構式 body 沒跑 |
| `cpp_virtual_method` | 6 | `void` | 方法 body 沒跑 |
| `cpp_override_method` | 9 | `void` | 覆寫 body 沒跑 |
| `cpp_pure_virtual` | 5 | `void` | 子類方法沒跑 |
| `cpp_operator_overload` | 3 | `void` | 運算子 body 沒跑 |

**十個是物件導向**（class／struct／constructor／destructor／virtual／override／pure_virtual／operator_overload），直譯器不支援它。**把它們做成空操作，讓「不支援 OOP」看起來像「OOP 不需要執行」。**

四個轉型是**唯一可以在本功能修好的**——實作一直都在 `functions.ts`，只是被清單覆蓋（research F8）。

---

## ⬜ 不可宣告：判不出來（5 個）

概念**沒有出現在語義樹裡**，最小程式測不到它。

| 概念 | 為什麼測不到 |
|---|---|
| `cpp_include_local` | `#include "x.h"` 需要本地檔案；辨識後可能歸入 `cpp_include` |
| `cpp_raw_code` | 只在辨識失敗時產生，無法刻意觸發 |
| `cpp_raw_expression` | 同上 |
| `cpp_ifdef` ／ `cpp_ifndef` | （已改列 🔴——修正最小程式後測得到了） |

**判不出來歸入「不得宣告」**，與既有護欄的保守方向一致。

> `cpp_raw_code` 這兩個是兜底容器，直覺上像 `declarative`。**但直覺不是依據。** 它們裝的是「我們看不懂的程式碼」，不執行它等於靜靜地略過使用者寫的東西——那是降級，該由既有的 `confidence`／`degradationCause` 出聲，不是宣告成「本來就不執行」。

---

## ⚰️ 死條目（3 個）

`cpp:include`、`cpp:include_local`、`cpp:using_namespace` ——冒號命名，**概念註冊表中不存在**。同一份清單裡的底線版才是活的。直接刪。

---

## 複查觸發條件

宣告不是一次性的。以下事件發生時，對應的分類**必須重驗**：

| 事件 | 要重驗哪些 |
|---|---|
| 加入檔案讀寫概念 | `cpp_ifstream_declare`、`cpp_ofstream_declare` |
| 加入 stringstream 的讀寫 | `cpp_stringstream_declare` |
| 加入 pair 的成員存取 | `cpp_pair_declare` |
| 直譯器支援物件導向 | 上表 🔴 的十個 OOP 概念（它們會從「還沒實作」變成「已實作」，不是變成可宣告） |
| 巨集展開從墓碑復活 | `cpp_define` |

**這張表要跟著宣告一起活著。** 沒有它的話，一個曾經正確的宣告會在系統長出新能力之後靜靜地變成錯的。

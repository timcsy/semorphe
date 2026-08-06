# Feature Specification: istringstream 五路，以及耦合的第四種形式

**Feature Branch**: `095-istringstream` ｜ **Created**: 2026-08-07

## 為什麼做這個

`tests/integration/fuzz-cpp-containers.test.ts:175` 的降級註解寫著那支 fuzz
被 `istringstream` 擋住。與前面七批查過的阻斷者不同，**這個標記是對的**
——概念真的不存在。所以這是加功能，不是清理。

（它不在缺陷帳的 13 支 `it.todo` 裡——那 13 支的阻斷者是別的概念。
這一筆是註解裡的降級記錄，缺陷帳量不到；**護欄量的是停用的測試，
不是註解裡寫的話**。）

但實作途中撞到的東西比功能本身重要，見下面第二節。

## 一、`istringstream` 五路

| 路 | 交付 |
|---|---|
| 語義 | `std/sstream/concepts.json` 的 `cpp_istringstream_declare` |
| 投影 | `std/sstream/blocks.json` 的積木 |
| 產生 | `codeTemplate` + `std/sstream/generators.ts`；`input` 帶 `from` 時產 `${from} >> …` |
| 辨識 | 建構子式宣告攔截 + `cppStreamRead` 後處理 |
| 執行 | `std/sstream/executors.ts` 切詞；`interpreter/executors/io.ts` 依 `from` 取用 |

只補執行那一條的話，孤兒實作護欄會叫——082 撞過一次。

### `>>` 的歧義：判準只能是型別

```cpp
in  >> a;   // 從串流讀值
num >> 1;   // 位元位移
```

**語法完全相同。** 分得出來的唯一依據是根變數的型別。

三次失敗的嘗試都留在紀錄裡，因為它們指向同一條原則：

1. 宣告式規則 `rootMatch.nodeType: identifier` — 把所有位移一起認領走
2. 加 `collectMatch` 收窄 — `num >> i` 仍然被搶
3. 改寫進手寫辨識器 — 沒觸發，JSON pattern 先跑

P3：「歧義在**註冊時**仲裁，不在執行時碰運氣。」前兩次都是在碰運氣。
定案是在 pattern 跑完之後做後處理——與既有的 `func_call_expr → func_call`
同一個位置、同一個理由。

### 一個實際的缺陷：走訪停太早

`in >> a >> b >> c` 的巢狀是 `((in >> a) >> b) >> c`，而**內層的 `in >> a`
已經先被改判成 `input`**。第一版的走訪只認 `arithmetic`，於是收到 `a` 就停了。

**症狀是「串流只讀到第一個值」**，看起來像執行器壞掉。錯的是辨識。

## 二、耦合的第四種形式：型別名

改判規則的第一版寫在 `src/core/lift/lifter.ts`，於是核心層出現了兩個寫死的
C++ 型別字串 `'istringstream'` / `'stringstream'`。

| 護欄 | 量什麼 | 有沒有數到 |
|---|---|---|
| 中立性 | 元件身分字串 | ✗ 型別名不是身分 |
| 語法耦合 | 前置處理指令／`std::`／註解符號 | ✗ 清單裡沒有型別名 |
| 就近性 | 一個元件的實作散在幾個檔 | ✓ **但它量的不是語言耦合** |

叫的那一條，量的甚至不是這件事——`input` / `var_ref` / `arithmetic` 三個元件
的擴散度各 +1 檔，指向同一個新檔案。**如果我把那條規則寫進一個已經提到這三
個概念的既有檔，三條護欄會全綠。**

這是 059 那句話的延伸。⚠️ 編號要接 `history/021` 的原文：「**import 是耦合的
一種形式，身分是另一種，語法是第三種**」——所以型別名是**第四種**，不是第三種。
（本文件初稿三處都寫成「第三種」，那會讓讀者以為 021 只講了兩種。已更正。）
`knowledge/history/021`：「一條規範被機械化時，選了哪一維會消失在數字裡。」

修法沿用既有形狀（語言套件推、核心讀）：`core/lift/post-processors.ts` 收
宣告，`languages/cpp/core/lifters/expressions.ts` 推 `cppStreamRead`。放進
`expressions.ts` 而非新開檔案也是就近性——`>>` 的辨識與 `extractCinChain`
本來就在那裡。

護欄同步補上：型別名進「確定」桶，且合成注入**直接餵我當時寫錯的那一行**。

### 為什麼 `printf` / `cout` / `iostream` 歸「無法確定」

實測過：它們在 `src/ui/` 是**風格偏好的識別字**
（`io_style === 'printf' ? 'cstdio' : 'iostream'`），不是被產生出去的語法。
判不出來就不判——判成違規是「為了數字好看而悲觀歸類」，同樣是量錯。

## Requirements

- **FR-001**: `cpp_istringstream_declare` MUST 有完整五路
- **FR-002**: `>>` 的改判 MUST 以根變數的型別為唯一判準；查不到型別 MUST NOT 改判
- **FR-003**: 非串流變數的 `>>` MUST 仍是位元位移，且概念身分 MUST 是 `arithmetic`
- **FR-004**: 連鎖讀取 MUST 收集**全部**目標，順序 MUST 與原始碼相同
- **FR-005**: `cin >> x` MUST NOT 帶 `from`（cin 是標準輸入，不是具名串流）
- **FR-006**: 核心層 MUST NOT 出現任何語言的型別名——判準由語言套件推入
- **FR-007**: 語法耦合護欄 MUST 抓得到核心層寫死的標準函式庫型別名
- **FR-008**: 該護欄 MUST NOT 把含型別名的**元件身分**報成語法耦合
- **FR-009**: 期望值 MUST 由真的 `g++` 決定

## Success Criteria

- **SC-001**: `tests/integration/sstream-input.test.ts` 十支全綠，期望值全部來自 g++
- **SC-002**: 位移的既有測試（`advanced-patterns.test.ts`）零改動且全綠
- **SC-003**: 語法耦合護欄「確定」維持 0；「無法確定」48 → 60（新增的判不出來的記號單獨報）
- **SC-004**: 就近性護欄僅新增 `cpp_istringstream_declare` 一項，既有元件的擴散度 MUST NOT 上升
- **SC-005**: 執行器清冊僅多 `cpp_istringstream_declare` 一個概念

## 量測

| 指標 | 前 | 後 |
|---|---|---|
| 元件數 | 180 | 181 |
| 語法耦合：確定 | 0 | 0 |
| 語法耦合：無法確定 | 48 | 60 |
| 語法耦合：記號清單 | 25 | 34 |

「無法確定」上升**不是惡化**——是清單變長之後照出了本來就在那裡的東西。
它不計入棘輪，正是為了不讓「把記號移出清單」變成一種刷分數的方式。

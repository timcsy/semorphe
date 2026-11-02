# 模糊測試報告 — C++ — 2026-11-02（第 218 刀：cpp:method_def）

## 摘要
- 語言：C++；範疇：類別與成員函式（const 正確性）；難度：hard
- 出題者：資訊隔離的子代理（不知道實作），10 支；全部以本機編譯器（clang++ -std=c++17，bits/stdc++.h 用墊片）編得過、輸出確定
- 程式與預期輸出：`tests/fixtures/fuzz-cpp-method-def.json`

| | main（218 之前） | 218 |
|---|---|---|
| 產回來的程式輸出與原始相同 | 0 | **6** |
| 產回來的程式編不過 | 9 | 3 |
| 產回來的程式輸出不同 | 1 | 1 |

- Round-trip PASS（輸出相同、再 lift 同一棵樹）：5（fuzz_2、3、4、5、8）
- ROUNDTRIP_DRIFT：1（fuzz_6——輸出相同，再 lift 的樹不同：建構子的預設引數掉了）
- COMPILE_FAIL：3（fuzz_1、7、10）；SEMANTIC_DIFF：1（fuzz_9）——四支都是**既有缺陷**（main 上同樣），不在這顆元件的範圍

## 這一刀修掉的
1. **const 成員函式丟了 const**（main 上 9 支編不過的主因）——元件本身
2. **回傳參考／指標的成員函式整個壞掉**：`Counter& tick()` 產成 `Counter tick()() {`（參考符號不見、宣告子的文字跑進名字）。
   method_def 剝一層 reference／pointer 宣告子、符號併進回傳型別，`const` 前綴也併進去（fuzz_6、8 因此通過）

## 待修復（it.todo，附根因）
| 支 | 問題 | 根因 | 屬於 |
|---|---|---|---|
| fuzz_1 | `const Rect c(7, 1);` → `const Rect c = 7;` | const 物件的建構引數只留第一個 | 宣告那一族 |
| fuzz_6／fuzz_10 | `Time(int h = 0, int m = 0)` → `Time(int h, int m)` | 建構子的預設引數掉了 | 建構子 |
| fuzz_7／fuzz_10 | `static Matrix identity(int n)` 丟了 static | 類別成員的 static（method_def 刻意不接） | 類別成員 static |
| fuzz_9 | `sz(n, 1)` → `sz(n)`，輸出 `1 0 4` → `1 0 0` | 建構子初始化列只留第一個引數 | 建構子 |

## 覆蓋缺口
- **`this` 沒有元件認領**：`this->x`、`*this` 的 `this` 降級成原文（照抄回去，輸出不受影響）。
  ⟹ 用到 `this` 的成員函式目前翻不成 Cella 的程式（formalize 遇到原文就停）。推薦另立一顆 `this` 元件。

## JS 直譯器
10 支在 main 與 218 上都與編譯器不一致（`fixed`／`setprecision`、排序的 lambda 等它本來就不完整）——它在 6c 退場，不拿它當判準。

## 產生的回歸測試
- `tests/integration/fuzz-cpp-oop.test.ts`：第 218 刀那一組（身分、const 標頭、不動點、再 lift 同一棵樹；todo 5 條）
- `src/components/cpp/method_def/spec.test.ts`：回傳參考／指標／const 回傳一條

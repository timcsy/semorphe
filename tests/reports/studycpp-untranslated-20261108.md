# 學生語料「翻不出」歸零的第一輪 — 2026-11-08（342）

StudyCpp 218 支，只跑 formalize（不送判決）：**翻不出 5 → 2**。翻不出 ＝ 學生拿不到判決。

| 程式 | 卡在 | 處置 | 之後 |
|---|---|---|---|
| tioj_godteach/pratice_question/10_ex2_2 | `atoi(s)`（`cpp:cstring_as_int` 沒有 formalize） | 補 formalize（一般的函式呼叫） | 判 accept |
| w/APCS/o713、o713_c++14 | lambda 本體裡 `r < M && c > -1` 被 tree-sitter 剖成樣板；misparse 修補 ② 問作用域時不知道 `r` 是 lambda 的參數 | lambda 的參數進作用域（同函式定義） | 翻得出；判 unknown（Cella：`push_back({sr, sc, bombR})` 的大括號串列型別還不知道——誠實的 unknown，不是 reject） |
| AP325/2/2_11_AC | `set<ll> st({0});`——set 沒有放建構引數的接點，整句照原文降級（spec 203 的處方） | **留著，照實降級** | 要讓 set 收得下 `({…})` 得多一個形態記號與產碼（同 vector 的 size 那一格），語料只有這 1 支 |
| w/APCS/j607_trash | `#define z -'0'`——巨集的值是一段運算子片段 | **留著，照實降級** | 產碼那一側在第 203 刀已照原文保留；formalize 要能展開「運算子片段的巨集」才翻得出，語料只有這 1 支 |

判準：翻得出之後的判決不准是新的 reject（照 upgrade-cella 的「一個構造變成支援之後，它背後的下一個問題才看得見」）。三支都沒有。

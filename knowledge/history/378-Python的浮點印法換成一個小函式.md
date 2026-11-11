# 378 · Python 的浮點印法換成一個小函式

> 日期：2026-11-11（404）
> 轉變：Python → C++ 遇到 `print(浮點)` 整支保留（原因 `float-print`：Python 印 `2.0`、`cout` 預設印 `2`）。[363](363-互轉保留的擴大與不該換的那些.md) 記的是「試的寫法（`ostringstream` 配 `stod`）Cella 還翻不出」。
> 改成：補在開頭的小函式 `float_text(double)`，`print` 與 `str()` 遇到浮點都經過它；保留原因 `float-print` 刪掉。課文 Python → C++ 換過去 25 → 27（共 36 支）。

## 寫法

Python 印的是 repr：能來回的最短位數；整數值補 `.0`；指數在 [-4, 16) 之外改科學記號（`1e+20`、`1e-05`）。

`float_text` 用 `snprintf("%.*e")` 從 1 位試到 17 位，讀回來等於原值就停；再看指數決定用 `%.*f` 還是保留科學記號。nan／inf 先擋掉（`%f` 會印成 `inf.0`）。

## 試過不能用的

- `strtod`：Cella 回「not supported yet」。
- `stod`：同上（字串流那一族在 Cella 的待辦裡）。
- `#include <bits/stdc++.h>`：Cella 會加一條「標頭內容看函式庫」的假設，與 Python 那邊的 assumes 對不上。改成逐一列標頭（`cstdio`、`cstdlib`）。

`atof` 判 accept、沒有假設，所以讀回那一步用它。

## 還沒做的

- `float(input())`：換成 `stod`，Cella 還不支援；改用 `atof` 會讓壞輸入不報錯（Python 會拋例外），意思不同，不換。
- `04-算一算/rebuild.py` 仍保留：`**` 的指數不是非負字面量。

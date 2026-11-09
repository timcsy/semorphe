# Feature Specification: C++ → Python 的取餘數

**Feature Branch**: `373-py-modulo`
**Created**: 2026-11-09
**Status**: Draft
**Input**: spec 219 的後續（history/353「剩下保留的主要是取餘數的一般用法（11 筆）」）。

## 背景

C++ 的 `%` 向零截斷、正負號跟被除數（[expr.mul]p4）；Python 的 `%` 跟除數。spec 219 只在「與 0 比較」時換（正負號不影響），其餘整支保留。

## Requirements

- **FR-001**: 32 位元以內的有號整數的 `a % b`、`x %= v` MUST 換成照 C++ 定義的寫法 `a - int(a / b) * b`——兩邊是變數或字面量時。
- **FR-002**: 兩邊有運算式（呼叫、`i++`）時 MUST 保留——照定義改寫每一邊會算兩次。
- **FR-003**: 64 位元整數（`long`、`long long`）的 `%` 與 `/` MUST 保留——值可以超過 2^53，浮點不精確。（順手修：spec 219 的除法也收了 `long long`）
- **FR-004**: 判準照舊：兩邊交給 Cella，判決、輸出、assumes 相同。

## Success Criteria

- **SC-001**: cpp-beginner 64 支解答換過去的從 52 增加，且每一支判決相同（或屬於登記過的 Cella 缺口）。

## 為什麼不用 `math.fmod`

更短，而 Cella 的 Python 家族還不支援它（判 unknown）——判決證明不了的寫法不用（已請 cella 補）。

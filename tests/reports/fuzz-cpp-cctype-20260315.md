# 模糊測試報告 — C++ cctype — 2026-03-15

## 摘要
- 語言：C++
- 產生的程式數：10
- Round-trip PASS：7
- SEMANTIC_DIFF：3（全為已知陣列初始化器遺失）
- cctype 特有 bug：0

## 結論
cctype 概念（isalpha, isdigit, toupper, tolower）在所有測試中都正確運作。

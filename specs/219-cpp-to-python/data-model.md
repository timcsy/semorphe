# Data Model：C++ → Python（spec 219）

本功能不新增存檔欄位，只在記憶體裡多兩個形狀（契約見 [contracts/convert-to-language.md](contracts/convert-to-language.md)）。

## 換寫法的結果

| 欄位 | 意思 |
|---|---|
| `tree` | 換好的 Python 語意樹；整支不換時是原本的 C++ 樹 |
| `converted` | 換了幾個語句 |
| `kept` | 保留了幾處 |
| `reasons` | 保留的原因（下一節） |

## 保留的原因

| 欄位 | 意思 |
|---|---|
| `nodeId` | 卡住的那顆節點（積木上指得回去） |
| `line` | 原始碼的行（有的話） |
| `kind` | `overflow`／`division`／`modulo`／`char`／`pointer`／`class`／`template`／`outside-subset`／`needs-types` |
| `detail` | 給人看的一句話（例：「`a % b` 的正負號規則兩個語言不同」） |

## 狀態

```
C++ 程式 ──換目標（語言變了）──▶ 問型別 ──▶ convertToLanguage
   ├─ reasons 為空 ──▶ Python 程式（編輯器、積木都換）＋ 提示「換了 N 行」
   └─ reasons 不空 ──▶ 維持 C++ 程式、目標回到 C++（或留在 C++ 並說明）＋ 提示原因清單
```

⚠️ 「整支不換」時目標要不要停在 Python：停在 Python 而編輯器裡是 C++ 是一個不一致的狀態——**目標退回 C++ 並說明原因**（tasks 階段實作，e2e 驗）。

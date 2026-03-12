# 模糊測試報告 — C++ OOP 概念 — 2026-03-12

## 摘要
- 語言：C++
- 產生的程式數：10
- 原始程式全部編譯通過：10
- Round-trip PASS：9
- SEMANTIC_DIFF：1

## 測試覆蓋範圍
| 編號 | 描述 | 狀態 |
|------|------|------|
| oop_001 | class 含預設建構子、解構子、公開欄位 | PASS |
| oop_002 | class 含兩個公開欄位、建構子初始化、解構子 | PASS |
| oop_003 | 建構子/解構子呼叫順序搭配 cout | PASS |
| oop_004 | operator+ 多載（含兩個欄位的 class） | PASS |
| oop_005 | class 含私有欄位、建構子/解構子中 cout | PASS |
| oop_006 | operator== 多載搭配 if/else | PASS |
| oop_007 | 內部 block scope 的解構子呼叫 | SEMANTIC_DIFF |
| oop_008 | class 搭配獨立函式使用成員存取 | PASS |
| oop_009 | 同一 class 多個 operator 多載 (-, *) | PASS |
| oop_010 | 兩個 class 的建構子/解構子、銷毀順序 | PASS |

## 已知限制

### SEMANTIC_DIFF: 內部 block scope 遺失（007）
- **問題**：`{ Scope s; cout << "inner" << endl; }` 的大括號在 lift 時被忽略，內部的 `Scope s` 被移至 main scope
- **原因**：lifter 不保留函式內部的匿名 compound_statement（block scope），所有語句被扁平化至外層
- **影響**：解構子在 main 結束時才觸發，而非在 block scope 結束時。輸出順序從 `enter → inner → exit → main end` 變為 `enter → inner → main end → exit`
- **範疇**：需新增 block scope 語義節點或保留匿名 compound_statement 的 lift 策略
- **備註**：roundtrip 穩定（gen1 == gen2），問題僅在語義差異

## 測試成果亮點

### 完整支援的 OOP 功能
- **class 定義**：含 public/private 區段正確 lift/render
- **建構子/解構子**：正確識別、生成，含建構子內的 cout 輸出
- **operator 多載**：`+`、`-`、`*`、`==` 均能正確 roundtrip
- **成員欄位存取**：`obj.field` 語法正確處理
- **多 class 互動**：兩個 class 在同一程式中的建構/銷毀順序正確
- **私有欄位**：private section 正確保留

## 產生的回歸測試
- `tests/integration/fuzz-cpp-oop.test.ts`（18 個 PASS 測試 + 1 個 skip）

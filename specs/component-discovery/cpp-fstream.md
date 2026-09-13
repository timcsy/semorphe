# 概念探索：C++ — `<fstream>`

## 摘要
- 語言：C++
- 目標：`<fstream>` 標頭檔
- 發現概念總數：2（已存在）
- 通用概念：0、語言特定概念：2

## 概念目錄

### L3c: 例外與進階

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| `cpp_ifstream_declare` | `ifstream fin("input.txt");` | 開啟檔案讀取 | NAME (field), FILE (field) | lang-library | 特定 | `var_declare` | **已存在**，需移除 codeTemplate |
| `cpp_ofstream_declare` | `ofstream fout("output.txt");` | 開啟檔案寫入 | NAME (field), FILE (field) | lang-library | 特定 | `var_declare` | **已存在**，需移除 codeTemplate |

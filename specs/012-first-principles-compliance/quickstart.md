# Quickstart: First Principles Compliance

## 驗證場景

### 場景 1: 執行概念完備性驗證

```bash
npx tsx src/scripts/verify-concept-paths.ts
```

預期輸出（全通過）:
```
Scanning concept sources...
  - universal.json: 15 concepts
  - basic.json: 8 concepts
  - special.json: 4 concepts
  - lift-patterns.json: 6 concepts
  - universal-templates.json: 12 concepts
  - hand-written lifters: 10 concepts
  - hand-written generators: 10 concepts

Checking 4 paths for 32 unique concepts...

✓ var_declare: lift ✓ render ✓ extract ✓ generate ✓
✓ arithmetic: lift ✓ render ✓ extract ✓ generate ✓
...

Result: 32/32 concepts fully covered (0 missing paths)
Exit code: 0
```

### 場景 2: Confidence 與 DegradationCause 測試

輸入程式碼:
```cpp
int x = 5;           // 精確匹配 → confidence: high
int y = x +;         // 語法錯誤 → confidence: raw_code, cause: syntax_error
auto z = [](){};     // Lambda（未知概念）→ confidence: raw_code, cause: nonstandard_but_valid
```

### 場景 3: 註解 Roundtrip

輸入:
```cpp
// section header
int x = 1; // set x
foo(a, /* important */ b);
```

lift 後的語義樹:
```
program
├── comment { text: " section header" }
├── var_declare { name: "x", type: "int" }
│   └── annotations: [{ type: "comment", text: " set x", position: "inline" }]
└── func_call { name: "foo" }
    └── children.args[1].annotations: [{ type: "comment", text: " important ", position: "before" }]
```

generate 後的程式碼:
```cpp
// section header
int x = 1; // set x
foo(a, /* important */ b);
```

### 場景 4: Code Style 切換

同一棵語義樹，APCS 風格:
```cpp
#include <iostream>
using namespace std;

int main() {
    int x;
    cout << "Hello" << endl;
    return 0;
}
```

切換為競賽風格:
```cpp
#include <bits/stdc++.h>
using namespace std;

int main() {
    int x;
    printf("Hello\n");
    return 0;
}
```

切換為 Google Style:
```cpp
#include <iostream>

int main() {
  int x;
  std::cout << "Hello" << std::endl;
  return 0;
}
```

## 測試執行

```bash
# 執行全部測試
npm test

# 只執行本 feature 相關測試
npx vitest run tests/unit/core/confidence.test.ts
npx vitest run tests/unit/core/annotation-roundtrip.test.ts
npx vitest run tests/unit/scripts/verify-concept-paths.test.ts
npx vitest run tests/integration/style-preset.test.ts
```

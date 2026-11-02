# Quickstart：驗證共用 Cella 判決入口

## 前提

- `node_modules` 裝好（main 的 Cella 版本）
- 不需要先 `npm run build`——第一次跑會自己編模組並寫進 `node_modules/.cache/semorphe-cella/`

## 驗證

```bash
# ① helper 本身：正向錨點綠、unknown／reject／翻不出三條注入都證明「斷言輸出」會失敗
npx vitest run tests/unit/helpers/cella-run.test.ts

# ② 三支示範檔換判準之後照樣綠
npx vitest run tests/integration/execution-cpp-containers.test.ts tests/integration/vector-initializer-list.test.ts src/components/cpp/range_max/spec.test.ts

# ③ 三支示範檔不再引用 JS 直譯器（應該沒有輸出）
grep -n "SemanticInterpreter\|interpreter/" tests/integration/execution-cpp-containers.test.ts tests/integration/vector-initializer-list.test.ts src/components/cpp/range_max/spec.test.ts

# ④ 建置工具改用共用快取之後照樣產出模組
npx tsx tools/precompile-cella.ts /tmp/cella-modules-check && ls /tmp/cella-modules-check
```

## 預期

- ① 的失敗訊息（注入測試裡擷取並斷言）包含判決種類、問題種類、原因、原始碼片段。
- ② 每檔的執行時間記錄在 tasks 的完成紀錄（改前 vs 改後），作為 6c-2 的依據。
- 全套（`tools/long-test.sh … --suite`）綠，沒有新增的 skip。

# Quickstart: 驗證 6c-4

```bash
cd /Users/timcsy/Documents/Projects/semorphe-246
npx tsc --noEmit
npm run test:unit && npm run test:capsule          # 每一段之後
SEMORPHE_REFCC_INCLUDE=$PWD/tests/fixtures/refcc-shim npm run test:guard
# 殘留檢查（預期 0）
grep -rlE "src/interpreter|providers/js-interpreter|lang/runtime|lang/executors|/execute'" src tests --include='*.ts' | wc -l
find src/components -name execute.ts | wc -l
grep -rl '"execute"' src/components --include=component.json | wc -l
# 合併前
SEMORPHE_REFCC_INCLUDE=$PWD/tests/fixtures/refcc-shim /Users/timcsy/Documents/Projects/semorphe/tools/long-test.sh $PWD <輸出目錄> --port 4198
npm run build:vscode   # 看 vsix 大小
```

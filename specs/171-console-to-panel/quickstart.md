# Quickstart：怎麼驗這一刀真的成立

## 一、SC-001／SC-002 —— 三個宿主的形狀一樣

```bash
npm run build:vscode && node tools/vscode-preflight/run.mjs
```

預檢那一段要說：

```
版面 → 這個宿主：3 張（專注…、對照…、三欄…） 🟢
主控台 → panel 區：🟢 有那個 view
```

🔴 **而它不得再出現「版面能力」那一行**——那是能力探測留下的，
探測本身退場了。

## 二、SC-003 —— 刪比加多

```bash
git diff --stat <base>..HEAD -- src/ tests/
```

**刪掉的行數要大於加上的。** ⚠️ 而它不是「越少越好」：如果淨增加，
就代表十字的複雜度被搬去了別的地方而不是拿掉。

## 三、SC-004 —— 既有 e2e 只有十字那幾條會改

```bash
git diff --stat <base>..HEAD -- e2e/
```

只有 `layout-presets.spec.ts` 該動（7 處提到十字）。
🔴 **其他 e2e 檔一行都不准改**——改了就代表這不是重構，是行為改變。

## 四、SC-005 —— 關掉之後它自己回來

```bash
npx playwright test e2e/console-comes-back.spec.ts
```

```
關掉主控台 → 執行一支印東西的程式 → 它自己出現，而且印出來了
關掉主控台 → 執行一支讀 cin 的程式 → 它自己出現，而且輸入打得進去
關掉主控台 → 切換版面            → 🔴 它【不准】被打開
```

## 五、兩個宿主都要看

```bash
npm test && npm run test:e2e
node tools/vscode-preflight/run.mjs
```

⚠️ 而 **Arduino IDE 要人工看一次**——它是這一刀的起點，
而預檢跑的是 Chromium 不是 Theia（`tools/vscode-preflight/run.mjs` 檔頭記著
這個限制）。

# Quickstart：驗證 C++ → Python（spec 219）

## 護欄（主要）

```bash
npx vitest run tests/integration/cpp-to-python-verdict.test.ts
```

預期：cpp-beginner 66 支解答分成「換過去且判決相同」與「保留且附原因」兩份，加起來 66；至少一半換得過去（SC-001）；
反例 6 種（負數除法、負數取餘數、溢位、char 運算、指標、類別）每一種都保留、原因類別正確（SC-003）。

## 單元

```bash
npx vitest run src/languages/cpp/cpp-to-python
```

## 畫面（e2e）

```bash
npx playwright test e2e/cpp-to-python.spec.ts
```

預期：C++ 目標寫一支讀兩個數相加的程式 → 換目標到 Python → 編輯器裡是 `a, b = map(int, input().split())` 那種寫法、提示「換了 N 行」；
寫一支用指標的程式 → 換目標 → 程式不變、目標回到 C++、提示列出原因。

## 合併前

長測試（全套 ＋ 建置 ＋ e2e）在合併後的狀態跑；改了 lift 以外的東西不必重量 StudyCpp（這一刀不動 lift）。

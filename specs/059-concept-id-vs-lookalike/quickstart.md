# Quickstart：驗證這個功能真的做到了

## 前置

```
npm install
```

## ① 量測是否分得出身分與撞名字串

```
npx vitest run tests/integration/audit-neutrality.test.ts
```

**預期**：
- 報表出現**兩欄**：「誤報修掉的」與「真的搬走的」
- 雙向注入兩支都在且都綠：
  - `★ 注入：真的身分引用必須仍被報出`
  - `★ 注入：同名但位置屬於已遮罩型別的字串不得被報出`

**失效樣態**：只有第一支的話，一個「什麼都不報」的護欄也會過。

## ② 核心層是否還有註解語法

```
grep -nE "'//'|\\\\/\\\\/|/\\*\\*|/\\* " src/core/projection/code-generator.ts src/core/lift/lifter.ts
```

**預期**：無輸出。

## ③ 註解的產出有沒有變

```
npx vitest run tests/integration/comment-projection-snapshot.test.ts
```

**預期**：單行／區塊／文件註解在三種積木風格下全部一字不差。

## ④ 全套與其餘護欄

```
npm test
```

**預期**：全綠；其餘護欄的數字皆未上升。

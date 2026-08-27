---
name: write-lesson
description: 生一堂課（lessons/ 底下的教案）——元件清單要量出來、程式碼只寫一份、每一課都有 e2e 在走
---

# 生一堂課（write-lesson）

## 這把刀先問一句

> **這堂課的程式碼，我跑過了嗎？**

沒有 → **先跑，再寫課文**。一堂課文是對學生的承諾（「你會看到 `Hello!`」），
而一句沒驗過的承諾在課堂上會當著全班的面破掉。

（緣起：2026-08-27 生前四堂 C++ 入門課，**同一輪之內犯了兩次靜默錯誤**——
兩次都是「東西看起來完全正常，而學生照著做會卡住」。）

## 交付物——一堂課是兩個檔

```
lessons/<軌道>/<編號>-<課名>/
    lesson.json    宣告：要開哪些積木、釘住什麼組態、跑出來該是什麼
    lesson.md      課文：學生讀的那一份，**也是程式碼唯一住的地方**
```

🔴 **`lesson.json` 不放程式碼。** 護欄從 `lesson.md` 的 `## 完成的樣子`
抽 fenced block 去跑。一份寫在兩處的程式碼遲早會有一處是舊的，
而**學生看到的永遠是舊的那一處**。

## 步驟

### 1. 🔴 先跑程式碼，把元件清單**量出來**——不要憑印象列

開 dev server，貼進去，同步一次，走一遍語義樹：

```js
const a = window.__app
a.codeView.setCode(code)
await a.syncController.syncCodeToBlocks(code)
// 走 currentTree 收集 componentId
```

**實測改過我兩次**（2026-08-27，前四課）：

| 憑印象 | 實測多出來 |
|---|---|
| 第一課「`func_def` ＋ `print` ＋ `literal_string`」 | ➕ `cpp:literal_number`——`return 0;` 的那個 `0` |
| 第二課以為 `1.72` 有自己的浮點元件 | 沒有，它與 `95` 同一顆 `literal_number` |

> **一份憑印象列的元件清單，與一份量出來的長得一模一樣
> ——直到有人照著它上課。**

同時確認 **`raw_code` 是零**。有 `raw_code` 代表系統讀不懂這段程式碼，
那堂課在積木那一側是壞的——而課文照樣寫得出來。

### 2. ⚠️ `pins.target` 要填**目標**的 id，不是主題的

```
主題（topic）   cpp-beginner · c-beginner · python-beginner · cpp-competitive · arduino
目標（target）  cpp · c · python · cpp-competitive · arduino · arduino-uno · esp32 · …
```

2026-08-27 我把 `cpp-beginner` 填進 `pins.target`——**它是主題**，
而目標叫 `cpp`。JSON 合法、檔案存在、編輯器開得起來，**而組態根本沒套用**。

查法（不要背）：

```bash
for f in src/languages/*/targets/*.json; do
  python3 -c "import json;d=json.load(open('$f'));print(d['id'],'| topic:',d.get('topic'))"
done
```

### 3. 課文骨架——七段，而「三件事」是刻意的上限

```
# <課名>
> <一句話：這堂課做出什麼>  ·  ⏱ <時間>
## 你會學到三件事      ← 剛好三件
## 開始之前            ← 接上一課的成果
## 一、二、三…         ← 有編號的步驟，每步一小段程式碼
## 完成的樣子          ← 🔴 護欄抽這一段去跑
## 換你了              ← 一個改造題，不給答案
## 這一課你做了什麼
## 如果卡住了          ← 症狀／原因對照表
```

**寫第四件的時候，那多半是下一課。** 這條上限是在逼你切課，不是在限制內容。

「如果卡住了」那張表**寫症狀，不寫錯誤訊息全文**——學生看得懂的是
「主控台是空的」，不是 `error: expected ';' before '}' token`。

### 4. 課文裡每一段程式碼都要能單獨成立

步驟中間那些片段，護欄**不會**去跑（它只抽 `## 完成的樣子`）。
所以那些片段是**人要負責**的部分——寫完自己讀一遍：
這一段貼進去跑得起來嗎？它用到的東西前面教過嗎？

### 5. 兩條護欄，缺一不可

| | 問什麼 | 抓得到什麼 |
|---|---|---|
| `tests/integration/audit-lessons.test.ts` | 這顆元件**存不存在** | 懸空引用、骨架殘缺、第四件事 |
| `e2e/lessons.spec.ts` | 這段程式碼**真的用到它嗎** | 清單漏一顆／多一顆、跑出來不符 |

🔴 **靜態那條答不出第二個問題**。憑印象漏掉的 `literal_number`
是一顆**存在的**元件，靜態護欄完全看不到。

e2e 那條是**資料驅動**的：新增一堂課不必新增測試檔，掃到就會跑。

### 6. 要輸入的課，用**真的輸入框**餵，不灌 API

```ts
await page.locator('#run-btn').click()
const box = page.locator('.console-inline-input')
await expect(box).toBeVisible()      // ← 這一行順便驗了「程式真的停下來等人」
await box.fill(line); await box.press('Enter')
```

灌 `setReplayInputs` 會繞過那一半——而課文寫著「程式會停住」，
那句話也是一個承諾。

## 明確否決

| 做法 | 為什麼不行 |
|---|---|
| 程式碼同時寫進 `lesson.json` 和 `lesson.md` | 雙重真相；學生看到的是舊的那一份 |
| 元件清單憑印象列 | 存在的元件漏掉了，靜態護欄看不到 |
| 一堂課配一支 e2e | 五十堂就是五十支。**資料驅動一支就夠** |
| 「先寫課文，程式碼之後補跑」 | 課文是承諾。沒驗過的承諾會在課堂上破 |
| 「三件事」寫成四件 | 那是兩堂課被壓成一堂 |

## ⚠️ 而我自己違反過一次順序

`build-guardrail` 第 6.5 步要求「**護欄先蓋，功能後做**」——
而 2026-08-27 我是**先修掉 `cpp-beginner` 那個缺陷、才蓋護欄**的。
於是護欄的第一次跑沒有抓到它，靠的是注入那一支。

> **一個被順便修掉的缺陷不會留下任何紀錄，而它的同類還會再來。**

下一次生課：**先蓋護欄、讓它紅、逐項指名，才動手修。**

## 相關

- `lessons/README.md`——格式的規範本體
- [[build-guardrail]]——第 6.5 步（第一次跑必須是紅的）、第 9 步（兩個方向都要釘）
- `knowledge/draft/2026-08-27-教案是一個宣告.md`——為什麼教案是宣告不是硬編碼
- `knowledge/draft/2026-08-27-課程地圖.md`——還有哪些課要生

# Round-Trip 報告 — C++ Arduino 內建函式（第 0 批九顆） — 2026-08-18

> branch `141-cpp-arduino-builtins`　階段 6.16 的地基
> 測試檔：`tests/integration/roundtrip-cpp-arduino-builtins.test.ts`（永久，非臨時腳本）

## 結論

```
四段真實教學場景　107 節點　殘差 0 = 0.00%
文字漂移 0／4　結構漂移 0／4　降級成通用呼叫 0
九顆【全部】被場景覆蓋到——沒有一顆只靠自己的 spec.test.ts 自證
```

## 場景與結果

| # | 場景 | 用到的第 0 批概念 | 節點 | 相異概念 | 結果 |
|---|---|---|---|---|---|
| ① | 蜂鳴器（嗶兩聲） | `tone`×2 · `tone_stop` | 21 | 8 | ✅ PASS |
| ② | **超音波 HC-SR04**（主場景） | `delay_microseconds`×2 · `pulse_read` · `math_constrain` | 48 | 16 | ✅ PASS |
| ③ | 序列埠輸入（while 成對） | `serial_count` · `serial_read` | 11 | 10 | ✅ PASS |
| ④ | 混合 | `micros` · `analog_resolution` · `math_constrain` · `tone` | 27 | 14 | ✅ PASS |

## 🔴 這一支與各膠囊 `spec.test.ts` 的分工

```
九支 spec.test.ts   這一顆自己對不對（lift／generate／round-trip／執行）
本檔                它們【一起用】會不會壞——而測的是真實場景，不是單顆片段
```

> **一顆一顆都對，不等於一段程式對——而學生寫的永遠是一段，不是一顆。**

## 三個層級，缺一條都會讓綠燈變成假的

```
① 文字不漂移   generate 兩次相同
② 結構不漂移   lift → generate → lift 的身分【陣列】相同
                ⚠️ 用陣列不用集合——同一顆出現兩次與一次是不同的樹
③ 🔴 身分正確   專屬身分在，而且沒有 func_call／method_call／raw_code
```

③ 最容易漏：**一顆降級成 `func_call` 的積木照樣產出正確的程式碼**
——文字比對全綠，而學生的畫布上是一顆通用積木。

## ⚠️ 刻意不重測的（各膠囊已釘住）

```
可選引數不得產出空逗號    tone／pulse_read
micros 低三位永遠是 0      刻意的不擬真
pulse_read 沒接東西回 0    與真板子超時一致
serial_read 沒資料回 -1    而 -1 在條件裡是真
constrain 型別跟著走        2.5 不得被夾成整數
analog_resolution 驗參數
```

重複測會讓「哪一條在守什麼」變模糊。

## 一條防「場景寫得漂亮而漏掉一顆」的

最後一支斷言九顆**全部**出現在這四段裡。沒有它的話，
一顆沒被場景用到的概念會**看起來被覆蓋了**，而實際上只有它自己的單顆測試在守。

## 分類

| 結果 | 數 |
|---|---|
| ✅ PASS | 6/6 |
| ❌ STDOUT_DIFF ／ COMPILE_FAIL ／ ROUNDTRIP_DRIFT ／ WRONG_CONCEPT | 0 |
| 🟡 DEGRADED | 0 |
| `it.todo` ／ `it.skip` | **0** |

⚠️ **沒有跑真的 g++／arduino-cli**：這一批是 Arduino 方言，
`g++` 編不動 sketch，而 `arduino-cli` 這個專案沒有接。
🔴 **所以「編得過」不在本報告的宣稱範圍內**——它由使用者在 Arduino IDE 實測
（2026-08-18 已回報 `.ino` 編得過，見 `knowledge/history/083` 的後續一節）。

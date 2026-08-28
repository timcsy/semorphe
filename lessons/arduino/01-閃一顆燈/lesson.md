# 閃一顆燈

> 讓一塊板子上的燈亮起來，然後熄掉。 · ⏱ 約 25 分鐘

## 你會學到三件事

1. Arduino 的程式**沒有 `main`**，而是 `setup` 和 `loop`
2. 一支腳位要先說「它是輸出還是輸入」
3. `delay` 讓程式**停在那裡等**

## 開始之前

⚠️ **這一課要先選板子。** 右下角的目標選 **Arduino Uno**（或你手上那一塊）。

選「Arduino」而不指定板子的話，`LED_BUILTIN` 這個名字會是未知的——
因為「板子上內建的燈接在哪一支腳」是**每塊板子各自不同的事**
（Uno 是 13 號腳，ESP32 是 2 號）。

## 一、兩個特別的函式

```cpp
void setup() {
}

void loop() {
}
```

Arduino 的程式沒有 `main`。取而代之的是兩個：

| | 什麼時候跑 |
|---|---|
| `setup()` | **開機時跑一次**——用來準備 |
| `loop()` | 跑完之後**從頭再跑一次，永遠**——用來做事 |

`void` 是上一階段學過的：**它不交出任何值**。

> **`loop` 就是一個永遠不會停的迴圈，而它是別人幫你寫好的。**
> 你只要填裡面那一段。

## 二、先說這支腳要做什麼

```cpp
void setup() {
    pinMode(LED_BUILTIN, OUTPUT);
}
```

`pinMode(哪一支腳, 做什麼)`：

| | 意思 |
|---|---|
| `OUTPUT` | 這支腳要**送電出去**（點燈、轉馬達） |
| `INPUT` | 這支腳要**讀進來**（按鈕、感測器） |

⚠️ **忘了 `pinMode` 的話，燈可能微微亮或完全不亮，而程式不會報錯。**
這是硬體最麻煩的地方：**它不當機，它只是行為不對。**

`LED_BUILTIN` 是板子幫你取好的名字，意思是「板子上那顆內建的燈」。

## 三、亮、等、暗、等

```cpp
void loop() {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(1000);
    digitalWrite(LED_BUILTIN, LOW);
    delay(1000);
}
```

| | 意思 |
|---|---|
| `digitalWrite(腳, HIGH)` | 送電出去 → **亮** |
| `digitalWrite(腳, LOW)` | 不送電 → **暗** |
| `delay(1000)` | **停在這裡 1000 毫秒**（＝ 1 秒） |

⚠️ **沒有 `delay` 的話，燈會一秒亮暗幾萬次——看起來就是一直亮著。**
不是程式錯了，是快到眼睛跟不上。

`loop` 跑完最後一行會**從第一行重來**，所以它會一直閃。

## 完成的樣子

```cpp
void setup() {
    pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(1000);
    digitalWrite(LED_BUILTIN, LOW);
    delay(1000);
}
```

## 換你了

改成「亮 0.1 秒、暗 0.9 秒」——像心跳那樣。

再試試把兩個 `delay` 都改成 `10`，看看會發生什麼。

## 這一課你做了什麼

- 你認識了 `setup`（一次）和 `loop`（一直）
- 你用 `pinMode` 說了那支腳要輸出
- 你用 `digitalWrite` ＋ `delay` 讓燈閃起來

## 如果卡住了

| 你看到 | 多半是因為 |
|---|---|
| `LED_BUILTIN` 說沒宣告 | 目標選成「Arduino」了，要選一塊**具體的板子** |
| 燈一直亮著不閃 | `delay` 太短，或忘了寫 |
| 燈完全不亮 | `setup` 裡的 `pinMode` 漏了 |
| 燈很暗 | `pinMode` 漏了——腳位在一個「半吊子」的狀態 |

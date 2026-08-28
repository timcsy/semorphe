# 按鈕

> 讓板子知道有人按了。 · ⏱ 約 30 分鐘

## 你會學到三件事

1. `digitalRead` 讀一支腳現在是高還是低
2. 為什麼**沒接東西的腳會亂跳**（浮接）
3. `INPUT_PULLUP` 一行解決它——而按下去是 `LOW`

## 開始之前

前三課的板子都在「說」。這一課它要開始「聽」。

**接線**：按鈕一腳接 **2 號腳**，另一腳接 **GND**。
（只要兩條線——不用電阻，理由在第二段。）

## 一、讀一支腳

```cpp
pinMode(2, INPUT);
int v = digitalRead(2);      // HIGH 或 LOW
```

`digitalRead` 和 `digitalWrite` 是一對：一個寫、一個讀。

## 二、⚠️ 浮接：沒接東西的腳會亂跳

問題來了：按鈕**沒按下去的時候，那支腳接到什麼？**

答案是——**什麼都沒接**。而一支什麼都沒接的腳，
會被空氣中的電磁雜訊推來推去，`digitalRead` 讀到的是**隨機的**。

這叫**浮接**（floating）。它的症狀是「**沒按也會觸發**」，
而且很難查——因為它時好時壞。

> **「沒接 ＝ 0」是一個直覺，而它是錯的。
> 沒接就是沒接，不是低電位。**

## 三、`INPUT_PULLUP` 一行解決

板子裡面內建了一顆電阻，可以把那支腳「**默默拉到高電位**」：

```cpp
pinMode(2, INPUT_PULLUP);
```

這樣一來：

| | 讀到 |
|---|---|
| **沒按** | 被內部電阻拉到 `HIGH` |
| **按下去** | 接通了 GND → `LOW` |

⚠️ **注意它是反過來的：按下去是 `LOW`，不是 `HIGH`。**

這件事違反直覺，而它是 Arduino 最常見的一個困惑點。
記法：**按鈕接的是 GND，所以按下去就通到「低」的那一邊。**

## 四、接起來

```cpp
void loop() {
    if (digitalRead(2) == LOW) {
        digitalWrite(LED_BUILTIN, HIGH);
    } else {
        digitalWrite(LED_BUILTIN, LOW);
    }
}
```

`if / else` ——和 C++ 那邊學的完全一樣。

**只是這次的條件不是變數，是現實世界。**

## 完成的樣子

```cpp
void setup() {
    pinMode(2, INPUT_PULLUP);
    pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
    if (digitalRead(2) == LOW) {
        digitalWrite(LED_BUILTIN, HIGH);
    } else {
        digitalWrite(LED_BUILTIN, LOW);
    }
}
```

## 換你了

改成「**按一下切換**」——按下去燈亮，再按一下燈滅。

⚠️ 這比想像的難。直接寫的話，按住一秒 = `loop` 跑了幾萬次 =
切換了幾萬次。你需要記住「上一次的狀態」，只在**它從沒按變成按**的
那一瞬間切換。

（做不出來沒關係——第 10 課會再處理「狀態」這件事。）

## 這一課你做了什麼

- 你用 `digitalRead` 讀了一支腳
- 你知道浮接是什麼，以及為什麼它的症狀時好時壞
- 你用 `INPUT_PULLUP` 解決了它，而代價是按下去變成 `LOW`

## 如果卡住了

| 你看到 | 多半是因為 |
|---|---|
| 沒按也會亮 | 用了 `INPUT` 而不是 `INPUT_PULLUP`——那是浮接 |
| 反了：不按才亮 | `INPUT_PULLUP` 下按下去是 `LOW`。條件要用 `== LOW` |
| 完全沒反應 | 按鈕另一腳沒接到 GND |
| 有時候會抖一下 | 那是**彈跳**——機械接點在接通瞬間會抖好幾次 |

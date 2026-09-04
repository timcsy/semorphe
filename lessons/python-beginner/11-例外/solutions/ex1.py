while True:
    try:
        n = int(input())
        break
    except ValueError:
        print("那不是數字")
print("收到", n)

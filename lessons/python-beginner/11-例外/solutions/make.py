while True:
    try:
        n = int(input())
        break
    except ValueError:
        print("那不是整數，再試一次")
print(n * 2)

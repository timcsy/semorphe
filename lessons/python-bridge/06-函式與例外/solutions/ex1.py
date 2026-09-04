def read_int():
    while True:
        try:
            return int(input())
        except ValueError:
            print("請重打")

print(read_int())

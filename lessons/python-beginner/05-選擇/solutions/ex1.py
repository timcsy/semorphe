year = int(input())
print(year % 4 == 0 and (year % 100 != 0 or year % 400 == 0))

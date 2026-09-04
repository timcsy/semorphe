def is_leap(year):
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)

print(is_leap(2000))
print(is_leap(1900))

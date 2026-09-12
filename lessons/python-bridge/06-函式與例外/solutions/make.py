def safe_div(a, b=1):
    try:
        return a / b
    except ZeroDivisionError:
        return "不能除以零"

print(safe_div(10, 4))
print(safe_div(10))
print(safe_div(10, 0))

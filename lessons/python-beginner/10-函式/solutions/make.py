def gcd_loop(a, b):
    while b != 0:
        t = a % b
        a = b
        b = t
    return a

def gcd_rec(a, b):
    if b == 0:
        return a
    return gcd_rec(b, a % b)

a = int(input())
b = int(input())
print(gcd_loop(a, b))
print(gcd_rec(a, b))

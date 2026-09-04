scores = {"ming": 80, "hua": 92, "wei": 71}
best = ""
for name in scores:
    if best == "" or scores[name] > scores[best]:
        best = name
print(best)

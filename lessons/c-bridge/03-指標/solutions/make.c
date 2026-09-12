void divmod(int a, int b, int *q, int *r) {
    *q = a / b;
    *r = a % b;
}

int main() {
    int q, r;
    divmod(47, 5, &q, &r);
    printf("%d\n", q);
    printf("%d\n", r);
    return 0;
}

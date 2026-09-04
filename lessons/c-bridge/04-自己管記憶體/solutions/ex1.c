int main() {
    int n;
    scanf("%d", &n);
    int *a = (int*)malloc(n * sizeof(int));
    int sum = 0;
    for (int i = 0; i < n; i++) {
        a[i] = i + 1;
        sum = sum + a[i];
    }
    printf("%d\n", sum);
    free(a);
    return 0;
}

int main() {
    char s[20] = "Semorphe";
    int n = strlen(s);
    printf("%d\n", n);
    for (int i = n - 1; i >= 0; i--) {
        printf("%c", s[i]);
    }
    printf("\n");
    return 0;
}

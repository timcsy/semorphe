int main() {
    int g[3][3];
    for (int i = 0; i < 3; i++) {
        for (int j = 0; j < 3; j++) {
            cin >> g[i][j];
        }
    }
    int best = g[0][0];
    int br = 0;
    int bc = 0;
    for (int i = 0; i < 3; i++) {
        for (int j = 0; j < 3; j++) {
            if (g[i][j] > best) {
                best = g[i][j];
                br = i;
                bc = j;
            }
        }
    }
    cout << best << endl;
    cout << br << " " << bc << endl;
    return 0;
}

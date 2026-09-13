int main() {
    int score;
    cin >> score;
    if (score >= 90) {
        cout << score << endl;
    } else if (score >= 60) {
        cout << score + 5 << endl;
    } else if (score >= 40) {
        cout << sqrt(score) * 10 << endl;
    } else {
        cout << score + 10 << endl;
    }
    return 0;
}

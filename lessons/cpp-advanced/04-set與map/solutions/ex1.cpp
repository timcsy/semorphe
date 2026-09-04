int main() {
    vector<string> ws = {"b", "a", "c", "a"};
    map<string, int> cnt;
    for (string w : ws) cnt[w] = cnt[w] + 1;
    for (auto it : cnt) cout << it.first << " " << it.second << endl;
    return 0;
}

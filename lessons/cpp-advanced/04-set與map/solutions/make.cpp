int main() {
    set<string> a;
    a.insert("ann");
    a.insert("bob");
    a.insert("cid");
    set<string> b;
    b.insert("bob");
    b.insert("dan");
    b.insert("cid");
    for (string s : a) {
        if (b.count(s) > 0) cout << s << endl;
    }
    return 0;
}

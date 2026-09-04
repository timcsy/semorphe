int ok(string s) {
    stack<char> st;
    for (char c : s) {
        if (c == '(') st.push(c);
        else {
            if (st.empty()) return 0;
            st.pop();
        }
    }
    if (st.empty()) return 1;
    return 0;
}

int main() {
    cout << ok("(())") << endl;
    cout << ok("(()") << endl;
    return 0;
}

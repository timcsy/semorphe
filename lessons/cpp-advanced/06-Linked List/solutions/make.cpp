struct Node {
    int val;
    Node* next;
};

int main() {
    Node* a = new Node();
    a->val = 1;
    Node* b = new Node();
    b->val = 2;
    Node* c = new Node();
    c->val = 3;
    a->next = b;
    b->next = c;
    c->next = nullptr;
    Node* prev = nullptr;
    Node* cur = a;
    while (cur != nullptr) {
        Node* nxt = cur->next;
        cur->next = prev;
        prev = cur;
        cur = nxt;
    }
    Node* p = prev;
    while (p != nullptr) {
        cout << p->val << endl;
        p = p->next;
    }
    return 0;
}

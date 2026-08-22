// script/ui-common.js
// 買い物リスト・ToDoで共通利用するUI部品
// トースト通知／確認・入力ダイアログ（native alert/confirm/promptの置き換え）／
// 空状態・エラー状態・ローディング表示／入力デバウンス

let toastContainer = null;
function getToastContainer() {
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    return toastContainer;
}

// alert() の代わりに使う非ブロッキングな通知
export function showToast(message, type = 'info') {
    const container = getToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast${type === 'error' ? ' toast--error' : ''}`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast--show'));
    setTimeout(() => {
        toast.classList.remove('toast--show');
        setTimeout(() => toast.remove(), 300);
    }, 2600);
}

function openDialog({ message, showInput = false, defaultValue = '', confirmLabel = 'OK', cancelLabel = 'キャンセル', danger = false }) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';

        const box = document.createElement('div');
        box.className = 'dialog-box';

        const msg = document.createElement('p');
        msg.className = 'dialog-message';
        msg.textContent = message;
        box.appendChild(msg);

        let input = null;
        if (showInput) {
            input = document.createElement('input');
            input.type = 'text';
            input.className = 'dialog-input';
            input.value = defaultValue;
            box.appendChild(input);
        }

        const actions = document.createElement('div');
        actions.className = 'dialog-actions';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'dialog-btn dialog-btn--cancel';
        cancelBtn.textContent = cancelLabel;

        const confirmBtn = document.createElement('button');
        confirmBtn.type = 'button';
        confirmBtn.className = `dialog-btn dialog-btn--confirm${danger ? ' dialog-btn--danger' : ''}`;
        confirmBtn.textContent = confirmLabel;

        function close(result) {
            overlay.classList.remove('dialog-overlay--show');
            setTimeout(() => overlay.remove(), 200);
            resolve(result);
        }

        cancelBtn.addEventListener('click', () => close(showInput ? null : false));
        confirmBtn.addEventListener('click', () => close(showInput ? (input.value.trim() || null) : true));
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close(showInput ? null : false);
        });
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); confirmBtn.click(); }
                if (e.key === 'Escape') cancelBtn.click();
            });
        }

        actions.appendChild(cancelBtn);
        actions.appendChild(confirmBtn);
        box.appendChild(actions);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('dialog-overlay--show'));
        if (input) {
            input.focus();
            input.select();
        }
    });
}

// confirm() の代わり。Promise<boolean> を返す
export function showConfirm(message, { danger = false, confirmLabel = '削除', cancelLabel = 'キャンセル' } = {}) {
    return openDialog({ message, showInput: false, danger, confirmLabel, cancelLabel });
}

// prompt() の代わり。Promise<string|null> を返す
export function showPrompt(message, defaultValue = '') {
    return openDialog({ message, showInput: true, defaultValue, confirmLabel: '保存', cancelLabel: 'キャンセル' });
}

// リストが0件のときの空状態表示
export function renderEmptyState(container, { icon = 'fa-inbox', text = '' }) {
    container.innerHTML = '';
    const wrap = document.createElement('li');
    wrap.className = 'empty-state';
    const i = document.createElement('i');
    i.className = `fa-solid ${icon}`;
    const p = document.createElement('p');
    p.textContent = text;
    wrap.appendChild(i);
    wrap.appendChild(p);
    container.appendChild(wrap);
}

// 取得失敗時のエラー表示（再読み込みボタン付き）
export function renderErrorState(container, text, onRetry) {
    container.innerHTML = '';
    const wrap = document.createElement('li');
    wrap.className = 'error-state';
    const i = document.createElement('i');
    i.className = 'fa-solid fa-wifi';
    const p = document.createElement('p');
    p.textContent = text;
    wrap.appendChild(i);
    wrap.appendChild(p);
    if (onRetry) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = '再読み込み';
        btn.addEventListener('click', onRetry);
        wrap.appendChild(btn);
    }
    container.appendChild(wrap);
}

// 初回読み込み中のスケルトン表示（空白画面を防ぐ）
export function renderLoadingSkeleton(container, count = 3) {
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const li = document.createElement('li');
        li.className = 'skeleton-item';
        container.appendChild(li);
    }
}

// 入力中の連続リクエストを間引く
export function debounce(fn, wait = 250) {
    let timer = null;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), wait);
    };
}

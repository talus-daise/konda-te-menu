import { supabase } from "./supabase-client.js";
import {
    showToast,
    showConfirm,
    showPrompt,
    renderEmptyState,
    renderErrorState,
    renderLoadingSkeleton,
    debounce
} from "./ui-common.js";

let currentType = 'vegetable';
let allTodos = [];

const TODO_TYPES = [
    { value: 'vegetable', label: '野菜室' },
    { value: 'freezer', label: '冷凍庫' },
    { value: 'fridge', label: '冷蔵庫' },
    { value: 'diary', label: '日用品' },
    { value: 'stock', label: 'ストック' },
    { value: 'other', label: 'その他' }
];

const EMPTY_MESSAGES = {
    vegetable: '野菜室のリストは空です',
    freezer: '冷凍庫のリストは空です',
    fridge: '冷蔵庫のリストは空です',
    diary: '日用品のリストは空です',
    stock: 'ストックのリストは空です',
    other: 'その他のリストは空です'
};

async function fetchTodos() {
    supabase
        .channel("public:todos")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "todos" },
            () => {
                loadTodos();
            }
        )
        .subscribe();
    await loadTodos();
}

async function loadTodos() {
    const todoList = document.getElementById("todoList");
    if (allTodos.length === 0) {
        renderLoadingSkeleton(todoList);
    }

    let data, error;
    try {
        ({ data, error } = await supabase
            .from("todos")
            .select("*")
            .order("is_checked", { ascending: true })
            .order("id", { ascending: true }));
    } catch (err) {
        error = err;
    }

    if (error) {
        console.error("Error fetching todos:", error);
        renderErrorState(todoList, "買い物リストを読み込めませんでした", loadTodos);
        return;
    }

    allTodos = data;
    renderList();
    updateTypeBadges();
    updateSummary();
    window.dispatchEvent(new CustomEvent("todos:updated", {
        detail: { unchecked: allTodos.filter(t => !t.is_checked).length }
    }));
}

function renderList() {
    const todoList = document.getElementById("todoList");
    todoList.innerHTML = "";

    const filtered = allTodos.filter(todo => todo.type === currentType);

    if (filtered.length === 0) {
        renderEmptyState(todoList, { icon: 'fa-basket-shopping', text: EMPTY_MESSAGES[currentType] || 'リストは空です' });
        return;
    }

    filtered.forEach((todo) => {
        const li = document.createElement("li");
        li.style.display = "flex";
        li.style.alignItems = "center";
        li.style.gap = "0.5em";
        li.style.cursor = "pointer";
        li.style.textDecoration = todo.is_checked ? "line-through" : "none";
        li.style.opacity = todo.is_checked ? 0.5 : 1;
        li.draggable = true;
        li.dataset.todoId = todo.id;

        // ドラッグ処理（カテゴリタブへドロップして種別変更）
        li.addEventListener("dragstart", e => {
            e.dataTransfer.setData("application/todo-id", todo.id);
            e.dataTransfer.setData("application/todo-type", todo.type);
            li.style.opacity = 0.5;
        });
        li.addEventListener("dragend", () => {
            li.style.opacity = todo.is_checked ? 0.5 : 1;
        });

        // チェックアイコン
        const icon = document.createElement("i");
        icon.className = todo.is_checked ? "fa-solid fa-check-circle" : "fa-regular fa-circle";
        icon.style.color = todo.is_checked ? "#26a69a" : "#bdbdbd";
        li.appendChild(icon);

        // タスク名
        const span = document.createElement("span");
        span.textContent = todo.task;
        li.appendChild(span);

        // メニューボタン︙
        const menuBtn = document.createElement("button");
        menuBtn.textContent = "︙";
        menuBtn.style.marginLeft = "auto";
        menuBtn.style.border = "none";
        menuBtn.style.background = "transparent";
        menuBtn.style.cursor = "pointer";
        menuBtn.style.fontSize = "1.2em";
        menuBtn.style.color = "#666";
        menuBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            showTodoMenu(todo, menuBtn);
        });
        li.appendChild(menuBtn);

        // クリックでチェック切替
        li.addEventListener("click", async () => {
            await toggleTodoChecked(todo);
        });

        todoList.appendChild(li);
    });
}

// メニュー表示関数（編集・削除は独自ダイアログを使用）
function showTodoMenu(todo, anchor) {
    const existing = document.getElementById("todoMenu");
    if (existing) existing.remove();

    const menu = document.createElement("div");
    menu.id = "todoMenu";
    menu.style.position = "absolute";
    menu.style.background = "#fff";
    menu.style.border = "1px solid #ccc";
    menu.style.padding = "0.5em";
    menu.style.borderRadius = "0.25em";
    menu.style.boxShadow = "0 2px 5px rgba(0,0,0,0.2)";
    menu.style.zIndex = 1000;

    const rect = anchor.getBoundingClientRect();
    menu.style.top = `${rect.bottom + window.scrollY}px`;
    menu.style.left = `${rect.left + window.scrollX}px`;

    const editBtn = document.createElement("button");
    editBtn.textContent = "編集";
    editBtn.style.display = "block";
    editBtn.style.marginBottom = "0.25em";
    editBtn.style.border = "none";
    editBtn.style.background = "transparent";
    editBtn.style.cursor = "pointer";
    editBtn.addEventListener("click", async () => {
        menu.remove();
        const newTask = await showPrompt("タスク内容を編集", todo.task);
        if (newTask && newTask.trim() !== "") {
            const { error } = await supabase.from("todos").update({ task: newTask.trim() }).eq("id", todo.id);
            if (error) {
                showToast("更新に失敗しました: " + error.message, "error");
            }
            loadTodos();
        }
    });
    menu.appendChild(editBtn);

    const delBtn = document.createElement("button");
    delBtn.textContent = "削除";
    delBtn.style.color = "red";
    delBtn.style.display = "block";
    delBtn.style.border = "none";
    delBtn.style.background = "transparent";
    delBtn.style.cursor = "pointer";
    delBtn.addEventListener("click", async () => {
        menu.remove();
        const ok = await showConfirm(`「${todo.task}」を削除しますか？`, { confirmLabel: "削除", danger: true });
        if (ok) {
            const { error } = await supabase.from("todos").delete().eq("id", todo.id);
            if (error) {
                showToast("削除に失敗しました: " + error.message, "error");
            } else {
                showToast("削除しました");
            }
            loadTodos();
        }
    });
    menu.appendChild(delBtn);

    document.body.appendChild(menu);

    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener("click", closeMenu);
        }
    };
    document.addEventListener("click", closeMenu);
}

function setupTypeTabs() {
    const tabs = document.getElementById("todoTypeTabs");
    tabs.innerHTML = "";
    TODO_TYPES.forEach(type => {
        const btn = document.createElement("button");
        btn.style.padding = "0.5em 1em";
        btn.style.border = "none";
        btn.style.borderRadius = "0.5em";
        btn.style.background = currentType === type.value ? "var(--color-primary)" : "#eee";
        btn.style.color = currentType === type.value ? "#fff" : "#333";
        btn.style.cursor = "pointer";
        btn.style.fontWeight = currentType === type.value ? "700" : "400";
        btn.style.position = "relative";

        const label = document.createElement("span");
        label.textContent = type.label;
        btn.appendChild(label);

        // カテゴリごとの未購入件数バッジ
        const badge = document.createElement("span");
        badge.className = "type-tab__badge";
        badge.dataset.badgeFor = type.value;
        btn.appendChild(badge);

        btn.ondragover = e => { e.preventDefault(); btn.style.background = "#b2dfdb"; };
        btn.ondragleave = () => { btn.style.background = currentType === type.value ? "var(--color-primary)" : "#eee"; };
        btn.ondrop = async e => {
            e.preventDefault();
            btn.style.background = currentType === type.value ? "var(--color-primary)" : "#eee";
            const todoId = e.dataTransfer.getData("application/todo-id");
            const fromType = e.dataTransfer.getData("application/todo-type");
            if (!todoId || fromType === type.value) return;
            const { error } = await supabase.from("todos").update({ type: type.value }).eq("id", todoId);
            if (error) {
                showToast("移動に失敗しました: " + error.message, "error");
            } else {
                showToast(`「${type.label}」に移動しました`);
            }
            loadTodos();
        };
        btn.addEventListener("click", () => {
            currentType = type.value;
            setupTypeTabs();
            // タブ切替は再フェッチせず、取得済みデータをその場で絞り込んで即表示
            renderList();
            updateSummary();
        });
        tabs.appendChild(btn);
    });
    updateTypeBadges();
}

function updateTypeBadges() {
    TODO_TYPES.forEach(type => {
        const count = allTodos.filter(t => t.type === type.value && !t.is_checked).length;
        const badge = document.querySelector(`.type-tab__badge[data-badge-for="${type.value}"]`);
        if (badge) {
            badge.textContent = count > 0 ? String(count) : "";
            badge.style.display = count > 0 ? "inline-block" : "none";
        }
    });
}

function updateSummary() {
    const el = document.getElementById("todoSummary");
    if (!el) return;
    const unchecked = allTodos.filter(t => t.type === currentType && !t.is_checked).length;
    el.textContent = unchecked > 0 ? `未購入 ${unchecked} 件` : "すべて購入済みです";
}

async function toggleTodoChecked(todo) {
    const { error } = await supabase
        .from("todos")
        .update({ is_checked: !todo.is_checked })
        .eq("id", todo.id);

    loadTodos();
    if (error) {
        showToast("更新に失敗しました: " + error.message, "error");
    }
}

// 追加処理を共通化（フォーム送信・候補タップの両方から呼ぶ）
async function addOrToggleTask(task, type) {
    const { data: existing, error } = await supabase
        .from("todos")
        .select("*")
        .eq("task", task)
        .eq("type", type)
        .limit(1);
    if (error) {
        showToast("検索エラー: " + error.message, "error");
        return;
    }
    if (existing && existing.length > 0) {
        await toggleTodoChecked(existing[0]);
        return;
    }
    const { error: insertError } = await supabase
        .from("todos")
        .insert([{ task, is_checked: false, type }]);
    if (insertError) {
        showToast("追加に失敗しました: " + insertError.message, "error");
    }
}

async function fetchCandidates(task) {
    if (!task) return [];
    const { data, error } = await supabase
        .from("todos")
        .select("task, is_checked, type")
        .ilike("task", `%${task}%`)
        .order("id", { ascending: false });
    if (error) {
        console.error("候補取得エラー:", error);
        return [];
    }
    const seen = new Set();
    return data.filter(x => {
        const key = `${x.task}__${x.type}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function showCandidates(candidates) {
    const candidateDiv = document.getElementById("todoCandidates");
    candidateDiv.innerHTML = "";
    if (candidates.length === 0) return;
    const label = document.createElement("div");
    label.textContent = "候補（タップで即追加）:";
    label.style.fontSize = "0.85em";
    label.style.color = "#999";
    label.style.marginBottom = "0.3em";
    candidateDiv.appendChild(label);
    candidates.forEach(c => {
        const btn = document.createElement("button");
        const typeLabel = TODO_TYPES.find(t => t.value === c.type)?.label || c.type;
        btn.textContent = `${c.task}（${typeLabel}）`;
        btn.style.margin = "0 0.5em 0.5em 0";
        btn.addEventListener("click", async () => {
            await addOrToggleTask(c.task, c.type);
            document.getElementById("todoInput").value = "";
            candidateDiv.innerHTML = "";
            loadTodos();
        });
        candidateDiv.appendChild(btn);
    });
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const input = document.getElementById("todoInput");
    const typeSel = document.getElementById("todoType");
    const value = input.value.trim();
    const type = typeSel.value;
    if (!value) return;
    const tasks = value.split(/\s+/).filter(Boolean);
    for (const task of tasks) {
        await addOrToggleTask(task, type);
    }
    input.value = "";
    document.getElementById("todoCandidates").innerHTML = "";
    // realtime通知を待たず即座に画面へ反映
    loadTodos();
}

async function handleClearChecked() {
    const targets = allTodos.filter(t => t.type === currentType && t.is_checked);
    if (targets.length === 0) {
        showToast("購入済みの項目はありません");
        return;
    }
    const ok = await showConfirm(`購入済みの${targets.length}件を削除しますか？`, { confirmLabel: "削除", danger: true });
    if (!ok) return;
    const { error } = await supabase.from("todos").delete().eq("type", currentType).eq("is_checked", true);
    if (error) {
        showToast("削除に失敗しました: " + error.message, "error");
        return;
    }
    showToast(`${targets.length}件削除しました`);
    loadTodos();
}

function setupFormAndCandidates() {
    const form = document.getElementById("todoForm");
    const input = document.getElementById("todoInput");
    form.addEventListener("submit", handleFormSubmit);

    const debouncedSearch = debounce(async () => {
        const value = input.value.trim();
        const candidates = await fetchCandidates(value);
        showCandidates(candidates);
    }, 250);

    input.addEventListener("input", () => {
        if (!input.value.trim()) {
            document.getElementById("todoCandidates").innerHTML = "";
            return;
        }
        debouncedSearch();
    });

    const clearBtn = document.getElementById("todoClearChecked");
    if (clearBtn) clearBtn.addEventListener("click", handleClearChecked);
}

document.addEventListener("DOMContentLoaded", () => {
    setupTypeTabs();
    fetchTodos();
    setupFormAndCandidates();
});

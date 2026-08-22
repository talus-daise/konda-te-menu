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

let allTodos = [];

async function fetchTodos() {
    supabase
        .channel("public:todos2")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "todos2" },
            () => {
                loadTodos();
            }
        )
        .subscribe();
    await loadTodos();
}

async function loadTodos() {
    const todoList = document.getElementById("todo2List");
    if (allTodos.length === 0) {
        renderLoadingSkeleton(todoList);
    }

    let data, error;
    try {
        ({ data, error } = await supabase
            .from("todos2")
            .select("*")
            .order("is_checked", { ascending: true })
            .order("id", { ascending: true }));
    } catch (err) {
        error = err;
    }

    if (error) {
        console.error("Error fetching todos:", error);
        renderErrorState(todoList, "ToDoを読み込めませんでした", loadTodos);
        return;
    }

    allTodos = data;
    renderList();
    updateSummary();
    window.dispatchEvent(new CustomEvent("todos2:updated", {
        detail: { unchecked: allTodos.filter(t => !t.is_checked).length }
    }));
}

function renderList() {
    const todoList = document.getElementById("todo2List");
    todoList.innerHTML = "";

    if (allTodos.length === 0) {
        renderEmptyState(todoList, { icon: 'fa-clipboard-list', text: 'ToDoはまだありません' });
        return;
    }

    allTodos.forEach((todo) => {
        const li = document.createElement("li");
        li.style.display = "flex";
        li.style.alignItems = "center";
        li.style.gap = "0.5em";
        li.style.cursor = "pointer";
        li.style.textDecoration = todo.is_checked ? "line-through" : "none";
        li.style.opacity = todo.is_checked ? 0.5 : 1;
        li.dataset.todoId = todo.id;

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
    const existing = document.getElementById("todo2Menu");
    if (existing) existing.remove();

    const menu = document.createElement("div");
    menu.id = "todo2Menu";
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
            const { error } = await supabase.from("todos2").update({ task: newTask.trim() }).eq("id", todo.id);
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
            const { error } = await supabase.from("todos2").delete().eq("id", todo.id);
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

function updateSummary() {
    const el = document.getElementById("todo2Summary");
    if (!el) return;
    const unchecked = allTodos.filter(t => !t.is_checked).length;
    el.textContent = unchecked > 0 ? `未完了 ${unchecked} 件` : "すべて完了しています";
}

async function toggleTodoChecked(todo) {
    const { error } = await supabase
        .from("todos2")
        .update({ is_checked: !todo.is_checked })
        .eq("id", todo.id);

    loadTodos();
    if (error) {
        showToast("更新に失敗しました: " + error.message, "error");
    }
}

// 追加処理を共通化（フォーム送信・候補タップの両方から呼ぶ）
async function addOrToggleTask(task) {
    const { data: existing, error } = await supabase
        .from("todos2")
        .select("*")
        .eq("task", task)
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
        .from("todos2")
        .insert([{ task, is_checked: false }]);
    if (insertError) {
        showToast("追加に失敗しました: " + insertError.message, "error");
    }
}

async function fetchCandidates(task) {
    if (!task) return [];
    const { data, error } = await supabase
        .from("todos2")
        .select("task, is_checked")
        .ilike("task", `%${task}%`)
        .order("id", { ascending: false });
    if (error) {
        console.error("候補取得エラー:", error);
        return [];
    }
    const seen = new Set();
    return data.filter(x => {
        if (seen.has(x.task)) return false;
        seen.add(x.task);
        return true;
    });
}

function showCandidates(candidates) {
    const candidateDiv = document.getElementById("todo2Candidates");
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
        btn.textContent = c.task;
        btn.style.margin = "0 0.5em 0.5em 0";
        btn.addEventListener("click", async () => {
            await addOrToggleTask(c.task);
            document.getElementById("todo2Input").value = "";
            candidateDiv.innerHTML = "";
            loadTodos();
        });
        candidateDiv.appendChild(btn);
    });
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const input = document.getElementById("todo2Input");
    const value = input.value.trim();
    if (!value) return;
    const tasks = value.split(/\s+/).filter(Boolean);
    for (const task of tasks) {
        await addOrToggleTask(task);
    }
    input.value = "";
    document.getElementById("todo2Candidates").innerHTML = "";
    // realtime通知を待たず即座に画面へ反映
    loadTodos();
}

async function handleClearChecked() {
    const targets = allTodos.filter(t => t.is_checked);
    if (targets.length === 0) {
        showToast("完了済みの項目はありません");
        return;
    }
    const ok = await showConfirm(`完了済みの${targets.length}件を削除しますか？`, { confirmLabel: "削除", danger: true });
    if (!ok) return;
    const { error } = await supabase.from("todos2").delete().eq("is_checked", true);
    if (error) {
        showToast("削除に失敗しました: " + error.message, "error");
        return;
    }
    showToast(`${targets.length}件削除しました`);
    loadTodos();
}

function setupFormAndCandidates() {
    const form = document.getElementById("todo2Form");
    const input = document.getElementById("todo2Input");
    form.addEventListener("submit", handleFormSubmit);

    const debouncedSearch = debounce(async () => {
        const value = input.value.trim();
        const candidates = await fetchCandidates(value);
        showCandidates(candidates);
    }, 250);

    input.addEventListener("input", () => {
        if (!input.value.trim()) {
            document.getElementById("todo2Candidates").innerHTML = "";
            return;
        }
        debouncedSearch();
    });

    const clearBtn = document.getElementById("todo2ClearChecked");
    if (clearBtn) clearBtn.addEventListener("click", handleClearChecked);
}

document.addEventListener("DOMContentLoaded", () => {
    fetchTodos();
    setupFormAndCandidates();
});

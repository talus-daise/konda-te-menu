import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
    "https://nnfvwpzwvscfpyrrsygt.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZnZ3cHp3dnNjZnB5cnJzeWd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNjgzMjIsImV4cCI6MjA4NTc0NDMyMn0.wqeKyvXjVKK8oo5CD09L8FvEH3H7rs2Xit-H4FG1HSc"
);

async function fetchTodos() {
    const channel = supabase
        .channel("public:todos")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "todos" },
            (payload) => {
                console.log("Change received!", payload);
                loadTodos();
            }
        )
        .subscribe();
    console.log("Subscribed to channel:", channel);
    await loadTodos();
}

let currentType = 'work';
const TODO_TYPES = [
    { value: 'vegetable', label: '野菜室' },
    { value: 'freezer', label: '冷凍庫' },
    { value: 'fridge', label: '冷蔵庫' },
    { value: 'diary', label: '日用品' },
    { value: 'stock', label: 'ストック' },
    { value: 'other', label: 'その他' }
];

async function loadTodos() {
    const { data, error } = await supabase.from("todos").select("*").order("task", { ascending: true });
    if (error) {
        console.error("Error fetching todos:", error);
        return;
    }
    const todoList = document.getElementById("todoList");
    todoList.innerHTML = "";
    const filtered = data.filter(todo => todo.type === currentType);
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
        li.addEventListener("dragstart", e => {
            e.dataTransfer.setData("application/todo-id", todo.id);
            e.dataTransfer.setData("application/todo-type", todo.type);
            li.style.opacity = 0.5;
        });
        li.addEventListener("dragend", e => {
            li.style.opacity = todo.is_checked ? 0.5 : 1;
        });

        // チェックアイコン
        const icon = document.createElement("i");
        if (todo.is_checked) {
            icon.className = "fa-solid fa-check-circle";
            icon.style.color = "#26a69a";
        } else {
            icon.className = "fa-regular fa-circle";
            icon.style.color = "#bdbdbd";
        }
        li.appendChild(icon);

        // タスク名
        const span = document.createElement("span");
        span.textContent = todo.task;
        li.appendChild(span);

        li.addEventListener("click", async () => {
            await toggleTodoChecked(todo);
        });
        todoList.appendChild(li);
    });
}

function setupTypeTabs() {
    const tabs = document.getElementById("todoTypeTabs");
    tabs.innerHTML = "";
    TODO_TYPES.forEach(type => {
        const btn = document.createElement("button");
        btn.textContent = type.label;
        btn.style.padding = "0.5em 1em";
        btn.style.border = "none";
        btn.style.borderRadius = "0.5em";
        btn.style.background = currentType === type.value ? "var(--color-primary)" : "#eee";
        btn.style.color = currentType === type.value ? "#fff" : "#333";
        btn.style.cursor = "pointer";
        btn.style.fontWeight = currentType === type.value ? "700" : "400";
        btn.ondragover = e => { e.preventDefault(); btn.style.background = "#b2dfdb"; };
        btn.ondragleave = e => { btn.style.background = currentType === type.value ? "var(--color-primary)" : "#eee"; };
        btn.ondrop = async e => {
            e.preventDefault();
            btn.style.background = currentType === type.value ? "var(--color-primary)" : "#eee";
            const todoId = e.dataTransfer.getData("application/todo-id");
            const fromType = e.dataTransfer.getData("application/todo-type");
            if (!todoId || fromType === type.value) return;
            // type変更
            await supabase.from("todos").update({ type: type.value }).eq("id", todoId);
            loadTodos();
        };
        btn.addEventListener("click", () => {
            currentType = type.value;
            setupTypeTabs();
            loadTodos();
        });
        tabs.appendChild(btn);
    });
}

async function toggleTodoChecked(todo) {
    const { error } = await supabase
        .from("todos")
        .update({ is_checked: !todo.is_checked })
        .eq("id", todo.id);
    if (error) {
        alert("トグルに失敗しました: " + error.message);
    }
}

async function fetchCandidates(task) {
    if (!task) return [];
    const { data, error } = await supabase
        .from("todos")
        .select("task, is_checked")
        .ilike("task", `%${task}%`)
        .order("id", { ascending: false });
    if (error) {
        console.error("候補取得エラー:", error);
        return [];
    }
    // 重複排除
    const seen = new Set();
    return data.filter(x => {
        if (seen.has(x.task)) return false;
        seen.add(x.task);
        return true;
    });
}

function showCandidates(candidates, inputValue) {
    const candidateDiv = document.getElementById("todoCandidates");
    candidateDiv.innerHTML = "";
    if (candidates.length === 0) return;
    const label = document.createElement("div");
    label.textContent = "候補:";
    candidateDiv.appendChild(label);
    candidates.forEach(c => {
        const btn = document.createElement("button");
        btn.textContent = c.task;
        btn.style.margin = "0 0.5em 0.5em 0";
        btn.addEventListener("click", () => {
            document.getElementById("todoInput").value = c.task;
            document.getElementById("todoInput").focus();
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
        // 同名ToDoがあるかチェック
        const { data: existing, error } = await supabase
            .from("todos")
            .select("*")
            .eq("task", task)
            .eq("type", type)
            .limit(1);
        if (error) {
            alert("検索エラー: " + error.message);
            continue;
        }
        if (existing && existing.length > 0) {
            // 既存ToDoのis_checkedをトグル
            await toggleTodoChecked(existing[0]);
            continue;
        }
        // 新規追加
        const { error: insertError } = await supabase
            .from("todos")
            .insert([{ task, is_checked: false, type }]);
        if (insertError) {
            alert("追加失敗: " + insertError.message);
        }
    }
    input.value = "";
}

function setupFormAndCandidates() {
    const form = document.getElementById("todoForm");
    const input = document.getElementById("todoInput");
    form.addEventListener("submit", handleFormSubmit);
    let lastValue = "";
    input.addEventListener("input", async () => {
        const value = input.value.trim();
        if (value === lastValue) return;
        lastValue = value;
        const candidates = await fetchCandidates(value);
        showCandidates(candidates, value);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    setupTypeTabs();
    fetchTodos();
    setupFormAndCandidates();
});
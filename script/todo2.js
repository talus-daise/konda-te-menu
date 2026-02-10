import { supabase } from "./supabase-client.js";

async function fetchTodos() {
    const channel = supabase
        .channel("public:todos")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "todos2" },
            (payload) => {
                console.log("Change received!", payload);
                loadTodos();
            }
        )
        .subscribe();
    console.log("Subscribed to channel:", channel);
    await loadTodos();
}

async function loadTodos() {
    const { data, error } = await supabase
        .from("todos2")
        .select("*")
        .order("is_checked", { ascending: true })
        .order("task", { ascending: true });

    if (error) {
        console.error("Error fetching todos:", error);
        return;
    }

    const todoList = document.getElementById("todoList");
    todoList.innerHTML = "";

    const filtered = data;

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

        // ドラッグ処理
        li.addEventListener("dragstart", e => {
            e.dataTransfer.setData("application/todo2-id", todo.id);
            li.style.opacity = 0.5;
        });
        li.addEventListener("dragend", e => {
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
        menuBtn.style.textDecoration = "none";
        menuBtn.addEventListener("click", (e) => {
            e.stopPropagation(); // li のクリックイベントを阻止
            showTodoMenu(todo, menuBtn);
        });
        li.appendChild(menuBtn);

        // Todoクリックでチェック切替
        li.addEventListener("click", async () => {
            await toggleTodoChecked(todo);
        });

        todoList.appendChild(li);
    });
}

// メニュー表示関数
function showTodoMenu(todo, anchor) {
    // 既存メニュー削除
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

    // 位置をアンカーの横に
    const rect = anchor.getBoundingClientRect();
    menu.style.top = `${rect.bottom + window.scrollY}px`;
    menu.style.left = `${rect.left + window.scrollX}px`;

    // 編集ボタン
    const editBtn = document.createElement("button");
    editBtn.textContent = "編集";
    editBtn.style.display = "block";
    editBtn.style.marginBottom = "0.25em";
    editBtn.style.border = "none";
    editBtn.style.background = "transparent";
    editBtn.style.cursor = "pointer";
    editBtn.addEventListener("click", async () => {
        const newTask = prompt("タスク内容を編集:", todo.task);
        if (newTask && newTask.trim() !== "") {
            await supabase.from("todos2").update({ task: newTask.trim() }).eq("id", todo.id);
            loadTodos();
        }
        menu.remove();
    });
    menu.appendChild(editBtn);

    // 削除ボタン
    const delBtn = document.createElement("button");
    delBtn.textContent = "削除";
    delBtn.style.color = "red";
    delBtn.style.display = "block";
    delBtn.style.border = "none";
    delBtn.style.background = "transparent";
    delBtn.style.cursor = "pointer";
    delBtn.addEventListener("click", async () => {
        if (confirm("本当に削除しますか？")) {
            await supabase.from("todos2").delete().eq("id", todo.id);
            loadTodos();
        }
        menu.remove();
    });
    menu.appendChild(delBtn);

    document.body.appendChild(menu);

    // クリックでメニュー閉じる
    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener("click", closeMenu);
        }
    };
    document.addEventListener("click", closeMenu);
}

async function toggleTodoChecked(todo) {
    const { error } = await supabase
        .from("todos2")
        .update({ is_checked: !todo.is_checked })
        .eq("id", todo.id);

    loadTodos();
    if (error) {
        alert("トグルに失敗しました: " + error.message);
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
    // 重複排除
    const seen = new Set();
    return data.filter(x => {
        if (seen.has(x.task)) return false;
        seen.add(x.task);
        return true;
    });
}

function showCandidates(candidates, inputValue) {
    const candidateDiv = document.getElementById("todo2Candidates");
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
            document.getElementById("todo2Input").value = c.task;
            document.getElementById("todo2Input").focus();
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
        // 同名ToDoがあるかチェック
        const { data: existing, error } = await supabase
            .from("todos2")
            .select("*")
            .eq("task", task)
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
            .from("todos2")
        if (insertError) {
            alert("追加失敗: " + insertError.message);
        }
    }
    input.value = "";
}

function setupFormAndCandidates() {
    const form = document.getElementById("todo2Form");
    const input = document.getElementById("todo2Input");
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
    fetchTodos();
    setupFormAndCandidates();
});
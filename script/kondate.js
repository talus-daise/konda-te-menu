// --- 献立カード一覧の表示・D&D ---
document.addEventListener('DOMContentLoaded', async function () {
    const cardList = document.getElementById('kondateCardList');
    if (!cardList) return;
    // 献立一覧取得
    let kondateList = [];
    try {
        kondateList = await fetchKondateList();
    } catch (e) {
        cardList.innerHTML = '<div style="color:red">献立一覧の取得に失敗しました</div>';
        return;
    }
    cardList.innerHTML = '';
    kondateList.forEach(item => {
        const card = document.createElement('div');
        card.className = 'kondate-card';
        card.draggable = true;
        card.style.background = 'var(--color-card)';
        card.style.border = '1px solid var(--color-border)';
        card.style.borderRadius = '0.7em';
        card.style.boxShadow = 'var(--color-shadow)';
        card.style.marginBottom = '1em';
        card.style.padding = '1em';
        card.style.cursor = 'grab';
        card.style.userSelect = 'none';
        card.style.transition = 'box-shadow 0.2s';
        card.innerHTML = `<div style="font-weight:700;font-size:1.1em;">${item.title}</div><div style="font-size:0.95em;color:var(--color-text);margin-top:0.3em;">${item.desc || ''}</div>`;
        card.addEventListener('dragstart', e => {
            e.dataTransfer.setData('application/kondate-list-id', item.id);
            card.style.opacity = 0.5;
        });
        card.addEventListener('dragend', e => {
            card.style.opacity = 1;
        });
        cardList.appendChild(card);
    });

    // メニューセルにD&Dでid保存
    const menuList = document.getElementById('menu-list');
    if (!menuList) return;
    menuList.querySelectorAll('.main__menu-list__item').forEach(cell => {
        // 献立タイトルセル以外のみ
        if (cell.querySelector('p')) {
            cell.ondragover = e => { e.preventDefault(); cell.style.background = 'var(--color-primary)'; cell.style.color = '#fff'; };
            cell.ondragleave = e => { cell.style.background = ''; cell.style.color = ''; };
            cell.ondrop = async e => {
                e.preventDefault();
                cell.style.background = '';
                cell.style.color = '';
                const id = e.dataTransfer.getData('application/kondate-list-id');
                if (!id) return;
                // どのrow, dayか特定
                const rowDiv = cell.parentElement;
                const rowNum = rowDiv?.dataset?.rowNum;
                const dayIdx = Array.from(rowDiv.children).indexOf(cell) - 1; // 0:タイトル, 1~6:曜日
                const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'weekend'];
                const dayKey = dayKeys[dayIdx];
                if (rowNum !== undefined && dayKey) {
                    // rowNum: 0=main, 1=sub, 2=other
                    const kondateRows = await fetchKondateRows();
                    const row = kondateRows.find(r => r.name === (['main', 'sub', 'other'][rowNum]));
                    if (row) {
                        await updateKondateCell(row.id, dayKey, parseInt(id));
                        // UI反映（タイトル表示）
                        cell.innerHTML = `<p>${kondateList.find(k => k.id == id)?.title || ''}</p>`;
                    }
                }
            };
        }
    });

    setCellClickEvent();
});
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Supabase初期化
const supabase = createClient(
    "https://nnfvwpzwvscfpyrrsygt.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZnZ3cHp3dnNjZnB5cnJzeWd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNjgzMjIsImV4cCI6MjA4NTc0NDMyMn0.wqeKyvXjVKK8oo5CD09L8FvEH3H7rs2Xit-H4FG1HSc"
);

// kondate_list CRUD
export async function fetchKondateList() {
    const { data, error } = await supabase.from("kondate_list").select("*").order("id", { ascending: true });
    if (error) throw error;
    return data;
}

export async function addKondateList({ title, desc, ingredient }) {
    const { data, error } = await supabase.from("kondate_list").insert([{ title, desc, ingredient }]).select();
    if (error) throw error;
    return data[0];
}

export async function updateKondateList(id, { title, desc, ingredient }) {
    const { data, error } = await supabase.from("kondate_list").update({ title, desc, ingredient }).eq("id", id).select();
    if (error) throw error;
    return data[0];
}

export async function deleteKondateList(id) {
    const { error } = await supabase.from("kondate_list").delete().eq("id", id);
    if (error) throw error;
}

// kondate取得・更新
export async function fetchKondateRows() {
    const { data, error } = await supabase.from("kondate").select("*");
    if (error) throw error;
    return data;
}

export async function updateKondateCell(rowId, dayKey, kondateListId) {
    // dayKey: 'monday'~'weekend', kondateListId: 数値 or null
    const { data, error } = await supabase.from("kondate").update({ [dayKey]: kondateListId }).eq("id", rowId).select();
    if (error) throw error;
    return data[0];
}

export async function setCellClickEvent() {
    const menuList = document.getElementById('menu-list');
    const overlay = document.getElementById('kondateDetailOverlay');
    const content = document.getElementById('kondateDetailContent');
    const closeBtn = document.getElementById('closeKondateDetailBtn');
    if (!menuList || !overlay || !content || !closeBtn) return;
    // 献立リストキャッシュ
    let kondateList = [];
    try { kondateList = await fetchKondateList(); } catch { }
    // メニューセル
    menuList.querySelectorAll('.main__menu-list__item').forEach(cell => {
        console.log('cell found');
        if (cell.hasChildNodes() && cell.querySelector('p')) {
            cell.addEventListener('click', async () => {
                console.log('cell clicked');
                const title = cell.textContent.trim();
                if (!title) return;
                // id特定
                const rowDiv = cell.parentElement;
                const rowNum = rowDiv?.dataset?.rowNum;
                const dayIdx = Array.from(rowDiv.children).indexOf(cell) - 1;
                const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'weekend'];
                const dayKey = dayKeys[dayIdx];
                if (rowNum !== undefined && dayKey) {
                    const kondateRows = await fetchKondateRows();
                    const row = kondateRows.find(r => r.name === (['main', 'sub', 'other'][rowNum]));
                    if (row && row[dayKey]) {
                        const k = kondateList.find(x => x.id == row[dayKey]);
                        if (k) {
                            content.innerHTML = `<h2 style='margin-top:0;'>${k.title}</h2><div style='margin-bottom:1em;'>${k.desc || ''}</div><div><b>材料:</b><ul>${(Array.isArray(k.ingredient) ? k.ingredient : JSON.parse(k.ingredient || '[]')).map(i => `<li>${i}</li>`).join('')}</ul></div>`;
                            overlay.style.display = 'flex';
                        }
                    }
                }
            });
        }
    });
    closeBtn.addEventListener('click', () => { overlay.style.display = 'none'; });
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.style.display = 'none'; });
}
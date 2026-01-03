// admin.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc, orderBy, query, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCaLWMEi7wNxeCjUQC86axbRsxLMDWQrq8",
  authDomain: "gacha-game-v1.firebaseapp.com",
  projectId: "gacha-game-v1",
  storageBucket: "gacha-game-v1.firebasestorage.app",
  messagingSenderId: "966445898558",
  appId: "1:966445898558:web:114362d9c3dc45d421aa6f",
  measurementId: "G-N0EM6EJ9BK"
};

let app, db, auth;

try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    console.log("Admin Firebase Initialized");
} catch (e) {
    console.error("Firebase Error", e);
    alert("後台資料庫連線失敗");
}

let currentUser = null;
let editingUserId = null;

const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const userListBody = document.getElementById('user-list-body');
const statusMsg = document.getElementById('status-msg');
const editModal = document.getElementById('edit-modal');

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loginSection.style.display = 'none';
        dashboardSection.style.display = 'block';
        loadAllUsers();
    } else {
        currentUser = null;
        loginSection.style.display = 'block';
        dashboardSection.style.display = 'none';
    }
});

document.getElementById('login-btn').addEventListener('click', () => {
    const email = document.getElementById('admin-email').value;
    const pass = document.getElementById('admin-pass').value;
    if(!email || !pass) return alert("請輸入帳號密碼");
    
    signInWithEmailAndPassword(auth, email, pass)
        .then(() => { console.log("登入成功"); })
        .catch((error) => { alert("登入失敗：" + error.message); });
});

document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth).then(() => location.reload());
});

document.getElementById('refresh-btn').addEventListener('click', loadAllUsers);

async function loadAllUsers() {
    statusMsg.innerText = "讀取資料中...";
    userListBody.innerHTML = "";
    try {
        const q = query(collection(db, "users"), orderBy("combatPower", "desc"));
        const querySnapshot = await getDocs(q);
        let count = 0;
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            renderUserRow(doc.id, data);
            count++;
        });
        statusMsg.innerText = `讀取完成，共 ${count} 位玩家`;
    } catch (e) {
        console.error("Load users failed:", e);
        statusMsg.innerText = "讀取失敗";
        alert("讀取失敗，請確認 Firebase Rules 或網路連線");
    }
}

function renderUserRow(uid, data) {
    const tr = document.createElement('tr');
    const shortUid = uid.substring(0, 8) + "...";
    
    // 🔥 新增 Email 欄位與刪除按鈕
    tr.innerHTML = `
        <td style="font-weight:bold; color:#fff;">${data.name || "未命名"}</td>
        <td><span class="email-tag">${data.email || "未記錄"}</span></td>
        <td><span class="uid-tag" title="${uid}">${shortUid}</span></td>
        <td class="res-gold">${data.gold || 0}</td>
        <td class="res-gem">${data.gems || 0}</td>
        <td>${data.combatPower || 0}</td>
        <td style="display:flex; gap:5px;">
            <button class="btn-primary edit-btn" style="padding:5px 10px; font-size:0.8em;">✏️ 編輯</button>
            <button class="btn-danger delete-btn" style="padding:5px 10px; font-size:0.8em;">🗑️ 刪除</button>
        </td>
    `;
    
    tr.querySelector('.edit-btn').addEventListener('click', () => openEditModal(uid, data));
    
    // 🔥 刪除功能邏輯
    tr.querySelector('.delete-btn').addEventListener('click', async () => {
        const confirmMsg = `⚠️ 警告！\n\n確定要刪除玩家【${data.name}】的資料嗎？\n\n這將會清除他的金幣、鑽石與遊戲進度，但他綁定的 Firebase 帳號密碼無法透過此處刪除。\n(他將變成無法讀取檔案的幽靈人口)`;
        if(confirm(confirmMsg)) {
            try {
                await deleteDoc(doc(db, "users", uid));
                tr.remove(); // 直接從畫面移除
                alert("🗑️ 刪除成功！");
            } catch(e) {
                console.error("Delete failed:", e);
                alert("刪除失敗：" + e.message);
            }
        }
    });

    userListBody.appendChild(tr);
}

const editGoldInput = document.getElementById('edit-gold');
const editGemsInput = document.getElementById('edit-gems');
const editTargetName = document.getElementById('edit-target-name');

function openEditModal(uid, data) {
    editingUserId = uid;
    editTargetName.innerText = `正在編輯：${data.name || "未命名"}`;
    editGoldInput.value = data.gold || 0;
    editGemsInput.value = data.gems || 0;
    editModal.classList.remove('hidden');
}

document.getElementById('cancel-edit-btn').addEventListener('click', () => {
    editModal.classList.add('hidden');
    editingUserId = null;
});

document.getElementById('save-edit-btn').addEventListener('click', async () => {
    if (!editingUserId) return;
    const newGold = parseInt(editGoldInput.value);
    const newGems = parseInt(editGemsInput.value);
    if (isNaN(newGold) || newGold < 0) return alert("金幣數值不合法");
    if (isNaN(newGems) || newGems < 0) return alert("鑽石數值不合法");
    
    const btn = document.getElementById('save-edit-btn');
    btn.innerText = "儲存中...";
    btn.disabled = true;
    try {
        const userRef = doc(db, "users", editingUserId);
        await updateDoc(userRef, { gold: newGold, gems: newGems });
        alert("✅ 修改成功！");
        editModal.classList.add('hidden');
        loadAllUsers();
    } catch (e) {
        console.error("Update failed:", e);
        alert("❌ 修改失敗：" + e.message);
    } finally {
        btn.innerText = "儲存變更";
        btn.disabled = false;
    }
});

// 發送全服公告邏輯
document.getElementById('send-notif-btn').addEventListener('click', async () => {
    const title = document.getElementById('notif-title').value.trim();
    const type = document.getElementById('notif-type').value;
    const amount = parseInt(document.getElementById('notif-amount').value);

    if (!title) return alert("請輸入標題");
    if (type !== 'none' && (isNaN(amount) || amount <= 0)) return alert("請輸入正確的獎勵數量");

    if (!confirm(`確定要發送公告嗎？\n標題：${title}\n獎勵：${type === 'none' ? '無' : amount + ' ' + type}`)) return;

    const btn = document.getElementById('send-notif-btn');
    btn.innerText = "發送中...";
    btn.disabled = true;

    try {
        await addDoc(collection(db, "announcements"), {
            title: title,
            reward: { type: type, amount: amount },
            timestamp: serverTimestamp() 
        });
        alert("📢 公告發送成功！玩家重新整理或打開通知即可看到。");
        document.getElementById('notif-title').value = "";
        document.getElementById('notif-amount').value = "0";
    } catch (e) {
        console.error("Send notif failed:", e);
        alert("發送失敗：" + e.message);
    } finally {
        btn.innerText = "🚀 發送公告";
        btn.disabled = false;
    }
});
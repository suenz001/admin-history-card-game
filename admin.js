// admin.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc, orderBy, query, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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

// 🔥 Dashboard 元素
const statTotalPlayers = document.getElementById('stat-total-players');
const statNewToday = document.getElementById('stat-new-today');
const statTotalGold = document.getElementById('stat-total-gold');
const statTotalGems = document.getElementById('stat-total-gems');

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
        
        // 🔥 初始化統計數據
        let totalGold = 0;
        let totalGems = 0;
        let newPlayersCount = 0;
        let count = 0;

        // 計算今日開始的時間戳
        const todayStart = new Date();
        todayStart.setHours(0,0,0,0);

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            
            // 累加經濟數據
            totalGold += (data.gold || 0);
            totalGems += (data.gems || 0);

            // 判斷是否為今日新增
            if (data.createdAt && data.createdAt.seconds * 1000 > todayStart.getTime()) {
                newPlayersCount++;
            }

            renderUserRow(doc.id, data);
            count++;
        });

        // 🔥 更新看板 UI
        statTotalPlayers.innerText = count;
        statNewToday.innerText = newPlayersCount;
        statTotalGold.innerText = totalGold.toLocaleString();
        statTotalGems.innerText = totalGems.toLocaleString();
        
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
    
    // 處理最後登入時間
    let lastLoginStr = "尚無紀錄";
    let isInactive = false;

    if (data.lastLoginAt) {
        const loginDate = new Date(data.lastLoginAt.seconds * 1000);
        lastLoginStr = loginDate.toLocaleString();
        
        // 檢查是否超過 30 天未登入
        const diffDays = (Date.now() - loginDate.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > 30) isInactive = true;
    }

    // 格式化最後登入顯示
    const lastLoginHtml = isInactive 
        ? `<span class="date-tag" style="color:#e74c3c; font-weight:bold;">${lastLoginStr} (幽靈)</span>` 
        : `<span class="date-tag">${lastLoginStr}</span>`;

    tr.innerHTML = `
        <td style="font-weight:bold; color:#fff;">${data.name || "未命名"}</td>
        <td><span class="email-tag">${data.email || "未記錄"}</span></td>
        <td><span class="uid-tag" title="${uid}">${shortUid}</span></td>
        <td class="res-gold">${data.gold || 0}</td>
        <td class="res-gem">${data.gems || 0}</td>
        <td>${lastLoginHtml}</td> <td>${data.combatPower || 0}</td>
        <td style="display:flex; gap:5px;">
            <button class="btn-primary edit-btn" style="padding:5px 8px; font-size:0.8em;">✏️ 編輯</button>
            <button class="btn-warning reset-pwd-btn" style="padding:5px 8px; font-size:0.8em;">🔑 密碼</button>
            <button class="btn-danger delete-btn" style="padding:5px 8px; font-size:0.8em;">🗑️ 刪除</button>
        </td>
    `;
    
    tr.querySelector('.edit-btn').addEventListener('click', () => openEditModal(uid, data));
    
    tr.querySelector('.delete-btn').addEventListener('click', async () => {
        const confirmMsg = `⚠️ 警告！\n\n確定要刪除玩家【${data.name}】的遊戲資料嗎？\n這將清除他的所有進度。\n(註：此操作不會刪除 Firebase 帳號，但會清空遊戲數據)`;
        if(confirm(confirmMsg)) {
            try {
                await deleteDoc(doc(db, "users", uid));
                tr.remove(); 
                alert("🗑️ 遊戲資料刪除成功！");
            } catch(e) {
                console.error("Delete failed:", e);
                alert("刪除失敗：" + e.message);
            }
        }
    });

    tr.querySelector('.reset-pwd-btn').addEventListener('click', async () => {
        if (!data.email || data.email === "未記錄") {
            return alert("❌ 此玩家沒有記錄 Email，無法發送重設信！");
        }
        
        const confirmMsg = `📧 確定要發送「密碼重設信」給：\n${data.email} 嗎？\n\n玩家將會收到官方信件，點擊連結後即可設定新密碼。`;
        if (confirm(confirmMsg)) {
            try {
                await sendPasswordResetEmail(auth, data.email);
                alert("✅ 發送成功！請通知玩家查收信箱。");
            } catch (e) {
                console.error("Reset password failed:", e);
                alert("發送失敗：" + e.message);
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
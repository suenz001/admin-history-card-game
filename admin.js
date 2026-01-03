// admin.js
// 這裡我們使用 CDN 網址引入，這樣您不需要安裝 node.js 環境也能直接在瀏覽器執行
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, updateDoc, orderBy, query } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// 🔥 這裡是關鍵：這就是您貼上的設定資料
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

// 初始化 Firebase
try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    console.log("Admin Firebase Initialized");
} catch (e) {
    console.error("Firebase Error", e);
    alert("後台資料庫連線失敗");
}

// 狀態變數
let currentUser = null;
let editingUserId = null;

// DOM 元素
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const userListBody = document.getElementById('user-list-body');
const statusMsg = document.getElementById('status-msg');
const editModal = document.getElementById('edit-modal');

// --- 1. 驗證與登入邏輯 ---

// 監聽登入狀態改變
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        // 登入成功，顯示主控台，隱藏登入框
        loginSection.style.display = 'none';
        dashboardSection.style.display = 'block';
        loadAllUsers(); // 自動讀取資料
    } else {
        currentUser = null;
        // 未登入，顯示登入框，隱藏主控台
        loginSection.style.display = 'block';
        dashboardSection.style.display = 'none';
    }
});

// 登入按鈕事件
document.getElementById('login-btn').addEventListener('click', () => {
    const email = document.getElementById('admin-email').value;
    const pass = document.getElementById('admin-pass').value;
    if(!email || !pass) return alert("請輸入帳號密碼");
    
    // 使用 Firebase Auth 進行登入
    signInWithEmailAndPassword(auth, email, pass)
        .then(() => {
            console.log("登入成功");
        })
        .catch((error) => {
            alert("登入失敗：" + error.message);
        });
});

// 登出按鈕
document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth).then(() => location.reload());
});

// 刷新按鈕
document.getElementById('refresh-btn').addEventListener('click', loadAllUsers);

// --- 2. 核心功能：讀取與顯示列表 ---

async function loadAllUsers() {
    statusMsg.innerText = "讀取資料中...";
    userListBody.innerHTML = "";
    
    try {
        // 從 'users' 集合抓取所有文件，並依照戰力 (combatPower) 排序
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
        // 如果這裡報錯，通常是因為權限問題 (Firestore Rules)
        statusMsg.innerText = "讀取失敗";
        alert("讀取失敗：可能是權限不足 (需要設定 Firestore Rules) 或網路問題");
    }
}

// 渲染單列玩家資料
function renderUserRow(uid, data) {
    const tr = document.createElement('tr');
    
    // 縮短顯示 UID，避免表格太寬
    const shortUid = uid.substring(0, 8) + "...";
    
    tr.innerHTML = `
        <td style="font-weight:bold; color:#fff;">${data.name || "未命名"}</td>
        <td><span class="uid-tag" title="${uid}">${shortUid}</span></td>
        <td class="res-gold">${data.gold || 0}</td>
        <td class="res-gem">${data.gems || 0}</td>
        <td>${data.combatPower || 0}</td>
        <td>
            <button class="btn-primary edit-btn" style="padding:5px 10px; font-size:0.8em;">✏️ 編輯</button>
        </td>
    `;
    
    // 綁定編輯按鈕
    tr.querySelector('.edit-btn').addEventListener('click', () => {
        openEditModal(uid, data);
    });
    
    userListBody.appendChild(tr);
}

// --- 3. 核心功能：編輯與儲存 ---

const editGoldInput = document.getElementById('edit-gold');
const editGemsInput = document.getElementById('edit-gems');
const editTargetName = document.getElementById('edit-target-name');

// 打開編輯視窗
function openEditModal(uid, data) {
    editingUserId = uid; // 記住現在正在編輯誰
    editTargetName.innerText = `正在編輯：${data.name || "未命名"}`;
    editGoldInput.value = data.gold || 0;
    editGemsInput.value = data.gems || 0;
    
    editModal.classList.remove('hidden');
}

// 取消編輯
document.getElementById('cancel-edit-btn').addEventListener('click', () => {
    editModal.classList.add('hidden');
    editingUserId = null;
});

// 儲存變更
document.getElementById('save-edit-btn').addEventListener('click', async () => {
    if (!editingUserId) return;
    
    const newGold = parseInt(editGoldInput.value);
    const newGems = parseInt(editGemsInput.value);
    
    if (isNaN(newGold) || newGold < 0) return alert("金幣數值不合法");
    if (isNaN(newGems) || newGems < 0) return alert("鑽石數值不合法");
    
    const btn = document.getElementById('save-edit-btn');
    const originalText = btn.innerText;
    btn.innerText = "儲存中...";
    btn.disabled = true;
    
    try {
        // 寫入資料庫：更新指定 UID 的文件
        const userRef = doc(db, "users", editingUserId);
        await updateDoc(userRef, {
            gold: newGold,
            gems: newGems
        });
        
        alert("✅ 修改成功！");
        editModal.classList.add('hidden');
        loadAllUsers(); // 重新讀取列表，顯示最新數字
    } catch (e) {
        console.error("Update failed:", e);
        alert("❌ 修改失敗：" + e.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
});
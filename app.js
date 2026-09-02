// 天主教善導小學積點系統 - 應用主邏輯控制

// 全局未捕獲異常監聽器：將任何腳本崩潰或參考錯誤直接輸出到網頁控制台
window.addEventListener('error', function(event) {
    const msg = `【腳本崩潰】${event.message} 在 ${event.filename ? event.filename.split('/').pop() : 'app.js'}:${event.lineno}:${event.colno}`;
    console.error(msg, event.error);
    try {
        const consoleBox = document.getElementById('console-log-box');
        if (consoleBox) {
            const line = document.createElement('div');
            line.className = 'console-line danger';
            line.innerHTML = `<span style="color: #ef4444; font-weight: bold;">⚠️ [崩潰] ${msg}</span>`;
            consoleBox.appendChild(line);
            consoleBox.scrollTop = consoleBox.scrollHeight;
        }
    } catch(e) {}
});

window.addEventListener('unhandledrejection', function(event) {
    const msg = `【異步崩潰】${event.reason?.message || event.reason}`;
    console.error(msg, event.reason);
    try {
        const consoleBox = document.getElementById('console-log-box');
        if (consoleBox) {
            const line = document.createElement('div');
            line.className = 'console-line danger';
            line.innerHTML = `<span style="color: #f87171; font-weight: bold;">⚠️ [異步崩潰] ${msg}</span>`;
            consoleBox.appendChild(line);
            consoleBox.scrollTop = consoleBox.scrollHeight;
        }
    } catch(e) {}
});

// 全局狀態管理
function normalizeYear(yearStr) {
    if (!yearStr) return "P.1";
    const clean = yearStr.trim().toUpperCase();
    if (clean === "一年級" || clean === "P.1" || clean === "P1" || clean === "P 1" || clean === "P-1") return "P.1";
    if (clean === "二年級" || clean === "P.2" || clean === "P2" || clean === "P 2" || clean === "P-2") return "P.2";
    if (clean === "三年級" || clean === "P.3" || clean === "P3" || clean === "P 3" || clean === "P-3") return "P.3";
    if (clean === "四年級" || clean === "P.4" || clean === "P4" || clean === "P 4" || clean === "P-4") return "P.4";
    if (clean === "五年級" || clean === "P.5" || clean === "P5" || clean === "P 5" || clean === "P-5") return "P.5";
    if (clean === "六年級" || clean === "P.6" || clean === "P6" || clean === "P 6" || clean === "P-6") return "P.6";
    return yearStr;
}

const state = {
    students: [],
    gifts: [],
    transactions: [],
    activeTab: 'portal',
    userRole: 'portal', // 'portal', 'student', 'teacher', 'prefect'
    activeReportTab: 'by-students',
    scannedStudent: null, // 教師發放積分卡
    kioskStudent: null,   // 學生查詢卡
    selectedRedeemGift: null, // 超市選取禮物卡
    shopMode: 'self-service', // 'self-service' or 'checkout'
    checkoutPrice: 0,        // 收銀扣點設定金額
    checkoutStatus: 'idle',  // 'idle', 'waiting', 'success', 'error'
    checkoutResultStudent: null, // 收銀扣點成功之學生資訊
    isFirebase: false,
    firebaseDb: null,
    firebaseAuth: null,
    googleUser: null,
    searchQuery: '',
    classFilter: '',
    yearFilter: '',
    selectedDutyLocation: '前座禮堂',
    prefectCheckins: [],
    prefectSchedules: []
};

// =========================================================================
// 數據適配層：支持 LocalStorage 及 Firebase Firestore 雙重同步
// =========================================================================
const DB = {
    async init() {
        if (!localStorage.getItem('student_points_firebase_config')) {
            const defaultCfg = {
                apiKey: "AIzaSyBEt7padFefGvwX_irxnQbHT0UScoqDYWM",
                authDomain: "credit12345.firebaseapp.com",
                projectId: "credit12345",
                appId: "1:629126795477:web:2883e02e0c53559c67125c"
            };
            localStorage.setItem('student_points_firebase_config', JSON.stringify(defaultCfg));
        } else {
            try {
                const existing = JSON.parse(localStorage.getItem('student_points_firebase_config'));
                if (existing && existing.projectId && !existing.authDomain) {
                    existing.authDomain = existing.projectId + ".firebaseapp.com";
                    localStorage.setItem('student_points_firebase_config', JSON.stringify(existing));
                }
            } catch (e) {
                console.warn("無法熱修復 Firebase config", e);
            }
        }

        // 1. 立即初始化本地數據，保障 UI 瞬間可用，絕對不阻塞
        this.initLocalStorage();
        state.isFirebase = false;
        this.updateStatusIndicator('connecting');
    },

    initLocalStorage() {
        // 自動升級與遷移：若檢測到歷史舊數據，自動重置為最新 P.1-P.6 全校 572 名學生 @mail.gccps.edu.hk 名冊
        let needReset = false;
        try {
            const rawStudents = localStorage.getItem('student_points_db_students');
            if (rawStudents) {
                const parsed = JSON.parse(rawStudents);
                if (Array.isArray(parsed) && (parsed.length < (window.DEFAULT_STUDENTS ? window.DEFAULT_STUDENTS.length : 570) || parsed.some(s => s.email && s.email.includes('@gmail.com')) || parsed.some(s => s.year === '一年級' || s.year === '二年級'))) {
                    needReset = true;
                }
            }
        } catch (e) {
            needReset = true;
        }

        if (needReset) {
            localStorage.removeItem('student_points_db_students');
            localStorage.removeItem('student_points_db_gifts');
            localStorage.removeItem('student_points_db_transactions');
        }

        if (!localStorage.getItem('student_points_db_students')) {
            localStorage.setItem('student_points_db_students', JSON.stringify(window.DEFAULT_STUDENTS));
        }
        if (!localStorage.getItem('student_points_db_gifts')) {
            localStorage.setItem('student_points_db_gifts', JSON.stringify(window.DEFAULT_GIFTS));
        }
        if (!localStorage.getItem('student_points_db_transactions')) {
            localStorage.setItem('student_points_db_transactions', JSON.stringify(window.DEFAULT_TRANSACTIONS));
        }
        if (!localStorage.getItem('student_points_db_prefect_checkins')) {
            localStorage.setItem('student_points_db_prefect_checkins', JSON.stringify([]));
        }
        if (!localStorage.getItem('student_points_db_prefect_schedules')) {
            localStorage.setItem('student_points_db_prefect_schedules', JSON.stringify(window.DEFAULT_PREFECT_SCHEDULES));
        }
        
        try {
            state.students = JSON.parse(localStorage.getItem('student_points_db_students')) || window.DEFAULT_STUDENTS;
            let hasYearChanges = false;
            state.students.forEach(s => {
                const norm = normalizeYear(s.year);
                if (s.year !== norm) {
                    s.year = norm;
                    hasYearChanges = true;
                }
            });
            if (hasYearChanges) {
                localStorage.setItem('student_points_db_students', JSON.stringify(state.students));
                console.log("學生數據中的年級/班級名稱已成功標準化為 P.1-P.6 格式，並存回 LocalStorage。");
            }
        } catch (e) {
            console.warn("解析學生數據失敗，正在重置...", e);
            localStorage.setItem('student_points_db_students', JSON.stringify(window.DEFAULT_STUDENTS));
            state.students = window.DEFAULT_STUDENTS;
        }

        try {
            state.gifts = JSON.parse(localStorage.getItem('student_points_db_gifts')) || window.DEFAULT_GIFTS;
        } catch (e) {
            console.warn("解析商品數據失敗，正在重置...", e);
            localStorage.setItem('student_points_db_gifts', JSON.stringify(window.DEFAULT_GIFTS));
            state.gifts = window.DEFAULT_GIFTS;
        }

        try {
            state.transactions = JSON.parse(localStorage.getItem('student_points_db_transactions')) || window.DEFAULT_TRANSACTIONS;
        } catch (e) {
            console.warn("解析交易流水失敗，正在重置...", e);
            localStorage.setItem('student_points_db_transactions', JSON.stringify(window.DEFAULT_TRANSACTIONS));
            state.transactions = window.DEFAULT_TRANSACTIONS;
        }

        try {
            state.prefectCheckins = JSON.parse(localStorage.getItem('student_points_db_prefect_checkins')) || [];
        } catch (e) {
            console.warn("解析風紀報到數據失敗，正在重置...", e);
            localStorage.setItem('student_points_db_prefect_checkins', JSON.stringify([]));
            state.prefectCheckins = [];
        }

        try {
            state.prefectSchedules = JSON.parse(localStorage.getItem('student_points_db_prefect_schedules')) || window.DEFAULT_PREFECT_SCHEDULES;
        } catch (e) {
            console.warn("解析風紀班表數據失敗，正在重置...", e);
            localStorage.setItem('student_points_db_prefect_schedules', JSON.stringify(window.DEFAULT_PREFECT_SCHEDULES));
            state.prefectSchedules = window.DEFAULT_PREFECT_SCHEDULES;
        }
    },

    async initFirebase(config) {
        try {
            // 動態導入 Firebase SDK
            const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
            const { getFirestore, collection, getDocs, doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
            const { getAuth, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js");
            
            const app = initializeApp(config);
            state.firebaseDb = getFirestore(app);
            state.firebaseAuth = getAuth(app);
            
            // 監聽登入身分狀態變更
            onAuthStateChanged(state.firebaseAuth, async (user) => {
                if (user) {
                    state.googleUser = {
                        email: user.email,
                        displayName: user.displayName || user.email.split('@')[0]
                    };
                    await autoLoginStudentByGoogle(user.email);
                } else {
                    state.googleUser = null;
                }
            });
            
            // 嘗試讀取學生列表以驗證連接權限
            const testRef = collection(state.firebaseDb, "students");
            const snapshot = await getDocs(testRef);
            
            // 若 Firestore 雲端為空，自動導入預設繁體中文數據集進行引導 seeding
            if (snapshot.empty) {
                console.log("Firestore 雲端為空。正在寫入繁體中文預設引導數據庫...");
                for (const student of window.DEFAULT_STUDENTS) {
                    await setDoc(doc(state.firebaseDb, "students", student.id), student);
                }
                for (const gift of window.DEFAULT_GIFTS) {
                    await setDoc(doc(state.firebaseDb, "gifts", gift.id), gift);
                }
                for (const tx of window.DEFAULT_TRANSACTIONS) {
                    await setDoc(doc(state.firebaseDb, "transactions", tx.id), tx);
                }
            }
            
            // 獨立嘗試對風紀班表進行初始化 seeding，防止空雲端
            try {
                const schedRef = collection(state.firebaseDb, "prefect_schedules");
                const schedSnap = await getDocs(schedRef);
                if (schedSnap.empty) {
                    console.log("Firestore 風紀班表為空。正在寫入預設風紀班表...");
                    for (const sched of window.DEFAULT_PREFECT_SCHEDULES) {
                        await setDoc(doc(state.firebaseDb, "prefect_schedules", sched.id), sched);
                    }
                }
            } catch (e) {
                console.warn("Seeding prefect schedules failed:", e);
            }

            await this.syncFromFirebase();
            return true;
        } catch (e) {
            console.error("Firebase 初始化或連接異常:", e);
            logConsole(`Firebase 核心模組加載/連接異常: ${e.message || e}`, "error");
            return false;
        }
    },

    async syncFromFirebase() {
        const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        
        // 同步學生
        const studentsSnap = await getDocs(collection(state.firebaseDb, "students"));
        state.students = [];
        studentsSnap.forEach(doc => state.students.push(doc.data()));
        
        // 同步獎品
        const giftsSnap = await getDocs(collection(state.firebaseDb, "gifts"));
        state.gifts = [];
        giftsSnap.forEach(doc => state.gifts.push(doc.data()));
        
        // 同步交易日誌
        const txSnap = await getDocs(collection(state.firebaseDb, "transactions"));
        state.transactions = [];
        txSnap.forEach(doc => state.transactions.push(doc.data()));
        
        // 依據時間戳從新到舊排序
        state.transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // 同步風紀報到考勤記錄
        try {
            const checkinsSnap = await getDocs(collection(state.firebaseDb, "prefect_checkins"));
            state.prefectCheckins = [];
            checkinsSnap.forEach(doc => state.prefectCheckins.push(doc.data()));
            state.prefectCheckins.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        } catch (e) {
            console.warn("同步風紀報到數據失敗，採用本地緩存:", e);
        }

        // 同步風紀當值班表
        try {
            const schedulesSnap = await getDocs(collection(state.firebaseDb, "prefect_schedules"));
            if (!schedulesSnap.empty) {
                state.prefectSchedules = [];
                schedulesSnap.forEach(doc => state.prefectSchedules.push(doc.data()));
            }
        } catch (e) {
            console.warn("同步風紀班表數據失敗，採用本地緩存:", e);
        }
    },

    async savePrefectCheckin(checkin) {
        state.prefectCheckins.unshift(checkin);
        localStorage.setItem('student_points_db_prefect_checkins', JSON.stringify(state.prefectCheckins));
        
        if (state.isFirebase && state.firebaseDb) {
            try {
                const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                await setDoc(doc(state.firebaseDb, "prefect_checkins", checkin.id), checkin);
            } catch (e) {
                console.error("同步風紀報到記錄至 Firebase 失敗:", e);
            }
        }
    },

    async saveFirebaseConfig(config) {
        localStorage.setItem('student_points_firebase_config', JSON.stringify(config));
        await this.initFirebaseAsync();
    },

    async clearFirebaseConfig() {
        localStorage.removeItem('student_points_firebase_config');
        state.isFirebase = false;
        state.firebaseDb = null;
        this.initLocalStorage();
        this.updateStatusIndicator();
        showToast("已切換回本地數據庫 Persisted 模式", "info");
    },

    async initFirebaseAsync() {
        let configStr = localStorage.getItem('student_points_firebase_config');
        let config = null;

        if (configStr) {
            config = JSON.parse(configStr);
            // 動態自我修復：補齊 authDomain
            if (config.projectId && !config.authDomain) {
                config.authDomain = config.projectId + ".firebaseapp.com";
                localStorage.setItem('student_points_firebase_config', JSON.stringify(config));
            }
        } else {
            // 預置用戶的 schoolcreditsystem Firestore 專案參數
            config = {
                apiKey: "AIzaSyBEt7padFefGvwX_irxnQbHT0UScoqDYWM",
                authDomain: "credit12345.firebaseapp.com",
                projectId: "credit12345",
                appId: "1:629126795477:web:2883e02e0c53559c67125c"
            };
        }

        if (config && config.apiKey && config.projectId) {
            logConsole("正在建立與 Google Cloud Firestore 雲端連接...", "info");
            
            // 設置一個連接超時時間，使用 8 秒黃金超時，防止在慢速或受阻網速下長時間卡死
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("連接超時")), 8000));
            
            try {
                const isConnected = await Promise.race([
                    this.initFirebase(config),
                    timeoutPromise
                ]);

                if (isConnected) {
                    state.isFirebase = true;
                    this.updateStatusIndicator();
                    showToast("已成功連接至學校 Firestore 雲端數據庫", "success");
                    logConsole("成功: 學校 Firestore 雲端數據庫已完成對接並同步最新數據！", "success");
                    
                    // 連接成功後，執行雲端測試賬戶數據淨化與自癒
                    await cleanObsoleteDummyStudents();

                    // 執行雲端 Google 電子郵箱與學籍/座號數據對接同步
                    await migrateStudentEmailsAndRosterFirestore();

                    // 異步同步成功後，刷新當前所在視窗的渲染
                    switchTab(state.activeTab);
                    renderInteractiveSimulator();
                } else {
                    throw new Error("連接未成功");
                }
            } catch (e) {
                console.error("Firebase 初始化失敗，維持本地緩存模式:", e);
                logConsole(`連線錯誤詳情: ${e.message || e}`, "error");
                logConsole("提示: 雲端數據庫連線超時或失敗。已自動運作在【本地獨立數據庫】模式，確保全功能可用。", "warning");
                state.isFirebase = false;
                this.updateStatusIndicator();
            }
        }
    },

    updateStatusIndicator(status = 'local') {
        const dot = document.getElementById('status-dot');
        const text = document.getElementById('status-text');
        const skipBtn = document.getElementById('skip-to-local-btn');
        
        if (state.isFirebase || status === 'connected') {
            dot.className = "status-dot";
            text.innerText = "雲端數據庫已連接 (Firestore)";
            if (skipBtn) skipBtn.style.display = 'none';
        } else if (status === 'connecting') {
            dot.className = "status-dot connecting";
            text.innerText = "正在連線雲端數據庫...";
            if (skipBtn) skipBtn.style.display = 'inline-block';
        } else {
            dot.className = "status-dot local";
            text.innerText = "本地獨立數據庫模式";
            if (skipBtn) skipBtn.style.display = 'none';
        }
    },

    // --- 數據持久化寫入接口 ---
    async saveStudent(student) {
        if (state.isFirebase) {
            const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
            await setDoc(doc(state.firebaseDb, "students", student.id), student);
        } else {
            localStorage.setItem('student_points_db_students', JSON.stringify(state.students));
        }
    },

    async saveStudentsBulk(newStudentsArray) {
        // 1. 讀取並建立現有學生的對照表，以保留他們的點數餘額與已兌換紀錄
        const existingStudentsMap = new Map(state.students.map(s => [s.id, s]));
        
        const mergedStudents = newStudentsArray.map(newStudent => {
            const existing = existingStudentsMap.get(newStudent.id);
            if (existing) {
                // 如果是已有學生，保留其原先的「可用點數」與「累計已兌換」，只更新最新的「班級」與「年級」等欄位
                return {
                    ...newStudent,
                    points: existing.points !== undefined ? existing.points : 0,
                    redeemed: existing.redeemed !== undefined ? existing.redeemed : 0
                };
            }
            // 新生則使用導入時指定的點數（通常為 0 分）
            return newStudent;
        });
        
        state.students = mergedStudents;
        
        if (state.isFirebase) {
            const { doc, writeBatch } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
            
            // 使用 Firestore Batch 批次寫入（每 400 筆為一組，避免 500 限制）
            let batch = writeBatch(state.firebaseDb);
            let count = 0;
            for (const student of mergedStudents) {
                const docRef = doc(state.firebaseDb, "students", student.id);
                // 使用 merge: true，保障安全更新不覆蓋其他無關自訂欄位
                batch.set(docRef, student, { merge: true });
                count++;
                if (count % 400 === 0) {
                    await batch.commit();
                    batch = writeBatch(state.firebaseDb);
                }
            }
            if (count % 400 !== 0) {
                await batch.commit();
            }
        } else {
            localStorage.setItem('student_points_db_students', JSON.stringify(state.students));
        }
    },

    async saveGift(gift) {
        if (state.isFirebase) {
            const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
            await setDoc(doc(state.firebaseDb, "gifts", gift.id), gift);
        } else {
            localStorage.setItem('student_points_db_gifts', JSON.stringify(state.gifts));
        }
    },

    async deleteGiftFromDb(giftId) {
        if (state.isFirebase) {
            const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
            await deleteDoc(doc(state.firebaseDb, "gifts", giftId));
        } else {
            localStorage.setItem('student_points_db_gifts', JSON.stringify(state.gifts));
        }
    },

    async addTransaction(tx) {
        state.transactions.unshift(tx);
        if (state.isFirebase) {
            const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
            await setDoc(doc(state.firebaseDb, "transactions", tx.id), tx);
        } else {
            localStorage.setItem('student_points_db_transactions', JSON.stringify(state.transactions));
        }
    },

    // --- 高階交易原子操作 ---
    async awardPoints(studentId, points, reason) {
        const student = state.students.find(s => s.id === studentId);
        if (!student) throw new Error("找不到此學生");
        
        student.points += points;
        await this.saveStudent(student);
        
        const tx = {
            id: "tx-" + Date.now() + Math.floor(Math.random() * 100),
            studentId: student.id,
            studentName: student.name,
            studentNum: student.studentNum || "",
            studentClass: student.class || "",
            type: "earn",
            target: reason || "教師發放加分點數",
            points: points,
            timestamp: new Date().toISOString()
        };
        await this.addTransaction(tx);
        return student;
    },

    async awardPointsBulk(studentsList, points, reason) {
        // 1. Update points in state.students
        for (const s of studentsList) {
            const match = state.students.find(x => x.id === s.id);
            if (match) {
                match.points += points;
            }
        }

        // 2. Prepare transaction entries
        const txs = studentsList.map(s => {
            return {
                id: "tx-" + Date.now() + "-" + Math.floor(Math.random() * 10000),
                studentId: s.id,
                studentName: s.name,
                studentNum: s.studentNum || "",
                studentClass: s.class || "",
                type: "earn",
                target: reason || "訓輔集體嘉許",
                points: points,
                timestamp: new Date().toISOString()
            };
        });

        // Add to state.transactions
        for (const tx of txs) {
            state.transactions.unshift(tx);
        }

        // 3. Save to storage
        if (state.isFirebase) {
            const { doc, writeBatch } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
            let batch = writeBatch(state.firebaseDb);
            let count = 0;

            // Save students
            for (const s of studentsList) {
                const docRef = doc(state.firebaseDb, "students", s.id);
                batch.set(docRef, { points: s.points }, { merge: true });
                count++;
                if (count % 400 === 0) {
                    await batch.commit();
                    batch = writeBatch(state.firebaseDb);
                }
            }

            // Save transactions
            for (const tx of txs) {
                const docRef = doc(state.firebaseDb, "transactions", tx.id);
                batch.set(docRef, tx);
                count++;
                if (count % 400 === 0) {
                    await batch.commit();
                    batch = writeBatch(state.firebaseDb);
                }
            }

            if (count % 400 !== 0) {
                await batch.commit();
            }
        } else {
            localStorage.setItem('student_points_db_students', JSON.stringify(state.students));
            localStorage.setItem('student_points_db_transactions', JSON.stringify(state.transactions));
        }
    },

    async redeemGift(studentId, giftId) {
        const student = state.students.find(s => s.id === studentId);
        const gift = state.gifts.find(g => g.id === giftId);
        
        if (!student) throw new Error("找不到此學生。");
        if (!gift) throw new Error("找不到此禮品。");
        if (gift.stock <= 0) throw new Error("該獎品庫存不足，已售罄。");
        if (student.points < gift.cost) throw new Error("學生點數餘額不足，無法兌換。");
        
        // 扣除點數與扣減庫存
        student.points -= gift.cost;
        student.redeemed += gift.cost;
        gift.stock -= 1;
        
        await this.saveStudent(student);
        await this.saveGift(gift);
        
        const tx = {
            id: "tx-" + Date.now() + Math.floor(Math.random() * 100),
            studentId: student.id,
            studentName: student.name,
            studentNum: student.studentNum || "",
            studentClass: student.class || "",
            type: "redeem",
            target: gift.name,
            points: -gift.cost,
            timestamp: new Date().toISOString()
        };
        await this.addTransaction(tx);
        return { student, gift };
    },

    async deductPoints(studentId, points, reason) {
        const student = state.students.find(s => s.id === studentId);
        if (!student) throw new Error("找不到此學生");
        if (student.points < points) throw new Error("學生點數餘額不足");
        
        student.points -= points;
        student.redeemed += points;
        await this.saveStudent(student);
        
        const tx = {
            id: "tx-" + Date.now() + Math.floor(Math.random() * 100),
            studentId: student.id,
            studentName: student.name,
            studentNum: student.studentNum || "",
            studentClass: student.class || "",
            type: "redeem",
            target: reason || "超市收銀扣點購買",
            points: -points,
            timestamp: new Date().toISOString()
        };
        await this.addTransaction(tx);
        return student;
    },

    async processDailyInterest() {
        const todayStr = getLocalDateString();
        let changed = false;
        
        for (const student of state.students) {
            if (!student.interestLastCredited) {
                student.interestLastCredited = todayStr;
                await this.saveStudent(student);
                changed = true;
                continue;
            }
            
            if (student.interestLastCredited < todayStr) {
                let tempPoints = student.points;
                let studentChanged = false;
                
                let currentDateCursor = new Date(student.interestLastCredited + "T00:00:00");
                while (getLocalDateString(currentDateCursor) < todayStr) {
                    currentDateCursor.setDate(currentDateCursor.getDate() + 1);
                    const dayStr = getLocalDateString(currentDateCursor);
                    
                    const txId = `tx-interest-${student.id}-${dayStr}`;
                    const txExists = state.transactions.some(t => t.id === txId);
                    
                    if (!txExists) {
                        const interest = Math.round(tempPoints * 0.01);
                        if (interest > 0) {
                            tempPoints += interest;
                            
                            const tx = {
                                id: txId,
                                studentId: student.id,
                                studentName: student.name,
                                studentNum: student.studentNum || "",
                                studentClass: student.class || "",
                                type: "interest",
                                target: "每日 1% 複利息",
                                points: interest,
                                timestamp: dayStr + "T12:00:00Z"
                            };
                            
                            state.transactions.push(tx);
                            if (state.isFirebase && state.firebaseDb) {
                                const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                                await setDoc(doc(state.firebaseDb, "transactions", tx.id), tx);
                            }
                        }
                        
                        student.points = tempPoints;
                        student.interestLastCredited = dayStr;
                        studentChanged = true;
                    } else {
                        student.interestLastCredited = dayStr;
                        studentChanged = true;
                    }
                }
                
                if (studentChanged) {
                    await this.saveStudent(student);
                    changed = true;
                }
            }
        }
        
        if (changed && !state.isFirebase) {
            localStorage.setItem('student_points_db_students', JSON.stringify(state.students));
            localStorage.setItem('student_points_db_transactions', JSON.stringify(state.transactions));
        }
    }
};

// =========================================================================
// 硬件 RFID 讀卡器鍵盤緩衝解碼引擎
// =========================================================================
const CardReader = {
    buffer: '',
    lastKeyPressTime: 0,
    timeThreshold: 60, // 判斷硬件模擬打字速度閥值（毫秒）

    init() {
        window.addEventListener('keydown', (e) => {
            // 如果焦點在常規文本框中，則不作鍵盤劫持
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            const currentTime = Date.now();
            const timeDiff = currentTime - this.lastKeyPressTime;
            this.lastKeyPressTime = currentTime;

            // 超過輸入間隔時間閥值，則清除緩衝（非高頻掃描，判定為手動物理輸入）
            if (timeDiff > this.timeThreshold) {
                this.buffer = '';
            }

            // 僅抓取字母或數字（標準 RFID 讀卡器均為數字或十六進制編碼）
            if (e.key.length === 1 && /^[a-zA-Z0-9]$/.test(e.key)) {
                this.buffer += e.key;
            } else if (e.key === 'Enter') {
                if (this.buffer.length >= 6) {
                    this.onCardSwiped(this.buffer);
                }
                this.buffer = ''; // 歸零
            }
        });
    },

    onCardSwiped(cardId) {
        console.log("檢測到卡片讀取:", cardId);
        if (!cardId) return;
        
        const cleanCard = cardId.trim().replace(/^0+/, ''); // 去除前導零
        const student = state.students.find(s => {
            const cleanId = s.id ? s.id.trim().replace(/^0+/, '') : '';
            const cleanBarcode = s.barcode ? s.barcode.trim().replace(/^0+/, '') : '';
            const cleanStudentNum = s.studentNum ? s.studentNum.trim().toLowerCase() : '';
            const cleanSearch = cleanCard.toLowerCase();
            return cleanId === cleanSearch || cleanBarcode === cleanSearch || cleanStudentNum === cleanSearch;
        });
        
        if (!student) {
            showToast(`學生識別碼 [${cardId}] 未在學校名冊中註冊`, "danger");
            logConsole(`ERR: 檢測到未註冊的未知識別碼 [${cardId}]`, "danger");
            return;
        }

        // 依據當前所處的前端視窗，做出對應的操作反饋
        if (state.activeTab === 'portal') {
            logConsole(`刷卡: 學生 [${student.name}] 已於大廳感應，自動登入學生終端`, "info");
            state.userRole = 'student';
            state.kioskStudent = student;
            switchTab('student-profile');
            showToast(`歡迎回來，${student.name}！已自動為您登入自助終端 🛍️`, "success");
            triggerConfettiSmall();
            return;
        } else if (state.activeTab === 'prefect-duty') {
            logConsole(`風紀刷卡: 學生 [${student.name}] 已感應報到`, "info");
            handlePrefectCheckin(student);
            return;
        } else if (state.activeTab === 'award-points') {
            logConsole(`刷卡: 學生 [${student.name}] 已感應讀卡 [${cardId}]`, "info");

            // 獲取當前設定的發放分數
            const activePreset = document.querySelector('.preset-btn.active');
            const customInput = document.getElementById('custom-points-input');
            let pointsAwarded = 0;
            if (customInput && customInput.value) {
                pointsAwarded = parseFloat(customInput.value);
            } else if (activePreset) {
                pointsAwarded = parseFloat(activePreset.dataset.val);
            }

            // 獲取當前選擇的加分特質/理由
            const activeCat = document.querySelector('.category-chip.active');
            const customReasonInput = document.getElementById('custom-reason-input');
            const customReason = customReasonInput ? customReasonInput.value.trim() : "";
            
            let categoryReason = "";
            if (activeCat) {
                if (activeCat.id === 'indicators-chip') {
                    categoryReason = activeCat.getAttribute('data-selected-indicator');
                } else if (activeCat.id === 'languages-chip') {
                    categoryReason = activeCat.getAttribute('data-selected-language');
                } else if (activeCat.id === 'artsports-chip') {
                    categoryReason = activeCat.getAttribute('data-selected-artsports');
                } else {
                    categoryReason = activeCat.getAttribute('data-val') || activeCat.innerText.trim();
                }
            }

            const reason = customReason || categoryReason;

            // 雙重校驗：必須同時設定了點數和特質原因
            if (isNaN(pointsAwarded) || pointsAwarded <= 0) {
                showToast("【自動加分失敗】請先在左側控制面板中設定或選擇加分點數！", "warning");
                logConsole(`警告: 學生 [${student.name}] 刷卡，但因未設定發放點數，未執行自動加分。`, "warning");
                state.scannedStudent = student;
                renderScannedStudentProfile();
                return;
            }

            if (!reason) {
                showToast("【自動加分失敗】請先在左側面板選擇「特質」或輸入「自定義原因」！", "warning");
                logConsole(`警告: 學生 [${student.name}] 刷卡，但因未選擇或設定特質，未執行自動加分。`, "warning");
                state.scannedStudent = student;
                renderScannedStudentProfile();
                return;
            }

            // 校驗通過，立即執行自動發分
            (async () => {
                try {
                    const updatedStudent = await DB.awardPoints(student.id, pointsAwarded, reason);
                    state.scannedStudent = updatedStudent;
                    
                    // 重新渲染學生卡片，並顯示綠色成功橫幅
                    renderScannedStudentProfile(pointsAwarded, reason);
                    logConsole(`[自動發放成功] 學生 [${updatedStudent.name}] (${updatedStudent.class}班 / ${updatedStudent.number || '--'}號) 成功獲得 +${pointsAwarded} 點！理由: "${reason}"`, "success");
                    showToast(`自動加分成功：${updatedStudent.name} +${pointsAwarded} 點！`, "success");
                    triggerConfettiSmall();
                } catch (e) {
                    console.error(e);
                    showToast("自動點數發放寫入異常，請重試。", "danger");
                }
            })();

        } else if (state.activeTab === 'student-profile') {
            logConsole(`刷卡: 學生 [${student.name}] 已感應讀卡 [${cardId}]`, "info");
            state.kioskStudent = student;
            renderStudentProfileKiosk();
            showToast(`歡迎回來，${student.name}！`, "success");
            triggerConfettiSmall();
        } else if (state.activeTab === 'student-shop') {
            if (state.shopMode === 'checkout') {
                logConsole(`收銀刷卡: 學生 [${student.name}] 已於超市感應讀卡`, "info");
                executeCheckoutDeduction(student);
            } else {
                logConsole(`刷卡: 學生 [${student.name}] 嘗試進行超市自助自動兌換`, "info");
                
                if (!state.selectedRedeemGift) {
                    showToast("【自動兌換失敗】請先點擊選取心儀寶物 🎁！", "warning");
                    logConsole(`警告: 學生 [${student.name}] 刷卡，但未事先在貨架上點選禮品。`, "warning");
                    return;
                }

                executeGiftRedemption(student, state.selectedRedeemGift);
            }
        } else if (state.activeTab === 'guidance-discipline') {
            logConsole(`刷卡: 學生 [${student.name}] 已感應讀卡 [${cardId}]`, "info");
            
            // 1. 自動定位到該學生的班級或年級範圍
            if (state.gdSelectedScope === 'class') {
                state.gdSelectedClass = student.class;
                // 同步班級按鈕的高亮樣式
                const wrapperClass = document.getElementById('gd-class-selector-wrapper');
                if (wrapperClass) {
                    wrapperClass.querySelectorAll('[data-gd-class]').forEach(btn => {
                        const isTarget = btn.dataset.gdClass === student.class;
                        btn.className = `chip-btn ${isTarget ? 'active' : ''}`;
                        btn.style.border = `1.5px solid ${isTarget ? '#8b5cf6' : 'rgba(168,85,247,0.12)'}`;
                        btn.style.background = isTarget ? 'linear-gradient(135deg, #a855f7, #8b5cf6)' : 'rgba(255,255,255,0.6)';
                        btn.style.color = isTarget ? '#fff' : '#4f46e5';
                        btn.style.boxShadow = isTarget ? '0 4px 12px rgba(139,92,246,0.3)' : 'none';
                    });
                }
            } else {
                state.gdSelectedYear = student.year;
                // 同步年級按鈕的高亮樣式
                const wrapperYear = document.getElementById('gd-year-selector-wrapper');
                if (wrapperYear) {
                    wrapperYear.querySelectorAll('[data-gd-year]').forEach(btn => {
                        const isTarget = btn.dataset.gdYear === student.year;
                        btn.className = `chip-btn ${isTarget ? 'active' : ''}`;
                        btn.style.border = `1.5px solid ${isTarget ? '#8b5cf6' : 'rgba(168,85,247,0.12)'}`;
                        btn.style.background = isTarget ? 'linear-gradient(135deg, #a855f7, #8b5cf6)' : 'rgba(255,255,255,0.6)';
                        btn.style.color = isTarget ? '#fff' : '#4f46e5';
                        btn.style.boxShadow = isTarget ? '0 4px 12px rgba(139,92,246,0.3)' : 'none';
                    });
                }
            }

            // 重新刷新名冊預覽，加載該學生對應的整個班級或年級
            renderGuidanceDisciplineDashboard();

            // 2. 自動滾動定位與發亮閃爍該名學生卡片
            setTimeout(() => {
                const card = document.getElementById(`preview-student-${student.id}`);
                if (card) {
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    card.style.transform = 'scale(1.1)';
                    card.style.boxShadow = '0 0 25px rgba(234, 179, 8, 0.45)';
                    card.style.borderColor = '#eab308';
                    card.style.zIndex = '10';
                    
                    // 釋放黃金高光微動畫，並在 2.5 秒後回復正常
                    setTimeout(() => {
                        card.style.transform = '';
                        card.style.boxShadow = '';
                        card.style.borderColor = '';
                        card.style.zIndex = '';
                    }, 2500);
                }
            }, 150);

            showToast(`🎯 已自動載入 ${student.name} 所在的 ${student.class} 班！可在下方施放集體嘉許魔法 🌟`, "success");
            triggerConfettiSmall();
        } else {
            // 管理端分頁 fallback 提示
            logConsole(`刷卡: 學生 [${student.name}] 已感應讀卡 [${cardId}]，因處於管理分頁未執行對應操作。`, "info");
            showToast(`👋 嗨，${student.name}！現在是系統管理模式中。請在頂部切換到「🌟 學生自助查詢」或「🛍️ 禮品超市」再進行嗶卡哦！✨`, "info");
        }
    }
};

// =========================================================================
// 前端模塊切換與渲染機制
// =========================================================================
function switchTab(tabId) {
    state.activeTab = tabId;
    
    const header = document.querySelector('header');
    
    if (tabId === 'portal') {
        state.userRole = 'portal';
        if (header) header.style.setProperty('display', 'none', 'important');
    } else {
        if (header) header.style.setProperty('display', 'flex', 'important');
        
        // 根據不同身分過濾頂部導航按鈕
        const returnBtn = document.getElementById('nav-return-portal');
        const awardBtn = document.getElementById('nav-award-points');
        const profileBtn = document.getElementById('nav-student-profile');
        const shopBtn = document.getElementById('nav-student-shop');
        const invBtn = document.getElementById('nav-presents-inventory');
        const reportsBtn = document.getElementById('nav-summary-reports');
        const gdBtn = document.getElementById('nav-guidance-discipline');
        
        if (state.userRole === 'student') {
            // 學生模式：僅顯示查詢、超市與統計大廳
            if (returnBtn) returnBtn.style.display = 'flex';
            if (profileBtn) profileBtn.style.display = 'flex';
            if (shopBtn) shopBtn.style.display = 'flex';
            if (reportsBtn) reportsBtn.style.display = 'flex';
            
            if (awardBtn) awardBtn.style.display = 'none';
            if (invBtn) invBtn.style.display = 'none';
            if (gdBtn) gdBtn.style.display = 'none';
            
            // 隱藏教師敏感操作按鈕
            const clearBtn = document.getElementById('admin-clear-all-btn');
            const importBtn = document.getElementById('report-import-trigger-btn');
            const templateBtn = document.getElementById('report-template-btn');
            if (clearBtn) clearBtn.style.display = 'none';
            if (importBtn) importBtn.style.display = 'none';
            if (templateBtn) templateBtn.style.display = 'none';

            // 隱藏「全校歷史交易日誌」、「風紀報到考勤日誌」與「學生帳號對照表」子分頁
            const transactionsTabBtn = document.querySelector('.report-tab-btn[data-report-tab="transactions"]');
            if (transactionsTabBtn) transactionsTabBtn.style.display = 'none';
            const prefectTabBtn = document.querySelector('.report-tab-btn[data-report-tab="prefect-duty-log"]');
            if (prefectTabBtn) prefectTabBtn.style.display = 'none';
            const accountsTabBtn = document.querySelector('.report-tab-btn[data-report-tab="student-accounts-lookup"]');
            if (accountsTabBtn) accountsTabBtn.style.display = 'none';

            if (state.activeReportTab === 'transactions' || state.activeReportTab === 'prefect-duty-log' || state.activeReportTab === 'student-accounts-lookup') {
                state.activeReportTab = 'by-students';
                document.querySelectorAll('.report-tab-btn').forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.reportTab === 'by-students') btn.classList.add('active');
                });
            }
        } else if (state.userRole === 'teacher') {
            // 教師模式：顯示所有選項
            if (returnBtn) returnBtn.style.display = 'flex';
            if (profileBtn) profileBtn.style.display = 'flex';
            if (shopBtn) shopBtn.style.display = 'flex';
            if (reportsBtn) reportsBtn.style.display = 'flex';
            if (awardBtn) awardBtn.style.display = 'flex';
            if (invBtn) invBtn.style.display = 'flex';
            if (gdBtn) gdBtn.style.display = 'flex';
            
            // 顯示教師敏感操作按鈕
            const clearBtn = document.getElementById('admin-clear-all-btn');
            const importBtn = document.getElementById('report-import-trigger-btn');
            const templateBtn = document.getElementById('report-template-btn');
            if (clearBtn) clearBtn.style.display = '';
            if (importBtn) importBtn.style.display = '';
            if (templateBtn) templateBtn.style.display = '';

            // 顯示「全校歷史交易日誌」、「風紀報到考勤日誌」與「學生帳號對照表」子分頁
            const transactionsTabBtn = document.querySelector('.report-tab-btn[data-report-tab="transactions"]');
            if (transactionsTabBtn) transactionsTabBtn.style.display = '';
            const prefectTabBtn = document.querySelector('.report-tab-btn[data-report-tab="prefect-duty-log"]');
            if (prefectTabBtn) prefectTabBtn.style.display = '';
            const accountsTabBtn = document.querySelector('.report-tab-btn[data-report-tab="student-accounts-lookup"]');
            if (accountsTabBtn) accountsTabBtn.style.display = '';
        }
    }

    // 管理導航欄焦點高亮
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabId) btn.classList.add('active');
    });

    // 控制視圖顯隱
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
        if (screen.id === `${tabId}-screen`) screen.classList.add('active');
    });

    // 模塊主動重繪
    if (tabId === 'award-points') {
        renderScannedStudentProfile();
        updateTeacherAwardStatus();
    } else if (tabId === 'student-profile') {
        renderStudentProfileKiosk();
    } else if (tabId === 'student-shop') {
        renderAutomatedShopKiosk();
    } else if (tabId === 'presents-inventory') {
        renderInventoryManagerGrid();
    } else if (tabId === 'summary-reports') {
        renderReportsDashboard();
    } else if (tabId === 'guidance-discipline') {
        renderGuidanceDisciplineDashboard();
    } else if (tabId === 'prefect-duty') {
        renderPrefectDutyScreen();
        renderPrefectCheckinHistory();
        startPrefectLiveClock();
    }

    // 控制 RFID 智能卡感應模擬器的顯隱 (在教師管理終端與風紀報到端下可見，防範學生作弊)
    const simPanel = document.getElementById('simulator-panel');
    if (simPanel) {
        if (state.userRole === 'teacher' || state.activeTab === 'prefect-duty') {
            simPanel.style.display = 'block';
        } else {
            simPanel.style.display = 'none';
        }
    }
}

// =========================================================================
// 交互反饋、通知與特效 & 計利息日期輔助函數
// =========================================================================
function getLocalDateString(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconClass = 'fa-info-circle';
    if (type === 'success') iconClass = 'fa-check-circle';
    if (type === 'warning') iconClass = 'fa-exclamation-triangle';
    if (type === 'danger') iconClass = 'fa-times-circle';

    toast.innerHTML = `
        <i class="fas ${iconClass}"></i>
        <span>${message}</span>
    `;
    container.appendChild(toast);

    // 4 秒後淡出移出
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 200);
    }, 4000);
}

function logConsole(message, type = '') {
    const consoleBox = document.getElementById('console-log-box');
    if (!consoleBox) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const line = document.createElement('div');
    line.className = `console-line ${type}`;
    line.innerHTML = `<span style="color: var(--text-dim)">[${timestamp}]</span> <span>${message}</span>`;
    
    consoleBox.appendChild(line);
    consoleBox.scrollTop = consoleBox.scrollHeight;
}

function triggerConfettiSmall() {
    if (window.confetti) {
        window.confetti({
            particleCount: 50,
            spread: 40,
            origin: { y: 0.8 },
            colors: ['#8b5cf6', '#06b6d4', '#10b981']
        });
    }
}

function triggerConfettiBig() {
    if (window.confetti) {
        window.confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b']
        });
    }
}
// 執行神奇超市扣點兌換核心業務 (可複用於現場刷卡與在家網頁點選)
async function executeGiftRedemption(student, gift) {
    if (!student || !gift) return;
    const cost = gift.cost;

    if (gift.stock <= 0) {
        showToast("【自動兌換失敗】該寶貝禮物已經被搶光囉！", "danger");
        return;
    }

    if (student.points < cost) {
        showToast(`🔒 【點數不足】學生 [${student.name}] 還差 ${cost - student.points} 點積點哦，繼續加油！💪`, "warning");
        logConsole(`警告: 學生 [${student.name}] 嘗試兌換「${gift.name}」，但可用點數 (${student.points} 點) 低於商品價值 (${cost} 點)。`, "warning");
        return;
    }

    try {
        const { student: updatedStudent, gift: updatedGift } = await DB.redeemGift(student.id, gift.id);
        
        // 1. 爆發宇宙煙花
        triggerConfettiBig();
        
        // 2. 顯示超凡扣點成功 Overlay Modal
        const successModal = document.getElementById('shop-success-modal');
        const successContent = document.getElementById('shop-success-content');
        
        if (successContent) {
            successContent.innerHTML = `
                <div style="margin-bottom: 16px;">
                    <img src="${updatedGift.image || 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=400'}" 
                         alt="${updatedGift.name}" 
                         style="width: 120px; height: 120px; object-fit: cover; border-radius: 16px; border: 3px solid #10b981; box-shadow: 0 8px 24px rgba(16,185,129,0.25);">
                </div>
                <p style="font-size: 16px; font-weight: 700; color: #1e1b4b; margin-bottom: 8px;">
                    恭喜 <strong style="color: #8b5cf6; font-size: 18px;">${updatedStudent.name}</strong> 同學！
                </p>
                <p style="font-size: 15px; font-weight: 600; color: #475569; margin-bottom: 16px;">
                    成功兌換了神奇寶物：<strong style="color: #0f172a;">「${updatedGift.name}」</strong>
                </p>
                <div style="background: rgba(16,185,129,0.04); border: 1.5px solid rgba(16,185,129,0.12); border-radius: 12px; padding: 12px; display: inline-flex; flex-direction: column; gap: 4px; min-width: 240px; margin-bottom: 12px;">
                    <div style="font-size: 13px; color: #475569; font-weight: 600; display: flex; justify-content: space-between; gap: 20px;">
                        <span>扣除積點：</span><strong style="color: #ef4444;">-${updatedGift.cost} 點</strong>
                    </div>
                    <div style="font-size: 13px; color: #475569; font-weight: 600; display: flex; justify-content: space-between; gap: 20px; border-top: 1px dashed rgba(0,0,0,0.06); padding-top: 4px;">
                        <span>剩餘可用餘額：</span><strong style="color: #10b981;">${updatedStudent.points} 點</strong>
                    </div>
                </div>
                <p style="font-size: 13px; font-weight: 700; color: #d97706; margin-top: 4px; animation: bounce 2s infinite;">
                    🎒 寶貝已裝入魔法庫存，請前往教導處找老師領取哦！
                </p>
            `;
        }
        
        if (successModal) {
            successModal.classList.add('active');
            
            // 3. 自動倒計時條動畫 (5秒)
            const timerBar = document.getElementById('shop-success-timer-bar');
            if (timerBar) {
                timerBar.style.transition = 'none';
                timerBar.style.width = '100%';
                setTimeout(() => {
                    timerBar.style.transition = 'width 5s linear';
                    timerBar.style.width = '0%';
                }, 50);
            }
            
            // 4. 設定自動關閉計時器
            if (window.shopSuccessTimeout) clearTimeout(window.shopSuccessTimeout);
            window.shopSuccessTimeout = setTimeout(() => {
                successModal.classList.remove('active');
            }, 5000);
        }
        
        // 5. 重置超市選定狀態，並重新渲染超市
        state.selectedRedeemGift = null;
        
        // 如果是 Google 登入狀態，我們保持學生為 kioskStudent，否則退卡重置
        if (!state.googleUser) {
            state.kioskStudent = null; // 現場刷卡兌換完畢自動登出，保護點數安全
        } else {
            // Google 登入在家的話，同步更新 kioskStudent 實體
            state.kioskStudent = updatedStudent;
        }
        
        renderAutomatedShopKiosk();
        
        logConsole(`[自動超市兌換成功] 學生 [${updatedStudent.name}] 成功自動扣除 -${updatedGift.cost} 點，兌換「${updatedGift.name}」`, "success");
        
    } catch (e) {
        showToast(e.message || "自動扣除積點兌換失敗，請與老師聯絡。", "danger");
    }
}

// =========================================================================
// PORTAL 1: 教師發放積分管理頁
// =========================================================================
function renderScannedStudentProfile(justAwardedPoints = 0, justAwardedReason = "") {
    const s = state.scannedStudent;
    const profileContainer = document.getElementById('scanned-student-profile');
    
    if (!s) {
        profileContainer.innerHTML = `
            <div style="text-align: center; color: var(--text-muted); padding: 40px 10px; background: rgba(168, 85, 247, 0.03); border: 2px dashed rgba(168, 85, 247, 0.15); border-radius: 16px;">
                <i class="fas fa-magic" style="font-size: 36px; margin-bottom: 12px; color: var(--secondary); animation: pulse 2s infinite;"></i>
                <p style="font-weight: 700; font-size: 15px; color: var(--text-main);">🌈 魔法感應中... 快把學生卡放上來吧！✨</p>
                <p style="font-size: 12px; margin-top: 6px; color: var(--text-dim);">請將實體卡放置讀卡器上，或點擊下方模擬器中的名字感應！</p>
            </div>
        `;
        const awardBtn = document.getElementById('teacher-award-btn');
        if (awardBtn) {
            awardBtn.disabled = true;
            awardBtn.innerHTML = `<i class="fas fa-exclamation-circle" style="color: #ef4444;"></i> ✨ 魔法感應模式：請先選好積點和特質`;
            awardBtn.className = "btn-style secondary";
            awardBtn.style.background = "rgba(168, 85, 247, 0.05)";
            awardBtn.style.color = "var(--text-muted)";
            awardBtn.style.borderColor = "rgba(168, 85, 247, 0.15)";
            awardBtn.style.cursor = "default";
        }
        return;
    }

    let successBadgeHtml = "";
    if (justAwardedPoints > 0) {
        successBadgeHtml = `
            <div class="award-success-banner" style="margin-top: 15px; padding: 14px; border-radius: 12px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(6, 182, 212, 0.08)); border: 1.5px solid rgba(16, 185, 129, 0.35); text-align: center; animation: slideDown 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
                <div style="font-size: 12px; color: #059669; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 6px;">
                    🎉✨ 自動加分成功！✨🎉
                </div>
                <div style="font-size: 26px; font-weight: 900; color: #059669; margin: 6px 0;">+${justAwardedPoints} ⭐ 積點！</div>
                <div style="font-size: 12px; color: var(--text-main);">理由：<strong style="color: #d97706; font-weight:800;">${justAwardedReason}</strong></div>
            </div>
        `;
    }

    profileContainer.innerHTML = `
        <div class="student-profile-panel" style="animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); background: rgba(255, 255, 255, 0.95); border: 1.5px solid rgba(168, 85, 247, 0.18); box-shadow: 0 4px 15px rgba(168, 85, 247, 0.06);">
            <div class="student-avatar" style="background: linear-gradient(135deg, #ff4e50, #f9d423); font-size: 20px; font-weight: 800; color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">${s.name.charAt(0)}</div>
            <div class="student-details">
                <h3 style="font-size: 18px; font-weight: 800; color: var(--text-main); display: flex; align-items: center; gap: 6px;">${s.name} <span style="font-size: 14px;">🎒</span></h3>
                <p style="color: var(--text-dim); font-size: 12px; margin-top: 4px; font-weight: 500;">學生編號: <strong>${s.studentNum || s.id}</strong><br>班級: <strong>${s.class} 班 (${s.number || '--'} 號)</strong> | 年級: <strong>${s.year}</strong></p>
            </div>
            <div class="student-points-badge" style="background: rgba(168, 85, 247, 0.04); border: 1px solid rgba(168, 85, 247, 0.12); border-radius: 12px; padding: 10px 16px;">
                <div class="points-num" style="color: #d97706; font-size: 28px; font-weight: 900;">⭐ ${s.points}</div>
                <div class="points-label" style="font-size: 11px; font-weight: 700; color: var(--text-muted); margin-top: 2px;">我的可用積點</div>
            </div>
        </div>
        ${successBadgeHtml}
    `;

    updateTeacherAwardStatus();
}

function updateTeacherAwardStatus() {
    const awardBtn = document.getElementById('teacher-award-btn');
    if (!awardBtn) return;

    // Get selected points
    const activePreset = document.querySelector('.preset-btn.active');
    const customInput = document.getElementById('custom-points-input');
    let pointsAwarded = 0;
    if (customInput && customInput.value) {
        pointsAwarded = parseFloat(customInput.value);
    } else if (activePreset) {
        pointsAwarded = parseFloat(activePreset.dataset.val);
    }

    // Get selected category
    const activeCat = document.querySelector('.category-chip.active');
    const customReasonInput = document.getElementById('custom-reason-input');
    const customReason = customReasonInput ? customReasonInput.value.trim() : "";
    
    let categoryReason = "";
    if (activeCat) {
        if (activeCat.id === 'indicators-chip') {
            categoryReason = activeCat.getAttribute('data-selected-indicator');
        } else if (activeCat.id === 'languages-chip') {
            categoryReason = activeCat.getAttribute('data-selected-language');
        } else if (activeCat.id === 'artsports-chip') {
            categoryReason = activeCat.getAttribute('data-selected-artsports');
        } else {
            categoryReason = activeCat.getAttribute('data-val') || activeCat.innerText.trim();
        }
    }

    const reason = customReason || categoryReason;

    if (pointsAwarded > 0 && reason) {
        awardBtn.disabled = false;
        awardBtn.innerHTML = `<i class="fas fa-bolt" style="color: #eab308; animation: pulse 1s infinite;"></i> 自動感應中：刷卡即加 +${pointsAwarded} 點 (${reason})`;
        awardBtn.className = "btn-style success";
        awardBtn.style.background = "rgba(16, 185, 129, 0.1)";
        awardBtn.style.color = "var(--success)";
        awardBtn.style.borderColor = "rgba(16, 185, 129, 0.2)";
        awardBtn.style.cursor = "pointer";
    } else {
        let missing = [];
        if (pointsAwarded <= 0) missing.push("設定點數");
        if (!reason) missing.push("選擇特質");
        
        awardBtn.disabled = true;
        awardBtn.innerHTML = `<i class="fas fa-exclamation-circle" style="color: #ef4444;"></i> 請先${missing.join('及')}... (等待設定)`;
        awardBtn.className = "btn-style secondary";
        awardBtn.style.background = "rgba(168, 85, 247, 0.05)";
        awardBtn.style.color = "var(--text-muted)";
        awardBtn.style.borderColor = "rgba(168, 85, 247, 0.15)";
        awardBtn.style.cursor = "default";
    }
}

function handleTeacherAwardPoints() {
    const activePreset = document.querySelector('.preset-btn.active');
    const customInput = document.getElementById('custom-points-input');
    let pointsAwarded = 0;
    if (customInput && customInput.value) {
        pointsAwarded = parseFloat(customInput.value);
    } else if (activePreset) {
        pointsAwarded = parseFloat(activePreset.dataset.val);
    }

    const activeCat = document.querySelector('.category-chip.active');
    const customReasonInput = document.getElementById('custom-reason-input');
    const customReason = customReasonInput ? customReasonInput.value.trim() : "";
    
    let categoryReason = "";
    if (activeCat) {
        if (activeCat.id === 'indicators-chip') {
            categoryReason = activeCat.getAttribute('data-selected-indicator');
        } else if (activeCat.id === 'languages-chip') {
            categoryReason = activeCat.getAttribute('data-selected-language');
        } else if (activeCat.id === 'artsports-chip') {
            categoryReason = activeCat.getAttribute('data-selected-artsports');
        } else {
            categoryReason = activeCat.getAttribute('data-val') || activeCat.innerText.trim();
        }
    }

    const reason = customReason || categoryReason;

    if (pointsAwarded > 0 && reason) {
        showToast(`自動感應加分就緒！學生直接刷卡，即可自動獲得 +${pointsAwarded} 點 (${reason})。`, "success");
    } else {
        showToast("自動感應加分模式：請先在左側面板中設定點數與特質原因。", "warning");
    }
}
function formatHistoryDate(isoString) {
    try {
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return "";
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const date = String(d.getDate()).padStart(2, '0');
        const h = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${m}/${date} ${h}:${min}`;
    } catch(e) {
        return "";
    }
}
function formatHistoryDateShort(isoString) {
    try {
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return "";
        const m = d.getMonth() + 1;
        const date = d.getDate();
        return `${m}/${date}`;
    } catch(e) {
        return "";
    }
}

// Helper: Hex color code to RGB component converter
function hexToRgb(hex) {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '139, 92, 246';
}

// Helper: 獲取各加分類別對應的代表色與 FontAwesome 圖示
function getCategoryMeta(target) {
    const map = {
        "學業": { color: "#3b82f6", icon: "fa-graduation-cap" },
        "圖書": { color: "#10b981", icon: "fa-book" },
        "宗德": { color: "#ec4899", icon: "fa-church" },
        "體育": { color: "#f97316", icon: "fa-running" },
        "視藝": { color: "#f59e0b", icon: "fa-palette" },
        "體藝": { color: "#f59e0b", icon: "fa-palette" }, // 舊數據相容
        "普通話": { color: "#a855f7", icon: "fa-comments" },
        "English": { color: "#6366f1", icon: "fa-language" }
    };
    return map[target] || { color: "#a855f7", icon: "fa-award" };
}

// =========================================================================
// 系統核心管理與清零模組 (System Core Admin & Reset Module)
// =========================================================================

async function forceClearAllScoresAndTransactions() {
    try {
        console.log("正在執行全校積分歷史清零...");
        
        // 1. 本地 LocalStorage 處理
        localStorage.removeItem('student_points_db_students');
        localStorage.removeItem('student_points_db_transactions');
        
        // 重新用預設的 0 分名冊初始化
        localStorage.setItem('student_points_db_students', JSON.stringify(window.DEFAULT_STUDENTS));
        localStorage.setItem('student_points_db_transactions', JSON.stringify([]));
        
        state.students = JSON.parse(JSON.stringify(window.DEFAULT_STUDENTS));
        state.transactions = [];
        
        // 2. 如果 Firebase 為連接狀態，將雲端的文檔一併清零或刪除！
        if (state.isFirebase && state.firebaseDb) {
            const { doc, writeBatch, collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
            
            console.log("檢測到 Firebase 雲端連接，正在同步清空雲端積分紀錄...");
            
            // A. 清空學生的積分與已兌換，全部設為 0
            const studentsSnap = await getDocs(collection(state.firebaseDb, "students"));
            let studentBatch = writeBatch(state.firebaseDb);
            let count = 0;
            
            for (const sDoc of studentsSnap.docs) {
                const sData = sDoc.data();
                studentBatch.set(doc(state.firebaseDb, "students", sDoc.id), {
                    ...sData,
                    points: 0,
                    redeemed: 0
                });
                count++;
                if (count % 400 === 0) {
                    await studentBatch.commit();
                    studentBatch = writeBatch(state.firebaseDb);
                }
            }
            if (count % 400 !== 0) {
                await studentBatch.commit();
            }
            console.log(`已成功將雲端 ${count} 筆學生積分重置為 0！`);
            
            // B. 刪除雲端 transactions 集合裡的所有歷史記錄
            const txSnap = await getDocs(collection(state.firebaseDb, "transactions"));
            let txBatch = writeBatch(state.firebaseDb);
            let txCount = 0;
            
            for (const tDoc of txSnap.docs) {
                txBatch.delete(doc(state.firebaseDb, "transactions", tDoc.id));
                txCount++;
                if (txCount % 400 === 0) {
                    await txBatch.commit();
                    txBatch = writeBatch(state.firebaseDb);
                }
            }
            if (txCount % 400 !== 0) {
                await txBatch.commit();
            }
            console.log(`已成功清除雲端 ${txCount} 筆交易歷史流水記錄！`);
        }
        
        localStorage.setItem('force_clear_scores_v121', 'done');
        console.log("全校積分與紀錄清零作業全部完成！");
        return true;
    } catch (e) {
        console.error("執行全校清零出錯:", e);
        return false;
    }
}

// =========================================================================
// Google 登入與安全綁定核心邏輯 (Google Login & Safe Binding Core Logic)
// =========================================================================

// 智能對接 Google 電郵與學籍
async function autoLoginStudentByGoogle(email) {
    if (!email) return;
    const lowerEmail = email.toLowerCase().trim();
    const prefix = lowerEmail.split('@')[0].trim();
    const cleanPrefix = prefix.replace(/^s/i, '');
    
    // 1. 優先精確匹配 email 屬性
    let student = state.students.find(s => s.email && s.email.toLowerCase().trim() === lowerEmail);
    
    // 2. 次優先匹配 studentNum (如 s261002)
    if (!student) {
        student = state.students.find(s => s.studentNum && s.studentNum.toLowerCase().trim() === prefix);
    }
    
    // 3. 若無精確匹配，嘗試用學籍前綴智能匹配 (包含 id、barcode 或 studentNum)
    if (!student) {
        student = state.students.find(s => {
            const cleanId = s.id ? s.id.trim().replace(/^0+/, '').toLowerCase() : '';
            const cleanBarcode = s.barcode ? s.barcode.trim().replace(/^0+/, '').toLowerCase() : '';
            const cleanStudentNum = s.studentNum ? s.studentNum.trim().toLowerCase() : '';
            
            return (cleanStudentNum && (cleanStudentNum === prefix || lowerEmail.includes(cleanStudentNum))) ||
                   (cleanId && (cleanId === prefix || cleanId === cleanPrefix || lowerEmail.includes(cleanId))) || 
                   (cleanBarcode && (cleanBarcode === prefix || cleanBarcode === cleanPrefix || lowerEmail.includes(cleanBarcode)));
        });
        if (student) {
            // 前綴配對成功，寫入電郵並持久化保存
            student.email = lowerEmail;
            await DB.saveStudent(student);
            logConsole(`智能匹配：檢測到電郵前綴匹配學生 [${student.name}] 的學籍，自動完成學籍對接。`, "success");
        }
    }
    
    if (student) {
        // 確保 student.email 記錄為該 Google 郵箱
        if (student.email !== lowerEmail) {
            student.email = lowerEmail;
            await DB.saveStudent(student);
        }

        state.kioskStudent = student;
        state.userRole = 'student';
        showToast(`🎉 歡迎回來，${student.class}班 ${student.number}號 ${student.name} 同學！已登入 Google 帳號。`, "success");
        triggerConfettiSmall();
        
        // 觸發畫面對應更新
        if (state.activeTab === 'student-shop') {
            renderAutomatedShopKiosk();
        } else {
            switchTab('student-profile');
            renderStudentProfileKiosk();
        }
    } else {
        // 未配對到任何學生，提示首次綁定並自動切換至學生個人面板分頁來顯示綁定表單
        state.kioskStudent = null;
        state.userRole = 'student';
        if (state.activeTab !== 'student-profile') {
            switchTab('student-profile');
        }
        renderStudentGoogleBindForm({ email });
    }
}

// 觸發 Google 登入
async function handleGoogleSignIn() {
    if (state.isFirebase && state.firebaseAuth) {
        try {
            // 極限防禦：若執行認證時發現記憶體中依舊缺失 authDomain，立即進行動態最終補全
            if (state.firebaseAuth && state.firebaseAuth.app && state.firebaseAuth.app.options && !state.firebaseAuth.app.options.authDomain) {
                const projId = state.firebaseAuth.app.options.projectId || "credit12345";
                state.firebaseAuth.app.options.authDomain = projId + ".firebaseapp.com";
                console.log("已完成 Google Auth 記憶體動態補足 authDomain:", state.firebaseAuth.app.options.authDomain);
            }

            const { GoogleAuthProvider, signInWithPopup } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js");
            const provider = new GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            
            showToast("正在開啟 Google 登入安全視窗...", "info");
            const result = await signInWithPopup(state.firebaseAuth, provider);
            const user = result.user;
            
            state.googleUser = {
                email: user.email,
                displayName: user.displayName || user.email.split('@')[0]
            };
            
            showToast(`Google 驗證成功: ${user.email}`, "success");
            await autoLoginStudentByGoogle(user.email);
        } catch (e) {
            console.error("Google Auth 失敗:", e);
            showToast("Google 登入失敗: " + (e.message || e), "danger");
        }
    } else {
        // 本地模式，呼叫高顏值 Mock 選擇框
        showSimulatedGoogleSignIn();
    }
}

// 離線本地模式下的高擬真 Google 選擇帳戶 Modal (支援即時搜尋與全校學生名冊)
function showSimulatedGoogleSignIn() {
    const existing = document.getElementById('mock-google-login-modal');
    if (existing) existing.remove();
    
    const modal = document.createElement('div');
    modal.id = 'mock-google-login-modal';
    modal.className = 'modal-overlay active';
    modal.style.zIndex = '1010';
    
    // 精選不同年級代表學生，增加測試便利性
    const sampleStudents = [
        state.students.find(s => s.class === '1A') || state.students[0],
        state.students.find(s => s.class === '3A') || state.students[100],
        state.students.find(s => s.class === '6A') || state.students[450]
    ].filter(Boolean);
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 480px; padding: 32px; border-radius: 20px; border: 1px solid rgba(0,0,0,0.08); box-shadow: 0 16px 40px rgba(139, 92, 246, 0.18); animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);">
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="font-size: 26px; font-weight: 800; font-family: 'Product Sans', -apple-system, sans-serif; letter-spacing: -1.5px; display: inline-flex; align-items: center; gap: 2px;">
                    <span style="color: #4285F4;">G</span>
                    <span style="color: #EA4335;">o</span>
                    <span style="color: #FBBC05;">o</span>
                    <span style="color: #4285F4;">g</span>
                    <span style="color: #34A853;">l</span>
                    <span style="color: #EA4335;">e</span>
                </div>
                <h3 style="font-size: 19px; font-weight: 700; margin-top: 10px; color: #202124;">選擇學生 Google 帳戶</h3>
                <p style="color: #5f6368; font-size: 13px; margin-top: 4px;">登入「天主教善導小學積點系統」(@mail.gccps.edu.hk)</p>
                <div style="background: rgba(168, 85, 247, 0.08); border-radius: 10px; padding: 8px 12px; font-size: 12px; color: #7c3aed; font-weight: 600; margin-top: 10px; border: 1px dashed rgba(168, 85, 247, 0.25);">
                    💡 已接通全校 1A-6D 共 ${state.students.length} 名學生官方 Google Workspace 帳號
                </div>
            </div>

            <!-- 即時搜尋學生 -->
            <div style="margin-bottom: 14px;">
                <input type="text" id="mock-student-search-input" class="input-style" placeholder="🔍 輸入學生姓名、學號 (如 s261002) 或班別 (如 1A)..." style="width: 100%; padding: 10px 14px; font-size: 13px; border-radius: 12px; border: 1.5px solid rgba(139, 92, 246, 0.2);">
            </div>
            
            <div id="mock-accounts-container" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; max-height: 220px; overflow-y: auto; padding-right: 4px;">
                ${sampleStudents.map(s => {
                    const mockEmail = s.email || `${s.studentNum || 's' + s.id}@mail.gccps.edu.hk`;
                    return `
                        <div class="mock-google-account-row" data-email="${mockEmail}" style="display: flex; align-items: center; gap: 12px; padding: 10px 14px; border: 1.5px solid rgba(139, 92, 246, 0.1); border-radius: 12px; cursor: pointer; transition: all 0.2s; background: rgba(139, 92, 246, 0.02); text-align: left;">
                            <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #8b5cf6, #ec4899); display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 14px; shrink: 0;">
                                ${s.name[0]}
                            </div>
                            <div style="flex: 1; overflow: hidden;">
                                <div style="font-size: 13.5px; font-weight: 700; color: #3c4043;">${s.name} ${s.nameEn ? `(${s.nameEn})` : ''} - <span style="color: #7c3aed;">${s.class}班 ${s.number}號</span></div>
                                <div style="font-size: 11.5px; color: #70757a; font-family: monospace;">${mockEmail}</div>
                            </div>
                            <div style="font-size: 10px; color: #4285f4; font-weight: 700; background: rgba(66,133,244,0.08); padding: 3px 6px; border-radius: 4px;">點擊登入</div>
                        </div>
                    `;
                }).join('')}
            </div>

            <div style="border-top: 1.5px solid #f1f3f4; margin: 12px 0 10px 0; padding-top: 12px;">
                <div style="font-size: 12.5px; font-weight: 700; color: #202124; margin-bottom: 8px; text-align: left;"><i class="fas fa-edit" style="color: var(--secondary); margin-right: 4px;"></i> 手動輸入自定義 Google 帳號 / 電郵：</div>
                <div style="display: flex; gap: 8px;">
                    <input type="email" id="mock-custom-email" class="input-style" placeholder="例如：s261002@mail.gccps.edu.hk" style="flex: 1; padding: 10px; font-size: 13px; border: 1.5px solid rgba(139, 92, 246, 0.15); border-radius: 10px;">
                    <button class="btn-style success" id="mock-custom-login-btn" style="background: linear-gradient(135deg, #8b5cf6, #6d28d9); color: white; border: none; padding: 0 16px; border-radius: 10px; font-weight: 800; font-size: 13px; cursor: pointer;">登入</button>
                </div>
            </div>
            
            <button class="btn-style secondary" id="mock-google-close-btn" style="width: 100%; padding: 11px; border-radius: 12px; font-size: 13.5px; font-weight: 700; background: rgba(0,0,0,0.03); color: var(--text-muted); border: 1.5px solid rgba(0,0,0,0.05); cursor: pointer;">取消</button>
        </div>
    `;
    
    document.body.appendChild(modal);

    const accountsContainer = modal.querySelector('#mock-accounts-container');
    const searchInput = modal.querySelector('#mock-student-search-input');

    const bindRows = () => {
        modal.querySelectorAll('.mock-google-account-row').forEach(row => {
            row.addEventListener('click', () => {
                const email = row.getAttribute('data-email');
                completeSimulatedLogin(email);
            });
        });
    };

    bindRows();

    // 即時名冊搜尋
    if (searchInput && accountsContainer) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim().toLowerCase();
            if (!query) {
                // 恢復推薦
                accountsContainer.innerHTML = sampleStudents.map(s => {
                    const mockEmail = s.email || `${s.studentNum || 's' + s.id}@mail.gccps.edu.hk`;
                    return `
                        <div class="mock-google-account-row" data-email="${mockEmail}" style="display: flex; align-items: center; gap: 12px; padding: 10px 14px; border: 1.5px solid rgba(139, 92, 246, 0.1); border-radius: 12px; cursor: pointer; transition: all 0.2s; background: rgba(139, 92, 246, 0.02); text-align: left;">
                            <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #8b5cf6, #ec4899); display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 14px; shrink: 0;">
                                ${s.name[0]}
                            </div>
                            <div style="flex: 1; overflow: hidden;">
                                <div style="font-size: 13.5px; font-weight: 700; color: #3c4043;">${s.name} ${s.nameEn ? `(${s.nameEn})` : ''} - <span style="color: #7c3aed;">${s.class}班 ${s.number}號</span></div>
                                <div style="font-size: 11.5px; color: #70757a; font-family: monospace;">${mockEmail}</div>
                            </div>
                            <div style="font-size: 10px; color: #4285f4; font-weight: 700; background: rgba(66,133,244,0.08); padding: 3px 6px; border-radius: 4px;">點擊登入</div>
                        </div>
                    `;
                }).join('');
                bindRows();
                return;
            }

            const matched = state.students.filter(s => {
                const n = (s.name || '').toLowerCase();
                const ne = (s.nameEn || '').toLowerCase();
                const cls = (s.class || '').toLowerCase();
                const sn = (s.studentNum || '').toLowerCase();
                const em = (s.email || '').toLowerCase();
                const id = (s.id || '').toLowerCase();
                return n.includes(query) || ne.includes(query) || cls.includes(query) || sn.includes(query) || em.includes(query) || id.includes(query);
            }).slice(0, 10);

            if (matched.length === 0) {
                accountsContainer.innerHTML = `<div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 13px;">找不到符合 "${query}" 的學生，可在下方手動輸入電郵</div>`;
            } else {
                accountsContainer.innerHTML = matched.map(s => {
                    const mockEmail = s.email || `${s.studentNum || 's' + s.id}@mail.gccps.edu.hk`;
                    return `
                        <div class="mock-google-account-row" data-email="${mockEmail}" style="display: flex; align-items: center; gap: 12px; padding: 10px 14px; border: 1.5px solid rgba(139, 92, 246, 0.1); border-radius: 12px; cursor: pointer; transition: all 0.2s; background: rgba(139, 92, 246, 0.02); text-align: left;">
                            <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #8b5cf6, #ec4899); display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 14px; shrink: 0;">
                                ${s.name[0]}
                            </div>
                            <div style="flex: 1; overflow: hidden;">
                                <div style="font-size: 13.5px; font-weight: 700; color: #3c4043;">${s.name} ${s.nameEn ? `(${s.nameEn})` : ''} - <span style="color: #7c3aed;">${s.class}班 ${s.number}號</span></div>
                                <div style="font-size: 11.5px; color: #70757a; font-family: monospace;">${mockEmail}</div>
                            </div>
                            <div style="font-size: 10px; color: #4285f4; font-weight: 700; background: rgba(66,133,244,0.08); padding: 3px 6px; border-radius: 4px;">點擊登入</div>
                        </div>
                    `;
                }).join('');
                bindRows();
            }
        });
    }
    
    // 綁定自定義輸入
    modal.querySelector('#mock-custom-login-btn').addEventListener('click', () => {
        const email = modal.querySelector('#mock-custom-email').value.trim();
        if (!email || !email.includes('@')) {
            showToast("請輸入有效的 Google 電郵地址！", "warning");
            return;
        }
        completeSimulatedLogin(email);
    });
    
    // 關閉
    modal.querySelector('#mock-google-close-btn').addEventListener('click', () => {
        modal.remove();
    });
}

function completeSimulatedLogin(email) {
    const modal = document.getElementById('mock-google-login-modal');
    if (modal) modal.remove();
    
    state.googleUser = {
        email: email,
        displayName: email.split('@')[0]
    };
    
    logConsole(`[模擬 Google] 帳號 ${email} 登入成功。`, "success");
    autoLoginStudentByGoogle(email);
}

// 渲染首次登入 Google 的學籍安全綁定表單
function renderStudentGoogleBindForm(googleUser) {
    const bodyContainer = document.getElementById('student-profile-display-body');
    if (!bodyContainer) return;
    
    bodyContainer.innerHTML = `
        <div class="glass-card" style="max-width: 500px; margin: 40px auto; padding: 32px; border: 1.5px solid rgba(168, 85, 247, 0.25); text-align: center; border-radius: 24px; animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); box-shadow: 0 12px 40px rgba(139, 92, 246, 0.12);">
            <div style="font-size: 52px; margin-bottom: 16px; animation: bounce 3s infinite;">🔐</div>
            <h3 style="font-size: 21px; font-weight: 800; background: linear-gradient(135deg, #8b5cf6, #db2777); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px;">首次 Google 登入安全綁定</h3>
            <p style="color: var(--text-muted); font-size: 13px; line-height: 1.6; margin-bottom: 24px; font-weight: 500; text-align: left; padding: 0 8px;">
                您好！您已驗證 Google 帳號：<br>
                <span style="color: var(--secondary); font-weight: 700; word-break: break-all; font-size: 14px; background: rgba(168, 85, 247, 0.05); padding: 4px 8px; border-radius: 6px; display: inline-block; margin-top: 4px;">${googleUser.email}</span><br><br>
                💡 這是您首次使用此帳戶，系統需要將您的 Google 身份對接至學校的名冊中。請輸入您的<strong>「學生卡 ID」</strong>和<strong>「學生姓名」</strong>進行一次性安全綁定。完成後，下次登入即可直接存取個人成績與歷史明細！
            </p>
            
            <div style="text-align: left; display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px; padding: 0 8px;">
                <div>
                    <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-main); margin-bottom: 6px;"><i class="fas fa-credit-card" style="color: var(--secondary);"></i> 學生卡 ID (Card ID)</label>
                    <input type="text" id="bind-student-id" class="input-style" placeholder="例如：10023457" style="width: 100%; border: 1.5px solid rgba(168, 85, 247, 0.15);">
                </div>
                <div>
                    <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-main); margin-bottom: 6px;"><i class="fas fa-user-circle" style="color: var(--secondary);"></i> 學生姓名 (Name)</label>
                    <input type="text" id="bind-student-name" class="input-style" placeholder="例如：黃蘇菲" style="width: 100%; border: 1.5px solid rgba(168, 85, 247, 0.15);">
                </div>
            </div>
            
            <div style="display: flex; gap: 12px; justify-content: center; padding: 0 8px;">
                <button class="btn-style secondary" id="bind-cancel-btn" style="flex: 1; padding: 12px; font-weight: 700; border-radius: 12px; cursor: pointer;">取消</button>
                <button class="btn-style success" id="bind-confirm-btn" style="flex: 2; padding: 12px; font-weight: 800; border-radius: 12px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(16,185,129,0.2);">確認安全對接 🔒</button>
            </div>
        </div>
    `;
    
    // 取消
    document.getElementById('bind-cancel-btn').addEventListener('click', () => {
        state.googleUser = null;
        renderStudentProfileKiosk();
    });
    
    // 確認綁定
    document.getElementById('bind-confirm-btn').addEventListener('click', async () => {
        const idInput = document.getElementById('bind-student-id').value.trim();
        const nameInput = document.getElementById('bind-student-name').value.trim();
        
        if (!idInput || !nameInput) {
            showToast("請完整輸入學生卡 ID 和姓名！", "warning");
            return;
        }
        
        // 尋找名冊中相符的學生 (雙重校驗以保證安全)
        const student = state.students.find(s => s.id === idInput && s.name === nameInput);
        if (student) {
            // 寫入電郵並存檔
            student.email = googleUser.email.toLowerCase();
            await DB.saveStudent(student);
            
            state.kioskStudent = student;
            showToast(`🎉 綁定成功！已成功關聯學生 [${student.name}] 的學籍。`, "success");
            logConsole(`學籍安全綁定：成功將 Google 帳號 ${googleUser.email} 與學生卡 ${student.id} (${student.name}) 進行一次性關聯寫入。`, "success");
            triggerConfettiBig();
            renderStudentProfileKiosk();
        } else {
            showToast("❌ 驗證配對失敗！找不到對應的學生卡 ID 與姓名組合，請核對後重新輸入。", "danger");
            logConsole(`安全警告：嘗試綁定 Google 帳號 ${googleUser.email}，但輸入的卡 ID [${idInput}] 與姓名 [${nameInput}] 在系統名冊中無匹配，拒絕訪問。`, "warning");
        }
    });
}

// 🌟 頁面一：學生自助查詢能量站渲染
function renderStudentProfileKiosk() {
    const s = state.kioskStudent;
    const bodyContainer = document.getElementById('student-profile-display-body');
    if (!bodyContainer) return;

    if (!s) {
        bodyContainer.innerHTML = `
            <div class="student-kiosk-empty" style="text-align: center; padding: 60px 20px; background: rgba(168, 85, 247, 0.03); border-radius: 24px; border: 3px dashed rgba(168, 85, 247, 0.15); animation: float 6s ease-in-out infinite;">
                <div style="font-size: 72px; animation: pulse 2s infinite; margin-bottom: 20px;">🦄</div>
                <h3 style="font-size: 26px; font-weight: 800; background: linear-gradient(135deg, #8b5cf6, #db2777); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">嗶！請把你的學生卡放上感應區查詢 🌟</h3>
                <p style="color: var(--text-muted); margin-top: 12px; max-width: 480px; margin-left: auto; margin-right: auto; font-size: 15px; line-height: 1.6; font-weight: 600;">
                    感應學生卡，就能召喚出你的<strong>「可用積點 ⭐」</strong>、<strong>「得獎明細 📜」</strong>及<strong>「多維閃耀數據 📊」</strong>，還有專屬勉勵話語等你解鎖！
                </p>
                <div style="margin-top: 28px; border-top: 1.5px dashed rgba(139, 92, 246, 0.15); padding-top: 24px;">
                    <span style="font-size: 13.5px; color: var(--text-muted); display: block; margin-bottom: 14px; font-weight: 700;"><i class="fas fa-home" style="color: var(--secondary); margin-right: 4px;"></i> 在家裡沒有神奇感應器？</span>
                    <button class="btn-style" id="student-google-login-btn" style="background: white; color: #374151; border: 1.5px solid #d1d5db; box-shadow: 0 4px 12px rgba(0,0,0,0.04); display: inline-flex; align-items: center; justify-content: center; gap: 10px; padding: 12px 28px; font-weight: 800; font-size: 15px; border-radius: 12px; cursor: pointer; transition: all 0.2s; min-width: 240px;">
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/button/google.svg" alt="Google" style="width: 18px; height: 18px;">
                        使用 Google 帳號登入 🔑
                    </button>
                </div>
            </div>
        `;
        document.getElementById('student-google-login-btn').addEventListener('click', handleGoogleSignIn);
        return;
    }

    // 計算多維度累積積分 (使用超強魯棒防禦性代碼，抵禦空數據或損壞數據)
    const earnedTx = (state.transactions || []).filter(t => t && t.studentId === s.id && t.type === 'earn');
    
    // 過濾出該學生的所有複利息交易，並按時間升序排列
    const interestTx = (state.transactions || [])
        .filter(t => t && t.studentId === s.id && t.type === 'interest')
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const totalInterestEarned = interestTx.reduce((sum, t) => sum + (parseFloat(t.points) || 0), 0);
    const academicPts = earnedTx.filter(t => t && t.target === "學業").reduce((sum, t) => sum + (parseFloat(t.points) || 0), 0);
    const bookPts = earnedTx.filter(t => t && t.target === "圖書").reduce((sum, t) => sum + (parseFloat(t.points) || 0), 0);
    const moralityPts = earnedTx.filter(t => t && t.target === "宗德").reduce((sum, t) => sum + (parseFloat(t.points) || 0), 0);
    const pePts = earnedTx.filter(t => t && t.target === "體育" || t && t.target === "體藝").reduce((sum, t) => sum + (parseFloat(t.points) || 0), 0);
    const artPts = earnedTx.filter(t => t && t.target === "視藝" || t && t.target === "體藝").reduce((sum, t) => sum + (parseFloat(t.points) || 0), 0);
    const pthPts = earnedTx.filter(t => t && t.target === "普通話").reduce((sum, t) => sum + (parseFloat(t.points) || 0), 0);
    const englishPts = earnedTx.filter(t => t && t.target === "English").reduce((sum, t) => sum + (parseFloat(t.points) || 0), 0);
    const indicatorPts = earnedTx.filter(t => t && t.target && !["學業", "圖書", "宗德", "體育", "視藝", "體藝", "普通話", "English"].includes(t.target)).reduce((sum, t) => sum + (parseFloat(t.points) || 0), 0);

    // 勉勵生成演算法
    const categoriesMap = {
        "📚 熱愛閱讀": bookPts,
        "🎓 學業優異": academicPts,
        "🙏 虔敬宗德": moralityPts,
        "🏅 守規楷模": indicatorPts,
        "🏃 體育健將": pePts,
        "🎨 視藝大師": artPts
    };
    let topCategory = "🌈 全面發展";
    let maxPts = 0;
    for (const [cat, pts] of Object.entries(categoriesMap)) {
        if (pts > maxPts) {
            maxPts = pts;
            topCategory = cat;
        }
    }

    let encouragement = "";
    if (s.points >= 250) {
        encouragement = `🌟 <strong>積點之王！</strong>你已經累積了高達 <strong style="color: #d97706; font-size: 16px;">${s.points} 點</strong> 驚人積點！在天主教善導小學中，你就是最閃亮的那顆「超新星」！你的卓越自律正在照亮身邊的每一位同學，請繼續保持這份領航風采，在榮耀中翱翔！🚀💫`;
    } else if (topCategory === "📚 熱愛閱讀" && maxPts > 0) {
        encouragement = `📚 <strong>「讀書破萬卷，下筆如有神。」</strong>看來你是一位熱愛閱讀、求知若渴的博學小天使！在圖書領域獲得的 <strong style="color: #8b5cf6;">${maxPts} 點</strong> 就是最好證明。希望你繼續在書海中揚帆起航，探索更多智慧寶藏！📖✨`;
    } else if (topCategory === "🎓 學業優異" && maxPts > 0) {
        encouragement = `🎓 <strong>「學海無涯，唯勤是岸。」</strong>你在學業上的專注與智慧令人讚嘆！學業領域累積的 <strong style="color: #3b82f6;">${maxPts} 點</strong> 閃爍著勤奮的光芒。你就是善導小學的「智慧先鋒」，繼續保持對科學與知識的渴望吧！🔬🌟`;
    } else if (topCategory === "🙏 虔敬宗德" && maxPts > 0) {
        encouragement = `⛪ <strong>「常懷感恩，樂於助人。」</strong>你在天主教善導小學展現了極其寶貴的心靈美德，宗德累積的 <strong style="color: #ec4899;">${maxPts} 點</strong> 如同一盞溫暖明燈。願你繼續傳播愛與和平，溫暖身邊的每一個人！✝️❤️`;
    } else if (topCategory === "🏅 守規楷模" && maxPts > 0) {
        encouragement = `🛡️ <strong>「言必信，行必果。」</strong>你在守規、誠實和日常品德上展現出了卓越的自律精神！累積的 <strong style="color: #10b981;">${maxPts} 點</strong> 德行指標是你最珍貴的榮譽勳章。你是同學們的最佳榜樣，繼續發揚自律之美！👍`;
    } else {
        encouragement = `🌈 <strong>「不積跬步，無以至千里。」</strong>你的每一點積點（當前累計可用：<strong style="color: #d97706;">${s.points} 點</strong>）都是你優秀行為的閃亮印記！善導小學為有你這樣積極向上的好孩子而感到無比自豪，繼續加油，展現你最棒的一面！🚀`;
    }

    bodyContainer.innerHTML = `
        <div class="kiosk-student-bar" style="background: rgba(255, 255, 255, 0.95); border: 1.5px solid rgba(168, 85, 247, 0.18); box-shadow: 0 8px 32px rgba(168, 85, 247, 0.06); margin-bottom: 20px;">
            <div class="kiosk-student-info">
                <div class="kiosk-avatar" style="background: linear-gradient(135deg, #ec4899, #8b5cf6); font-weight: 800; font-size: 20px; color: #fff;">${s.name.charAt(0)}</div>
                <div class="kiosk-meta">
                    <h3 style="font-size: 20px; font-weight: 800; color: var(--text-main);">🎉 歡迎，${s.name} 同學！✨</h3>
                    <p style="color: var(--text-dim); font-size: 13px; margin-top: 4px; font-weight: 600;">學生編號: <strong>${s.studentNum || s.id}</strong> | 班級: <strong style="color: var(--secondary);">${s.class} 班 (${s.number || '--'} 號)</strong> | 年級: <strong style="color: var(--primary);">${s.year}</strong></p>
                </div>
            </div>
            <div class="kiosk-balance" style="background: rgba(168, 85, 247, 0.04); border: 1.5px solid rgba(168, 85, 247, 0.12); border-radius: 16px; padding: 12px 24px; display: flex; align-items: center; gap: 14px;">
                <div class="kiosk-balance-star" style="font-size: 32px; animation: pulse 1.5s infinite;">⭐</div>
                <div style="text-align: left;">
                    <div class="bal-num" style="color: #d97706; font-size: 32px; font-weight: 900; line-height: 1;">${s.points}</div>
                    <div class="bal-label" style="font-size: 11px; font-weight: 700; color: var(--text-muted); margin-top: 4px;">當前可用積點餘額</div>
                </div>
            </div>
        </div>

        <div class="kiosk-main-grid" style="display: grid; grid-template-columns: 1.1fr 1fr; gap: 24px;">
            <!-- 左欄：嘉許得獎紀錄歷史日誌 -->
            <div class="glass-card" style="padding: 24px; display: flex; flex-direction: column; gap: 16px; min-height: 480px; max-height: 520px; overflow-y: auto; border: 1.5px solid rgba(168, 85, 247, 0.15); background: rgba(255, 255, 255, 0.95); box-shadow: 0 4px 20px rgba(168, 85, 247, 0.05);">
                <h3 style="font-size: 17px; font-weight: 800; color: #db2777; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid rgba(168, 85, 247, 0.12); padding-bottom: 14px; margin-bottom: 6px;">
                    <span style="font-size: 18px;">📜</span> 我的得獎明細（歷史獲得紀錄）
                </h3>
                <div class="kiosk-history-list" style="display: flex; flex-direction: column; gap: 12px;">
                    ${earnedTx.length === 0 ? `
                        <div style="text-align: center; color: var(--text-dim); padding: 80px 10px;">
                            <i class="fas fa-history" style="font-size: 32px; margin-bottom: 12px; color: rgba(168, 85, 247, 0.2);"></i>
                            <p style="font-size: 14px; font-weight: 600;">你還沒有積點紀錄哦，繼續加油！💪</p>
                        </div>
                    ` : earnedTx.map(tx => {
                        const meta = getCategoryMeta(tx.target);
                        const formattedDate = formatHistoryDate(tx.timestamp);
                        return `
                            <div class="kiosk-history-item" style="display: flex; justify-content: space-between; align-items: center; background: rgba(168, 85, 247, 0.02); border: 1.5px solid rgba(168, 85, 247, 0.06); border-radius: 8px; padding: 12px 14px; transition: all 0.2s;">
                                <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
                                    <div style="width: 32px; height: 32px; border-radius: 6px; background: rgba(${hexToRgb(meta.color)}, 0.1); border: 1px solid rgba(${hexToRgb(meta.color)}, 0.15); display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: ${meta.color}">
                                        <i class="fas ${meta.icon}" style="font-size: 14px;"></i>
                                    </div>
                                    <div style="min-width: 0;">
                                        <div style="font-size: 13px; font-weight: 700; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                            ${tx.target}
                                        </div>
                                        <div style="font-size: 11px; color: var(--text-dim); margin-top: 2px;">
                                            ${formattedDate}
                                        </div>
                                    </div>
                                </div>
                                <div style="font-size: 15px; font-weight: 800; color: var(--success); flex-shrink: 0; padding-left: 10px;">
                                    +${tx.points}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- 右欄：閃耀統計看板與校長勉勵語 -->
            <div style="display: flex; flex-direction: column; gap: 20px;">
                <!-- 統計看板 -->
                <div class="glass-card" style="padding: 24px; border: 1.5px solid rgba(168, 85, 247, 0.15); background: rgba(255, 255, 255, 0.95); box-shadow: 0 4px 20px rgba(168, 85, 247, 0.05); display: flex; flex-direction: column; gap: 16px;">
                    <h3 style="font-size: 17px; font-weight: 800; color: var(--primary); display: flex; align-items: center; gap: 10px; border-bottom: 1px solid rgba(168, 85, 247, 0.12); padding-bottom: 14px; margin-bottom: 6px;">
                        <span style="font-size: 18px;">📊</span> 我的多維閃耀得分數據
                    </h3>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <!-- 圖書 -->
                        <div>
                            <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-bottom: 6px; color: #475569;">
                                <span>📚 圖書閱讀</span><span>${bookPts} 點</span>
                            </div>
                            <div style="width: 100%; height: 8px; background: rgba(0,0,0,0.04); border-radius: 4px; overflow: hidden;">
                                <div style="width: ${Math.min((bookPts/100)*100, 100)}%; height: 100%; background: #00f59b; border-radius: 4px; transition: width 0.5s;"></div>
                            </div>
                        </div>
                        <!-- 學業 -->
                        <div>
                            <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-bottom: 6px; color: #475569;">
                                <span>🎓 學業表現</span><span>${academicPts} 點</span>
                            </div>
                            <div style="width: 100%; height: 8px; background: rgba(0,0,0,0.04); border-radius: 4px; overflow: hidden;">
                                <div style="width: ${Math.min((academicPts/100)*100, 100)}%; height: 100%; background: #38bdf8; border-radius: 4px; transition: width 0.5s;"></div>
                            </div>
                        </div>
                        <!-- 宗德 -->
                        <div>
                            <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-bottom: 6px; color: #475569;">
                                <span>⛪ 宗教道德</span><span>${moralityPts} 點</span>
                            </div>
                            <div style="width: 100%; height: 8px; background: rgba(0,0,0,0.04); border-radius: 4px; overflow: hidden;">
                                <div style="width: ${Math.min((moralityPts/100)*100, 100)}%; height: 100%; background: #ff49db; border-radius: 4px; transition: width 0.5s;"></div>
                            </div>
                        </div>
                        <!-- 體育 -->
                        <div>
                            <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-bottom: 6px; color: #475569;">
                                <span>🏃 體育運動</span><span>${pePts} 點</span>
                            </div>
                            <div style="width: 100%; height: 8px; background: rgba(0,0,0,0.04); border-radius: 4px; overflow: hidden;">
                                <div style="width: ${Math.min((pePts/100)*100, 100)}%; height: 100%; background: #f97316; border-radius: 4px; transition: width 0.5s;"></div>
                            </div>
                        </div>
                        <!-- 視藝 -->
                        <div>
                            <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-bottom: 6px; color: #475569;">
                                <span>🎨 視覺藝術</span><span>${artPts} 點</span>
                            </div>
                            <div style="width: 100%; height: 8px; background: rgba(0,0,0,0.04); border-radius: 4px; overflow: hidden;">
                                <div style="width: ${Math.min((artPts/100)*100, 100)}%; height: 100%; background: #ffcc00; border-radius: 4px; transition: width 0.5s;"></div>
                            </div>
                        </div>
                        <!-- 德育品德指標 -->
                        <div>
                            <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-bottom: 6px; color: #475569;">
                                <span>🛡️ 品德與守規指標</span><span>${indicatorPts} 點</span>
                            </div>
                            <div style="width: 100%; height: 8px; background: rgba(0,0,0,0.04); border-radius: 4px; overflow: hidden;">
                                <div style="width: ${Math.min((indicatorPts/100)*100, 100)}%; height: 100%; background: #a855f7; border-radius: 4px; transition: width 0.5s;"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 每日 1% 複利息增長圖表 -->
                <div class="glass-card" style="padding: 24px; border: 1.5px solid rgba(245, 158, 11, 0.2); background: rgba(255, 255, 255, 0.95); box-shadow: 0 4px 20px rgba(245, 158, 11, 0.05); display: flex; flex-direction: column; gap: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(245, 158, 11, 0.12); padding-bottom: 14px; margin-bottom: 6px;">
                        <h3 style="font-size: 17px; font-weight: 800; color: #b45309; display: flex; align-items: center; gap: 10px; margin: 0;">
                            <span style="font-size: 18px;">💰</span> 每日 1% 複利息回報
                        </h3>
                        <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 20px; padding: 4px 12px; font-size: 12.5px; font-weight: 800; color: #b45309; display: flex; align-items: center; gap: 4px;">
                            累積已賺取: <strong style="color: #d97706;">+${totalInterestEarned} ⭐</strong>
                        </div>
                    </div>
                    
                    ${(() => {
                        if (interestTx.length === 0) {
                            return `
                                <div style="text-align: center; padding: 24px 16px; background: rgba(245, 158, 11, 0.02); border-radius: 12px; border: 1.5px dashed rgba(245, 158, 11, 0.15); display: flex; flex-direction: column; align-items: center; gap: 10px;">
                                    <div style="font-size: 36px; animation: float 3s ease-in-out infinite;">🌱</div>
                                    <h4 style="font-size: 14.5px; font-weight: 800; color: #b45309; margin: 0;">複利息孵化中...</h4>
                                    <p style="font-size: 12px; color: #78350f; line-height: 1.6; max-width: 320px; margin: 0; font-weight: 600;">
                                        系統每天將自動為您的可用積點餘額（當前 <strong>${s.points} ⭐</strong>）發放 **1%** 的每日複利回報！<br>
                                        <span style="color: #d97706;">💰 存得越多、不急著兌換，利息滾動得越快哦！</span>
                                    </p>
                                </div>
                            `;
                        } else {
                            // 取最近的最多 7 筆計息紀錄
                            const plotData = interestTx.slice(-7);
                            const svgW = 420;
                            const svgH = 140;
                            const padL = 35;
                            const padR = 20;
                            const padT = 20;
                            const padB = 25;

                            const maxVal = Math.max(...plotData.map(t => t.points), 3);
                            const minVal = 0;
                            const valRange = maxVal - minVal;

                            const pointsCoords = [];
                            const xStep = (svgW - padL - padR) / Math.max(plotData.length - 1, 1);

                            plotData.forEach((t, index) => {
                                const x = padL + index * xStep;
                                const y = svgH - padB - ((t.points - minVal) / valRange) * (svgH - padT - padB);
                                pointsCoords.push({ x, y, val: t.points, date: formatHistoryDateShort(t.timestamp) });
                            });

                            let pathD = '';
                            let areaD = '';
                            if (pointsCoords.length > 0) {
                                pathD = `M ${pointsCoords[0].x} ${pointsCoords[0].y}`;
                                areaD = `M ${pointsCoords[0].x} ${svgH - padB} L ${pointsCoords[0].x} ${pointsCoords[0].y}`;
                                for (let i = 1; i < pointsCoords.length; i++) {
                                    pathD += ` L ${pointsCoords[i].x} ${pointsCoords[i].y}`;
                                    areaD += ` L ${pointsCoords[i].x} ${pointsCoords[i].y}`;
                                }
                                areaD += ` L ${pointsCoords[pointsCoords.length - 1].x} ${svgH - padB} Z`;
                            }

                            const gridLines = [];
                            const gridSteps = 3;
                            for (let i = 0; i <= gridSteps; i++) {
                                const val = Math.round(minVal + (valRange / gridSteps) * i);
                                const y = svgH - padB - (i / gridSteps) * (svgH - padT - padB);
                                gridLines.push(`
                                    <line x1="${padL}" y1="${y}" x2="${svgW - padR}" y2="${y}" stroke="rgba(245, 158, 11, 0.08)" stroke-width="1" />
                                    <text x="${padL - 8}" y="${y + 4}" fill="#d97706" font-size="10" font-weight="700" text-anchor="end">${val}⭐</text>
                                `);
                            }

                            return `
                                <div style="position: relative;">
                                    <svg viewBox="0 0 ${svgW} ${svgH}" style="width: 100%; height: auto; overflow: visible;">
                                        <defs>
                                            <linearGradient id="interest-grad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.25" />
                                                <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.0" />
                                            </linearGradient>
                                        </defs>
                                        ${gridLines.join('')}
                                        ${areaD ? `<path d="${areaD}" fill="url(#interest-grad)" />` : ''}
                                        ${pathD ? `<path d="${pathD}" fill="none" stroke="#d97706" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />` : ''}
                                        ${pointsCoords.map(pt => `
                                            <circle cx="${pt.x}" cy="${pt.y}" r="4.5" fill="#f59e0b" stroke="#fff" stroke-width="1.5" />
                                            <text x="${pt.x}" y="${pt.y - 8}" fill="#b45309" font-size="9" font-weight="800" text-anchor="middle">+${pt.val}</text>
                                            <text x="${pt.x}" y="${svgH - 8}" fill="#92400e" font-size="9" font-weight="700" text-anchor="middle">${pt.date}</text>
                                        `).join('')}
                                        <line x1="${padL}" y1="${svgH - padB}" x2="${svgW - padR}" y2="${svgH - padB}" stroke="rgba(245, 158, 11, 0.15)" stroke-width="1.5" />
                                    </svg>
                                </div>
                            `;
                        }
                    })()}
                </div>

                <!-- 校長勉勵語 -->
                <div class="glass-card" style="padding: 20px; border: 2.5px solid rgba(245, 158, 11, 0.25); background: linear-gradient(135deg, rgba(254, 243, 199, 0.8), #fff); box-shadow: 0 4px 20px rgba(245, 158, 11, 0.08); position: relative; border-radius: 16px;">
                    <div style="font-size: 32px; position: absolute; top: -14px; left: 16px; background: #fff; border-radius: 50%; padding: 4px; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.08);">💌</div>
                    <div style="margin-top: 14px;">
                        <h4 style="font-size: 14px; font-weight: 800; color: #b45309; margin-bottom: 8px;">💖 善導大師勉勵信箱：</h4>
                        <p style="font-size: 13.5px; color: #78350f; line-height: 1.6; font-weight: 600; text-align: justify; text-justify: inter-ideograph;">
                            ${encouragement}
                        </p>
                    </div>
                </div>

                <!-- 退出登出 -->
                <button class="btn-style secondary" id="profile-signout-btn" style="background: rgba(239, 68, 68, 0.08); border: 1.5px solid rgba(239, 68, 68, 0.2); color: #dc2626; font-weight: 800; width: 100%; font-size: 14px; padding: 12px; border-radius: 12px;"><i class="fas fa-sign-out-alt" style="margin-right: 6px;"></i> 登出帳號並退卡 🚪</button>
            </div>
        </div>
    `;

    document.getElementById('profile-signout-btn').addEventListener('click', async () => {
        state.kioskStudent = null;
        if (state.isFirebase && state.firebaseAuth) {
            try {
                const { signOut } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js");
                await signOut(state.firebaseAuth);
                state.googleUser = null;
                showToast("已成功登出 Google 帳號與退卡", "success");
            } catch (e) {
                console.error("Firebase SignOut error:", e);
            }
        } else {
            state.googleUser = null;
        }
        renderStudentProfileKiosk();
    });
}

// 🛍️ 頁面二：全自動自助超市（包含學生自主兌換貨架 & 協理生收銀手動扣點模式）
function renderAutomatedShopKiosk() {
    const bodyContainer = document.getElementById('kiosk-display-body');
    if (!bodyContainer) return;

    // A. 頂部模式切換器 HTML
    const modeSelectorHtml = `
        <div class="shop-mode-selector" style="display: flex; background: rgba(15, 23, 42, 0.05); padding: 5px; border-radius: 14px; margin-bottom: 24px; width: fit-content; border: 1.5px solid rgba(15, 23, 42, 0.03); box-shadow: inset 0 2px 4px rgba(0,0,0,0.02); animation: fadeIn 0.3s ease-out;">
            <button class="shop-mode-btn" data-mode="self-service" style="padding: 10px 22px; border-radius: 10px; font-weight: 800; font-size: 14px; border: none; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.25s; background: ${state.shopMode === 'self-service' ? 'linear-gradient(135deg, #a855f7, #8b5cf6)' : 'transparent'}; color: ${state.shopMode === 'self-service' ? 'white' : 'var(--text-muted)'}; box-shadow: ${state.shopMode === 'self-service' ? '0 4px 14px rgba(139, 92, 246, 0.25)' : 'none'};">
                <i class="fas fa-shopping-basket"></i> 🛍️ 學生自助兌換超市
            </button>
            <button class="shop-mode-btn" data-mode="checkout" style="padding: 10px 22px; border-radius: 10px; font-weight: 800; font-size: 14px; border: none; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.25s; background: ${state.shopMode === 'checkout' ? 'linear-gradient(135deg, #06b6d4, #0891b2)' : 'transparent'}; color: ${state.shopMode === 'checkout' ? 'white' : 'var(--text-muted)'}; box-shadow: ${state.shopMode === 'checkout' ? '0 4px 14px rgba(6, 182, 212, 0.25)' : 'none'};">
                <i class="fas fa-cash-register"></i> 📟 協理生快速收銀扣點
            </button>
        </div>
    `;

    // 如果當前是收銀手動扣點模式，轉向專屬面板渲染
    if (state.shopMode === 'checkout') {
        renderCheckoutKioskPanel(bodyContainer, modeSelectorHtml);
        
        // 綁定模式切換按鈕事件
        bodyContainer.querySelectorAll('.shop-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                state.shopMode = btn.dataset.mode;
                if (state.shopMode === 'checkout') {
                    state.checkoutPrice = 0;
                    state.checkoutStatus = 'idle';
                    state.checkoutResultStudent = null;
                }
                renderAutomatedShopKiosk();
            });
        });
        return;
    }

    const g = state.selectedRedeemGift;

    bodyContainer.innerHTML = modeSelectorHtml + `
        <!-- 超市頂部步驟常駐引導欄 -->
        <div class="kiosk-student-bar" style="background: ${g ? 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.02))' : 'rgba(255, 255, 255, 0.95)'}; border: 1.5px solid ${g ? '#10b981' : 'rgba(168, 85, 247, 0.18)'}; box-shadow: 0 8px 32px rgba(168, 85, 247, 0.06); margin-bottom: 24px; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; gap: 20px; border-radius: 16px;">
            <div style="display: flex; align-items: center; gap: 16px;">
                ${g ? `
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(16,185,129,0.1); border: 2px solid #10b981; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #10b981; animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);"><i class="fas fa-check"></i></div>
                    <div>
                        <h3 style="font-size: 18px; font-weight: 800; color: #10b981;">🟢 步驟 2：已選定「${g.name}」！</h3>
                        <p style="color: #475569; font-size: 13.5px; font-weight: 600; margin-top: 4px;">
                            🎯 兌換價值：<strong>${g.cost} ⭐ 積點</strong> | 現在請直接<strong style="color: #8b5cf6;">「嗶卡感應」</strong>${(!state.googleUser) ? '或點擊右側<strong>「Google 登入」</strong>在家操作' : ''}！
                        </p>
                    </div>
                ` : `
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(139,92,246,0.1); border: 2px solid #8b5cf6; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #8b5cf6; animation: float 3s ease-in-out infinite;"><i class="fas fa-shopping-basket"></i></div>
                    <div>
                        <h3 style="font-size: 18px; font-weight: 800; color: #4338ca;">🛒 步驟 1：請在下方貨架點選你想兌換的神奇寶物 🎁</h3>
                        <p style="color: var(--text-muted); font-size: 13.5px; font-weight: 600; margin-top: 4px;">
                            點選下方您最心儀的寶貝禮物後，即能激活高速感應自動兌換通道，極致流暢！
                            ${(!state.googleUser) ? `
                                <br><span style="color: #7c3aed; font-size: 12px; font-weight: 700;"><i class="fas fa-home"></i> 在家上網？可先點選右側<strong>「使用 Google 登入」</strong>進行學籍綁定並在線兌換！</span>
                            ` : ''}
                        </p>
                    </div>
                `}
            </div>
            
            <!-- 閃耀自動雷達聲納圈 / Google 在家兌換按鈕 -->
            ${g ? `
                ${(state.googleUser && state.kioskStudent) ? `
                    <button class="btn-style success" id="web-redeem-btn" style="background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; box-shadow: 0 4px 12px rgba(16,185,129,0.25); border-radius: 12px; font-weight: 800; font-size: 14px; padding: 10px 20px; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; animation: pulse 2s infinite; white-space: nowrap;">
                        <i class="fas fa-shopping-cart"></i> 🏠 在家確認扣點兌換
                    </button>
                ` : `
                    <div class="scan-area-container" style="padding: 0; background: transparent; border: none; flex-shrink: 0; flex-direction: row; gap: 10px;">
                        <div class="scan-radar" style="width: 42px; height: 42px;">
                            <div class="radar-circle" style="border-color: #10b981;"></div>
                            <div class="radar-circle" style="border-color: #10b981;"></div>
                            <div class="radar-circle" style="border-color: #10b981;"></div>
                            <div class="radar-core" style="background: linear-gradient(135deg, #10b981, #34d399); color: #fff;">
                                <i class="fas fa-broadcast-tower" style="font-size: 13px;"></i>
                            </div>
                        </div>
                        <span style="font-size: 13px; color: #10b981; font-weight: 800; animation: pulse 1.5s infinite; white-space: nowrap;">等待嗶卡自動扣點...</span>
                    </div>
                `}
            ` : `
                ${(!state.googleUser) ? `
                    <button class="btn-style" id="shop-google-login-btn" style="background: white; color: #374151; border: 1.5px solid #d1d5db; display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; font-weight: 800; font-size: 13px; border-radius: 10px; cursor: pointer; transition: all 0.2s; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/button/google.svg" alt="Google" style="width: 14px; height: 14px;">
                        Google 登入
                    </button>
                ` : `
                    <div style="display: flex; align-items: center; gap: 8px; color: var(--text-muted); font-size: 13px; font-weight: 700; background: rgba(0,0,0,0.03); padding: 8px 16px; border-radius: 20px; white-space: nowrap;">
                        <i class="fas fa-lock-open" style="font-size: 11px;"></i> 先點選寶物
                    </div>
                `}
            `}
        </div>

        <!-- 禮物網格貨架 -->
        <div style="display: flex; flex-direction: column; gap: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h2 style="font-size: 20px; font-weight: 800; display: flex; align-items: center; gap: 8px; color: var(--text-main);">
                    🛍️ 善導神奇寶貝自動貨架 <span style="font-size: 16px; animation: pulse 2s infinite;">✨</span>
                </h2>
                ${g ? `
                    <button class="btn-style secondary" id="shop-clear-selection-btn" style="background: rgba(239, 68, 68, 0.08); border: 1.5px solid rgba(239, 68, 68, 0.2); color: #dc2626; font-weight: 800; padding: 6px 14px; font-size: 12px; border-radius: 8px;">
                        <i class="fas fa-times-circle"></i> 取消選擇
                    </button>
                ` : ''}
            </div>
            <div class="gifts-grid" id="kiosk-gifts-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 20px;">
                <!-- 動態注入網格 -->
            </div>
        </div>
    `;

    // 綁定模式切換按鈕事件
    bodyContainer.querySelectorAll('.shop-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.shopMode = btn.dataset.mode;
            if (state.shopMode === 'checkout') {
                state.checkoutPrice = 0;
                state.checkoutStatus = 'idle';
                state.checkoutResultStudent = null;
            }
            renderAutomatedShopKiosk();
        });
    });

    // 綁定清除按鈕事件
    const clearBtn = document.getElementById('shop-clear-selection-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            state.selectedRedeemGift = null;
            renderAutomatedShopKiosk();
        });
    }

    // 綁定 Google 登入按鈕 (若有)
    const googleLoginBtn = document.getElementById('shop-google-login-btn');
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', handleGoogleSignIn);
    }

    // 綁定在線承兌按鈕 (若有)
    const webRedeemBtn = document.getElementById('web-redeem-btn');
    if (webRedeemBtn && g && state.kioskStudent) {
        webRedeemBtn.addEventListener('click', () => {
            executeGiftRedemption(state.kioskStudent, g);
        });
    }

    renderAutomatedGiftsGrid();
    initShopSuccessModalEvents();
}

// 📟 協理生收銀手動快速扣點主面板渲染
function renderCheckoutKioskPanel(container, modeSelectorHtml) {
    const price = state.checkoutPrice || 0;
    const status = state.checkoutStatus || 'idle';
    const resultStudent = state.checkoutResultStudent;

    container.innerHTML = modeSelectorHtml + `
        <div style="display: grid; grid-template-columns: 1fr 1.2fr; gap: 24px; animation: fadeIn 0.4s ease-out;">
            <!-- 左邊欄：收銀設定 -->
            <div class="glass-card" style="padding: 24px; border-radius: 20px; border: 1.5px solid rgba(139, 92, 246, 0.15); display: flex; flex-direction: column; gap: 20px; background: rgba(255, 255, 255, 0.95); box-shadow: 0 10px 30px rgba(0,0,0,0.04);">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 36px; height: 36px; border-radius: 50%; background: rgba(6, 182, 212, 0.1); display: flex; align-items: center; justify-content: center; color: #0891b2; font-size: 16px;">
                        <i class="fas fa-calculator"></i>
                    </div>
                    <div>
                        <h3 style="font-size: 16px; font-weight: 800; color: #1e1b4b; margin: 0;">第一步：收銀定價設定</h3>
                        <p style="font-size: 12px; color: var(--text-muted); margin: 2px 0 0 0;">請協理生輸入商品價格，點數將自學生帳號扣除</p>
                    </div>
                </div>

                <!-- 定價輸入框 -->
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <label style="font-size: 13px; font-weight: 700; color: #475569;">💰 商品價格（積點 ⭐）</label>
                    <div style="position: relative; display: flex; align-items: center;">
                        <span style="position: absolute; left: 16px; font-size: 20px; color: #06b6d4; font-weight: 800;">⭐</span>
                        <input type="number" id="checkout-price-input" value="${price || ''}" placeholder="請輸入價格..." min="1" step="1" style="width: 100%; padding: 12px 16px 12px 48px; border-radius: 12px; border: 2.5px solid #06b6d4; font-size: 20px; font-weight: 800; color: #0f172a; outline: none; transition: border-color 0.2s;" />
                    </div>
                </div>

                <!-- 快速預設定價 -->
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <label style="font-size: 12px; font-weight: 700; color: #475569; display: flex; justify-content: space-between;">
                        <span>⚡ 快速預設定價</span>
                        <span style="font-size: 11px; color: #0891b2; cursor: pointer;" id="checkout-clear-price-btn"><i class="fas fa-trash-alt"></i> 清除</span>
                    </label>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                        ${[5, 10, 15, 20, 30, 50].map(p => `
                            <button class="btn-style secondary checkout-preset-btn" data-val="${p}" style="border: 2px solid ${price === p ? '#06b6d4' : 'rgba(6,182,212,0.12)'}; background: ${price === p ? 'rgba(6,182,212,0.08)' : 'rgba(255,255,255,0.6)'}; color: ${price === p ? '#0891b2' : '#0f172a'}; font-weight: 800; font-size: 14px; padding: 10px; border-radius: 10px; cursor: pointer; transition: all 0.2s;">
                                ${p} ⭐
                            </button>
                        `).join('')}
                    </div>
                </div>

                <!-- 商品名稱 / 備註 -->
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <label style="font-size: 13px; font-weight: 700; color: #475569;">📝 交易商品說明（選填）</label>
                    <input type="text" id="checkout-reason-input" placeholder="例如：神奇文具、幸運禮包、自訂購買..." value="${state.checkoutReason || ''}" style="width: 100%; padding: 10px 14px; border-radius: 10px; border: 1.5px solid #cbd5e1; font-size: 13.5px; outline: none;" />
                </div>
            </div>

            <!-- 右邊欄：嗶卡狀態與顯示 -->
            <div class="glass-card" style="padding: 24px; border-radius: 20px; border: 1.5px solid rgba(139, 92, 246, 0.15); display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 380px; background: rgba(255, 255, 255, 0.95); box-shadow: 0 10px 30px rgba(0,0,0,0.04); text-align: center; position: relative;">
                ${status === 'idle' ? `
                    <!-- 閒置狀態 -->
                    <div style="animation: scaleIn 0.3s ease-out; display: flex; flex-direction: column; align-items: center; gap: 16px;">
                        <div style="font-size: 56px;">📟</div>
                        <h3 style="font-size: 18px; font-weight: 800; color: #1e1b4b; margin: 0;">等待協理生設定價格...</h3>
                        <p style="font-size: 13px; color: var(--text-muted); max-width: 280px; line-height: 1.6; margin: 0;">
                            請在左側輸入或選擇交易金額。定價大於 0 時將會自動激活嗶卡感應通道。
                        </p>
                    </div>
                ` : status === 'waiting' ? `
                    <!-- 等待嗶卡狀態 -->
                    <div style="animation: scaleIn 0.3s ease-out; display: flex; flex-direction: column; align-items: center; gap: 20px; width: 100%;">
                        <div style="background: rgba(6,182,212,0.05); border: 2.5px dashed #06b6d4; border-radius: 16px; padding: 14px 24px; width: 85%;">
                            <span style="font-size: 13px; color: #0891b2; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">當前扣點售價</span>
                            <h2 style="font-size: 40px; font-weight: 900; color: #0891b2; margin: 4px 0 0 0;">⭐ ${price} 點</h2>
                        </div>
                        
                        <!-- 閃耀聲納雷達 -->
                        <div class="scan-area-container" style="padding: 0; background: transparent; border: none; flex-direction: column; gap: 14px; margin: 10px 0;">
                            <div class="scan-radar" style="width: 80px; height: 80px;">
                                <div class="radar-circle" style="border-color: #06b6d4; border-width: 3px;"></div>
                                <div class="radar-circle" style="border-color: #06b6d4; border-width: 3px;"></div>
                                <div class="radar-circle" style="border-color: #06b6d4; border-width: 3px;"></div>
                                <div class="radar-core" style="background: linear-gradient(135deg, #06b6d4, #0891b2); color: #fff; font-size: 24px;">
                                    <i class="fas fa-rss" style="animation: float 2s ease-in-out infinite;"></i>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 style="font-size: 18px; font-weight: 800; color: #0891b2; animation: pulse 1.5s infinite; margin: 0 0 4px 0;">🔔 扣點通道已激活！</h3>
                            <p style="font-size: 13.5px; color: #475569; font-weight: 600; margin: 0;">請學生同學<strong>「嗶卡感應」</strong>完成扣點交易</p>
                        </div>
                    </div>
                ` : status === 'success' && resultStudent ? `
                    <!-- 扣點成功狀態 -->
                    <div style="animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); display: flex; flex-direction: column; align-items: center; gap: 16px; width: 100%;">
                        <div style="width: 64px; height: 64px; border-radius: 50%; background: rgba(16,185,129,0.1); border: 3px solid #10b981; display: flex; align-items: center; justify-content: center; font-size: 28px; color: #10b981; box-shadow: 0 4px 15px rgba(16,185,129,0.2);">
                            <i class="fas fa-check"></i>
                        </div>
                        
                        <div>
                            <h3 style="font-size: 20px; font-weight: 800; color: #10b981; margin: 0 0 4px 0;">✅ 扣點交易成功！</h3>
                            <p style="font-size: 13px; color: var(--text-muted); margin: 0;">已完成點數扣減，歡迎再次光臨神奇超市</p>
                        </div>

                        <div style="background: linear-gradient(135deg, rgba(16,185,129,0.05), rgba(16,185,129,0.01)); border: 1.5px solid rgba(16,185,129,0.15); border-radius: 16px; padding: 16px; width: 90%; display: flex; flex-direction: column; gap: 8px;">
                            <div style="display: flex; justify-content: space-between; font-size: 13.5px; font-weight: 600; color: #1e1b4b;">
                                <span>消費學生：</span>
                                <strong style="color: #4f46e5; font-size: 14.5px;">${resultStudent.class} 班 ${resultStudent.name} (${resultStudent.number || '--'}號)</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 13.5px; font-weight: 600; color: #475569; border-top: 1px dashed rgba(0,0,0,0.06); padding-top: 6px;">
                                <span>商品定價：</span>
                                <strong style="color: #ef4444;">-${price} 點</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 13.5px; font-weight: 600; color: #475569; border-top: 1px dashed rgba(0,0,0,0.06); padding-top: 6px;">
                                <span>學生賸餘可用點數：</span>
                                <strong style="color: #10b981; font-size: 15px;">${resultStudent.points} 點</strong>
                            </div>
                        </div>

                        <button id="checkout-reset-btn" class="btn-style success" style="background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; font-weight: 800; font-size: 13px; padding: 10px 24px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(16,185,129,0.25);">
                            <i class="fas fa-shopping-cart"></i> 繼續下一筆收銀交易
                        </button>
                    </div>
                ` : status === 'error' ? `
                    <!-- 扣點失敗狀態 -->
                    <div style="animation: scaleIn 0.3s ease-out; display: flex; flex-direction: column; align-items: center; gap: 16px; width: 100%;">
                        <div style="width: 64px; height: 64px; border-radius: 50%; background: rgba(239,68,68,0.1); border: 3px solid #ef4444; display: flex; align-items: center; justify-content: center; font-size: 28px; color: #ef4444; box-shadow: 0 4px 15px rgba(239,68,68,0.2);">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        
                        <div>
                            <h3 style="font-size: 18px; font-weight: 800; color: #ef4444; margin: 0 0 4px 0;">❌ 扣點失敗：可用餘額不足！</h3>
                            <p style="font-size: 13px; color: var(--text-muted); margin: 0;">請提醒同學繼續加油積累積分哦 💪</p>
                        </div>

                        ${state.lastCheckoutAttemptStudent ? `
                        <div style="background: rgba(239,68,68,0.02); border: 1.5px solid rgba(239,68,68,0.12); border-radius: 14px; padding: 12px; width: 85%; font-size: 13px; font-weight: 600; color: #475569; display: flex; flex-direction: column; gap: 6px;">
                            <div style="display: flex; justify-content: space-between;">
                                <span>消費同學：</span><span>${state.lastCheckoutAttemptStudent.class} 班 ${state.lastCheckoutAttemptStudent.name}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; border-top: 1px dashed rgba(0,0,0,0.06); padding-top: 4px;">
                                <span>商品售價：</span><strong style="color: #ef4444;">${price} 點</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; border-top: 1px dashed rgba(0,0,0,0.06); padding-top: 4px;">
                                <span>實際餘額：</span><strong style="color: #64748b;">${state.lastCheckoutAttemptStudent.points} 點</strong>
                            </div>
                        </div>
                        ` : ''}

                        <button id="checkout-retry-btn" class="btn-style secondary" style="border: 1.5px solid #cbd5e1; font-weight: 800; font-size: 13px; padding: 10px 24px; border-radius: 10px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px; background: white;">
                            <i class="fas fa-redo"></i> 重試 / 重新嗶卡
                        </button>
                    </div>
                ` : ''}
            </div>
        </div>
    `;

    // 1. 綁定收銀定價輸入框即時修改事件
    const priceInput = container.querySelector('#checkout-price-input');
    if (priceInput) {
        priceInput.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val) && val > 0) {
                state.checkoutPrice = Math.floor(val);
                state.checkoutStatus = 'waiting';
            } else {
                state.checkoutPrice = 0;
                state.checkoutStatus = 'idle';
            }
            renderAutomatedShopKiosk();
            
            // 重繪後焦點與游標移回
            const newInput = document.getElementById('checkout-price-input');
            if (newInput) {
                newInput.focus();
                const len = newInput.value.length;
                newInput.setSelectionRange(len, len);
            }
        });
    }

    // 2. 綁定備註說明輸入事件
    const reasonInput = container.querySelector('#checkout-reason-input');
    if (reasonInput) {
        reasonInput.addEventListener('input', (e) => {
            state.checkoutReason = e.target.value;
        });
    }

    // 3. 綁定快速預設定價點擊事件
    container.querySelectorAll('.checkout-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = parseInt(btn.dataset.val);
            state.checkoutPrice = val;
            state.checkoutStatus = 'waiting';
            renderAutomatedShopKiosk();
        });
    });

    // 4. 綁定清除定價點擊事件
    const clearPriceBtn = container.querySelector('#checkout-clear-price-btn');
    if (clearPriceBtn) {
        clearPriceBtn.addEventListener('click', () => {
            state.checkoutPrice = 0;
            state.checkoutStatus = 'idle';
            state.checkoutResultStudent = null;
            state.lastCheckoutAttemptStudent = null;
            renderAutomatedShopKiosk();
        });
    }

    // 5. 成功後的重置與重試按鈕綁定
    const resetBtn = container.querySelector('#checkout-reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            state.checkoutPrice = 0;
            state.checkoutStatus = 'idle';
            state.checkoutResultStudent = null;
            state.lastCheckoutAttemptStudent = null;
            renderAutomatedShopKiosk();
        });
    }

    const retryBtn = container.querySelector('#checkout-retry-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            state.checkoutStatus = 'waiting';
            state.checkoutResultStudent = null;
            state.lastCheckoutAttemptStudent = null;
            renderAutomatedShopKiosk();
        });
    }
}

// 📟 收銀模式嗶卡扣點實施邏輯
async function executeCheckoutDeduction(student) {
    if (!student) return;
    const price = state.checkoutPrice;
    
    if (isNaN(price) || price <= 0) {
        showToast("【收銀失敗】定價必須大於 0！", "warning");
        return;
    }

    if (student.points < price) {
        state.checkoutStatus = 'error';
        state.lastCheckoutAttemptStudent = student;
        showToast(`❌ 【扣點失敗】學生 [${student.name}] 餘額不足以支付當前交易`, "danger");
        logConsole(`[收銀交易失敗] 學生 [${student.name}] 可用餘額 (${student.points} 點) 低於商品定價 (${price} 點)。`, "danger");
        renderAutomatedShopKiosk();
        return;
    }

    try {
        const reason = state.checkoutReason ? state.checkoutReason.trim() : "神奇超市商品交易";
        const updatedStudent = await DB.deductPoints(student.id, price, reason);
        
        state.checkoutStatus = 'success';
        state.checkoutResultStudent = updatedStudent;
        
        // 爆發宇宙煙花
        triggerConfettiBig();
        showToast(`✅ 扣點交易成功：-${price} 點！`, "success");
        logConsole(`[收銀交易成功] 學生 [${updatedStudent.name}] (${updatedStudent.class}班 / ${updatedStudent.number || '--'}號) 購買商品扣除 ${price} 點，賸餘餘額: ${updatedStudent.points} 點。`, "success");
        renderAutomatedShopKiosk();
    } catch (e) {
        console.error(e);
        showToast("扣點交易處理異常，請重試。", "danger");
        state.checkoutStatus = 'error';
        renderAutomatedShopKiosk();
    }
}

function renderAutomatedGiftsGrid() {
    const grid = document.getElementById('kiosk-gifts-grid');
    if (!grid) return;

    grid.innerHTML = '';
    const selectedGift = state.selectedRedeemGift;

    state.gifts.forEach(gift => {
        const inStock = gift.stock > 0;
        const isSelected = selectedGift && selectedGift.id === gift.id;
        
        let cardClass = "gift-card";
        let btnText = `點選此寶物 (${gift.cost} ⭐)`;
        let btnIcon = `<i class="fas fa-hand-pointer"></i>`;

        if (!inStock) {
            cardClass += " out-of-stock";
            btnText = "😭 搶光光啦！";
            btnIcon = `<i class="fas fa-ghost"></i>`;
        } else if (isSelected) {
            cardClass += " active";
            btnText = "👉 已選定！立刻刷卡完成";
            btnIcon = `<i class="fas fa-broadcast-tower"></i>`;
        }

        const giftCard = document.createElement('div');
        giftCard.className = cardClass;
        
        // 針對選中的項目給予呼吸金邊和縮放動畫
        if (isSelected) {
            giftCard.style.border = "3px solid #f59e0b";
            giftCard.style.boxShadow = "0 8px 30px rgba(245,158,11,0.35)";
            giftCard.style.animation = "pulse 2s infinite";
        } else {
            giftCard.style.animation = "scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)";
        }

        giftCard.innerHTML = `
            <div class="gift-image-wrapper" style="position: relative; overflow: hidden; border-top-left-radius: 12px; border-top-right-radius: 12px;">
                <img src="${gift.image || 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=400'}" alt="${gift.name}" style="width: 100%; height: 160px; object-fit: cover;">
                <div class="gift-cost-badge" style="background: linear-gradient(135deg, #f59e0b, #eab308); color: #fff; font-weight: 800; border-radius: 20px; box-shadow: 0 4px 10px rgba(245,158,11,0.3);">
                    ⭐ ${gift.cost} 星
                </div>
                ${isSelected ? `
                    <div style="position: absolute; top: 8px; left: 8px; background: #10b981; color: #fff; font-size: 10px; font-weight: 800; padding: 4px 8px; border-radius: 8px; box-shadow: 0 2px 6px rgba(16,185,129,0.3); animation: bounce 1s infinite;">
                        ✨ 已鎖定
                    </div>
                ` : ''}
            </div>
            <div class="gift-info" style="padding: 16px;">
                <h4 style="font-size: 15px; font-weight: 800; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${gift.name}</h4>
                <p style="font-size: 12px; color: var(--text-dim); min-height: 36px; line-height: 1.5; margin-top: 4px;">${gift.description || '精選精美學校禮品獎勵。'}</p>
                <div class="gift-meta-row" style="margin-top: 10px; border-top: 1.5px solid rgba(168, 85, 247, 0.12); padding-top: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <span class="gift-stock ${gift.stock <= 3 ? 'low-stock' : ''}" style="font-size: 11px;">
                        🎒 剩餘：<strong>${gift.stock}</strong> 份
                    </span>
                    ${isSelected ? `
                        <span style="font-size: 11px; color: #10b981; font-weight: 800;">👉 請感應學生卡</span>
                    ` : ''}
                </div>
                <button class="gift-redeem-btn" data-gift-id="${gift.id}" ${!inStock ? 'disabled' : ''} style="margin-top: 12px; font-weight: 800; border-radius: 8px; width: 100%; transition: all 0.2s; background: ${isSelected ? 'linear-gradient(135deg, #10b981, #059669)' : 'var(--primary-gradient)'};">
                    ${btnIcon} ${btnText}
                </button>
            </div>
        `;

        if (inStock) {
            giftCard.addEventListener('click', (e) => {
                // 如果點選的是已經選中的，則取消選取
                if (isSelected) {
                    state.selectedRedeemGift = null;
                } else {
                    state.selectedRedeemGift = gift;
                }
                renderAutomatedShopKiosk();
            });
        }

        grid.appendChild(giftCard);
    });
}

// 初始化自助超市兌換成功彈窗的按鈕事件
function initShopSuccessModalEvents() {
    const successModal = document.getElementById('shop-success-modal');
    const closeBtn = document.getElementById('shop-success-close-btn');
    const okBtn = document.getElementById('shop-success-ok-btn');
    
    const dismiss = () => {
        if (successModal) successModal.classList.remove('active');
        if (window.shopSuccessTimeout) {
            clearTimeout(window.shopSuccessTimeout);
            window.shopSuccessTimeout = null;
        }
    };
    
    if (closeBtn) closeBtn.addEventListener('click', dismiss);
    if (okBtn) okBtn.addEventListener('click', dismiss);
}

// =========================================================================
// PORTAL 3: 教師管理獎品庫存頁
// =========================================================================
function renderInventoryManagerGrid() {
    const grid = document.getElementById('inventory-manager-grid');
    if (!grid) return;

    grid.innerHTML = '';
    
    state.gifts.forEach(gift => {
        const invCard = document.createElement('div');
        invCard.className = "inventory-card";
        invCard.innerHTML = `
            <img class="inventory-img" src="${gift.image}" alt="${gift.name}">
            <div class="inventory-details">
                <h4>${gift.name}</h4>
                <div class="inventory-price-stock">
                    <span class="inv-price"><i class="fas fa-star"></i> ${gift.cost} 點</span>
                    <span class="inv-stock"><i class="fas fa-cubes"></i> 剩餘庫存：${gift.stock}</span>
                </div>
            </div>
            <div class="inventory-actions">
                <button class="action-icon-btn edit-btn" data-id="${gift.id}" title="編輯"><i class="fas fa-edit"></i></button>
                <button class="action-icon-btn delete-btn" data-id="${gift.id}" title="刪除"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;

        invCard.querySelector('.delete-btn').addEventListener('click', async () => {
            if (confirm(`確定要將獎品「${gift.name}」從庫存目錄中徹底刪除嗎？`)) {
                state.gifts = state.gifts.filter(g => g.id !== gift.id);
                await DB.deleteGiftFromDb(gift.id);
                showToast(`已成功移除獎品「${gift.name}」`, "info");
                renderInventoryManagerGrid();
            }
        });

        invCard.querySelector('.edit-btn').addEventListener('click', () => {
            triggerAddEditGiftModal(gift);
        });

        grid.appendChild(invCard);
    });
}

function triggerAddEditGiftModal(gift = null) {
    const overlay = document.getElementById('add-gift-modal');
    const title = document.getElementById('gift-modal-title');
    
    const idInput = document.getElementById('gift-form-id');
    const nameInput = document.getElementById('gift-form-name');
    const descInput = document.getElementById('gift-form-desc');
    const costInput = document.getElementById('gift-form-cost');
    const stockInput = document.getElementById('gift-form-stock');
    const prevWrapper = document.getElementById('preview-box-wrapper');
    const imgPreview = document.getElementById('form-img-preview');
    
    idInput.value = gift ? gift.id : '';
    nameInput.value = gift ? gift.name : '';
    descInput.value = gift ? gift.description : '';
    costInput.value = gift ? gift.cost : '';
    stockInput.value = gift ? gift.stock : '';
    
    if (gift && gift.image) {
        imgPreview.src = gift.image;
        imgPreview.style.display = 'block';
        prevWrapper.style.display = 'none';
    } else {
        imgPreview.src = '';
        imgPreview.style.display = 'none';
        prevWrapper.style.display = 'block';
    }
    
    title.innerText = gift ? "編輯獎品規格" : "上架全新獎品";
    overlay.classList.add('active');
}

async function handleSaveGiftForm(e) {
    e.preventDefault();
    const id = document.getElementById('gift-form-id').value;
    const name = document.getElementById('gift-form-name').value.trim();
    const desc = document.getElementById('gift-form-desc').value.trim();
    const cost = parseInt(document.getElementById('gift-form-cost').value);
    const stock = parseInt(document.getElementById('gift-form-stock').value);
    const fileInput = document.getElementById('gift-form-file');
    const imgPreview = document.getElementById('form-img-preview');

    if (!name || isNaN(cost) || isNaN(stock)) {
        showToast("請填寫所有星號必填字段。", "warning");
        return;
    }

    let imgUrl = imgPreview.src;
    
    if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        try {
            imgUrl = await convertFileToBase64(file);
        } catch (e) {
            showToast("圖片解析解碼異常，請重試。", "danger");
            return;
        }
    }

    if (!imgUrl || imgUrl === window.location.href) {
        imgUrl = "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=400";
    }

    const giftData = {
        id: id || "gift-" + Date.now(),
        name,
        description: desc,
        cost,
        stock,
        image: imgUrl
    };

    if (id) {
        const idx = state.gifts.findIndex(g => g.id === id);
        if (idx !== -1) state.gifts[idx] = giftData;
        showToast(`獎品「${name}」信息更新成功！`, "success");
    } else {
        state.gifts.push(giftData);
        showToast(`全新獎品「${name}」上架成功！`, "success");
    }

    await DB.saveGift(giftData);
    document.getElementById('add-gift-modal').classList.remove('active');
    renderInventoryManagerGrid();
    
    fileInput.value = '';
}

function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(reader);
    });
}

// =========================================================================
// PORTAL 4: 統計報表與數據導出中心
// =========================================================================
function renderReportsDashboard() {
    const totalPointsAwarded = state.students.reduce((sum, s) => sum + s.points + s.redeemed, 0);
    const activeBalance = state.students.reduce((sum, s) => sum + s.points, 0);
    const totalRedeemed = state.students.reduce((sum, s) => sum + s.redeemed, 0);
    const averagePoints = state.students.length ? Math.round(activeBalance / state.students.length) : 0;

    document.getElementById('stat-total-points').innerText = totalPointsAwarded;
    document.getElementById('stat-active-balance').innerText = activeBalance;
    document.getElementById('stat-total-redeemed').innerText = totalRedeemed;
    document.getElementById('stat-average-points').innerText = averagePoints;

    renderReportSubTable();
}

function switchReportTab(reportTabId) {
    if (state.userRole === 'student' && reportTabId === 'transactions') {
        reportTabId = 'by-students';
    }
    state.activeReportTab = reportTabId;
    
    document.querySelectorAll('.report-tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.reportTab === reportTabId) btn.classList.add('active');
    });

    renderReportSubTable();
}

function renderReportSubTable() {
    if (state.userRole === 'student' && state.activeReportTab === 'transactions') {
        state.activeReportTab = 'by-students';
        document.querySelectorAll('.report-tab-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.reportTab === 'by-students') btn.classList.add('active');
        });
    }

    const query = state.searchQuery.toLowerCase();
    const classF = state.classFilter;
    const yearF = state.yearFilter;
    
    const container = document.getElementById('reports-table-container');
    const filterBar = document.querySelector('.table-filter-bar');
    
    if (filterBar) filterBar.style.display = 'flex';

    if (state.activeReportTab === 'by-students') {
        const filteredStudents = state.students.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(query) || s.id.includes(query);
            const matchesClass = !classF || s.class === classF;
            const matchesYear = !yearF || s.year === yearF;
            return matchesSearch && matchesClass && matchesYear;
        });

        // 按可用分值降序排列
        filteredStudents.sort((a, b) => b.points - a.points);

        container.innerHTML = `
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>全校排名</th>
                            <th>學號 / 座號</th>
                            <th>學生姓名</th>
                            <th>所屬班級</th>
                            <th>年級組</th>
                            <th>可用點數餘額</th>
                            <th>累計已兌換</th>
                            <th>獲得總分值</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredStudents.map((s, idx) => `
                            <tr>
                                <td style="font-weight:700;">第 ${idx + 1} 名</td>
                                <td style="font-weight:600; color:var(--secondary);">${s.number ? s.number + ' 號' : '--'}</td>
                                <td style="font-weight:600;">${s.name}</td>
                                <td>${s.class} 班</td>
                                <td>${s.year}</td>
                                <td style="color:var(--success); font-weight:700;">${s.points} 點</td>
                                <td style="color:var(--text-muted);">${s.redeemed} 點</td>
                                <td style="font-weight:600;">${s.points + s.redeemed} 點</td>
                            </tr>
                        `).join('')}
                        ${filteredStudents.length === 0 ? `<tr><td colspan="8" style="text-align:center; color:var(--text-muted);">未找到與當前篩選條件相匹配的學生數據。</td></tr>` : ''}
                    </tbody>
                </table>
            </div>
        `;
    } else if (state.activeReportTab === 'students-by-class') {
        if (filterBar) filterBar.style.display = 'none';

        const classes = [...new Set(state.students.map(s => s.class))].filter(c => c && c !== "TEST" && c !== "已畢業");
        classes.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

        if (!state.selectedReportClass && classes.length > 0) {
            state.selectedReportClass = classes[0];
        }
        const activeClass = state.selectedReportClass;

        const classStudents = state.students.filter(s => s.class === activeClass);
        classStudents.sort((a, b) => {
            const numA = parseInt(a.number) || 0;
            const numB = parseInt(b.number) || 0;
            return numA - numB;
        });

        const classCount = classStudents.length;
        const classPoints = classStudents.reduce((sum, s) => sum + s.points, 0);
        const classRedeemed = classStudents.reduce((sum, s) => sum + s.redeemed, 0);
        const classAverage = classCount ? Math.round(classPoints / classCount) : 0;

        container.innerHTML = `
            <div class="class-selector-wrapper" style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; padding: 4px 0 16px 0; border-bottom: 1px solid rgba(255,255,255,0.08);">
                ${classes.map(c => `
                    <button class="chip-btn ${c === activeClass ? 'active' : ''}" 
                            data-class-chip="${c}"
                            style="padding: 8px 16px; border-radius: 20px; border: 1px solid ${c === activeClass ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}; 
                                   background: ${c === activeClass ? 'var(--primary-gradient)' : 'rgba(255,255,255,0.03)'}; 
                                   color: ${c === activeClass ? '#fff' : 'var(--text-muted)'}; 
                                   font-weight: 600; font-size: 13px; cursor: pointer; transition: all 0.2s ease;">
                        ${c} 班
                    </button>
                `).join('')}
            </div>

            <div class="class-stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px;">
                <div class="stat-card" style="padding: 16px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; display: flex; align-items: center; gap: 12px;">
                    <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(139, 92, 246, 0.1); display: flex; align-items: center; justify-content: center; color: var(--primary); font-size: 18px;">
                        <i class="fas fa-users"></i>
                    </div>
                    <div>
                        <h4 style="font-size: 20px; font-weight: 700; margin: 0; color: #fff;">${classCount} 人</h4>
                        <p style="font-size: 11px; margin: 2px 0 0 0; color: var(--text-muted);">班級學生人數</p>
                    </div>
                </div>
                <div class="stat-card" style="padding: 16px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; display: flex; align-items: center; gap: 12px;">
                    <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(16, 185, 129, 0.1); display: flex; align-items: center; justify-content: center; color: var(--success); font-size: 18px;">
                        <i class="fas fa-coins"></i>
                    </div>
                    <div>
                        <h4 style="font-size: 20px; font-weight: 700; margin: 0; color: #fff;">${classPoints} 點</h4>
                        <p style="font-size: 11px; margin: 2px 0 0 0; color: var(--text-muted);">可用點數餘額</p>
                    </div>
                </div>
                <div class="stat-card" style="padding: 16px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; display: flex; align-items: center; gap: 12px;">
                    <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(245, 158, 11, 0.1); display: flex; align-items: center; justify-content: center; color: var(--warning); font-size: 18px;">
                        <i class="fas fa-chart-line"></i>
                    </div>
                    <div>
                        <h4 style="font-size: 20px; font-weight: 700; margin: 0; color: #fff;">${classAverage} 點</h4>
                        <p style="font-size: 11px; margin: 2px 0 0 0; color: var(--text-muted);">班級人均可用分值</p>
                    </div>
                </div>
            </div>

            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>班級座號</th>
                            <th>學生卡 ID</th>
                            <th>學生姓名</th>
                            <th>可用點數餘額</th>
                            <th>累計已兌換</th>
                            <th>獲得總分值</th>
                            <th style="min-width: 250px;">達成指標與得分明細</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${classStudents.map(s => {
                            const studentEarnTx = state.transactions.filter(t => t.studentId === s.id && t.type === 'earn');
                            const studentReasonPoints = {};
                            studentEarnTx.forEach(t => {
                                const r = t.target.trim();
                                studentReasonPoints[r] = (studentReasonPoints[r] || 0) + Math.abs(t.points || 0);
                            });
                            const indicatorsHtml = Object.entries(studentReasonPoints).map(([reason, pts]) => {
                                return `
                                    <span class="indicator-badge" 
                                          style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; 
                                                 background: rgba(139, 92, 246, 0.08); border: 1px solid rgba(139, 92, 246, 0.15); 
                                                 color: var(--primary); font-size: 11px; font-weight: 600; white-space: nowrap;">
                                        🎯 ${reason}: +${pts} 點
                                    </span>
                                `;
                            }).join('') || '<span style="color:var(--text-muted); font-size:12px; font-style:italic;">暫無指標獲得點數</span>';

                            return `
                                <tr>
                                    <td style="font-weight:700; color: var(--primary); font-size: 14px;">${s.number || '--'} 號</td>
                                    <td style="font-family:monospace; font-size:12px; color:var(--text-muted);">${s.id}</td>
                                    <td style="font-weight:600;">${s.name}</td>
                                    <td style="color:var(--success); font-weight:700;">${s.points} 點</td>
                                    <td style="color:var(--text-muted);">${s.redeemed} 點</td>
                                    <td style="font-weight:600;">${s.points + s.redeemed} 點</td>
                                    <td>
                                        <div style="display: flex; flex-wrap: wrap; gap: 6px; max-height: 80px; overflow-y: auto; padding: 2px 0;">
                                            ${indicatorsHtml}
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                        ${classStudents.length === 0 ? `<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">當前班級暫無學生成員。</td></tr>` : ''}
                    </tbody>
                </table>
            </div>
        `;

        container.querySelectorAll('[data-class-chip]').forEach(chip => {
            chip.addEventListener('click', () => {
                state.selectedReportClass = chip.dataset.classChip;
                renderReportSubTable();
            });
        });
    } else if (state.activeReportTab === 'by-classes') {
        const classMap = {};
        state.students.forEach(s => {
            // 過濾掉測試或已畢業的數據
            if (!s.class || s.class === "TEST" || s.class === "已畢業" || s.year === "TEST" || s.year === "已畢業") {
                return;
            }
            if (!classMap[s.class]) {
                classMap[s.class] = { class: s.class, year: s.year, count: 0, totalPoints: 0, totalRedeemed: 0 };
            }
            classMap[s.class].count += 1;
            classMap[s.class].totalPoints += s.points;
            classMap[s.class].totalRedeemed += s.redeemed;
        });

        const classRows = Object.values(classMap);
        classRows.sort((a, b) => b.totalPoints / b.count - a.totalPoints / a.count); // 按人均得分排列

        container.innerHTML = `
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>班級排名</th>
                            <th>班級代號</th>
                            <th>所屬年級</th>
                            <th>班級學生人數</th>
                            <th>可用點數總額</th>
                            <th>累計已兌換總額</th>
                            <th>班級人均得分</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${classRows.map((c, idx) => `
                            <tr>
                                <td style="font-weight:700;">第 ${idx + 1} 名</td>
                                <td style="font-weight:600; color:var(--secondary);">${c.class} 班</td>
                                <td>${c.year}</td>
                                <td>${c.count} 人</td>
                                <td>${c.totalPoints} 點</td>
                                <td>${c.totalRedeemed} 點</td>
                                <td style="font-weight:700; color:var(--success);">${Math.round(c.totalPoints / c.count)} 點</td>
                            </tr>
                        `).join('')}
                        ${classRows.length === 0 ? `<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">暫無可用的班級彙總數據。</td></tr>` : ''}
                    </tbody>
                </table>
            </div>
        `;
    } else if (state.activeReportTab === 'by-years') {
        const yearMap = {};
        state.students.forEach(s => {
            // 過濾掉測試或已畢業的數據
            if (!s.year || s.year === "TEST" || s.year === "已畢業") {
                return;
            }
            if (!yearMap[s.year]) {
                yearMap[s.year] = { year: s.year, count: 0, totalPoints: 0, totalRedeemed: 0 };
            }
            yearMap[s.year].count += 1;
            yearMap[s.year].totalPoints += s.points;
            yearMap[s.year].totalRedeemed += s.redeemed;
        });

        const yearRows = Object.values(yearMap);
        yearRows.sort((a, b) => b.totalPoints / b.count - a.totalPoints / a.count);

        container.innerHTML = `
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>年級排名</th>
                            <th>年級組名稱</th>
                            <th>年級學生人數</th>
                            <th>可用點數總額</th>
                            <th>累計已兌換總額</th>
                            <th>年級人均得分</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${yearRows.map((y, idx) => `
                            <tr>
                                <td style="font-weight:700;">第 ${idx + 1} 名</td>
                                <td style="font-weight:600; color:var(--primary);">${y.year}</td>
                                <td>${y.count} 人</td>
                                <td>${y.totalPoints} 點</td>
                                <td>${y.totalRedeemed} 點</td>
                                <td style="font-weight:700; color:var(--success);">${Math.round(y.totalPoints / y.count)} 點</td>
                            </tr>
                        `).join('')}
                        ${yearRows.length === 0 ? `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">暫無可用的年級彙總數據。</td></tr>` : ''}
                    </tbody>
                </table>
            </div>
        `;
    } else if (state.activeReportTab === 'class-matrix') {
        if (filterBar) filterBar.style.display = 'none';

        const classes = [...new Set(state.students.map(s => s.class))].filter(c => c && c !== "TEST" && c !== "已畢業");
        classes.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

        if (!state.selectedReportClass && classes.length > 0) {
            state.selectedReportClass = classes[0];
        }
        const activeClass = state.selectedReportClass;

        const classStudents = state.students.filter(s => s.class === activeClass);
        classStudents.sort((a, b) => {
            const numA = parseInt(a.number) || 0;
            const numB = parseInt(b.number) || 0;
            return numA - numB;
        });

        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; margin-bottom:12px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom:16px;">
                <div class="class-selector-wrapper" style="display: flex; gap: 8px; flex-wrap: wrap;">
                    ${classes.map(c => `
                        <button class="chip-btn ${c === activeClass ? 'active' : ''}" 
                                data-class-chip="${c}"
                                style="padding: 8px 16px; border-radius: 20px; border: 1px solid ${c === activeClass ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}; 
                                       background: ${c === activeClass ? 'var(--primary-gradient)' : 'rgba(255,255,255,0.03)'}; 
                                       color: ${c === activeClass ? '#fff' : 'var(--text-muted)'}; 
                                       font-weight: 600; font-size: 13px; cursor: pointer; transition: all 0.2s ease;">
                            ${c} 班
                        </button>
                    `).join('')}
                </div>
                <button id="btn-export-matrix" class="btn-style" style="padding: 10px 18px; font-size:13px; border-radius:30px; display:inline-flex; align-items:center; gap:8px;">
                    <i class="fas fa-file-excel"></i> 導出 ${activeClass} 班成就特質矩陣
                </button>
            </div>

            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>班級座號</th>
                            <th>學生姓名</th>
                            <th style="color: #3b82f6;">🎓 學業</th>
                            <th style="color: #ec4899;">✝️ 宗德</th>
                            <th style="color: #f97316;">🏃 體育</th>
                            <th style="color: #eab308;">🎨 視藝</th>
                            <th style="color: #10b981;">📚 圖書</th>
                            <th style="color: #06b6d4;">💬 普通話</th>
                            <th style="color: #a855f7;">🌐 English</th>
                            <th style="color: #f59e0b;">🏅 達成指標</th>
                            <th style="font-weight: 700; color: #fff; background: rgba(255,255,255,0.03);">累計總得分</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${classStudents.map(s => {
                            const studentTx = state.transactions.filter(t => t.studentId === s.id && t.type === 'earn');
                            let academic = 0, religion = 0, pe = 0, art = 0, library = 0, putonghua = 0, english = 0, moral = 0;
                            
                            studentTx.forEach(t => {
                                const target = t.target.trim();
                                const pts = Math.abs(t.points || 0);
                                if (target === '學業') academic += pts;
                                else if (target === '宗德') religion += pts;
                                else if (target === '體育') pe += pts;
                                else if (target === '視藝') art += pts;
                                else if (target === '體藝') { pe += pts; art += pts; } // 舊數據相容
                                else if (target === '圖書') library += pts;
                                else if (target === '普通話') putonghua += pts;
                                else if (target === 'English') english += pts;
                                else moral += pts;
                            });
                            const total = academic + religion + pe + art + library + putonghua + english + moral;

                            return `
                                <tr>
                                    <td style="font-weight:700; color: var(--primary);">${s.number || '--'} 號</td>
                                    <td style="font-weight:600;">${s.name}</td>
                                    <td style="color:#3b82f6; font-weight:700;">${academic} 點</td>
                                    <td style="color:#ec4899; font-weight:700;">${religion} 點</td>
                                    <td style="color:#f97316; font-weight:700;">${pe} 點</td>
                                    <td style="color:#eab308; font-weight:700;">${art} 點</td>
                                    <td style="color:#10b981; font-weight:700;">${library} 點</td>
                                    <td style="color:#06b6d4; font-weight:700;">${putonghua} 點</td>
                                    <td style="color:#a855f7; font-weight:700;">${english} 點</td>
                                    <td style="color:#f59e0b; font-weight:700;">${moral} 點</td>
                                    <td style="font-weight:700; color:#fff; background: rgba(255,255,255,0.03);">${total} 點</td>
                                </tr>
                            `;
                        }).join('')}
                        ${classStudents.length === 0 ? `<tr><td colspan="10" style="text-align:center; color:var(--text-muted);">當前班級暫無學生成員。</td></tr>` : ''}
                    </tbody>
                </table>
            </div>
        `;

        // Bind Class Selector Buttons
        container.querySelectorAll('[data-class-chip]').forEach(chip => {
            chip.addEventListener('click', () => {
                state.selectedReportClass = chip.dataset.classChip;
                renderReportSubTable();
            });
        });

        // Bind Excel Export Button
        const exportBtn = document.getElementById('btn-export-matrix');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                handleExportClassMatrix(activeClass);
            });
        }
    } else if (state.activeReportTab === 'library-leaderboard') {
        if (filterBar) filterBar.style.display = 'none';

        const availableYears = [...new Set(state.students.map(s => s.year))].filter(y => y && y !== "TEST" && y !== "已畢業");
        
        // 自定義年級排序權重對照表
        const yearSortWeight = {
            "一年級": 1, "P.1": 1, "P1": 1,
            "二年級": 2, "P.2": 2, "P2": 2,
            "三年級": 3, "P.3": 3, "P3": 3,
            "四年級": 4, "P.4": 4, "P4": 4,
            "五年級": 5, "P.5": 5, "P5": 5,
            "六年級": 6, "P.6": 6, "P6": 6,
            "其他": 99, "Others": 99, "Other": 99
        };
        
        availableYears.sort((a, b) => {
            const weightA = yearSortWeight[a] || 50;
            const weightB = yearSortWeight[b] || 50;
            if (weightA !== weightB) {
                return weightA - weightB;
            }
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });

        if (!state.selectedLibraryYear) {
            state.selectedLibraryYear = "全部";
        }
        const activeLibraryYear = state.selectedLibraryYear;

        container.innerHTML = `
            <div style="text-align: center; margin-bottom: 24px;">
                <h3 style="font-size: 24px; font-weight: 800; color: #fff; margin: 0; display: inline-flex; align-items: center; gap: 8px; background: var(--primary-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                    📚 閱讀之星：神奇圖書龍虎榜 🌟
                </h3>
                <p style="font-size: 13px; color: var(--text-dim); margin: 6px 0 0 0; font-weight: 500;">✨ 激發神奇閱讀累積積點！這裡展示了每個年級在「圖書」世界中獲得最高積點的閃亮閱讀小天使！📖✨</p>
            </div>

            <!-- Library Year Filter Chip Bar -->
            <div class="library-year-selector-wrapper" style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px; padding: 4px 0 16px 0; border-bottom: 1px solid rgba(255,255,255,0.08); justify-content: center;">
                <button class="chip-btn ${activeLibraryYear === '全部' ? 'active' : ''}" 
                        data-lib-year-chip="全部"
                        style="padding: 8px 18px; border-radius: 20px; border: 1px solid ${activeLibraryYear === '全部' ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}; 
                               background: ${activeLibraryYear === '全部' ? 'var(--primary-gradient)' : 'rgba(255,255,255,0.03)'}; 
                               color: ${activeLibraryYear === '全部' ? '#fff' : 'var(--text-muted)'}; 
                               font-weight: 600; font-size: 13px; cursor: pointer; transition: all 0.2s ease;">
                    全部年級 🎒
                </button>
                ${availableYears.map(y => `
                    <button class="chip-btn ${y === activeLibraryYear ? 'active' : ''}" 
                            data-lib-year-chip="${y}"
                            style="padding: 8px 18px; border-radius: 20px; border: 1px solid ${y === activeLibraryYear ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}; 
                                   background: ${y === activeLibraryYear ? 'var(--primary-gradient)' : 'rgba(255,255,255,0.03)'}; 
                                   color: ${y === activeLibraryYear ? '#fff' : 'var(--text-muted)'}; 
                                   font-weight: 600; font-size: 13px; cursor: pointer; transition: all 0.2s ease;">
                        ${y}
                    </button>
                `).join('')}
            </div>

            ${activeLibraryYear === "全部" ? `
                <!-- GRID OVERVIEW FOR ALL YEARS -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
                    ${availableYears.map(year => {
                        const yearStudents = state.students.filter(s => s.year === year);
                        
                        const studentLibraryScores = yearStudents.map(s => {
                            const studentTx = state.transactions.filter(t => t.studentId === s.id && t.type === 'earn' && t.target.trim() === '圖書');
                            const score = studentTx.reduce((sum, t) => sum + Math.abs(t.points || 0), 0);
                            return { ...s, libraryScore: score };
                        });
                        
                        studentLibraryScores.sort((a, b) => b.libraryScore - a.libraryScore);
                        const topRankers = studentLibraryScores.slice(0, 10);

                        return `
                            <div class="leaderboard-card" 
                                 style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); 
                                        border-radius: 16px; padding: 20px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
                                        background: linear-gradient(145deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01));">
                                
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 10px;">
                                    <h4 style="font-size: 16px; font-weight: 700; color: #fff; margin: 0; display: flex; align-items: center; gap: 8px;">
                                        <span style="display: inline-block; width: 8px; height: 16px; background: var(--primary-gradient); border-radius: 4px;"></span>
                                        ${year} 🌈
                                    </h4>
                                    <span style="font-size: 11px; color: var(--text-muted); font-weight: 500;">累計圖書大數據</span>
                                </div>

                                <div style="display: flex; flex-direction: column; gap: 10px;">
                                    ${topRankers.map((s, idx) => {
                                        let rankIcon = `<span style="font-size: 12px; font-weight: 800; width: 24px; height: 24px; border-radius: 50%; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; color: var(--text-dim);">${idx + 1}</span>`;
                                        let rowBg = "transparent";
                                        let nameStyle = "color: var(--text-muted); font-weight: 500;";
                                        let scoreColor = "var(--text-muted)";
                                        
                                        if (idx === 0) {
                                            rankIcon = `<span style="font-size: 18px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">🥇</span>`;
                                            rowBg = "linear-gradient(90deg, rgba(245, 158, 11, 0.08), transparent)";
                                            nameStyle = "color: var(--text-main); font-weight: 700;";
                                            scoreColor = "#f59e0b; font-weight: 800;";
                                        } else if (idx === 1) {
                                            rankIcon = `<span style="font-size: 18px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">🥈</span>`;
                                            rowBg = "linear-gradient(90deg, rgba(209, 213, 219, 0.06), transparent)";
                                            nameStyle = "color: var(--text-main); font-weight: 600;";
                                            scoreColor = "#e5e7eb; font-weight: 700;";
                                        } else if (idx === 2) {
                                            rankIcon = `<span style="font-size: 18px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">🥉</span>`;
                                            rowBg = "linear-gradient(90deg, rgba(180, 83, 9, 0.04), transparent)";
                                            nameStyle = "color: var(--text-main); font-weight: 600;";
                                            scoreColor = "#b45309; font-weight: 700;";
                                        }

                                        return `
                                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; border-radius: 8px; background: ${rowBg};">
                                                <div style="display: flex; align-items: center; gap: 12px;">
                                                    ${rankIcon}
                                                    <div>
                                                        <span style="${nameStyle}; font-size: 13px;">${s.name}</span>
                                                        <span style="font-size: 11px; color: var(--text-dim); margin-left: 6px;">(${s.class}班 / ${s.number ? s.number + '號' : '--'})</span>
                                                    </div>
                                                </div>
                                                <span style="font-size: 13px; color: ${scoreColor};">
                                                    ${s.libraryScore > 0 ? `<strong>${s.libraryScore}</strong> ⭐` : `<span style="color: var(--text-dim); font-size:11px; font-style:italic;">未錄入得分</span>`}
                                                </span>
                                            </div>
                                        `;
                                    }).join('')}
                                    ${topRankers.length === 0 ? `<div style="text-align:center; padding: 30px 0; color:var(--text-muted); font-size: 12px;">該年級暫無圖書得分記錄。</div>` : ''}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            ` : `
                <!-- SINGLE YEAR EXQUISITE PODIUM + LIST VIEW -->
                ${(() => {
                    const yearStudents = state.students.filter(s => s.year === activeLibraryYear);
                    const studentLibraryScores = yearStudents.map(s => {
                        const studentTx = state.transactions.filter(t => t.studentId === s.id && t.type === 'earn' && t.target.trim() === '圖書');
                        const score = studentTx.reduce((sum, t) => sum + Math.abs(t.points || 0), 0);
                        return { ...s, libraryScore: score };
                    });
                    
                    studentLibraryScores.sort((a, b) => b.libraryScore - a.libraryScore);
                    
                    // Separate Top 3 for Podium
                    const firstPlace = (studentLibraryScores[0] && studentLibraryScores[0].libraryScore > 0) ? studentLibraryScores[0] : null;
                    const secondPlace = (studentLibraryScores[1] && studentLibraryScores[1].libraryScore > 0) ? studentLibraryScores[1] : null;
                    const thirdPlace = (studentLibraryScores[2] && studentLibraryScores[2].libraryScore > 0) ? studentLibraryScores[2] : null;
                    
                    const ranks4to10 = studentLibraryScores.slice(3, 10).filter(s => s.libraryScore > 0);
                    const hasData = firstPlace || secondPlace || thirdPlace;

                    if (!hasData) {
                        return `
                            <div class="glass-card" style="text-align:center; padding: 60px 20px; border: 1px solid rgba(255,255,255,0.05); border-radius:16px;">
                                <div style="font-size: 48px; margin-bottom: 16px;">📚</div>
                                <h4 style="font-size: 18px; color: #fff; font-weight:700; margin:0;">暫無積分紀錄</h4>
                                <p style="font-size: 13px; color: var(--text-muted); margin-top: 8px;">該年級（${activeLibraryYear}）學生目前尚未在「圖書」範疇中獲得過分數。</p>
                            </div>
                        `;
                    }

                    return `
                        <div class="glass-card" style="padding: 24px; border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; margin: 0 auto; max-width: 800px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);">
                            
                            <!-- Year title -->
                            <div style="text-align:center; margin-bottom: 24px;">
                                <h4 style="font-size: 18px; font-weight: 700; color: #fff; margin:0;">${activeLibraryYear} 閱讀王者之巔 👑</h4>
                                <p style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">🌟 年級最神奇、最有毅力的閱讀之星前十名 👑</p>
                            </div>

                            <!-- 3D Podium Layout -->
                            <div class="podium-container" style="display: flex; align-items: flex-end; justify-content: center; gap: 16px; margin: 20px auto 40px auto; max-width: 600px; padding: 10px;">
                                
                                <!-- 2nd Place -->
                                ${secondPlace ? `
                                    <div class="podium-item second" style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                                        <div class="podium-avatar" style="font-size: 36px; margin-bottom: 8px;">🥈</div>
                                        <div class="podium-name" style="font-weight: 700; color: var(--text-main); font-size: 14px; text-align: center;">${secondPlace.name}</div>
                                        <div class="podium-class" style="font-size: 11px; color: var(--text-dim); margin-top: 2px;">${secondPlace.class}班 (${secondPlace.number ? secondPlace.number + '號' : '--'})</div>
                                        <div class="podium-step" style="width: 100%; height: 80px; background: linear-gradient(180deg, rgba(209, 213, 219, 0.15), rgba(209, 213, 219, 0.02)); border: 1px solid rgba(209, 213, 219, 0.2); border-bottom: none; border-radius: 12px 12px 0 0; display: flex; flex-direction: column; align-items: center; justify-content: center; margin-top: 10px;">
                                            <span style="font-size: 20px; font-weight: 800; color: #e5e7eb;">${secondPlace.libraryScore}</span>
                                            <span style="font-size: 10px; color: var(--text-dim); margin-top: 2px;">⭐</span>
                                        </div>
                                    </div>
                                ` : `
                                    <div style="flex: 1; height: 1px;"></div>
                                `}

                                <!-- 1st Place -->
                                ${firstPlace ? `
                                    <div class="podium-item first" style="flex: 1.2; display: flex; flex-direction: column; align-items: center; z-index: 10;">
                                        <div class="podium-avatar" style="font-size: 52px; margin-bottom: 8px; filter: drop-shadow(0 0 15px rgba(245, 158, 11, 0.4));">👑</div>
                                        <div class="podium-name" style="font-weight: 800; color: var(--text-main); font-size: 16px; text-align: center;">${firstPlace.name}</div>
                                        <div class="podium-class" style="font-size: 11px; color: var(--text-dim); margin-top: 2px;">${firstPlace.class}班 (${firstPlace.number ? firstPlace.number + '號' : '--'})</div>
                                        <div class="podium-step" style="width: 100%; height: 120px; background: linear-gradient(180deg, rgba(245, 158, 11, 0.25), rgba(245, 158, 11, 0.03)); border: 1px solid rgba(245, 158, 11, 0.3); border-bottom: none; border-radius: 12px 12px 0 0; display: flex; flex-direction: column; align-items: center; justify-content: center; margin-top: 10px; box-shadow: 0 0 20px rgba(245, 158, 11, 0.1);">
                                            <span style="font-size: 26px; font-weight: 900; color: #f59e0b;">${firstPlace.libraryScore}</span>
                                            <span style="font-size: 11px; color: var(--text-dim); margin-top: 2px; font-weight: 600;">⭐</span>
                                        </div>
                                    </div>
                                ` : `
                                    <div style="flex: 1.2; height: 1px;"></div>
                                `}

                                <!-- 3rd Place -->
                                ${thirdPlace ? `
                                    <div class="podium-item third" style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                                        <div class="podium-avatar" style="font-size: 36px; margin-bottom: 8px;">🥉</div>
                                        <div class="podium-name" style="font-weight: 700; color: var(--text-main); font-size: 13px; text-align: center;">${thirdPlace.name}</div>
                                        <div class="podium-class" style="font-size: 11px; color: var(--text-dim); margin-top: 2px;">${thirdPlace.class}班 (${thirdPlace.number ? thirdPlace.number + '號' : '--'})</div>
                                        <div class="podium-step" style="width: 100%; height: 60px; background: linear-gradient(180deg, rgba(180, 83, 9, 0.15), rgba(180, 83, 9, 0.02)); border: 1px solid rgba(180, 83, 9, 0.2); border-bottom: none; border-radius: 12px 12px 0 0; display: flex; flex-direction: column; align-items: center; justify-content: center; margin-top: 10px;">
                                            <span style="font-size: 18px; font-weight: 800; color: #b45309;">${thirdPlace.libraryScore}</span>
                                            <span style="font-size: 10px; color: var(--text-dim); margin-top: 2px;">⭐</span>
                                        </div>
                                    </div>
                                ` : `
                                    <div style="flex: 1; height: 1px;"></div>
                                `}
                            </div>

                            <!-- Ranks 4 to 10 list -->
                            ${ranks4to10.length > 0 ? `
                                <div style="display:flex; flex-direction:column; gap:8px; max-width:600px; margin: 0 auto; border-top: 1px solid rgba(255,255,255,0.06); padding-top:20px;">
                                    ${ranks4to10.map((s, idx) => `
                                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; border-radius: 10px; background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.03); transition: all 0.2s ease;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='rgba(255,255,255,0.01)'">
                                            <div style="display: flex; align-items: center; gap: 14px;">
                                                <span style="font-size: 12px; font-weight: 800; width: 26px; height: 26px; border-radius: 50%; background: rgba(255,255,255,0.04); display: flex; align-items: center; justify-content: center; color: var(--text-dim);">${idx + 4}</span>
                                                <div>
                                                    <span style="color:#fff; font-weight:600; font-size:14px;">${s.name}</span>
                                                    <span style="font-size: 11px; color: var(--text-dim); margin-left: 6px;">(${s.class}班 / ${s.number ? s.number + '號' : '--'})</span>
                                                </div>
                                            </div>
                                            <span style="font-size: 14px; color: var(--text-muted); font-weight:700;">${s.libraryScore} ⭐</span>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                    `;
                })()}
            `}
        `;

        // Bind Library Year Selector Buttons
        container.querySelectorAll('[data-lib-year-chip]').forEach(chip => {
            chip.addEventListener('click', () => {
                state.selectedLibraryYear = chip.dataset.libYearChip;
                renderReportSubTable();
            });
        });
    } else if (state.activeReportTab === 'sports-leaderboard') {
        if (filterBar) filterBar.style.display = 'none';

        const availableYears = [...new Set(state.students.map(s => s.year))].filter(y => y && y !== "TEST" && y !== "已畢業");
        
        // 自定義年級排序權重對照表
        const yearSortWeight = {
            "一年級": 1, "P.1": 1, "P1": 1,
            "二年級": 2, "P.2": 2, "P2": 2,
            "三年級": 3, "P.3": 3, "P3": 3,
            "四年級": 4, "P.4": 4, "P4": 4,
            "五年級": 5, "P.5": 5, "P5": 5,
            "六年級": 6, "P.6": 6, "P6": 6,
            "其他": 99, "Others": 99, "Other": 99
        };
        
        availableYears.sort((a, b) => {
            const weightA = yearSortWeight[a] || 50;
            const weightB = yearSortWeight[b] || 50;
            if (weightA !== weightB) {
                return weightA - weightB;
            }
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });

        if (!state.selectedSportsYear) {
            state.selectedSportsYear = "全部";
        }
        const activeSportsYear = state.selectedSportsYear;

        container.innerHTML = `
            <div style="text-align: center; margin-bottom: 24px;">
                <h3 style="font-size: 24px; font-weight: 800; color: #fff; margin: 0; display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg, #f97316, #ef4444); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                    🏃 體育之星：神奇體育龍虎榜 🌟
                </h3>
                <p style="font-size: 13px; color: var(--text-dim); margin: 6px 0 0 0; font-weight: 500;">✨ 展現陽光活力、汗水與毅力！這裡展示了每個年級在「體育」世界中獲得最高積點的閃亮運動小明星！🏆✨</p>
            </div>

            <!-- Sports Year Filter Chip Bar -->
            <div class="sports-year-selector-wrapper" style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px; padding: 4px 0 16px 0; border-bottom: 1px solid rgba(255,255,255,0.08); justify-content: center;">
                <button class="chip-btn ${activeSportsYear === '全部' ? 'active' : ''}" 
                        data-sports-year-chip="全部"
                        style="padding: 8px 18px; border-radius: 20px; border: 1px solid ${activeSportsYear === '全部' ? '#f97316' : 'rgba(255,255,255,0.1)'}; 
                               background: ${activeSportsYear === '全部' ? 'linear-gradient(135deg, #f97316, #ef4444)' : 'rgba(255,255,255,0.03)'}; 
                               color: ${activeSportsYear === '全部' ? '#fff' : 'var(--text-muted)'}; 
                               font-weight: 600; font-size: 13px; cursor: pointer; transition: all 0.2s ease;">
                    各級總覽 🎒
                </button>
                <button class="chip-btn ${activeSportsYear === '全校排行' ? 'active' : ''}" 
                        data-sports-year-chip="全校排行"
                        style="padding: 8px 18px; border-radius: 20px; border: 1px solid ${activeSportsYear === '全校排行' ? '#f97316' : 'rgba(255,255,255,0.1)'}; 
                               background: ${activeSportsYear === '全校排行' ? 'linear-gradient(135deg, #f97316, #ef4444)' : 'rgba(255,255,255,0.03)'}; 
                               color: ${activeSportsYear === '全校排行' ? '#fff' : 'var(--text-muted)'}; 
                               font-weight: 600; font-size: 13px; cursor: pointer; transition: all 0.2s ease;">
                    全校排行 🌍
                </button>
                ${availableYears.map(y => `
                    <button class="chip-btn ${y === activeSportsYear ? 'active' : ''}" 
                            data-sports-year-chip="${y}"
                            style="padding: 8px 18px; border-radius: 20px; border: 1px solid ${y === activeSportsYear ? '#f97316' : 'rgba(255,255,255,0.1)'}; 
                                   background: ${y === activeSportsYear ? 'linear-gradient(135deg, #f97316, #ef4444)' : 'rgba(255,255,255,0.03)'}; 
                                   color: ${y === activeSportsYear ? '#fff' : 'var(--text-muted)'}; 
                                   font-weight: 600; font-size: 13px; cursor: pointer; transition: all 0.2s ease;">
                        ${y}
                    </button>
                `).join('')}
            </div>

            ${(() => {
                if (activeSportsYear === "全部") {
                    return `
                        <!-- GRID OVERVIEW FOR ALL YEARS -->
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
                            ${availableYears.map(year => {
                                const yearStudents = state.students.filter(s => s.year === year);
                                
                                const studentSportsScores = yearStudents.map(s => {
                                    const studentTx = state.transactions.filter(t => t.studentId === s.id && t.type === 'earn' && (t.target.trim() === '體育' || t.target.trim() === '體藝'));
                                    const score = studentTx.reduce((sum, t) => sum + Math.abs(t.points || 0), 0);
                                    return { ...s, sportsScore: score };
                                });
                                
                                studentSportsScores.sort((a, b) => b.sportsScore - a.sportsScore);
                                const topRankers = studentSportsScores.slice(0, 10);

                                return `
                                    <div class="leaderboard-card" 
                                         style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); 
                                                border-radius: 16px; padding: 20px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
                                                background: linear-gradient(145deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01));">
                                        
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 10px;">
                                            <h4 style="font-size: 16px; font-weight: 700; color: #fff; margin: 0; display: flex; align-items: center; gap: 8px;">
                                                <span style="display: inline-block; width: 8px; height: 16px; background: linear-gradient(135deg, #f97316, #ef4444); border-radius: 4px;"></span>
                                                ${year} 🌈
                                            </h4>
                                            <span style="font-size: 11px; color: var(--text-muted); font-weight: 500;">累計體育大數據</span>
                                        </div>

                                        <div style="display: flex; flex-direction: column; gap: 10px;">
                                            ${topRankers.map((s, idx) => {
                                                let rankIcon = `<span style="font-size: 12px; font-weight: 800; width: 24px; height: 24px; border-radius: 50%; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; color: var(--text-dim);">${idx + 1}</span>`;
                                                let rowBg = "transparent";
                                                let nameStyle = "color: var(--text-muted); font-weight: 500;";
                                                let scoreColor = "var(--text-muted)";
                                                
                                                if (idx === 0) {
                                                    rankIcon = `<span style="font-size: 18px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">🥇</span>`;
                                                    rowBg = "linear-gradient(90deg, rgba(249, 115, 22, 0.08), transparent)";
                                                    nameStyle = "color: var(--text-main); font-weight: 700;";
                                                    scoreColor = "#f97316; font-weight: 800;";
                                                } else if (idx === 1) {
                                                    rankIcon = `<span style="font-size: 18px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">🥈</span>`;
                                                    rowBg = "linear-gradient(90deg, rgba(209, 213, 219, 0.06), transparent)";
                                                    nameStyle = "color: var(--text-main); font-weight: 600;";
                                                    scoreColor = "#e5e7eb; font-weight: 700;";
                                                } else if (idx === 2) {
                                                    rankIcon = `<span style="font-size: 18px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">🥉</span>`;
                                                    rowBg = "linear-gradient(90deg, rgba(180, 83, 9, 0.04), transparent)";
                                                    nameStyle = "color: var(--text-main); font-weight: 600;";
                                                    scoreColor = "#b45309; font-weight: 700;";
                                                }

                                                return `
                                                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; border-radius: 8px; background: ${rowBg};">
                                                        <div style="display: flex; align-items: center; gap: 12px;">
                                                            ${rankIcon}
                                                            <div>
                                                                <span style="${nameStyle}; font-size: 13px;">${s.name}</span>
                                                                <span style="font-size: 11px; color: var(--text-dim); margin-left: 6px;">(${s.class}班 / ${s.number ? s.number + '號' : '--'})</span>
                                                            </div>
                                                        </div>
                                                        <span style="font-size: 13px; color: ${scoreColor};">
                                                            ${s.sportsScore > 0 ? `<strong>${s.sportsScore}</strong> ⭐` : `<span style="color: var(--text-dim); font-size:11px; font-style:italic;">未錄入得分</span>`}
                                                        </span>
                                                    </div>
                                                `;
                                            }).join('')}
                                            ${topRankers.length === 0 ? `<div style="text-align:center; padding: 30px 0; color:var(--text-muted); font-size: 12px;">該年級暫無體育得分記錄。</div>` : ''}
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `;
                } else if (activeSportsYear === "全校排行") {
                    const studentSportsScores = state.students.map(s => {
                        const studentTx = state.transactions.filter(t => t.studentId === s.id && t.type === 'earn' && (t.target.trim() === '體育' || t.target.trim() === '體藝'));
                        const score = studentTx.reduce((sum, t) => sum + Math.abs(t.points || 0), 0);
                        return { ...s, sportsScore: score };
                    });
                    
                    studentSportsScores.sort((a, b) => b.sportsScore - a.sportsScore);
                    
                    // Separate Top 3 for Podium
                    const firstPlace = (studentSportsScores[0] && studentSportsScores[0].sportsScore > 0) ? studentSportsScores[0] : null;
                    const secondPlace = (studentSportsScores[1] && studentSportsScores[1].sportsScore > 0) ? studentSportsScores[1] : null;
                    const thirdPlace = (studentSportsScores[2] && studentSportsScores[2].sportsScore > 0) ? studentSportsScores[2] : null;
                    
                    // Ranks 4 to 50 for Whole School!
                    const ranks4to50 = studentSportsScores.slice(3, 50).filter(s => s.sportsScore > 0);
                    const hasData = firstPlace || secondPlace || thirdPlace;

                    if (!hasData) {
                        return `
                            <div class="glass-card" style="text-align:center; padding: 60px 20px; border: 1px solid rgba(255,255,255,0.05); border-radius:16px;">
                                <div style="font-size: 48px; margin-bottom: 16px;">🌍</div>
                                <h4 style="font-size: 18px; color: #fff; font-weight:700; margin:0;">全校暫無體育積分紀錄</h4>
                                <p style="font-size: 13px; color: var(--text-muted); margin-top: 8px;">目前全校學生尚未有任何人在「體育」或「體藝」範疇中獲得過分數。</p>
                            </div>
                        `;
                    }

                    return `
                        <div class="glass-card" style="padding: 24px; border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; margin: 0 auto; max-width: 800px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);">
                            
                            <!-- Whole School title -->
                            <div style="text-align:center; margin-bottom: 24px;">
                                <h4 style="font-size: 18px; font-weight: 700; color: #fff; margin:0; display: inline-flex; align-items: center; gap: 8px;">
                                    🌍 全校神奇體育大王者殿堂 👑
                                </h4>
                                <p style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">🌟 匯聚全校各年級最富朝氣與毅力的體育王者前 50 強 🏆</p>
                            </div>

                            <!-- 3D Podium Layout -->
                            <div class="podium-container" style="display: flex; align-items: flex-end; justify-content: center; gap: 16px; margin: 20px auto 40px auto; max-width: 600px; padding: 10px;">
                                
                                <!-- 2nd Place -->
                                ${secondPlace ? `
                                    <div class="podium-item second" style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                                        <div class="podium-avatar" style="font-size: 36px; margin-bottom: 8px;">🥈</div>
                                        <div class="podium-name" style="font-weight: 700; color: var(--text-main); font-size: 14px; text-align: center;">${secondPlace.name}</div>
                                        <div class="podium-class" style="font-size: 11px; color: var(--text-dim); margin-top: 2px;">${secondPlace.year} / ${secondPlace.class}班 (${secondPlace.number ? secondPlace.number + '號' : '--'})</div>
                                        <div class="podium-step" style="width: 100%; height: 80px; background: linear-gradient(180deg, rgba(209, 213, 219, 0.15), rgba(209, 213, 219, 0.02)); border: 1px solid rgba(209, 213, 219, 0.2); border-bottom: none; border-radius: 12px 12px 0 0; display: flex; flex-direction: column; align-items: center; justify-content: center; margin-top: 10px;">
                                            <span style="font-size: 20px; font-weight: 800; color: #e5e7eb;">${secondPlace.sportsScore}</span>
                                            <span style="font-size: 10px; color: var(--text-dim); margin-top: 2px;">⭐</span>
                                        </div>
                                    </div>
                                ` : `
                                    <div style="flex: 1; height: 1px;"></div>
                                `}

                                <!-- 1st Place -->
                                ${firstPlace ? `
                                    <div class="podium-item first" style="flex: 1.2; display: flex; flex-direction: column; align-items: center; z-index: 10;">
                                        <div class="podium-avatar" style="font-size: 52px; margin-bottom: 8px; filter: drop-shadow(0 0 15px rgba(249, 115, 22, 0.4));">👑</div>
                                        <div class="podium-name" style="font-weight: 800; color: var(--text-main); font-size: 16px; text-align: center;">${firstPlace.name}</div>
                                        <div class="podium-class" style="font-size: 11px; color: var(--text-dim); margin-top: 2px;">${firstPlace.year} / ${firstPlace.class}班 (${firstPlace.number ? firstPlace.number + '號' : '--'})</div>
                                        <div class="podium-step" style="width: 100%; height: 120px; background: linear-gradient(180deg, rgba(249, 115, 22, 0.25), rgba(249, 115, 22, 0.03)); border: 1px solid rgba(249, 115, 22, 0.3); border-bottom: none; border-radius: 12px 12px 0 0; display: flex; flex-direction: column; align-items: center; justify-content: center; margin-top: 10px; box-shadow: 0 0 20px rgba(249, 115, 22, 0.1);">
                                            <span style="font-size: 26px; font-weight: 900; color: #f97316;">${firstPlace.sportsScore}</span>
                                            <span style="font-size: 11px; color: var(--text-dim); margin-top: 2px; font-weight: 600;">⭐</span>
                                        </div>
                                    </div>
                                ` : `
                                    <div style="flex: 1.2; height: 1px;"></div>
                                `}

                                <!-- 3rd Place -->
                                ${thirdPlace ? `
                                    <div class="podium-item third" style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                                        <div class="podium-avatar" style="font-size: 36px; margin-bottom: 8px;">🥉</div>
                                        <div class="podium-name" style="font-weight: 700; color: var(--text-main); font-size: 13px; text-align: center;">${thirdPlace.name}</div>
                                        <div class="podium-class" style="font-size: 11px; color: var(--text-dim); margin-top: 2px;">${thirdPlace.year} / ${thirdPlace.class}班 (${thirdPlace.number ? thirdPlace.number + '號' : '--'})</div>
                                        <div class="podium-step" style="width: 100%; height: 60px; background: linear-gradient(180deg, rgba(180, 83, 9, 0.15), rgba(180, 83, 9, 0.02)); border: 1px solid rgba(180, 83, 9, 0.2); border-bottom: none; border-radius: 12px 12px 0 0; display: flex; flex-direction: column; align-items: center; justify-content: center; margin-top: 10px;">
                                            <span style="font-size: 18px; font-weight: 800; color: #b45309;">${thirdPlace.sportsScore}</span>
                                            <span style="font-size: 10px; color: var(--text-dim); margin-top: 2px;">⭐</span>
                                        </div>
                                    </div>
                                ` : `
                                    <div style="flex: 1; height: 1px;"></div>
                                `}
                            </div>

                            <!-- Ranks 4 to 50 list -->
                            ${ranks4to50.length > 0 ? `
                                <div style="display:flex; flex-direction:column; gap:8px; max-width:600px; margin: 0 auto; border-top: 1px solid rgba(255,255,255,0.06); padding-top:20px;">
                                    ${ranks4to50.map((s, idx) => `
                                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; border-radius: 10px; background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.03); transition: all 0.2s ease;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='rgba(255,255,255,0.01)'">
                                            <div style="display: flex; align-items: center; gap: 14px;">
                                                <span style="font-size: 12px; font-weight: 800; width: 26px; height: 26px; border-radius: 50%; background: rgba(255,255,255,0.04); display: flex; align-items: center; justify-content: center; color: var(--text-dim);">${idx + 4}</span>
                                                <div>
                                                    <span style="color:#fff; font-weight:600; font-size:14px;">${s.name}</span>
                                                    <span style="font-size: 11px; color: var(--text-dim); margin-left: 6px;">(${s.year} / ${s.class}班 / ${s.number ? s.number + '號' : '--'})</span>
                                                </div>
                                            </div>
                                            <span style="font-size: 14px; color: var(--text-muted); font-weight:700;">${s.sportsScore} ⭐</span>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                    `;
                } else {
                    const yearStudents = state.students.filter(s => s.year === activeSportsYear);
                    const studentSportsScores = yearStudents.map(s => {
                        const studentTx = state.transactions.filter(t => t.studentId === s.id && t.type === 'earn' && (t.target.trim() === '體育' || t.target.trim() === '體藝'));
                        const score = studentTx.reduce((sum, t) => sum + Math.abs(t.points || 0), 0);
                        return { ...s, sportsScore: score };
                    });
                    
                    studentSportsScores.sort((a, b) => b.sportsScore - a.sportsScore);
                    
                    // Separate Top 3 for Podium
                    const firstPlace = (studentSportsScores[0] && studentSportsScores[0].sportsScore > 0) ? studentSportsScores[0] : null;
                    const secondPlace = (studentSportsScores[1] && studentSportsScores[1].sportsScore > 0) ? studentSportsScores[1] : null;
                    const thirdPlace = (studentSportsScores[2] && studentSportsScores[2].sportsScore > 0) ? studentSportsScores[2] : null;
                    
                    const ranks4to10 = studentSportsScores.slice(3, 10).filter(s => s.sportsScore > 0);
                    const hasData = firstPlace || secondPlace || thirdPlace;

                    if (!hasData) {
                        return `
                            <div class="glass-card" style="text-align:center; padding: 60px 20px; border: 1px solid rgba(255,255,255,0.05); border-radius:16px;">
                                <div style="font-size: 48px; margin-bottom: 16px;">🏃</div>
                                <h4 style="font-size: 18px; color: #fff; font-weight:700; margin:0;">暫無積分紀錄</h4>
                                <p style="font-size: 13px; color: var(--text-muted); margin-top: 8px;">該年級（${activeSportsYear}）學生目前尚未在「體育」範疇中獲得過分數。</p>
                            </div>
                        `;
                    }

                    return `
                        <div class="glass-card" style="padding: 24px; border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; margin: 0 auto; max-width: 800px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);">
                            
                            <!-- Year title -->
                            <div style="text-align:center; margin-bottom: 24px;">
                                <h4 style="font-size: 18px; font-weight: 700; color: #fff; margin:0;">${activeSportsYear} 體育之王殿堂 🏆</h4>
                                <p style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">🌟 年級最富朝氣與毅力的體育之星前十名 🏆</p>
                            </div>

                            <!-- 3D Podium Layout -->
                            <div class="podium-container" style="display: flex; align-items: flex-end; justify-content: center; gap: 16px; margin: 20px auto 40px auto; max-width: 600px; padding: 10px;">
                                
                                <!-- 2nd Place -->
                                ${secondPlace ? `
                                    <div class="podium-item second" style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                                        <div class="podium-avatar" style="font-size: 36px; margin-bottom: 8px;">🥈</div>
                                        <div class="podium-name" style="font-weight: 700; color: var(--text-main); font-size: 14px; text-align: center;">${secondPlace.name}</div>
                                        <div class="podium-class" style="font-size: 11px; color: var(--text-dim); margin-top: 2px;">${secondPlace.class}班 (${secondPlace.number ? secondPlace.number + '號' : '--'})</div>
                                        <div class="podium-step" style="width: 100%; height: 80px; background: linear-gradient(180deg, rgba(209, 213, 219, 0.15), rgba(209, 213, 219, 0.02)); border: 1px solid rgba(209, 213, 219, 0.2); border-bottom: none; border-radius: 12px 12px 0 0; display: flex; flex-direction: column; align-items: center; justify-content: center; margin-top: 10px;">
                                            <span style="font-size: 20px; font-weight: 800; color: #e5e7eb;">${secondPlace.sportsScore}</span>
                                            <span style="font-size: 10px; color: var(--text-dim); margin-top: 2px;">⭐</span>
                                        </div>
                                    </div>
                                ` : `
                                    <div style="flex: 1; height: 1px;"></div>
                                `}

                                <!-- 1st Place -->
                                ${firstPlace ? `
                                    <div class="podium-item first" style="flex: 1.2; display: flex; flex-direction: column; align-items: center; z-index: 10;">
                                        <div class="podium-avatar" style="font-size: 52px; margin-bottom: 8px; filter: drop-shadow(0 0 15px rgba(249, 115, 22, 0.4));">👑</div>
                                        <div class="podium-name" style="font-weight: 800; color: var(--text-main); font-size: 16px; text-align: center;">${firstPlace.name}</div>
                                        <div class="podium-class" style="font-size: 11px; color: var(--text-dim); margin-top: 2px;">${firstPlace.class}班 (${firstPlace.number ? firstPlace.number + '號' : '--'})</div>
                                        <div class="podium-step" style="width: 100%; height: 120px; background: linear-gradient(180deg, rgba(249, 115, 22, 0.25), rgba(249, 115, 22, 0.03)); border: 1px solid rgba(249, 115, 22, 0.3); border-bottom: none; border-radius: 12px 12px 0 0; display: flex; flex-direction: column; align-items: center; justify-content: center; margin-top: 10px; box-shadow: 0 0 20px rgba(249, 115, 22, 0.1);">
                                            <span style="font-size: 26px; font-weight: 900; color: #f97316;">${firstPlace.sportsScore}</span>
                                            <span style="font-size: 11px; color: var(--text-dim); margin-top: 2px; font-weight: 600;">⭐</span>
                                        </div>
                                    </div>
                                ` : `
                                    <div style="flex: 1.2; height: 1px;"></div>
                                `}

                                <!-- 3rd Place -->
                                ${thirdPlace ? `
                                    <div class="podium-item third" style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                                        <div class="podium-avatar" style="font-size: 36px; margin-bottom: 8px;">🥉</div>
                                        <div class="podium-name" style="font-weight: 700; color: var(--text-main); font-size: 13px; text-align: center;">${thirdPlace.name}</div>
                                        <div class="podium-class" style="font-size: 11px; color: var(--text-dim); margin-top: 2px;">${thirdPlace.class}班 (${thirdPlace.number ? thirdPlace.number + '號' : '--'})</div>
                                        <div class="podium-step" style="width: 100%; height: 60px; background: linear-gradient(180deg, rgba(180, 83, 9, 0.15), rgba(180, 83, 9, 0.02)); border: 1px solid rgba(180, 83, 9, 0.2); border-bottom: none; border-radius: 12px 12px 0 0; display: flex; flex-direction: column; align-items: center; justify-content: center; margin-top: 10px;">
                                            <span style="font-size: 18px; font-weight: 800; color: #b45309;">${thirdPlace.sportsScore}</span>
                                            <span style="font-size: 10px; color: var(--text-dim); margin-top: 2px;">⭐</span>
                                        </div>
                                    </div>
                                ` : `
                                    <div style="flex: 1; height: 1px;"></div>
                                `}
                            </div>

                            <!-- Ranks 4 to 10 list -->
                            ${ranks4to10.length > 0 ? `
                                <div style="display:flex; flex-direction:column; gap:8px; max-width:600px; margin: 0 auto; border-top: 1px solid rgba(255,255,255,0.06); padding-top:20px;">
                                    ${ranks4to10.map((s, idx) => `
                                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; border-radius: 10px; background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.03); transition: all 0.2s ease;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='rgba(255,255,255,0.01)'">
                                            <div style="display: flex; align-items: center; gap: 14px;">
                                                <span style="font-size: 12px; font-weight: 800; width: 26px; height: 26px; border-radius: 50%; background: rgba(255,255,255,0.04); display: flex; align-items: center; justify-content: center; color: var(--text-dim);">${idx + 4}</span>
                                                <div>
                                                    <span style="color:#fff; font-weight:600; font-size:14px;">${s.name}</span>
                                                    <span style="font-size: 11px; color: var(--text-dim); margin-left: 6px;">(${s.class}班 / ${s.number ? s.number + '號' : '--'})</span>
                                                </div>
                                            </div>
                                            <span style="font-size: 14px; color: var(--text-muted); font-weight:700;">${s.sportsScore} ⭐</span>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                    `;
                }
            })()}
        `;

        // Bind Sports Year Selector Buttons
        container.querySelectorAll('[data-sports-year-chip]').forEach(chip => {
            chip.addEventListener('click', () => {
                state.selectedSportsYear = chip.dataset.sportsYearChip;
                renderReportSubTable();
            });
        });
    } else if (state.activeReportTab === 'by-reasons') {
        if (filterBar) filterBar.style.display = 'none';

        // 1. Filter only 'earn' transactions (points addition)
        const earnTx = state.transactions.filter(t => t.type === 'earn' && t.target);
        
        // 2. Aggregate reasons
        const reasonMap = {};
        earnTx.forEach(t => {
            const reason = t.target.trim();
            if (!reasonMap[reason]) {
                reasonMap[reason] = {
                    reason: reason,
                    count: 0,
                    totalPoints: 0
                };
            }
            reasonMap[reason].count += 1;
            reasonMap[reason].totalPoints += Math.abs(t.points || 0);
        });

        const reasonRows = Object.values(reasonMap);
        // Sort by totalPoints descending, then count descending
        reasonRows.sort((a, b) => b.totalPoints - a.totalPoints);

        const uniqueReasonsCount = reasonRows.length;
        const totalAwardedTimes = earnTx.length;
        const totalAwardedPoints = earnTx.reduce((sum, t) => sum + Math.abs(t.points || 0), 0);

        container.innerHTML = `
            <div class="class-stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px;">
                <div class="stat-card" style="padding: 16px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; display: flex; align-items: center; gap: 12px;">
                    <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(139, 92, 246, 0.1); display: flex; align-items: center; justify-content: center; color: var(--primary); font-size: 18px;">
                        <i class="fas fa-bullseye"></i>
                    </div>
                    <div>
                        <h4 style="font-size: 20px; font-weight: 700; margin: 0; color: #fff;">${uniqueReasonsCount} 項</h4>
                        <p style="font-size: 11px; margin: 2px 0 0 0; color: var(--text-muted);">已觸發指標項目</p>
                    </div>
                </div>
                <div class="stat-card" style="padding: 16px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; display: flex; align-items: center; gap: 12px;">
                    <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(16, 185, 129, 0.1); display: flex; align-items: center; justify-content: center; color: var(--success); font-size: 18px;">
                        <i class="fas fa-award"></i>
                    </div>
                    <div>
                        <h4 style="font-size: 20px; font-weight: 700; margin: 0; color: #fff;">${totalAwardedTimes} 次</h4>
                        <p style="font-size: 11px; margin: 2px 0 0 0; color: var(--text-muted);">累計頒授總次數</p>
                    </div>
                </div>
                <div class="stat-card" style="padding: 16px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; display: flex; align-items: center; gap: 12px;">
                    <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(245, 158, 11, 0.1); display: flex; align-items: center; justify-content: center; color: var(--warning); font-size: 18px;">
                        <i class="fas fa-fire"></i>
                    </div>
                    <div>
                        <h4 style="font-size: 20px; font-weight: 700; margin: 0; color: #fff;">${totalAwardedPoints} 點</h4>
                        <p style="font-size: 11px; margin: 2px 0 0 0; color: var(--text-muted);">發放總分值統計</p>
                    </div>
                </div>
            </div>

            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>達成指標項目</th>
                            <th>獲頒次數 (頻率)</th>
                            <th>佔比</th>
                            <th>發放點數總額</th>
                            <th>平均每次分值</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reasonRows.map(r => {
                            const frequencyPercent = totalAwardedTimes ? Math.round((r.count / totalAwardedTimes) * 100) : 0;
                            const avgPoints = r.count ? Math.round(r.totalPoints / r.count) : 0;
                            return `
                                <tr>
                                    <td style="font-weight:600; color:#fff;">${r.reason}</td>
                                    <td style="font-weight:700; color:var(--primary);">${r.count} 次</td>
                                    <td>
                                        <div style="display:flex; align-items:center; gap:8px;">
                                            <div style="flex:1; height:6px; background:rgba(255,255,255,0.05); border-radius:3px; overflow:hidden;">
                                                <div style="width:${frequencyPercent}%; height:100%; background:var(--primary-gradient); border-radius:3px;"></div>
                                            </div>
                                            <span style="font-size:12px; color:var(--text-muted); min-width:30px;">${frequencyPercent}%</span>
                                        </div>
                                    </td>
                                    <td style="color:var(--success); font-weight:700;">+${r.totalPoints} 點</td>
                                    <td style="font-weight:600;">${avgPoints} 點 / 次</td>
                                </tr>
                            `;
                        }).join('')}
                        ${reasonRows.length === 0 ? `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">當前系統暫無任何加分日誌記錄。</td></tr>` : ''}
                    </tbody>
                </table>
            </div>
        `;
    } else if (state.activeReportTab === 'transactions') {
        const filteredTx = state.transactions.filter(t => {
            return t.studentName.toLowerCase().includes(query) || t.studentId.includes(query) || t.target.toLowerCase().includes(query);
        });

        container.innerHTML = `
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>交易感應時間</th>
                            <th>班級與學號</th>
                            <th>學生姓名</th>
                            <th>交易類型</th>
                            <th>加分事由 / 兌換獎品</th>
                            <th>點數變化額</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredTx.map(t => {
                            const studentObj = state.students.find(s => s.id === t.studentId);
                            const displayClass = t.studentClass || (studentObj ? studentObj.class : '--');
                            const displayNum = t.studentNum || (studentObj ? studentObj.studentNum : t.studentId);
                            return `
                                <tr>
                                    <td style="font-size:12px; color:var(--text-dim);">${new Date(t.timestamp).toLocaleString()}</td>
                                    <td style="font-weight:600; color:var(--secondary);">${displayClass} 班 (${displayNum})</td>
                                    <td style="font-weight:600;">${t.studentName}</td>
                                    <td>
                                        <span style="background:${t.type === 'earn' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; 
                                                     color:${t.type === 'earn' ? 'var(--success)' : 'var(--danger)'}; 
                                                     font-size:11px; font-weight:700; padding:3px 8px; border-radius:3px; text-transform:uppercase;">
                                            ${t.type === 'earn' ? '獲得積分' : '兌換禮品'}
                                        </span>
                                    </td>
                                    <td>${t.target}</td>
                                    <td style="font-weight:700; color:${t.points > 0 ? 'var(--success)' : 'var(--danger)'};">
                                        ${t.points > 0 ? '+' : ''}${t.points} 點
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                        ${filteredTx.length === 0 ? `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">暫無符合搜索條件的交易明細記錄。</td></tr>` : ''}
                    </tbody>
                </table>
            </div>
        `;
    } else if (state.activeReportTab === 'prefect-duty-log') {
        const filteredCheckins = state.prefectCheckins.filter(c => {
            const matchesSearch = c.name.toLowerCase().includes(query) || c.studentId.includes(query) || c.location.toLowerCase().includes(query);
            const matchesClass = !classF || c.class === classF;
            
            // 獲取年級匹配
            const studentObj = state.students.find(s => s.id === c.studentId);
            const matchesYear = !yearF || (studentObj && studentObj.year === yearF);
            
            return matchesSearch && matchesClass && matchesYear;
        });

        container.innerHTML = `
            <div style="margin-bottom: 20px; display: flex; gap: 12px; flex-wrap: wrap;">
                <button class="btn-style primary" id="btn-export-prefect-attendance" style="padding: 10px 18px; font-weight: 700; display: flex; align-items: center; gap: 6px;">
                    <i class="fas fa-file-export"></i> 匯出風紀考勤日誌 Excel
                </button>
                <button class="btn-style secondary" id="btn-download-prefect-template" style="padding: 10px 18px; font-weight: 700; display: flex; align-items: center; gap: 6px;">
                    <i class="fas fa-file-download"></i> 下載風紀當值班表範本
                </button>
                <button class="btn-style success" id="btn-import-prefect-schedule-trigger" style="padding: 10px 18px; font-weight: 700; display: flex; align-items: center; gap: 6px;">
                    <i class="fas fa-file-import"></i> 批次匯入風紀班表 Excel
                </button>
                <input type="file" id="prefect-schedule-file-input" style="display: none;" accept=".xlsx, .xls">
            </div>

            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>報到時間</th>
                            <th>學號</th>
                            <th>班級</th>
                            <th>姓名</th>
                            <th>當值位置</th>
                            <th>應到時間</th>
                            <th>考勤狀態</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredCheckins.map(c => {
                            let statusBadge = "";
                            if (c.status === "準時") {
                                statusBadge = `<span class="badge" style="background: #22c55e; color: white; font-weight:700;">準時</span>`;
                            } else if (c.status === "遲到") {
                                statusBadge = `<span class="badge" style="background: #f97316; color: white; font-weight:700;">遲到 (${c.delayMinutes} 分)</span>`;
                            } else {
                                statusBadge = `<span class="badge" style="background: #3b82f6; color: white; font-weight:700;">常規報到</span>`;
                            }
                            const demoNote = c.isDemoMatch ? ` <span style="font-size:0.75rem; color:var(--secondary); font-weight:600;">(演示)</span>` : "";
                            return `
                                <tr>
                                    <td style="font-size:12px; color:var(--text-dim);">${new Date(c.timestamp).toLocaleString()}</td>
                                    <td style="font-family: monospace;">${c.studentId}</td>
                                    <td>${c.class} 班</td>
                                    <td style="font-weight: 600;">${c.name}</td>
                                    <td style="color: var(--secondary); font-weight: 600;">${c.location}</td>
                                    <td>${c.schedTime}${demoNote}</td>
                                    <td>${statusBadge}</td>
                                </tr>
                            `;
                        }).join('')}
                        ${filteredCheckins.length === 0 ? `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding: 24px 0;">暫無符合條件的風紀報到考勤記錄。</td></tr>` : ''}
                    </tbody>
                </table>
            </div>
        `;

        // 綁定事件監聽器
        document.getElementById('btn-export-prefect-attendance').addEventListener('click', handleExportPrefectCheckins);
        document.getElementById('btn-download-prefect-template').addEventListener('click', handleDownloadPrefectTemplate);
        document.getElementById('btn-import-prefect-schedule-trigger').addEventListener('click', () => {
            document.getElementById('prefect-schedule-file-input').click();
        });
        document.getElementById('prefect-schedule-file-input').addEventListener('change', handleImportPrefectSchedule);
    } else if (state.activeReportTab === 'student-accounts-lookup') {
        const filteredStudents = state.students.filter(s => {
            const matchesSearch = 
                s.name.toLowerCase().includes(query) || 
                (s.nameEn && s.nameEn.toLowerCase().includes(query)) ||
                (s.studentNum && s.studentNum.toLowerCase().includes(query)) ||
                (s.email && s.email.toLowerCase().includes(query)) ||
                s.id.includes(query);
            const matchesClass = !classF || s.class === classF;
            const matchesYear = !yearF || s.year === yearF;
            return matchesSearch && matchesClass && matchesYear;
        });

        // 按班級與座號升序排列
        filteredStudents.sort((a, b) => {
            const classCompare = a.class.localeCompare(b.class, undefined, { numeric: true, sensitivity: 'base' });
            if (classCompare !== 0) return classCompare;
            const numA = parseInt(a.number) || 0;
            const numB = parseInt(b.number) || 0;
            return numA - numB;
        });

        container.innerHTML = `
            <div style="margin-bottom: 16px; padding: 14px; background: rgba(59, 130, 246, 0.04); border: 1.5px dashed rgba(59, 130, 246, 0.15); border-radius: 12px; font-size: 13px; color: #4b5563; line-height: 1.6;">
                💡 <strong>🔑 學生帳號與登入資訊對照表</strong>：此頁面專供教師進行雙重核對 (Double Check)。您可以透過上方搜尋欄快速模糊檢索學生的「中文姓名、英文姓名、學生編號 (s號碼)、卡片 ID (RFID) 或 Google 電郵」來確認學生的對接設定狀態。
            </div>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>班別</th>
                            <th>座號</th>
                            <th>學生姓名</th>
                            <th>英文姓名</th>
                            <th>學生編號 (s號碼)</th>
                            <th>Google 學生電郵</th>
                            <th>智能卡 ID (RFID)</th>
                            <th>條碼編號 (Barcode)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredStudents.map(s => `
                            <tr>
                                <td style="font-weight: 700; color: var(--secondary);">${s.class} 班</td>
                                <td style="font-weight: 600;">${s.number ? s.number + ' 號' : '--'}</td>
                                <td style="font-weight: 700; color: var(--text-color);">${s.name}</td>
                                <td style="font-size: 12px; color: var(--text-muted); font-family: monospace;">${s.nameEn || '--'}</td>
                                <td style="font-weight: 600; font-family: monospace; color: #3b82f6;">${s.studentNum || '--'}</td>
                                <td style="font-size: 13px; color: #10b981; font-weight: 600; font-family: monospace;">${s.email || '--'}</td>
                                <td style="font-family: monospace; color: var(--text-muted); font-size: 12px;">${s.id}</td>
                                <td style="font-family: monospace; color: var(--text-dim); font-size: 12px;">${s.barcode || '--'}</td>
                            </tr>
                        `).join('')}
                        ${filteredStudents.length === 0 ? `<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding: 24px 0;">未找到與當前篩選條件相匹配的學生數據。</td></tr>` : ''}
                    </tbody>
                </table>
            </div>
        `;
    }
}

// =========================================================================
// SHEETJS 繁體多工作簿高兼容 EXCEL 導出模塊
// =========================================================================
function handleExportExcel() {
    if (!window.XLSX) {
        showToast("Excel 導出大庫尚未加載完成，請重試或連接互聯網。", "danger");
        return;
    }
    showToast("正在自動彙總數據，準備生成 Excel 多表報表...", "info");
    
    // --- 工作表 1：學生點數排表 ---
    const studentsData = state.students.map((s, idx) => ({
        "全校排名": idx + 1,
        "學生感應卡 ID": s.id,
        "學生姓名": s.name,
        "所屬班級": s.class + "班",
        "所屬年級": s.year,
        "可用點數餘額 (點)": s.points,
        "已領用點數 (點)": s.redeemed,
        "累計獲取總積分 (點)": s.points + s.redeemed,
        "綁定 Google 電郵": s.email || ""
    }));
    studentsData.sort((a, b) => b["可用點數餘額 (點)"] - a["可用點數餘額 (點)"]);
    studentsData.forEach((s, idx) => s["全校排名"] = idx + 1);

    // --- 工作表 2：班級彙總分析 ---
    const classMap = {};
    state.students.forEach(s => {
        if (!classMap[s.class]) {
            classMap[s.class] = { "Class": s.class, "Year Group": s.year, "Count": 0, "Points": 0, "Redeemed": 0 };
        }
        classMap[s.class]["Count"] += 1;
        classMap[s.class]["Points"] += s.points;
        classMap[s.class]["Redeemed"] += s.redeemed;
    });
    const classData = Object.values(classMap).map(c => ({
        "班級名稱": c["Class"] + "班",
        "年級組別": c["Year Group"],
        "班級人數": c["Count"] + "人",
        "班級可用總餘額": c["Points"],
        "班級累計已兌換額": c["Redeemed"],
        "班級人均分值 (點)": Math.round(c["Points"] / c["Count"])
    }));
    classData.sort((a, b) => b["班級人均分值 (點)"] - a["班級人均分值 (點)"]);

    // --- 工作表 3：年級彙總分析 ---
    const yearMap = {};
    state.students.forEach(s => {
        if (!yearMap[s.year]) {
            yearMap[s.year] = { "Year": s.year, "Count": 0, "Points": 0, "Redeemed": 0 };
        }
        yearMap[s.year]["Count"] += 1;
        yearMap[s.year]["Points"] += s.points;
        yearMap[s.year]["Redeemed"] += s.redeemed;
    });
    const yearData = Object.values(yearMap).map(y => ({
        "年級組別": y["Year"],
        "年級學生人數": y["Count"] + "人",
        "可用分值總餘額": y["Points"],
        "累計已兌換總額": y["Redeemed"],
        "年級人均分值 (點)": Math.round(y["Points"] / y["Count"])
    }));
    yearData.sort((a, b) => b["年級人均分值 (點)"] - a["年級人均分值 (點)"]);

    // --- 工作表 4：歷史明細日誌 ---
    const logData = state.transactions.map(t => ({
        "交易感應時間": new Date(t.timestamp).toLocaleString(),
        "卡片 ID": t.studentId,
        "學生姓名": t.studentName,
        "交易類型": t.type === 'earn' ? "獲得積分" : "兌換禮品",
        "事由 / 禮品規格": t.target,
        "點數變更 (點)": t.points
    }));

    // 初始化 SheetJS 工作簿
    const wb = window.XLSX.utils.book_new();
    
    const wsStudents = window.XLSX.utils.json_to_sheet(studentsData);
    const wsClasses = window.XLSX.utils.json_to_sheet(classData);
    const wsYears = window.XLSX.utils.json_to_sheet(yearData);
    const wsLogs = window.XLSX.utils.json_to_sheet(logData);

    // 拼入工作表
    window.XLSX.utils.book_append_sheet(wb, wsStudents, "學生積分總榜");
    window.XLSX.utils.book_append_sheet(wb, wsClasses, "班級大數據分析");
    window.XLSX.utils.book_append_sheet(wb, wsYears, "年級大數據分析");
    window.XLSX.utils.book_append_sheet(wb, wsLogs, "全校歷史刷卡明細");

    // 保存導出文件
    window.XLSX.writeFile(wb, `學校積分統計總表_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    showToast("Excel 多表數據報表導出成功！已自動開始下載。", "success");
}

// 一鍵導出班級學生成就特質矩陣到 Excel 文件
function handleExportClassMatrix(className) {
    if (!window.XLSX) {
        showToast("Excel 大庫尚未加載完成，請檢查網絡連線。", "danger");
        return;
    }

    const classStudents = state.students.filter(s => s.class === className);
    classStudents.sort((a, b) => {
        const numA = parseInt(a.number) || 0;
        const numB = parseInt(b.number) || 0;
        return numA - numB;
    });

    const exportRows = classStudents.map(s => {
        const studentTx = state.transactions.filter(t => t.studentId === s.id && t.type === 'earn');
        let academic = 0, religion = 0, pe = 0, art = 0, library = 0, putonghua = 0, english = 0, moral = 0;
        
        studentTx.forEach(t => {
            const target = t.target.trim();
            const pts = Math.abs(t.points || 0);
            if (target === '學業') academic += pts;
            else if (target === '宗德') religion += pts;
            else if (target === '體育') pe += pts;
            else if (target === '視藝') art += pts;
            else if (target === '體藝') { pe += pts; art += pts; } // 舊數據相容
            else if (target === '圖書') library += pts;
            else if (target === '普通話') putonghua += pts;
            else if (target === 'English') english += pts;
            else moral += pts;
        });
        const total = academic + religion + pe + art + library + putonghua + english + moral;

        return {
            "班級座號": s.number ? `${s.number} 號` : "",
            "學生姓名": s.name,
            "學生卡 ID": s.id,
            "年級組別": s.year,
            "學業得分 (點)": academic,
            "宗德得分 (點)": religion,
            "體育得分 (點)": pe,
            "視藝得分 (點)": art,
            "圖書得分 (點)": library,
            "普通話得分 (點)": putonghua,
            "English得分 (點)": english,
            "達成指標得分 (點)": moral,
            "累計總得分 (點)": total
        };
    });

    // 初始化 SheetJS 工作簿
    const wb = window.XLSX.utils.book_new();
    const ws = window.XLSX.utils.json_to_sheet(exportRows);

    // 設置每列寬度使其美觀
    ws['!cols'] = [
        { wch: 12 }, // 班級座號
        { wch: 14 }, // 學生姓名
        { wch: 16 }, // 學生卡 ID
        { wch: 14 }, // 年級組別
        { wch: 16 }, // 學業得分
        { wch: 16 }, // 宗德得分
        { wch: 16 }, // 體育得分
        { wch: 16 }, // 視藝得分
        { wch: 16 }, // 圖書得分
        { wch: 16 }, // 普通話得分
        { wch: 16 }, // English得分
        { wch: 18 }, // 達成指標得分
        { wch: 18 }  // 累計總得分
    ];

    window.XLSX.utils.book_append_sheet(wb, ws, `${className}班學生成就矩陣`);
    window.XLSX.writeFile(wb, `${className}班學生成就特質矩陣_${new Date().toISOString().split('T')[0]}.xlsx`);

    showToast(`導出 ${className} 班成就矩陣 Excel 成功！已自動下載。`, "success");
}

// 下載 Excel 空白匯入學生名冊範本
function handleDownloadImportTemplate() {
    if (!window.XLSX) {
        showToast("Excel 大庫尚未加載完成，請檢查網絡連線。", "danger");
        return;
    }
    const templateData = [
        {
            "學生卡 ID (必填)": "10002001",
            "學生姓名 (必填)": "陳大文",
            "所屬班級 (必填)": "1A",
            "年級組別 (必填)": "P.1",
            "可用點數餘額 (選填)": 100,
            "累計已兌換 (選填)": 0,
            "電子郵件 (選填)": "s10002001@gmail.com"
        },
        {
            "學生卡 ID (必填)": "10002002",
            "學生姓名 (必填)": "李小玲",
            "所屬班級 (必填)": "1B",
            "年級組別 (必填)": "P.1",
            "可用點數餘額 (選填)": 120,
            "累計已兌換 (選填)": 15,
            "電子郵件 (選填)": ""
        }
    ];
    const wb = window.XLSX.utils.book_new();
    const ws = window.XLSX.utils.json_to_sheet(templateData);
    
    // 設置列寬，讓範本看起來更加精緻
    ws['!cols'] = [
        { wch: 18 }, // 學生卡 ID
        { wch: 16 }, // 學生姓名
        { wch: 16 }, // 所屬班級
        { wch: 16 }, // 年級組別
        { wch: 18 }, // 可用點數餘額
        { wch: 16 }, // 累計已兌換
        { wch: 25 }  // 電子郵件
    ];

    window.XLSX.utils.book_append_sheet(wb, ws, "學生名冊導入範本");
    window.XLSX.writeFile(wb, "學生名冊導入範本.xlsx");
    showToast("匯入範本 Excel 下載成功！請填入學生真實數據後重新上傳。", "success");
}

// 批次解析上傳的 Excel 學生名冊
async function handleImportExcel(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!window.XLSX) {
        showToast("Excel 解析庫尚未加載完成，請檢查網絡連線。", "danger");
        return;
    }

    showToast("正在讀取並解析 Excel 文件...", "info");

    const reader = new FileReader();
    reader.onload = async (evt) => {
        try {
            const data = new Uint8Array(evt.target.result);
            const workbook = window.XLSX.read(data, { type: 'array' });
            
            // 讀取第一個工作表
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // 轉換為 JSON 對象數組
            const rawRows = window.XLSX.utils.sheet_to_json(worksheet);
            
            if (rawRows.length === 0) {
                showToast("上傳的 Excel 表格為空，無任何學生記錄！", "warning");
                return;
            }

            const importedStudents = [];
            const idsSeen = new Set();

            for (let i = 0; i < rawRows.length; i++) {
                const row = rawRows[i];
                
                // 模糊兼容匹配字段
                const id = String(row["學生卡 ID (必填)"] || row["學生卡 ID"] || row["卡號"] || row["卡片 ID"] || row["ID"] || row["Card ID"] || "").trim();
                const name = String(row["學生姓名 (必填)"] || row["學生姓名"] || row["姓名"] || row["Name"] || "").trim();
                const className = String(row["所屬班級 (必填)"] || row["所屬班級"] || row["班級"] || row["Class"] || "1A").trim();
                const number = String(row["班級座號"] || row["座號"] || row["班號"] || row["座號 (選填)"] || row["Number"] || row["Class Number"] || "").trim();
                const year = normalizeYear(String(row["年級組別 (必填)"] || row["年級組別"] || row["年級"] || row["Year"] || "P.1"));
                const points = parseInt(row["可用點數餘額 (選填)"] || row["可用點數"] || row["積分"] || row["餘額"] || row["Points"] || "0");
                const redeemed = parseInt(row["累計已兌換 (選填)"] || row["已兌換"] || row["已領用"] || row["Redeemed"] || "0");
                const email = String(row["電子郵件 (選填)"] || row["電子郵件"] || row["Google 電郵"] || row["電郵"] || row["Email"] || "").trim().toLowerCase();

                if (!id || !name) {
                    console.warn(`第 ${i + 2} 行因缺失必填的卡片 ID 或姓名，已自動跳過。`);
                    continue;
                }

                if (idsSeen.has(id)) {
                    console.warn(`第 ${i + 2} 行檢測到重複的卡片 ID [${id}]，已自動跳過。`);
                    continue;
                }

                idsSeen.add(id);
                importedStudents.push({
                    id,
                    name,
                    class: className,
                    number: number || "",
                    year,
                    points: isNaN(points) ? 0 : points,
                    redeemed: isNaN(redeemed) ? 0 : redeemed,
                    email: email || ""
                });
            }

            if (importedStudents.length === 0) {
                showToast("未成功解析出任何有效的學生記錄！請檢查表格列標題。", "danger");
                return;
            }

            if (confirm(`成功解析出 ${importedStudents.length} 筆學生名冊，是否確認將其批次覆蓋並匯入？`)) {
                await DB.saveStudentsBulk(importedStudents);
                showToast(`成功匯入 ${importedStudents.length} 筆學生名冊！數據已實時更新。`, "success");
                
                // 重置教師端和學生端的掃描對象，保障數據一致性
                state.scannedStudent = null;
                state.kioskStudent = null;
                
                // 重新渲染視窗與模擬器
                switchTab(state.activeTab);
                renderInteractiveSimulator();
            }
        } catch (err) {
            console.error(err);
            showToast("Excel 文件解析出錯，請確保文件格式正確並符合模板規範。", "danger");
        }
        // 清空 file input，以便同個文件可以重複觸發變更
        e.target.value = '';
    };
    reader.readAsArrayBuffer(file);
}

// =========================================================================
// 浮動測試輔助：RFID 讀卡模擬感應面板
// =========================================================================
function renderInteractiveSimulator() {
    const body = document.getElementById('sim-student-list');
    if (!body) return;

    // 建立一個即時搜尋輸入框 (如果尚未建立)
    let searchInput = document.getElementById('sim-student-search');
    if (!searchInput) {
        const wrapper = document.createElement('div');
        wrapper.style.marginBottom = '12px';
        wrapper.innerHTML = `
            <input type="text" id="sim-student-search" class="input-style" placeholder="🔍 輸入姓名、班級或學號搜尋學生..." style="width: 100%; padding: 8px 12px; font-size: 13px; border-radius: 8px; border: 1.5px solid rgba(139, 92, 246, 0.15); box-shadow: inset 0 1px 3px rgba(0,0,0,0.02);">
        `;
        body.parentNode.insertBefore(wrapper, body);
        searchInput = document.getElementById('sim-student-search');
        searchInput.addEventListener('input', () => {
            renderInteractiveSimulatorList(searchInput.value.trim().toLowerCase());
        });
    }

    // 呼叫清單繪製器
    renderInteractiveSimulatorList(searchInput ? searchInput.value.trim().toLowerCase() : '');
}

function renderInteractiveSimulatorList(query = '') {
    const body = document.getElementById('sim-student-list');
    if (!body) return;

    body.innerHTML = '';
    
    // 過濾匹配的學生
    const filtered = state.students.filter(s => {
        if (!query) return s.class === "1A"; // 空輸入時默認只展示 1A 班，防禦全校 570 人造成 UI 渲染卡頓
        return s.name.toLowerCase().includes(query) || 
               s.class.toLowerCase().includes(query) || 
               (s.studentNum && s.studentNum.toLowerCase().includes(query)) ||
               s.id.includes(query);
    });

    // 限制最多顯示 15 筆，極致流暢
    const displayList = filtered.slice(0, 15);

    if (displayList.length === 0) {
        body.innerHTML = `
            <div style="text-align: center; padding: 16px; color: var(--text-dim); font-size: 13px; font-weight: 500;">
                ❌ 找不到符合該姓名或條件的學生
            </div>
        `;
        return;
    }

    displayList.forEach(student => {
        const div = document.createElement('div');
        div.className = "sim-student-row";
        div.style.cursor = 'pointer';
        div.innerHTML = `
            <div class="sim-stud-meta">
                <h5 style="font-weight: 800; font-size: 14px; color: var(--text-main); margin: 0;">${student.name}</h5>
                <p style="font-size: 11px; color: var(--text-dim); margin-top: 3px; margin-bottom: 0;">
                    ${student.class}班 | 學號: <strong>${student.studentNum || student.id}</strong> | 點數: <strong style="color: #d97706; font-weight:800;">${student.points} ⭐</strong>
                </p>
            </div>
            <div class="sim-swipe-badge" style="font-size: 10.5px; padding: 4px 10px; font-weight: 700; background: rgba(139, 92, 246, 0.08); color: var(--primary); border-radius: 6px; transition: all 0.2s;">模擬嗶卡</div>
        `;

        div.addEventListener('click', () => {
            CardReader.onCardSwiped(student.id);
        });

        body.appendChild(div);
    });
}

// =========================================================================
// 開發者數據庫同步：Google Firebase Firestore 連接設定
// =========================================================================
function openFirebaseConfigModal() {
    if (state.userRole !== 'teacher') {
        const pin = prompt("🔐 這是受保護的系統設定區域。\n\n請輸入教師管理密碼以開啟 Google Firebase 雲端配置參數：");
        if (pin !== "510971") {
            if (pin !== null) {
                showToast("驗證失敗，密碼錯誤！", "error");
            }
            return;
        }
    }

    const overlay = document.getElementById('firebase-config-modal');
    const apiKey = document.getElementById('fb-api-key');
    const authDom = document.getElementById('fb-auth-domain');
    const projId = document.getElementById('fb-project-id');
    const storBuc = document.getElementById('fb-storage-bucket');
    const msgSend = document.getElementById('fb-messaging-sender');
    const appIdInput = document.getElementById('fb-app-id');

    const savedConfig = localStorage.getItem('student_points_firebase_config');
    if (savedConfig) {
        const cfg = JSON.parse(savedConfig);
        apiKey.value = cfg.apiKey || '';
        authDom.value = cfg.authDomain || '';
        projId.value = cfg.projectId || '';
        storBuc.value = cfg.storageBucket || '';
        msgSend.value = cfg.messagingSenderId || '';
        appIdInput.value = cfg.appId || '';
        
        document.getElementById('fb-disconnect-btn').style.display = 'block';
    } else {
        apiKey.value = '';
        authDom.value = '';
        projId.value = '';
        storBuc.value = '';
        msgSend.value = '';
        appIdInput.value = '';
        
        document.getElementById('fb-disconnect-btn').style.display = 'none';
    }

    overlay.classList.add('active');
}

async function handleFirebaseConfigSave(e) {
    e.preventDefault();
    const config = {
        apiKey: document.getElementById('fb-api-key').value.trim(),
        authDomain: document.getElementById('fb-auth-domain').value.trim(),
        projectId: document.getElementById('fb-project-id').value.trim(),
        storageBucket: document.getElementById('fb-storage-bucket').value.trim(),
        messagingSenderId: document.getElementById('fb-messaging-sender').value.trim(),
        appId: document.getElementById('fb-app-id').value.trim(),
    };

    if (!config.apiKey || !config.projectId || !config.appId) {
        showToast("請完整填寫核心 Firebase 參數 (API Key, Project ID, App ID)。", "warning");
        return;
    }

    document.getElementById('firebase-config-modal').classList.remove('active');
    showToast("正在嘗試與 Google Firebase Firestore 雲端建立連接...", "info");
    
    await DB.saveFirebaseConfig(config);
    
    // 重新切換刷新數據狀態
    switchTab(state.activeTab);
    renderInteractiveSimulator();
}

function handleFirebaseDisconnect() {
    DB.clearFirebaseConfig();
    document.getElementById('firebase-config-modal').classList.remove('active');
    
    switchTab(state.activeTab);
    renderInteractiveSimulator();
}

// =========================================================================
// 訓輔大加分模組邏輯與視窗渲染
// =========================================================================
function initGuidanceDiscipline() {
    // 預設初始化選中的班級/年級
    if (!state.gdSelectedScope) {
        state.gdSelectedScope = 'class';
        state.gdSelectedClass = window.CLASSES_LIST[0] || '1A';
        state.gdSelectedYear = window.YEARS_LIST[0] || 'P.1';
        state.gdSelectedCategory = '🛡️ 守規小楷模';
    }

    // 綁定範圍切換按鈕事件
    const btnClass = document.getElementById('gd-scope-class');
    const btnYear = document.getElementById('gd-scope-year');
    const wrapperClass = document.getElementById('gd-class-selector-wrapper');
    const wrapperYear = document.getElementById('gd-year-selector-wrapper');

    if (btnClass && btnYear) {
        btnClass.addEventListener('click', () => {
            btnClass.classList.add('active');
            btnYear.classList.remove('active');
            if (wrapperClass) wrapperClass.style.display = 'flex';
            if (wrapperYear) wrapperYear.style.display = 'none';
            state.gdSelectedScope = 'class';
            renderGuidanceDisciplineDashboard();
        });

        btnYear.addEventListener('click', () => {
            btnYear.classList.add('active');
            btnClass.classList.remove('active');
            if (wrapperYear) wrapperYear.style.display = 'flex';
            if (wrapperClass) wrapperClass.style.display = 'none';
            state.gdSelectedScope = 'year';
            renderGuidanceDisciplineDashboard();
        });
    }

    // 渲染班級選擇按鈕
    function renderGuidanceClassButtons() {
        if (!wrapperClass) return;
        wrapperClass.innerHTML = window.CLASSES_LIST.map(c => {
            const isActive = state.gdSelectedClass === c;
            return `<button class="chip-btn ${isActive ? 'active' : ''}" data-gd-class="${c}" style="font-weight: 800; border-radius: 10px; border: 1.5px solid ${isActive ? '#8b5cf6' : 'rgba(168,85,247,0.12)'}; background: ${isActive ? 'linear-gradient(135deg, #a855f7, #8b5cf6)' : 'rgba(255,255,255,0.6)'}; color: ${isActive ? '#fff' : '#4f46e5'}; padding: 6px 12px; font-size: 13px; cursor: pointer; transition: all 0.2s; box-shadow: ${isActive ? '0 4px 12px rgba(139,92,246,0.3)' : 'none'};">${c} 班</button>`;
        }).join('');

        wrapperClass.querySelectorAll('[data-gd-class]').forEach(btn => {
            btn.addEventListener('click', () => {
                state.gdSelectedClass = btn.dataset.gdClass;
                renderGuidanceClassButtons();
                renderGuidanceDisciplineDashboard();
            });
        });
    }

    // 渲染年級選擇按鈕
    function renderGuidanceYearButtons() {
        if (!wrapperYear) return;
        wrapperYear.innerHTML = window.YEARS_LIST.map(y => {
            const isActive = state.gdSelectedYear === y;
            return `<button class="chip-btn ${isActive ? 'active' : ''}" data-gd-year="${y}" style="font-weight: 800; border-radius: 10px; border: 1.5px solid ${isActive ? '#8b5cf6' : 'rgba(168,85,247,0.12)'}; background: ${isActive ? 'linear-gradient(135deg, #a855f7, #8b5cf6)' : 'rgba(255,255,255,0.6)'}; color: ${isActive ? '#fff' : '#4f46e5'}; padding: 6px 12px; font-size: 13px; cursor: pointer; transition: all 0.2s; box-shadow: ${isActive ? '0 4px 12px rgba(139,92,246,0.3)' : 'none'};">${y}</button>`;
        }).join('');

        wrapperYear.querySelectorAll('[data-gd-year]').forEach(btn => {
            btn.addEventListener('click', () => {
                state.gdSelectedYear = btn.dataset.gdYear;
                renderGuidanceYearButtons();
                renderGuidanceDisciplineDashboard();
            });
        });
    }

    // 執行初始繪製
    renderGuidanceClassButtons();
    renderGuidanceYearButtons();

    // 渲染行為特質
    const catGrid = document.getElementById('gd-category-grid');
    if (catGrid) {
        const categories = [
            { icon: 'fa-shield-alt', color: '#8b5cf6', text: '🛡️ 守規小楷模' },
            { icon: 'fa-handshake', color: '#ec4899', text: '🤝 禮貌小天使' },
            { icon: 'fa-star', color: '#eab308', text: '🌟 互助小英雄' },
            { icon: 'fa-leaf', color: '#10b981', text: '🎒 整潔環保衛士' },
            { icon: 'fa-heart', color: '#ef4444', text: '📖 誠實守信寶貝' },
            { icon: 'fa-fire', color: '#f97316', text: '💪 毅力小勇士' }
        ];

        catGrid.innerHTML = categories.map(cat => {
            return `
                <div class="category-chip ${state.gdSelectedCategory === cat.text ? 'active' : ''}" data-gd-cat="${cat.text}" style="padding: 10px 14px; font-weight: 800; border-radius: 12px; display: flex; align-items: center; justify-content: center; gap: 8px; border: 1.5px solid rgba(168,85,247,0.12); cursor: pointer; transition: all 0.2s;">
                    <i class="fas ${cat.icon}" style="color: ${cat.color};"></i> ${cat.text.replace(/^[^\s]+\s*/, '')}
                </div>
            `;
        }).join('');

        catGrid.querySelectorAll('[data-gd-cat]').forEach(chip => {
            chip.addEventListener('click', () => {
                catGrid.querySelectorAll('[data-gd-cat]').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                state.gdSelectedCategory = chip.dataset.gdCat;
            });
        });
    }

    // 綁定加分發射按鈕
    [1, 2, 5, 10].forEach(pts => {
        const btn = document.getElementById(`gd-award-${pts}`);
        if (btn) {
            btn.addEventListener('click', () => handleGuidanceDisciplineAward(pts));
        }
    });
}

async function migrateStudentEmailsAndRosterFirestore() {
    if (state.isFirebase && state.firebaseDb && localStorage.getItem('student_emails_migrated_v132_firestore') !== 'done') {
        try {
            console.log("🚀 正在啟動 Firestore 雲端 Google 帳號與學籍座號同步對接程序 (v132)...");
            
            const existingByNum = new Map();
            const existingByName = new Map();
            const existingById = new Map();
            
            state.students.forEach(s => {
                if (s.studentNum) existingByNum.set(s.studentNum.toLowerCase().trim(), s);
                if (s.name) existingByName.set(s.name.trim(), s);
                if (s.id) existingById.set(s.id.trim(), s);
            });
            
            const updatedStudents = [];
            const idsSeen = new Set();
            
            (window.DEFAULT_STUDENTS || []).forEach(defS => {
                const sNumKey = defS.studentNum ? defS.studentNum.toLowerCase().trim() : "";
                const existing = existingByNum.get(sNumKey) || existingByName.get(defS.name.trim()) || existingById.get(defS.id.trim());
                
                let studentObj;
                if (existing) {
                    studentObj = {
                        ...existing,
                        id: existing.id || defS.id,
                        name: defS.name,
                        nameEn: defS.nameEn || existing.nameEn || "",
                        class: defS.class,
                        number: defS.number,
                        email: defS.email,
                        studentNum: defS.studentNum,
                        barcode: defS.barcode || existing.barcode || "",
                        year: defS.year || existing.year || ""
                    };
                } else {
                    studentObj = { ...defS };
                }
                
                if (!idsSeen.has(studentObj.id)) {
                    idsSeen.add(studentObj.id);
                    updatedStudents.push(studentObj);
                }
            });
            
            // 保留雲端中剩餘的不在預設列表中的學生
            state.students.forEach(s => {
                if (!idsSeen.has(s.id)) {
                    idsSeen.add(s.id);
                    updatedStudents.push(s);
                }
            });
            
            // 更新本地狀態
            state.students = updatedStudents;
            
            const { doc, writeBatch } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
            let batch = writeBatch(state.firebaseDb);
            let count = 0;
            for (const student of updatedStudents) {
                const docRef = doc(state.firebaseDb, "students", student.id);
                batch.set(docRef, student, { merge: true });
                count++;
                if (count % 400 === 0) {
                    await batch.commit();
                    batch = writeBatch(state.firebaseDb);
                }
            }
            if (count % 400 !== 0) {
                await batch.commit();
            }
            
            localStorage.setItem('student_emails_migrated_v132_firestore', 'done');
            console.log(`✅ 雲端對接成功！已完成雲端 ${updatedStudents.length} 筆學籍與座號同步。`);
        } catch (e) {
            console.error("❌ 雲端 Google 帳號與學籍對接失敗:", e);
        }
    }
}

function renderGuidanceDisciplineDashboard() {
    // 獲取符合篩選的學生
    const filteredStudents = state.students.filter(s => {
        if (state.gdSelectedScope === 'class') {
            return s.class === state.gdSelectedClass;
        } else {
            return s.year === state.gdSelectedYear;
        }
    });

    // 排序
    filteredStudents.sort((a, b) => {
        const numA = parseInt(a.id) || 0;
        const numB = parseInt(b.id) || 0;
        return numA - numB;
    });

    // 更新計數與目標名稱
    const countSpan = document.getElementById('gd-preview-count');
    const targetSpan = document.getElementById('gd-preview-target-name');
    if (countSpan) countSpan.innerText = filteredStudents.length;
    if (targetSpan) {
        targetSpan.innerText = state.gdSelectedScope === 'class' 
            ? `🏫 ${state.gdSelectedClass} 班全體` 
            : `🎓 ${state.gdSelectedYear} 全體`;
    }

    // 渲染名冊預覽卡片
    const previewGrid = document.getElementById('gd-student-preview-grid');
    if (previewGrid) {
        if (filteredStudents.length === 0) {
            previewGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-dim);">
                    <i class="fas fa-users-slash" style="font-size: 32px; margin-bottom: 8px;"></i>
                    <p style="font-weight: 700;">名單內目前沒有學生喔</p>
                </div>
            `;
        } else {
            previewGrid.innerHTML = filteredStudents.map(s => {
                return `
                    <div class="glass-card student-preview-item-card" id="preview-student-${s.id}" style="padding: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 8px; position: relative; border-radius: 12px; border: 1.5px solid rgba(168,85,247,0.1); background: rgba(255,255,255,0.7); overflow: visible; transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
                        <!-- Avatar -->
                        <div style="width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #a855f7, #06b6d4); color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 16px; box-shadow: 0 4px 10px rgba(168,85,247,0.2);">
                            ${s.name.charAt(0)}
                        </div>
                        <!-- Info -->
                        <div>
                            <div style="font-weight: 800; font-size: 14px; color: var(--text-main);">${s.name}</div>
                            <div style="font-size: 11px; color: var(--text-dim); margin-top: 2px;">${s.class} 班</div>
                        </div>
                        <!-- Current Points Tag -->
                        <div class="pts-tag-container" style="background: rgba(217,119,6,0.06); border: 1px solid rgba(217,119,6,0.15); border-radius: 20px; padding: 2px 10px; font-size: 12px; font-weight: 800; color: #d97706; display: flex; align-items: center; gap: 4px;">
                            ⭐ <span class="current-pts-val">${s.points}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }
}

async function handleGuidanceDisciplineAward(points) {
    const scope = state.gdSelectedScope;
    const targetClass = state.gdSelectedClass;
    const targetYear = state.gdSelectedYear;
    let category = state.gdSelectedCategory;
    const customReason = document.getElementById('gd-custom-reason').value.trim();

    const finalReason = customReason ? `🛡️ 訓輔集體嘉許: ${customReason}` : `🛡️ 訓輔集體嘉許: ${category}`;

    // 1. 篩選受獎學生
    const filteredStudents = state.students.filter(s => {
        if (scope === 'class') {
            return s.class === targetClass;
        } else {
            return s.year === targetYear;
        }
    });

    if (filteredStudents.length === 0) {
        showToast("選擇的班級或年級中沒有任何同學喔！", "warning");
        return;
    }

    const awardText = scope === 'class' ? `${targetClass} 班全體同學` : `${targetYear} 全體同學`;

    // 2. 扣款/加分原子批次存檔
    showToast(`🧙‍♂️ 正在施放魔法... 向 ${awardText} 發放 +${points} 積點！`, "info");
    await DB.awardPointsBulk(filteredStudents, points, finalReason);

    // 3. 觸發遊戲式浮動數字與卡片高亮彈跳動畫 (對每一張學生預覽卡片)
    filteredStudents.forEach((student, idx) => {
        const card = document.getElementById(`preview-student-${student.id}`);
        if (card) {
            // A. 更新卡片上的點數數值
            const valSpan = card.querySelector('.current-pts-val');
            if (valSpan) {
                valSpan.innerText = student.points;
            }

            // B. 彈性延遲高亮（製造波浪擴散效果！）
            setTimeout(() => {
                // 觸發縮放與發光
                card.style.transform = 'scale(1.15) rotate(3deg)';
                card.style.borderColor = '#eab308';
                card.style.boxShadow = '0 0 25px rgba(234, 179, 8, 0.6)';
                card.style.background = 'linear-gradient(135deg, rgba(254,243,199,0.95), rgba(255,255,255,0.95))';

                // C. 創建飛升的 `+X` 漂浮文字標籤
                const floater = document.createElement('div');
                floater.innerText = `+${points} ⭐`;
                floater.style.position = 'absolute';
                floater.style.top = '-10px';
                floater.style.fontWeight = '900';
                floater.style.fontSize = '24px';
                floater.style.color = '#eab308';
                floater.style.textShadow = '0 2px 10px rgba(0,0,0,0.15), 0 0 8px #fff';
                floater.style.animation = 'floatAndFadeUp 1.2s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards';
                floater.style.pointerEvents = 'none';
                floater.style.zIndex = '999';
                card.appendChild(floater);

                // D. 恢復卡片
                setTimeout(() => {
                    card.style.transform = '';
                    card.style.borderColor = 'rgba(168,85,247,0.2)';
                    card.style.boxShadow = '';
                    card.style.background = 'rgba(255,255,255,0.7)';
                    // 移除飛升元素
                    floater.remove();
                }, 1200);

            }, idx * 50); // 每人有 50 毫秒的順序延遲，產生多米諾骨牌式炫酷波浪特效！
        }
    });

    // 4. 全螢幕三重爆發式彩帶煙火特效！ (Explosive Confetti)
    if (window.confetti) {
        // Burst 1: 左下角往右上噴灑
        window.confetti({
            particleCount: 180,
            angle: 60,
            spread: 70,
            origin: { x: 0, y: 0.85 },
            colors: ['#8b5cf6', '#ec4899', '#3b82f6', '#eab308', '#10b981']
        });
        // Burst 2: 右下角往左上噴灑
        setTimeout(() => {
            window.confetti({
                particleCount: 180,
                angle: 120,
                spread: 70,
                origin: { x: 1, y: 0.85 },
                colors: ['#8b5cf6', '#ec4899', '#3b82f6', '#eab308', '#10b981']
            });
        }, 150);
        // Burst 3: 中心天女散花大合奏
        setTimeout(() => {
            window.confetti({
                particleCount: 250,
                spread: 100,
                origin: { y: 0.5 },
                colors: ['#ff007f', '#a855f7', '#00f0ff', '#ffcc00']
            });
        }, 350);
    }

    // 5. 創建極致震撼的宇宙級嘉許慶典彈出框 (Celebration Overlay Modal)
    createCosmicCelebrationModal(awardText, points, finalReason);

    // 清空自定義輸入
    document.getElementById('gd-custom-reason').value = '';
}

function createCosmicCelebrationModal(awardText, points, finalReason) {
    // 移除任何已存在的慶典 Modal
    const oldModal = document.getElementById('cosmic-celebration-overlay');
    if (oldModal) oldModal.remove();

    const overlay = document.createElement('div');
    overlay.id = 'cosmic-celebration-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(15, 10, 32, 0.9)'; // Deep cosmic navy translucent
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '99999';
    overlay.style.backdropFilter = 'blur(15px)';
    overlay.style.webkitBackdropFilter = 'blur(15px)';
    overlay.style.animation = 'fadeIn 0.4s ease forwards';
    overlay.style.overflow = 'hidden';

    // Fireworks container
    overlay.innerHTML = `
        <div class="celebration-cosmic-card" style="background: linear-gradient(135deg, rgba(30, 27, 75, 0.95), rgba(76, 29, 149, 0.95)); border: 3px solid #f59e0b; box-shadow: 0 0 50px rgba(245, 158, 11, 0.5), inset 0 0 30px rgba(139, 92, 246, 0.4); border-radius: 32px; padding: 40px; max-width: 650px; width: 90%; text-align: center; color: white; position: relative; animation: cosmicPop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;">
            <!-- Shiny rays behind card -->
            <div class="cosmic-shine-ray" style="position: absolute; top: 50%; left: 50%; width: 600px; height: 600px; background: radial-gradient(circle, rgba(234,179,8,0.2) 0%, transparent 70%); transform: translate(-50%, -50%); pointer-events: none; z-index: -1; animation: spinRay 20s linear infinite;"></div>

            <!-- Big floating Crown/Emblems -->
            <div style="font-size: 80px; filter: drop-shadow(0 0 15px #eab308); animation: bounceCrown 1.5s ease-in-out infinite alternate; margin-bottom: 20px;">👑</div>
            
            <h1 style="font-size: 32px; font-weight: 900; background: linear-gradient(to right, #ffcc00, #ff007f, #00f0ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); margin: 0 0 10px 0;">🎉 全體魔法嘉許大慶典 🎉</h1>
            
            <h2 style="font-size: 24px; font-weight: 800; color: #fff; margin-bottom: 12px; line-height: 1.4;">
                恭喜 <span style="color: #f59e0b; text-shadow: 0 0 10px rgba(245,158,11,0.5);">${awardText}</span> 同學！
            </h2>

            <div style="font-size: 48px; font-weight: 950; color: #10b981; filter: drop-shadow(0 0 12px rgba(16,185,129,0.6)); margin: 15px 0; letter-spacing: 1px; animation: heartbeat 0.8s infinite;">
                +${points} ⭐ 積點點數！
            </div>

            <p style="font-size: 16px; color: #e2e8f0; line-height: 1.6; margin: 10px auto 25px auto; max-width: 480px; background: rgba(255,255,255,0.06); padding: 12px 20px; border-radius: 16px; border: 1.5px dashed rgba(168,85,247,0.4);">
                📋 榮譽行為：<strong style="color: #ff91a4; font-weight: 800;">${finalReason.replace(/^🛡️\s*/, '')}</strong><br>
                <span style="font-size: 13px; color: #94a3b8; display: block; margin-top: 6px;">✨ 訓輔老師對全體同學的出色表現感到無比自豪，特此通報嘉獎！✨</span>
            </p>

            <button class="btn-style active" id="close-cosmic-celebration-btn" style="background: linear-gradient(135deg, #f59e0b, #d97706); border: none; color: white; padding: 14px 40px; font-size: 18px; font-weight: 900; border-radius: 20px; cursor: pointer; box-shadow: 0 8px 24px rgba(217,119,6,0.4); text-transform: uppercase; transition: transform 0.2s, box-shadow 0.2s; display: inline-flex; align-items: center; gap: 8px;">
                <span>收下神奇積點 🎁</span>
            </button>
        </div>
    `;

    document.body.appendChild(overlay);

    // Event listener for close button
    const closeBtn = document.getElementById('close-cosmic-celebration-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            overlay.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => {
                overlay.remove();
            }, 300);
        });
    }
}

// 手動跳過連線，強制使用本地獨立數據庫模式，保障極速啟動
window.forceLocalMode = function() {
    state.isFirebase = false;
    DB.initLocalStorage();
    DB.updateStatusIndicator('local');
    showToast("已手動跳過並切換至本地獨立數據庫", "warning");
    logConsole("手動跳過：已切換至本地獨立數據庫模式，保障離線操作流暢！", "info");
    switchTab(state.activeTab);
    renderInteractiveSimulator();
};

async function cleanObsoleteDummyStudents() {
    // 1. 本地 LocalStorage 淨化
    if (localStorage.getItem('dummy_records_cleared_local_v125') !== 'done') {
        console.log("正在執行系統數據淨化：清除本地過期的測試虛擬學生（如 s251003）...");
        const dummyPattern = /^s\d+$/i;
        const cleanedStudents = state.students.filter(s => !dummyPattern.test(s.name));
        const deletedStudents = state.students.filter(s => dummyPattern.test(s.name));

        if (deletedStudents.length > 0) {
            state.students = cleanedStudents;
            localStorage.setItem('student_points_db_students', JSON.stringify(cleanedStudents));
            console.log(`本地數據淨化完成！已成功移除 ${deletedStudents.length} 名測試學生。現有真實學生：${state.students.length} 名。`);
        } else {
            console.log("本地無過期測試學生，數據正常。");
        }
        localStorage.setItem('dummy_records_cleared_local_v125', 'done');
    }

    // 2. 如果啟用 Firebase Firestore，進行雲端數據同步淨化
    if (state.isFirebase && state.firebaseDb && localStorage.getItem('dummy_records_cleared_firebase_v125') !== 'done') {
        console.log("正在執行系統數據淨化：同步清除雲端 Firestore 過期的測試虛擬學生...");
        try {
            const dummyPattern = /^s\d+$/i;
            const { collection, getDocs, writeBatch } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
            const snapshot = await getDocs(collection(state.firebaseDb, "students"));
            
            let batch = writeBatch(state.firebaseDb);
            let opCount = 0;
            let totalDeleted = 0;

            snapshot.forEach(snapDoc => {
                const sData = snapDoc.data();
                if (sData && sData.name && dummyPattern.test(sData.name)) {
                    batch.delete(snapDoc.ref);
                    opCount++;
                    totalDeleted++;

                    if (opCount === 400) {
                        batch.commit();
                        batch = writeBatch(state.firebaseDb);
                        opCount = 0;
                    }
                }
            });

            if (opCount > 0) {
                await batch.commit();
            }

            console.log(`雲端 Firestore 數據同步淨化成功！共移除 ${totalDeleted} 個過期測試文檔。`);
            state.students = state.students.filter(s => !dummyPattern.test(s.name));
            localStorage.setItem('dummy_records_cleared_firebase_v125', 'done');
        } catch (e) {
            console.error("雲端 Firestore 數據同步淨化失敗:", e);
        }
    }
async function initApp() {
    // 1. 引導數據層初始化
    await DB.init();
    
    // 1.1. 執行每日 1% 複利計息 (Daily 1% compound interest processor)
    try {
        await DB.processDailyInterest();
    } catch (e) {
        console.error("每日複利計息處理失敗:", e);
    }
    
    // 1.2. 靜默執行數據自癒，移除舊有的測試虛擬賬號
    await cleanObsoleteDummyStudents();

    // 1.3. 靜默執行 Google 電子郵箱與實際學籍一鍵對接 (Google accounts auto-migration & synchronization)
    if (localStorage.getItem('student_emails_migrated_v132') !== 'done') {
        try {
            console.log("🚀 正在啟動 Google 帳號與學籍關聯數據同步對接程序 (v132)...");
            
            const existingByNum = new Map();
            const existingByName = new Map();
            const existingById = new Map();
            
            state.students.forEach(s => {
                if (s.studentNum) existingByNum.set(s.studentNum.toLowerCase().trim(), s);
                if (s.name) existingByName.set(s.name.trim(), s);
                if (s.id) existingById.set(s.id.trim(), s);
            });
            
            const updatedStudents = [];
            const idsSeen = new Set();
            
            (window.DEFAULT_STUDENTS || []).forEach(defS => {
                const sNumKey = defS.studentNum ? defS.studentNum.toLowerCase().trim() : "";
                const existing = existingByNum.get(sNumKey) || existingByName.get(defS.name.trim()) || existingById.get(defS.id.trim());
                
                let studentObj;
                if (existing) {
                    studentObj = {
                        ...existing,
                        id: existing.id || defS.id,
                        name: defS.name,
                        nameEn: defS.nameEn || existing.nameEn || "",
                        class: defS.class,
                        number: defS.number,
                        email: defS.email,
                        studentNum: defS.studentNum,
                        barcode: defS.barcode || existing.barcode || "",
                        year: defS.year || existing.year || ""
                    };
                } else {
                    studentObj = { ...defS };
                }
                
                if (!idsSeen.has(studentObj.id)) {
                    idsSeen.add(studentObj.id);
                    updatedStudents.push(studentObj);
                }
            });
            
            // 將活動庫中剩餘的不在預設列表中的學生也保留
            state.students.forEach(s => {
                if (!idsSeen.has(s.id)) {
                    idsSeen.add(s.id);
                    updatedStudents.push(s);
                }
            });
            
            // 更新狀態機
            state.students = updatedStudents;
            
            // 保存至 LocalStorage 或 Firestore
            if (state.isFirebase) {
                const { doc, writeBatch } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                let batch = writeBatch(state.firebaseDb);
                let count = 0;
                for (const student of updatedStudents) {
                    const docRef = doc(state.firebaseDb, "students", student.id);
                    batch.set(docRef, student, { merge: true });
                    count++;
                    if (count % 400 === 0) {
                        await batch.commit();
                        batch = writeBatch(state.firebaseDb);
                    }
                }
                if (count % 400 !== 0) {
                    await batch.commit();
                }
            } else {
                localStorage.setItem('student_points_db_students', JSON.stringify(state.students));
            }
            
            localStorage.setItem('student_emails_migrated_v132', 'done');
            console.log(`✅ 成功關聯學籍！共完成 ${updatedStudents.length} 筆學生的 Google 帳箱關聯與同步對接。`);
        } catch (e) {
            console.error("❌ Google 帳號與學籍關聯對接時發生錯誤:", e);
        }
    }

    // 1.5. 【系統開學全新重置】若尚未完成 v1.1.11 積分與歷史一鍵清零，在此靜默執行
    if (localStorage.getItem('force_clear_scores_v121') !== 'done') {
        await forceClearAllScoresAndTransactions();
    }

    // 2. 開啟物理讀卡感應器捕獲
    CardReader.init();

    // 3. 繪製輔助模擬面板
    renderInteractiveSimulator();

    // 3.5. 初始化訓輔大加分模組
    initGuidanceDiscipline();

    // 4. 默認展示門戶大廳選單頁面
    switchTab('portal');

    // 4.5. 註冊終端門戶大廳的事件監聽
    const enterStudentBtn = document.getElementById('enter-student-terminal-btn');
    if (enterStudentBtn) {
        enterStudentBtn.addEventListener('click', () => {
            state.userRole = 'student';
            switchTab('student-profile');
            showToast("已成功進入學生自助終端 🛍️", "info");
        });
    }

    const portalStudentGoogleBtn = document.getElementById('portal-student-google-btn');
    if (portalStudentGoogleBtn) {
        portalStudentGoogleBtn.addEventListener('click', handleGoogleSignIn);
    }

    const teacherVerifyTrigger = document.getElementById('portal-teacher-verify-trigger');
    const pinWrapper = document.getElementById('portal-pin-wrapper');
    const passcodeField = document.getElementById('portal-passcode');
    const pinCancelBtn = document.getElementById('portal-pin-cancel-btn');
    const pinSubmitBtn = document.getElementById('portal-pin-submit-btn');

    if (teacherVerifyTrigger && pinWrapper) {
        teacherVerifyTrigger.addEventListener('click', () => {
            teacherVerifyTrigger.style.display = 'none';
            pinWrapper.style.display = 'flex';
            if (passcodeField) passcodeField.focus();
        });
    }

    if (pinCancelBtn && teacherVerifyTrigger && pinWrapper) {
        pinCancelBtn.addEventListener('click', () => {
            pinWrapper.style.display = 'none';
            teacherVerifyTrigger.style.display = 'flex';
            if (passcodeField) passcodeField.value = '';
        });
    }

    const handleTeacherLogin = () => {
        if (!passcodeField) return;
        const pin = passcodeField.value.trim();
        if (pin === '510971') {
            state.userRole = 'teacher';
            switchTab('award-points');
            showToast("教師身分驗證成功！歡迎進入管理後台 👩‍🏫", "success");
            
            // 重置門戶狀態
            if (pinWrapper) pinWrapper.style.display = 'none';
            if (teacherVerifyTrigger) teacherVerifyTrigger.style.display = 'flex';
            passcodeField.value = '';
        } else {
            showToast("驗證密碼錯誤，請重新輸入！", "danger");
            passcodeField.focus();
            passcodeField.select();
        }
    };

    if (pinSubmitBtn) {
        pinSubmitBtn.addEventListener('click', handleTeacherLogin);
    }
    if (passcodeField) {
        passcodeField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleTeacherLogin();
        });
    }

    // 5. 交互組件 DOM 事件綁定
    // 導航選項欄切換
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // 點擊頂部狀態欄打開雲端設定
    const dbStatusBar = document.getElementById('db-status-bar');
    if (dbStatusBar) {
        dbStatusBar.addEventListener('click', openFirebaseConfigModal);
    }

    // 教師快速積分加分選項綁定
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('custom-points-input').value = '';
            updateTeacherAwardStatus();
        });
    });

    document.getElementById('custom-points-input').addEventListener('input', (e) => {
        if (e.target.value) {
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        }
        updateTeacherAwardStatus();
    });

    // 教師加分預設分類綁定 (不包含下拉選單的外殼按鈕)
    document.querySelectorAll('.category-chip').forEach(chip => {
        if (chip.id === 'indicators-chip' || chip.id === 'languages-chip' || chip.id === 'artsports-chip') return;
        
        chip.addEventListener('click', () => {
            document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            updateTeacherAwardStatus();
        });
    });

    // 下拉外殼按鈕點擊：切換自身選單，並關閉其他下拉選單
    document.querySelectorAll('.dropdown-wrapper .category-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止冒泡
            const currentWrapper = chip.closest('.dropdown-wrapper');
            
            // 關閉所有其他下拉選單
            document.querySelectorAll('.dropdown-wrapper').forEach(w => {
                if (w !== currentWrapper) w.classList.remove('active');
            });
            
            if (currentWrapper) {
                currentWrapper.classList.toggle('active');
            }
        });
    });

    // 下拉選單子項目點擊：更新特質與外殼標籤
    document.querySelectorAll('.dropdown-wrapper .dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止冒泡
            const val = item.dataset.val;
            const displayVal = item.dataset.display || val;

            // 移除所有特質分類的選中狀態
            document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
            
            const wrapper = item.closest('.dropdown-wrapper');
            const chip = wrapper ? wrapper.querySelector('.category-chip') : null;
            
            if (chip) {
                chip.classList.add('active');
                if (chip.id === 'indicators-chip') {
                    chip.setAttribute('data-selected-indicator', val);
                    const label = chip.querySelector('#selected-indicator-label');
                    if (label) label.innerText = displayVal;
                } else if (chip.id === 'languages-chip') {
                    chip.setAttribute('data-selected-language', val);
                    const label = chip.querySelector('#selected-language-label');
                    if (label) label.innerText = displayVal;
                } else if (chip.id === 'artsports-chip') {
                    chip.setAttribute('data-selected-artsports', val);
                    const label = chip.querySelector('#selected-artsports-label');
                    if (label) label.innerText = displayVal;
                }
            }

            // 關閉下拉選單
            if (wrapper) {
                wrapper.classList.remove('active');
            }

            showToast(`已選特質指標: "${val}"`, "success");
            updateTeacherAwardStatus();
        });
    });

    // 自定義加分理由輸入綁定
    const customReasonInput = document.getElementById('custom-reason-input');
    if (customReasonInput) {
        customReasonInput.addEventListener('input', updateTeacherAwardStatus);
    }

    // 點擊頁面其他任何地方時，自動關閉所有下拉選單
    document.addEventListener('click', () => {
        document.querySelectorAll('.dropdown-wrapper').forEach(wrapper => {
            wrapper.classList.remove('active');
        });
    });

    // 教師提交加分 (現在作為自動感應狀態輔助按鈕)
    document.getElementById('teacher-award-btn').addEventListener('click', handleTeacherAwardPoints);

    // 學生超市取消兌換 (已升級為全自動刷卡承兌，此處為相容安全保留)
    const modalCancelRedeem = document.getElementById('modal-cancel-redeem');
    if (modalCancelRedeem) {
        modalCancelRedeem.addEventListener('click', () => {
            const modal = document.getElementById('redeem-confirm-modal');
            if (modal) modal.classList.remove('active');
        });
    }

    // 獎品庫存面板與新增提交表單
    document.getElementById('add-gift-trigger-btn').addEventListener('click', () => triggerAddEditGiftModal());
    document.getElementById('gift-form').addEventListener('submit', handleSaveGiftForm);
    document.getElementById('gift-form-cancel').addEventListener('click', () => {
        document.getElementById('add-gift-modal').classList.remove('active');
    });

    // 獎品本地圖片讀取預覽
    document.getElementById('gift-form-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        const preview = document.getElementById('form-img-preview');
        const prevBox = document.getElementById('preview-box-wrapper');
        
        if (file) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                preview.src = evt.target.result;
                preview.style.display = 'block';
                prevBox.style.display = 'none';
            };
            reader.readAsDataURL(file);
        }
    });

    // 統計查詢篩選觸發
    document.getElementById('report-search-input').addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        renderReportSubTable();
    });

    document.getElementById('report-class-filter').addEventListener('change', (e) => {
        state.classFilter = e.target.value;
        renderReportSubTable();
    });

    document.getElementById('report-year-filter').addEventListener('change', (e) => {
        state.yearFilter = e.target.value;
        renderReportSubTable();
    });

    document.querySelectorAll('.report-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchReportTab(btn.dataset.reportTab));
    });

    document.getElementById('report-export-btn').addEventListener('click', handleExportExcel);

    // 學生名冊 Excel 匯入與範本下載事件綁定
    document.getElementById('report-template-btn').addEventListener('click', handleDownloadImportTemplate);
    document.getElementById('report-import-trigger-btn').addEventListener('click', () => {
        document.getElementById('report-import-file').click();
    });
    document.getElementById('report-import-file').addEventListener('change', handleImportExcel);

    // 全校積分一鍵清零事件綁定
    document.getElementById('admin-clear-all-btn').addEventListener('click', async () => {
        if (confirm("⚠️ 【危險操作警告】\n\n您確認要清空全校所有學生的現有積分、已兌換紀錄，並永久排空所有交易歷史流水嗎？\n\n此操作會同時重置本地及雲端資料庫（如已連線），且完全無法復原！")) {
            const success = await forceClearAllScoresAndTransactions();
            if (success) {
                showToast("全校積分紀錄已完全成功重置清零！", "success");
                switchTab(state.activeTab);
                renderInteractiveSimulator();
            } else {
                showToast("清零操作失敗，請查看瀏覽器 Console 報錯資訊！", "danger");
            }
        }
    });

    // 浮動測試面板折疊展開
    document.getElementById('sim-toggle-header').addEventListener('click', () => {
        document.getElementById('simulator-panel').classList.toggle('expanded');
    });

    // 浮動手動刷卡模擬
    document.getElementById('sim-manual-input-btn').addEventListener('click', () => {
        const input = document.getElementById('sim-manual-id-field');
        if (input.value.trim()) {
            CardReader.onCardSwiped(input.value.trim());
            input.value = '';
        }
    });

    // Firebase 雲端連接提交
    document.getElementById('fb-form').addEventListener('submit', handleFirebaseConfigSave);
    document.getElementById('fb-disconnect-btn').addEventListener('click', handleFirebaseDisconnect);
    document.getElementById('fb-form-cancel').addEventListener('click', () => {
        document.getElementById('firebase-config-modal').classList.remove('active');
    });

    // 全局通用 Modal 點關閉邏輯
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
        });
    });

    // 動態拼裝班級與年級篩選下拉選項
    const classSelect = document.getElementById('report-class-filter');
    window.CLASSES_LIST.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.innerText = `${c} 班`;
        classSelect.appendChild(opt);
    });

    const yearSelect = document.getElementById('report-year-filter');
    window.YEARS_LIST.forEach(y => {
        const opt = document.createElement('option');
        opt.value = y;
        opt.innerText = y;
        yearSelect.appendChild(opt);
    });

    // 風紀系統導航事件
    const enterPrefectBtn = document.getElementById('enter-prefect-terminal-btn');
    if (enterPrefectBtn) {
        enterPrefectBtn.addEventListener('click', () => {
            state.userRole = 'prefect';
            switchTab('prefect-duty');
        });
    }

    const backPrefectBtn = document.getElementById('prefect-back-lobby-btn');
    if (backPrefectBtn) {
        backPrefectBtn.addEventListener('click', () => {
            switchTab('portal');
        });
    }

    // 6. 異步聯動 Firebase，在後台靜默連接，絕不阻塞 UI 操作！
    DB.initFirebaseAsync();

    logConsole("Aura Merits 積分引擎加載成功。已預載入本地獨立數據庫。", "info");
    logConsole("硬件鍵盤感應攔截解碼器已在 [window:keydown] 正式掛載收聽。", "info");
}

// =========================================================================
// 風紀當值報到系統核心模組
// =========================================================================

async function handlePrefectCheckin(student) {
    const location = state.selectedDutyLocation || "前座禮堂";
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = 星期日, 1 = 星期一, ..., 6 = 星期六
    
    let matchedSched = state.prefectSchedules.find(s => s.studentId === student.id && s.location === location && s.day === dayOfWeek);
    let isDemoMatch = false;
    
    if (!matchedSched) {
        // 演示/調試友好：如果在今日找不到，嘗試找該學生在該位置的任意星期班表進行對比演示
        matchedSched = state.prefectSchedules.find(s => s.studentId === student.id && s.location === location);
        if (matchedSched) {
            isDemoMatch = true;
        }
    }
    
    let status = "常規報到";
    let delayMinutes = 0;
    let schedTimeStr = "--";
    
    if (matchedSched) {
        schedTimeStr = matchedSched.startTime;
        const [schedHour, schedMin] = matchedSched.startTime.split(':').map(Number);
        
        // 獲取當前時間的時和分
        const currentHour = now.getHours();
        const currentMinutes = now.getMinutes();
        
        const currentTotalMinutes = currentHour * 60 + currentMinutes;
        const schedTotalMinutes = schedHour * 60 + schedMin;
        const grace = matchedSched.graceMinutes || 5;
        
        if (currentTotalMinutes <= schedTotalMinutes + grace) {
            status = "準時";
        } else {
            status = "遲到";
            delayMinutes = currentTotalMinutes - schedTotalMinutes;
        }
    }
    
    // 創建報到記錄
    const checkinRecord = {
        id: `checkin_${now.getTime()}_${student.id}`,
        studentId: student.id,
        name: student.name,
        class: student.class,
        location: location,
        timestamp: now.toISOString(),
        status: status,
        schedTime: schedTimeStr,
        delayMinutes: delayMinutes,
        isDemoMatch: isDemoMatch
    };
    
    // 保存至數據庫與本地狀態
    await DB.savePrefectCheckin(checkinRecord);
    
    // 渲染反饋畫面
    renderPrefectCheckinFeedback(student, checkinRecord);
    
    // 重新渲染歷史列表
    renderPrefectCheckinHistory();
    
    // 播放炫彩紙屑
    if (status === "準時") {
        triggerConfettiSmall();
        showToast(`風紀隊員 [${student.name}] 報到成功：準時到崗！👍`, "success");
    } else if (status === "遲到") {
        showToast(`風紀隊員 [${student.name}] 報到成功：遲到 ${delayMinutes} 分鐘。`, "warning");
    } else {
        showToast(`風紀隊員 [${student.name}] 登記常規報到。`, "info");
    }
}

function renderPrefectCheckinFeedback(student, record) {
    const area = document.getElementById('prefect-swipe-feedback-area');
    if (!area) return;
    
    let statusClass = "feedback-regular";
    let statusText = "常規報到登記";
    let statusBadgeColor = "var(--primary)";
    let detailsHtml = `<p style="font-size: 1.1rem; margin: 8px 0; color: var(--text-main);">此崗位本日無您分配的班表，已為您記錄到崗時間。</p>`;
    
    if (record.status === "準時") {
        statusClass = "feedback-on-time";
        statusText = "準時到崗 (ON TIME)";
        statusBadgeColor = "var(--success)";
        detailsHtml = `
            <p style="font-size: 1.2rem; margin: 8px 0; color: #16a34a; font-weight: 700;">太棒了，準時報到！👍</p>
            <p style="font-size: 0.95rem; margin: 0; color: var(--text-muted);">應到時間：${record.schedTime} | 實到時間：${formatTime(new Date(record.timestamp))}</p>
        `;
    } else if (record.status === "遲到") {
        statusClass = "feedback-late";
        statusText = `遲到登記 (LATE)`;
        statusBadgeColor = "#ea580c";
        detailsHtml = `
            <p style="font-size: 1.2rem; margin: 8px 0; color: #ea580c; font-weight: 700;">遲到 ${record.delayMinutes} 分鐘 ⚠️</p>
            <p style="font-size: 0.95rem; margin: 0; color: var(--text-muted);">應到時間：${record.schedTime} | 實到時間：${formatTime(new Date(record.timestamp))}</p>
        `;
    }
    
    if (record.isDemoMatch) {
        detailsHtml += `<p style="font-size: 0.8rem; color: var(--secondary); margin-top: 8px; font-weight: 600;">ℹ️ 檢測到非今日班表，已為您開啟【調試演示比對模式】</p>`;
    }
    
    area.innerHTML = `
        <div class="${statusClass}" style="width: 100%; text-align: center;">
            <div style="font-size: 3rem; margin-bottom: 8px;">🛡️</div>
            <h4 style="margin: 0; font-size: 1.4rem; color: var(--text-main);">${student.name} (${student.class}班)</h4>
            <div style="background: ${statusBadgeColor}; color: white; display: inline-block; padding: 4px 16px; border-radius: 50px; font-size: 0.9rem; font-weight: 800; margin-top: 8px; text-transform: uppercase;">
                ${statusText}
            </div>
            <div style="margin-top: 16px; border-top: 1px dashed rgba(0,0,0,0.1); padding-top: 12px;">
                ${detailsHtml}
            </div>
        </div>
    `;
    
    // 5 秒後還原為等待刷卡界面
    if (window.prefectFeedbackTimer) {
        clearTimeout(window.prefectFeedbackTimer);
    }
    window.prefectFeedbackTimer = setTimeout(() => {
        area.innerHTML = `
            <div class="prefect-rfid-pulse-icon" style="font-size: 4.5rem; margin-bottom: 16px; animation: pulse 2s infinite;">📡</div>
            <p style="font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin: 0;">請將學生智能卡放至感應器上</p>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 6px 0 0 0;">（您亦可使用右下角的 RFID 模擬器點選風紀學生進行感應）</p>
        `;
    }, 6000);
}

function renderPrefectCheckinHistory() {
    const tbody = document.getElementById('prefect-today-checkins-tbody');
    const badge = document.getElementById('prefect-today-count-badge');
    if (!tbody) return;
    
    const todayStr = new Date().toDateString();
    const todayCheckins = state.prefectCheckins.filter(c => new Date(c.timestamp).toDateString() === todayStr);
    
    if (badge) {
        badge.innerText = `今日已報到：${todayCheckins.length} 人次`;
    }
    
    if (todayCheckins.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 24px 0;">
                    <i class="fas fa-info-circle"></i> 暫無今日報到記錄。請風紀隊員到崗後進行刷卡。
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = todayCheckins.map(c => {
        const checkinTime = new Date(c.timestamp);
        const timeStr = `${String(checkinTime.getHours()).padStart(2, '0')}:${String(checkinTime.getMinutes()).padStart(2, '0')}:${String(checkinTime.getSeconds()).padStart(2, '0')}`;
        
        let statusBadge = "";
        if (c.status === "準時") {
            statusBadge = `<span class="badge" style="background: #22c55e; color: white; font-weight:700;">準時</span>`;
        } else if (c.status === "遲到") {
            statusBadge = `<span class="badge" style="background: #f97316; color: white; font-weight:700;">遲到 (${c.delayMinutes}分)</span>`;
        } else {
            statusBadge = `<span class="badge" style="background: #3b82f6; color: white; font-weight:700;">常規報到</span>`;
        }
        
        const demoNote = c.isDemoMatch ? ` <span style="font-size:0.75rem; color:var(--secondary); font-weight:600;">(演示)</span>` : "";
        
        return `
            <tr style="animation: fadeIn 0.3s ease;">
                <td>${timeStr}</td>
                <td style="font-family: monospace;">${c.studentId}</td>
                <td>${c.class}班</td>
                <td style="font-weight: 600;">${c.name}</td>
                <td style="color: var(--secondary); font-weight: 600;">${c.location}</td>
                <td>${c.schedTime}${demoNote}</td>
                <td>${statusBadge}</td>
            </tr>
        `;
    }).join('');
}

function renderPrefectDutyScreen() {
    const grid = document.getElementById('duty-location-grid');
    const display = document.getElementById('prefect-selected-location-display');
    if (!grid) return;
    
    const locations = window.DEFAULT_PREFECT_LOCATIONS || ["前座禮堂", "前座一樓", "前座二樓", "後座禮堂", "後座二樓", "後座三樓", "後座四樓"];
    
    if (!state.selectedDutyLocation || !locations.includes(state.selectedDutyLocation)) {
        state.selectedDutyLocation = locations[0];
    }
    
    if (display) {
        display.innerText = state.selectedDutyLocation;
    }
    
    const iconMap = {
        "前座禮堂": "🎭",
        "前座一樓": "🏫",
        "前座二樓": "🏫",
        "後座禮堂": "🎭",
        "後座二樓": "🚶",
        "後座三樓": "🚶",
        "後座四樓": "🚶"
    };
    
    grid.innerHTML = locations.map(loc => {
        const isActive = state.selectedDutyLocation === loc ? "active" : "";
        const icon = iconMap[loc] || "📍";
        
        return `
            <div class="duty-location-card ${isActive}" data-loc="${loc}">
                <div class="loc-icon">${icon}</div>
                <div class="loc-name">${loc}</div>
            </div>
        `;
    }).join('');
    
    document.querySelectorAll('.duty-location-card').forEach(card => {
        card.addEventListener('click', () => {
            const loc = card.dataset.loc;
            state.selectedDutyLocation = loc;
            
            document.querySelectorAll('.duty-location-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            
            if (display) {
                display.innerText = loc;
            }
            
            logConsole(`風紀崗位變更: 已選擇 [${loc}]`, "info");
        });
    });
}

function startPrefectLiveClock() {
    if (window.prefectClockInterval) {
        clearInterval(window.prefectClockInterval);
    }
    
    const clockEl = document.getElementById('prefect-live-clock');
    const dateEl = document.getElementById('prefect-live-date');
    
    function update() {
        const now = new Date();
        if (clockEl) {
            clockEl.innerText = formatTime(now);
        }
        if (dateEl) {
            const days = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const dayStr = days[now.getDay()];
            dateEl.innerText = `${year}年${month}月${day}日 ${dayStr}`;
        }
    }
    
    update();
    window.prefectClockInterval = setInterval(update, 1000);
}

function formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    const secs = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${mins}:${secs}`;
}

// =========================================================================
// 風紀考勤後台 Excel 匯出 / 範本下載 / 班表匯入模組
// =========================================================================

function handleExportPrefectCheckins() {
    if (!window.XLSX) {
        showToast("Excel 庫未加載，無法導出", "danger");
        return;
    }
    
    showToast("正在導出風紀考勤日誌 Excel...", "info");
    
    const exportData = state.prefectCheckins.map((c, idx) => ({
        "編號": idx + 1,
        "報到感應時間": new Date(c.timestamp).toLocaleString(),
        "學生智能卡 ID": c.studentId,
        "學生姓名": c.name,
        "所屬班級": `${c.class}班`,
        "當值位置": c.location,
        "應到時間": c.schedTime,
        "考勤狀態": c.status,
        "遲到分鐘數": c.delayMinutes || 0,
        "是否為演示模式": c.isDemoMatch ? "是" : "否"
    }));
    
    const wb = window.XLSX.utils.book_new();
    const ws = window.XLSX.utils.json_to_sheet(exportData);
    
    ws['!cols'] = [
        { wch: 8 },  // 編號
        { wch: 24 }, // 報到感應時間
        { wch: 18 }, // 學生智能卡 ID
        { wch: 14 }, // 學生姓名
        { wch: 10 }, // 所屬班級
        { wch: 16 }, // 當值位置
        { wch: 12 }, // 應到時間
        { wch: 14 }, // 考勤狀態
        { wch: 12 }, // 遲到分鐘數
        { wch: 16 }  // 是否為演示模式
    ];
    
    window.XLSX.utils.book_append_sheet(wb, ws, "風紀考勤日誌");
    window.XLSX.writeFile(wb, `風紀考勤日誌_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    showToast("風紀考勤日誌導出成功！", "success");
}

function handleDownloadPrefectTemplate() {
    if (!window.XLSX) {
        showToast("Excel 庫未加載，無法下載範本", "danger");
        return;
    }
    
    const templateData = [
        {
            "星期 (Day 1-5)": 1,
            "當值位置": "前座禮堂",
            "應到時間 (HH:MM)": "07:45",
            "應退時間 (HH:MM)": "08:00",
            "容差分鐘數 (預設5)": 5,
            "學生卡片 ID": "20261002",
            "學生姓名": "陳樂暄",
            "班級": "1A"
        },
        {
            "星期 (Day 1-5)": 1,
            "當值位置": "前座一樓",
            "應到時間 (HH:MM)": "07:45",
            "應退時間 (HH:MM)": "08:00",
            "容差分鐘數 (預設5)": 5,
            "學生卡片 ID": "20261004",
            "學生姓名": "陳詩語",
            "班級": "1A"
        },
        {
            "星期 (Day 1-5)": 2,
            "當值位置": "前座二樓",
            "應到時間 (HH:MM)": "07:50",
            "應退時間 (HH:MM)": "08:05",
            "容差分鐘數 (預設5)": 5,
            "學生卡片 ID": "20261005",
            "學生姓名": "陳子樂",
            "班級": "1A"
        }
    ];
    
    const wb = window.XLSX.utils.book_new();
    const ws = window.XLSX.utils.json_to_sheet(templateData);
    
    ws['!cols'] = [
        { wch: 18 }, // 星期 (Day 1-5)
        { wch: 16 }, // 當值位置
        { wch: 18 }, // 應到時間 (HH:MM)
        { wch: 18 }, // 應退時間 (HH:MM)
        { wch: 18 }, // 容差分鐘數 (預設5)
        { wch: 18 }, // 學生卡片 ID
        { wch: 14 }, // 學生姓名
        { wch: 10 }  // 班級
    ];
    
    window.XLSX.utils.book_append_sheet(wb, ws, "風紀當值班表範本");
    window.XLSX.writeFile(wb, "風紀當值班表範本.xlsx");
    
    showToast("風紀當值班表範本下載成功！", "success");
}

async function handleImportPrefectSchedule(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!window.XLSX) {
        showToast("Excel 庫未加載，無法導入", "danger");
        return;
    }
    
    showToast("正在解析並導入風紀班表 Excel...", "info");
    
    const reader = new FileReader();
    reader.onload = async (evt) => {
        try {
            const data = new Uint8Array(evt.target.result);
            const workbook = window.XLSX.read(data, { type: 'array' });
            
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            const rawRows = window.XLSX.utils.sheet_to_json(worksheet);
            
            if (rawRows.length === 0) {
                showToast("上傳的 Excel 沒有任何數據！", "warning");
                return;
            }
            
            const newSchedules = [];
            
            for (let i = 0; i < rawRows.length; i++) {
                const r = rawRows[i];
                
                const day = parseInt(r["星期 (Day 1-5)"]) || 1;
                const location = String(r["當值位置"] || "").trim();
                const startTime = String(r["應到時間 (HH:MM)"] || "").trim();
                const endTime = String(r["應退時間 (HH:MM)"] || "").trim();
                const graceMinutes = parseInt(r["容差分鐘數 (預設5)"]) || 5;
                const studentId = String(r["學生卡片 ID"] || "").trim();
                const studentName = String(r["學生姓名"] || "").trim();
                const studentClass = String(r["班級"] || "").trim();
                
                if (!location || !startTime || !studentId || !studentName) {
                    console.warn(`第 ${i + 2} 行存在空欄位，跳過。`, r);
                    continue;
                }
                
                newSchedules.push({
                    id: `sched_${day}_${location}_${studentId}_${Date.now()}_${i}`,
                    day: day,
                    location: location,
                    startTime: startTime,
                    endTime: endTime,
                    graceMinutes: graceMinutes,
                    studentId: studentId,
                    studentName: studentName,
                    class: studentClass
                });
            }
            
            if (newSchedules.length === 0) {
                showToast("未成功解析出任何合法的風紀班表條目！", "danger");
                return;
            }
            
            // 寫入本地緩存
            state.prefectSchedules = newSchedules;
            localStorage.setItem('student_points_db_prefect_schedules', JSON.stringify(state.prefectSchedules));
            
            // 寫入雲端 Firestore (如果是 Firebase 模式)
            if (state.isFirebase && state.firebaseDb) {
                const { doc, setDoc, collection, getDocs, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                
                // 先清理雲端舊班表
                const oldSchedules = await getDocs(collection(state.firebaseDb, "prefect_schedules"));
                for (const oldDoc of oldSchedules.docs) {
                    await deleteDoc(doc(state.firebaseDb, "prefect_schedules", oldDoc.id));
                }
                
                // 批次寫入新班表
                for (const sched of state.prefectSchedules) {
                    await setDoc(doc(state.firebaseDb, "prefect_schedules", sched.id), sched);
                }
            }
            
            showToast(`成功導入 ${state.prefectSchedules.length} 條風紀班表規則！`, "success");
            
            // 如果當前在 prefect-duty 視口，更新顯示
            if (state.activeTab === 'prefect-duty') {
                renderPrefectDutyScreen();
            }
            
            // 重繪表格
            renderReportSubTable();
            
        } catch (err) {
            console.error("導入風紀班表失敗:", err);
            showToast("導入 Excel 失敗，請確認文件格式是否與範本一致！", "danger");
        }
    };
    reader.readAsArrayBuffer(file);
}

// 綁定 DOM 載入初始化監聽
window.addEventListener('DOMContentLoaded', initApp);

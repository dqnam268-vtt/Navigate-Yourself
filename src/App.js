import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { 
  doc, getDoc, setDoc, addDoc, collection, 
  serverTimestamp, query, where, orderBy, onSnapshot, getDocs, deleteDoc 
} from 'firebase/firestore';

import { updateBKT } from './logic/bktEngine';
import { getAdaptiveQuestion } from './logic/AdaptiveQuestionSelector';
import { uploadAllQuestions } from './utils/bulkUpload';
import { explanations } from './data/explanations';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import * as XLSX from 'xlsx';

// ─── TÀI KHOẢN QUẢN TRỊ VIÊN (Giáo viên) ────────────────────────────────────────
const ADMIN_EMAIL = "admin@edu.vn";

// ─── GAMIFIED CONSTANTS ─────────────────────────────────────────────────────────
const TOPICS = [
  "Relative clause", 
  "Will/Be Going To", 
  "First Conditional", 
  "Second Conditional", 
  "Verb Patterns"
];

const GAMIFIED_TOPICS = {
  "Relative clause": { icon: "🔗", color: "from-blue-400 to-indigo-500", shadow: "shadow-blue-300", hex: "#6366f1" },
  "Will/Be Going To": { icon: "🔮", color: "from-emerald-400 to-teal-500", shadow: "shadow-emerald-300", hex: "#14b8a6" },
  "First Conditional": { icon: "🌱", color: "from-yellow-400 to-orange-500", shadow: "shadow-yellow-300", hex: "#f59e0b" },
  "Second Conditional": { icon: "💭", color: "from-rose-400 to-pink-500", shadow: "shadow-rose-300", hex: "#f43f5e" },
  "Verb Patterns": { icon: "🧩", color: "from-violet-400 to-purple-500", shadow: "shadow-violet-300", hex: "#8b5cf6" }
};

// ─── UI HELPERS ─────────────────────────────────────────────────────────────────
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const pct = (v) => Math.round(v * 100);

function XPBar({ xp, level }) {
  const cap = level * 100;
  const w = clamp((xp % cap) / cap, 0, 1) * 100;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-bold text-yellow-300">Lvl {level}</span>
      <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden min-w-[100px]">
        <div
          className="h-full bg-gradient-to-r from-yellow-300 to-orange-400 rounded-full transition-all duration-700"
          style={{ width: `${w}%` }}
        />
      </div>
      <span className="text-xs text-white/60">{xp % cap}/{cap} XP</span>
    </div>
  );
}

function KnowledgeMeter({ p }) {
  const steps = 5;
  const filled = Math.round(p * steps);
  const labels = ["Novice","Beginner","Learner","Skilled","Expert","Master"];
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-1">
        {Array.from({ length: steps }).map((_, i) => (
          <div
            key={i}
            className={`w-5 h-5 rounded transition-all duration-500 border-2 ${
              i < filled
                ? "bg-gradient-to-b from-green-300 to-emerald-500 border-emerald-600 scale-110 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                : "bg-white/10 border-white/20"
            }`}
          />
        ))}
      </div>
      <span className="text-[10px] font-semibold text-white/50 uppercase tracking-widest mt-1">
        {labels[filled]}
      </span>
    </div>
  );
}

function Btn3D({ children, onClick, color = "indigo", disabled, size = "md", className = "" }) {
  const cols = {
    indigo: "bg-indigo-500 border-indigo-700 hover:bg-indigo-400 active:translate-y-1 active:shadow-none",
    green:  "bg-emerald-500 border-emerald-700 hover:bg-emerald-400 active:translate-y-1 active:shadow-none",
    red:    "bg-rose-500 border-rose-700 hover:bg-rose-400 active:translate-y-1 active:shadow-none",
    yellow: "bg-yellow-500 border-yellow-700 hover:bg-yellow-400 active:translate-y-1 active:shadow-none",
    gray:   "bg-slate-600 border-slate-800 hover:bg-slate-500 active:translate-y-1 active:shadow-none",
  };
  const sizes = { md: "px-6 py-3 text-sm", lg: "px-8 py-4 text-base", sm: "px-4 py-2 text-xs" };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${cols[color]} ${sizes[size]} ${className}
        font-extrabold text-white rounded-xl border-b-4
        transition-all duration-100
        shadow-lg -translate-y-1
        disabled:opacity-50 disabled:pointer-events-none
        cursor-pointer select-none flex items-center justify-center gap-2
      `}
    >
      {children}
    </button>
  );
}

function AnswerOption({ label, text, onClick, state }) {
  const base = "w-full flex items-center gap-4 p-4 rounded-xl font-bold text-left border-b-4 transition-all duration-150 cursor-pointer select-none text-[15px]";
  const styles = {
    idle:    "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 hover:scale-[1.01] text-white/90",
    correct: "bg-emerald-500/90 border-emerald-700 text-white scale-[1.01] shadow-[0_0_15px_rgba(16,185,129,0.4)]",
    wrong:   "bg-rose-500/90 border-rose-700 text-white",
    missed:  "bg-emerald-500/30 border-emerald-500/50 text-emerald-100",
  };
  return (
    <button className={`${base} ${styles[state]}`} onClick={onClick} disabled={state !== "idle"}>
      <span className="w-8 h-8 flex-shrink-0 rounded-lg bg-black/20 flex items-center justify-center font-black text-sm text-white/70">
        {label}
      </span>
      <span className="flex-1">{text}</span>
      {state === "correct" && <span className="ml-auto text-xl drop-shadow-md">✅</span>}
      {state === "wrong"   && <span className="ml-auto text-xl drop-shadow-md">❌</span>}
      {state === "missed"  && <span className="ml-auto text-xl drop-shadow-md">💡</span>}
    </button>
  );
}

function StreakBadge({ streak }) {
  if (!streak) return null;
  const fire = streak >= 5 ? "🔥🔥" : "🔥";
  return (
    <div className="flex items-center gap-1.5 bg-orange-500/20 border border-orange-400/40 rounded-full px-3 py-1.5 shadow-[0_0_10px_rgba(249,115,22,0.3)]">
      <span className="text-sm">{fire}</span>
      <span className="text-xs font-black text-orange-400 uppercase tracking-wide">{streak} streak</span>
    </div>
  );
}

// ─── MAIN APP ───────────────────────────────────────────────────────────────────
function App() {
  const [user, setUser] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const [showChart, setShowChart] = useState(true);
  
  const [selectedOption, setSelectedOption] = useState(null);
  const [isCorrectAnswer, setIsCorrectAnswer] = useState(null);
  const [isWaitingNext, setIsWaitingNext] = useState(false);

  // Gamification states
  const [sessionXP, setSessionXP] = useState(0);
  const [sessionStreak, setSessionStreak] = useState(0);

  // ADMIN States
  const [allStudentsData, setAllStudentsData] = useState([]);
  const [viewingStudent, setViewingStudent] = useState("");
  const [sortCriterion, setSortCriterion] = useState("Average"); // Lọc theo Điểm Trung Bình hoặc Từng Chủ đề

  const [mastery, setMastery] = useState(
    TOPICS.reduce((acc, topic) => ({ ...acc, [topic]: 0.3 }), {})
  );

  const [chartData, setChartData] = useState([]);
  const [interactionLogs, setInteractionLogs] = useState([]);

  // Fetch dữ liệu quản lý (Chỉ dành cho Admin)
  useEffect(() => {
    if (user) {
      if (user.email === ADMIN_EMAIL) {
        const fetchAllMastery = async () => {
          const snap = await getDocs(collection(db, "mastery"));
          const data = snap.docs.map(doc => {
            const masteryData = doc.data();
            let sum = 0;
            TOPICS.forEach(t => sum += (masteryData[t] || 0.3));
            const avg = sum / TOPICS.length;
            return { email: doc.id, mastery: masteryData, average: avg };
          });
          setAllStudentsData(data);
          if (data.length > 0) setViewingStudent(data[0].email);
        };
        fetchAllMastery();
      } else {
        // Học sinh thường thì chỉ xem được của chính mình
        setViewingStudent(user.email);
      }
    }
  }, [user]);

  // Lấy lịch sử Logs của người đang được xem
  useEffect(() => {
    if (!viewingStudent) return;
    const q = query(
      collection(db, "learning_logs"),
      where("student", "==", viewingStudent),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rawLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInteractionLogs([...rawLogs].reverse());

      const formattedData = rawLogs.map((log, index) => {
        const dataPoint = { step: index + 1 };
        TOPICS.forEach(topic => {
            dataPoint[topic] = log.topic === topic 
                ? parseFloat((log.pL_after * 100).toFixed(1)) 
                : null;
        });
        return dataPoint;
      });
      setChartData(formattedData);
    }, (error) => console.error("Lỗi lấy dữ liệu Logs: ", error));

    return () => unsubscribe();
  }, [viewingStudent]);

  // Lấy mastery của bản thân để làm bài
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const docRef = doc(db, "mastery", currentUser.email);
        const docSnap = await getDoc(docRef);
        
        let currentMastery = mastery;
        if (docSnap.exists()) {
          currentMastery = { ...mastery, ...docSnap.data() };
          setMastery(currentMastery);
        }

        const randomTopic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
        const nextQ = getAdaptiveQuestion(randomTopic, currentMastery[randomTopic], []);
        
        setCurrentQuestion({
          ...nextQ,
          explanation: explanations[nextQ.id] || "Đang cập nhật lời giải thích cho câu hỏi này."
        });
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleAnswer = async (opt) => {
    if (!currentQuestion || !user || isWaitingNext) return;
    
    const isCorrect = opt.startsWith(currentQuestion.answer.charAt(0)); 
    setSelectedOption(opt);
    setIsCorrectAnswer(isCorrect);
    setIsWaitingNext(true);

    const topic = currentQuestion.topic;
    const pL_prev = mastery[topic] || 0.3;
    const pL_new = updateBKT(pL_prev, isCorrect);
    const newMastery = { ...mastery, [topic]: pL_new };
    setMastery(newMastery);

    if (isCorrect) {
      const diffMultiplier = currentQuestion.level === "Applying" || currentQuestion.level === "Analyzing" ? 15 : 10;
      const streakBonus = sessionStreak >= 3 ? 5 : 0;
      setSessionXP(prev => prev + diffMultiplier + streakBonus);
      setSessionStreak(prev => prev + 1);
    } else {
      setSessionStreak(0);
    }

    try {
      await Promise.all([
        setDoc(doc(db, "mastery", user.email), newMastery, { merge: true }),
        addDoc(collection(db, "learning_logs"), {
          student: user.email,
          topic: topic,
          questionId: currentQuestion.id,
          level: currentQuestion.level,
          isCorrect: isCorrect,
          pL_before: pL_prev,
          pL_after: pL_new,
          timestamp: serverTimestamp()
        })
      ]);
    } catch (e) { console.error("Lỗi lưu DB: ", e); }
  };

  const handleNextQuestion = () => {
    const nextTopic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
    const nextQ = getAdaptiveQuestion(nextTopic, mastery[nextTopic], []);
    
    setSelectedOption(null);
    setIsCorrectAnswer(null);
    setIsWaitingNext(false);
    
    setCurrentQuestion({
      ...nextQ,
      explanation: explanations[nextQ.id] || "Đang cập nhật lời giải thích."
    });
  };

  // --- ADMIN FUNCTIONS ---
  const handleAdminUpload = () => {
    const adminPassword = window.prompt("🔒 BẢO MẬT ADMIN: Nhập mật khẩu nạp dữ liệu:");
    if (adminPassword !== "namy241222") {
      if (adminPassword !== null) alert("❌ Sai mật khẩu Admin!");
      return;
    }
    uploadAllQuestions();
  };

  const handleDeleteStudentData = async () => {
    if (!viewingStudent) return;
    const passwordInput = window.prompt(`🔒 Nhập mật khẩu giáo viên để xóa dữ liệu của ${viewingStudent}:`);
    if (passwordInput !== "namy") {
      if (passwordInput !== null) alert("❌ Sai mật khẩu!");
      return;
    }
    if (!window.confirm(`CẢNH BÁO: Chắc chắn xóa TOÀN BỘ lịch sử của: ${viewingStudent}?`)) return;

    try {
      await deleteDoc(doc(db, "mastery", viewingStudent));
      const q = query(collection(db, "learning_logs"), where("student", "==", viewingStudent));
      const snapshot = await getDocs(q);
      await Promise.all(snapshot.docs.map(document => deleteDoc(doc(db, "learning_logs", document.id))));

      alert(`✅ Đã xóa sạch dữ liệu của ${viewingStudent}`);
      
      const newData = allStudentsData.filter(s => s.email !== viewingStudent);
      setAllStudentsData(newData);
      if (newData.length > 0) setViewingStudent(newData[0].email);
      else setViewingStudent("");

    } catch (err) { alert("❌ Có lỗi xảy ra!"); }
  };

  const handleDeleteAllData = async () => {
    const passwordInput = window.prompt("🚨 NGUY HIỂM: Nhập mật khẩu giáo viên để XÓA SẠCH hệ thống:");
    if (passwordInput !== "namy") {
      if (passwordInput !== null) alert("❌ Sai mật khẩu!");
      return;
    }
    if (!window.confirm("XÓA SẠCH dữ liệu TẤT CẢ học sinh. Hệ thống sẽ trắng tinh. Tiếp tục?")) return;

    try {
      const masterySnap = await getDocs(collection(db, "mastery"));
      const logsSnap = await getDocs(collection(db, "learning_logs"));
      await Promise.all([
        ...masterySnap.docs.map(document => deleteDoc(doc(db, "mastery", document.id))),
        ...logsSnap.docs.map(document => deleteDoc(doc(db, "learning_logs", document.id)))
      ]);

      alert("🎉 Đã dọn dẹp sạch sẽ toàn bộ dữ liệu hệ thống!");
      setAllStudentsData([]); 
      setViewingStudent("");
      setMastery(TOPICS.reduce((acc, topic) => ({ ...acc, [topic]: 0.3 }), {}));
      setInteractionLogs([]); setChartData([]); setSessionXP(0); setSessionStreak(0);
    } catch (err) { alert("❌ Có lỗi xảy ra!"); }
  };

  const exportToExcel = () => {
    if (interactionLogs.length === 0) return alert("Chưa có dữ liệu để xuất!");
    const exportData = interactionLogs.map((log, index) => ({
      "STT": interactionLogs.length - index,
      "Email Học Viên": log.student,
      "Chủ đề": log.topic,
      "Cấp độ": log.level,
      "Mã Câu Hỏi": log.questionId,
      "Kết Quả": log.isCorrect ? "ĐÚNG" : "SAI",
      "P(L) Trước": parseFloat((log.pL_before * 100).toFixed(2)) + "%",
      "P(L) Sau": parseFloat((log.pL_after * 100).toFixed(2)) + "%",
      "Thời Gian": log.timestamp ? log.timestamp.toDate().toLocaleString('vi-VN') : "N/A"
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [{ wch: 5 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 20 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "LichSuBKT");
    XLSX.writeFile(workbook, `BKT_Logs_${viewingStudent.split('@')[0]}.xlsx`);
  };


// --- HÀM MỚI: XUẤT EXCEL TOÀN BỘ HỌC SINH ---
  const exportAllStudentsToExcel = async () => {
    try {
      // 1. Lấy toàn bộ lịch sử của tất cả học sinh
      const snapshot = await getDocs(collection(db, "learning_logs"));
      
      if (snapshot.empty) {
        alert("Chưa có dữ liệu nào trên hệ thống để xuất!");
        return;
      }

      let rawLogs = snapshot.docs.map(doc => doc.data());
      
      // 2. Sắp xếp: Ưu tiên gom theo Email học sinh -> Sau đó xếp theo Thời gian làm bài
      rawLogs.sort((a, b) => {
        if (a.student < b.student) return -1;
        if (a.student > b.student) return 1;
        // Nếu cùng 1 học sinh, xếp theo thời gian (từ cũ đến mới)
        const timeA = a.timestamp ? a.timestamp.toMillis() : 0;
        const timeB = b.timestamp ? b.timestamp.toMillis() : 0;
        return timeA - timeB;
      });

      // 3. Định dạng lại dữ liệu cho đẹp
      const exportData = rawLogs.map((log, index) => ({
        "STT Tổng": index + 1,
        "Email Học Viên": log.student,
        "Chủ đề": log.topic,
        "Cấp độ": log.level,
        "Mã Câu Hỏi": log.questionId,
        "Kết Quả": log.isCorrect ? "ĐÚNG" : "SAI",
        "P(L) Trước": parseFloat((log.pL_before * 100).toFixed(2)) + "%",
        "P(L) Sau": parseFloat((log.pL_after * 100).toFixed(2)) + "%",
        "Thời Gian": log.timestamp ? log.timestamp.toDate().toLocaleString('vi-VN') : "N/A"
      }));

      // 4. Tạo file và tải xuống
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      worksheet['!cols'] = [{ wch: 10 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 20 }];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "TatCaHocSinh");
      XLSX.writeFile(workbook, `BKT_Data_Toan_Bo_Hoc_Sinh.xlsx`);
      
    } catch (error) {
      console.error("Lỗi xuất dữ liệu tổng: ", error);
      alert("❌ Có lỗi xảy ra khi tải dữ liệu!");
    }
  };
  // Logic Sắp xếp Học sinh
  const sortedStudents = [...allStudentsData].sort((a, b) => {
    if (sortCriterion === "Average") {
      return b.average - a.average; // Giảm dần
    } else {
      const scoreA = a.mastery[sortCriterion] || 0.3;
      const scoreB = b.mastery[sortCriterion] || 0.3;
      return scoreB - scoreA;
    }
  });

  // ─── LOGIN SCREEN ───────────────────────────────────────────────────────────────
  if (!user) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex justify-center items-center p-4 font-sans">
      <div className="bg-white/5 border border-white/10 backdrop-blur-lg p-8 rounded-3xl shadow-2xl text-center w-full max-w-[400px]">
        <div className="w-20 h-20 bg-gradient-to-br from-indigo-400 to-purple-500 text-white rounded-2xl mx-auto mb-6 flex items-center justify-center text-4xl shadow-lg shadow-indigo-500/30 rotate-3 hover:rotate-0 transition-transform">
          🧠
        </div>
        <h2 className="text-white font-black text-2xl mb-1">Navigate Yourself</h2>
        <p className="text-white/50 text-sm mb-8 font-medium">Hệ thống học tập thích ứng BKT</p>
        
        <input type="email" placeholder="Email học viên" onChange={e => setEmail(e.target.value)} className="w-full p-4 mb-4 rounded-xl bg-black/20 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all" />
        <input type="password" placeholder="Mật khẩu" onChange={e => setPassword(e.target.value)} className="w-full p-4 mb-6 rounded-xl bg-black/20 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all" />
        
        <Btn3D color="indigo" size="lg" className="w-full mb-8" onClick={() => signInWithEmailAndPassword(auth, email, password)}>
          Đăng nhập hệ thống 🚀
        </Btn3D>
        
        <div className="pt-6 border-t border-white/10">
          <p className="text-[11px] text-white/30 uppercase tracking-widest mb-3 font-bold">Khu vực Admin</p>
          <button onClick={handleAdminUpload} className="px-4 py-2 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-lg text-xs font-bold hover:bg-yellow-500/20 transition-colors">
            ⚙️ Nạp 500 câu ngân hàng
          </button>
        </div>
      </div>
    </div>
  );

  // ─── MAIN QUIZ APP ────────────────────────────────────────────────────────────
  const activeTopicInfo = currentQuestion ? GAMIFIED_TOPICS[currentQuestion.topic] : GAMIFIED_TOPICS["Relative clause"];
  const level = Math.floor(sessionXP / 100) + 1;
  const optLabels = ["A", "B", "C", "D"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex justify-center px-4 py-8 font-sans">
      <div className="w-full max-w-[800px] flex flex-col gap-6">

        {/* 1. HEADER & XP BAR */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-5 backdrop-blur-md shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-xl shadow-lg">
                🧠
              </div>
              <div>
                <h1 className="font-black text-white text-lg leading-none">Navigate Yourself</h1>
                <p className="text-[11px] text-emerald-400 font-bold tracking-wide">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StreakBadge streak={sessionStreak} />
              <button onClick={() => signOut(auth)} className="px-3 py-1.5 rounded-lg border border-white/10 text-white/50 text-xs font-bold hover:bg-white/10 hover:text-white transition-colors">
                Thoát
              </button>
            </div>
          </div>
          <XPBar xp={sessionXP} level={level} />
        </div>

        {/* 2. CHỈ HIỂN THỊ TEACHER DASHBOARD NẾU LÀ ADMIN */}
        {user.email === ADMIN_EMAIL && (
          <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-3xl p-5 backdrop-blur-sm">
            <span className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-4 block">👨‍🏫 BẢNG ĐIỀU KHIỂN & XẾP HẠNG (ADMIN)</span>
            
            <div className="flex flex-col md:flex-row gap-4 mb-5">
              <div className="flex-1">
                <label className="text-[11px] text-emerald-400/70 font-bold mb-2 block uppercase tracking-wider">Tiêu chí Xếp hạng:</label>
                <select 
                  value={sortCriterion} 
                  onChange={(e) => setSortCriterion(e.target.value)}
                  className="w-full p-3 rounded-xl bg-black/40 border border-emerald-500/30 text-emerald-300 font-bold outline-none text-sm cursor-pointer focus:border-emerald-400"
                >
                  <option value="Average">🌟 Điểm Trung Bình Tất Cả</option>
                  {TOPICS.map(t => <option key={t} value={t}>📘 Bảng hạng: {t}</option>)}
                </select>
              </div>
              
              <div className="flex-1">
                <label className="text-[11px] text-emerald-400/70 font-bold mb-2 block uppercase tracking-wider">Chọn học sinh để xem chi tiết:</label>
                <select 
                  value={viewingStudent} 
                  onChange={(e) => setViewingStudent(e.target.value)}
                  className="w-full p-3 rounded-xl bg-black/40 border border-emerald-500/30 text-white outline-none text-sm cursor-pointer focus:border-emerald-400"
                >
                  <option value="" disabled>-- Chọn học sinh --</option>
                  {sortedStudents.map((s, index) => {
                    const score = sortCriterion === "Average" ? pct(s.average) : pct(s.mastery[sortCriterion] || 0.3);
                    const rank = index + 1;
                    let rankIcon = "🎓";
                    if (rank === 1) rankIcon = "🥇";
                    else if (rank === 2) rankIcon = "🥈";
                    else if (rank === 3) rankIcon = "🥉";

                    return (
                      <option key={s.email} value={s.email} className="bg-slate-800">
                        Top {rank} {rankIcon} - {s.email} (Điểm: {score}%)
                      </option>
                    )
                  })}
                </select>
              </div>
            </div>

            {/* CỤM NÚT CÔNG CỤ CỦA ADMIN */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-emerald-500/20">
              <button onClick={exportAllStudentsToExcel} className="flex-1 py-2.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold hover:bg-indigo-500/30 transition-colors shadow-lg">
                📊 Xuất Excel (TẤT CẢ HỌC SINH)
              </button>
              <button onClick={handleDeleteStudentData} disabled={!viewingStudent} className="flex-1 py-2.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold hover:bg-rose-500/20 transition-colors disabled:opacity-50">
                🗑️ Xóa học sinh chọn
              </button>
              <button onClick={handleDeleteAllData} className="flex-1 py-2.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold hover:bg-red-500/30 transition-colors">
                🚨 Reset tất cả
              </button>
            </div>
          </div>
        )}

        {/* 3. QUESTION CARD (CORE BKT) */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-md shadow-2xl relative overflow-hidden">
          {currentQuestion ? (
            <>
              {/* Background Glow */}
              <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br ${activeTopicInfo.color} opacity-10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none`} />
              
              {/* Top Badges */}
              <div className="flex justify-between items-start mb-6 relative z-10">
                <div className="flex flex-col gap-2">
                  <div className={`inline-flex items-center gap-2 bg-gradient-to-r ${activeTopicInfo.color} px-3 py-1 rounded-full shadow-lg`}>
                    <span className="text-base">{activeTopicInfo.icon}</span>
                    <span className="text-xs font-black text-white uppercase tracking-wider">{currentQuestion.topic}</span>
                  </div>
                  <span className="text-[10px] font-bold text-white/40 bg-white/5 px-2 py-1 rounded-md border border-white/10 inline-block w-fit">
                    Level: {currentQuestion.level}
                  </span>
                </div>
                
                {/* Visual BKT Meter */}
                <div className="bg-black/20 p-2 rounded-xl border border-white/5">
                  <KnowledgeMeter p={mastery[currentQuestion.topic]} />
                </div>
              </div>
              
              {/* Question */}
              <h3 className="text-white font-bold text-xl md:text-2xl leading-relaxed mb-8 relative z-10">
                {currentQuestion.content}
              </h3>
              
              {/* Options */}
              <div className="flex flex-col gap-3 relative z-10">
                {currentQuestion.options.map((opt, i) => {
                  let state = "idle";
                  if (isWaitingNext) {
                    const isActualAnswer = opt.startsWith(currentQuestion.answer.charAt(0));
                    if (selectedOption === opt) {
                      state = isCorrectAnswer ? "correct" : "wrong";
                    } else if (isActualAnswer) {
                      state = "missed";
                    }
                  }
                  return (
                    <AnswerOption 
                      key={i} 
                      label={optLabels[i]} 
                      text={opt} 
                      onClick={() => handleAnswer(opt)} 
                      state={state} 
                    />
                  );
                })}
              </div>

              {/* Feedback & Explanation */}
              {isWaitingNext && (
                <div className={`mt-6 rounded-2xl p-5 border shadow-xl animate-in fade-in slide-in-from-bottom-4 relative z-10 ${
                  isCorrectAnswer ? "bg-emerald-500/10 border-emerald-500/30" : "bg-rose-500/10 border-rose-500/30"
                }`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className={`font-black text-lg mb-1 ${isCorrectAnswer ? "text-emerald-400" : "text-rose-400"}`}>
                        {isCorrectAnswer ? "🎉 Tuyệt vời! Bạn đã trả lời đúng." : "😬 Rất tiếc! Câu trả lời chưa chính xác."}
                      </h4>
                      {!isCorrectAnswer && (
                        <p className="text-sm text-white/80">Đáp án đúng: <strong className="text-white">{currentQuestion.answer}</strong></p>
                      )}
                    </div>
                    {isCorrectAnswer && <div className="text-xs font-black text-emerald-300 bg-emerald-500/20 px-2 py-1 rounded-lg">+ XP</div>}
                  </div>

                  {currentQuestion.explanation && (
                    <div className="bg-black/30 rounded-xl p-4 mt-4 border border-white/5 text-sm text-white/70 italic leading-relaxed">
                      <span className="not-italic text-yellow-400 mr-2">💡</span>
                      {currentQuestion.explanation}
                    </div>
                  )}

                  <Btn3D color={isCorrectAnswer ? "green" : "red"} size="lg" className="w-full mt-6" onClick={handleNextQuestion}>
                    Câu tiếp theo ➔
                  </Btn3D>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 opacity-50">
              <span className="text-4xl animate-bounce mb-4">🧠</span>
              <p className="text-white font-bold tracking-widest uppercase">Đang tải dữ liệu BKT...</p>
            </div>
          )}
        </div>

        {/* 4. CHARTS & HISTORY (DARK THEME) */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm">
          <div onClick={() => setShowChart(!showChart)} className="flex justify-between items-center cursor-pointer mb-6 group">
            <h3 className="text-white font-black text-sm uppercase tracking-widest flex items-center gap-2">
              📊 Đồ thị làm chủ kiến thức {user.email === ADMIN_EMAIL && <span className="text-emerald-400 lowercase normal-case ml-2">(Của: {viewingStudent})</span>}
            </h3>
            <span className="text-xs font-bold text-white/30 bg-white/5 px-3 py-1 rounded-full group-hover:bg-white/10 transition-colors">
              {showChart ? '▲ Thu gọn' : '▼ Mở rộng'}
            </span>
          </div>
          
          {showChart && (
            <div className="w-full h-[300px]">
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff10" />
                  <XAxis dataKey="step" tick={{fontSize: 11, fill: '#64748b'}} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{fontSize: 11, fill: '#64748b'}} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'}} 
                    itemStyle={{fontWeight: 'bold'}}
                  />
                  <Legend iconType="circle" wrapperStyle={{fontSize: '11px', paddingTop: '15px', color: '#94a3b8'}} />
                  {TOPICS.map(topic => (
                    <Line key={topic} type="monotone" dataKey={topic} stroke={GAMIFIED_TOPICS[topic].hex} strokeWidth={3} connectNulls activeDot={{ r: 6, fill: GAMIFIED_TOPICS[topic].hex, stroke: '#fff', strokeWidth: 2 }} dot={{ r: 2, strokeWidth: 2 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm mb-10">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-white font-black text-sm uppercase tracking-widest">📝 Lịch sử tương tác</h3>
            <Btn3D color="gray" size="sm" onClick={exportToExcel}>📥 Xuất Excel</Btn3D>
          </div>
          <div className="custom-scrollbar max-h-[300px] overflow-y-auto pr-2">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-900/90 backdrop-blur z-10 text-[11px] uppercase tracking-wider text-white/40">
                <tr>
                  <th className="pb-3 font-bold border-b border-white/10">Câu</th>
                  <th className="pb-3 font-bold border-b border-white/10">Chủ đề</th>
                  <th className="pb-3 font-bold border-b border-white/10">Kết quả</th>
                  <th className="pb-3 font-bold border-b border-white/10">P(L) Sau</th>
                </tr>
              </thead>
              <tbody className="text-white/70">
                {interactionLogs.map((log, i) => (
                  <tr key={log.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 font-medium text-white/40">#{interactionLogs.length - i}</td>
                    <td className="py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase bg-gradient-to-r ${GAMIFIED_TOPICS[log.topic].color} text-white shadow-sm`}>
                        {log.topic}
                      </span>
                    </td>
                    <td className="py-3">
                      {log.isCorrect 
                        ? <span className="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-md text-[10px] font-black border border-emerald-500/20">ĐÚNG</span>
                        : <span className="bg-rose-500/20 text-rose-400 px-2 py-1 rounded-md text-[10px] font-black border border-rose-500/20">SAI</span>
                      }
                    </td>
                    <td className="py-3 font-bold text-white">{(log.pL_after * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
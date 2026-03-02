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

// ─── CẤU HÌNH HỆ THỐNG ─────────────────────────────────────────────────────────
const ADMIN_EMAIL = "admin@vtt.edu.vn";

const TOPICS = [
  "Relative clause", 
  "Will/Be Going To", 
  "First Conditional", 
  "Second Conditional", 
  "Verb Patterns"
];

const TOPIC_COLORS = {
  "Relative clause": "#3498db",
  "Will/Be Going To": "#2ecc71",
  "First Conditional": "#f1c40f",
  "Second Conditional": "#e74c3c",
  "Verb Patterns": "#9b59b6"
};

// ─── UI HELPERS ─────────────────────────────────────────────────────────────────
const pct = (v) => Math.round(v * 100);

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

  // ADMIN States
  const [allStudentsData, setAllStudentsData] = useState([]);
  const [viewingStudent, setViewingStudent] = useState("");
  const [sortCriterion, setSortCriterion] = useState("Average"); 

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
          explanation: explanations[nextQ.id] || "Đang cập nhật lời giải thích."
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
      setInteractionLogs([]); setChartData([]);
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

  const exportAllStudentsToExcel = async () => {
    try {
      const snapshot = await getDocs(collection(db, "learning_logs"));
      if (snapshot.empty) {
        alert("Chưa có dữ liệu nào trên hệ thống để xuất!");
        return;
      }

      let rawLogs = snapshot.docs.map(doc => doc.data());
      
      rawLogs.sort((a, b) => {
        if (a.student < b.student) return -1;
        if (a.student > b.student) return 1;
        const timeA = a.timestamp ? a.timestamp.toMillis() : 0;
        const timeB = b.timestamp ? b.timestamp.toMillis() : 0;
        return timeA - timeB;
      });

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

  const sortedStudents = [...allStudentsData].sort((a, b) => {
    if (sortCriterion === "Average") {
      return b.average - a.average; 
    } else {
      const scoreA = a.mastery[sortCriterion] || 0.3;
      const scoreB = b.mastery[sortCriterion] || 0.3;
      return scoreB - scoreA;
    }
  });

  // ─── LOGIN SCREEN (CHUẨN GIAO DIỆN HÌNH ẢNH) ──────────────────────────────────
  if (!user) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f9fafb', fontFamily: 'Arial, sans-serif', paddingTop: '8vh' }}>
      
      <h1 style={{ color: '#374151', fontSize: '26px', marginBottom: '10px', fontWeight: 'bold' }}>
        Navigate Yourself: Linguistics BKT
      </h1>
      <p style={{ color: '#6b7280', fontSize: '15px', marginBottom: '30px' }}>
        Vui lòng sử dụng tài khoản được giáo viên cung cấp
      </p>

      <div style={{ background: '#ffffff', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', width: '100%', maxWidth: '400px', boxSizing: 'border-box' }}>
        <input 
          type="email" 
          placeholder="Email học sinh" 
          onChange={e => setEmail(e.target.value)} 
          style={{ width: '100%', padding: '12px 15px', marginBottom: '20px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '15px', boxSizing: 'border-box', outline: 'none' }} 
        />
        <input 
          type="password" 
          placeholder="Mật khẩu" 
          onChange={e => setPassword(e.target.value)} 
          style={{ width: '100%', padding: '12px 15px', marginBottom: '25px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '15px', boxSizing: 'border-box', outline: 'none' }} 
        />
        <button 
          onClick={() => signInWithEmailAndPassword(auth, email, password)} 
          style={{ width: '100%', padding: '12px', background: '#27ae60', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}
        >
          Bắt đầu làm bài
        </button>
      </div>

      <button 
        onClick={handleAdminUpload} 
        style={{ marginTop: '40px', padding: '10px 20px', background: '#e74c3c', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', boxShadow: '0 2px 5px rgba(231,76,60,0.3)' }}
      >
        Admin: Nạp 500 câu hỏi
      </button>
      
    </div>
  );

  // ─── MAIN QUIZ APP (GIAO DIỆN HỌC THUẬT SẠCH SẼ) ─────────────────────────────
  return (
    <div style={{ backgroundColor: '#f3f4f6', minHeight: '100vh', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      
      <header style={{ maxWidth: '800px', margin: '0 auto 20px auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '15px 25px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
        <div>
          <h2 style={{ margin: 0, color: '#374151', fontSize: '18px' }}>Navigate Yourself BKT</h2>
          <span style={{ color: '#6b7280', fontSize: '13px' }}>Học viên: <strong>{user.email}</strong></span>
        </div>
        <button onClick={() => signOut(auth)} style={{ padding: '8px 15px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: '13px' }}>
          Đăng xuất
        </button>
      </header>

      <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* CHẾ ĐỘ GIÁO VIÊN */}
        {user.email === ADMIN_EMAIL && (
          <div style={{ background: '#e0f2fe', padding: '20px', borderRadius: '12px', border: '1px solid #bae6fd' }}>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#0369a1', display: 'block', marginBottom: '15px' }}>👨‍🏫 BẢNG ĐIỀU KHIỂN GIÁO VIÊN</span>
            
            <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ fontSize: '12px', color: '#0284c7', fontWeight: 'bold', marginBottom: '5px', display: 'block' }}>Tiêu chí xếp hạng:</label>
                <select value={sortCriterion} onChange={(e) => setSortCriterion(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #7dd3fc', outline: 'none' }}>
                  <option value="Average">Điểm Trung Bình Tất Cả</option>
                  {TOPICS.map(t => <option key={t} value={t}>Chủ đề: {t}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ fontSize: '12px', color: '#0284c7', fontWeight: 'bold', marginBottom: '5px', display: 'block' }}>Học sinh đang xem:</label>
                <select value={viewingStudent} onChange={(e) => setViewingStudent(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #7dd3fc', outline: 'none' }}>
                  {sortedStudents.map((s, idx) => (
                    <option key={s.email} value={s.email}>Top {idx + 1} - {s.email} ({sortCriterion === "Average" ? pct(s.average) : pct(s.mastery[sortCriterion] || 0.3)}%)</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={exportAllStudentsToExcel} style={{ padding: '10px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', flex: 1, fontWeight: 'bold' }}>📊 Xuất Excel TẤT CẢ học sinh</button>
              <button onClick={handleDeleteStudentData} disabled={!viewingStudent} style={{ padding: '10px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', flex: 1 }}>🗑️ Xóa HS đang chọn</button>
              <button onClick={handleDeleteAllData} style={{ padding: '10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', flex: 1 }}>🚨 Xóa SẠCH hệ thống</button>
            </div>
          </div>
        )}

        {/* KHUNG CÂU HỎI */}
        <div style={{ background: '#fff', padding: '30px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
          {currentQuestion ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <span style={{ background: '#f3f4f6', color: TOPIC_COLORS[currentQuestion.topic], padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', border: `1px solid ${TOPIC_COLORS[currentQuestion.topic]}40` }}>{currentQuestion.topic}</span>
                <span style={{ color: '#6b7280', fontSize: '13px' }}>Level: <strong>{currentQuestion.level}</strong></span>
              </div>
              
              <h3 style={{ lineHeight: '1.5', color: '#1f2937', fontSize: '18px', marginBottom: '25px' }}>{currentQuestion.content}</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {currentQuestion.options.map((opt, i) => {
                  const isSelected = selectedOption === opt;
                  const isActualAnswer = opt.startsWith(currentQuestion.answer.charAt(0));
                  
                  let btnStyle = { textAlign: 'left', padding: '15px', borderRadius: '8px', background: '#ffffff', color: '#374151', fontSize: '15px', cursor: 'pointer', border: '1px solid #d1d5db', transition: '0.2s' };
                  
                  if (isWaitingNext) {
                    btnStyle.cursor = 'default';
                    if (isSelected) {
                      btnStyle.background = isCorrectAnswer ? '#10b981' : '#ef4444';
                      btnStyle.color = '#fff';
                      btnStyle.borderColor = isCorrectAnswer ? '#10b981' : '#ef4444';
                    } else if (isActualAnswer) {
                      btnStyle.background = '#d1fae5';
                      btnStyle.borderColor = '#10b981';
                      btnStyle.color = '#065f46';
                    }
                  }

                  return (
                    <button key={i} onClick={() => handleAnswer(opt)} disabled={isWaitingNext} style={btnStyle}>
                      {opt}
                    </button>
                  )
                })}
              </div>

              {isWaitingNext && (
                <div style={{ marginTop: '20px', padding: '20px', borderRadius: '8px', background: isCorrectAnswer ? '#d1fae5' : '#fee2e2', border: `1px solid ${isCorrectAnswer ? '#a7f3d0' : '#fecaca'}` }}>
                  <h4 style={{ margin: '0 0 10px 0', color: isCorrectAnswer ? '#059669' : '#dc2626', fontSize: '16px' }}>
                    {isCorrectAnswer ? 'Chính xác!' : 'Chưa chính xác!'}
                  </h4>
                  {!isCorrectAnswer && <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#374151' }}>Đáp án đúng: <strong>{currentQuestion.answer}</strong></p>}
                  {currentQuestion.explanation && <p style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#4b5563', fontStyle: 'italic' }}>Giải thích: {currentQuestion.explanation}</p>}
                  
                  <button onClick={handleNextQuestion} style={{ padding: '12px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>
                    Câu tiếp theo ➔
                  </button>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>Đang tải dữ liệu BKT...</div>
          )}
        </div>

        {/* ĐỒ THỊ */}
        <div style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
          <div onClick={() => setShowChart(!showChart)} style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer', marginBottom: showChart ? '20px' : '0' }}>
            <h3 style={{ margin: 0, color: '#374151', fontSize: '16px' }}>Đồ thị xác suất làm chủ (BKT)</h3>
            <span style={{ fontSize: '13px', color: '#3b82f6' }}>{showChart ? 'Thu gọn' : 'Mở rộng'}</span>
          </div>
          {showChart && (
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="step" tick={{fontSize: 12, fill: '#6b7280'}} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{fontSize: 12, fill: '#6b7280'}} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Legend iconType="circle" wrapperStyle={{fontSize: '12px', paddingTop: '10px'}} />
                  {TOPICS.map(topic => (
                    <Line key={topic} type="monotone" dataKey={topic} stroke={TOPIC_COLORS[topic]} strokeWidth={2} connectNulls activeDot={{ r: 5 }} dot={{ r: 3 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* BẢNG LỊCH SỬ */}
        <div style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', marginBottom: '40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, color: '#374151', fontSize: '16px' }}>Lịch sử làm bài</h3>
            <button onClick={exportToExcel} style={{ padding: '8px 15px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}>
              📥 Xuất Excel Cá Nhân
            </button>
          </div>
          <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f9fafb' }}>
                <tr>
                  <th style={{padding: '12px', borderBottom: '1px solid #e5e7eb', color: '#4b5563'}}>Câu</th>
                  <th style={{padding: '12px', borderBottom: '1px solid #e5e7eb', color: '#4b5563'}}>Chủ đề</th>
                  <th style={{padding: '12px', borderBottom: '1px solid #e5e7eb', color: '#4b5563'}}>Kết quả</th>
                  <th style={{padding: '12px', borderBottom: '1px solid #e5e7eb', color: '#4b5563'}}>P(L) Sau</th>
                </tr>
              </thead>
              <tbody>
                {interactionLogs.map((log, i) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{padding: '12px', color: '#6b7280'}}>#{interactionLogs.length - i}</td>
                    <td style={{padding: '12px', color: '#374151'}}>{log.topic}</td>
                    <td style={{padding: '12px', color: log.isCorrect ? '#059669' : '#dc2626', fontWeight: 'bold'}}>
                      {log.isCorrect ? 'ĐÚNG' : 'SAI'}
                    </td>
                    <td style={{padding: '12px', fontWeight: 'bold', color: '#1f2937'}}>{(log.pL_after * 100).toFixed(1)}%</td>
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
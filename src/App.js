import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, createUserWithEmailAndPassword } from "firebase/auth";
import { 
  doc, getDoc, setDoc, addDoc, collection, 
  serverTimestamp, getDocs, writeBatch,
  query, where, orderBy, onSnapshot 
} from 'firebase/firestore';

// Đảm bảo các file này đã tồn tại trong thư mục src/logic/ và src/utils/
import { updateBKT } from './logic/bktEngine';
import { getAdaptiveQuestion } from './logic/AdaptiveQuestionSelector';
import { uploadAllQuestions } from './utils/bulkUpload';

// Thư viện biểu đồ (Cần chạy: npm install recharts)
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function App() {
  const [user, setUser] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [mastery, setMastery] = useState({ "Relative clause": 0.3 });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [chartData, setChartData] = useState([]);
  const [interactionLogs, setInteractionLogs] = useState([]);

  // --- HỆ THỐNG LẮNG NGHE REAL-TIME ĐỂ VẼ BIỂU ĐỒ & GHI LOGS ---
  useEffect(() => {
    if (!user) return;

    // Truy vấn lấy dữ liệu của chính học sinh đang đăng nhập
    const q = query(
      collection(db, "learning_logs"),
      where("student", "==", user.email),
      orderBy("timestamp", "asc")
    );

    // Snapshot: Tự động cập nhật biểu đồ và bảng Logs ngay khi có tương tác mới
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rawLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // 1. Cập nhật nhật ký tương tác (Logs mới nhất lên đầu bảng)
      setInteractionLogs([...rawLogs].reverse());

      // 2. Định dạng dữ liệu cho biểu đồ BKT
      const formattedChart = rawLogs.map((log, index) => ({
        step: index + 1, // Thứ tự cơ hội j
        probability: parseFloat((log.pL_after * 100).toFixed(1))
      }));
      setChartData(formattedChart);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const docRef = doc(db, "mastery", currentUser.email);
        const docSnap = await getDoc(docRef);
        let currentP = 0.3;
        if (docSnap.exists()) {
          setMastery(docSnap.data());
          currentP = docSnap.data()["Relative clause"] || 0.3;
        }
        setCurrentQuestion(getAdaptiveQuestion("Relative clause", currentP, []));
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleAnswer = async (opt) => {
    if (!currentQuestion || !user) return;
    const isCorrect = opt.startsWith(currentQuestion.answer.charAt(0)); 
    const pL_prev = mastery["Relative clause"] || 0.3;
    const pL_new = updateBKT(pL_prev, isCorrect);
    
    setMastery({ "Relative clause": pL_new });

    // GHI NHẬN TOÀN BỘ CỬ CHỈ VÀ BIẾN SỐ TOÁN HỌC
    try {
      await Promise.all([
        setDoc(doc(db, "mastery", user.email), { "Relative clause": pL_new }, { merge: true }),
        addDoc(collection(db, "learning_logs"), {
          student: user.email,
          questionId: currentQuestion.id,
          level: currentQuestion.level,
          isCorrect: isCorrect,
          pL_before: pL_prev, // P(Lj-1)
          pL_after: pL_new,   // P(Lj)
          timestamp: serverTimestamp()
        })
      ]);
    } catch (e) { console.error("Lỗi đồng bộ Firestore:", e); }

    const nextQ = getAdaptiveQuestion("Relative clause", pL_new, []);
    if (nextQ) setCurrentQuestion(nextQ);
  };

  // UI Components Rút gọn để tránh lỗi render
  if (!user) return (
    <div style={{ textAlign: 'center', padding: '100px', fontFamily: 'Arial' }}>
      <h2>Linguistics BKT - Research Login</h2>
      <input type="email" placeholder="Email" onChange={e => setEmail(e.target.value)} style={{display: 'block', margin: '10px auto', padding: '10px'}} />
      <input type="password" placeholder="Mật khẩu" onChange={e => setPassword(e.target.value)} style={{display: 'block', margin: '10px auto', padding: '10px'}} />
      <button onClick={() => signInWithEmailAndPassword(auth, email, password)} style={{padding: '10px 20px', background: '#6c5ce7', color: '#fff', border: 'none', borderRadius: '5px'}}>Vào bài thực nghiệm</button>
    </div>
  );

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px', fontFamily: 'Arial', backgroundColor: '#f8fafc' }}>
      <header style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
        <span>Học viên: <strong>{user.email}</strong></span>
        <button onClick={() => signOut(auth)} style={{color: 'red', border: 'none', background: 'none', cursor: 'pointer'}}>Đăng xuất</button>
      </header>

      {/* Progress & Question */}
      <div style={{ background: '#fff', padding: '20px', borderRadius: '15px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginBottom: '25px' }}>
        <h3 style={{textAlign: 'center'}}>Trình độ tinh thông: {(mastery["Relative clause"] * 100).toFixed(1)}%</h3>
        <div style={{ width: '100%', height: '12px', background: '#f3f4f6', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, mastery["Relative clause"] * 100)}%`, height: '100%', background: '#10b981', transition: 'width 0.8s' }}></div>
        </div>
        
        {currentQuestion && (
          <div style={{marginTop: '30px'}}>
            <p style={{color: '#6366f1', fontWeight: 'bold'}}>CẤP ĐỘ: {currentQuestion.level}</p>
            <h3>{currentQuestion.content}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {currentQuestion.options.map((opt, i) => (
                <button key={i} onClick={() => handleAnswer(opt)} style={{padding: '15px', borderRadius: '10px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer'}}>{opt}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* BIỂU ĐỒ BKT (VẼ REAL-TIME) */}
      <div style={{ background: '#fff', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginBottom: '25px' }}>
        <h3 style={{ marginBottom: '20px' }}>Đường cong học tập (Learning Curve Analysis)</h3>
        <div style={{ width: '100%', height: 350 }}>
          <ResponsiveContainer>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="step" label={{ value: 'Cơ hội (j)', position: 'insideBottom', offset: -5 }} />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Area type="monotone" dataKey="probability" stroke="#10b981" strokeWidth={3} fill="#d1fae5" name="P(Lj)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* NHẬT KÝ TƯƠNG TÁC CHI TIẾT (RESEARCH DATA) */}
      <div style={{ background: '#fff', padding: '20px', borderRadius: '15px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <h3 style={{ marginBottom: '15px' }}>Dữ liệu tương tác chi tiết (Logs)</h3>
        <div style={{ maxHeight: '250px', overflowY: 'auto', fontSize: '11px' }}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{padding: '10px'}}>Bước (j)</th>
                <th>Cấp độ Bloom</th>
                <th>Kết quả</th>
                <th>P(Lj-1)</th>
                <th>P(Lj)</th>
                <th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {interactionLogs.map((log, i) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{padding: '10px'}}>{interactionLogs.length - i}</td>
                  <td>{log.level}</td>
                  <td style={{ color: log.isCorrect ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>{log.isCorrect ? 'ĐÚNG' : 'SAI'}</td>
                  <td>{log.pL_before?.toFixed(4)}</td>
                  <td>{log.pL_after?.toFixed(4)}</td>
                  <td>{log.timestamp?.toDate().toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default App;
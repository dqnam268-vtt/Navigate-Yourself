import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { 
  doc, getDoc, setDoc, addDoc, collection, 
  serverTimestamp, 
  query, where, orderBy, onSnapshot 
} from 'firebase/firestore';

// Các logic bổ trợ
import { updateBKT } from './logic/bktEngine';
import { getAdaptiveQuestion } from './logic/AdaptiveQuestionSelector';
import { uploadAllQuestions } from './utils/bulkUpload';

// Thư viện biểu đồ
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function App() {
  const [user, setUser] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [mastery, setMastery] = useState({ "Relative clause": 0.3 });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [chartData, setChartData] = useState([]);
  const [interactionLogs, setInteractionLogs] = useState([]);

  // 1. Theo dõi dữ liệu học tập thời gian thực để vẽ biểu đồ
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "learning_logs"),
      where("student", "==", user.email),
      orderBy("timestamp", "asc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rawLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInteractionLogs([...rawLogs].reverse());
      const formattedChart = rawLogs.map((log, index) => ({
        step: index + 1,
        probability: parseFloat((log.pL_after * 100).toFixed(1))
      }));
      setChartData(formattedChart);
    });
    return () => unsubscribe();
  }, [user]);

  // 2. Kiểm tra trạng thái đăng nhập và tải độ tinh thông (Mastery)
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
        // Lấy câu hỏi đầu tiên dựa trên trình độ hiện tại
        setCurrentQuestion(getAdaptiveQuestion("Relative clause", currentP, []));
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // 3. Xử lý khi người dùng chọn đáp án
  const handleAnswer = async (selectedOption) => {
    if (!currentQuestion || !user) return;

    const isCorrect = selectedOption.startsWith(currentQuestion.answer.charAt(0));
    const pL_prev = mastery["Relative clause"] || 0.3;
    const pL_new = updateBKT(pL_prev, isCorrect);
    
    setMastery({ "Relative clause": pL_new });

    try {
      // Lưu kết quả song song lên Firestore
      await Promise.all([
        setDoc(doc(db, "mastery", user.email), { "Relative clause": pL_new }, { merge: true }),
        addDoc(collection(db, "learning_logs"), {
          student: user.email,
          questionId: currentQuestion.id,
          level: currentQuestion.level,
          isCorrect: isCorrect,
          pL_before: pL_prev,
          pL_after: pL_new,
          timestamp: serverTimestamp()
        })
      ]);
    } catch (e) {
      console.error("Lỗi đồng bộ dữ liệu:", e);
    }

    // Chuyển sang câu hỏi thích ứng tiếp theo
    const nextQ = getAdaptiveQuestion("Relative clause", pL_new, []);
    setCurrentQuestion(nextQ);
  };

  // GIAO DIỆN CHƯA ĐĂNG NHẬP
  if (!user) return (
    <div style={{ textAlign: 'center', padding: '100px', fontFamily: 'Arial', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
      <div style={{ background: '#fff', padding: '40px', borderRadius: '12px', display: 'inline-block', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
        <h2 style={{ color: '#6c5ce7' }}>Linguistics BKT Research</h2>
        <p style={{ color: '#666' }}>Hệ thống học tập thích ứng</p>
        <input type="email" placeholder="Email" onChange={e => setEmail(e.target.value)} style={{display: 'block', margin: '15px auto', padding: '12px', width: '250px', borderRadius: '6px', border: '1px solid #ddd'}} />
        <input type="password" placeholder="Mật khẩu" onChange={e => setPassword(e.target.value)} style={{display: 'block', margin: '15px auto', padding: '12px', width: '250px', borderRadius: '6px', border: '1px solid #ddd'}} />
        <button 
          onClick={() => signInWithEmailAndPassword(auth, email, password)} 
          style={{padding: '12px 30px', background: '#6c5ce7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'}}
        >
          Đăng nhập thực nghiệm
        </button>

        {/* CÔNG CỤ NẠP 600 CÂU - CHỈ DÙNG 1 LẦN */}
        <div style={{marginTop: '40px', paddingTop: '20px', borderTop: '1px dashed #ccc'}}>
          <p style={{fontSize: '11px', color: '#999'}}>Quản trị viên:</p>
          <button 
            onClick={uploadAllQuestions} 
            style={{padding: '5px 15px', background: '#e17055', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer'}}
          >
            🚀 Nạp 600 câu ngân hàng
          </button>
        </div>
      </div>
    </div>
  );

  // GIAO DIỆN ĐÃ ĐĂNG NHẬP
  return (
    <div style={{ padding: '30px', fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif', backgroundColor: '#f4f7f6', minHeight: '100vh' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, color: '#2d3436' }}>Học tập thích ứng (BKT Model)</h2>
          <span style={{ color: '#636e72' }}>Xin chào: <strong>{user.email}</strong></span>
        </div>
        <button onClick={() => signOut(auth)} style={{ padding: '8px 18px', borderRadius: '5px', border: '1px solid #dcdde1', cursor: 'pointer' }}>Đăng xuất</button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
        {/* CỘT TRÁI: CÂU HỎI */}
        <div style={{ background: '#fff', padding: '30px', borderRadius: '15px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          {currentQuestion ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                <span style={{ background: '#6c5ce7', color: '#fff', padding: '4px 12px', borderRadius: '20px', fontSize: '12px' }}>{currentQuestion.topic}</span>
                <span style={{ color: '#fdcb6e', fontWeight: 'bold' }}>Level: {currentQuestion.level}</span>
              </div>
              <h3 style={{ lineHeight: '1.6', color: '#2d3436' }}>{currentQuestion.content}</h3>
              <div style={{ marginTop: '25px' }}>
                {currentQuestion.options.map((opt, i) => (
                  <button 
                    key={i} 
                    onClick={() => handleAnswer(opt)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '15px', marginBottom: '10px', borderRadius: '10px', border: '1px solid #e0e0e0', background: '#fff', cursor: 'pointer', transition: '0.2s' }}
                    onMouseOver={e => e.currentTarget.style.background = '#f9f9f9'}
                    onMouseOut={e => e.currentTarget.style.background = '#fff'}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p>Đang tải câu hỏi tối ưu...</p>
          )}
        </div>

        {/* CỘT PHẢI: BIỂU ĐỒ & LOGS */}
        <div>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '15px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginBottom: '30px' }}>
            <h3 style={{ marginBottom: '20px' }}>Tiến trình tinh thông (Mastery Probability)</h3>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="step" label={{ value: 'Số câu đã làm', position: 'insideBottom', offset: -5 }} />
                  <YAxis domain={[0, 100]} unit="%" />
                  <Tooltip formatter={(value) => [`${value}%`, 'Xác suất tinh thông']} />
                  <Area type="monotone" dataKey="probability" stroke="#6c5ce7" fill="#a29bfe" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ background: '#fff', padding: '20px', borderRadius: '15px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <h3 style={{ marginBottom: '15px' }}>Lịch sử tương tác</h3>
            <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#fff' }}>
                  <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                    <th style={{padding: '10px'}}>STT</th>
                    <th>Kết quả</th>
                    <th>P(L) Sau</th>
                  </tr>
                </thead>
                <tbody>
                  {interactionLogs.map((log, i) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #f9f9f9' }}>
                      <td style={{padding: '10px'}}>{interactionLogs.length - i}</td>
                      <td style={{ color: log.isCorrect ? '#00b894' : '#d63031', fontWeight: 'bold' }}>{log.isCorrect ? 'ĐÚNG' : 'SAI'}</td>
                      <td>{(log.pL_after * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
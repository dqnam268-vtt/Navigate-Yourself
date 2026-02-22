import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { 
  doc, getDoc, setDoc, addDoc, collection, 
  serverTimestamp, query, where, orderBy, onSnapshot 
} from 'firebase/firestore';

import { updateBKT } from './logic/bktEngine';
import { getAdaptiveQuestion } from './logic/AdaptiveQuestionSelector';
import { uploadAllQuestions } from './utils/bulkUpload';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const TOPICS = [
  "Relative clause", 
  "Will/Be Going To", 
  "First Conditional", 
  "Second Conditional", 
  "Verb Patterns"
];

const TOPIC_COLORS = {
  "Relative clause": "#6c5ce7",
  "Will/Be Going To": "#00b894",
  "First Conditional": "#fdcb6e",
  "Second Conditional": "#e17055",
  "Verb Patterns": "#0984e3"
};

function App() {
  const [user, setUser] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // State mới để điều khiển ẩn/hiện biểu đồ (Mặc định hiện)
  const [showChart, setShowChart] = useState(true);
  
  const [mastery, setMastery] = useState(
    TOPICS.reduce((acc, topic) => ({ ...acc, [topic]: 0.3 }), {})
  );

  const [chartData, setChartData] = useState([]);
  const [interactionLogs, setInteractionLogs] = useState([]);

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
    });

    return () => unsubscribe();
  }, [user]);

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
        setCurrentQuestion(nextQ);
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleAnswer = async (opt) => {
    if (!currentQuestion || !user) return;
    const isCorrect = opt.startsWith(currentQuestion.answer.charAt(0)); 
    
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
    } catch (e) { console.error(e); }

    const nextTopic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
    const nextQ = getAdaptiveQuestion(nextTopic, newMastery[nextTopic], []);
    setCurrentQuestion(nextQ);
  };

  // UI Đăng nhập
  if (!user) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f4f7f6', fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif', padding: '20px' }}>
      <div style={{ background: '#fff', padding: '40px 30px', borderRadius: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', textAlign: 'center', width: '100%', maxWidth: '380px', boxSizing: 'border-box' }}>
        <div style={{ width: '60px', height: '60px', background: '#6c5ce7', color: '#fff', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', margin: '0 auto 20px', fontWeight: 'bold' }}>BKT</div>
        <h2 style={{ color: '#2d3436', margin: '0 0 10px 0', fontSize: '22px' }}>Navigate-Yourself</h2>
        <p style={{ color: '#636e72', fontSize: '14px', marginBottom: '30px' }}>Hệ thống học tập thích ứng</p>
        
        <input type="email" placeholder="Email học viên" onChange={e => setEmail(e.target.value)} style={{width: '100%', boxSizing: 'border-box', padding: '14px', marginBottom: '15px', borderRadius: '10px', border: '1px solid #dfe6e9', outline: 'none', fontSize: '15px'}} />
        <input type="password" placeholder="Mật khẩu" onChange={e => setPassword(e.target.value)} style={{width: '100%', boxSizing: 'border-box', padding: '14px', marginBottom: '25px', borderRadius: '10px', border: '1px solid #dfe6e9', outline: 'none', fontSize: '15px'}} />
        
        <button onClick={() => signInWithEmailAndPassword(auth, email, password)} style={{width: '100%', padding: '14px', background: '#6c5ce7', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.3s'}}>Bắt đầu ngay</button>
        
        <div style={{marginTop: '30px', paddingTop: '20px', borderTop: '1px dashed #b2bec3'}}>
          <p style={{fontSize: '12px', color: '#b2bec3', marginBottom: '10px'}}>Dành cho Giáo viên / Admin:</p>
          <button onClick={uploadAllQuestions} style={{padding: '8px 15px', background: '#ffeaa7', color: '#d63031', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold'}}>🚀 Nạp 500 câu ngân hàng</button>
        </div>
      </div>
    </div>
  );

  const currentColor = currentQuestion ? TOPIC_COLORS[currentQuestion.topic] : '#6c5ce7';

  // UI Đã đăng nhập
  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '20px', fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      
      {/* CSS Nhúng cho Mobile và Hover */}
      <style>{`
        .option-btn { transition: all 0.2s ease; border: 2px solid transparent; }
        .option-btn:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.08); border-color: ${currentColor}; background: #fdfdfd !important; }
        .logout-btn:hover { background: #ff7675 !important; color: white !important; border-color: #ff7675 !important; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
        
        /* Chỉnh bố cục trên điện thoại */
        @media (max-width: 768px) {
          .main-layout { grid-template-columns: 1fr !important; gap: 20px !important; }
          .app-header { flex-direction: column; gap: 15px; text-align: center; padding: 20px !important; }
          .header-info { flex-direction: column; }
        }
      `}</style>

      {/* HEADER */}
      <header className="app-header" style={{ maxWidth: '1200px', margin: '0 auto 20px auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '15px 30px', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
        <div className="header-info" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', color: '#fff', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px' }}>N</div>
          <div>
            <h2 style={{ margin: 0, color: '#2d3436', fontSize: '18px' }}>Navigate-Yourself BKT</h2>
            <span style={{ color: '#636e72', fontSize: '13px' }}>Học viên: <strong>{user.email}</strong></span>
          </div>
        </div>
        <button className="logout-btn" onClick={() => signOut(auth)} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #dfe6e9', background: '#fff', color: '#636e72', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s' }}>Đăng xuất</button>
      </header>

      <div className="main-layout" style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: '5fr 4fr', gap: '30px' }}>
        
        {/* CỘT TRÁI: KHUNG CÂU HỎI */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: '#fff', padding: '30px 25px', borderRadius: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.04)', minHeight: '350px' }}>
            {currentQuestion ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '10px' }}>
                  <span style={{ background: `${currentColor}20`, color: currentColor, padding: '6px 15px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' }}>{currentQuestion.topic}</span>
                  <span style={{ color: '#b2bec3', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{width: '8px', height: '8px', borderRadius: '50%', background: '#fdcb6e', display: 'inline-block'}}></span>
                    Level: {currentQuestion.level}
                  </span>
                </div>
                
                <h3 style={{ lineHeight: '1.6', color: '#2d3436', fontSize: '18px', marginBottom: '30px' }}>{currentQuestion.content}</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {currentQuestion.options.map((opt, i) => (
                    <button 
                      key={i} 
                      className="option-btn"
                      onClick={() => handleAnswer(opt)}
                      style={{ textAlign: 'left', padding: '16px 20px', borderRadius: '12px', background: '#f8fafc', color: '#2d3436', fontSize: '15px', cursor: 'pointer' }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#a4b0be' }}>
                <p>Đang tải câu hỏi tối ưu phân tích từ BKT...</p>
              </div>
            )}
          </div>
        </div>

        {/* CỘT PHẢI: BIỂU ĐỒ & LOGS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Biểu đồ Multi-line CÓ NÚT ẨN/HIỆN */}
          <div style={{ background: '#fff', padding: '20px 25px', borderRadius: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.04)', transition: 'all 0.3s ease' }}>
            <div 
              onClick={() => setShowChart(!showChart)} 
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: showChart ? '20px' : '0' }}
            >
              <h3 style={{ margin: 0, color: '#2d3436', fontSize: '16px' }}>Đồ thị tinh thông (P(L))</h3>
              <span style={{ fontSize: '13px', color: '#6c5ce7', fontWeight: 'bold', background: '#f0f0ff', padding: '5px 12px', borderRadius: '15px' }}>
                {showChart ? '▲ Thu gọn' : '▼ Mở rộng'}
              </span>
            </div>
            
            {/* Vùng vẽ đồ thị: Sẽ biến mất khi showChart = false */}
            {showChart && (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f2f6" />
                    <XAxis dataKey="step" tick={{fontSize: 11, fill: '#a4b0be'}} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{fontSize: 11, fill: '#a4b0be'}} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{borderRadius: '10px', border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)'}} />
                    <Legend iconType="circle" wrapperStyle={{fontSize: '11px', paddingTop: '10px'}} />
                    {TOPICS.map(topic => (
                      <Line key={topic} type="monotone" dataKey={topic} stroke={TOPIC_COLORS[topic]} strokeWidth={3} connectNulls activeDot={{ r: 6 }} dot={{ r: 3, strokeWidth: 2 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Bảng Logs */}
          <div style={{ background: '#fff', padding: '20px 25px', borderRadius: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.04)', flexGrow: 1 }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#2d3436', fontSize: '16px' }}>Lịch sử tương tác</h3>
            <div className="custom-scrollbar" style={{ maxHeight: '250px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
                  <tr style={{ color: '#a4b0be', textAlign: 'left' }}>
                    <th style={{padding: '10px 5px', borderBottom: '2px solid #f1f2f6'}}>Câu</th>
                    <th style={{padding: '10px 5px', borderBottom: '2px solid #f1f2f6'}}>Chủ đề</th>
                    <th style={{padding: '10px 5px', borderBottom: '2px solid #f1f2f6'}}>Kết quả</th>
                    <th style={{padding: '10px 5px', borderBottom: '2px solid #f1f2f6'}}>P(L) Sau</th>
                  </tr>
                </thead>
                <tbody>
                  {interactionLogs.map((log, i) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{padding: '12px 5px', color: '#636e72'}}>#{interactionLogs.length - i}</td>
                      <td style={{padding: '12px 5px'}}>
                        <span style={{background: `${TOPIC_COLORS[log.topic]}15`, color: TOPIC_COLORS[log.topic], padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold'}}>{log.topic}</span>
                      </td>
                      <td style={{padding: '12px 5px'}}>
                        {log.isCorrect 
                          ? <span style={{background: '#e0fbf1', color: '#00b894', padding: '4px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 'bold'}}>ĐÚNG</span>
                          : <span style={{background: '#ffeaa7', color: '#d63031', padding: '4px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 'bold'}}>SAI</span>
                        }
                      </td>
                      <td style={{padding: '12px 5px', fontWeight: 'bold', color: '#2d3436'}}>{(log.pL_after * 100).toFixed(1)}%</td>
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
import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp, getDocs, writeBatch, query, where, orderBy } from 'firebase/firestore';
import { updateBKT } from './logic/bktEngine';
import { getAdaptiveQuestion } from './logic/AdaptiveQuestionSelector';
import { uploadAllQuestions } from './utils/bulkUpload';
// Import thành phần biểu đồ
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function App() {
  const [user, setUser] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [mastery, setMastery] = useState({ "Relative clause": 0.3 });
  const [seenIds, setSeenIds] = useState([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const docSnap = await getDoc(doc(db, "mastery", currentUser.email));
        let currentP = 0.3;
        if (docSnap.exists()) {
          setMastery(docSnap.data());
          currentP = docSnap.data()["Relative clause"];
        }
        setCurrentQuestion(getAdaptiveQuestion("Relative clause", currentP, []));
        fetchChartData(currentUser.email);
      } else { setUser(null); }
    });
    return () => unsubscribe();
  }, []);

  const fetchChartData = async (studentEmail) => {
    const q = query(collection(db, "learning_logs"), where("student", "==", studentEmail), orderBy("timestamp", "asc"));
    const snap = await getDocs(q);
    const data = snap.docs.map((d, i) => ({
      step: i + 1,
      mastery: parseFloat((d.data().pL_after * 100).toFixed(1))
    }));
    setChartData(data);
  };

  const handleAnswer = async (opt) => {
    if (!currentQuestion) return;
    const isCorrect = opt.startsWith(currentQuestion.answer.charAt(0)); 
    const pL_prev = mastery["Relative clause"];
    const pL_new = updateBKT(pL_prev, isCorrect);
    
    setMastery({ "Relative clause": pL_new });
    await setDoc(doc(db, "mastery", user.email), { "Relative clause": pL_new }, { merge: true });
    await addDoc(collection(db, "learning_logs"), {
      student: user.email,
      pL_before: pL_prev,
      pL_after: pL_new,
      isCorrect,
      timestamp: serverTimestamp()
    });

    fetchChartData(user.email);
    const nextQ = getAdaptiveQuestion("Relative clause", pL_new, [...seenIds, currentQuestion.id]);
    if (nextQ) { setCurrentQuestion(nextQ); setSeenIds([...seenIds, currentQuestion.id]); }
  };

  const handleBulkReset = async () => {
    if (window.confirm("Reset tất cả?") && window.prompt("Pass:") === "namy") {
      const batch = writeBatch(db);
      const mSnap = await getDocs(collection(db, "mastery"));
      mSnap.forEach(d => batch.update(d.ref, { "Relative clause": 0.3 }));
      const lSnap = await getDocs(collection(db, "learning_logs"));
      lSnap.forEach(d => batch.delete(d.ref));
      await batch.commit();
      window.location.reload();
    }
  };

  if (!user) return (
    <div style={{ textAlign: 'center', padding: '100px' }}>
      <input type="email" placeholder="Email" onChange={e => setEmail(e.target.value)} />
      <input type="password" placeholder="Pass" onChange={e => setPassword(e.target.value)} />
      <button onClick={() => signInWithEmailAndPassword(auth, email, password)}>Đăng nhập</button>
    </div>
  );

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <header style={{ textAlign: 'center' }}>
        <span>Học sinh: {user.email}</span>
        <button onClick={handleBulkReset} style={{marginLeft: '10px', background: '#000', color: '#fff'}}>Admin Reset</button>
        <h2>Trình độ: {(mastery["Relative clause"] * 100).toFixed(1)}%</h2>
        <div style={{ width: '100%', height: '15px', background: '#eee', borderRadius: '10px' }}>
          <div style={{ width: `${mastery["Relative clause"] * 100}%`, height: '100%', background: '#2ecc71', borderRadius: '10px' }}></div>
        </div>
      </header>

      {currentQuestion && (
        <main style={{ marginTop: '20px', padding: '20px', border: '1px solid #ddd' }}>
          <h3>{currentQuestion.content}</h3>
          {currentQuestion.options.map((opt, i) => (
            <button key={i} onClick={() => handleAnswer(opt)} style={{ margin: '5px', padding: '10px' }}>{opt}</button>
          ))}
        </main>
      )}

      {/* BIỂU ĐỒ BKT */}
      <section style={{ marginTop: '30px', height: '300px', background: '#fff', padding: '20px' }}>
        <h3 style={{ textAlign: 'center' }}>Đường cong học tập (BKT)</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="step" label={{ value: 'Cơ hội (j)', position: 'insideBottom', offset: -5 }} />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Line type="monotone" dataKey="mastery" stroke="#2ecc71" strokeWidth={3} dot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}

export default App;
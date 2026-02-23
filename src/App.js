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

import * as XLSX from 'xlsx';

// Components
import LoginScreen from './components/LoginScreen';
import AppHeader from './components/AppHeader';
import TeacherPanel from './components/TeacherPanel';
import MasteryBadges from './components/MasteryBadges';
import QuestionCard from './components/QuestionCard';
import MasteryChart from './components/MasteryChart';
import HistoryTable from './components/HistoryTable';

const TOPICS = [
  "Relative clause", 
  "Will/Be Going To", 
  "First Conditional", 
  "Second Conditional", 
  "Verb Patterns"
];

function App() {
  const [user, setUser] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const [selectedOption, setSelectedOption] = useState(null);
  const [isCorrectAnswer, setIsCorrectAnswer] = useState(null);
  const [isWaitingNext, setIsWaitingNext] = useState(false);

  const [allStudents, setAllStudents] = useState([]);
  const [viewingStudent, setViewingStudent] = useState("");

  const [mastery, setMastery] = useState(
    TOPICS.reduce((acc, topic) => ({ ...acc, [topic]: 0.3 }), {})
  );

  const [chartData, setChartData] = useState([]);
  const [interactionLogs, setInteractionLogs] = useState([]);

  // Fetch students list
  useEffect(() => {
    if (user) {
      setViewingStudent(user.email);
      const fetchStudents = async () => {
        const snap = await getDocs(collection(db, "mastery"));
        const studentEmails = snap.docs.map(doc => doc.id);
        setAllStudents(studentEmails);
      };
      fetchStudents();
    }
  }, [user]);

  // Listen to learning logs
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
    }, (error) => {
      console.error("Error fetching logs: ", error);
    });

    return () => unsubscribe();
  }, [viewingStudent]);

  // Auth state listener
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
          explanation: explanations[nextQ.id] || "No explanation available."
        });

      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle answer
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
    } catch (e) { console.error("Error saving to DB: ", e); }
  };

  // Next question
  const handleNextQuestion = () => {
    const nextTopic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
    const nextQ = getAdaptiveQuestion(nextTopic, mastery[nextTopic], []);
    
    setSelectedOption(null);
    setIsCorrectAnswer(null);
    setIsWaitingNext(false);
    
    setCurrentQuestion({
      ...nextQ,
      explanation: explanations[nextQ.id] || "No explanation available."
    });
  };

  // Delete student data
  const handleDeleteStudentData = async () => {
    if (!viewingStudent) return;
    const passwordInput = window.prompt(`Enter teacher password to delete data for ${viewingStudent}:`);
    if (passwordInput !== "namy") {
      if (passwordInput !== null) alert("Incorrect password!");
      return;
    }
    const confirmDelete = window.confirm(`WARNING: Are you sure you want to delete ALL history for: ${viewingStudent}?`);
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "mastery", viewingStudent));
      const q = query(collection(db, "learning_logs"), where("student", "==", viewingStudent));
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(document => deleteDoc(doc(db, "learning_logs", document.id)));
      await Promise.all(deletePromises);

      alert(`Successfully deleted all data for ${viewingStudent}`);
      
      setAllStudents(prev => prev.filter(e => e !== viewingStudent));
      if (viewingStudent === user.email) {
        setMastery(TOPICS.reduce((acc, topic) => ({ ...acc, [topic]: 0.3 }), {}));
        setInteractionLogs([]);
        setChartData([]);
      } else {
        setViewingStudent(user.email);
      }
    } catch (err) { alert("An error occurred!"); }
  };

  // Delete all data
  const handleDeleteAllData = async () => {
    const passwordInput = window.prompt("DANGER: Enter teacher password to DELETE ALL system data:");
    if (passwordInput !== "namy") {
      if (passwordInput !== null) alert("Incorrect password!");
      return;
    }
    const confirm1 = window.confirm("This will DELETE ALL student data. The system will reset completely. Continue?");
    if (!confirm1) return;

    try {
      const masterySnap = await getDocs(collection(db, "mastery"));
      const masteryDeletes = masterySnap.docs.map(document => deleteDoc(doc(db, "mastery", document.id)));
      
      const logsSnap = await getDocs(collection(db, "learning_logs"));
      const logsDeletes = logsSnap.docs.map(document => deleteDoc(doc(db, "learning_logs", document.id)));
      
      await Promise.all([...masteryDeletes, ...logsDeletes]);

      alert("Successfully cleaned all system data!");
      setAllStudents([user.email]);
      setViewingStudent(user.email);
      setMastery(TOPICS.reduce((acc, topic) => ({ ...acc, [topic]: 0.3 }), {}));
      setInteractionLogs([]);
      setChartData([]);
    } catch (err) { alert("An error occurred!"); }
  };

  // Export to Excel
  const exportToExcel = () => {
    if (interactionLogs.length === 0) {
      alert("No data to export!");
      return;
    }
    const exportData = interactionLogs.map((log, index) => ({
      "#": interactionLogs.length - index,
      "Student Email": log.student,
      "Topic": log.topic,
      "Level": log.level,
      "Question ID": log.questionId,
      "Result": log.isCorrect ? "CORRECT" : "WRONG",
      "P(L) Before": parseFloat((log.pL_before * 100).toFixed(2)) + "%",
      "P(L) After": parseFloat((log.pL_after * 100).toFixed(2)) + "%",
      "Timestamp": log.timestamp ? log.timestamp.toDate().toLocaleString('vi-VN') : "N/A"
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [
      { wch: 5 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, 
      { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 20 }
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "BKT_Logs");
    XLSX.writeFile(workbook, `BKT_Logs_${viewingStudent.split('@')[0]}.xlsx`);
  };

  // Admin upload handler
  const handleAdminUpload = () => {
    const adminPassword = window.prompt("ADMIN: Enter password to upload question bank:");
    if (adminPassword !== "namy241222") {
      if (adminPassword !== null) {
        alert("Incorrect Admin password! Access denied.");
      }
      return;
    }
    uploadAllQuestions();
  };

  // ===== RENDER LOGIN =====
  if (!user) {
    return (
      <LoginScreen
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        onLogin={() => signInWithEmailAndPassword(auth, email, password)}
        onAdminUpload={handleAdminUpload}
      />
    );
  }

  // ===== RENDER MAIN APP =====
  return (
    <div className="app-layout">
      <AppHeader
        userEmail={user.email}
        onLogout={() => signOut(auth)}
      />

      <div className="content-stack">
        <TeacherPanel
          allStudents={allStudents}
          viewingStudent={viewingStudent}
          userEmail={user.email}
          onSelectStudent={setViewingStudent}
          onDeleteStudent={handleDeleteStudentData}
          onDeleteAll={handleDeleteAllData}
        />

        <MasteryBadges mastery={mastery} topics={TOPICS} />

        <QuestionCard
          currentQuestion={currentQuestion}
          selectedOption={selectedOption}
          isCorrectAnswer={isCorrectAnswer}
          isWaitingNext={isWaitingNext}
          onAnswer={handleAnswer}
          onNext={handleNextQuestion}
        />

        <MasteryChart chartData={chartData} topics={TOPICS} />

        <HistoryTable
          interactionLogs={interactionLogs}
          onExportExcel={exportToExcel}
        />
      </div>
    </div>
  );
}

export default App;

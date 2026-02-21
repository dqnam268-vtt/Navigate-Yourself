import { db } from "../firebase";
import { doc, writeBatch } from "firebase/firestore";
import { questionBank } from "../data/questionBank";

export const uploadAllQuestions = async () => {
  const batch = writeBatch(db);
  try {
    questionBank.forEach((q) => {
      const qRef = doc(db, "questions", q.id);
      batch.set(qRef, q);
    });
    await batch.commit();
    alert("Đã nạp thành công 200 câu lên Firestore!");
  } catch (error) {
    console.error("Lỗi nạp dữ liệu:", error);
  }
};
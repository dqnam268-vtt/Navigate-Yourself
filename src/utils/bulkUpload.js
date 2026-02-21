import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { questionBank } from "../data/questionBank"; 

export const uploadAllQuestions = async () => {
  // Cập nhật dòng confirm này để hiển thị đúng số lượng thực tế
  const confirmAction = window.confirm(`HỆ THỐNG MỚI: Bạn có chắc muốn nạp TẤT CẢ ${questionBank.length} câu hỏi từ ngân hàng không?`);
  if (!confirmAction) return;

  console.log("Bắt đầu nạp dữ liệu...");
  let successCount = 0;

  try {
    for (const q of questionBank) {
      const qRef = doc(db, "questions", q.id);
      await setDoc(qRef, { ...q, updatedAt: new Date() });
      successCount++;
    }
    alert(`Thành công! Đã nạp xong ${successCount} câu hỏi.`);
  } catch (error) {
    alert("Lỗi nạp dữ liệu: " + error.message);
  }
};
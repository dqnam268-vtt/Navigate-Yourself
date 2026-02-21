import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { questionBank } from "../data/questionBank"; // Đảm bảo đường dẫn này khớp với file 600 câu của bạn

/**
 * Hàm nạp toàn bộ ngân hàng câu hỏi lên Firestore
 * Sử dụng vòng lặp để tránh giới hạn 500 bản ghi của writeBatch
 */
export const uploadAllQuestions = async () => {
  // Xác nhận trước khi chạy để tránh bấm nhầm
  const confirmAction = window.confirm(`Bạn có chắc muốn nạp ${questionBank.length} câu hỏi lên Firestore không?`);
  if (!confirmAction) return;

  console.log("Bắt đầu quá trình nạp dữ liệu...");
  let successCount = 0;
  let errorCount = 0;

  try {
    // Duyệt qua từng câu hỏi trong file questionBank.js
    for (const q of questionBank) {
      try {
        // Sử dụng q.id làm ID của document để tránh trùng lặp khi nạp lại
        const qRef = doc(db, "questions", q.id);
        
        // Ghi dữ liệu xuống Firestore
        await setDoc(qRef, {
          ...q,
          updatedAt: new Date() // Lưu thêm thời gian cập nhật
        });
        
        successCount++;
        if (successCount % 50 === 0) {
          console.log(`Đang nạp... đã xong ${successCount} câu.`);
        }
      } catch (err) {
        console.error(`Lỗi tại câu ID ${q.id}:`, err);
        errorCount++;
      }
    }

    alert(`Hoàn tất! \n- Thành công: ${successCount} câu. \n- Lỗi: ${errorCount} câu.`);
  } catch (globalError) {
    console.error("Lỗi hệ thống khi nạp dữ liệu:", globalError);
    alert("Đã xảy ra lỗi nghiêm trọng, vui lòng kiểm tra console.");
  }
};
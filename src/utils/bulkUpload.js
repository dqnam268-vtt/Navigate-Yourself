import { db } from "../firebase";
import { doc, setDoc, getDocs, collection, deleteDoc } from "firebase/firestore";
import { questionBank } from "../data/questionBank"; 
import { explanations } from "../data/explanations"; // IMPORT FILE GIẢI THÍCH

export const uploadAllQuestions = async () => {
  const confirmAction = window.confirm(
    `CẢNH BÁO: Thao tác này sẽ xóa sạch dữ liệu cũ và nạp lại ${questionBank.length} câu mới KÈM GIẢI THÍCH. Tiếp tục?`
  );
  if (!confirmAction) return;

  console.log("Bắt đầu dọn dẹp dữ liệu cũ...");
  
  try {
    // 1. XÓA SẠCH DỮ LIỆU CŨ (Giữ nguyên logic cũ)
    const querySnapshot = await getDocs(collection(db, "questions"));
    let deleteCount = 0;
    for (const document of querySnapshot.docs) {
      await deleteDoc(doc(db, "questions", document.id));
      deleteCount++;
    }
    console.log(`Đã xóa ${deleteCount} câu cũ.`);

    // 2. NẠP DỮ LIỆU MỚI VÀ GHÉP NỐI GIẢI THÍCH
    console.log("Bắt đầu nạp dữ liệu mới...");
    let successCount = 0;
    let errorCount = 0;

    for (const q of questionBank) {
      try {
        const qRef = doc(db, "questions", q.id);
        
        // --- LOGIC GHÉP NỐI CHÍNH ---
        // Lấy giải thích từ file explanations.js dựa vào ID câu hỏi
        // Nếu không tìm thấy, sẽ gán câu mặc định.
        const explanationText = explanations[q.id] || "Chưa có giải thích chi tiết cho câu hỏi này.";

        await setDoc(qRef, {
          ...q, // Copy toàn bộ nội dung câu hỏi
          explanation: explanationText, // Chèn thêm trường giải thích
          updatedAt: new Date()
        });
        
        successCount++;
        if (successCount % 50 === 0) console.log(`Đang nạp... đã xong ${successCount} câu.`);
      } catch (err) {
        console.error(`Lỗi tại câu ID ${q.id}:`, err);
        errorCount++;
      }
    }

    alert(`HOÀN TẤT LÀM MỚI DỮ LIỆU!\n- Đã nạp thành công: ${successCount} câu kèm giải thích.\n- Lỗi: ${errorCount} câu.`);
    
  } catch (globalError) {
    console.error("Lỗi hệ thống:", globalError);
    alert("Đã xảy ra lỗi nghiêm trọng, vui lòng kiểm tra console (F12).");
  }
};
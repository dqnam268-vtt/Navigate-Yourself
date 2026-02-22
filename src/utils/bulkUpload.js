import { db } from "../firebase";
import { doc, setDoc, getDocs, collection, deleteDoc } from "firebase/firestore";
import { questionBank } from "../data/questionBank"; 
// 1. IMPORT FILE GIẢI THÍCH VÀO ĐÂY:
import { explanations } from "../data/explanations"; 

export const uploadAllQuestions = async () => {
  const confirmAction = window.confirm(
    `BẮT ĐẦU KÍCH HOẠT: Xóa dữ liệu cũ và nạp lại ${questionBank.length} câu KÈM GIẢI THÍCH. Thầy đã sẵn sàng?`
  );
  if (!confirmAction) return;

  console.log("Bắt đầu dọn dẹp dữ liệu cũ...");
  
  try {
    // Xóa sạch dữ liệu cũ trên Firebase
    const querySnapshot = await getDocs(collection(db, "questions"));
    for (const document of querySnapshot.docs) {
      await deleteDoc(doc(db, "questions", document.id));
    }

    console.log("Bắt đầu nạp dữ liệu mới có giải thích...");
    let successCount = 0;
    let errorCount = 0;

    for (const q of questionBank) {
      try {
        const qRef = doc(db, "questions", q.id);
        
        // 2. TÌM LỜI GIẢI THÍCH TƯƠNG ỨNG VỚI MÃ CÂU HỎI
        const explanationText = explanations[q.id] || "Đang cập nhật giải thích cho câu hỏi này...";

        // 3. ĐẨY LÊN FIREBASE
        await setDoc(qRef, {
          ...q, 
          explanation: explanationText, // Lệnh này tạo thêm 1 dòng "explanation" trên Firebase
          updatedAt: new Date()
        });
        
        successCount++;
      } catch (err) {
        console.error(`Lỗi tại câu ID ${q.id}:`, err);
        errorCount++;
      }
    }

    alert(`KÍCH HOẠT THÀNH CÔNG!\n- Đã nạp: ${successCount} câu kèm giải thích.`);
    
  } catch (globalError) {
    console.error("Lỗi hệ thống:", globalError);
    alert("Đã xảy ra lỗi, vui lòng kiểm tra console (F12).");
  }
};
import { db } from "../firebase";
import { doc, setDoc, getDocs, collection, deleteDoc } from "firebase/firestore";

// IMPORT 2 FILE TỪ THƯ MỤC DATA VÀO ĐÂY ĐỂ TRỘN
import { questionBank } from "../data/questionBank"; 
import { explanations } from "../data/explanations"; 

export const uploadAllQuestions = async () => {
  const confirmAction = window.confirm(
    `BẮT ĐẦU TRỘN DỮ LIỆU: Xóa câu hỏi cũ và nạp lại ${questionBank.length} câu KÈM GIẢI THÍCH. Thầy có chắc chắn không?`
  );
  if (!confirmAction) return;

  try {
    // 1. Dọn dẹp sạch Firebase cũ
    const querySnapshot = await getDocs(collection(db, "questions"));
    for (const document of querySnapshot.docs) {
      await deleteDoc(doc(db, "questions", document.id));
    }

    let successCount = 0;

    // 2. VÒNG LẶP ĐỂ TRỘN VÀ NẠP DỮ LIỆU
    for (const q of questionBank) {
      try {
        const qRef = doc(db, "questions", q.id);
        
        // ====================================================
        // ĐÂY CHÍNH LÀ 2 DÒNG CODE THỰC HIỆN VIỆC "TRỘN":
        // Dòng A: Lấy ID của câu hỏi hiện tại (q.id) đi tìm trong mảng explanations
        const explanationText = explanations[q.id] || "Đang cập nhật giải thích...";

        // Dòng B: Trộn chúng lại với nhau (...q là câu hỏi, explanation là phần mới thêm)
        await setDoc(qRef, {
          ...q, 
          explanation: explanationText, 
          updatedAt: new Date()
        });
        // ====================================================
        
        successCount++;
      } catch (err) {
        console.error(`Lỗi tại câu ID ${q.id}:`, err);
      }
    }

    alert(`TRỘN & KÍCH HOẠT THÀNH CÔNG!\n- Đã nạp: ${successCount} câu kèm giải thích lên Firebase.`);
    
  } catch (globalError) {
    console.error("Lỗi hệ thống:", globalError);
    alert("Đã xảy ra lỗi, vui lòng kiểm tra console (F12).");
  }
};
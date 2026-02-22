import { db } from "../firebase";
// Bổ sung thêm getDocs, collection, và deleteDoc để xóa dữ liệu cũ
import { doc, setDoc, getDocs, collection, deleteDoc } from "firebase/firestore";
import { questionBank } from "../data/questionBank"; 

export const uploadAllQuestions = async () => {
  // Đổi thông báo để cảnh báo người dùng về việc xóa dữ liệu
  const confirmAction = window.confirm(
    `CẢNH BÁO: Thao tác này sẽ XÓA SẠCH toàn bộ câu hỏi cũ trên hệ thống và nạp lại ${questionBank.length} câu mới. Bạn có chắc chắn không?`
  );
  if (!confirmAction) return;

  console.log("Bắt đầu dọn dẹp dữ liệu cũ...");
  
  try {
    // ==========================================
    // BƯỚC 1: XÓA TOÀN BỘ CÂU HỎI CŨ
    // ==========================================
    const querySnapshot = await getDocs(collection(db, "questions"));
    let deleteCount = 0;
    
    // Vòng lặp xóa từng document cũ
    for (const document of querySnapshot.docs) {
      await deleteDoc(doc(db, "questions", document.id));
      deleteCount++;
    }
    console.log(`Đã xóa sạch ${deleteCount} câu hỏi cũ.`);

    // ==========================================
    // BƯỚC 2: NẠP NGÂN HÀNG CÂU HỎI MỚI
    // ==========================================
    console.log("Bắt đầu nạp dữ liệu mới...");
    let successCount = 0;
    let errorCount = 0;

    for (const q of questionBank) {
      try {
        const qRef = doc(db, "questions", q.id);
        await setDoc(qRef, {
          ...q,
          updatedAt: new Date()
        });
        successCount++;
        
        // Báo cáo tiến độ ở console mỗi 50 câu
        if (successCount % 50 === 0) {
          console.log(`Đang nạp... đã xong ${successCount} câu.`);
        }
      } catch (err) {
        console.error(`Lỗi tại câu ID ${q.id}:`, err);
        errorCount++;
      }
    }

    // Thông báo tổng hợp sau khi hoàn tất
    alert(`HOÀN TẤT LÀM MỚI DỮ LIỆU!\n\n- Đã xóa: ${deleteCount} câu cũ.\n- Nạp thành công: ${successCount} câu mới.\n- Lỗi: ${errorCount} câu.`);
    
  } catch (globalError) {
    console.error("Lỗi hệ thống:", globalError);
    alert("Đã xảy ra lỗi nghiêm trọng, vui lòng kiểm tra console (F12).");
  }
};
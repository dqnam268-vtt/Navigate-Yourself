const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Khởi tạo quyền Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const deleteAllUsers = async (nextPageToken) => {
  console.log("Đang quét danh sách tài khoản...");
  try {
    // Lấy danh sách tài khoản (tối đa 1000 người mỗi lần quét)
    const listUsersResult = await admin.auth().listUsers(1000, nextPageToken);
    
    // Rút trích ra danh sách các mã UID để xóa
    const uids = listUsersResult.users.map((userRecord) => userRecord.uid);

    if (uids.length > 0) {
      // Lệnh xóa hàng loạt
      const deleteResult = await admin.auth().deleteUsers(uids);
      console.log(`✅ Đã xóa thành công ${deleteResult.successCount} tài khoản.`);
      if (deleteResult.failureCount > 0) {
        console.log(`❌ Có ${deleteResult.failureCount} tài khoản bị lỗi không xóa được.`);
      }
    }

    // Nếu danh sách quá dài, tự động lặp lại để xóa tiếp
    if (listUsersResult.pageToken) {
      await deleteAllUsers(listUsersResult.pageToken);
    } else {
      console.log("🎉 ĐÃ DỌN SẠCH BÓNG TÀI KHOẢN TRÊN FIREBASE!");
    }
  } catch (error) {
    console.log("❌ Lỗi hệ thống:", error);
  }
};

// Chạy lệnh xóa
deleteAllUsers();
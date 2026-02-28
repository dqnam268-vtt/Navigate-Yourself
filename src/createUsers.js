const admin = require('firebase-admin');
const fs = require('fs'); // Thư viện có sẵn của Node.js để tạo file
const serviceAccount = require('./serviceAccountKey.json');

// Khởi tạo quyền Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Hàm tạo mật khẩu: đúng 4 số và 2 chữ cái thường
function generateRandomPassword() {
  const digits = '0123456789';
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  let pwdArray = [];

  // 1. Rút ngẫu nhiên 4 số
  for (let i = 0; i < 4; i++) {
    pwdArray.push(digits[Math.floor(Math.random() * digits.length)]);
  }
  // 2. Rút ngẫu nhiên 2 chữ cái thường
  for (let i = 0; i < 2; i++) {
    pwdArray.push(letters[Math.floor(Math.random() * letters.length)]);
  }

  // 3. Đảo lộn ngẫu nhiên vị trí của 6 ký tự này để bảo mật hơn
  pwdArray = pwdArray.sort(() => Math.random() - 0.5);

  // Ghép mảng lại thành 1 chuỗi chữ (Ví dụ: "4b8a12")
  return pwdArray.join('');
}

const createBulkUsers = async () => {
  console.log("🚀 Bắt đầu tạo tài khoản hàng loạt...");
  
  // Tạo tiêu đề cột cho file Excel
  let csvContent = "STT,Email Dang Nhap,Mat Khau\n"; 

  // Vòng lặp tạo 50 học sinh (tùy chỉnh số 50 thành số lượng thầy muốn)
  for (let i = 1; i <= 50; i++) {
    let id = i.toString().padStart(2, '0'); 
    let userEmail = `student${id}@edu.vn`;
    let userPassword = generateRandomPassword(); // Gọi hàm sinh mật khẩu ở trên

    try {
      // Đẩy lên Firebase
      await admin.auth().createUser({
        email: userEmail,
        password: userPassword,
      });
      console.log(`✅ Đã tạo: ${userEmail} | Pass: ${userPassword}`);
      
      // Ghi nhớ dữ liệu người này vào file
      csvContent += `${i},${userEmail},${userPassword}\n`;

    } catch (error) {
      console.log(`❌ Lỗi khi tạo ${userEmail}:`, error.message);
    }
  }
  
  // Cuối cùng: Tạo và lưu file CSV ra ngoài thư mục
  try {
    // Lưu với file tên là "DanhSachHocSinh.csv"
    fs.writeFileSync('DanhSachHocSinh.csv', csvContent, 'utf8');
    console.log("\n🎉 HOÀN TẤT!");
    console.log("👉 Đã tạo thành công file 'DanhSachHocSinh.csv' trong thư mục của thầy.");
    console.log("👉 Thầy hãy mở file đó bằng Excel để in ra phát cho học sinh nhé!");
  } catch (err) {
    console.log("Lỗi tạo file Excel:", err);
  }
};

// Kích hoạt chạy
createBulkUsers();
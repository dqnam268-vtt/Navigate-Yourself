const admin = require('firebase-admin');
const fs = require('fs');
const serviceAccount = require('./serviceAccountKey.json');

// Khởi tạo quyền Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

// Hàm tạo mật khẩu ngẫu nhiên: 4 số và 2 chữ cái thường
function generateRandomPassword() {
  const digits = '0123456789';
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  let pwdArray = [];

  // Rút ngẫu nhiên 4 số
  for (let i = 0; i < 4; i++) {
    pwdArray.push(digits[Math.floor(Math.random() * digits.length)]);
  }
  // Rút ngẫu nhiên 2 chữ cái thường
  for (let i = 0; i < 2; i++) {
    pwdArray.push(letters[Math.floor(Math.random() * letters.length)]);
  }

  // Đảo lộn ngẫu nhiên vị trí của 6 ký tự
  pwdArray = pwdArray.sort(() => Math.random() - 0.5);

  return pwdArray.join('');
}

const createBulkUsers = async () => {
  console.log("🚀 Bắt đầu tạo 80 tài khoản hàng loạt...");
  
  // Tạo tiêu đề cột cho file Excel
  let csvContent = "STT,Email Dang Nhap,Mat Khau\n"; 

  // Vòng lặp tạo 80 học sinh (từ 1 đến 80)
  for (let i = 1; i <= 80; i++) {
    let id = i.toString().padStart(2, '0'); // Tạo đuôi 01, 02... 80
    let userEmail = `student${id}@edu.vn`;
    let userPassword = generateRandomPassword(); 

    try {
      // Đẩy lên Firebase
      await admin.auth().createUser({
        email: userEmail,
        password: userPassword,
      });
      console.log(`✅ Đã tạo: ${userEmail} | Pass: ${userPassword}`);
      
      // Ghi nhớ dữ liệu vào biến
      csvContent += `${i},${userEmail},${userPassword}\n`;

    } catch (error) {
      console.log(`❌ Lỗi khi tạo ${userEmail}:`, error.message);
    }
  }
  
  // Xuất file CSV
  try {
    fs.writeFileSync('DanhSachHocSinh.csv', csvContent, 'utf8');
    console.log("\n🎉 HOÀN TẤT!");
    console.log("👉 Đã tạo thành công file 'DanhSachHocSinh.csv' chứa 80 tài khoản.");
  } catch (err) {
    console.log("Lỗi tạo file Excel:", err);
  }
};

// Kích hoạt chạy
createBulkUsers();
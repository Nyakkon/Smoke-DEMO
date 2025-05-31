# Hướng dẫn Thiết lập và Sử dụng Tính năng Theo dõi Hoạt động Người dùng

## 🚀 Khởi động Hệ thống

### 1. Khởi động Server
```bash
# Mở terminal và chạy:
cd server
npm start

# Hoặc sử dụng file batch:
start-server-user-activity.bat
```

### 2. Khởi động Client
```bash
# Mở terminal khác và chạy:
cd client
npm start
```

### 3. Kiểm tra kết nối
```bash
# Test server connection:
node simple-test-connection.js

# Test user activity endpoints:
node test-user-activity-endpoint.js
```

## 📊 Tính năng Theo dõi Hoạt động Người dùng

### Các API Endpoints đã triển khai:

1. **`GET /api/admin/user-activity`**
   - Dữ liệu người dùng trong quá trình cai thuốc
   - Người dùng cần hỗ trợ
   - Thống kê huy hiệu/thành tích
   - Tỷ lệ thành công
   - Hiệu suất coach

2. **`GET /api/admin/system-overview`**
   - Tổng quan hệ thống
   - Số liệu thành viên
   - Hoạt động gần đây
   - Cảnh báo hệ thống

3. **`GET /api/admin/user-progress-analysis/:userId`**
   - Phân tích chi tiết tiến trình người dùng
   - Lịch sử kế hoạch cai thuốc
   - Dữ liệu theo dõi tiến trình
   - Thành tích đã đạt được

### Frontend Component:

**`UserActivityTracking.jsx`** - Component React với 5 tab chính:

1. **Tổng quan Hệ thống** - Metrics tổng thể và cảnh báo
2. **Người dùng trong Quá trình Cai thuốc** - Danh sách và tiến trình
3. **Người dùng Cần Hỗ trợ** - Ưu tiên can thiệp
4. **Thống kê Thành tích** - Tỷ lệ đạt huy hiệu
5. **Tỷ lệ Thành công** - Hiệu suất tổng thể và theo coach

## 🔐 Đăng nhập Admin

### Thông tin đăng nhập:
- **Email:** admin@example.com
- **Password:** H12345678@

### Truy cập tính năng:
1. Đăng nhập vào Admin Dashboard
2. Click menu "Theo dõi hoạt động" 
3. Xem các tab khác nhau để theo dõi hoạt động

## 📈 Các Tính năng Chính

### 1. Theo dõi Người dùng trong Quá trình Cai thuốc
- **Trạng thái tiến trình:** Hiển thị % hoàn thành
- **Ngày cai thuốc:** Số ngày đã trải qua
- **Coach phụ trách:** Thông tin coach được gán
- **Trạng thái hỗ trợ:** Stable/High Craving/Recent Smoking/etc.

### 2. Hệ thống Ưu tiên Hỗ trợ
- **Critical:** Mức thèm thuốc ≥9 hoặc hút >10 điếu/ngày
- **High:** Mức thèm thuốc ≥7 hoặc có hút thuốc gần đây
- **Medium:** Không theo dõi >7 ngày hoặc không đăng nhập >14 ngày
- **Low:** Các trường hợp khác cần quan tâm

### 3. Thống kê Thành tích
- **Tỷ lệ đạt huy hiệu:** % người dùng đạt từng loại huy hiệu
- **Thống kê theo thời gian:** Xu hướng đạt thành tích
- **Phân tích hiệu quả:** Đánh giá động lực người dùng

### 4. Phân tích Tỷ lệ Thành công
- **Tổng thể:** Tỷ lệ hoàn thành kế hoạch cai thuốc
- **Theo thời gian:** Ngắn hạn/Trung hạn/Dài hạn
- **Theo coach:** Hiệu suất từng coach
- **Xu hướng hàng tháng:** Biểu đồ tiến triển

## 🔧 Khắc phục Sự cố

### Lỗi kết nối Server:
```bash
# Kiểm tra server có chạy không:
node simple-test-connection.js

# Nếu lỗi, khởi động lại server:
cd server
npm start
```

### Lỗi 401 Unauthorized:
- Kiểm tra token admin trong localStorage
- Đăng nhập lại với tài khoản admin
- Kiểm tra middleware auth trong server

### Lỗi 404 Not Found:
- Kiểm tra routes đã được import trong server/src/index.js
- Xác nhận endpoint URL đúng format
- Kiểm tra database connection

### Lỗi Frontend:
```bash
# Clear cache và restart:
cd client
npm start

# Kiểm tra console browser để xem lỗi chi tiết
```

## 📝 Dữ liệu Mẫu

Hệ thống đã có sẵn dữ liệu mẫu:
- **Users:** admin, member, coach accounts
- **QuitPlans:** Kế hoạch cai thuốc mẫu
- **ProgressTracking:** Dữ liệu theo dõi tiến trình
- **Achievements:** Huy hiệu và thành tích
- **CoachFeedback:** Đánh giá coach

## 🎯 Mục tiêu Đạt được

✅ **Backend APIs hoàn chỉnh** - 3 endpoints với SQL queries phức tạp
✅ **Frontend Component đầy đủ** - 5 tabs với UI/UX hiện đại  
✅ **Tích hợp AdminDashboard** - Menu và routing hoàn chỉnh
✅ **Responsive Design** - Tương thích mobile và desktop
✅ **Real-time Analytics** - Dữ liệu cập nhật theo thời gian thực
✅ **Priority System** - Hệ thống ưu tiên hỗ trợ thông minh
✅ **Coach Performance** - Theo dõi hiệu suất coach chi tiết

## 📞 Hỗ trợ

Nếu gặp vấn đề, hãy:
1. Kiểm tra console logs (browser và server)
2. Xem file `USER_ACTIVITY_TRACKING_GUIDE.md` để biết thêm chi tiết
3. Test từng endpoint riêng lẻ với script test
4. Kiểm tra database connection và dữ liệu mẫu

---

**Giai đoạn 3: Theo dõi hoạt động người dùng** đã được triển khai hoàn chỉnh! 🎉 
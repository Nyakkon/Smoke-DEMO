# 📊 Hướng dẫn sử dụng chức năng Theo dõi hoạt động người dùng

## Tổng quan

Chức năng **Theo dõi hoạt động người dùng** được thiết kế để giúp admin quản lý và giám sát hiệu quả hoạt động của hệ thống cai thuốc lá. Chức năng này cung cấp cái nhìn tổng quan về:

- Người dùng đang trong tiến trình cai thuốc
- Người dùng cần hỗ trợ khẩn cấp
- Thống kê huy hiệu và thành tích
- Tỷ lệ thành công của hệ thống
- Hiệu suất của các coach

## Cách truy cập

1. Đăng nhập vào hệ thống với quyền admin
2. Vào **Admin Dashboard**
3. Chọn **"Theo dõi hoạt động"** trong menu bên trái

## Các tab chính

### 1. 🏠 Tổng quan hệ thống

**Mục đích**: Cung cấp cái nhìn tổng quan về tình trạng hoạt động của toàn hệ thống.

**Thông tin hiển thị**:
- **Tổng số thành viên**: Số lượng người dùng đã đăng ký
- **Kế hoạch cai thuốc active**: Số kế hoạch đang được thực hiện
- **Người dùng theo dõi tiến trình**: Số người đang ghi nhật ký tiến trình
- **Huy hiệu đạt được**: Số achievement được mở khóa trong 7 ngày qua

**Cảnh báo quan trọng**:
- 🔴 **Mức thèm thuốc cao**: Người dùng có mức thèm thuốc ≥ 8/10
- 🟠 **Hút thuốc gần đây**: Người dùng đã hút thuốc trong 3 ngày qua

**Doanh thu**:
- Tổng doanh thu 30 ngày gần nhất
- Số giao dịch đã được xác nhận

### 2. 👥 Người dùng trong tiến trình

**Mục đích**: Theo dõi tất cả người dùng đang có kế hoạch cai thuốc active.

**Thông tin cho mỗi người dùng**:
- **Thông tin cá nhân**: Tên, email, avatar
- **Tiến trình cai thuốc**: 
  - Số ngày đã cai được
  - Thanh tiến trình (% hoàn thành)
  - Số ngày còn lại đến mục tiêu
- **Trạng thái hỗ trợ**:
  - 🟢 **Stable**: Tình trạng ổn định
  - 🟡 **Inactive Tracking**: Không ghi nhật ký > 7 ngày
  - 🟠 **Recent Smoking**: Hút thuốc trong 3 ngày qua
  - 🟣 **Not Logging In**: Không đăng nhập > 14 ngày
  - 🔴 **High Craving**: Mức thèm thuốc ≥ 8/10
- **Coach phụ trách**: Tên coach được gán (nếu có)
- **Tiến trình gần đây**: Số điếu hút và mức thèm thuốc mới nhất

**Hành động có thể thực hiện**:
- 👁️ **Xem chi tiết**: Phân tích sâu về tiến trình của người dùng

### 3. ⚠️ Cần hỗ trợ

**Mục đích**: Xác định và ưu tiên hỗ trợ những người dùng đang gặp khó khăn.

**Mức độ ưu tiên**:
- 🔴 **Critical**: 
  - Mức thèm thuốc ≥ 9/10
  - Hút > 10 điếu trong ngày vừa qua
- 🟠 **High**: 
  - Mức thèm thuốc ≥ 7/10
  - Hút thuốc trong 3 ngày qua
- 🟡 **Medium**: 
  - Không ghi nhật ký > 7 ngày
  - Không đăng nhập > 14 ngày
- 🟢 **Low**: Các trường hợp khác

**Lý do cần hỗ trợ**:
- Mức thèm thuốc cao (với điểm cụ thể)
- Hút thuốc gần đây (với số điếu cụ thể)
- Không theo dõi tiến trình (với số ngày cụ thể)
- Không đăng nhập hệ thống (với số ngày cụ thể)
- Động lực thấp (≤ 3/10)

**Khuyến nghị hành động**:
- Liên hệ trực tiếp qua điện thoại
- Gửi email động viên
- Gán coach hỗ trợ (nếu chưa có)
- Tăng cường tương tác qua chat

### 4. 🏆 Thống kê huy hiệu

**Mục đích**: Phân tích hiệu quả của hệ thống achievement và động lực người dùng.

**Thông tin hiển thị**:
- **Tên huy hiệu**: Tên và mô tả achievement
- **Điều kiện**: Milestone cần đạt (ngày hoặc tiền tiết kiệm)
- **Số lần đạt được**: Tổng số người đã mở khóa
- **Tỷ lệ đạt được**: % người dùng đã đạt được so với tổng số
- **Thanh tiến trình**: Hiển thị trực quan tỷ lệ đạt được

**Phân tích**:
- Achievement nào dễ đạt nhất (tỷ lệ cao)
- Achievement nào khó nhất (tỷ lệ thấp)
- Xu hướng mở khóa achievement theo thời gian

### 5. 📈 Tỷ lệ thành công

**Mục đích**: Đánh giá hiệu quả tổng thể của hệ thống và từng coach.

**Thống kê tổng thể**:
- **Tỷ lệ thành công chung**: % kế hoạch hoàn thành thành công
- **Thời gian hoàn thành trung bình**: Số ngày TB để hoàn thành kế hoạch

**Phân loại theo thời gian**:
- **Ngắn hạn** (≤ 30 ngày): Tỷ lệ thành công cho mục tiêu ngắn hạn
- **Trung hạn** (31-90 ngày): Tỷ lệ thành công cho mục tiêu trung hạn  
- **Dài hạn** (> 90 ngày): Tỷ lệ thành công cho mục tiêu dài hạn

**Hiệu suất Coach**:
- **Kế hoạch được giao**: Tổng số kế hoạch coach phụ trách
- **Đang active**: Số kế hoạch hiện tại đang thực hiện
- **Hoàn thành**: Số kế hoạch đã hoàn thành thành công
- **Tỷ lệ thành công**: % thành công của từng coach
- **Đánh giá trung bình**: Rating từ feedback của member
- **Kế hoạch mới**: Số kế hoạch mới được giao trong 30 ngày

## Chi tiết người dùng

Khi click **"Chi tiết"** cho bất kỳ người dùng nào, sẽ hiển thị modal với thông tin đầy đủ:

### Thông tin cơ bản
- Email, ngày tham gia, đăng nhập cuối
- Gói membership hiện tại

### Thống kê tiến trình
- 📊 **Ngày theo dõi**: Tổng số ngày đã ghi nhật ký
- 🚭 **Ngày không hút**: Số ngày smoke-free
- 💰 **Tiền tiết kiệm**: Tổng số tiền đã tiết kiệm được
- 😤 **Mức thèm trung bình**: Mức thèm thuốc TB (/10)

### Huy hiệu đạt được
- Danh sách các achievement đã mở khóa
- Thời gian đạt được từng achievement

### Lịch sử kế hoạch cai thuốc
- Timeline các kế hoạch đã tạo
- Trạng thái từng kế hoạch (hoàn thành/đang thực hiện/đã hủy)
- Coach phụ trách và mức động lực ban đầu

## API Endpoints

### 1. Lấy tổng quan hệ thống
```
GET /api/admin/system-overview
```

### 2. Lấy dữ liệu theo dõi hoạt động
```
GET /api/admin/user-activity
```

### 3. Phân tích chi tiết người dùng
```
GET /api/admin/user-progress-analysis/:userId
```

## Cách sử dụng hiệu quả

### Quy trình kiểm tra hàng ngày

1. **Kiểm tra tổng quan** (5 phút):
   - Xem số liệu tổng thể
   - Chú ý các cảnh báo đỏ

2. **Xử lý người dùng cần hỗ trợ** (15-30 phút):
   - Ưu tiên Critical và High
   - Liên hệ trực tiếp các trường hợp khẩn cấp
   - Gán coach cho người chưa có

3. **Theo dõi tiến trình** (10 phút):
   - Kiểm tra người dùng có tiến trình bất thường
   - Chúc mừng những thành tích mới

### Quy trình kiểm tra hàng tuần

1. **Phân tích tỷ lệ thành công**:
   - So sánh với tuần trước
   - Xác định xu hướng tăng/giảm

2. **Đánh giá hiệu suất coach**:
   - Xem xét tỷ lệ thành công của từng coach
   - Hỗ trợ coach có hiệu suất thấp

3. **Phân tích achievement**:
   - Xem achievement nào ít được đạt
   - Cân nhắc điều chỉnh điều kiện

### Quy trình kiểm tra hàng tháng

1. **Báo cáo tổng thể**:
   - Xuất báo cáo số liệu key metrics
   - So sánh với tháng trước

2. **Tối ưu hệ thống**:
   - Điều chỉnh achievement dựa trên tỷ lệ đạt được
   - Cải thiện quy trình hỗ trợ người dùng

## Lưu ý quan trọng

### Bảo mật
- Chỉ admin mới có quyền truy cập
- Thông tin cá nhân được bảo vệ theo quy định

### Hiệu suất
- Dữ liệu được cache để tối ưu tốc độ
- Tự động refresh mỗi 5 phút

### Hỗ trợ
- Mobile responsive để xem trên điện thoại
- Export dữ liệu dưới dạng Excel/PDF (tính năng tương lai)

## Troubleshooting

### Không tải được dữ liệu
1. Kiểm tra kết nối internet
2. Đăng nhập lại với quyền admin
3. Liên hệ kỹ thuật nếu vấn đề kéo dài

### Dữ liệu không chính xác
1. Kiểm tra múi giờ hệ thống
2. Xác nhận database đã đồng bộ
3. Refresh trang và thử lại

### Hiệu suất chậm
1. Kiểm tra số lượng người dùng trong hệ thống
2. Áp dụng filter để giảm kích thước dữ liệu
3. Liên hệ để tối ưu database

---

**Lưu ý**: Tài liệu này sẽ được cập nhật khi có tính năng mới. Vui lòng kiểm tra phiên bản mới nhất trước khi sử dụng. 
# Cập Nhật Tính Toán Tiền Tiết Kiệm

## 📋 Tổng Quan

Hệ thống đã được cập nhật để tính toán tiền tiết kiệm chính xác hơn, dựa trên dữ liệu thực tế thay vì sử dụng dữ liệu demo cứng.

## 🔄 Những Thay Đổi Chính

### 1. Công Thức Tính Toán Mới

**Trước:**
- Giá mỗi điếu: 5,000 VNĐ (không thực tế)
- Baseline: 20 điếu/ngày (cố định)
- Dữ liệu demo cứng

**Sau:**
- Giá mỗi điếu: 1,500 VNĐ (chuẩn thị trường VN)
- Baseline: Từ survey câu hỏi số 2, mặc định 10 điếu/ngày
- Tính toán thực tế từ dữ liệu user

### 2. Nguồn Dữ Liệu Baseline

Hệ thống sẽ tự động lấy baseline theo thứ tự ưu tiên:

1. **SmokingStatus table** (nếu đã cập nhật)
2. **Survey câu hỏi số 2** ("Trung bình mỗi ngày bạn hút bao nhiêu điếu?")
3. **UserSurvey table** (dữ liệu survey tổng hợp)
4. **Giá trị mặc định**: 10 điếu/ngày (nửa gói)

### 3. Chuẩn Thị Trường Việt Nam

```
1 gói thuốc = 20 điếu = 30,000 VNĐ
→ 1 điếu = 1,500 VNĐ

Baseline trung bình = 10 điếu/ngày (nửa gói)
→ Chi phí tiềm năng = 15,000 VNĐ/ngày
```

## 💡 Công Thức Tính Toán

```javascript
// Tiền tiết kiệm hàng ngày
const cigarettesNotSmoked = Math.max(0, baselineCigarettesPerDay - cigarettesSmoked);
const moneySaved = cigarettesNotSmoked * cigarettePrice;

// Ví dụ:
// Baseline: 10 điếu/ngày
// Hút thực tế: 3 điếu
// Tiết kiệm: (10 - 3) × 1,500 = 10,500 VNĐ
```

## 🚀 Cách Sử Dụng

### 1. Chạy Script Cập Nhật Dữ Liệu Hiện Tại

```bash
node update-savings-calculation.js
```

Script này sẽ:
- Quét tất cả user có dữ liệu progress
- Lấy baseline từ survey/smoking status
- Tính lại tiền tiết kiệm cho tất cả entries
- Tự động tạo SmokingStatus từ dữ liệu survey

### 2. Test Tính Toán

```bash
node test-savings-calculation.js
```

Script test sẽ:
- Tạo user test với và không có survey data
- Kiểm tra tính toán trong nhiều trường hợp
- So sánh công thức cũ vs mới
- Dọn dẹp dữ liệu test

## 📊 Ví Dụ Tính Toán

### Trường Hợp 1: User Có Survey Data (20 điếu/ngày)

| Điếu Hút | Điếu Tiết Kiệm | Tiền Tiết Kiệm |
|----------|----------------|----------------|
| 0        | 20             | 30,000 VNĐ     |
| 5        | 15             | 22,500 VNĐ     |
| 10       | 10             | 15,000 VNĐ     |
| 15       | 5              | 7,500 VNĐ      |
| 20       | 0              | 0 VNĐ          |

### Trường Hợp 2: User Không Có Survey (10 điếu/ngày - mặc định)

| Điếu Hút | Điếu Tiết Kiệm | Tiền Tiết Kiệm |
|----------|----------------|----------------|
| 0        | 10             | 15,000 VNĐ     |
| 3        | 7              | 10,500 VNĐ     |
| 5        | 5              | 7,500 VNĐ      |
| 10       | 0              | 0 VNĐ          |

### Tính Toán Theo Thời Gian (Smoke-free hoàn toàn từ 20 điếu/ngày)

| Thời Gian | Tiết Kiệm      |
|-----------|----------------|
| 1 ngày    | 30,000 VNĐ     |
| 1 tuần    | 210,000 VNĐ    |
| 1 tháng   | 900,000 VNĐ    |
| 3 tháng   | 2,700,000 VNĐ  |
| 1 năm     | 10,950,000 VNĐ |

## 🔧 API Endpoints Được Cập Nhật

### 1. `POST /api/progress`
- Tự động lấy baseline từ survey
- Tạo SmokingStatus nếu chưa có
- Tính toán với công thức mới

### 2. `GET /api/progress/summary`
- Sử dụng giá chuẩn 1,500 VNĐ/điếu
- Tính lại tổng tiền tiết kiệm

### 3. `GET /api/progress/savings`
- Hiển thị chi tiết tính toán
- Thông tin về nguồn dữ liệu baseline
- So sánh tiềm năng vs thực tế

### 4. `GET /api/progress/public-summary`
- Không còn dùng dữ liệu demo cứng
- Tính toán thực tế hoặc demo có logic

## 🎯 Lợi Ích

### 1. Tính Toán Chính Xác
- Dựa trên thói quen thực tế của user
- Giá cả phù hợp với thị trường VN
- Không còn dữ liệu demo cứng

### 2. Tự Động Hóa
- Lấy dữ liệu từ survey tự động
- Tạo smoking status khi cần
- Cập nhật tiền tiết kiệm real-time

### 3. Linh Hoạt
- Hỗ trợ user có và không có survey
- Fallback thông minh với giá trị mặc định
- Dễ dàng điều chỉnh công thức

### 4. Động Lực Cao Hơn
- Số liệu thực tế, không phóng đại
- Phản ánh đúng progress của user
- Khuyến khích theo dõi hàng ngày

## 🚨 Lưu Ý Quan Trọng

1. **Backup Database**: Chạy backup trước khi cập nhật
2. **Test Kỹ**: Chạy test script trước khi deploy
3. **Thông Báo User**: Giải thích thay đổi cho users
4. **Monitor**: Theo dõi phản hồi sau khi cập nhật

## 📝 Migration Steps

1. **Backup dữ liệu hiện tại**
2. **Deploy code mới**
3. **Chạy update script**
4. **Test các API endpoints**
5. **Verify dữ liệu**
6. **Thông báo completion**

## 🔍 Troubleshooting

### Vấn Đề: User không có dữ liệu survey
**Giải pháp**: Hệ thống tự động dùng baseline mặc định 10 điếu/ngày

### Vấn Đề: Tiền tiết kiệm hiển thị 0
**Kiểm tra**: 
- User có smoking status chưa?
- Có dữ liệu progress tracking chưa?
- Baseline có hợp lý không?

### Vấn Đề: Số liệu không khớp với cũ
**Lý do**: Công thức mới chính xác hơn, dựa trên dữ liệu thực

## 📞 Support

Nếu có vấn đề trong quá trình cập nhật, liên hệ team development để được hỗ trợ.

---

✅ **Cập nhật hoàn thành**: Hệ thống giờ đây tính toán tiền tiết kiệm chính xác, dựa trên dữ liệu thực tế của từng user thay vì sử dụng demo data cố định. 
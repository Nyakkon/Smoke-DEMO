# 🔧 Logic Ưu tiên Cải thiện cho User Activity Tracking

## ❌ Vấn đề Logic Hiện tại

**Không hợp lý:**
- User hút 1 điếu/ngày = "High Priority"  
- User không đăng nhập 30 ngày = "Medium Priority"

→ **User có thể đã bỏ cuộc hoàn toàn nhưng lại được ưu tiên thấp hơn!**

## ✅ Logic Ưu tiên Cải thiện

### 🔴 **CRITICAL** (Cần can thiệp ngay)
1. **Người bỏ cuộc hoàn toàn:**
   - Không đăng nhập > 21 ngày
   - Không cập nhật tiến trình > 14 ngày + mức thèm cao

2. **Tình trạng xấu đi nhanh:**
   - Hút > 10 điếu/ngày (tăng so với trước)
   - Mức thèm ≥ 9/10

### 🟠 **HIGH** (Ưu tiên cao)
1. **Có dấu hiệu tụt lùi:**
   - Hút thuốc sau ≥ 3 ngày không hút
   - Mức thèm tăng đột ngột (≥ 7 sau khi < 5)
   - Không đăng nhập > 14 ngày (có thể đang tránh)

2. **Khó khăn nghiêm trọng:**
   - Mức thèm 7-8/10 liên tục > 3 ngày
   - Hút 5-10 điếu/ngày liên tục

### 🟡 **MEDIUM** (Theo dõi thường xuyên)
1. **Tiến triển chậm:**
   - Hút 1-4 điếu/ngày (đang cải thiện)
   - Mức thèm 4-6/10 ổn định
   - Không cập nhật 7-14 ngày (nhưng vẫn đăng nhập)

2. **Cần khuyến khích:**
   - Động lực thấp (≤ 3/10)
   - Không đạt milestone theo kế hoạch

### 🟢 **LOW** (Theo dõi định kỳ)
1. **Ổn định tốt:**
   - Không hút > 7 ngày
   - Mức thèm ≤ 3/10
   - Cập nhật đều đặn

## 📊 Cải thiện SQL Query

```sql
CASE 
    -- CRITICAL: Nguy cơ bỏ cuộc cao
    WHEN u.LastLoginAt < DATEADD(day, -21, GETDATE()) THEN 'Critical'
    WHEN pt.Date < DATEADD(day, -14, GETDATE()) AND pt.CravingLevel >= 7 THEN 'Critical'
    WHEN pt.CigarettesSmoked > 10 AND pt.Date >= DATEADD(day, -1, GETDATE()) THEN 'Critical'
    WHEN pt.CravingLevel >= 9 THEN 'Critical'
    
    -- HIGH: Có dấu hiệu tụt lùi  
    WHEN u.LastLoginAt < DATEADD(day, -14, GETDATE()) THEN 'High'
    WHEN pt.CravingLevel >= 7 AND pt.Date >= DATEADD(day, -3, GETDATE()) THEN 'High'
    WHEN pt.CigarettesSmoked >= 5 AND pt.Date >= DATEADD(day, -3, GETDATE()) THEN 'High'
    
    -- MEDIUM: Cần theo dõi
    WHEN pt.CigarettesSmoked BETWEEN 1 AND 4 AND pt.Date >= DATEADD(day, -3, GETDATE()) THEN 'Medium'
    WHEN pt.CravingLevel BETWEEN 4 AND 6 THEN 'Medium'
    WHEN pt.Date < DATEADD(day, -7, GETDATE()) THEN 'Medium'
    
    -- LOW: Ổn định
    ELSE 'Low'
END as Priority
```

## 🎯 Lợi ích Logic Mới

1. **Ưu tiên đúng người cần hỗ trợ gấp nhất**
2. **Không bỏ sót những người đã bỏ cuộc**  
3. **Khuyến khích người đang cải thiện**
4. **Phân bổ nguồn lực coach hiệu quả hơn**

## 📈 Kết quả Mong đợi

- **Tăng retention rate:** Can thiệp kịp thời người có nguy cơ bỏ cuộc
- **Giảm workload coach:** Tập trung vào cases thực sự cần hỗ trợ
- **Cải thiện user experience:** Hỗ trợ đúng lúc, đúng mức độ 
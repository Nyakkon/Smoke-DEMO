# 🔍 DEBUG GUIDE: Kế hoạch mẫu không hiển thị

## Vấn đề hiện tại
- Phần "Kế hoạch mẫu" không xuất hiện trên trang QuitPlanPage
- Logic hiển thị đã có sẵn nhưng không hoạt động

## ✅ Đã thực hiện
1. ✅ Tạo PlanTemplates table với 4 phases cho Premium Plan
2. ✅ Thêm API `/api/quit-plan/templates/all` 
3. ✅ Cập nhật logic backend để include templates
4. ✅ Thêm debug logging vào frontend
5. ✅ Thêm fallback loading templates cho debug
6. ✅ Cập nhật field names để tương thích

## 🔧 Debug logs đã thêm
- Console.log trong QuitPlanPage.jsx để track:
  - planTemplate state
  - paymentInfo state  
  - Template display condition
  - API responses

## 🧪 Cách debug tiếp theo

### 1. Kiểm tra Browser Console
```javascript
// Mở Developer Tools (F12) và check:
// 1. Network tab - xem API calls
// 2. Console tab - xem debug logs
```

### 2. Test API trực tiếp
```bash
# Test templates API
curl http://localhost:4000/api/quit-plan/templates/all
```

### 3. Check database
```sql
-- Kiểm tra PlanTemplates có data không
SELECT * FROM PlanTemplates;

-- Kiểm tra MembershipPlans
SELECT * FROM MembershipPlans;
```

### 4. Test với user có payment
```sql
-- Tạo test user với payment
INSERT INTO Users (Username, Email, Password, Role, IsActive, IsActivated)
VALUES ('testtemplate', 'test@test.com', 'hash', 'member', 1, 1);

INSERT INTO Payments (UserID, PlanID, Amount, Status, PaymentDate)
VALUES (USER_ID, 2, 299000, 'confirmed', GETDATE());
```

## 🎯 Expected behavior
Khi user có payment confirmed cho Premium Plan (PlanID = 2), sẽ thấy:

```jsx
<Card title="Kế hoạch mẫu - Premium Plan" className="mb-4">
  // 4 phases hiển thị
</Card>
```

## 🔍 Debug checklist
- [ ] Server đang chạy (localhost:4000)
- [ ] Database có PlanTemplates data
- [ ] User có payment confirmed 
- [ ] API `/api/quit-plan` trả về planTemplate
- [ ] Frontend planTemplate state không null/empty
- [ ] Console.log hiển thị template data

## 🚨 Fallback debug
Đã thêm code để load templates ngay cả khi không có auth:
- Tìm "Premium Plan (Debug)" trong title
- Check console logs với prefix "🔧 DEBUG"

## 📂 Files đã sửa
- `client/src/pages/QuitPlanPage.jsx` - Added debug logs
- `server/src/routes/quitPlan.routes.js` - Template queries  
- `server/check-and-setup-templates.js` - Template data
- `test-template-quick.js` - Test script

## 💡 Nếu vẫn không work
1. Check browser cache - Ctrl+Shift+R để hard refresh
2. Verify server logs có API calls
3. Check database connection
4. Test với user account khác

Run debug script: `node test-template-quick.js` 
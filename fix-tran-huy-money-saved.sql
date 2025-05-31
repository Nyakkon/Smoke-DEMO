-- Fix money saved data for Tran Huy (UserID = 6)
-- Delete existing fake data first
DELETE FROM ProgressTracking WHERE UserID = 6;

-- Insert correct data with proper MoneySaved calculation
-- Logic: baseline 10 cigarettes/day × 1500 VNĐ/cigarette = 15,000 VNĐ/day budget
-- MoneySaved = (10 - actual cigarettes smoked) × 1500 VNĐ per day

INSERT INTO ProgressTracking (UserID, Date, CigarettesSmoked, CravingLevel, EmotionNotes, MoneySaved, DaysSmokeFree, HealthNotes, CreatedAt) 
VALUES 
-- Day 1: 2 cigarettes → (10-2) × 1500 = 12,000 VNĐ saved
(6, '2025-05-30', 2, 4, N'Cảm thấy khá tốt, chỉ thèm nhẹ', 12000, 0, N'Hơi thở tốt hơn', GETDATE()),

-- Day 2: 1 cigarette → (10-1) × 1500 = 13,500 VNĐ saved  
(6, '2025-05-29', 1, 3, N'Giảm được 1 điếu so với hôm qua', 13500, 0, N'Ít ho hơn', GETDATE()),

-- Day 3: 0 cigarettes → (10-0) × 1500 = 15,000 VNĐ saved
(6, '2025-05-28', 0, 2, N'Tuyệt vời! Không hút điếu nào', 15000, 1, N'Cảm thấy khỏe hơn', GETDATE()),

-- Day 4: 3 cigarettes → (10-3) × 1500 = 10,500 VNĐ saved
(6, '2025-05-27', 3, 6, N'Hôm nay khó khăn hơn', 10500, 0, N'Hơi stress', GETDATE()),

-- Day 5: 1 cigarette → (10-1) × 1500 = 13,500 VNĐ saved
(6, '2025-05-26', 1, 4, N'Bắt đầu giảm dần', 13500, 0, N'Quyết tâm cao', GETDATE());

-- Verify total money saved: 12,000 + 13,500 + 15,000 + 10,500 + 13,500 = 64,500 VNĐ
SELECT 
    UserID,
    COUNT(*) as TotalDays,
    SUM(MoneySaved) as TotalMoneySaved,
    AVG(MoneySaved) as AvgMoneySavedPerDay,
    SUM(CigarettesSmoked) as TotalCigarettesSmoked
FROM ProgressTracking 
WHERE UserID = 6
GROUP BY UserID;

-- Test the user-activity query
SELECT 
    u.UserID,
    u.FirstName + ' ' + u.LastName as FullName,
    SUM(pt.MoneySaved) as TotalMoneySaved,
    COUNT(pt.ProgressID) as DaysTracked
FROM Users u
INNER JOIN ProgressTracking pt ON u.UserID = pt.UserID
WHERE u.UserID = 6
GROUP BY u.UserID, u.FirstName, u.LastName; 
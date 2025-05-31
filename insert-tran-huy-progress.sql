-- Add progress tracking data for Tran Huy (UserID = 6)
-- First, delete any existing progress data for this user
DELETE FROM ProgressTracking WHERE UserID = 6;

-- Insert new progress data for the last 5 days
-- Logic: baseline = 10 điếu/ngày × 1500 VNĐ/điếu = 15.000 VNĐ/ngày
-- MoneySaved = (10 - số điếu hút thực tế) × 1500 VNĐ
INSERT INTO ProgressTracking (UserID, Date, CigarettesSmoked, CravingLevel, EmotionNotes, MoneySaved, DaysSmokeFree, HealthNotes, CreatedAt) 
VALUES 
(6, '2025-05-30', 2, 4, N'Cảm thấy khá tốt, chỉ thèm nhẹ', 12000, 0, N'Hơi thở tốt hơn', GETDATE()),        -- (10-2) × 1500 = 12.000
(6, '2025-05-29', 1, 3, N'Giảm được 1 điếu so với hôm qua', 13500, 0, N'Ít ho hơn', GETDATE()),              -- (10-1) × 1500 = 13.500  
(6, '2025-05-28', 0, 2, N'Tuyệt vời! Không hút điếu nào', 15000, 1, N'Cảm thấy khỏe hơn', GETDATE()),        -- (10-0) × 1500 = 15.000
(6, '2025-05-27', 3, 6, N'Hôm nay khó khăn hơn', 10500, 0, N'Hơi stress', GETDATE()),                       -- (10-3) × 1500 = 10.500
(6, '2025-05-26', 1, 4, N'Bắt đầu giảm dần', 13500, 0, N'Quyết tâm cao', GETDATE());                        -- (10-1) × 1500 = 13.500

-- Total MoneySaved should be: 12.000 + 13.500 + 15.000 + 10.500 + 13.500 = 64.500 VNĐ (not 570.000!)

-- Verify the data was inserted
SELECT * FROM ProgressTracking WHERE UserID = 6 ORDER BY Date DESC;

-- Test the query used by the API
SELECT 
    u.UserID,
    u.FirstName,
    u.LastName,
    pt.Date as LastProgressDate,
    pt.CigarettesSmoked as LastCigarettesSmoked,
    pt.CravingLevel as LastCravingLevel,
    pt.DaysSmokeFree as CurrentDaysSmokeFree,
    pt.MoneySaved as TotalMoneySaved,
    -- Calculate real total
    (SELECT SUM(MoneySaved) FROM ProgressTracking WHERE UserID = 6) as RealTotalMoneySaved
FROM Users u
INNER JOIN QuitPlans qp ON u.UserID = qp.UserID AND qp.Status = 'active'
LEFT JOIN (
    SELECT UserID, Date, CigarettesSmoked, CravingLevel, DaysSmokeFree, MoneySaved,
           ROW_NUMBER() OVER (PARTITION BY UserID ORDER BY Date DESC) as rn
    FROM ProgressTracking
) pt ON u.UserID = pt.UserID AND pt.rn = 1
WHERE u.UserID = 6; 
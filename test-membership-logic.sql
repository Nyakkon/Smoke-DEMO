-- Test script for membership-based progress tracking logic

-- 1. Check current memberships and their start dates
SELECT 
    u.UserID,
    u.Email,
    u.FirstName,
    u.LastName,
    um.StartDate as MembershipStart,
    um.EndDate as MembershipEnd,
    um.Status as MembershipStatus,
    mp.Name as PlanName
FROM Users u
INNER JOIN UserMemberships um ON u.UserID = um.UserID
INNER JOIN MembershipPlans mp ON um.PlanID = mp.PlanID
WHERE um.Status = 'active';

-- 2. Check QuitPlans and see if they follow membership start date constraint
SELECT 
    u.UserID,
    u.Email,
    qp.StartDate as QuitPlanStart,
    um.StartDate as MembershipStart,
    CASE 
        WHEN qp.StartDate >= um.StartDate THEN 'VALID ✅'
        ELSE 'INVALID ❌ (QuitPlan before membership)'
    END as ValidationStatus
FROM Users u
INNER JOIN UserMemberships um ON u.UserID = um.UserID AND um.Status = 'active'
INNER JOIN QuitPlans qp ON u.UserID = qp.UserID AND qp.Status = 'active';

-- 3. Check ProgressTracking and see if data follows membership constraint
SELECT 
    u.UserID,
    u.Email,
    COUNT(pt_all.ProgressID) as TotalProgressEntries,
    COUNT(pt_valid.ProgressID) as ValidProgressEntries,
    um.StartDate as MembershipStart
FROM Users u
INNER JOIN UserMemberships um ON u.UserID = um.UserID AND um.Status = 'active'
LEFT JOIN ProgressTracking pt_all ON u.UserID = pt_all.UserID
LEFT JOIN ProgressTracking pt_valid ON u.UserID = pt_valid.UserID 
    AND pt_valid.Date >= um.StartDate 
    AND pt_valid.Date <= ISNULL(um.EndDate, '9999-12-31')
GROUP BY u.UserID, u.Email, um.StartDate;

-- 4. Test the new user-activity query logic
SELECT 
    u.UserID,
    u.FirstName + ' ' + u.LastName as FullName,
    um.StartDate as MembershipStart,
    qp.StartDate as QuitPlanStart,
    pt.Date as LastProgressDate,
    CASE 
        WHEN qp.StartDate >= um.StartDate THEN 'QuitPlan Valid ✅'
        ELSE 'QuitPlan Invalid ❌'
    END as QuitPlanValidation,
    CASE 
        WHEN pt.Date IS NULL THEN 'No Progress Data'
        WHEN pt.Date >= um.StartDate THEN 'Progress Valid ✅'
        ELSE 'Progress Invalid ❌'
    END as ProgressValidation
FROM Users u
INNER JOIN UserMemberships um ON u.UserID = um.UserID AND um.Status = 'active'
INNER JOIN QuitPlans qp ON u.UserID = qp.UserID 
    AND qp.Status = 'active' 
    AND qp.StartDate >= um.StartDate  -- Apply constraint
LEFT JOIN (
    SELECT UserID, Date, ROW_NUMBER() OVER (PARTITION BY UserID ORDER BY Date DESC) as rn
    FROM ProgressTracking pt2
    WHERE EXISTS (
        SELECT 1 FROM UserMemberships um2 
        WHERE um2.UserID = pt2.UserID 
            AND um2.Status = 'active'
            AND pt2.Date >= um2.StartDate  -- Apply constraint
            AND pt2.Date <= ISNULL(um2.EndDate, '9999-12-31')
    )
) pt ON u.UserID = pt.UserID AND pt.rn = 1
WHERE u.Role IN ('guest', 'member');

-- 5. Create sample data if needed (for testing)
-- Uncomment below if you want to create test data

/*
-- Insert a test membership
INSERT INTO UserMemberships (UserID, PlanID, StartDate, EndDate, Status)
VALUES (2, 1, '2024-01-01', '2024-03-01', 'active');

-- Insert a valid quit plan (after membership start)
INSERT INTO QuitPlans (UserID, StartDate, TargetDate, Reason, Status, MotivationLevel)
VALUES (2, '2024-01-02', '2024-04-01', 'Test quit plan after membership', 'active', 8);

-- Insert valid progress data (after membership start)
INSERT INTO ProgressTracking (UserID, Date, CigarettesSmoked, CravingLevel, MoneySaved)
VALUES 
(2, '2024-01-03', 5, 6, 50000),
(2, '2024-01-04', 3, 4, 75000),
(2, '2024-01-05', 1, 3, 100000);

-- Insert invalid progress data (before membership start) - should be filtered out
INSERT INTO ProgressTracking (UserID, Date, CigarettesSmoked, CravingLevel, MoneySaved)
VALUES 
(2, '2023-12-30', 10, 8, 0),
(2, '2023-12-31', 8, 7, 25000);
*/ 
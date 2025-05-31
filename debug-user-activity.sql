-- Debug why no users show up in user-activity tracking

-- Step 1: Check all users 
SELECT 'Total Users' as Step, COUNT(*) as Count FROM Users WHERE Role IN ('guest', 'member');

-- Step 2: Check users with active membership
SELECT 'Users with Active Membership' as Step, COUNT(*) as Count 
FROM Users u
INNER JOIN UserMemberships um ON u.UserID = um.UserID AND um.Status = 'active'
WHERE u.Role IN ('guest', 'member');

-- Step 3: Check users with active QuitPlans
SELECT 'Users with Active QuitPlans' as Step, COUNT(*) as Count 
FROM Users u
INNER JOIN QuitPlans qp ON u.UserID = qp.UserID AND qp.Status = 'active'
WHERE u.Role IN ('guest', 'member');

-- Step 4: Check users with BOTH active membership AND active QuitPlans
SELECT 'Users with Both Membership & QuitPlan' as Step, COUNT(*) as Count 
FROM Users u
INNER JOIN UserMemberships um ON u.UserID = um.UserID AND um.Status = 'active'
INNER JOIN QuitPlans qp ON u.UserID = qp.UserID AND qp.Status = 'active'
WHERE u.Role IN ('guest', 'member');

-- Step 5: Check the constraint: QuitPlan.StartDate >= Membership.StartDate
SELECT 'Users with QuitPlan after Membership' as Step, COUNT(*) as Count 
FROM Users u
INNER JOIN UserMemberships um ON u.UserID = um.UserID AND um.Status = 'active'
INNER JOIN QuitPlans qp ON u.UserID = qp.UserID 
    AND qp.Status = 'active' 
    AND qp.StartDate >= um.StartDate  -- This constraint might be the issue
WHERE u.Role IN ('guest', 'member');

-- Step 6: Show detailed data for debugging
SELECT 
    u.UserID,
    u.FirstName + ' ' + u.LastName as FullName,
    u.Role,
    u.LastLoginAt,
    um.Status as MembershipStatus,
    um.StartDate as MembershipStart,
    qp.Status as QuitPlanStatus,
    qp.StartDate as QuitPlanStart,
    CASE 
        WHEN qp.StartDate >= um.StartDate THEN 'QuitPlan Valid ✅'
        WHEN qp.StartDate < um.StartDate THEN 'QuitPlan Before Membership ❌'
        ELSE 'No QuitPlan'
    END as ValidationStatus
FROM Users u
LEFT JOIN UserMemberships um ON u.UserID = um.UserID AND um.Status = 'active'
LEFT JOIN QuitPlans qp ON u.UserID = qp.UserID AND qp.Status = 'active'
WHERE u.Role IN ('guest', 'member')
ORDER BY u.UserID; 
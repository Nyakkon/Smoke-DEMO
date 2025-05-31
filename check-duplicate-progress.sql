-- Check for duplicate progress records (same UserID and Date)
SELECT 
    UserID,
    Date,
    COUNT(*) as RecordCount,
    SUM(MoneySaved) as TotalMoneySaved,
    STRING_AGG(CAST(ProgressID as NVARCHAR), ', ') as ProgressIDs
FROM ProgressTracking
GROUP BY UserID, Date
HAVING COUNT(*) > 1
ORDER BY UserID, Date;

-- Check specific user (Tran Huy - UserID = 6)
SELECT 
    ProgressID,
    UserID,
    Date,
    CigarettesSmoked,
    MoneySaved,
    CreatedAt
FROM ProgressTracking 
WHERE UserID = 6
ORDER BY Date DESC, CreatedAt DESC;

-- Check total money saved calculation for UserID = 6
SELECT 
    UserID,
    COUNT(*) as TotalRecords,
    COUNT(DISTINCT Date) as UniqueDates,
    SUM(MoneySaved) as TotalMoneySaved,
    CASE 
        WHEN COUNT(*) > COUNT(DISTINCT Date) THEN 'HAS DUPLICATES ❌'
        ELSE 'NO DUPLICATES ✅'
    END as DuplicateStatus
FROM ProgressTracking 
WHERE UserID = 6
GROUP BY UserID; 
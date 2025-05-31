-- Fix duplicate progress records - keep only the latest record for each UserID + Date combination

-- Step 1: Identify and remove duplicates, keep the latest record
WITH RankedProgress AS (
    SELECT 
        ProgressID,
        UserID,
        Date,
        CigarettesSmoked,
        CravingLevel,
        EmotionNotes,
        MoneySaved,
        DaysSmokeFree,
        HealthNotes,
        CreatedAt,
        ROW_NUMBER() OVER (
            PARTITION BY UserID, Date 
            ORDER BY CreatedAt DESC, ProgressID DESC
        ) as RowNum
    FROM ProgressTracking
)
DELETE FROM ProgressTracking 
WHERE ProgressID IN (
    SELECT ProgressID 
    FROM RankedProgress 
    WHERE RowNum > 1
);

-- Step 2: Verify no duplicates remain
SELECT 
    UserID,
    Date,
    COUNT(*) as RecordCount
FROM ProgressTracking
GROUP BY UserID, Date
HAVING COUNT(*) > 1;

-- Step 3: Check Tran Huy's data after cleanup
SELECT 
    UserID,
    Date,
    CigarettesSmoked,
    MoneySaved,
    CreatedAt
FROM ProgressTracking 
WHERE UserID = 6
ORDER BY Date DESC;

-- Step 4: Verify total money saved for Tran Huy
SELECT 
    UserID,
    COUNT(*) as TotalDays,
    SUM(MoneySaved) as TotalMoneySaved,
    AVG(MoneySaved) as AvgMoneySavedPerDay
FROM ProgressTracking 
WHERE UserID = 6
GROUP BY UserID; 
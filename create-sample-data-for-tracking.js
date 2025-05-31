const sql = require('mssql');

const config = {
    user: 'sa',
    password: 'Hung12345678@',
    server: 'localhost',
    database: 'SMOKEKING',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function createSampleData() {
    try {
        console.log('🔄 Connecting to database...');
        await sql.connect(config);
        console.log('✅ Connected to database');

        // Create sample quit plans
        console.log('\n📋 Creating sample quit plans...');
        await sql.query(`
            -- Create quit plan for member (UserID=2)
            IF NOT EXISTS (SELECT 1 FROM QuitPlans WHERE UserID = 2 AND Status = 'active')
            BEGIN
                INSERT INTO QuitPlans (UserID, StartDate, TargetDate, Reason, MotivationLevel, DetailedPlan, Status, CoachID)
                VALUES (2, DATEADD(day, -15, GETDATE()), DATEADD(day, 45, GETDATE()), 
                        N'Muốn cải thiện sức khỏe và tiết kiệm tiền', 8, 
                        N'Giảm dần số điếu mỗi ngày, tập thể dục thay thế', 'active', 3)
            END
        `);

        // Create sample progress tracking data
        console.log('📊 Creating sample progress tracking data...');
        await sql.query(`
            -- Clear existing progress data for UserID=2
            DELETE FROM ProgressTracking WHERE UserID = 2;
            
            -- Insert sample progress data for the last 15 days
            DECLARE @i INT = 15;
            WHILE @i >= 0
            BEGIN
                DECLARE @date DATE = DATEADD(day, -@i, GETDATE());
                DECLARE @cigarettes INT = CASE 
                    WHEN @i > 10 THEN 15 - @i  -- Decreasing trend
                    WHEN @i > 5 THEN 3
                    ELSE 0  -- Smoke-free last 5 days
                END;
                DECLARE @craving INT = CASE 
                    WHEN @i > 10 THEN 8 - (@i / 3)
                    WHEN @i > 5 THEN 6
                    ELSE 3 + (@i % 3)  -- Some variation
                END;
                DECLARE @moneySaved DECIMAL(10,2) = (15 - @i) * 25000; -- 25k per day saved
                DECLARE @daysFree INT = CASE WHEN @cigarettes = 0 THEN 1 ELSE 0 END;
                
                INSERT INTO ProgressTracking (UserID, Date, CigarettesSmoked, CravingLevel, 
                    EmotionNotes, MoneySaved, DaysSmokeFree, HealthNotes)
                VALUES (2, @date, @cigarettes, @craving,
                    N'Cảm thấy ' + CASE WHEN @cigarettes = 0 THEN N'tự tin và khỏe mạnh' ELSE N'còn khó khăn nhưng đang cố gắng' END,
                    @moneySaved, @daysFree,
                    N'Hơi thở ' + CASE WHEN @cigarettes = 0 THEN N'thơm tho hơn' ELSE N'vẫn còn mùi thuốc' END);
                
                SET @i = @i - 1;
            END
        `);

        // Create sample user achievements
        console.log('🏆 Creating sample achievements...');
        await sql.query(`
            -- Award some achievements to UserID=2
            IF NOT EXISTS (SELECT 1 FROM UserAchievements WHERE UserID = 2 AND AchievementID = 1)
                INSERT INTO UserAchievements (UserID, AchievementID, EarnedAt) 
                VALUES (2, 1, DATEADD(day, -14, GETDATE())); -- First day
                
            IF NOT EXISTS (SELECT 1 FROM UserAchievements WHERE UserID = 2 AND AchievementID = 2)
                INSERT INTO UserAchievements (UserID, AchievementID, EarnedAt) 
                VALUES (2, 2, DATEADD(day, -8, GETDATE())); -- First week
                
            IF NOT EXISTS (SELECT 1 FROM UserAchievements WHERE UserID = 2 AND AchievementID = 5)
                INSERT INTO UserAchievements (UserID, AchievementID, EarnedAt) 
                VALUES (2, 5, DATEADD(day, -10, GETDATE())); -- Saved 100K
        `);

        // Create another user with different status
        console.log('👤 Creating additional sample user...');
        await sql.query(`
            -- Create a user who needs support (high craving)
            IF NOT EXISTS (SELECT 1 FROM Users WHERE Email = 'testuser@example.com')
            BEGIN
                INSERT INTO Users (Email, Password, FirstName, LastName, Role, IsActive, EmailVerified)
                VALUES ('testuser@example.com', 'H12345678@', N'Nguyễn', N'Văn Test', 'member', 1, 1);
            END
            
            DECLARE @testUserID INT = (SELECT UserID FROM Users WHERE Email = 'testuser@example.com');
            
            -- Create quit plan for test user
            IF NOT EXISTS (SELECT 1 FROM QuitPlans WHERE UserID = @testUserID AND Status = 'active')
            BEGIN
                INSERT INTO QuitPlans (UserID, StartDate, TargetDate, Reason, MotivationLevel, DetailedPlan, Status, CoachID)
                VALUES (@testUserID, DATEADD(day, -5, GETDATE()), DATEADD(day, 25, GETDATE()), 
                        N'Áp lực từ gia đình', 4, 
                        N'Cố gắng giảm từ từ', 'active', 5);
            END
            
            -- Create progress data showing high craving and recent smoking
            DELETE FROM ProgressTracking WHERE UserID = @testUserID;
            INSERT INTO ProgressTracking (UserID, Date, CigarettesSmoked, CravingLevel, 
                EmotionNotes, MoneySaved, DaysSmokeFree, HealthNotes)
            VALUES 
                (@testUserID, GETDATE(), 8, 9, N'Rất khó kiểm soát, stress công việc', 50000, 0, N'Ho nhiều, mệt mỏi'),
                (@testUserID, DATEADD(day, -1, GETDATE()), 12, 8, N'Ngày khó khăn', 25000, 0, N'Khó thở'),
                (@testUserID, DATEADD(day, -2, GETDATE()), 5, 7, N'Cố gắng giảm', 75000, 0, N'Cải thiện một chút');
        `);

        // Update last login times to create variety
        console.log('🕐 Updating login times...');
        await sql.query(`
            UPDATE Users SET LastLoginAt = GETDATE() WHERE UserID = 2;
            UPDATE Users SET LastLoginAt = DATEADD(day, -3, GETDATE()) WHERE Email = 'testuser@example.com';
            UPDATE Users SET LastLoginAt = DATEADD(day, -20, GETDATE()) WHERE UserID = 1; -- Guest user inactive
        `);

        // Create coach feedback
        console.log('💬 Creating coach feedback...');
        await sql.query(`
            IF NOT EXISTS (SELECT 1 FROM CoachFeedback WHERE CoachID = 3 AND MemberID = 2)
            BEGIN
                INSERT INTO CoachFeedback (CoachID, MemberID, Rating, Comment, Categories, IsAnonymous)
                VALUES (3, 2, 5, N'Coach rất tận tâm và hỗ trợ tốt trong quá trình cai thuốc', 
                        '{"professionalism": 5, "helpfulness": 5, "communication": 5, "knowledge": 5}', 0);
            END
        `);

        console.log('\n✅ Sample data created successfully!');
        console.log('\n📋 Summary of created data:');
        console.log('- Quit plans for UserID=2 (progressing well) and test user (needs support)');
        console.log('- 16 days of progress tracking data with realistic trends');
        console.log('- Achievement unlocks for successful user');
        console.log('- Varied login times to test support prioritization');
        console.log('- Coach feedback data');

        console.log('\n🧪 You can now test the User Activity Tracking endpoints!');
        console.log('Run: node test-user-activity-endpoint.js');

    } catch (error) {
        console.error('❌ Error creating sample data:', error);
    } finally {
        await sql.close();
    }
}

createSampleData(); 
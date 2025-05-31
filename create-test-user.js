const { pool } = require('./server/src/config/database');
const bcrypt = require('bcryptjs');

async function createTestUser() {
    try {
        console.log('👤 Creating test user with progress data...\n');

        // 1. Create test user
        const hashedPassword = await bcrypt.hash('password123', 10);

        const userResult = await pool.request()
            .input('Email', 'testuser@example.com')
            .input('Password', hashedPassword)
            .input('FirstName', 'Test')
            .input('LastName', 'User')
            .input('Role', 'member')
            .query(`
                MERGE INTO Users AS target
                USING (SELECT @Email AS Email) AS source
                ON target.Email = source.Email
                WHEN MATCHED THEN
                    UPDATE SET 
                        Password = @Password,
                        FirstName = @FirstName,
                        LastName = @LastName,
                        Role = @Role,
                        IsActive = 1
                WHEN NOT MATCHED THEN
                    INSERT (Email, Password, FirstName, LastName, Role, IsActive)
                    VALUES (@Email, @Password, @FirstName, @LastName, @Role, 1)
                OUTPUT INSERTED.UserID, INSERTED.Email;
            `);

        const userId = userResult.recordset[0].UserID;
        console.log(`✅ Test user created/updated: ID ${userId}, Email: testuser@example.com`);

        // 2. Create smoking status
        await pool.request()
            .input('UserID', userId)
            .input('CigarettesPerDay', 20)
            .input('CigarettePrice', 1500)
            .query(`
                MERGE INTO SmokingStatus AS target
                USING (SELECT @UserID AS UserID) AS source
                ON target.UserID = source.UserID
                WHEN MATCHED THEN
                    UPDATE SET 
                        CigarettesPerDay = @CigarettesPerDay,
                        CigarettePrice = @CigarettePrice,
                        LastUpdated = GETDATE()
                WHEN NOT MATCHED THEN
                    INSERT (UserID, CigarettesPerDay, CigarettePrice, SmokingFrequency)
                    VALUES (@UserID, @CigarettesPerDay, @CigarettePrice, N'Được cập nhật tự động')
            `);

        console.log('✅ Smoking status created: 20 điếu/ngày × 1,500 VNĐ/điếu');

        // 3. Create progress tracking data
        const progressData = [
            { date: '2024-05-25', cigarettes: 0, craving: 2, notes: 'Ngày đầu không hút thuốc!' },
            { date: '2024-05-26', cigarettes: 2, craving: 6, notes: 'Khó khăn nhưng giảm được' },
            { date: '2024-05-27', cigarettes: 1, craving: 4, notes: 'Tiến bộ tốt' },
            { date: '2024-05-28', cigarettes: 0, craving: 3, notes: 'Lại smoke-free!' },
            { date: '2024-05-29', cigarettes: 0, craving: 2, notes: 'Cảm thấy tự tin hơn' },
        ];

        console.log('\n📊 Creating progress tracking data...');
        for (const progress of progressData) {
            // Calculate money saved: (baseline - actual) * price
            const baseline = 20; // điếu/ngày
            const cigarettePrice = 1500;
            const cigarettesNotSmoked = Math.max(0, baseline - progress.cigarettes);
            const moneySaved = cigarettesNotSmoked * cigarettePrice;

            await pool.request()
                .input('UserID', userId)
                .input('Date', progress.date)
                .input('CigarettesSmoked', progress.cigarettes)
                .input('CravingLevel', progress.craving)
                .input('EmotionNotes', progress.notes)
                .input('MoneySaved', moneySaved)
                .input('DaysSmokeFree', progress.cigarettes === 0 ? 1 : 0)
                .query(`
                    MERGE INTO ProgressTracking AS target
                    USING (SELECT @UserID AS UserID, @Date AS Date) AS source
                    ON target.UserID = source.UserID AND target.Date = source.Date
                    WHEN MATCHED THEN
                        UPDATE SET
                            CigarettesSmoked = @CigarettesSmoked,
                            CravingLevel = @CravingLevel,
                            EmotionNotes = @EmotionNotes,
                            MoneySaved = @MoneySaved,
                            DaysSmokeFree = @DaysSmokeFree,
                            CreatedAt = GETDATE()
                    WHEN NOT MATCHED THEN
                        INSERT (UserID, Date, CigarettesSmoked, CravingLevel, EmotionNotes, MoneySaved, DaysSmokeFree, CreatedAt)
                        VALUES (@UserID, @Date, @CigarettesSmoked, @CravingLevel, @EmotionNotes, @MoneySaved, @DaysSmokeFree, GETDATE())
                `);

            console.log(`   ${progress.date}: ${progress.cigarettes} điếu → tiết kiệm ${moneySaved.toLocaleString('vi-VN')} VNĐ`);
        }

        // 4. Calculate totals
        const totalResult = await pool.request()
            .input('UserID', userId)
            .query(`
                SELECT 
                    COUNT(*) as TotalDays,
                    SUM(CigarettesSmoked) as TotalCigarettes,
                    SUM(MoneySaved) as TotalMoneySaved,
                    SUM(CASE WHEN CigarettesSmoked = 0 THEN 1 ELSE 0 END) as SmokeFreeDays
                FROM ProgressTracking 
                WHERE UserID = @UserID
            `);

        const totals = totalResult.recordset[0];
        console.log('\n📈 Summary for test user:');
        console.log(`   Total days tracked: ${totals.TotalDays}`);
        console.log(`   Total cigarettes smoked: ${totals.TotalCigarettes}`);
        console.log(`   Total money saved: ${totals.TotalMoneySaved?.toLocaleString('vi-VN')} VNĐ`);
        console.log(`   Smoke-free days: ${totals.SmokeFreeDays}`);

        console.log('\n🔑 Test credentials:');
        console.log('   Email: testuser@example.com');
        console.log('   Password: password123');

        console.log('\n✅ Test user ready! You can now:');
        console.log('1. Run: node test-api-savings.js (will auto-login)');
        console.log('2. Login on frontend with the credentials above');
        console.log('3. Check if both endpoints return same values');

    } catch (error) {
        console.error('❌ Error creating test user:', error);
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

// Run if called directly
if (require.main === module) {
    createTestUser()
        .then(() => {
            console.log('\n🎉 Test user creation completed!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Test user creation failed:', error);
            process.exit(1);
        });
}

module.exports = createTestUser; 
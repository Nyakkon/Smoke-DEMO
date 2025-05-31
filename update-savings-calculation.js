const { pool } = require('./server/src/config/database');

async function updateSavingsCalculation() {
    try {
        console.log('🔄 Đang cập nhật tính toán tiền tiết kiệm cho tất cả users...');

        // Get all users who have progress tracking data
        const usersResult = await pool.request().query(`
            SELECT DISTINCT pt.UserID, u.Username, u.Email
            FROM ProgressTracking pt
            INNER JOIN Users u ON pt.UserID = u.UserID
            ORDER BY pt.UserID
        `);

        console.log(`📊 Tìm thấy ${usersResult.recordset.length} users có dữ liệu progress`);

        for (const user of usersResult.recordset) {
            console.log(`\n👤 Đang xử lý user: ${user.Username} (ID: ${user.UserID})`);

            // Get user's smoking baseline
            let baselineCigarettesPerDay = 10; // Default half pack
            let cigarettePrice = 1500; // Default 1500 VNĐ per cigarette

            // Try to get from SmokingStatus
            const smokingInfo = await pool.request()
                .input('UserID', user.UserID)
                .query(`
                    SELECT TOP 1 CigarettesPerDay, CigarettePrice 
                    FROM SmokingStatus 
                    WHERE UserID = @UserID 
                    ORDER BY LastUpdated DESC
                `);

            if (smokingInfo.recordset.length > 0) {
                const { CigarettesPerDay, CigarettePrice } = smokingInfo.recordset[0];
                baselineCigarettesPerDay = CigarettesPerDay || 10;
                cigarettePrice = CigarettePrice || 1500;
                console.log(`   📋 Sử dụng dữ liệu từ SmokingStatus: ${baselineCigarettesPerDay} điếu/ngày, ${cigarettePrice.toLocaleString('vi-VN')} VNĐ/điếu`);
            } else {
                // Try to get from survey data
                const surveyInfo = await pool.request()
                    .input('UserID', user.UserID)
                    .query(`
                        SELECT ua.AnswerText
                        FROM UserSurveyAnswers ua
                        INNER JOIN SurveyQuestions sq ON ua.QuestionID = sq.QuestionID
                        WHERE ua.UserID = @UserID 
                        AND sq.QuestionText LIKE N'%bao nhiêu điếu%'
                        AND sq.DisplayOrder = 2
                    `);

                if (surveyInfo.recordset.length > 0) {
                    const surveyAnswer = parseInt(surveyInfo.recordset[0].AnswerText);
                    if (!isNaN(surveyAnswer) && surveyAnswer > 0) {
                        baselineCigarettesPerDay = surveyAnswer;
                        console.log(`   📝 Sử dụng dữ liệu từ Survey: ${baselineCigarettesPerDay} điếu/ngày`);

                        // Create smoking status from survey data
                        await pool.request()
                            .input('UserID', user.UserID)
                            .input('CigarettesPerDay', baselineCigarettesPerDay)
                            .input('CigarettePrice', cigarettePrice)
                            .query(`
                                INSERT INTO SmokingStatus (UserID, CigarettesPerDay, CigarettePrice, SmokingFrequency)
                                VALUES (@UserID, @CigarettesPerDay, @CigarettePrice, N'Từ dữ liệu khảo sát - tự động cập nhật')
                            `);
                    }
                }

                // Also try from UserSurvey table
                const userSurveyInfo = await pool.request()
                    .input('UserID', user.UserID)
                    .query(`
                        SELECT CigarettesPerDay
                        FROM UserSurvey 
                        WHERE UserID = @UserID
                    `);

                if (userSurveyInfo.recordset.length > 0 && userSurveyInfo.recordset[0].CigarettesPerDay) {
                    baselineCigarettesPerDay = userSurveyInfo.recordset[0].CigarettesPerDay;
                    console.log(`   📊 Sử dụng dữ liệu từ UserSurvey: ${baselineCigarettesPerDay} điếu/ngày`);

                    // Create smoking status if not exists
                    if (smokingInfo.recordset.length === 0) {
                        await pool.request()
                            .input('UserID', user.UserID)
                            .input('CigarettesPerDay', baselineCigarettesPerDay)
                            .input('CigarettePrice', cigarettePrice)
                            .query(`
                                INSERT INTO SmokingStatus (UserID, CigarettesPerDay, CigarettePrice, SmokingFrequency)
                                VALUES (@UserID, @CigarettesPerDay, @CigarettePrice, N'Từ dữ liệu UserSurvey - tự động cập nhật')
                            `);
                    }
                }

                if (smokingInfo.recordset.length === 0 && surveyInfo.recordset.length === 0 && userSurveyInfo.recordset.length === 0) {
                    console.log(`   ⚠️  Sử dụng giá trị mặc định: ${baselineCigarettesPerDay} điếu/ngày, ${cigarettePrice.toLocaleString('vi-VN')} VNĐ/điếu`);
                }
            }

            // Get all progress tracking entries for this user
            const progressEntries = await pool.request()
                .input('UserID', user.UserID)
                .query(`
                    SELECT ProgressID, Date, CigarettesSmoked, MoneySaved
                    FROM ProgressTracking 
                    WHERE UserID = @UserID
                    ORDER BY Date
                `);

            console.log(`   📈 Cập nhật ${progressEntries.recordset.length} entries`);

            let updatedCount = 0;
            for (const entry of progressEntries.recordset) {
                // Recalculate money saved with new formula
                const cigarettesNotSmoked = Math.max(0, baselineCigarettesPerDay - entry.CigarettesSmoked);
                const newMoneySaved = cigarettesNotSmoked * cigarettePrice;

                // Only update if the calculation has changed
                if (Math.abs(newMoneySaved - (entry.MoneySaved || 0)) > 0.01) {
                    await pool.request()
                        .input('ProgressID', entry.ProgressID)
                        .input('MoneySaved', newMoneySaved)
                        .query(`
                            UPDATE ProgressTracking 
                            SET MoneySaved = @MoneySaved,
                                UpdatedAt = GETDATE()
                            WHERE ProgressID = @ProgressID
                        `);
                    updatedCount++;
                }
            }

            console.log(`   ✅ Đã cập nhật ${updatedCount} entries cho user ${user.Username}`);

            // Calculate new total savings
            const totalSavingsResult = await pool.request()
                .input('UserID', user.UserID)
                .query(`
                    SELECT SUM(MoneySaved) as TotalMoneySaved
                    FROM ProgressTracking 
                    WHERE UserID = @UserID
                `);

            const totalSavings = totalSavingsResult.recordset[0].TotalMoneySaved || 0;
            console.log(`   💰 Tổng tiền tiết kiệm mới: ${totalSavings.toLocaleString('vi-VN')} VNĐ`);
        }

        console.log('\n🎉 Hoàn thành cập nhật tính toán tiền tiết kiệm!');
        console.log('\n📋 Tóm tắt công thức mới:');
        console.log('   • 1 gói thuốc = 20 điếu = 30,000 VNĐ');
        console.log('   • 1 điếu = 1,500 VNĐ (chuẩn)');
        console.log('   • Baseline mặc định = 10 điếu/ngày (nửa gói)');
        console.log('   • Tiền tiết kiệm = (Baseline - Điếu hút thực tế) × Giá điếu');
        console.log('   • Hệ thống tự động lấy dữ liệu từ Survey câu hỏi số 2 nếu có');

    } catch (error) {
        console.error('❌ Lỗi khi cập nhật tính toán tiền tiết kiệm:', error);
    } finally {
        // Close the database connection
        if (pool) {
            await pool.close();
        }
    }
}

// Run the update
if (require.main === module) {
    updateSavingsCalculation()
        .then(() => {
            console.log('✅ Script hoàn thành');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Script thất bại:', error);
            process.exit(1);
        });
}

module.exports = updateSavingsCalculation; 
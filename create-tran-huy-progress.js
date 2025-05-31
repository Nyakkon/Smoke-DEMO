const axios = require('axios');

async function createTranHuyProgress() {
    try {
        console.log('🎯 Creating progress tracking data for Tran Huy...');

        // Giả sử Tran Huy có UserID = 6 (từ screen shot)
        const tranHuyUserID = 6;

        // Logic tính tiền tiết kiệm đúng:
        // Baseline: 10 điếu/ngày × 1500 VNĐ/điếu = 15.000 VNĐ/ngày
        // MoneySaved = (10 - số điếu hút thực tế) × 1500 VNĐ
        const calculateMoneySaved = (cigarettesSmoked) => {
            const baseline = 10; // điếu/ngày 
            const pricePerCigarette = 1500; // VNĐ/điếu
            return Math.max(0, (baseline - cigarettesSmoked) * pricePerCigarette);
        };

        // Tạo data mẫu cho 5 ngày gần đây
        const progressData = [
            {
                UserID: tranHuyUserID,
                Date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 ngày trước
                CigarettesSmoked: 2,
                CravingLevel: 4,
                EmotionNotes: 'Cảm thấy khá tốt, chỉ thèm nhẹ',
                MoneySaved: calculateMoneySaved(2), // (10-2) × 1500 = 12.000 VNĐ
                DaysSmokeFree: 0,
                HealthNotes: 'Hơi thở tốt hơn'
            },
            {
                UserID: tranHuyUserID,
                Date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 ngày trước
                CigarettesSmoked: 1,
                CravingLevel: 3,
                EmotionNotes: 'Giảm được 1 điếu so với hôm qua',
                MoneySaved: calculateMoneySaved(1), // (10-1) × 1500 = 13.500 VNĐ
                DaysSmokeFree: 0,
                HealthNotes: 'Ít ho hơn'
            },
            {
                UserID: tranHuyUserID,
                Date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 ngày trước
                CigarettesSmoked: 0,
                CravingLevel: 2,
                EmotionNotes: 'Tuyệt vời! Không hút điếu nào',
                MoneySaved: calculateMoneySaved(0), // (10-0) × 1500 = 15.000 VNĐ
                DaysSmokeFree: 1,
                HealthNotes: 'Cảm thấy khỏe hơn'
            },
            {
                UserID: tranHuyUserID,
                Date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 4 ngày trước
                CigarettesSmoked: 3,
                CravingLevel: 6,
                EmotionNotes: 'Hôm nay khó khăn hơn',
                MoneySaved: calculateMoneySaved(3), // (10-3) × 1500 = 10.500 VNĐ
                DaysSmokeFree: 0,
                HealthNotes: 'Hơi stress'
            },
            {
                UserID: tranHuyUserID,
                Date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 5 ngày trước
                CigarettesSmoked: 1,
                CravingLevel: 4,
                EmotionNotes: 'Bắt đầu giảm dần',
                MoneySaved: calculateMoneySaved(1), // (10-1) × 1500 = 13.500 VNĐ
                DaysSmokeFree: 0,
                HealthNotes: 'Quyết tâm cao'
            }
        ];

        // Tính tổng tiền tiết kiệm
        const totalMoneySaved = progressData.reduce((sum, data) => sum + data.MoneySaved, 0);
        console.log(`💰 Total money saved should be: ${totalMoneySaved.toLocaleString()} VNĐ (not 570,000!)`);

        console.log('\n📊 Progress data to be created:');
        console.log(progressData);

        // Note: Vì không thể connect trực tiếp database, 
        // bạn cần chạy SQL command sau trong SQL Server Management Studio:

        console.log('\n📝 Run these SQL commands in SQL Server Management Studio:');
        console.log('-- Delete existing progress for Tran Huy first (if any):');
        console.log(`DELETE FROM ProgressTracking WHERE UserID = ${tranHuyUserID};`);
        console.log('\n-- Insert new progress data:');

        progressData.forEach(data => {
            console.log(`INSERT INTO ProgressTracking (UserID, Date, CigarettesSmoked, CravingLevel, EmotionNotes, MoneySaved, DaysSmokeFree, HealthNotes, CreatedAt) VALUES (${data.UserID}, '${data.Date}', ${data.CigarettesSmoked}, ${data.CravingLevel}, N'${data.EmotionNotes}', ${data.MoneySaved}, ${data.DaysSmokeFree}, N'${data.HealthNotes}', GETDATE());`);
        });

        console.log('\n✅ After running the SQL commands above, restart your server and check the interface again!');

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

createTranHuyProgress(); 
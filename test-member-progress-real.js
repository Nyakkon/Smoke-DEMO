const axios = require('axios');

const BASE_URL = 'http://localhost:4000/api';

async function testMemberProgressReal() {
    try {
        console.log('🔍 TESTING MEMBER PROGRESS WITH REAL DATA');
        console.log('==========================================\n');

        // Login as member first to get token
        console.log('1. 🔐 Logging in as member...');
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'member@example.com',
            password: 'password123'
        });

        if (!loginResponse.data.success) {
            console.log('❌ Login failed:', loginResponse.data.message);
            return;
        }

        const token = loginResponse.data.token;
        const headers = { 'Authorization': `Bearer ${token}` };
        console.log('✅ Login successful!');

        // Test progress summary endpoint
        console.log('\n2. 📊 Testing progress summary...');
        try {
            const summaryResponse = await axios.get(`${BASE_URL}/progress/summary`, { headers });
            if (summaryResponse.data.success) {
                console.log('✅ Progress summary loaded:');
                const data = summaryResponse.data.data;
                console.log(`   - Total days tracked: ${data.TotalDaysTracked || 0}`);
                console.log(`   - Smoke-free days: ${data.SmokeFreeDays || 0}`);
                console.log(`   - Total money saved: ${(data.TotalMoneySaved || 0).toLocaleString()} VNĐ`);
                console.log(`   - Average craving level: ${data.AverageCravingLevel || 0}/10`);
                console.log(`   - Cigarettes not smoked: ${data.CigarettesNotSmoked || 0}`);
            } else {
                console.log('❌ Progress summary failed:', summaryResponse.data.message);
            }
        } catch (error) {
            console.log('❌ Progress summary error:', error.response?.data?.message || error.message);
        }

        // Test progress range endpoint
        console.log('\n3. 📅 Testing progress range...');
        try {
            const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const endDate = new Date().toISOString().split('T')[0];

            const rangeResponse = await axios.get(`${BASE_URL}/progress/range`, {
                headers,
                params: { startDate, endDate }
            });

            if (rangeResponse.data.success) {
                console.log('✅ Progress range loaded:');
                const data = rangeResponse.data.data;
                console.log(`   - Records in last 30 days: ${data.length}`);
                if (data.length > 0) {
                    data.slice(0, 3).forEach((record, index) => {
                        const date = new Date(record.Date).toLocaleDateString('vi-VN');
                        console.log(`   ${index + 1}. ${date}: ${record.CigarettesSmoked || 0} cigarettes, craving ${record.CravingLevel || 0}/10`);
                    });
                }
            } else {
                console.log('❌ Progress range failed:', rangeResponse.data.message);
            }
        } catch (error) {
            console.log('❌ Progress range error:', error.response?.data?.message || error.message);
        }

        // Test streak endpoint
        console.log('\n4. 🔥 Testing streak information...');
        try {
            const streakResponse = await axios.get(`${BASE_URL}/progress/streak`, { headers });
            if (streakResponse.data.success) {
                console.log('✅ Streak information loaded:');
                const data = streakResponse.data.data;
                console.log(`   - Current streak: ${data.currentStreak || 0} days`);
                console.log(`   - Longest streak: ${data.longestStreak || 0} days`);
            } else {
                console.log('❌ Streak failed:', streakResponse.data.message);
            }
        } catch (error) {
            console.log('❌ Streak error:', error.response?.data?.message || error.message);
        }

        // Test achievements endpoint
        console.log('\n5. 🏆 Testing achievements...');
        try {
            const achievementsResponse = await axios.get(`${BASE_URL}/achievements/user`, { headers });
            if (achievementsResponse.data.success) {
                console.log('✅ Achievements loaded:');
                const data = achievementsResponse.data.data;
                console.log(`   - Total achievements: ${data.length}`);
                data.slice(0, 3).forEach((achievement, index) => {
                    const earnedDate = new Date(achievement.EarnedAt).toLocaleDateString('vi-VN');
                    console.log(`   ${index + 1}. ${achievement.Name} - earned ${earnedDate}`);
                });
            } else {
                console.log('❌ Achievements failed:', achievementsResponse.data.message);
            }
        } catch (error) {
            console.log('❌ Achievements error:', error.response?.data?.message || error.message);
        }

        // Test adding new progress entry
        console.log('\n6. ➕ Testing add progress...');
        try {
            const progressEntry = {
                date: new Date().toISOString().split('T')[0],
                cigarettesSmoked: 0,
                cravingLevel: 3,
                emotionNotes: 'Testing từ script - cảm thấy khá tốt hôm nay!'
            };

            const addResponse = await axios.post(`${BASE_URL}/progress`, progressEntry, { headers });
            if (addResponse.data.success) {
                console.log('✅ Progress entry added successfully!');
                console.log(`   - Money saved today: ${(addResponse.data.calculations?.moneySaved || 0).toLocaleString()} VNĐ`);
                console.log(`   - Days smoke free: ${addResponse.data.calculations?.daysSmokeFree || 0}`);

                if (addResponse.data.achievements?.newAchievements?.length > 0) {
                    console.log('🏆 New achievements unlocked:');
                    addResponse.data.achievements.newAchievements.forEach(achievement => {
                        console.log(`   - ${achievement.Name}: ${achievement.Description}`);
                    });
                }
            } else {
                console.log('❌ Add progress failed:', addResponse.data.message);
            }
        } catch (error) {
            console.log('❌ Add progress error:', error.response?.data?.message || error.message);
        }

        console.log('\n✅ Member progress test completed!');
        console.log('\n💡 Tips for testing in UI:');
        console.log('   1. Login as member: member@example.com / password123');
        console.log('   2. Go to "Tiến trình cai thuốc" section');
        console.log('   3. Check if real data from database is displayed');
        console.log('   4. Try adding new progress entry');
        console.log('   5. Verify achievements are showing correctly');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testMemberProgressReal(); 
const axios = require('axios');

const BASE_URL = 'http://localhost:4000';

async function testUserActivityTracking() {
    try {
        console.log('🧪 Testing User Activity Tracking API endpoints...\n');

        // First, login as admin to get token
        console.log('1. Logging in as admin...');
        const loginResponse = await axios.post(`${BASE_URL}/api/admin/login`, {
            email: 'admin@example.com',
            password: 'H12345678@'
        });

        if (!loginResponse.data.success) {
            throw new Error('Admin login failed');
        }

        const token = loginResponse.data.token;
        console.log('✅ Admin login successful');

        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        // Test system overview endpoint
        console.log('\n2. Testing system overview endpoint...');
        try {
            const overviewResponse = await axios.get(`${BASE_URL}/api/admin/system-overview`, {
                headers,
                withCredentials: true
            });

            if (overviewResponse.data.success) {
                console.log('✅ System overview endpoint working');
                console.log('📊 Overview data sample:');
                const data = overviewResponse.data.data;
                console.log(`   - Total Members: ${data.TotalMembers || 0}`);
                console.log(`   - Active Quit Plans: ${data.ActiveQuitPlans || 0}`);
                console.log(`   - High Craving Users: ${data.HighCravingUsers || 0}`);
                console.log(`   - Recent Smoking Users: ${data.RecentSmokingUsers || 0}`);
            } else {
                console.log('❌ System overview failed:', overviewResponse.data.message);
            }
        } catch (error) {
            console.log('❌ System overview error:', error.response?.data?.message || error.message);
        }

        // Test user activity tracking endpoint
        console.log('\n3. Testing user activity tracking endpoint...');
        try {
            const activityResponse = await axios.get(`${BASE_URL}/api/admin/user-activity`, {
                headers,
                withCredentials: true
            });

            if (activityResponse.data.success) {
                console.log('✅ User activity tracking endpoint working');
                console.log('📊 Activity data sample:');
                const data = activityResponse.data.data;

                console.log(`   - Users in quit process: ${data.usersInQuitProcess?.length || 0}`);
                console.log(`   - Users needing support: ${data.usersNeedingSupport?.length || 0}`);
                console.log(`   - Achievement stats: ${data.achievementStats?.length || 0} achievements`);
                console.log(`   - Coach performance: ${data.coachPerformance?.length || 0} coaches`);

                // Show success rates
                if (data.successRates) {
                    console.log('   📈 Success Rates:');
                    console.log(`      - Overall: ${data.successRates.OverallSuccessRate || 0}%`);
                    console.log(`      - Total Quit Plans: ${data.successRates.TotalQuitPlans || 0}`);
                    console.log(`      - Completed Plans: ${data.successRates.CompletedPlans || 0}`);
                    console.log(`      - Average Days to Complete: ${data.successRates.AvgDaysToComplete || 0}`);
                }

                // Show some users needing support
                if (data.usersNeedingSupport?.length > 0) {
                    console.log('\n   ⚠️  Users needing support:');
                    data.usersNeedingSupport.slice(0, 3).forEach((user, index) => {
                        console.log(`      ${index + 1}. ${user.FullName} - ${user.Priority} priority`);
                        console.log(`         Reason: ${user.SupportReason}`);
                    });
                }

                // Show top achievements
                if (data.achievementStats?.length > 0) {
                    console.log('\n   🏆 Top achievements:');
                    data.achievementStats.slice(0, 3).forEach((achievement, index) => {
                        console.log(`      ${index + 1}. ${achievement.AchievementName}`);
                        console.log(`         Earned: ${achievement.TimesEarned} times (${achievement.EarnPercentage || 0}%)`);
                    });
                }

            } else {
                console.log('❌ User activity tracking failed:', activityResponse.data.message);
            }
        } catch (error) {
            console.log('❌ User activity tracking error:', error.response?.data?.message || error.message);
        }

        // Test user progress analysis endpoint (if we have users)
        console.log('\n4. Testing user progress analysis...');
        try {
            // Get a user ID first
            const usersResponse = await axios.get(`${BASE_URL}/api/admin/user-activity`, {
                headers,
                withCredentials: true
            });

            if (usersResponse.data.success && usersResponse.data.data.usersInQuitProcess.length > 0) {
                const userId = usersResponse.data.data.usersInQuitProcess[0].UserID;
                console.log(`   Testing with user ID: ${userId}`);

                const progressResponse = await axios.get(`${BASE_URL}/api/admin/user-progress-analysis/${userId}`, {
                    headers,
                    withCredentials: true
                });

                if (progressResponse.data.success) {
                    console.log('✅ User progress analysis endpoint working');
                    const data = progressResponse.data.data;
                    console.log('📊 Progress analysis sample:');
                    console.log(`   - User: ${data.userInfo.FirstName} ${data.userInfo.LastName}`);
                    console.log(`   - Email: ${data.userInfo.Email}`);
                    console.log(`   - Quit Plans: ${data.quitPlans?.length || 0}`);
                    console.log(`   - Progress Data Points: ${data.progressData?.length || 0}`);
                    console.log(`   - Achievements: ${data.achievements?.length || 0}`);

                    if (data.analytics) {
                        console.log('   📈 Analytics:');
                        console.log(`      - Total Days Tracked: ${data.analytics.totalDaysTracked}`);
                        console.log(`      - Smoke Free Days: ${data.analytics.smokeFreeDays}`);
                        console.log(`      - Total Money Saved: ${data.analytics.totalMoneySaved} VNĐ`);
                        console.log(`      - Average Craving Level: ${data.analytics.averageCravingLevel?.toFixed(1)}/10`);
                        console.log(`      - Recent Trend: ${data.analytics.recentTrend}`);
                    }
                } else {
                    console.log('❌ User progress analysis failed:', progressResponse.data.message);
                }
            } else {
                console.log('⚠️  No users available for progress analysis test');
            }
        } catch (error) {
            console.log('❌ User progress analysis error:', error.response?.data?.message || error.message);
        }

        console.log('\n🎉 User Activity Tracking API test completed!');

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data?.message || error.message);
        if (error.response?.data?.error) {
            console.error('   Detailed error:', error.response.data.error);
        }
    }
}

// Run the test
if (require.main === module) {
    testUserActivityTracking();
}

module.exports = testUserActivityTracking; 
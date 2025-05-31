const fetch = require('node-fetch');

async function testUserActivityEndpoint() {
    const BASE_URL = 'http://localhost:4000/api';

    try {
        console.log('🧪 Testing User Activity Tracking Endpoint...\n');

        // Step 1: Admin login
        console.log('1. Logging in as admin...');
        const loginResponse = await fetch(`${BASE_URL}/admin/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: 'admin@example.com',
                password: 'H12345678@'
            })
        });

        if (!loginResponse.ok) {
            console.error('❌ Admin login failed:', loginResponse.status, loginResponse.statusText);
            const errorText = await loginResponse.text();
            console.error('Error details:', errorText);
            return;
        }

        const loginData = await loginResponse.json();
        console.log('✅ Admin login successful:', loginData.user?.email);

        const token = loginData.token;
        const cookies = loginResponse.headers.get('set-cookie');

        // Step 2: Test user-activity endpoint
        console.log('\n2. Testing /api/admin/user-activity...');
        const activityResponse = await fetch(`${BASE_URL}/admin/user-activity`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Cookie': cookies || ''
            }
        });

        console.log('Response status:', activityResponse.status);
        console.log('Response headers:', activityResponse.headers);

        if (!activityResponse.ok) {
            console.error('❌ User activity endpoint failed:', activityResponse.status, activityResponse.statusText);
            const errorText = await activityResponse.text();
            console.error('Error details:', errorText);
            return;
        }

        const activityData = await activityResponse.json();
        console.log('✅ User activity endpoint successful!');
        console.log('\n📊 Activity Data Summary:');
        console.log(`- Users in quit process: ${activityData.data?.usersInQuitProcess?.length || 0}`);
        console.log(`- Users needing support: ${activityData.data?.usersNeedingSupport?.length || 0}`);
        console.log(`- Achievement stats: ${activityData.data?.achievementStats?.length || 0}`);
        console.log(`- Coach performance data: ${activityData.data?.coachPerformance?.length || 0}`);

        // Step 3: Test system-overview endpoint
        console.log('\n3. Testing /api/admin/system-overview...');
        const overviewResponse = await fetch(`${BASE_URL}/admin/system-overview`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Cookie': cookies || ''
            }
        });

        if (!overviewResponse.ok) {
            console.error('❌ System overview endpoint failed:', overviewResponse.status, overviewResponse.statusText);
            const errorText = await overviewResponse.text();
            console.error('Error details:', errorText);
            return;
        }

        const overviewData = await overviewResponse.json();
        console.log('✅ System overview endpoint successful!');
        console.log('\n📈 System Overview:');
        console.log(`- Total members: ${overviewData.data?.TotalMembers || 0}`);
        console.log(`- Active members: ${overviewData.data?.ActiveMembers || 0}`);
        console.log(`- Active quit plans: ${overviewData.data?.ActiveQuitPlans || 0}`);
        console.log(`- High craving users: ${overviewData.data?.HighCravingUsers || 0}`);

        // Step 4: Test user-progress-analysis for a specific user
        console.log('\n4. Testing /api/admin/user-progress-analysis/2...');
        const progressResponse = await fetch(`${BASE_URL}/admin/user-progress-analysis/2`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Cookie': cookies || ''
            }
        });

        if (!progressResponse.ok) {
            console.error('❌ User progress analysis endpoint failed:', progressResponse.status, progressResponse.statusText);
            const errorText = await progressResponse.text();
            console.error('Error details:', errorText);
            return;
        }

        const progressData = await progressResponse.json();
        console.log('✅ User progress analysis endpoint successful!');
        console.log('\n👤 User Analysis for UserID 2:');
        console.log(`- User: ${progressData.data?.userInfo?.FirstName} ${progressData.data?.userInfo?.LastName}`);
        console.log(`- Quit plans: ${progressData.data?.quitPlans?.length || 0}`);
        console.log(`- Progress entries: ${progressData.data?.progressData?.length || 0}`);
        console.log(`- Achievements: ${progressData.data?.achievements?.length || 0}`);

        console.log('\n🎉 All User Activity Tracking endpoints are working correctly!');

    } catch (error) {
        console.error('❌ Error testing endpoints:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Run the test
testUserActivityEndpoint(); 
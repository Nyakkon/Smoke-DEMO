const axios = require('axios');

async function testUserActivity() {
    try {
        console.log('🔍 Testing user-activity endpoint...');

        // Admin login first
        const loginResponse = await axios.post('http://localhost:4000/api/admin/login', {
            email: 'admin@example.com',
            password: 'H12345678@'
        });

        if (!loginResponse.data.success) {
            console.error('❌ Login failed');
            return;
        }

        const token = loginResponse.data.token;
        console.log('✅ Admin login successful');

        // Test user-activity endpoint
        const activityResponse = await axios.get('http://localhost:4000/api/admin/user-activity', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (activityResponse.data.success) {
            console.log('✅ User activity endpoint works');

            const { usersInQuitProcess, usersNeedingSupport } = activityResponse.data.data;

            console.log(`📊 Users in quit process: ${usersInQuitProcess.length}`);
            console.log(`⚠️  Users needing support: ${usersNeedingSupport.length}`);

            // Check for duplicates in quit process
            const userIds = usersInQuitProcess.map(u => u.UserID);
            const uniqueUserIds = [...new Set(userIds)];

            if (userIds.length === uniqueUserIds.length) {
                console.log('✅ No duplicates found in users in quit process');
            } else {
                console.log(`❌ Found duplicates: ${userIds.length - uniqueUserIds.length} duplicate records`);

                // Find duplicated users
                const duplicates = userIds.filter((id, index) => userIds.indexOf(id) !== index);
                const uniqueDuplicates = [...new Set(duplicates)];
                console.log('Duplicated UserIDs:', uniqueDuplicates);
            }

            // Show sample data
            console.log('\n📋 Sample users in quit process:');
            usersInQuitProcess.slice(0, 3).forEach(user => {
                console.log(`- ${user.FirstName} ${user.LastName} (${user.Email}) - ${user.SupportStatus}`);
            });

            console.log('\n📋 Sample users needing support:');
            usersNeedingSupport.slice(0, 3).forEach(user => {
                console.log(`- ${user.FullName} - Priority: ${user.Priority} - Reason: ${user.SupportReason}`);
            });

        } else {
            console.error('❌ User activity endpoint failed:', activityResponse.data.message);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
    }
}

testUserActivity(); 
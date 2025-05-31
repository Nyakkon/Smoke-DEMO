const axios = require('axios');

async function testProfileWithManualToken() {
    console.log('🔍 Testing admin profile with manual token...');

    // MANUAL TOKEN - paste token from browser localStorage here
    const MANUAL_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTczMjUyMTI1MSwiZXhwIjoxNzMyNTUwMDUxfQ.example'; // Replace with real token

    // If no manual token provided, try to get from admin login with correct password
    let token = MANUAL_TOKEN;

    if (!token || token.includes('example')) {
        console.log('📝 Manual token not provided, trying common admin passwords...');

        // Try common passwords for admin@example.com
        const passwords = ['password', 'admin', '123456', 'admin123', 'Password123', 'admin@123'];

        for (const password of passwords) {
            try {
                console.log(`   Trying password: ${password}`);
                const loginResponse = await axios.post('http://localhost:4000/api/admin/login', {
                    email: 'admin@example.com',
                    password: password
                });

                if (loginResponse.data.success) {
                    token = loginResponse.data.token;
                    console.log(`✅ Login successful with password: ${password}`);
                    break;
                }
            } catch (error) {
                console.log(`   ❌ Failed with: ${error.response?.data?.message}`);
            }
        }
    }

    if (!token || token.includes('example')) {
        console.log('❌ No valid token available');
        console.log('💡 Please:');
        console.log('   1. Login via browser at http://localhost:3000/admin/login');
        console.log('   2. Open DevTools > Application > Local Storage');
        console.log('   3. Copy "adminToken" value');
        console.log('   4. Replace MANUAL_TOKEN in this file');
        return;
    }

    try {
        console.log('🔍 Testing profile API with token...');
        const response = await axios.get('http://localhost:4000/api/admin/profile', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('✅ Profile API successful!');
        console.log('📋 Response data:');
        console.log(JSON.stringify(response.data, null, 2));

        const profile = response.data.data;
        if (profile) {
            console.log('\n📄 Profile Summary:');
            console.log(`- Name: ${profile.FirstName} ${profile.LastName}`);
            console.log(`- Email: ${profile.Email}`);
            console.log(`- Phone: ${profile.PhoneNumber || 'Not set'}`);
            console.log(`- Address: ${profile.Address || 'Not set'}`);
            console.log(`- Role: ${profile.Role}`);
            console.log(`- Active: ${profile.IsActive}`);
            console.log(`- Email Verified: ${profile.EmailVerified}`);
            console.log(`- Created: ${new Date(profile.CreatedAt).toLocaleDateString()}`);
            console.log(`- Last Login: ${profile.LastLoginAt ? new Date(profile.LastLoginAt).toLocaleString() : 'Never'}`);

            if (profile.statistics) {
                console.log('\n📊 Statistics:');
                console.log(`- Members Managed: ${profile.statistics.TotalMembersManaged}`);
                console.log(`- Coaches Managed: ${profile.statistics.TotalCoachesManaged}`);
                console.log(`- Blog Posts: ${profile.statistics.TotalBlogPostsManaged}`);
                console.log(`- Payments Processed: ${profile.statistics.TotalPaymentsProcessed}`);
                console.log(`- Revenue Managed: ${profile.statistics.TotalRevenueManaged}`);
                console.log(`- Total Logins: ${profile.statistics.TotalLogins}`);
            }
        }

    } catch (error) {
        console.log('❌ Profile API failed:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Response:', error.response.data);
        }
    }
}

testProfileWithManualToken(); 
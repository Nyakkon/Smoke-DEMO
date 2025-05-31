const axios = require('axios');

// Set timeout for axios
axios.defaults.timeout = 10000;

async function testAdminProfile() {
    try {
        console.log('🔍 Testing admin profile endpoint...');

        // Check if server is running - test with a simple health check
        console.log('0. Checking if server is running...');
        try {
            // Test a simple endpoint that doesn't require auth
            const healthCheck = await axios.get('http://localhost:4000/', {
                timeout: 3000
            });
            console.log('✅ Server is running');
        } catch (serverError) {
            if (serverError.code === 'ECONNREFUSED') {
                console.log('❌ Server is not running on port 4000');
                console.log('💡 Please start the server with: cd server && npm start');
                return;
            } else {
                console.log('❌ Server error:', serverError.message);
            }
        }

        // Try different admin credentials
        const adminCredentials = [
            { email: 'admin@example.com', password: 'admin123' },
            { email: 'admin@demo.com', password: 'admin123' },
            { email: 'admin@admin.com', password: 'password' },
            { email: 'admin@smokekingapp.com', password: 'admin123' },
            { email: 'admin@example.com', password: 'password' }
        ];

        let token = null;

        console.log('1. Trying to login as admin with different credentials...');

        for (let i = 0; i < adminCredentials.length; i++) {
            const creds = adminCredentials[i];
            try {
                console.log(`   Trying ${creds.email} / ${creds.password}...`);

                const loginResponse = await axios.post('http://localhost:4000/api/admin/login', {
                    email: creds.email,
                    password: creds.password
                });

                if (loginResponse.data.success) {
                    token = loginResponse.data.token;
                    console.log(`✅ Admin login successful with ${creds.email}`);
                    break;
                } else {
                    console.log(`   ❌ Failed: ${loginResponse.data.message}`);
                }
            } catch (loginError) {
                console.log(`   ❌ Error: ${loginError.response?.data?.message || loginError.message}`);
            }
        }

        if (!token) {
            console.log('❌ Could not login with any credentials');
            console.log('💡 Please check admin credentials in database or create admin user');
            return;
        }

        // 2. Test profile endpoint
        console.log('2. Testing /api/admin/profile...');
        const profileResponse = await axios.get('http://localhost:4000/api/admin/profile', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('✅ Profile endpoint response status:', profileResponse.status);

        if (profileResponse.data.success) {
            console.log('✅ Admin profile endpoint successful!');
            console.log('📋 Profile data:');
            console.log('- Name:', profileResponse.data.data.FirstName, profileResponse.data.data.LastName);
            console.log('- Email:', profileResponse.data.data.Email);
            console.log('- Role:', profileResponse.data.data.Role);
            console.log('- Active:', profileResponse.data.data.IsActive);
            console.log('- Created:', new Date(profileResponse.data.data.CreatedAt).toLocaleString());
            console.log('- Statistics:');
            const stats = profileResponse.data.data.statistics;
            console.log('  - Total Members:', stats.TotalMembersManaged);
            console.log('  - Total Coaches:', stats.TotalCoachesManaged);
            console.log('  - Total Blog Posts:', stats.TotalBlogPostsManaged);
            console.log('  - Total Payments:', stats.TotalPaymentsProcessed);
            console.log('  - Total Revenue:', stats.TotalRevenueManaged);
            console.log('  - Total Logins:', stats.TotalLogins);
        } else {
            console.log('❌ Profile endpoint failed:', profileResponse.data.message);
        }

    } catch (error) {
        console.log('❌ Unexpected error:', error.message);
        if (error.response) {
            console.log('Response status:', error.response.status);
            console.log('Response data:', error.response.data);
        }
    }
}

testAdminProfile(); 
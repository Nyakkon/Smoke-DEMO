const axios = require('axios');

async function testProgressAPI() {
    try {
        console.log('🔍 Testing progress API...');

        // First, login to get a valid token
        console.log('🔐 Logging in to get token...');
        const loginResponse = await axios.post('http://localhost:4000/api/auth/login', {
            email: 'member@example.com',
            password: 'H12345678@'
        });

        if (!loginResponse.data.success) {
            console.error('❌ Login failed:', loginResponse.data.message);
            return;
        }

        const token = loginResponse.data.token;
        console.log('✅ Login successful, got token');

        // Test progress summary endpoint
        console.log('\n📊 Testing progress summary endpoint...');
        const summaryResponse = await axios.get('http://localhost:4000/api/progress/summary', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log('✅ Progress summary response:', summaryResponse.data);

        // Test progress streak endpoint
        console.log('\n🔥 Testing progress streak endpoint...');
        const streakResponse = await axios.get('http://localhost:4000/api/progress/streak', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log('✅ Progress streak response:', streakResponse.data);

        // Test user profile endpoint (corrected URL)
        console.log('\n👤 Testing user profile endpoint...');
        const profileResponse = await axios.get('http://localhost:4000/api/user/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log('✅ User profile response:', profileResponse.data);

        console.log('\n🎉 All API tests passed! The member dashboard should now work correctly.');

    } catch (error) {
        console.error('❌ API test failed:', error.response?.data || error.message);

        if (error.response?.status === 403) {
            console.log('💡 This might be a payment confirmation issue. The fix should resolve this.');
        }
    }
}

testProgressAPI(); 
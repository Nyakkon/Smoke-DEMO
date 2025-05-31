const axios = require('axios');

async function testWithLogin() {
    try {
        console.log('🔐 Logging in as coach...');

        // Login to get valid token - use the newly created coach account
        const loginResponse = await axios.post('http://localhost:4000/api/auth/login', {
            email: 'coach@smokeking.com',
            password: 'coach123'
        });

        console.log('✅ Login successful');
        const token = loginResponse.data.token;
        console.log('🎫 Token received:', token.substring(0, 20) + '...');

        console.log('\n🔍 Testing /api/chat/coach/members endpoint...');

        const response = await axios.get('http://localhost:4000/api/chat/coach/members', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ SUCCESS!');
        console.log('Response status:', response.status);
        console.log('Response data:', JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.log('❌ ERROR!');
        console.log('Status:', error.response?.status);
        console.log('Status text:', error.response?.statusText);
        console.log('Response data:', JSON.stringify(error.response?.data, null, 2));
        console.log('Error message:', error.message);
        console.log('URL:', error.config?.url);
    }
}

testWithLogin(); 
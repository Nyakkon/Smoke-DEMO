const axios = require('axios');

async function testUpdatedCode() {
    try {
        console.log('🔐 Logging in as coach...');

        // Login to get valid token
        const loginResponse = await axios.post('http://localhost:4000/api/auth/login', {
            email: 'coach@smokeking.com',
            password: 'coach123'
        });

        console.log('✅ Login successful');
        const token = loginResponse.data.token;

        console.log('\n🧪 Testing /api/chat/test-updated endpoint...');

        const response = await axios.get('http://localhost:4000/api/chat/test-updated', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ SUCCESS!');
        console.log('Response:', JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.log('❌ ERROR!');
        console.log('Status:', error.response?.status);
        console.log('Response data:', JSON.stringify(error.response?.data, null, 2));
        console.log('Error message:', error.message);
    }
}

testUpdatedCode(); 
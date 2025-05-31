const axios = require('axios');

async function testEndpoint() {
    try {
        console.log('🔍 Testing /api/chat/coach/members endpoint...');

        // Create a simple test token for coach
        const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsInJvbGUiOiJjb2FjaCIsImlhdCI6MTczNTY1NDgwMCwiZXhwIjoxNzM1NzQxMjAwfQ.B1WcXTi7Ll2fqgPq7N_YlZpDr3H2VAcNNSvw_wFN_2Y';

        const response = await axios.get('http://localhost:4000/api/chat/coach/members', {
            headers: {
                'Authorization': `Bearer ${testToken}`,
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
    }
}

testEndpoint(); 
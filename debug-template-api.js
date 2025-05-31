const axios = require('axios');

console.log('🔍 DEBUGGING TEMPLATE API ISSUE');
console.log('===============================\n');

// Test function
async function debugTemplateAPI() {
    const baseURL = 'http://localhost:4000';

    try {
        console.log('1. Testing server health...');
        const healthResponse = await axios.get(`${baseURL}/api/test-user-data`, {
            timeout: 5000
        });
        console.log('✅ Server is running');
        console.log('Server response:', healthResponse.data);

        console.log('\n2. Testing templates API without auth...');
        const templatesResponse = await axios.get(`${baseURL}/api/quit-plan/templates/all`, {
            timeout: 10000
        });
        console.log('✅ Templates API accessible');
        console.log('Response status:', templatesResponse.status);
        console.log('Response data:', JSON.stringify(templatesResponse.data, null, 2));

        console.log('\n3. Testing with specific token (if available)...');
        // This would be the actual token from localStorage
        const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInJvbGUiOiJtZW1iZXIiLCJpYXQiOjE3MzMzMzgzNDR9.example'; // Example token

        try {
            const authResponse = await axios.get(`${baseURL}/api/quit-plan`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });
            console.log('✅ Authenticated API working');
            console.log('Auth response data:', JSON.stringify(authResponse.data, null, 2));
        } catch (authError) {
            console.log('❌ Auth API failed (expected if token is invalid):', authError.message);
            console.log('Status:', authError.response?.status);
            console.log('Error data:', authError.response?.data);
        }

    } catch (error) {
        console.error('❌ Error during debug:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('💡 Server is not running. Please start the server first:');
            console.log('   cd server && npm start');
        } else {
            console.log('Full error:', error);
        }
    }
}

console.log('🚀 Starting debug...\n');
debugTemplateAPI(); 
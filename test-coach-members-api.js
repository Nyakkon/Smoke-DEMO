const axios = require('axios');

const BASE_URL = 'http://localhost:4000/api';

async function testCoachMembersAPI() {
    try {
        console.log('🔍 TESTING COACH MEMBERS API');
        console.log('=============================\n');

        // Test 1: Check server health
        console.log('1. 🔗 Testing server health...');
        try {
            const healthResponse = await axios.get('http://localhost:4000/health', { timeout: 5000 });
            console.log('✅ Server is running:', healthResponse.status);
        } catch (error) {
            console.log('❌ Server health check failed:', error.message);
            return;
        }

        // Test 2: Test authentication with coach credentials
        console.log('\n2. 🔐 Testing coach authentication...');
        let authToken;
        try {
            const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
                email: 'coach@example.com',
                password: 'password123'
            });

            if (loginResponse.data.success) {
                authToken = loginResponse.data.token;
                console.log('✅ Coach login successful');
                console.log('   UserID:', loginResponse.data.user.UserID);
                console.log('   Role:', loginResponse.data.user.Role);
            } else {
                console.log('❌ Coach login failed:', loginResponse.data.message);
                return;
            }
        } catch (error) {
            console.log('❌ Authentication error:', error.response?.data?.message || error.message);
            return;
        }

        // Test 3: Test the problematic endpoint
        console.log('\n3. 🎯 Testing /api/chat/coach/members endpoint...');
        try {
            const membersResponse = await axios.get(`${BASE_URL}/chat/coach/members`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (membersResponse.data.success) {
                console.log('✅ Members API successful');
                console.log('   Members found:', membersResponse.data.data.length);
                membersResponse.data.data.forEach((member, index) => {
                    console.log(`   ${index + 1}. ${member.FullName} (ID: ${member.UserID})`);
                });
            } else {
                console.log('❌ Members API failed:', membersResponse.data.message);
            }
        } catch (error) {
            console.log('❌ Members API error:');
            console.log('   Status:', error.response?.status);
            console.log('   Message:', error.response?.data?.message);
            console.log('   Error:', error.response?.data?.error);
            console.log('   Full error:', error.message);
        }

        // Test 4: Test direct database query
        console.log('\n4. 📊 Testing direct database query...');

        console.log('\n📋 To debug further, check:');
        console.log('1. Server logs for detailed error messages');
        console.log('2. Database connection');
        console.log('3. SQL query syntax');
        console.log('4. Network/CORS issues');

    } catch (error) {
        console.error('❌ Test script error:', error.message);
    }
}

// Run the test
testCoachMembersAPI(); 
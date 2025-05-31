const axios = require('axios');

const BASE_URL = 'http://localhost:4000/api';

async function testChatUIDebug() {
    try {
        console.log('🔍 DEBUGGING CHAT UI WHITE PAGE ISSUE');
        console.log('=====================================\n');

        // Test 1: Check if server is running
        console.log('1. 🔗 Testing server connection...');
        try {
            const healthResponse = await axios.get('http://localhost:4000/health', { timeout: 5000 });
            console.log('✅ Server is running');
        } catch (error) {
            console.log('❌ Server is NOT running or not responding');
            console.log('💡 Please start the server first: npm start or node server.js');
            return;
        }

        // Test 2: Test authentication
        console.log('\n2. 🔐 Testing coach login...');
        let token, coachData;
        try {
            const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
                email: 'coach@example.com',
                password: 'password123'
            });

            if (loginResponse.data.success) {
                token = loginResponse.data.token;
                coachData = loginResponse.data.user;
                console.log('✅ Coach login successful');
                console.log(`   Coach: ${coachData.FirstName} ${coachData.LastName} (ID: ${coachData.UserID})`);
            } else {
                console.log('❌ Coach login failed:', loginResponse.data.message);
                return;
            }
        } catch (error) {
            console.log('❌ Coach login error:', error.response?.data?.message || error.message);
            return;
        }

        const headers = { 'Authorization': `Bearer ${token}` };

        // Test 3: Test chat endpoints
        console.log('\n3. 📋 Testing chat endpoints...');

        // Test members endpoint
        try {
            const membersResponse = await axios.get(`${BASE_URL}/chat/coach/members`, { headers });
            if (membersResponse.data.success) {
                console.log(`✅ /chat/coach/members: Found ${membersResponse.data.data.length} members`);
                if (membersResponse.data.data.length > 0) {
                    membersResponse.data.data.forEach((member, index) => {
                        console.log(`   ${index + 1}. ${member.FullName} (${member.Email})`);
                    });
                }
            } else {
                console.log('❌ /chat/coach/members failed:', membersResponse.data.message);
            }
        } catch (error) {
            console.log('❌ /chat/coach/members error:', error.response?.data?.message || error.message);
        }

        // Test conversations endpoint
        try {
            const conversationsResponse = await axios.get(`${BASE_URL}/chat/coach/conversations`, { headers });
            if (conversationsResponse.data.success) {
                console.log(`✅ /chat/coach/conversations: Found ${conversationsResponse.data.data.length} conversations`);
            } else {
                console.log('❌ /chat/coach/conversations failed:', conversationsResponse.data.message);
            }
        } catch (error) {
            console.log('❌ /chat/coach/conversations error:', error.response?.data?.message || error.message);
        }

        // Test 4: Check if all required routes exist
        console.log('\n4. 🛣️ Testing required chat routes...');
        const routes = [
            '/chat/coach/members',
            '/chat/coach/conversations',
            '/chat/coach/start-conversation'
        ];

        for (const route of routes) {
            try {
                if (route === '/chat/coach/start-conversation') {
                    // POST route - test with dummy data
                    const response = await axios.post(`${BASE_URL}${route}`, { memberId: 999 }, { headers });
                    console.log(`✅ ${route}: Available (expected 404 for dummy ID)`);
                } else {
                    // GET route
                    const response = await axios.get(`${BASE_URL}${route}`, { headers });
                    console.log(`✅ ${route}: Available`);
                }
            } catch (error) {
                if (error.response?.status === 404 && route === '/chat/coach/start-conversation') {
                    console.log(`✅ ${route}: Available (404 for invalid member ID is expected)`);
                } else {
                    console.log(`❌ ${route}: Error - ${error.response?.data?.message || error.message}`);
                }
            }
        }

        console.log('\n🔧 TROUBLESHOOTING STEPS:');
        console.log('1. Open browser DevTools (F12)');
        console.log('2. Go to Console tab');
        console.log('3. Navigate to Chat page');
        console.log('4. Check for JavaScript errors');
        console.log('5. Check Network tab for failed API calls');
        console.log('\n💡 Common issues:');
        console.log('   - Server not running (restart: npm start)');
        console.log('   - CORS issues');
        console.log('   - Authentication token expired');
        console.log('   - Component import/export errors');
        console.log('   - Missing dependencies');

        console.log('\n📱 Frontend checklist:');
        console.log('   ✓ Check client/src/components/chat/CoachChat.jsx');
        console.log('   ✓ Check client/src/components/chat/MemberList.jsx');
        console.log('   ✓ Check client/src/components/chat/ConversationList.jsx');
        console.log('   ✓ Check client/src/components/chat/ChatBox.jsx');
        console.log('   ✓ Check imports in pages/CoachDashboard.jsx');

    } catch (error) {
        console.error('❌ Debug failed:', error.message);
    }
}

// Run the debug
testChatUIDebug(); 
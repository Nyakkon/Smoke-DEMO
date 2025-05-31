const axios = require('axios');

const BASE_URL = 'http://localhost:4000/api';

async function testCoachChatMembers() {
    try {
        console.log('🔍 TESTING COACH CHAT MEMBERS ISSUE');
        console.log('===================================\n');

        // Login as coach
        console.log('1. 🔐 Logging in as coach...');
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'coach@example.com',
            password: 'password123'
        });

        if (!loginResponse.data.success) {
            console.log('❌ Coach login failed:', loginResponse.data.message);
            return;
        }

        const token = loginResponse.data.token;
        const headers = { 'Authorization': `Bearer ${token}` };
        const coachData = loginResponse.data.user;
        console.log('✅ Coach login successful!');
        console.log(`   Coach: ${coachData.FirstName} ${coachData.LastName} (ID: ${coachData.UserID})`);

        // Test coach/members endpoint
        console.log('\n2. 📋 Testing /api/chat/coach/members...');
        try {
            const membersResponse = await axios.get(`${BASE_URL}/chat/coach/members`, { headers });
            if (membersResponse.data.success) {
                console.log('✅ Members endpoint success:');
                const members = membersResponse.data.data;
                console.log(`   Found ${members.length} members for this coach`);

                if (members.length > 0) {
                    members.forEach((member, index) => {
                        console.log(`   ${index + 1}. ${member.FullName} (${member.Email})`);
                        console.log(`      - Has conversation: ${member.HasConversation ? 'Yes' : 'No'}`);
                        console.log(`      - Quit plan status: ${member.QuitPlanStatus || 'None'}`);
                        console.log(`      - Assignment date: ${member.AssignmentDate || 'None'}`);
                    });
                } else {
                    console.log('❌ No members found for this coach');
                }
            } else {
                console.log('❌ Members endpoint failed:', membersResponse.data.message);
            }
        } catch (error) {
            console.log('❌ Members endpoint error:', error.response?.data?.message || error.message);
        }

        // Check if there are any quit plans assigned to this coach
        console.log('\n3. 🔍 Checking quit plans assigned to this coach...');
        // We'll need to create a separate script to check database directly

        console.log('\n💡 To fix this issue, we need to check:');
        console.log('   1. Are there any active QuitPlans?');
        console.log('   2. Are any members assigned to this coach?');
        console.log('   3. Is the query in chat.routes.js too restrictive?');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testCoachChatMembers(); 
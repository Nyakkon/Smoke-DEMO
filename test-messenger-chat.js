const axios = require('axios');

async function testMessengerChat() {
    try {
        console.log('🔐 Testing Messenger Chat Interface...');

        // Login as coach
        const coachLogin = await axios.post('http://localhost:4000/api/auth/login', {
            email: 'coach@smokeking.com',
            password: 'coach123'
        });

        const coachToken = coachLogin.data.token;
        console.log('✅ Coach logged in successfully');

        // Get members list
        console.log('\n📋 Getting members list...');
        const membersResponse = await axios.get('http://localhost:4000/api/chat/coach/members', {
            headers: { 'Authorization': `Bearer ${coachToken}` }
        });

        if (membersResponse.data.success && membersResponse.data.data.length > 0) {
            const member = membersResponse.data.data[0];
            console.log(`✅ Found member: ${member.FullName} (${member.Email})`);
            console.log(`   - Has conversation: ${member.HasConversation ? 'Yes' : 'No'}`);
            console.log(`   - Conversation ID: ${member.ConversationID || 'None'}`);
            console.log(`   - Unread count: ${member.UnreadCount}`);

            // Send test messages to create chat history
            if (member.ConversationID) {
                console.log('\n💬 Sending test messages...');

                const testMessages = [
                    'Xin chào! Tôi là coach Smith, tôi sẽ hỗ trợ bạn trong quá trình cai thuốc.',
                    'Hôm nay bạn cảm thấy thế nào? Có gặp khó khăn gì trong việc cai thuốc không?',
                    'Tôi có một vài lời khuyên để giúp bạn vượt qua cơn thèm thuốc. Bạn có muốn nghe không?'
                ];

                for (let i = 0; i < testMessages.length; i++) {
                    const message = testMessages[i];
                    try {
                        const messageResponse = await axios.post(
                            `http://localhost:4000/api/chat/conversation/${member.ConversationID}/send`,
                            {
                                content: message,
                                messageType: 'text'
                            },
                            {
                                headers: { 'Authorization': `Bearer ${coachToken}` }
                            }
                        );

                        if (messageResponse.data.success) {
                            console.log(`   ✅ Message ${i + 1} sent: "${message.substring(0, 30)}..."`);
                        }

                        // Wait a bit between messages
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } catch (error) {
                        console.log(`   ❌ Failed to send message ${i + 1}:`, error.response?.data?.message || error.message);
                    }
                }

                // Get conversation messages
                console.log('\n📬 Getting conversation messages...');
                const messagesResponse = await axios.get(
                    `http://localhost:4000/api/chat/conversation/${member.ConversationID}/messages`,
                    {
                        headers: { 'Authorization': `Bearer ${coachToken}` }
                    }
                );

                if (messagesResponse.data.success) {
                    console.log(`✅ Found ${messagesResponse.data.data.length} messages in conversation`);

                    console.log('\n💬 Recent messages:');
                    messagesResponse.data.data.slice(-5).forEach((msg, index) => {
                        const time = new Date(msg.CreatedAt).toLocaleTimeString('vi-VN');
                        console.log(`   ${index + 1}. [${time}] ${msg.SenderName}: ${msg.Content}`);
                    });
                } else {
                    console.log('❌ Failed to get messages');
                }
            }

            console.log('\n🎉 Messenger Chat Test Completed!');
            console.log('\n📱 To test the UI:');
            console.log('1. Go to http://localhost:3000/coach/dashboard');
            console.log('2. Click on "Chat" in the sidebar');
            console.log('3. You should see the member in the left sidebar');
            console.log('4. Click on the member to open the chat interface');
            console.log('5. You should see the test messages and can send new ones');

        } else {
            console.log('❌ No members found for coach');
        }

    } catch (error) {
        console.log('❌ ERROR!');
        console.log('Status:', error.response?.status);
        console.log('Response data:', JSON.stringify(error.response?.data, null, 2));
        console.log('Error message:', error.message);
    }
}

testMessengerChat(); 
const axios = require('axios');

async function testAdminMembersAPI() {
    try {
        console.log('🔍 TESTING ADMIN MEMBERS API');
        console.log('============================\n');

        // Test with admin token - you need to get this from browser
        // Go to browser console and run: localStorage.getItem('adminToken')
        const adminToken = 'YOUR_ADMIN_TOKEN'; // Replace this with actual token from browser

        if (adminToken === 'YOUR_ADMIN_TOKEN') {
            console.log('❌ Please replace YOUR_ADMIN_TOKEN with actual admin token from browser');
            console.log('To get token: Open browser -> F12 -> Console -> localStorage.getItem("adminToken")');
            return;
        }

        console.log('🔗 Testing admin members API...');
        const response = await axios.get('http://localhost:4000/api/admin/members', {
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            withCredentials: true
        });

        console.log('✅ API Response received');
        console.log('Status:', response.status);
        console.log('Success:', response.data.success);
        console.log('Total records:', response.data.data?.length);
        console.log('Message:', response.data.message);

        if (response.data.success && response.data.data) {
            console.log('\n📋 Member records:');
            response.data.data.forEach((member, index) => {
                console.log(`${index + 1}. ${member.FirstName} ${member.LastName} (${member.Email})`);
                console.log(`   UserID: ${member.UserID}`);
                console.log(`   CoachID: ${member.CoachID}`);
                console.log(`   CoachName: ${member.CoachName}`);
                console.log(`   IsActive: ${member.IsActive}`);
                console.log(`   CreatedAt: ${member.CreatedAt}`);
                console.log('');
            });

            // Check for actual duplicates
            const emails = response.data.data.map(m => m.Email);
            const uniqueEmails = [...new Set(emails)];

            console.log(`📊 Analysis:`);
            console.log(`- Total records: ${response.data.data.length}`);
            console.log(`- Unique emails: ${uniqueEmails.length}`);

            if (emails.length !== uniqueEmails.length) {
                console.log('❌ FOUND DUPLICATES IN API RESPONSE!');

                // Find duplicates
                const duplicates = emails.filter((email, index) => emails.indexOf(email) !== index);
                console.log('Duplicate emails:', [...new Set(duplicates)]);
            } else {
                console.log('✅ No duplicates in API response');
                console.log('🔍 Issue might be in frontend rendering or state management');
            }
        }

    } catch (error) {
        console.error('❌ Error testing API:', error.response?.data || error.message);

        if (error.response?.status === 401) {
            console.log('🔑 Authentication failed - token might be expired');
            console.log('Try getting a fresh token from browser');
        }
    }
}

console.log('⚠️  IMPORTANT: You need to update the adminToken variable first!');
console.log('1. Go to your browser where you\'re logged in as admin');
console.log('2. Open Developer Tools (F12)');
console.log('3. Go to Console tab');
console.log('4. Run: localStorage.getItem("adminToken")');
console.log('5. Copy the token and replace YOUR_ADMIN_TOKEN in this file');
console.log('6. Run this test again\n');

testAdminMembersAPI(); 
const axios = require('axios');

async function testSavingsAPI() {
    try {
        console.log('🧪 Testing Savings API...\n');

        // Test 1: Public summary endpoint
        console.log('📊 Testing PUBLIC summary (/api/progress/public-summary):');
        try {
            const publicResponse = await axios.get('http://localhost:4000/api/progress/public-summary');
            if (publicResponse.data.success) {
                console.log('✅ Public summary works:');
                console.log(`   Total Money Saved: ${publicResponse.data.data.TotalMoneySaved?.toLocaleString('vi-VN')} VNĐ`);
                console.log(`   Days Tracked: ${publicResponse.data.data.TotalDaysTracked}`);
                console.log(`   Cigarettes Not Smoked: ${publicResponse.data.data.CigarettesNotSmoked}`);
                console.log(`   Calculation: ${publicResponse.data.data.calculation?.description}`);
            } else {
                console.log('❌ Public summary failed:', publicResponse.data);
            }
        } catch (error) {
            console.log('❌ Public summary error:', error.message);
        }

        console.log('\n' + '='.repeat(60));

        // Test 2: Try different login credentials
        console.log('\n🔐 Testing login with different credentials:');

        const testCredentials = [
            { email: 'testuser@example.com', password: 'password123' },
            { email: 'member@example.com', password: 'password123' },
            { email: 'admin@example.com', password: 'admin123' },
            { email: 'test@example.com', password: 'test123' },
            { email: 'user@example.com', password: 'password' }
        ];

        let successfulLogin = null;

        for (const cred of testCredentials) {
            try {
                console.log(`   Trying ${cred.email}...`);
                const loginResponse = await axios.post('http://localhost:4000/api/auth/login', {
                    email: cred.email,
                    password: cred.password
                });

                if (loginResponse.data.success) {
                    console.log(`   ✅ Login successful with ${cred.email}!`);
                    successfulLogin = {
                        token: loginResponse.data.token,
                        user: loginResponse.data.user,
                        email: cred.email
                    };
                    break;
                }
            } catch (error) {
                console.log(`   ❌ Login failed: ${error.response?.data?.message || 'Unknown error'}`);
            }
        }

        if (successfulLogin) {
            const { token, user, email } = successfulLogin;
            console.log(`\n🎉 Using successful login: ${email} (Role: ${user?.Role || 'unknown'})`);

            // Test authenticated summary
            console.log('\n📈 Testing authenticated summary (/api/progress/summary):');
            try {
                const summaryResponse = await axios.get('http://localhost:4000/api/progress/summary', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (summaryResponse.data.success) {
                    console.log('✅ Authenticated summary works:');
                    console.log(`   Total Money Saved: ${summaryResponse.data.data.TotalMoneySaved?.toLocaleString('vi-VN')} VNĐ`);
                    console.log(`   Days Tracked: ${summaryResponse.data.data.TotalDaysTracked}`);
                    console.log(`   Smoke Free Days: ${summaryResponse.data.data.SmokeFreeDays}`);
                } else {
                    console.log('❌ Authenticated summary failed:', summaryResponse.data);
                }
            } catch (error) {
                console.log('❌ Authenticated summary error:', error.response?.data?.message || error.message);
            }

            // Test savings endpoint
            console.log('\n💰 Testing savings endpoint (/api/progress/savings):');
            try {
                const savingsResponse = await axios.get('http://localhost:4000/api/progress/savings', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (savingsResponse.data.success) {
                    console.log('✅ Savings endpoint works:');
                    console.log(`   Total Money Saved: ${savingsResponse.data.data.totalMoneySaved?.toLocaleString('vi-VN')} VNĐ`);
                    console.log(`   Cigarettes Not Smoked: ${savingsResponse.data.data.cigarettesNotSmoked}`);
                    console.log(`   Days Tracked: ${savingsResponse.data.data.daysTracked}`);
                    console.log(`   Daily Average Savings: ${savingsResponse.data.data.dailyAverageSavings?.toLocaleString('vi-VN')} VNĐ`);
                    console.log(`   Baseline: ${savingsResponse.data.data.baseline?.cigarettesPerDay} điếu/ngày × ${savingsResponse.data.data.baseline?.cigarettePrice?.toLocaleString('vi-VN')} VNĐ/điếu`);
                    console.log(`   Calculation: ${savingsResponse.data.data.calculation?.description}`);
                } else {
                    console.log('❌ Savings endpoint failed:', savingsResponse.data);
                }
            } catch (error) {
                console.log('❌ Savings endpoint error:', error.response?.status, error.response?.data?.message || error.message);
            }

        } else {
            console.log('\n❌ No successful login found. Cannot test authenticated endpoints.');
            console.log('   This could mean:');
            console.log('   1. No test users exist in database');
            console.log('   2. Database is not properly set up');
            console.log('   3. Auth system has issues');
        }

        console.log('\n🎯 Analysis:');
        console.log('============================================================');
        console.log('ISSUE: Tiền tiết kiệm hiển thị khác nhau ở các trang');
        console.log('');
        console.log('💡 SOLUTION APPROACHES:');
        console.log('1. 🔄 Make all components use the same endpoint');
        console.log('2. 🔧 Fix inconsistency between endpoints');
        console.log('3. 🎯 Update frontend to call /progress/summary consistently');
        console.log('');
        console.log('📊 CURRENT STATUS:');
        console.log('- Public summary: Works, shows realistic values');
        console.log('- Dashboard: Should use summary endpoint');
        console.log('- QuitPlanPage: Should use summary instead of savings');
        console.log('');
        console.log('🚀 NEXT STEPS:');
        console.log('1. Update QuitPlanPage to use /progress/summary');
        console.log('2. Remove hardcoded demo values');
        console.log('3. Test with real user login on browser');

    } catch (error) {
        console.error('❌ Test failed:', error.message);

        if (error.code === 'ECONNREFUSED') {
            console.log('\n🚨 Server is not running!');
            console.log('   Please start server with: cd server && npm start');
        }
    }
}

// Run the test
testSavingsAPI(); 
const fetch = require('node-fetch');

async function testServerConnection() {
    const BASE_URL = 'http://localhost:4000';

    try {
        console.log('🔍 Testing server connection...');

        // Test basic server connectivity
        const response = await fetch(`${BASE_URL}/api/health`, {
            method: 'GET'
        });

        if (response.ok) {
            console.log('✅ Server is running and responding');
            return true;
        } else {
            console.log(`❌ Server responded with status: ${response.status}`);
            return false;
        }
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.log('❌ Server is not running. Please start the server first.');
            console.log('   Run: cd server && npm start');
        } else {
            console.log('❌ Connection error:', error.message);
        }
        return false;
    }
}

// Test quick endpoint without auth
async function testQuickEndpoint() {
    try {
        console.log('\n🔍 Testing a simple endpoint...');

        const response = await fetch('http://localhost:4000/api/users/membership-plans', {
            method: 'GET'
        });

        if (response.ok) {
            console.log('✅ Basic API endpoint working');
            const data = await response.json();
            console.log('   Response:', data.success ? 'Success' : 'Failed');
        } else {
            console.log(`❌ Endpoint failed with status: ${response.status}`);
        }
    } catch (error) {
        console.log('❌ Endpoint test failed:', error.message);
    }
}

// Run tests
testServerConnection().then(async (isRunning) => {
    if (isRunning) {
        await testQuickEndpoint();
    }
}); 
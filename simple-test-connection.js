console.log('Testing server connection...');

const http = require('http');

const options = {
    hostname: 'localhost',
    port: 4000,
    path: '/api/users/membership-plans',
    method: 'GET'
};

const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Headers: ${JSON.stringify(res.headers)}`);

    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('Server is responding!');
        console.log('Response:', data.substring(0, 100) + '...');
    });
});

req.on('error', (e) => {
    console.error('Server connection failed:', e.message);
    console.log('Please start the server: cd server && npm start');
});

req.end(); 
const sql = require('mssql');

const config = {
    user: 'sa',
    password: '12345',
    server: 'localhost',
    database: 'SMOKEKING',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function checkTranHuyUser() {
    try {
        console.log('🔍 Connecting to database...');
        await sql.connect(config);

        console.log('📊 Checking for Tran Huy user...');

        // Check for user with ID 6
        const userById = await sql.query('SELECT * FROM Users WHERE UserID = 6');
        console.log('\n--- User with ID 6 ---');
        if (userById.recordset.length > 0) {
            console.table(userById.recordset);
        } else {
            console.log('❌ No user found with ID 6');
        }

        // Check for users with name containing "Tran" or "Huy"
        const usersByName = await sql.query("SELECT * FROM Users WHERE FirstName LIKE '%Tran%' OR LastName LIKE '%Huy%' OR FirstName LIKE '%Huy%' OR LastName LIKE '%Tran%'");
        console.log('\n--- Users with Tran/Huy in name ---');
        if (usersByName.recordset.length > 0) {
            console.table(usersByName.recordset);
        } else {
            console.log('❌ No users found with Tran/Huy in name');
        }

        // Check all users to see what we have
        const allUsers = await sql.query('SELECT UserID, FirstName, LastName, Email, Role, IsActive FROM Users ORDER BY UserID');
        console.log('\n--- All Users ---');
        console.table(allUsers.recordset);

    } catch (error) {
        console.error('❌ Database error:', error);
    } finally {
        await sql.close();
    }
}

checkTranHuyUser(); 
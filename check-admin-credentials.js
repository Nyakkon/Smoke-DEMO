const { pool } = require('./server/src/config/database');

async function checkAdminCredentials() {
    try {
        console.log('🔍 Checking admin credentials in database...');

        const result = await pool.request().query(`
            SELECT UserID, Email, Password, FirstName, LastName, Role, IsActive 
            FROM Users 
            WHERE Role = 'admin'
        `);

        if (result.recordset.length === 0) {
            console.log('❌ No admin users found in database');
            console.log('💡 You may need to create an admin user first');
        } else {
            console.log('✅ Admin users found:');
            result.recordset.forEach((admin, index) => {
                console.log(`\n${index + 1}. Admin User:`);
                console.log(`   - ID: ${admin.UserID}`);
                console.log(`   - Email: ${admin.Email}`);
                console.log(`   - Password: ${admin.Password}`);
                console.log(`   - Name: ${admin.FirstName} ${admin.LastName}`);
                console.log(`   - Role: ${admin.Role}`);
                console.log(`   - Active: ${admin.IsActive}`);
            });
        }

        process.exit(0);
    } catch (error) {
        console.log('❌ Error checking admin credentials:', error.message);
        process.exit(1);
    }
}

checkAdminCredentials(); 
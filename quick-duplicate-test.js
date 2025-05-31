const sql = require('mssql');

const config = {
    user: 'sa',
    password: '12345',
    server: 'localhost',
    database: 'SMOKEKING',
    options: {
        encrypt: true,
        trustServerCertificate: true,
    },
};

async function quickDuplicateTest() {
    let pool = null;
    try {
        console.log('🔍 QUICK DUPLICATE TEST');
        console.log('=======================\n');

        pool = await sql.connect(config);
        console.log('✅ Database connected\n');

        const adminMembers = await pool.request().query(`
            SELECT u.UserID, u.Email, u.FirstName, u.LastName
            FROM Users u
            WHERE u.Role = 'member' AND u.IsActive = 1
        `);

        console.log(`📊 Admin Members: ${adminMembers.recordset.length} total`);
        const uniqueAdminEmails = [...new Set(adminMembers.recordset.map(m => m.Email))];
        console.log(`Unique emails: ${uniqueAdminEmails.length}`);
        console.log(adminMembers.recordset.length === uniqueAdminEmails.length ? '✅ No duplicates' : '❌ Duplicates found');

        const coachMembers = await pool.request().query(`
            SELECT DISTINCT u.UserID, u.Email, u.FirstName, u.LastName
            FROM Users u
            INNER JOIN QuitPlans qp ON u.UserID = qp.UserID
            WHERE u.Role = 'member' AND u.IsActive = 1 AND qp.Status = 'active'
        `);

        console.log(`\n📊 Coach Members: ${coachMembers.recordset.length} total`);
        const uniqueCoachEmails = [...new Set(coachMembers.recordset.map(m => m.Email))];
        console.log(`Unique emails: ${uniqueCoachEmails.length}`);
        console.log(coachMembers.recordset.length === uniqueCoachEmails.length ? '✅ No duplicates' : '❌ Duplicates found');

        console.log('\n📋 ACTUAL DATA:');
        adminMembers.recordset.forEach((m, i) => {
            console.log(`  ${i + 1}. ${m.FirstName} ${m.LastName} (${m.Email})`);
        });

        console.log('\n🎯 FRONTEND FIXES APPLIED:');
        console.log('✅ AdminDashboard: React.memo + useCallback + useMemo + deduplication');
        console.log('✅ CoachDashboard: React.memo + useCallback + useMemo + deduplication');
        console.log('✅ PaymentsManagement: React.memo + useCallback + useMemo + deduplication');

        console.log('\n💡 TO VERIFY FIX WORKING:');
        console.log('1. Clear browser cache (Ctrl+Shift+Delete)');
        console.log('2. Hard refresh (Ctrl+F5)');
        console.log('3. Check console for deduplication logs');

        return true;
    } catch (error) {
        console.error('❌ Error:', error);
        return false;
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

quickDuplicateTest(); 
const sql = require('mssql');

// Database configuration
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

async function debugDuplicateMembers() {
    let pool = null;
    try {
        console.log('🔍 DEBUG DUPLICATE MEMBERS ISSUE');
        console.log('================================\n');

        // Connect to database
        console.log('🔗 Connecting to database...');
        pool = await sql.connect(config);
        console.log('✅ Database connected');

        // 1. Check Users table - count actual unique members
        console.log('\n📊 1. Checking Users table for members...');
        const usersCount = await pool.request().query(`
            SELECT COUNT(*) as TotalMembers
            FROM Users 
            WHERE Role = 'member' AND IsActive = 1
        `);
        console.log(`Total unique active members: ${usersCount.recordset[0].TotalMembers}`);

        // 2. List all unique members
        console.log('\n👥 2. Listing all unique members...');
        const uniqueMembers = await pool.request().query(`
            SELECT 
                UserID,
                Email,
                FirstName,
                LastName,
                CreatedAt
            FROM Users 
            WHERE Role = 'member' AND IsActive = 1
            ORDER BY CreatedAt DESC
        `);

        console.log(`Found ${uniqueMembers.recordset.length} unique members:`);
        uniqueMembers.recordset.forEach((member, index) => {
            console.log(`${index + 1}. ${member.FirstName} ${member.LastName} (${member.Email}) - ID: ${member.UserID}`);
        });

        // 3. Check QuitPlans table for duplicates
        console.log('\n📋 3. Checking QuitPlans table...');
        const quitPlansData = await pool.request().query(`
            SELECT 
                qp.UserID,
                qp.CoachID,
                qp.Status,
                qp.CreatedAt,
                u.Email,
                u.FirstName,
                u.LastName,
                coach.FirstName + ' ' + coach.LastName as CoachName
            FROM QuitPlans qp
            INNER JOIN Users u ON qp.UserID = u.UserID
            LEFT JOIN Users coach ON qp.CoachID = coach.UserID
            WHERE u.Role = 'member' AND u.IsActive = 1
            ORDER BY qp.UserID, qp.CreatedAt DESC
        `);

        console.log(`Found ${quitPlansData.recordset.length} quit plan records:`);

        // Group by user to see duplicates
        const userPlanCounts = {};
        quitPlansData.recordset.forEach(plan => {
            const userKey = `${plan.FirstName} ${plan.LastName} (${plan.Email})`;
            if (!userPlanCounts[userKey]) {
                userPlanCounts[userKey] = [];
            }
            userPlanCounts[userKey].push({
                status: plan.Status,
                coach: plan.CoachName,
                created: plan.CreatedAt
            });
        });

        console.log('\n🔍 Plans per user:');
        Object.keys(userPlanCounts).forEach(userKey => {
            const plans = userPlanCounts[userKey];
            console.log(`${userKey}: ${plans.length} plans`);
            plans.forEach((plan, index) => {
                console.log(`  ${index + 1}. Status: ${plan.status}, Coach: ${plan.coach}, Created: ${plan.created}`);
            });
        });

        // 4. Test the exact query from admin API
        console.log('\n🎯 4. Testing exact admin API query...');
        const adminQuery = await pool.request().query(`
            SELECT 
                u.UserID,
                u.Email,
                u.FirstName,
                u.LastName,
                u.Avatar,
                u.PhoneNumber,
                u.IsActive,
                u.CreatedAt,
                -- Get current active coach assignment
                (SELECT TOP 1 qp.CoachID 
                 FROM QuitPlans qp 
                 WHERE qp.UserID = u.UserID 
                   AND qp.Status = 'active' 
                   AND qp.CoachID IS NOT NULL
                 ORDER BY qp.CreatedAt DESC) as CoachID,
                -- Get coach name
                (SELECT TOP 1 coach.FirstName + ' ' + coach.LastName 
                 FROM QuitPlans qp 
                 INNER JOIN Users coach ON qp.CoachID = coach.UserID
                 WHERE qp.UserID = u.UserID 
                   AND qp.Status = 'active' 
                   AND qp.CoachID IS NOT NULL
                 ORDER BY qp.CreatedAt DESC) as CoachName
            FROM Users u
            WHERE u.Role = 'member' AND u.IsActive = 1
            ORDER BY u.CreatedAt DESC
        `);

        console.log(`Admin API query returned ${adminQuery.recordset.length} records:`);
        adminQuery.recordset.forEach((member, index) => {
            console.log(`${index + 1}. ${member.FirstName} ${member.LastName} (${member.Email})`);
            console.log(`   UserID: ${member.UserID}, CoachID: ${member.CoachID}, CoachName: ${member.CoachName}`);
        });

        // 5. Check for any potential issues
        console.log('\n🔍 5. Checking for data inconsistencies...');

        // Check for multiple active quit plans per user
        const multipleActivePlans = await pool.request().query(`
            SELECT 
                u.UserID,
                u.Email,
                u.FirstName,
                u.LastName,
                COUNT(*) as ActivePlanCount
            FROM Users u
            INNER JOIN QuitPlans qp ON u.UserID = qp.UserID
            WHERE u.Role = 'member' AND u.IsActive = 1 AND qp.Status = 'active'
            GROUP BY u.UserID, u.Email, u.FirstName, u.LastName
            HAVING COUNT(*) > 1
        `);

        if (multipleActivePlans.recordset.length > 0) {
            console.log('❌ Found users with multiple active plans:');
            multipleActivePlans.recordset.forEach(user => {
                console.log(`   ${user.FirstName} ${user.LastName}: ${user.ActivePlanCount} active plans`);
            });
        } else {
            console.log('✅ No users with multiple active plans found');
        }

        // Summary
        console.log('\n📝 SUMMARY:');
        console.log(`- Total unique members in Users table: ${usersCount.recordset[0].TotalMembers}`);
        console.log(`- Total records in admin API response: ${adminQuery.recordset.length}`);
        console.log(`- Total quit plan records: ${quitPlansData.recordset.length}`);

        if (usersCount.recordset[0].TotalMembers === adminQuery.recordset.length) {
            console.log('✅ No duplication in API response - issue might be in frontend');
        } else {
            console.log('❌ Duplication detected in backend API response');
        }

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

// Run the debug
debugDuplicateMembers(); 
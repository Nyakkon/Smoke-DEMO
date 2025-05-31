const sql = require('mssql');

// Database config
const config = {
    user: 'sa',
    password: '123',
    server: 'localhost',
    database: 'SMOKEKING',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function debugAssignments() {
    let pool;
    try {
        console.log('🔍 === DEBUGGING COACH ASSIGNMENTS ===');

        // Connect to database
        pool = await sql.connect(config);
        console.log('✅ Connected to database');

        // 1. Check all users
        console.log('\n1. All Users:');
        const users = await pool.request().query(`
            SELECT UserID, Email, FirstName, LastName, Role, IsActive
            FROM Users 
            ORDER BY UserID
        `);
        console.table(users.recordset);

        // 2. Check all QuitPlans
        console.log('\n2. All QuitPlans:');
        const quitPlans = await pool.request().query(`
            SELECT 
                qp.PlanID,
                qp.UserID,
                qp.CoachID,
                qp.Status,
                qp.StartDate,
                qp.CreatedAt,
                u.FirstName + ' ' + u.LastName as MemberName,
                c.FirstName + ' ' + c.LastName as CoachName
            FROM QuitPlans qp
            LEFT JOIN Users u ON qp.UserID = u.UserID
            LEFT JOIN Users c ON qp.CoachID = c.UserID
            ORDER BY qp.CreatedAt DESC
        `);
        console.table(quitPlans.recordset);

        // 3. Check specific assignment for user "Tran Huy"
        console.log('\n3. Looking for Tran Huy assignments:');
        const tranHuyAssignments = await pool.request().query(`
            SELECT 
                qp.PlanID,
                qp.UserID,
                qp.CoachID,
                qp.Status,
                u.FirstName + ' ' + u.LastName as MemberName,
                u.Email as MemberEmail,
                c.FirstName + ' ' + c.LastName as CoachName,
                c.Email as CoachEmail
            FROM QuitPlans qp
            INNER JOIN Users u ON qp.UserID = u.UserID
            LEFT JOIN Users c ON qp.CoachID = c.UserID
            WHERE (u.FirstName LIKE '%Tran%' OR u.LastName LIKE '%Huy%')
            ORDER BY qp.CreatedAt DESC
        `);
        console.table(tranHuyAssignments.recordset);

        // 4. Test assigned coach API for each user
        console.log('\n4. Testing assigned coach logic:');
        for (const user of users.recordset.filter(u => u.Role === 'member')) {
            console.log(`\n--- Testing user: ${user.FirstName} ${user.LastName} (ID: ${user.UserID}) ---`);

            const assignedCoach = await pool.request()
                .input('UserID', user.UserID)
                .query(`
                    SELECT 
                        c.UserID as CoachID,
                        c.FirstName + ' ' + c.LastName as CoachName,
                        c.Email as CoachEmail,
                        qp.Status as QuitPlanStatus
                    FROM QuitPlans qp
                    INNER JOIN Users c ON qp.CoachID = c.UserID
                    WHERE qp.UserID = @UserID 
                        AND qp.Status = 'active'
                        AND qp.CoachID IS NOT NULL
                        AND c.Role = 'coach'
                        AND c.IsActive = 1
                `);

            if (assignedCoach.recordset.length > 0) {
                console.log('✅ Assigned coach:', assignedCoach.recordset[0]);
            } else {
                console.log('❌ No assigned coach found');
            }
        }

    } catch (error) {
        console.error('❌ Debug error:', error);
    } finally {
        if (pool) {
            await pool.close();
        }
        process.exit(0);
    }
}

debugAssignments(); 
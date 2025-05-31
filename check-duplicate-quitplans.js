const sql = require('mssql');

async function checkDuplicates() {
    try {
        const config = {
            user: 'sa',
            password: 'Aa123456789@',
            server: 'localhost',
            database: 'SMOKEKING',
            options: {
                encrypt: true,
                trustServerCertificate: true
            }
        };

        await sql.connect(config);
        console.log('✅ Connected to database');

        // Check QuitPlans for UserID 6 (Tran Huy)
        const quitPlansQuery = `
            SELECT UserID, PlanID, Status, CreatedAt, CoachID
            FROM QuitPlans 
            WHERE UserID = 6
            ORDER BY CreatedAt DESC
        `;

        const result = await sql.query(quitPlansQuery);
        console.log(`\n📋 QuitPlans for UserID 6 (Tran Huy):`);
        result.recordset.forEach((plan, index) => {
            console.log(`${index + 1}. PlanID: ${plan.PlanID}, Status: ${plan.Status}, Created: ${plan.CreatedAt}, Coach: ${plan.CoachID}`);
        });

        // Check all active QuitPlans by user
        const activeQuery = `
            SELECT UserID, COUNT(*) as ActivePlansCount
            FROM QuitPlans 
            WHERE Status = 'active'
            GROUP BY UserID
            HAVING COUNT(*) > 1
            ORDER BY ActivePlansCount DESC
        `;

        const activeResult = await sql.query(activeQuery);
        console.log(`\n⚠️  Users with multiple active QuitPlans:`);
        activeResult.recordset.forEach(user => {
            console.log(`- UserID: ${user.UserID}, Active Plans: ${user.ActivePlansCount}`);
        });

        // Show all active plans with user info
        const allActiveQuery = `
            SELECT u.UserID, u.FirstName, u.LastName, u.Email, qp.PlanID, qp.CreatedAt, qp.CoachID
            FROM QuitPlans qp
            JOIN Users u ON qp.UserID = u.UserID
            WHERE qp.Status = 'active'
            ORDER BY u.UserID, qp.CreatedAt DESC
        `;

        const allActiveResult = await sql.query(allActiveQuery);
        console.log(`\n📊 All active QuitPlans:`);
        allActiveResult.recordset.forEach(plan => {
            console.log(`- ${plan.FirstName} ${plan.LastName} (${plan.UserID}) - Plan: ${plan.PlanID}, Created: ${plan.CreatedAt.toISOString().split('T')[0]}`);
        });

        await sql.close();

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkDuplicates(); 
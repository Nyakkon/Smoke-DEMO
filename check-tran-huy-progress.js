const sql = require('mssql');

async function checkTranHuyProgress() {
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

        // Check Tran Huy's UserID
        const userQuery = `
            SELECT UserID, Email, FirstName, LastName
            FROM Users 
            WHERE Email LIKE '%leghenkiz%' OR FirstName LIKE '%Tran%'
        `;
        const userResult = await sql.query(userQuery);
        console.log('\n📋 Tran Huy user info:');
        console.log(userResult.recordset);

        if (userResult.recordset.length > 0) {
            const tranHuyUserID = userResult.recordset[0].UserID;

            // Check QuitPlans for Tran Huy
            const quitPlanQuery = `
                SELECT PlanID, UserID, Status, StartDate, CreatedAt
                FROM QuitPlans 
                WHERE UserID = ${tranHuyUserID}
                ORDER BY CreatedAt DESC
            `;
            const quitPlanResult = await sql.query(quitPlanQuery);
            console.log('\n🎯 Tran Huy quit plans:');
            console.log(quitPlanResult.recordset);

            // Check ProgressTracking for Tran Huy
            const progressQuery = `
                SELECT TOP 10 *
                FROM ProgressTracking 
                WHERE UserID = ${tranHuyUserID}
                ORDER BY Date DESC
            `;
            const progressResult = await sql.query(progressQuery);
            console.log('\n📊 Tran Huy progress tracking (latest 10):');
            console.log(progressResult.recordset);

            // Test the exact query used in API
            const apiQuery = `
                SELECT 
                    u.UserID,
                    u.FirstName,
                    u.LastName,
                    pt.Date as LastProgressDate,
                    pt.CigarettesSmoked as LastCigarettesSmoked,
                    pt.CravingLevel as LastCravingLevel,
                    pt.DaysSmokeFree as CurrentDaysSmokeFree,
                    pt.MoneySaved as TotalMoneySaved
                FROM Users u
                INNER JOIN QuitPlans qp ON u.UserID = qp.UserID AND qp.Status = 'active'
                LEFT JOIN (
                    SELECT UserID, Date, CigarettesSmoked, CravingLevel, DaysSmokeFree, MoneySaved,
                           ROW_NUMBER() OVER (PARTITION BY UserID ORDER BY Date DESC) as rn
                    FROM ProgressTracking
                ) pt ON u.UserID = pt.UserID AND pt.rn = 1
                WHERE u.UserID = ${tranHuyUserID}
            `;
            const apiResult = await sql.query(apiQuery);
            console.log('\n🔍 API Query result for Tran Huy:');
            console.log(apiResult.recordset);
        }

        await sql.close();
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

checkTranHuyProgress(); 
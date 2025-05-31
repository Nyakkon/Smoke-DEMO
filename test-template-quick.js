const { pool } = require('./server/src/config/database');

console.log('🔍 QUICK TEMPLATE TEST');
console.log('====================\n');

async function testTemplateQuick() {
    try {
        console.log('1. Creating test user...');

        // Create test user
        const userResult = await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'testtemplate')
            BEGIN
                INSERT INTO Users (Username, Email, Password, Role, IsActive, IsActivated)
                VALUES ('testtemplate', 'testtemplate@test.com', 'hashedpassword', 'member', 1, 1)
            END
            
            SELECT UserID FROM Users WHERE Username = 'testtemplate'
        `);

        const userId = userResult.recordset[0].UserID;
        console.log('✅ User ID:', userId);

        console.log('2. Creating test payment...');

        // Create test payment  
        await pool.request()
            .input('UserID', userId)
            .query(`
                IF NOT EXISTS (SELECT 1 FROM Payments WHERE UserID = @UserID)
                BEGIN
                    INSERT INTO Payments (UserID, PlanID, Amount, Status, PaymentDate, StartDate, EndDate)
                    VALUES (@UserID, 2, 299000, 'confirmed', GETDATE(), GETDATE(), DATEADD(MONTH, 1, GETDATE()))
                END
            `);

        console.log('✅ Payment created');

        console.log('3. Creating payment confirmation...');

        // Create payment confirmation
        const paymentId = await pool.request()
            .input('UserID', userId)
            .query(`SELECT PaymentID FROM Payments WHERE UserID = @UserID`);

        await pool.request()
            .input('PaymentID', paymentId.recordset[0].PaymentID)
            .query(`
                IF NOT EXISTS (SELECT 1 FROM PaymentConfirmations WHERE PaymentID = @PaymentID)
                BEGIN
                    INSERT INTO PaymentConfirmations (PaymentID, ConfirmationDate, Notes)
                    VALUES (@PaymentID, GETDATE(), 'Auto test confirmation')
                END
            `);

        console.log('✅ Payment confirmation created');

        console.log('4. Testing template query...');

        // Test template query from backend
        const templateQuery = `
            SELECT 
                pt.TemplateID,
                pt.PhaseName,
                pt.PhaseDescription,
                pt.DurationDays,
                pt.SortOrder,
                mp.Name as PlanName,
                mp.Description as PlanDescription
            FROM PlanTemplates pt
            JOIN MembershipPlans mp ON pt.PlanID = mp.PlanID
            WHERE mp.PlanID IN (
                SELECT DISTINCT p.PlanID 
                FROM Payments p 
                WHERE p.UserID = @UserID 
                    AND p.Status IN ('confirmed', 'pending')
            )
            ORDER BY pt.SortOrder
        `;

        const templateResult = await pool.request()
            .input('UserID', userId)
            .query(templateQuery);

        console.log('📋 Template results:');
        console.log('Count:', templateResult.recordset.length);
        templateResult.recordset.forEach((phase, index) => {
            console.log(`${index + 1}. ${phase.PhaseName} (${phase.DurationDays} ngày)`);
            console.log(`   ${phase.PhaseDescription.substring(0, 100)}...`);
        });

        console.log('\n5. Testing access query...');

        // Test access query
        const accessQuery = `
            SELECT TOP 1 
                pc.ConfirmationID,
                pc.ConfirmationDate,
                p.PaymentID,
                p.Amount,
                p.Status as PaymentStatus,
                mp.Name as PlanName,
                p.StartDate,
                p.EndDate
            FROM PaymentConfirmations pc
            JOIN Payments p ON pc.PaymentID = p.PaymentID
            JOIN MembershipPlans mp ON p.PlanID = mp.PlanID
            WHERE p.UserID = @UserID 
            AND p.Status = 'confirmed'
            ORDER BY pc.ConfirmationDate DESC
        `;

        const accessResult = await pool.request()
            .input('UserID', userId)
            .query(accessQuery);

        console.log('🔑 Access check result:');
        if (accessResult.recordset.length > 0) {
            console.log('✅ User has access');
            console.log('Plan:', accessResult.recordset[0].PlanName);
            console.log('Status:', accessResult.recordset[0].PaymentStatus);
        } else {
            console.log('❌ User has no access');
        }

        console.log('\n🎯 Test completed!');
        console.log('📝 To test in frontend:');
        console.log(`   Username: testtemplate`);
        console.log(`   UserID: ${userId}`);
        console.log('   Templates should appear for this user');

    } catch (error) {
        console.error('❌ Error in test:', error);
    }
}

testTemplateQuick(); 
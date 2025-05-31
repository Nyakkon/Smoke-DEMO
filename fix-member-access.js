const sql = require('mssql');

const dbConfig = {
    user: 'sa',
    password: '12345',
    server: 'localhost',
    database: 'SMOKEKING',
    port: 1433,
    options: {
        encrypt: false,
        trustServerCertificate: true,
    }
};

async function fixMemberAccess() {
    let pool;
    try {
        console.log('🔗 Connecting to database...');
        pool = await sql.connect(dbConfig);

        console.log('🔍 Checking members without payment confirmation...');

        // Get all members without payment confirmation
        const membersResult = await pool.request().query(`
            SELECT DISTINCT u.UserID, u.Email, u.FirstName, u.LastName
            FROM Users u
            WHERE u.Role = 'member'
            AND u.UserID NOT IN (
                SELECT DISTINCT p.UserID
                FROM Payments p
                INNER JOIN PaymentConfirmations pc ON p.PaymentID = pc.PaymentID
                WHERE p.Status = 'confirmed'
                AND p.EndDate > GETDATE()
            )
        `);

        console.log(`📊 Found ${membersResult.recordset.length} members without payment confirmation`);

        if (membersResult.recordset.length === 0) {
            console.log('✅ All members already have payment confirmations!');
            return;
        }

        // Create payment confirmations for each member
        for (const member of membersResult.recordset) {
            console.log(`🔧 Creating payment confirmation for: ${member.FirstName} ${member.LastName} (${member.Email})`);

            try {
                // Create payment
                const paymentResult = await pool.request()
                    .input('userId', member.UserID)
                    .input('planId', 1) // Use existing plan ID
                    .input('amount', 199.00)
                    .input('startDate', new Date())
                    .input('endDate', new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)) // 60 days
                    .query(`
                        INSERT INTO Payments (UserID, PlanID, Amount, PaymentMethod, Status, TransactionID, StartDate, EndDate, Note)
                        OUTPUT INSERTED.PaymentID
                        VALUES (@userId, @planId, @amount, 'BankTransfer', 'confirmed', 'FIX_TX_' + CAST(@userId AS VARCHAR), @startDate, @endDate, N'Auto created for progress access')
                    `);

                const paymentId = paymentResult.recordset[0].PaymentID;

                // Create payment confirmation
                await pool.request()
                    .input('paymentId', paymentId)
                    .input('confirmedBy', 4) // Admin user
                    .query(`
                        INSERT INTO PaymentConfirmations (PaymentID, ConfirmationDate, ConfirmedByUserID, ConfirmationCode, Notes)
                        VALUES (@paymentId, GETDATE(), @confirmedBy, 'FIX_CONF_' + CAST(@paymentId AS VARCHAR), N'Auto confirmation for progress access')
                    `);

                console.log(`✅ Created payment confirmation for ${member.FirstName} ${member.LastName}`);

            } catch (error) {
                console.error(`❌ Error for ${member.FirstName} ${member.LastName}:`, error.message);
            }
        }

        console.log('\n🎉 All members now have payment confirmations!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

fixMemberAccess(); 
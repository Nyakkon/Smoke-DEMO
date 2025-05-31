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

async function debugPaymentIssue() {
    let pool;
    try {
        console.log('🔗 Connecting to database...');
        pool = await sql.connect(dbConfig);

        // Check member user
        console.log('🔍 Checking member user...');
        const memberResult = await pool.request()
            .input('email', 'member@example.com')
            .query(`
                SELECT UserID, Email, FirstName, LastName, Role, IsActive, EmailVerified
                FROM Users 
                WHERE Email = @email
            `);

        if (memberResult.recordset.length === 0) {
            console.log('❌ Member user not found!');
            return;
        }

        const member = memberResult.recordset[0];
        console.log('👤 Member found:', member);

        // Check payments for this member
        console.log('\n💳 Checking payments for member...');
        const paymentsResult = await pool.request()
            .input('userId', member.UserID)
            .query(`
                SELECT p.PaymentID, p.Status, p.StartDate, p.EndDate, p.Amount,
                       pc.ConfirmationID, pc.ConfirmationDate
                FROM Payments p
                LEFT JOIN PaymentConfirmations pc ON p.PaymentID = pc.PaymentID
                WHERE p.UserID = @userId
                ORDER BY p.PaymentID DESC
            `);

        console.log('💳 Payments found:', paymentsResult.recordset);

        // Check the access query that the middleware uses
        console.log('\n🔍 Testing access query...');
        const accessResult = await pool.request()
            .input('userId', member.UserID)
            .query(`
                SELECT DISTINCT p.UserID, 'payment' as source
                FROM Payments p
                INNER JOIN PaymentConfirmations pc ON p.PaymentID = pc.PaymentID
                WHERE p.UserID = @userId 
                AND p.Status = 'confirmed'
                AND p.EndDate > GETDATE()
                
                UNION
                
                SELECT UserID, 'role' as source
                FROM Users 
                WHERE UserID = @userId 
                AND Role IN ('coach', 'admin')
            `);

        console.log('🔍 Access query result:', accessResult.recordset);

        if (accessResult.recordset.length === 0) {
            console.log('\n❌ Member does not have access. Creating proper payment confirmation...');

            // Create a new payment with proper confirmation
            const paymentResult = await pool.request()
                .input('userId', member.UserID)
                .input('planId', 1)
                .input('amount', 199.00)
                .input('startDate', new Date())
                .input('endDate', new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)) // 60 days
                .query(`
                    INSERT INTO Payments (UserID, PlanID, Amount, PaymentMethod, Status, TransactionID, StartDate, EndDate, Note)
                    OUTPUT INSERTED.PaymentID
                    VALUES (@userId, @planId, @amount, 'BankTransfer', 'confirmed', 'DEBUG_TX_' + CAST(@userId AS VARCHAR), @startDate, @endDate, N'Debug payment for access')
                `);

            const paymentId = paymentResult.recordset[0].PaymentID;
            console.log('💳 Created payment ID:', paymentId);

            // Create payment confirmation
            await pool.request()
                .input('paymentId', paymentId)
                .input('confirmedBy', 4) // Admin user
                .query(`
                    INSERT INTO PaymentConfirmations (PaymentID, ConfirmationDate, ConfirmedByUserID, ConfirmationCode, Notes)
                    VALUES (@paymentId, GETDATE(), @confirmedBy, 'DEBUG_CONF_' + CAST(@paymentId AS VARCHAR), N'Debug confirmation for access')
                `);

            console.log('✅ Created payment confirmation');

            // Test access again
            const newAccessResult = await pool.request()
                .input('userId', member.UserID)
                .query(`
                    SELECT DISTINCT p.UserID, 'payment' as source
                    FROM Payments p
                    INNER JOIN PaymentConfirmations pc ON p.PaymentID = pc.PaymentID
                    WHERE p.UserID = @userId 
                    AND p.Status = 'confirmed'
                    AND p.EndDate > GETDATE()
                `);

            console.log('🔍 New access query result:', newAccessResult.recordset);

            if (newAccessResult.recordset.length > 0) {
                console.log('✅ Member now has access!');
            } else {
                console.log('❌ Still no access - there might be another issue');
            }
        } else {
            console.log('✅ Member already has access!');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

debugPaymentIssue(); 
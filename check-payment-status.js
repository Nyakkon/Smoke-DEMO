const { pool, connectDB } = require('./server/src/config/database');

async function checkPaymentStatus() {
    try {
        console.log('🔗 Connecting to database...');
        await connectDB();

        console.log('🔍 Checking user payment status...');

        const result = await pool.request().query(`
            SELECT 
                u.UserID, 
                u.Email, 
                u.FirstName, 
                u.LastName, 
                u.Role,
                p.PaymentID, 
                p.Status as PaymentStatus, 
                pc.ConfirmationID,
                p.EndDate
            FROM Users u
            LEFT JOIN Payments p ON u.UserID = p.UserID
            LEFT JOIN PaymentConfirmations pc ON p.PaymentID = pc.PaymentID
            WHERE u.Role = 'member'
            ORDER BY u.UserID
        `);

        console.log('📊 Users and their payment status:');
        console.table(result.recordset);

        // Check which users need payment confirmation
        const usersWithoutPayment = result.recordset.filter(user => !user.ConfirmationID);

        if (usersWithoutPayment.length > 0) {
            console.log('\n❌ Users without payment confirmation:');
            usersWithoutPayment.forEach(user => {
                console.log(`- ${user.FirstName} ${user.LastName} (${user.Email}) - UserID: ${user.UserID}`);
            });

            console.log('\n🔧 Creating payment confirmations for these users...');

            for (const user of usersWithoutPayment) {
                await createPaymentConfirmation(user.UserID);
            }
        } else {
            console.log('\n✅ All members have payment confirmations!');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

async function createPaymentConfirmation(userId) {
    try {
        console.log(`🔧 Creating payment confirmation for UserID: ${userId}`);

        // Create payment first
        const planId = 1; // Basic Plan
        const amount = 99.00;
        const startDate = new Date();
        const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

        const paymentResult = await pool.request()
            .input('userId', userId)
            .input('planId', planId)
            .input('amount', amount)
            .input('startDate', startDate)
            .input('endDate', endDate)
            .query(`
                INSERT INTO Payments (UserID, PlanID, Amount, PaymentMethod, Status, TransactionID, StartDate, EndDate, Note)
                OUTPUT INSERTED.PaymentID
                VALUES (@userId, @planId, @amount, 'BankTransfer', 'confirmed', 'AUTO_TX_' + CAST(@userId AS VARCHAR), @startDate, @endDate, N'Auto created payment for progress access')
            `);

        const paymentId = paymentResult.recordset[0].PaymentID;

        // Create payment confirmation
        await pool.request()
            .input('paymentId', paymentId)
            .input('confirmedBy', 3) // Admin user
            .query(`
                INSERT INTO PaymentConfirmations (PaymentID, ConfirmationDate, ConfirmedByUserID, ConfirmationCode, Notes)
                VALUES (@paymentId, GETDATE(), @confirmedBy, 'AUTO_CONF_' + CAST(@paymentId AS VARCHAR), N'Auto confirmation for progress access')
            `);

        console.log(`✅ Created payment confirmation for UserID: ${userId}`);

    } catch (error) {
        console.error(`❌ Error creating payment confirmation for UserID ${userId}:`, error.message);
    }
}

// Run the check
checkPaymentStatus().then(() => {
    console.log('\n🎉 Payment status check completed!');
    process.exit(0);
}).catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
}); 
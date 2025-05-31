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

async function fixPaymentFinal() {
    let pool;
    try {
        console.log('🔗 Connecting to database...');
        pool = await sql.connect(dbConfig);

        // Check available membership plans
        console.log('📋 Checking available membership plans...');
        const plansResult = await pool.request().query(`
            SELECT PlanID, Name, Price, Duration
            FROM MembershipPlans
            ORDER BY PlanID
        `);

        console.log('📋 Available plans:', plansResult.recordset);

        if (plansResult.recordset.length === 0) {
            console.log('❌ No membership plans found! Creating one...');

            // Create a membership plan
            const createPlanResult = await pool.request()
                .input('name', 'Premium Plan')
                .input('description', 'Gói cao cấp có hỗ trợ nâng cao.')
                .input('price', 199.00)
                .input('duration', 60)
                .input('features', 'Theo dõi tiến trình, Phân tích nâng cao, Chiến lược bỏ thuốc cao cấp, Truy cập cộng đồng, Động lực hàng tuần, Được coach tư vấn qua chat và có thể đặt lịch')
                .query(`
                    INSERT INTO MembershipPlans (Name, Description, Price, Duration, Features)
                    OUTPUT INSERTED.PlanID
                    VALUES (@name, @description, @price, @duration, @features)
                `);

            console.log('✅ Created membership plan with ID:', createPlanResult.recordset[0].PlanID);
        }

        // Get the first available plan
        const availablePlansResult = await pool.request().query(`
            SELECT TOP 1 PlanID, Name, Price, Duration
            FROM MembershipPlans
            ORDER BY PlanID
        `);

        const plan = availablePlansResult.recordset[0];
        console.log('📋 Using plan:', plan);

        // Check member user
        const memberResult = await pool.request()
            .input('email', 'member@example.com')
            .query(`
                SELECT UserID, Email, FirstName, LastName
                FROM Users 
                WHERE Email = @email
            `);

        const member = memberResult.recordset[0];
        console.log('👤 Member:', member);

        // Check if member already has valid payment
        const existingPaymentResult = await pool.request()
            .input('userId', member.UserID)
            .query(`
                SELECT DISTINCT p.UserID
                FROM Payments p
                INNER JOIN PaymentConfirmations pc ON p.PaymentID = pc.PaymentID
                WHERE p.UserID = @userId 
                AND p.Status = 'confirmed'
                AND p.EndDate > GETDATE()
            `);

        if (existingPaymentResult.recordset.length > 0) {
            console.log('✅ Member already has valid payment confirmation!');
            return;
        }

        console.log('🔧 Creating payment confirmation for member...');

        // Create payment with correct plan ID
        const paymentResult = await pool.request()
            .input('userId', member.UserID)
            .input('planId', plan.PlanID)
            .input('amount', plan.Price)
            .input('startDate', new Date())
            .input('endDate', new Date(Date.now() + plan.Duration * 24 * 60 * 60 * 1000))
            .query(`
                INSERT INTO Payments (UserID, PlanID, Amount, PaymentMethod, Status, TransactionID, StartDate, EndDate, Note)
                OUTPUT INSERTED.PaymentID
                VALUES (@userId, @planId, @amount, 'BankTransfer', 'confirmed', 'FINAL_TX_' + CAST(@userId AS VARCHAR), @startDate, @endDate, N'Final payment for progress access')
            `);

        const paymentId = paymentResult.recordset[0].PaymentID;
        console.log('💳 Created payment ID:', paymentId);

        // Create payment confirmation
        await pool.request()
            .input('paymentId', paymentId)
            .input('confirmedBy', 4) // Admin user
            .query(`
                INSERT INTO PaymentConfirmations (PaymentID, ConfirmationDate, ConfirmedByUserID, ConfirmationCode, Notes)
                VALUES (@paymentId, GETDATE(), @confirmedBy, 'FINAL_CONF_' + CAST(@paymentId AS VARCHAR), N'Final confirmation for progress access')
            `);

        console.log('✅ Created payment confirmation');

        // Verify access
        const accessResult = await pool.request()
            .input('userId', member.UserID)
            .query(`
                SELECT DISTINCT p.UserID
                FROM Payments p
                INNER JOIN PaymentConfirmations pc ON p.PaymentID = pc.PaymentID
                WHERE p.UserID = @userId 
                AND p.Status = 'confirmed'
                AND p.EndDate > GETDATE()
            `);

        if (accessResult.recordset.length > 0) {
            console.log('🎉 SUCCESS! Member now has access to progress features!');
        } else {
            console.log('❌ Something went wrong - member still doesn\'t have access');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

fixPaymentFinal(); 
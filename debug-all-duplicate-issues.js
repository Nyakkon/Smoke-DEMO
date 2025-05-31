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

async function debugAllDuplicateIssues() {
    let pool = null;
    try {
        console.log('🔍 COMPREHENSIVE DEBUG: ALL DUPLICATE ISSUES');
        console.log('============================================\n');

        // Connect to database
        console.log('🔗 Connecting to database...');
        pool = await sql.connect(config);
        console.log('✅ Database connected\n');

        // 1. TEST ADMIN MEMBERS API
        console.log('📊 1. TESTING ADMIN MEMBERS API');
        console.log('================================');
        const adminMembersQuery = await pool.request().query(`
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

        console.log(`Admin members API query returned: ${adminMembersQuery.recordset.length} records`);
        const adminEmails = adminMembersQuery.recordset.map(m => m.Email);
        const uniqueAdminEmails = [...new Set(adminEmails)];
        console.log(`Unique emails in admin API: ${uniqueAdminEmails.length}`);
        if (adminEmails.length !== uniqueAdminEmails.length) {
            console.log('❌ DUPLICATES FOUND in admin members API!');
        } else {
            console.log('✅ No duplicates in admin members API');
        }

        // 2. TEST COACH MEMBERS API
        console.log('\n📊 2. TESTING COACH MEMBERS API');
        console.log('===============================');
        const coachMembersQuery = await pool.request().query(`
            SELECT 
                u.UserID as id,
                u.FirstName + ' ' + u.LastName as fullName,
                u.Email as email,
                u.Avatar as avatar,
                u.IsActive as isActive,
                mp.Name as planName,
                qp.Status as planStatus,
                u.CreatedAt,
                -- Progress data
                DATEDIFF(day, qp.StartDate, GETDATE()) as daysSmokeFree,
                DATEDIFF(day, qp.StartDate, GETDATE()) * 50000 as moneySaved,
                -- Achievement count
                (SELECT COUNT(*) FROM Achievements a WHERE a.UserID = u.UserID) as achievementCount,
                -- Membership info
                CASE 
                    WHEN qp.Status = 'active' AND mp.PlanID IS NOT NULL THEN 
                        JSON_QUERY('{"planName": "' + mp.Name + '", "status": "active"}')
                    ELSE NULL 
                END as membership
            FROM Users u
            INNER JOIN QuitPlans qp ON u.UserID = qp.UserID
            LEFT JOIN MembershipPlans mp ON qp.PlanID = mp.PlanID
            WHERE u.Role = 'member' 
              AND u.IsActive = 1 
              AND qp.Status = 'active'
              AND qp.CoachID IS NOT NULL
            ORDER BY u.CreatedAt DESC
        `);

        console.log(`Coach members API query returned: ${coachMembersQuery.recordset.length} records`);
        const coachEmails = coachMembersQuery.recordset.map(m => m.email);
        const uniqueCoachEmails = [...new Set(coachEmails)];
        console.log(`Unique emails in coach API: ${uniqueCoachEmails.length}`);
        if (coachEmails.length !== uniqueCoachEmails.length) {
            console.log('❌ DUPLICATES FOUND in coach members API!');

            // Find duplicates
            const duplicateEmails = coachEmails.filter((email, index) => coachEmails.indexOf(email) !== index);
            console.log('Duplicate emails:', [...new Set(duplicateEmails)]);
        } else {
            console.log('✅ No duplicates in coach members API');
        }

        // 3. TEST PENDING PAYMENTS API
        console.log('\n📊 3. TESTING PENDING PAYMENTS API');
        console.log('==================================');
        const pendingPaymentsQuery = await pool.request().query(`
            SELECT 
                p.PaymentID,
                p.UserID,
                p.PlanID,
                p.Amount,
                p.PaymentMethod,
                p.TransactionID,
                p.PaymentDate,
                p.Status,
                u.FirstName,
                u.LastName,
                u.Email,
                u.PhoneNumber,
                mp.Name as PlanName,
                mp.Description as PlanDescription,
                mp.Duration
            FROM Payments p
            INNER JOIN Users u ON p.UserID = u.UserID
            INNER JOIN MembershipPlans mp ON p.PlanID = mp.PlanID
            WHERE p.Status = 'pending'
            ORDER BY p.PaymentDate DESC
        `);

        console.log(`Pending payments API query returned: ${pendingPaymentsQuery.recordset.length} records`);
        const paymentIds = pendingPaymentsQuery.recordset.map(p => p.PaymentID);
        const uniquePaymentIds = [...new Set(paymentIds)];
        console.log(`Unique payment IDs: ${uniquePaymentIds.length}`);
        if (paymentIds.length !== uniquePaymentIds.length) {
            console.log('❌ DUPLICATES FOUND in pending payments API!');
        } else {
            console.log('✅ No duplicates in pending payments API');
        }

        // 4. TEST PAYMENT CONFIRMATIONS API
        console.log('\n📊 4. TESTING PAYMENT CONFIRMATIONS API');
        console.log('=======================================');
        const confirmationsQuery = await pool.request().query(`
            SELECT 
                pc.PaymentID,
                pc.AdminID,
                pc.ConfirmationDate,
                pc.ConfirmationCode,
                pc.Notes,
                p.Amount,
                u.FirstName + ' ' + u.LastName as CustomerName,
                u.Email as CustomerEmail,
                mp.Name as PlanName,
                admin.FirstName + ' ' + admin.LastName as AdminName
            FROM PaymentConfirmations pc
            INNER JOIN Payments p ON pc.PaymentID = p.PaymentID
            INNER JOIN Users u ON p.UserID = u.UserID
            INNER JOIN MembershipPlans mp ON p.PlanID = mp.PlanID
            INNER JOIN Users admin ON pc.AdminID = admin.UserID
            ORDER BY pc.ConfirmationDate DESC
        `);

        console.log(`Payment confirmations API query returned: ${confirmationsQuery.recordset.length} records`);
        const confirmationPaymentIds = confirmationsQuery.recordset.map(c => c.PaymentID);
        const uniqueConfirmationIds = [...new Set(confirmationPaymentIds)];
        console.log(`Unique confirmation payment IDs: ${uniqueConfirmationIds.length}`);
        if (confirmationPaymentIds.length !== uniqueConfirmationIds.length) {
            console.log('❌ DUPLICATES FOUND in payment confirmations API!');
        } else {
            console.log('✅ No duplicates in payment confirmations API');
        }

        // 5. DETAILED ANALYSIS OF DUPLICATES
        console.log('\n📊 5. DETAILED DUPLICATE ANALYSIS');
        console.log('==================================');

        // Check for users with multiple active quit plans
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
            console.log('❌ Users with multiple active plans:');
            multipleActivePlans.recordset.forEach(user => {
                console.log(`   ${user.FirstName} ${user.LastName} (${user.Email}): ${user.ActivePlanCount} active plans`);
            });
        } else {
            console.log('✅ No users with multiple active plans found');
        }

        // Check for duplicate payments
        const duplicatePayments = await pool.request().query(`
            SELECT 
                p1.PaymentID,
                p1.UserID,
                p1.PlanID,
                p1.Amount,
                p1.TransactionID,
                u.Email
            FROM Payments p1
            INNER JOIN Payments p2 ON p1.UserID = p2.UserID 
                AND p1.PlanID = p2.PlanID 
                AND p1.Amount = p2.Amount 
                AND p1.PaymentID != p2.PaymentID
            INNER JOIN Users u ON p1.UserID = u.UserID
            WHERE p1.Status = 'pending'
        `);

        if (duplicatePayments.recordset.length > 0) {
            console.log('❌ Duplicate payments found:');
            duplicatePayments.recordset.forEach(payment => {
                console.log(`   Payment ${payment.PaymentID} for ${payment.Email}: ${payment.Amount} VND`);
            });
        } else {
            console.log('✅ No duplicate payments found');
        }

        // 6. SUMMARY
        console.log('\n📝 COMPREHENSIVE SUMMARY');
        console.log('========================');
        console.log(`Admin members records: ${adminMembersQuery.recordset.length}`);
        console.log(`Coach members records: ${coachMembersQuery.recordset.length}`);
        console.log(`Pending payments records: ${pendingPaymentsQuery.recordset.length}`);
        console.log(`Payment confirmations records: ${confirmationsQuery.recordset.length}`);

        // Check for data integrity issues
        const issues = [];
        if (adminEmails.length !== uniqueAdminEmails.length) issues.push('Admin members API');
        if (coachEmails.length !== uniqueCoachEmails.length) issues.push('Coach members API');
        if (paymentIds.length !== uniquePaymentIds.length) issues.push('Pending payments API');
        if (confirmationPaymentIds.length !== uniqueConfirmationIds.length) issues.push('Payment confirmations API');

        if (issues.length > 0) {
            console.log(`❌ Duplicate issues found in: ${issues.join(', ')}`);
            console.log('🔧 Apply the React optimization fixes to these components');
        } else {
            console.log('✅ No duplicate issues found in backend data');
            console.log('🔍 Issue is likely in frontend React rendering');
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

// Run the comprehensive debug
debugAllDuplicateIssues(); 
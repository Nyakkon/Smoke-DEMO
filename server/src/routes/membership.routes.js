const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { pool } = require('../config/database');

// Get all membership plans
router.get('/plans', async (req, res) => {
    try {
        console.log('Fetching membership plans from SQL database...');

        const result = await pool.request().query(`
            SELECT * FROM MembershipPlans
            ORDER BY Price ASC
        `);

        console.log('Successfully fetched data from SQL database');

        res.json({
            success: true,
            data: result.recordset,
            message: 'Đã lấy được dữ liệu từ SQL thành công'
        });
    } catch (error) {
        console.error('Error fetching membership plans:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving membership plans'
        });
    }
});

// Get user's current membership
router.get('/current', protect, async (req, res) => {
    try {
        console.log('🔍 Fetching membership for user:', req.user.id);

        // First check for active memberships with payment info
        let result = await pool.request()
            .input('UserID', req.user.id)
            .query(`
                SELECT 
                    um.*,
                    mp.*,
                    p.PaymentMethod,
                    p.TransactionID,
                    p.Status as PaymentStatus,
                    p.PaymentDate,
                    p.StartDate as PaymentStartDate,
                    p.EndDate as PaymentEndDate
                FROM UserMemberships um
                JOIN MembershipPlans mp ON um.PlanID = mp.PlanID
                LEFT JOIN Payments p ON um.UserID = p.UserID AND um.PlanID = p.PlanID
                WHERE um.UserID = @UserID AND um.Status = 'active'
                AND um.EndDate > GETDATE()
                ORDER BY um.EndDate DESC
            `);

        // If no active membership, check for pending memberships
        if (result.recordset.length === 0) {
            result = await pool.request()
                .input('UserID', req.user.id)
                .query(`
                    SELECT 
                        um.*,
                        mp.*,
                        p.PaymentMethod,
                        p.TransactionID,
                        p.Status as PaymentStatus,
                        p.PaymentDate,
                        p.StartDate as PaymentStartDate,
                        p.EndDate as PaymentEndDate
                    FROM UserMemberships um
                    JOIN MembershipPlans mp ON um.PlanID = mp.PlanID
                    LEFT JOIN Payments p ON um.UserID = p.UserID AND um.PlanID = p.PlanID
                    WHERE um.UserID = @UserID AND um.Status = 'pending'
                    ORDER BY um.CreatedAt DESC
                `);
        }

        if (result.recordset.length === 0) {
            return res.json({
                success: true,
                data: null,
                message: 'No active or pending membership'
            });
        }

        const membership = result.recordset[0];

        // Format the response properly
        const formattedMembership = {
            MembershipID: membership.MembershipID,
            UserID: membership.UserID,
            PlanID: membership.PlanID,
            PlanName: membership.Name,
            Description: membership.Description,
            Price: membership.Price,
            Duration: membership.Duration,
            Features: membership.Features,
            Status: membership.Status,
            PaymentStatus: membership.PaymentStatus || 'pending',
            PaymentMethod: membership.PaymentMethod,
            TransactionID: membership.TransactionID,
            // Use PaymentStartDate/EndDate if available, otherwise use membership dates
            StartDate: membership.PaymentStartDate || membership.StartDate,
            EndDate: membership.PaymentEndDate || membership.EndDate,
            PaymentDate: membership.PaymentDate,
            CreatedAt: membership.CreatedAt
        };

        // Check if any active membership is about to expire (within 3 days)
        if (membership.Status === 'active') {
            const endDate = new Date(formattedMembership.EndDate);
            const now = new Date();
            const daysUntilExpiration = Math.floor((endDate - now) / (1000 * 60 * 60 * 24));

            if (daysUntilExpiration <= 3 && daysUntilExpiration >= 0) {
                // Send notification about upcoming expiration
                await pool.request()
                    .input('UserID', req.user.id)
                    .input('Title', 'Membership Expiring Soon')
                    .input('Message', `Your ${membership.Name} membership will expire in ${daysUntilExpiration} day(s). Consider renewing to maintain your benefits.`)
                    .input('Type', 'membership')
                    .query(`
                        INSERT INTO Notifications (UserID, Title, Message, Type)
                        VALUES (@UserID, @Title, @Message, @Type)
                    `);
            }
        }

        console.log('✅ Membership data formatted:', {
            Status: formattedMembership.Status,
            PaymentStatus: formattedMembership.PaymentStatus,
            StartDate: formattedMembership.StartDate,
            EndDate: formattedMembership.EndDate
        });

        res.json({
            success: true,
            data: formattedMembership
        });
    } catch (error) {
        console.error('❌ Error fetching user membership:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving current membership'
        });
    }
});

// Purchase a membership plan
router.post('/purchase', protect, async (req, res) => {
    try {
        console.log('🔍 Purchase request received:', req.body);
        console.log('👤 User:', req.user.email, 'ID:', req.user.id);

        const { planId, paymentMethod } = req.body;

        if (!planId) {
            return res.status(400).json({
                success: false,
                message: 'Plan ID is required'
            });
        }

        // Validate payment method
        if (!['BankTransfer', 'Cash'].includes(paymentMethod)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid payment method. Must be BankTransfer or Cash'
            });
        }

        // Get plan details
        const planResult = await pool.request()
            .input('PlanID', planId)
            .query(`SELECT * FROM MembershipPlans WHERE PlanID = @PlanID`);

        if (planResult.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Membership plan not found'
            });
        }

        const plan = planResult.recordset[0];

        // Calculate start and end dates
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + plan.Duration);

        console.log('📅 Calculated dates:', {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            duration: plan.Duration
        });

        // Start transaction
        const transaction = pool.request();

        try {
            console.log('💳 Creating payment record...');

            // Create payment record with pending status
            const paymentResult = await transaction
                .input('UserID', req.user.id)
                .input('PlanID', planId)
                .input('Amount', plan.Price)
                .input('PaymentMethod', paymentMethod)
                .input('Status', 'pending')
                .input('TransactionID', 'TRX-' + Date.now())
                .input('StartDate', startDate)
                .input('EndDate', endDate)
                .input('Note', `Payment for ${plan.Name} plan via ${paymentMethod}`)
                .query(`
                    INSERT INTO Payments (UserID, PlanID, Amount, PaymentMethod, Status, TransactionID, StartDate, EndDate, Note, PaymentDate)
                    OUTPUT INSERTED.*
                    VALUES (@UserID, @PlanID, @Amount, @PaymentMethod, @Status, @TransactionID, @StartDate, @EndDate, @Note, GETDATE())
                `);

            console.log('✅ Payment created:', paymentResult.recordset[0]);

            if (paymentResult.recordset.length === 0) {
                throw new Error('Failed to create payment record');
            }

            const payment = paymentResult.recordset[0];

            console.log('🏷️ Creating membership record...');

            // Create membership record with pending status - use a new request
            const membershipTransaction = pool.request();
            const membershipResult = await membershipTransaction
                .input('UserID', req.user.id)
                .input('PlanID', planId)
                .input('StartDate', startDate)
                .input('EndDate', endDate)
                .input('Status', 'pending')
                .query(`
                    INSERT INTO UserMemberships (UserID, PlanID, StartDate, EndDate, Status, CreatedAt)
                    OUTPUT INSERTED.*
                    VALUES (@UserID, @PlanID, @StartDate, @EndDate, @Status, GETDATE())
                `);

            console.log('✅ Membership created:', membershipResult.recordset[0]);

            if (membershipResult.recordset.length === 0) {
                throw new Error('Failed to create membership record');
            }

            const membership = membershipResult.recordset[0];

            // Send notification to user
            const notificationTransaction = pool.request();
            await notificationTransaction
                .input('UserID', req.user.id)
                .input('Title', 'Payment Submitted')
                .input('Message', `Your payment for the ${plan.Name} plan is pending confirmation.`)
                .input('Type', 'payment')
                .query(`
                    INSERT INTO Notifications (UserID, Title, Message, Type, CreatedAt)
                    VALUES (@UserID, @Title, @Message, @Type, GETDATE())
                `);

            console.log('✅ Purchase completed successfully');

            // Return success response with properly formatted data
            res.status(201).json({
                success: true,
                message: 'Payment submitted and pending confirmation',
                data: {
                    membership: {
                        ...membership,
                        PlanName: plan.Name,
                        Price: plan.Price,
                        Duration: plan.Duration,
                        Features: plan.Features,
                        Description: plan.Description,
                        // Format dates properly
                        StartDate: startDate.toISOString(),
                        EndDate: endDate.toISOString(),
                        PaymentMethod: paymentMethod,
                        Status: 'pending'
                    },
                    payment: {
                        ...payment,
                        // Format dates properly
                        StartDate: startDate.toISOString(),
                        EndDate: endDate.toISOString()
                    }
                }
            });

        } catch (error) {
            console.error('❌ Transaction error:', error);
            throw error;
        }
    } catch (error) {
        console.error('❌ Error processing membership purchase:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing membership purchase',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Function to confirm a payment (will be called by admin in the future)
async function confirmPayment(paymentId, confirmedByUserId) {
    const transaction = new pool.Transaction();

    try {
        await transaction.begin();

        // Get payment details
        const paymentResult = await transaction.request()
            .input('PaymentID', paymentId)
            .query(`
                SELECT p.*, u.UserID, u.Role, um.MembershipID, um.Status as MembershipStatus
                FROM Payments p
                JOIN Users u ON p.UserID = u.UserID
                LEFT JOIN UserMemberships um ON p.UserID = um.UserID AND um.Status = 'pending'
                WHERE p.PaymentID = @PaymentID
            `);

        if (paymentResult.recordset.length === 0) {
            await transaction.rollback();
            throw new Error('Payment not found');
        }

        const payment = paymentResult.recordset[0];

        // Update payment status to confirmed
        await transaction.request()
            .input('PaymentID', paymentId)
            .query(`
                UPDATE Payments
                SET Status = 'confirmed'
                WHERE PaymentID = @PaymentID
            `);

        // Create payment confirmation record
        await transaction.request()
            .input('PaymentID', paymentId)
            .input('ConfirmedBy', confirmedByUserId)
            .input('Status', 'confirmed')
            .input('Notes', 'Payment confirmed')
            .query(`
                INSERT INTO PaymentConfirmations (PaymentID, ConfirmedBy, Status, Notes)
                VALUES (@PaymentID, @ConfirmedBy, @Status, @Notes)
            `);

        // Update membership status to active
        if (payment.MembershipID) {
            await transaction.request()
                .input('MembershipID', payment.MembershipID)
                .query(`
                    UPDATE UserMemberships
                    SET Status = 'active'
                    WHERE MembershipID = @MembershipID
                `);
        }

        // Update user role to member if they're a guest
        if (payment.Role === 'guest') {
            await transaction.request()
                .input('UserID', payment.UserID)
                .query(`
                    UPDATE Users
                    SET Role = 'member'
                    WHERE UserID = @UserID AND Role = 'guest'
                `);
        }

        // Send notification to user
        await transaction.request()
            .input('UserID', payment.UserID)
            .input('Title', 'Payment Confirmed')
            .input('Message', 'Your payment has been confirmed. Your membership is now active.')
            .input('Type', 'payment')
            .query(`
                INSERT INTO Notifications (UserID, Title, Message, Type)
                VALUES (@UserID, @Title, @Message, @Type)
            `);

        await transaction.commit();
        console.log(`Payment ${paymentId} confirmed successfully`);
        return true;
    } catch (error) {
        await transaction.rollback();
        console.error('Error confirming payment:', error);
        throw error;
    }
}

// Admin endpoint to confirm payment (for future use)
router.post('/confirm-payment/:paymentId', protect, async (req, res) => {
    try {
        const { paymentId } = req.params;

        // Check if user is admin (uncomment when admin roles are implemented)
        // if (req.user.Role !== 'admin') {
        //     return res.status(403).json({
        //         success: false,
        //         message: 'Only admins can confirm payments'
        //     });
        // }

        // For now, allow any user to confirm payments in demo mode
        console.log(`[DEMO] User ${req.user.id} confirming payment ${paymentId}`);

        await confirmPayment(paymentId, req.user.id);

        res.json({
            success: true,
            message: 'Payment confirmed successfully'
        });
    } catch (error) {
        console.error('Error in payment confirmation endpoint:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error confirming payment'
        });
    }
});

// Get user membership history
router.get('/history', protect, async (req, res) => {
    try {
        const result = await pool.request()
            .input('UserID', req.user.id)
            .query(`
                SELECT um.*, mp.Name as PlanName, mp.Price, p.PaymentMethod, p.TransactionID
                FROM UserMemberships um
                JOIN MembershipPlans mp ON um.PlanID = mp.PlanID
                LEFT JOIN Payments p ON um.UserID = p.UserID AND 
                    p.CreatedAt BETWEEN DATEADD(MINUTE, -5, um.CreatedAt) AND DATEADD(MINUTE, 5, um.CreatedAt)
                WHERE um.UserID = @UserID
                ORDER BY um.CreatedAt DESC
            `);

        res.json({
            success: true,
            data: result.recordset
        });
    } catch (error) {
        console.error('Error fetching membership history:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving membership history'
        });
    }
});

// Get user payment history  
router.get('/payment-history', protect, async (req, res) => {
    try {
        console.log('🔍 Fetching payment history for user:', req.user.id);

        // Set headers to prevent caching
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });

        const result = await pool.request()
            .input('UserID', req.user.id)
            .query(`
                SELECT 
                    p.*,
                    mp.Name as PlanName,
                    mp.Description as PlanDescription,
                    mp.Duration,
                    mp.Features,
                    mp.Price as PlanPrice,
                    um.Status as MembershipStatus,
                    -- Format dates as ISO strings for JavaScript compatibility
                    FORMAT(um.StartDate, 'yyyy-MM-ddTHH:mm:ss.fffZ') as MembershipStartDate,
                    FORMAT(um.EndDate, 'yyyy-MM-ddTHH:mm:ss.fffZ') as MembershipEndDate,
                    p.Status as PaymentStatus,
                    FORMAT(p.StartDate, 'yyyy-MM-ddTHH:mm:ss.fffZ') as PaymentStartDate,
                    FORMAT(p.EndDate, 'yyyy-MM-ddTHH:mm:ss.fffZ') as PaymentEndDate,
                    FORMAT(p.PaymentDate, 'yyyy-MM-ddTHH:mm:ss.fffZ') as FormattedPaymentDate
                FROM Payments p
                JOIN MembershipPlans mp ON p.PlanID = mp.PlanID
                LEFT JOIN UserMemberships um ON p.UserID = um.UserID AND p.PlanID = um.PlanID
                WHERE p.UserID = @UserID
                ORDER BY p.PaymentDate DESC, p.PaymentID DESC
            `);

        console.log('📋 Payment history query result:', {
            count: result.recordset.length,
            firstRecord: result.recordset[0]
        });

        // Format the response with proper dates
        const formattedHistory = result.recordset.map(record => {
            // Use formatted dates if available, otherwise fallback to original dates
            const startDate = record.PaymentStartDate || record.MembershipStartDate || record.StartDate;
            const endDate = record.PaymentEndDate || record.MembershipEndDate || record.EndDate;

            console.log('📅 Processing record dates:', {
                originalStartDate: record.StartDate,
                originalEndDate: record.EndDate,
                paymentStartDate: record.PaymentStartDate,
                paymentEndDate: record.PaymentEndDate,
                finalStartDate: startDate,
                finalEndDate: endDate
            });

            return {
                ...record,
                StartDate: startDate,
                EndDate: endDate,
                // Ensure we have all the required fields
                PlanName: record.PlanName,
                PaymentStatus: record.PaymentStatus,
                PaymentMethod: record.PaymentMethod,
                Amount: record.Amount,
                TransactionID: record.TransactionID,
                PaymentDate: record.FormattedPaymentDate || record.PaymentDate,
                Price: record.PlanPrice // Include plan price
            };
        });

        console.log('✅ Formatted payment history:', {
            count: formattedHistory.length,
            firstRecord: formattedHistory[0]
        });

        res.json({
            success: true,
            data: formattedHistory
        });
    } catch (error) {
        console.error('❌ Error fetching payment history:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving payment history'
        });
    }
});

// Cancel membership
router.post('/cancel', protect, async (req, res) => {
    console.log('🔴 Cancel membership request from user:', req.user?.id);

    try {
        const userId = req.user.id;
        const { reason, bankAccountNumber, bankName, accountHolderName } = req.body;

        console.log('🏦 Received bank information:', {
            bankAccountNumber,
            bankName,
            accountHolderName,
            reason
        });

        // Validate bank information
        if (!bankAccountNumber || !bankName || !accountHolderName) {
            return res.status(400).json({
                success: false,
                message: 'Thông tin tài khoản ngân hàng không đầy đủ'
            });
        }

        // Get active payment for this user
        const paymentResult = await pool.request()
            .input('UserID', userId)
            .query(`
                SELECT TOP 1 
                    p.PaymentID,
                    p.Amount,
                    p.StartDate,
                    p.EndDate,
                    p.PaymentDate,
                    p.Status,
                    p.PlanID,
                    mp.Name as PlanName
                FROM Payments p
                JOIN MembershipPlans mp ON p.PlanID = mp.PlanID
                WHERE p.UserID = @UserID 
                    AND p.Status IN ('pending', 'confirmed')
                ORDER BY p.PaymentDate DESC
            `);

        if (paymentResult.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy thanh toán để hủy'
            });
        }

        const payment = paymentResult.recordset[0];

        console.log('💰 Found payment to cancel:', {
            PaymentID: payment.PaymentID,
            Amount: payment.Amount,
            Status: payment.Status,
            PlanName: payment.PlanName
        });

        // Calculate refund amount (50% as mentioned in UI)
        const refundAmount = Math.floor(payment.Amount * 0.5);

        console.log('💸 Calculated refund amount:', refundAmount);

        // Start transaction using proper SQL Server syntax
        const transaction = pool.transaction();
        await transaction.begin();

        try {
            // 1. Update Payment status to 'rejected' (since 'cancelled' is not allowed)
            await transaction.request()
                .input('PaymentID', payment.PaymentID)
                .query(`
                    UPDATE Payments 
                    SET Status = 'rejected'
                    WHERE PaymentID = @PaymentID
                `);

            console.log('✅ Updated Payment status to rejected');

            // 2. Update UserMemberships status to 'cancelled'
            await transaction.request()
                .input('UserID', userId)
                .query(`
                    UPDATE UserMemberships 
                    SET Status = 'cancelled'
                    WHERE UserID = @UserID AND Status = 'active'
                `);

            console.log('✅ Updated UserMemberships status to cancelled');

            // 3. Get MembershipID for the refund record
            const membershipResult = await transaction.request()
                .input('UserID', userId)
                .query(`
                    SELECT TOP 1 MembershipID 
                    FROM UserMemberships 
                    WHERE UserID = @UserID 
                    ORDER BY CreatedAt DESC
                `);

            const membershipId = membershipResult.recordset[0]?.MembershipID;

            // 4. Create record in Refunds table (the main refunds table)
            const refundInsert = await transaction.request()
                .input('UserID', userId)
                .input('PaymentID', payment.PaymentID)
                .input('OriginalAmount', payment.Amount)
                .input('RefundAmount', refundAmount)
                .input('RefundReason', reason || 'User requested cancellation')
                .input('Status', 'pending')
                .input('ProcessedBy', null)
                .input('RefundMethod', 'bank_transfer')
                .input('BankAccount', `${bankName} - ${bankAccountNumber} - ${accountHolderName}`)
                .input('Notes', `Auto-generated refund request for plan: ${payment.PlanName}. Bank: ${bankName}, Account: ${bankAccountNumber}, Holder: ${accountHolderName}`)
                .query(`
                    INSERT INTO Refunds (
                        UserID, PaymentID, OriginalAmount, RefundAmount, RefundReason,
                        Status, RequestedAt, ProcessedBy, RefundMethod, BankAccount, Notes
                    )
                    OUTPUT INSERTED.RefundID
                    VALUES (
                        @UserID, @PaymentID, @OriginalAmount, @RefundAmount, @RefundReason,
                        @Status, GETDATE(), @ProcessedBy, @RefundMethod, @BankAccount, @Notes
                    )
                `);

            const refundId = refundInsert.recordset[0]?.RefundID;

            console.log('✅ Created Refunds record with ID:', refundId);

            // 5. Also create RefundRequests record for additional tracking (if table exists)
            try {
                console.log('🏦 About to insert RefundRequests with bank info:', {
                    bankAccountNumber,
                    bankName,
                    accountHolderName
                });

                await transaction.request()
                    .input('UserID', userId)
                    .input('PaymentID', payment.PaymentID)
                    .input('MembershipID', membershipId)
                    .input('RefundAmount', refundAmount)
                    .input('RefundReason', reason || 'Hủy gói dịch vụ theo yêu cầu khách hàng')
                    .input('BankAccountNumber', bankAccountNumber)
                    .input('BankName', bankName)
                    .input('AccountHolderName', accountHolderName)
                    .query(`
                        INSERT INTO RefundRequests (
                            UserID, PaymentID, MembershipID, RefundAmount, RefundReason,
                            BankAccountNumber, BankName, AccountHolderName, Status, RequestedAt
                        )
                        VALUES (
                            @UserID, @PaymentID, @MembershipID, @RefundAmount, @RefundReason,
                            @BankAccountNumber, @BankName, @AccountHolderName, 'pending', GETDATE()
                        )
                    `);

                console.log('✅ Created RefundRequests record for additional tracking with bank info:', {
                    userId,
                    bankAccountNumber,
                    bankName,
                    accountHolderName
                });
            } catch (refundRequestError) {
                console.error('❌ RefundRequests INSERT error:', refundRequestError);
                console.log('⚠️ RefundRequests table may not exist or missing bank columns, skipping:', refundRequestError.message);
            }

            // 6. Update user role to guest (since they cancelled membership)
            await transaction.request()
                .input('UserID', userId)
                .query(`
                    UPDATE Users 
                    SET Role = 'guest'
                    WHERE UserID = @UserID
                `);

            console.log('✅ Updated user role to guest');

            // Commit transaction
            await transaction.commit();

            console.log('🎉 Membership cancellation completed successfully');

            res.json({
                success: true,
                message: 'Gói dịch vụ đã được hủy thành công',
                data: {
                    refundId: refundId,
                    cancelledAt: new Date(),
                    refundAmount: refundAmount,
                    status: 'cancelled',
                    processingTime: '3-5 ngày làm việc',
                    bankInfo: {
                        bankAccountNumber: bankAccountNumber,
                        bankName: bankName,
                        accountHolderName: accountHolderName
                    },
                    note: 'Yêu cầu hoàn tiền đã được tạo và sẽ được Admin xử lý trong 3-5 ngày làm việc'
                }
            });

        } catch (transactionError) {
            console.error('❌ Transaction error:', transactionError);
            await transaction.rollback();
            throw transactionError;
        }

    } catch (error) {
        console.error('❌ Cancel membership error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi hủy gói dịch vụ',
            error: error.message
        });
    }
});

// Function to check for expired memberships and downgrade users
// This would ideally be run by a scheduled task
async function checkExpiredMemberships() {
    const transaction = new pool.Transaction();

    try {
        await transaction.begin();

        // Find expired memberships
        const expiredResult = await transaction.request()
            .query(`
                SELECT um.*, u.UserID, u.Email, u.Role, mp.Name as PlanName
                FROM UserMemberships um
                JOIN Users u ON um.UserID = u.UserID
                JOIN MembershipPlans mp ON um.PlanID = mp.PlanID
                WHERE um.Status = 'active'
                AND um.EndDate < GETDATE()
            `);

        console.log(`Found ${expiredResult.recordset.length} expired memberships`);

        // Process each expired membership
        for (const membership of expiredResult.recordset) {
            // Update membership status
            await transaction.request()
                .input('MembershipID', membership.MembershipID)
                .query(`
                    UPDATE UserMemberships
                    SET Status = 'expired'
                    WHERE MembershipID = @MembershipID
                `);

            // Update user role to guest
            if (membership.Role === 'member') {
                await transaction.request()
                    .input('UserID', membership.UserID)
                    .query(`
                        UPDATE Users
                        SET Role = 'guest'
                        WHERE UserID = @UserID
                    `);
            }

            // Send expiration notification
            await transaction.request()
                .input('UserID', membership.UserID)
                .input('Title', 'Membership Expired')
                .input('Message', `Your ${membership.PlanName} membership has expired. Your account has been reverted to Guest status.`)
                .input('Type', 'membership')
                .query(`
                    INSERT INTO Notifications (UserID, Title, Message, Type)
                    VALUES (@UserID, @Title, @Message, @Type)
                `);

            console.log(`Processed expired membership for user ${membership.UserID}`);
        }

        await transaction.commit();
        return expiredResult.recordset.length;
    } catch (error) {
        await transaction.rollback();
        console.error('Error checking expired memberships:', error);
        throw error;
    }
}

// Endpoint to manually trigger membership expiration check (for testing)
// In production, this should be a scheduled task
router.post('/check-expired', protect, async (req, res) => {
    try {
        // Check if user is admin (uncomment when admin roles are implemented)
        // if (req.user.Role !== 'admin') {
        //     return res.status(403).json({
        //         success: false,
        //         message: 'Only admins can perform this action'
        //     });
        // }

        const count = await checkExpiredMemberships();

        res.json({
            success: true,
            message: `Processed ${count} expired memberships`
        });
    } catch (error) {
        console.error('Error in expired membership check:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error checking expired memberships'
        });
    }
});

// For demo purposes only - simulating periodic expiration checks
// In a real app, this should be done with a proper scheduler
if (process.env.NODE_ENV === 'development') {
    // Check for expired memberships every hour
    setInterval(async () => {
        try {
            console.log("Running scheduled membership expiration check");
            const count = await checkExpiredMemberships();
            console.log(`Processed ${count} expired memberships`);
        } catch (error) {
            console.error("Error in scheduled expiration check:", error);
        }
    }, 60 * 60 * 1000); // 1 hour
}

// Get user's refund requests (includes both RefundRequests and CancellationRequests)
router.get('/refund-requests', protect, async (req, res) => {
    try {
        console.log('🔍 Getting refund requests for user:', req.user.id);

        // Get cancellation requests (these are the new refund workflow)
        const cancellationRequests = await pool.request()
            .input('UserID', req.user.id)
            .query(`
                SELECT 
                    cr.CancellationRequestID as RequestID,
                    'cancellation' as RequestType,
                    cr.RequestedRefundAmount as RefundAmount,
                    cr.CancellationReason as RefundReason,
                    cr.Status,
                    cr.RequestedAt,
                    cr.ProcessedAt,
                    cr.AdminNotes,
                    cr.RefundApproved,
                    cr.RefundAmount as ApprovedRefundAmount,
                    cr.BankAccountNumber,
                    cr.BankName,
                    cr.AccountHolderName,
                    cr.TransferConfirmed,
                    cr.TransferDate,
                    cr.RefundReceived,
                    cr.ReceivedDate,
                    mp.Name as PlanName,
                    mp.Price as PlanPrice,
                    um.StartDate as MembershipStartDate,
                    um.EndDate as MembershipEndDate,
                    admin_u.FirstName + ' ' + admin_u.LastName as ProcessedByName
                FROM CancellationRequests cr
                JOIN UserMemberships um ON cr.MembershipID = um.MembershipID
                JOIN MembershipPlans mp ON um.PlanID = mp.PlanID
                LEFT JOIN Users admin_u ON cr.ProcessedByUserID = admin_u.UserID
                WHERE cr.UserID = @UserID
                ORDER BY cr.RequestedAt DESC
            `);

        // Get legacy refund requests (if any exist)
        const legacyRefundRequests = await pool.request()
            .input('UserID', req.user.id)
            .query(`
                SELECT 
                    rr.RefundRequestID as RequestID,
                    'legacy_refund' as RequestType,
                    rr.RefundAmount,
                    rr.RefundReason,
                    rr.Status,
                    rr.RequestedAt,
                    rr.ProcessedAt,
                    rr.AdminNotes,
                    1 as RefundApproved,
                    rr.RefundAmount as ApprovedRefundAmount,
                    rr.BankAccountNumber,
                    rr.BankName,
                    rr.AccountHolderName,
                    0 as TransferConfirmed,
                    NULL as TransferDate,
                    0 as RefundReceived,
                    NULL as ReceivedDate,
                    mp.Name as PlanName,
                    mp.Price as PlanPrice,
                    um.StartDate as MembershipStartDate,
                    um.EndDate as MembershipEndDate,
                    admin_u.FirstName + ' ' + admin_u.LastName as ProcessedByName
                FROM RefundRequests rr
                LEFT JOIN UserMemberships um ON rr.MembershipID = um.MembershipID
                LEFT JOIN MembershipPlans mp ON um.PlanID = mp.PlanID
                LEFT JOIN Users admin_u ON rr.ProcessedByUserID = admin_u.UserID
                WHERE rr.UserID = @UserID
                ORDER BY rr.RequestedAt DESC
            `);

        // Combine both types of requests
        const allRequests = [
            ...cancellationRequests.recordset,
            ...legacyRefundRequests.recordset
        ].sort((a, b) => new Date(b.RequestedAt) - new Date(a.RequestedAt));

        console.log(`📊 Found ${allRequests.length} refund requests for user ${req.user.id}`);

        res.json({
            success: true,
            data: allRequests,
            total: allRequests.length
        });

    } catch (error) {
        console.error('❌ Error fetching refund requests:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách yêu cầu hoàn tiền',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Debug endpoint to test membership purchase
router.post('/debug-purchase', protect, async (req, res) => {
    try {
        console.log('🔍 DEBUG: Purchase request received');
        console.log('📋 Request body:', req.body);
        console.log('👤 User from middleware:', {
            id: req.user.id,
            UserID: req.user.UserID,
            email: req.user.email,
            role: req.user.role || req.user.Role
        });

        const { planId, paymentMethod } = req.body;

        // Test 1: Check if planId exists
        console.log('🔍 Testing planId:', planId);

        if (!planId) {
            console.log('❌ No planId provided');
            return res.status(400).json({
                success: false,
                message: 'Plan ID is required',
                debug: {
                    receivedBody: req.body,
                    planId: planId,
                    planIdType: typeof planId
                }
            });
        }

        // Test 2: Check MembershipPlans table
        console.log('🔍 Checking MembershipPlans table...');
        const allPlansResult = await pool.request()
            .query('SELECT PlanID, Name, Price FROM MembershipPlans');

        console.log('📋 Available plans:', allPlansResult.recordset);

        // Test 3: Check specific plan
        const planResult = await pool.request()
            .input('PlanID', planId)
            .query(`SELECT * FROM MembershipPlans WHERE PlanID = @PlanID`);

        console.log('🔍 Plan lookup result:', planResult.recordset);

        if (planResult.recordset.length === 0) {
            console.log('❌ Plan not found in database');
            return res.status(404).json({
                success: false,
                message: 'Membership plan not found',
                debug: {
                    searchedPlanId: planId,
                    availablePlans: allPlansResult.recordset.map(p => ({ PlanID: p.PlanID, Name: p.Name })),
                    totalPlansCount: allPlansResult.recordset.length
                }
            });
        }

        const plan = planResult.recordset[0];
        console.log('✅ Plan found:', plan);

        // Test 4: Validate payment method
        if (!['BankTransfer', 'Cash'].includes(paymentMethod)) {
            console.log('❌ Invalid payment method:', paymentMethod);
            return res.status(400).json({
                success: false,
                message: 'Invalid payment method. Must be BankTransfer or Cash',
                debug: {
                    receivedPaymentMethod: paymentMethod,
                    allowedMethods: ['BankTransfer', 'Cash']
                }
            });
        }

        // Test 5: Try to create payment record
        console.log('🔍 Attempting to create payment record...');

        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + plan.Duration);

        // Use the user ID that exists (either id or UserID)
        const userId = req.user.id || req.user.UserID;
        console.log('👤 Using userId:', userId);

        res.json({
            success: true,
            message: 'Debug purchase completed successfully',
            debug: {
                planFound: plan,
                calculatedDates: {
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString()
                },
                userId: userId,
                paymentMethod: paymentMethod
            }
        });

    } catch (error) {
        console.error('❌ Debug purchase error:', error);
        res.status(500).json({
            success: false,
            message: 'Debug purchase failed',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Request membership cancellation
router.post('/request-cancellation', protect, async (req, res) => {
    try {
        console.log('🔍 Cancellation request received from user:', req.user.id);
        console.log('📝 Request body:', req.body);

        const {
            membershipId,
            reason,
            requestRefund,
            requestedRefundAmount,
            bankAccountNumber,
            bankName,
            accountHolderName
        } = req.body;

        console.log('🔍 Parsed request data:', {
            membershipId,
            reason,
            requestRefund,
            requestedRefundAmount,
            bankAccountNumber,
            bankName,
            accountHolderName
        });

        // Validate request
        if (!membershipId) {
            return res.status(400).json({
                success: false,
                message: 'Membership ID is required'
            });
        }

        if (!reason || reason.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Cancellation reason is required'
            });
        }

        // If requesting refund, require bank account information
        if (requestRefund && (!bankAccountNumber || !bankName || !accountHolderName)) {
            return res.status(400).json({
                success: false,
                message: 'Thông tin tài khoản ngân hàng là bắt buộc khi yêu cầu hoàn tiền'
            });
        }

        // Handle AUTO_DETECT membershipId - find user's active membership
        let actualMembershipId = membershipId;
        if (membershipId === "AUTO_DETECT") {
            console.log('🔍 Auto-detecting membership for user:', req.user.id);

            const autoDetectResult = await pool.request()
                .input('UserID', req.user.id)
                .query(`
                    SELECT TOP 1 MembershipID 
                    FROM UserMemberships 
                    WHERE UserID = @UserID AND Status = 'active'
                    ORDER BY CreatedAt DESC
                `);

            if (autoDetectResult.recordset.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy gói dịch vụ đang hoạt động để hủy'
                });
            }

            actualMembershipId = autoDetectResult.recordset[0].MembershipID;
            console.log('✅ Auto-detected membershipId:', actualMembershipId);
        }

        // Check if user owns this membership and it's active
        const membershipResult = await pool.request()
            .input('UserID', req.user.id)
            .input('MembershipID', actualMembershipId)
            .query(`
                SELECT 
                    um.*,
                    mp.Name as PlanName,
                    mp.Price as PlanPrice,
                    p.PaymentID,
                    p.Amount as PaidAmount,
                    p.PaymentDate
                FROM UserMemberships um
                JOIN MembershipPlans mp ON um.PlanID = mp.PlanID
                LEFT JOIN Payments p ON um.UserID = p.UserID AND um.PlanID = p.PlanID AND p.Status = 'confirmed'
                WHERE um.UserID = @UserID AND um.MembershipID = @MembershipID
            `);

        if (membershipResult.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Membership not found or you do not have permission to cancel it'
            });
        }

        const membership = membershipResult.recordset[0];

        // Check if membership is already cancelled or has a pending cancellation
        if (membership.Status === 'cancelled') {
            return res.status(400).json({
                success: false,
                message: 'This membership is already cancelled'
            });
        }

        if (membership.Status === 'pending_cancellation') {
            return res.status(400).json({
                success: false,
                message: 'A cancellation request for this membership is already pending'
            });
        }

        // Check if there's already a pending cancellation request
        const existingRequestResult = await pool.request()
            .input('MembershipID', actualMembershipId)
            .input('UserID', req.user.id)
            .query(`
                SELECT * FROM CancellationRequests 
                WHERE MembershipID = @MembershipID AND UserID = @UserID AND Status = 'pending'
            `);

        if (existingRequestResult.recordset.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'You already have a pending cancellation request for this membership'
            });
        }

        // Validate refund amount if requested
        let validatedRefundAmount = null;
        if (requestRefund) {
            if (requestedRefundAmount) {
                const maxRefundAmount = membership.PaidAmount || membership.PlanPrice;
                if (requestedRefundAmount > maxRefundAmount) {
                    return res.status(400).json({
                        success: false,
                        message: `Requested refund amount cannot exceed the paid amount of ${maxRefundAmount.toLocaleString('vi-VN')} VNĐ`
                    });
                }
                validatedRefundAmount = requestedRefundAmount;
            } else {
                // Auto-calculate 50% refund
                const originalAmount = membership.PaidAmount || membership.PlanPrice;
                validatedRefundAmount = Math.floor(originalAmount * 0.5);
                console.log(`💰 Auto-calculated refund amount: ${validatedRefundAmount} (50% of ${originalAmount})`);
            }
        }

        // Start transaction
        const transaction = pool.transaction();
        await transaction.begin();

        try {
            // Create cancellation request with bank info
            const cancellationResult = await transaction.request()
                .input('UserID', req.user.id)
                .input('MembershipID', actualMembershipId)
                .input('PaymentID', membership.PaymentID)
                .input('CancellationReason', reason.trim())
                .input('RequestedRefundAmount', validatedRefundAmount)
                .input('BankAccountNumber', requestRefund ? bankAccountNumber : null)
                .input('BankName', requestRefund ? bankName : null)
                .input('AccountHolderName', requestRefund ? accountHolderName : null)
                .query(`
                    INSERT INTO CancellationRequests (
                        UserID, MembershipID, PaymentID, CancellationReason, RequestedRefundAmount,
                        BankAccountNumber, BankName, AccountHolderName, Status
                    )
                    OUTPUT INSERTED.*
                    VALUES (
                        @UserID, @MembershipID, @PaymentID, @CancellationReason, @RequestedRefundAmount,
                        @BankAccountNumber, @BankName, @AccountHolderName, 'pending'
                    )
                `);

            const cancellationRequest = cancellationResult.recordset[0];

            // Update membership status to pending_cancellation
            await transaction.request()
                .input('MembershipID', actualMembershipId)
                .query(`
                    UPDATE UserMemberships 
                    SET Status = 'pending_cancellation'
                    WHERE MembershipID = @MembershipID
                `);

            // Create notification for user
            await transaction.request()
                .input('UserID', req.user.id)
                .input('Title', 'Yêu cầu hủy gói dịch vụ đã được gửi')
                .input('Message', `Yêu cầu hủy gói ${membership.PlanName} của bạn đã được gửi đến admin. Bạn sẽ nhận được thông báo khi yêu cầu được xử lý.`)
                .input('Type', 'cancellation')
                .input('RelatedID', cancellationRequest.CancellationRequestID)
                .query(`
                    INSERT INTO Notifications (UserID, Title, Message, Type, RelatedID)
                    VALUES (@UserID, @Title, @Message, @Type, @RelatedID)
                `);

            // Get user info for admin notification
            const userResult = await transaction.request()
                .input('UserID', req.user.id)
                .query(`
                    SELECT FirstName, LastName, Email, PhoneNumber 
                    FROM Users 
                    WHERE UserID = @UserID
                `);

            const user = userResult.recordset[0];

            // Create notification for admin
            const adminResult = await transaction.request()
                .query(`SELECT UserID FROM Users WHERE Role = 'admin' AND IsActive = 1`);

            for (const admin of adminResult.recordset) {
                const message = requestRefund
                    ? `Người dùng ${user.FirstName} ${user.LastName} đã yêu cầu hủy gói ${membership.PlanName} và hoàn tiền ${validatedRefundAmount?.toLocaleString('vi-VN')} VNĐ. Thông tin ngân hàng: ${bankName} - ${bankAccountNumber} - ${accountHolderName}. Vui lòng kiểm tra và xử lý.`
                    : `Người dùng ${user.FirstName} ${user.LastName} đã yêu cầu hủy gói ${membership.PlanName}. Vui lòng kiểm tra và xử lý.`;

                await transaction.request()
                    .input('UserID', admin.UserID)
                    .input('Title', 'Yêu cầu hủy gói dịch vụ mới')
                    .input('Message', message)
                    .input('Type', 'admin_cancellation')
                    .input('RelatedID', cancellationRequest.CancellationRequestID)
                    .query(`
                        INSERT INTO Notifications (UserID, Title, Message, Type, RelatedID)
                        VALUES (@UserID, @Title, @Message, @Type, @RelatedID)
                    `);
            }

            await transaction.commit();

            console.log('✅ Cancellation request created:', cancellationRequest.CancellationRequestID);

            res.json({
                success: true,
                message: 'Yêu cầu hủy gói dịch vụ đã được gửi thành công. Admin sẽ xem xét và phản hồi trong thời gian sớm nhất.',
                data: {
                    cancellationRequestId: cancellationRequest.CancellationRequestID,
                    status: 'pending',
                    requestedAt: cancellationRequest.RequestedAt,
                    membership: {
                        id: membership.MembershipID,
                        planName: membership.PlanName,
                        status: 'pending_cancellation'
                    },
                    bankInfo: requestRefund ? {
                        accountNumber: bankAccountNumber,
                        bankName: bankName,
                        accountHolder: accountHolderName
                    } : null
                }
            });

        } catch (error) {
            await transaction.rollback();
            throw error;
        }

    } catch (error) {
        console.error('❌ Error processing cancellation request:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing cancellation request',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get user's cancellation requests
router.get('/cancellation-requests', protect, async (req, res) => {
    try {
        const result = await pool.request()
            .input('UserID', req.user.id)
            .query(`
                SELECT 
                    cr.*,
                    um.MembershipID,
                    mp.Name as PlanName,
                    mp.Price as PlanPrice,
                    u.FirstName + ' ' + u.LastName as ProcessedByName
                FROM CancellationRequests cr
                JOIN UserMemberships um ON cr.MembershipID = um.MembershipID
                JOIN MembershipPlans mp ON um.PlanID = mp.PlanID
                LEFT JOIN Users u ON cr.ProcessedByUserID = u.UserID
                WHERE cr.UserID = @UserID
                ORDER BY cr.RequestedAt DESC
            `);

        res.json({
            success: true,
            data: result.recordset
        });

    } catch (error) {
        console.error('❌ Error fetching cancellation requests:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving cancellation requests'
        });
    }
});

// Member confirms refund received
router.post('/confirm-refund-received/:cancellationId', protect, async (req, res) => {
    try {
        const { cancellationId } = req.params;
        const { confirmed } = req.body;

        console.log('💰 Member confirming refund received for cancellation:', cancellationId);

        if (!confirmed) {
            return res.status(400).json({
                success: false,
                message: 'Xác nhận là bắt buộc'
            });
        }

        // Start transaction
        const transaction = pool.transaction();
        await transaction.begin();

        try {
            // Check if cancellation request exists and transfer was confirmed
            const cancellationResult = await transaction.request()
                .input('CancellationRequestID', cancellationId)
                .input('UserID', req.user.id)
                .query(`
                    SELECT cr.*, um.*, mp.Name as PlanName, u.FirstName, u.LastName
                    FROM CancellationRequests cr
                    JOIN UserMemberships um ON cr.MembershipID = um.MembershipID
                    JOIN MembershipPlans mp ON um.PlanID = mp.PlanID
                    JOIN Users u ON cr.UserID = u.UserID
                    WHERE cr.CancellationRequestID = @CancellationRequestID 
                    AND cr.UserID = @UserID
                    AND cr.Status = 'transfer_confirmed'
                    AND cr.TransferConfirmed = 1
                    AND cr.RefundReceived = 0
                `);

            if (cancellationResult.recordset.length === 0) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy yêu cầu hủy gói phù hợp hoặc bạn đã xác nhận nhận tiền rồi'
                });
            }

            const cancellation = cancellationResult.recordset[0];

            // Update cancellation request - mark refund as received
            await transaction.request()
                .input('CancellationRequestID', cancellationId)
                .query(`
                    UPDATE CancellationRequests
                    SET RefundReceived = 1,
                        ReceivedDate = GETDATE(),
                        Status = 'completed'
                    WHERE CancellationRequestID = @CancellationRequestID
                `);

            // Check if user has any other active memberships
            const otherMembershipsResult = await transaction.request()
                .input('UserID', req.user.id)
                .query(`
                    SELECT COUNT(*) as ActiveCount
                    FROM UserMemberships
                    WHERE UserID = @UserID AND Status = 'active'
                `);

            const hasOtherActiveMemberships = otherMembershipsResult.recordset[0].ActiveCount > 0;

            // If no other active memberships, change user role to guest
            if (!hasOtherActiveMemberships) {
                await transaction.request()
                    .input('UserID', req.user.id)
                    .query(`
                        UPDATE Users
                        SET Role = 'guest'
                        WHERE UserID = @UserID
                    `);

                console.log('🔄 User role changed to guest due to no active memberships');
            }

            // Create notification for user
            await transaction.request()
                .input('UserID', req.user.id)
                .input('Title', 'Quá trình hủy gói hoàn tất')
                .input('Message', hasOtherActiveMemberships
                    ? `Bạn đã xác nhận nhận được tiền hoàn trả cho gói ${cancellation.PlanName}. Quá trình hủy gói hoàn tất.`
                    : `Bạn đã xác nhận nhận được tiền hoàn trả cho gói ${cancellation.PlanName}. Tài khoản của bạn đã chuyển về Guest do không có gói dịch vụ nào đang hoạt động.`)
                .input('Type', 'refund_completed')
                .input('RelatedID', cancellationId)
                .query(`
                    INSERT INTO Notifications (UserID, Title, Message, Type, RelatedID)
                    VALUES (@UserID, @Title, @Message, @Type, @RelatedID)
                `);

            // Create notification for admin
            const adminResult = await transaction.request()
                .query(`SELECT UserID FROM Users WHERE Role = 'admin' AND IsActive = 1`);

            for (const admin of adminResult.recordset) {
                await transaction.request()
                    .input('UserID', admin.UserID)
                    .input('Title', 'Member đã xác nhận nhận tiền hoàn trả')
                    .input('Message', `Thành viên ${cancellation.FirstName} ${cancellation.LastName} đã xác nhận nhận được tiền hoàn trả ${cancellation.RefundAmount?.toLocaleString('vi-VN')} VNĐ cho gói ${cancellation.PlanName}. Quá trình hủy gói hoàn tất.${!hasOtherActiveMemberships ? ' Tài khoản đã chuyển về Guest.' : ''}`)
                    .input('Type', 'admin_refund_completed')
                    .input('RelatedID', cancellationId)
                    .query(`
                        INSERT INTO Notifications (UserID, Title, Message, Type, RelatedID)
                        VALUES (@UserID, @Title, @Message, @Type, @RelatedID)
                    `);
            }

            await transaction.commit();

            console.log('✅ Refund received confirmed successfully');

            res.json({
                success: true,
                message: 'Đã xác nhận nhận tiền hoàn trả thành công. Quá trình hủy gói hoàn tất.',
                data: {
                    cancellationId: cancellationId,
                    receivedDate: new Date(),
                    refundAmount: cancellation.RefundAmount,
                    newRole: hasOtherActiveMemberships ? 'member' : 'guest',
                    status: 'completed'
                }
            });

        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Error confirming refund received:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xác nhận nhận tiền hoàn trả'
        });
    }
});

// Test endpoint to create a test payment for cancellation testing
router.post('/create-test-payment', protect, async (req, res) => {
    try {
        console.log('🔧 Creating test payment for user:', req.user.id);

        const userId = req.user.id;

        // Start transaction
        const transaction = pool.transaction();
        await transaction.begin();

        try {
            // Create a test payment
            const paymentResult = await transaction.request()
                .input('UserID', userId)
                .input('PlanID', 1) // Use plan 1
                .input('Amount', 199000)
                .input('PaymentMethod', 'BankTransfer')
                .input('Status', 'confirmed')
                .input('TransactionID', 'TEST-' + Date.now())
                .query(`
                    INSERT INTO Payments (UserID, PlanID, Amount, PaymentMethod, Status, TransactionID, StartDate, EndDate, PaymentDate)
                    OUTPUT INSERTED.*
                    VALUES (@UserID, @PlanID, @Amount, @PaymentMethod, @Status, @TransactionID, GETDATE(), DATEADD(DAY, 60, GETDATE()), GETDATE())
                `);

            const payment = paymentResult.recordset[0];

            // Create corresponding membership
            await transaction.request()
                .input('UserID', userId)
                .input('PlanID', 1)
                .query(`
                    INSERT INTO UserMemberships (UserID, PlanID, Status, StartDate, EndDate, CreatedAt)
                    VALUES (@UserID, @PlanID, 'active', GETDATE(), DATEADD(DAY, 60, GETDATE()), GETDATE())
                `);

            // Update user role to member
            await transaction.request()
                .input('UserID', userId)
                .query(`
                    UPDATE Users 
                    SET Role = 'member' 
                    WHERE UserID = @UserID
                `);

            await transaction.commit();

            console.log('✅ Test payment created successfully');

            res.json({
                success: true,
                message: 'Test payment created successfully',
                data: {
                    paymentId: payment.PaymentID,
                    amount: payment.Amount,
                    status: payment.Status
                }
            });

        } catch (error) {
            await transaction.rollback();
            throw error;
        }

    } catch (error) {
        console.error('❌ Error creating test payment:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating test payment',
            error: error.message
        });
    }
});

// Debug endpoint to check user's membership data
router.get('/debug-membership', protect, async (req, res) => {
    try {
        console.log('🔍 Debug membership for user:', req.user.id);

        // Get all memberships for user
        const membershipResult = await pool.request()
            .input('UserID', req.user.id)
            .query(`
                SELECT 
                    um.*,
                    mp.Name as PlanName,
                    mp.Price as PlanPrice,
                    p.PaymentID,
                    p.Amount as PaidAmount,
                    p.PaymentDate,
                    p.Status as PaymentStatus
                FROM UserMemberships um
                JOIN MembershipPlans mp ON um.PlanID = mp.PlanID
                LEFT JOIN Payments p ON um.UserID = p.UserID AND um.PlanID = p.PlanID
                WHERE um.UserID = @UserID
                ORDER BY um.CreatedAt DESC
            `);

        // Get all payments for user
        const paymentResult = await pool.request()
            .input('UserID', req.user.id)
            .query(`
                SELECT * FROM Payments 
                WHERE UserID = @UserID 
                ORDER BY PaymentDate DESC
            `);

        // Get existing cancellation requests
        const cancellationResult = await pool.request()
            .input('UserID', req.user.id)
            .query(`
                SELECT * FROM CancellationRequests 
                WHERE UserID = @UserID 
                ORDER BY RequestedAt DESC
            `);

        res.json({
            success: true,
            data: {
                userId: req.user.id,
                memberships: membershipResult.recordset,
                payments: paymentResult.recordset,
                cancellationRequests: cancellationResult.recordset
            }
        });

    } catch (error) {
        console.error('❌ Debug membership error:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting debug membership data',
            error: error.message
        });
    }
});

// Test endpoint to check database tables
router.get('/test-database', protect, async (req, res) => {
    try {
        console.log('🔍 Testing database connection and tables...');

        // Test 1: Check if CancellationRequests table exists
        try {
            const tableCheck = await pool.request().query(`
                SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = 'CancellationRequests'
                ORDER BY ORDINAL_POSITION
            `);
            console.log('📋 CancellationRequests table structure:', tableCheck.recordset);
        } catch (error) {
            console.log('❌ CancellationRequests table error:', error.message);
        }

        // Test 2: Check UserMemberships for this user
        try {
            const membershipCheck = await pool.request()
                .input('UserID', req.user.id)
                .query(`
                    SELECT TOP 5 * FROM UserMemberships 
                    WHERE UserID = @UserID 
                    ORDER BY CreatedAt DESC
                `);
            console.log('👤 User memberships:', membershipCheck.recordset);
        } catch (error) {
            console.log('❌ UserMemberships error:', error.message);
        }

        // Test 3: Check user info
        try {
            const userCheck = await pool.request()
                .input('UserID', req.user.id)
                .query(`SELECT * FROM Users WHERE UserID = @UserID`);
            console.log('👤 User info:', userCheck.recordset[0]);
        } catch (error) {
            console.log('❌ Users table error:', error.message);
        }

        res.json({
            success: true,
            message: 'Database test completed - check server console for details',
            userId: req.user.id
        });

    } catch (error) {
        console.error('❌ Database test error:', error);
        res.status(500).json({
            success: false,
            message: 'Database test failed',
            error: error.message
        });
    }
});

// Simple cancellation endpoint for testing
router.post('/simple-cancel', protect, async (req, res) => {
    try {
        console.log('🔍 Simple cancel request from user:', req.user.id);
        console.log('📝 Request body:', req.body);

        const { reason, bankAccountNumber, bankName, accountHolderName } = req.body;

        // Basic validation
        if (!reason || !bankAccountNumber || !bankName || !accountHolderName) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin bắt buộc'
            });
        }

        // Find user's active membership
        const membershipResult = await pool.request()
            .input('UserID', req.user.id)
            .query(`
                SELECT TOP 1 
                    um.*,
                    mp.Name as PlanName,
                    mp.Price as PlanPrice
                FROM UserMemberships um
                JOIN MembershipPlans mp ON um.PlanID = mp.PlanID
                WHERE um.UserID = @UserID AND um.Status = 'active'
                ORDER BY um.CreatedAt DESC
            `);

        if (membershipResult.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy gói dịch vụ đang hoạt động'
            });
        }

        const membership = membershipResult.recordset[0];
        console.log('✅ Found membership to cancel:', membership);

        // Get payment info for this membership
        const paymentResult = await pool.request()
            .input('UserID', req.user.id)
            .input('PlanID', membership.PlanID)
            .query(`
                SELECT TOP 1 * FROM Payments 
                WHERE UserID = @UserID AND PlanID = @PlanID AND Status = 'confirmed'
                ORDER BY PaymentDate DESC
            `);

        const payment = paymentResult.recordset[0];

        // Calculate 50% refund
        const originalAmount = payment ? payment.Amount : membership.PlanPrice;
        const refundAmount = Math.floor(originalAmount * 0.5);

        // Start transaction to save cancellation request
        const transaction = pool.transaction();
        await transaction.begin();

        try {
            // Try to save to CancellationRequests table first
            let cancellationRequest;
            try {
                const cancellationResult = await transaction.request()
                    .input('UserID', req.user.id)
                    .input('MembershipID', membership.MembershipID)
                    .input('PaymentID', payment ? payment.PaymentID : null)
                    .input('CancellationReason', reason.trim())
                    .input('RequestedRefundAmount', refundAmount)
                    .input('BankAccountNumber', bankAccountNumber)
                    .input('BankName', bankName)
                    .input('AccountHolderName', accountHolderName)
                    .query(`
                        INSERT INTO CancellationRequests (
                            UserID, MembershipID, PaymentID, CancellationReason, RequestedRefundAmount,
                            BankAccountNumber, BankName, AccountHolderName, Status, RequestedAt
                        )
                        OUTPUT INSERTED.*
                        VALUES (
                            @UserID, @MembershipID, @PaymentID, @CancellationReason, @RequestedRefundAmount,
                            @BankAccountNumber, @BankName, @AccountHolderName, 'pending', GETDATE()
                        )
                    `);

                cancellationRequest = cancellationResult.recordset[0];
                console.log('✅ Created CancellationRequest:', cancellationRequest.CancellationRequestID);

            } catch (cancellationError) {
                console.error('❌ CancellationRequests table error:', cancellationError);

                // Fallback: Create in RefundRequests table
                console.log('🔄 Trying RefundRequests table instead...');

                const refundResult = await transaction.request()
                    .input('UserID', req.user.id)
                    .input('PaymentID', payment ? payment.PaymentID : null)
                    .input('MembershipID', membership.MembershipID)
                    .input('RefundAmount', refundAmount)
                    .input('RefundReason', reason.trim())
                    .input('BankAccountNumber', bankAccountNumber)
                    .input('BankName', bankName)
                    .input('AccountHolderName', accountHolderName)
                    .query(`
                        INSERT INTO RefundRequests (
                            UserID, PaymentID, MembershipID, RefundAmount, RefundReason,
                            BankAccountNumber, BankName, AccountHolderName, Status, RequestedAt
                        )
                        OUTPUT INSERTED.*
                        VALUES (
                            @UserID, @PaymentID, @MembershipID, @RefundAmount, @RefundReason,
                            @BankAccountNumber, @BankName, @AccountHolderName, 'pending', GETDATE()
                        )
                    `);

                cancellationRequest = refundResult.recordset[0];
                console.log('✅ Created RefundRequest:', cancellationRequest.RefundRequestID || cancellationRequest.ID);
            }

            // Update membership status to pending_cancellation
            await transaction.request()
                .input('MembershipID', membership.MembershipID)
                .query(`
                    UPDATE UserMemberships 
                    SET Status = 'pending_cancellation'
                    WHERE MembershipID = @MembershipID
                `);

            console.log('✅ Updated membership status to pending_cancellation');

            // Create notification for user
            await transaction.request()
                .input('UserID', req.user.id)
                .input('Title', 'Yêu cầu hủy gói dịch vụ đã được gửi')
                .input('Message', `Yêu cầu hủy gói ${membership.PlanName} của bạn đã được gửi đến admin. Bạn sẽ nhận được thông báo khi yêu cầu được xử lý.`)
                .input('Type', 'cancellation')
                .query(`
                    INSERT INTO Notifications (UserID, Title, Message, Type, CreatedAt)
                    VALUES (@UserID, @Title, @Message, @Type, GETDATE())
                `);

            console.log('✅ Created user notification');

            // Get user info for admin notification
            const userResult = await transaction.request()
                .input('UserID', req.user.id)
                .query(`
                    SELECT FirstName, LastName, Email, PhoneNumber 
                    FROM Users 
                    WHERE UserID = @UserID
                `);

            const user = userResult.recordset[0] || { FirstName: 'Unknown', LastName: 'User' };

            // Create notification for admin
            const adminResult = await transaction.request()
                .query(`SELECT UserID FROM Users WHERE Role = 'admin' AND IsActive = 1`);

            if (adminResult.recordset.length > 0) {
                for (const admin of adminResult.recordset) {
                    const message = `Người dùng ${user.FirstName} ${user.LastName} đã yêu cầu hủy gói ${membership.PlanName} và hoàn tiền ${refundAmount.toLocaleString('vi-VN')} VNĐ. Thông tin ngân hàng: ${bankName} - ${bankAccountNumber} - ${accountHolderName}. Vui lòng kiểm tra và xử lý.`;

                    await transaction.request()
                        .input('UserID', admin.UserID)
                        .input('Title', 'Yêu cầu hủy gói dịch vụ mới')
                        .input('Message', message)
                        .input('Type', 'admin_cancellation')
                        .query(`
                            INSERT INTO Notifications (UserID, Title, Message, Type, CreatedAt)
                            VALUES (@UserID, @Title, @Message, @Type, GETDATE())
                        `);
                }
                console.log('✅ Created admin notifications');
            }

            await transaction.commit();

            console.log('🎉 Cancellation request saved successfully!');

            res.json({
                success: true,
                message: 'Yêu cầu hủy gói dịch vụ đã được gửi thành công. Admin sẽ xem xét và xử lý trong vòng 3-5 ngày làm việc.',
                data: {
                    cancellationRequestId: cancellationRequest.CancellationRequestID || cancellationRequest.RefundRequestID || cancellationRequest.ID,
                    membershipId: membership.MembershipID,
                    planName: membership.PlanName,
                    refundAmount: refundAmount,
                    status: 'pending',
                    bankInfo: {
                        accountNumber: bankAccountNumber,
                        bankName: bankName,
                        accountHolder: accountHolderName
                    }
                }
            });

        } catch (transactionError) {
            await transaction.rollback();
            throw transactionError;
        }

    } catch (error) {
        console.error('❌ Simple cancel error:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing cancellation request',
            error: error.message
        });
    }
});

module.exports = router; 
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { protect, authorize } = require('../middleware/auth.middleware');

// Admin login endpoint - only for role 'admin'
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập đầy đủ email và mật khẩu'
            });
        }

        // Check if user exists and has admin role
        const result = await pool.request()
            .input('Email', email)
            .query(`
                SELECT UserID, Email, Password, FirstName, LastName, Role, IsActive, EmailVerified
                FROM Users 
                WHERE Email = @Email AND Role = 'admin'
            `);

        if (result.recordset.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Email không tồn tại hoặc không có quyền admin'
            });
        }

        const user = result.recordset[0];

        // Check if account is active
        if (!user.IsActive) {
            return res.status(401).json({
                success: false,
                message: 'Tài khoản chưa được kích hoạt'
            });
        }

        // Verify password (no hash - plain text comparison)
        if (password !== user.Password) {
            return res.status(401).json({
                success: false,
                message: 'Mật khẩu không chính xác'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                id: user.UserID,
                email: user.Email,
                role: user.Role
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE || '8h' }
        );

        // Update last login
        await pool.request()
            .input('UserID', user.UserID)
            .query(`
                UPDATE Users 
                SET LastLoginAt = GETDATE() 
                WHERE UserID = @UserID
            `);

        // Record login history
        const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';

        await pool.request()
            .input('UserID', user.UserID)
            .input('IPAddress', ipAddress)
            .input('UserAgent', userAgent)
            .query(`
                INSERT INTO LoginHistory (UserID, IPAddress, UserAgent, Status)
                VALUES (@UserID, @IPAddress, @UserAgent, 'success')
            `);

        // Set cookie
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 8 * 60 * 60 * 1000 // 8 hours
        };

        res.cookie('token', token, cookieOptions);

        res.json({
            success: true,
            token,
            user: {
                id: user.UserID,
                email: user.Email,
                firstName: user.FirstName,
                lastName: user.LastName,
                role: user.Role
            },
            message: 'Đăng nhập thành công'
        });

    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi đăng nhập',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Admin logout
router.post('/logout', protect, authorize('admin'), async (req, res) => {
    try {
        res.clearCookie('token');
        res.json({
            success: true,
            message: 'Đăng xuất thành công'
        });
    } catch (error) {
        console.error('Admin logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi đăng xuất'
        });
    }
});

// Get dashboard statistics
router.get('/dashboard-stats', protect, authorize('admin'), async (req, res) => {
    try {
        // Get total users
        const totalUsersResult = await pool.request().query(`
            SELECT COUNT(*) as totalUsers FROM Users
        `);

        // Get total plans sold
        const totalPlansResult = await pool.request().query(`
            SELECT COUNT(*) as totalPlans FROM UserMemberships WHERE Status = 'active'
        `);

        // Get successful quitters (people with completed quit plans)
        const successfulQuittersResult = await pool.request().query(`
            SELECT COUNT(DISTINCT UserID) as successfulQuitters 
            FROM QuitPlans 
            WHERE Status = 'completed'
        `);

        // Get total revenue
        const totalRevenueResult = await pool.request().query(`
            SELECT SUM(Amount) as totalRevenue 
            FROM Payments 
            WHERE Status = 'confirmed'
        `);

        // Get average rating and total feedback
        const feedbackStatsResult = await pool.request().query(`
            SELECT 
                AVG(CAST(Rating as FLOAT)) as averageRating,
                COUNT(*) as totalFeedback
            FROM CoachFeedback 
            WHERE Status = 'active'
        `);

        // Get recent users (last 10)
        const recentUsersResult = await pool.request().query(`
            SELECT TOP 10 
                UserID, FirstName, LastName, Email, Role, Avatar, CreatedAt
            FROM Users 
            ORDER BY CreatedAt DESC
        `);

        // Get recent payments (last 10)
        const recentPaymentsResult = await pool.request().query(`
            SELECT TOP 10 
                p.PaymentID, p.Amount, p.Status, p.PaymentDate,
                u.FirstName, u.LastName,
                mp.Name as PlanName
            FROM Payments p
            JOIN Users u ON p.UserID = u.UserID
            JOIN MembershipPlans mp ON p.PlanID = mp.PlanID
            ORDER BY p.PaymentDate DESC
        `);

        // Get top rated coaches
        const topRatedCoachesResult = await pool.request().query(`
            SELECT TOP 5
                c.UserID as CoachID,
                c.FirstName + ' ' + c.LastName as CoachName,
                c.Avatar,
                AVG(CAST(cf.Rating as FLOAT)) as AverageRating,
                COUNT(cf.FeedbackID) as TotalReviews
            FROM Users c
            LEFT JOIN CoachFeedback cf ON c.UserID = cf.CoachID AND cf.Status = 'active'
            WHERE c.Role = 'coach'
            GROUP BY c.UserID, c.FirstName, c.LastName, c.Avatar
            HAVING COUNT(cf.FeedbackID) > 0
            ORDER BY AverageRating DESC, TotalReviews DESC
        `);

        const stats = {
            totalUsers: totalUsersResult.recordset[0].totalUsers,
            totalPlans: totalPlansResult.recordset[0].totalPlans,
            successfulQuitters: successfulQuittersResult.recordset[0].successfulQuitters,
            totalRevenue: totalRevenueResult.recordset[0].totalRevenue || 0,
            averageRating: feedbackStatsResult.recordset[0].averageRating || 0,
            totalFeedback: feedbackStatsResult.recordset[0].totalFeedback || 0
        };

        const recentData = {
            recentUsers: recentUsersResult.recordset,
            recentPayments: recentPaymentsResult.recordset,
            topRatedCoaches: topRatedCoachesResult.recordset
        };

        res.json({
            success: true,
            stats,
            recentData,
            message: 'Thống kê dashboard được tải thành công'
        });

    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tải thống kê dashboard',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get detailed user statistics
router.get('/user-stats', protect, authorize('admin'), async (req, res) => {
    try {
        const userStatsResult = await pool.request().query(`
            SELECT 
                Role,
                COUNT(*) as Count,
                COUNT(CASE WHEN IsActive = 1 THEN 1 END) as ActiveCount,
                COUNT(CASE WHEN EmailVerified = 1 THEN 1 END) as VerifiedCount
            FROM Users
            GROUP BY Role
        `);

        res.json({
            success: true,
            data: userStatsResult.recordset,
            message: 'Thống kê người dùng được tải thành công'
        });

    } catch (error) {
        console.error('User stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tải thống kê người dùng',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get payment statistics
router.get('/payment-stats', protect, authorize('admin'), async (req, res) => {
    try {
        const paymentStatsResult = await pool.request().query(`
            SELECT 
                Status,
                COUNT(*) as Count,
                SUM(Amount) as TotalAmount,
                AVG(Amount) as AverageAmount
            FROM Payments
            GROUP BY Status
        `);

        const monthlyRevenueResult = await pool.request().query(`
            SELECT 
                YEAR(PaymentDate) as Year,
                MONTH(PaymentDate) as Month,
                SUM(Amount) as Revenue,
                COUNT(*) as TransactionCount
            FROM Payments
            WHERE Status = 'confirmed'
            GROUP BY YEAR(PaymentDate), MONTH(PaymentDate)
            ORDER BY Year DESC, Month DESC
        `);

        res.json({
            success: true,
            data: {
                paymentStats: paymentStatsResult.recordset,
                monthlyRevenue: monthlyRevenueResult.recordset
            },
            message: 'Thống kê thanh toán được tải thành công'
        });

    } catch (error) {
        console.error('Payment stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tải thống kê thanh toán',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ==================== PLANS MANAGEMENT ====================

// Get all membership plans
router.get('/plans', protect, authorize('admin'), async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT 
                PlanID,
                Name,
                Description,
                Price,
                Duration,
                Features,
                CreatedAt
            FROM MembershipPlans
            ORDER BY CreatedAt DESC
        `);

        res.json({
            success: true,
            data: result.recordset,
            message: 'Danh sách plans được tải thành công'
        });

    } catch (error) {
        console.error('Get plans error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tải danh sách plans',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Create new membership plan
router.post('/plans', protect, authorize('admin'), async (req, res) => {
    try {
        const { Name, Description, Price, Duration, Features } = req.body;

        // Validate input
        if (!Name || !Description || !Price || !Duration || !Features) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập đầy đủ thông tin plan'
            });
        }

        // Check if plan name already exists
        const existingPlan = await pool.request()
            .input('Name', Name)
            .query(`
                SELECT PlanID FROM MembershipPlans WHERE Name = @Name
            `);

        if (existingPlan.recordset.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Tên plan đã tồn tại'
            });
        }

        // Insert new plan
        const result = await pool.request()
            .input('Name', Name)
            .input('Description', Description)
            .input('Price', Price)
            .input('Duration', Duration)
            .input('Features', Features)
            .query(`
                INSERT INTO MembershipPlans (Name, Description, Price, Duration, Features)
                OUTPUT INSERTED.PlanID, INSERTED.Name, INSERTED.Description, INSERTED.Price, 
                       INSERTED.Duration, INSERTED.Features, INSERTED.CreatedAt
                VALUES (@Name, @Description, @Price, @Duration, @Features)
            `);

        res.status(201).json({
            success: true,
            data: result.recordset[0],
            message: 'Tạo plan thành công'
        });

    } catch (error) {
        console.error('Create plan error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tạo plan',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Update membership plan
router.put('/plans/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { Name, Description, Price, Duration, Features } = req.body;

        // Validate input
        if (!Name || !Description || !Price || !Duration || !Features) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập đầy đủ thông tin plan'
            });
        }

        // Check if plan exists
        const existingPlan = await pool.request()
            .input('PlanID', id)
            .query(`
                SELECT PlanID FROM MembershipPlans WHERE PlanID = @PlanID
            `);

        if (existingPlan.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Plan không tồn tại'
            });
        }

        // Check if new name conflicts with other plans
        const nameConflict = await pool.request()
            .input('Name', Name)
            .input('PlanID', id)
            .query(`
                SELECT PlanID FROM MembershipPlans 
                WHERE Name = @Name AND PlanID != @PlanID
            `);

        if (nameConflict.recordset.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Tên plan đã tồn tại'
            });
        }

        // Update plan
        const result = await pool.request()
            .input('PlanID', id)
            .input('Name', Name)
            .input('Description', Description)
            .input('Price', Price)
            .input('Duration', Duration)
            .input('Features', Features)
            .query(`
                UPDATE MembershipPlans 
                SET Name = @Name, 
                    Description = @Description, 
                    Price = @Price, 
                    Duration = @Duration, 
                    Features = @Features
                OUTPUT INSERTED.PlanID, INSERTED.Name, INSERTED.Description, INSERTED.Price, 
                       INSERTED.Duration, INSERTED.Features, INSERTED.CreatedAt
                WHERE PlanID = @PlanID
            `);

        res.json({
            success: true,
            data: result.recordset[0],
            message: 'Cập nhật plan thành công'
        });

    } catch (error) {
        console.error('Update plan error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật plan',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Delete membership plan
router.delete('/plans/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;

        // Check if plan exists
        const existingPlan = await pool.request()
            .input('PlanID', id)
            .query(`
                SELECT PlanID FROM MembershipPlans WHERE PlanID = @PlanID
            `);

        if (existingPlan.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Plan không tồn tại'
            });
        }

        // Check if plan is being used by any user memberships
        const usageCheck = await pool.request()
            .input('PlanID', id)
            .query(`
                SELECT COUNT(*) as usageCount 
                FROM UserMemberships 
                WHERE PlanID = @PlanID AND Status = 'active'
            `);

        if (usageCheck.recordset[0].usageCount > 0) {
            return res.status(400).json({
                success: false,
                message: 'Không thể xóa plan đang được sử dụng bởi người dùng'
            });
        }

        // Delete plan
        await pool.request()
            .input('PlanID', id)
            .query(`
                DELETE FROM MembershipPlans WHERE PlanID = @PlanID
            `);

        res.json({
            success: true,
            message: 'Xóa plan thành công'
        });

    } catch (error) {
        console.error('Delete plan error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xóa plan',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ==================== COACH MANAGEMENT ====================

// Get all coaches with their profiles and stats
router.get('/coaches', protect, authorize('admin'), async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT 
                u.UserID,
                u.Email,
                u.FirstName,
                u.LastName,
                u.Avatar,
                u.PhoneNumber,
                u.Address,
                u.IsActive,
                u.CreatedAt,
                cp.Bio,
                cp.Specialization,
                cp.Experience,
                cp.HourlyRate,
                cp.IsAvailable,
                cp.YearsOfExperience,
                cp.Education,
                cp.Certifications,
                cp.Languages,
                cp.WorkingHours,
                cp.SuccessRate,
                cp.TotalClients,
                (SELECT COUNT(*) FROM QuitPlans WHERE CoachID = u.UserID) as TotalPlans,
                (SELECT AVG(CAST(Rating as FLOAT)) FROM CoachFeedback WHERE CoachID = u.UserID AND Status = 'active') as AverageRating,
                (SELECT COUNT(*) FROM CoachFeedback WHERE CoachID = u.UserID AND Status = 'active') as TotalReviews
            FROM Users u
            LEFT JOIN CoachProfiles cp ON u.UserID = cp.UserID
            WHERE u.Role = 'coach'
            ORDER BY u.CreatedAt DESC
        `);

        res.json({
            success: true,
            data: result.recordset,
            message: 'Danh sách coaches được tải thành công'
        });

    } catch (error) {
        console.error('Get coaches error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tải danh sách coaches',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get detailed coach information
router.get('/coaches/:id/details', protect, authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.request()
            .input('UserID', id)
            .query(`
                SELECT 
                    u.UserID,
                    u.Email,
                    u.FirstName,
                    u.LastName,
                    u.Avatar,
                    u.PhoneNumber,
                    u.Address,
                    u.IsActive,
                    u.CreatedAt,
                    u.UpdatedAt,
                    u.LastLoginAt,
                    
                    -- Coach Profile Details
                    cp.Bio,
                    cp.Specialization,
                    cp.Experience,
                    cp.HourlyRate,
                    cp.IsAvailable,
                    cp.YearsOfExperience,
                    cp.Education,
                    cp.Certifications,
                    cp.Languages,
                    cp.WorkingHours,
                    cp.ConsultationTypes,
                    cp.SuccessRate,
                    cp.TotalClients,
                    cp.CreatedAt as ProfileCreatedAt,
                    cp.UpdatedAt as ProfileUpdatedAt,
                    
                    -- Statistics
                    (SELECT COUNT(*) FROM QuitPlans WHERE CoachID = u.UserID) as TotalPlans,
                    (SELECT COUNT(*) FROM QuitPlans WHERE CoachID = u.UserID AND Status = 'active') as ActivePlans,
                    (SELECT COUNT(*) FROM QuitPlans WHERE CoachID = u.UserID AND Status = 'completed') as CompletedPlans,
                    (SELECT COUNT(*) FROM ConsultationAppointments WHERE CoachID = u.UserID) as TotalAppointments,
                    (SELECT COUNT(*) FROM ConsultationAppointments WHERE CoachID = u.UserID AND Status = 'completed') as CompletedAppointments,
                    (SELECT AVG(CAST(Rating as FLOAT)) FROM CoachFeedback WHERE CoachID = u.UserID AND Status = 'active') as AverageRating,
                    (SELECT COUNT(*) FROM CoachFeedback WHERE CoachID = u.UserID AND Status = 'active') as TotalReviews
                    
                FROM Users u
                LEFT JOIN CoachProfiles cp ON u.UserID = cp.UserID
                WHERE u.UserID = @UserID AND u.Role = 'coach'
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Coach không tồn tại'
            });
        }

        // Get recent feedback for the coach
        const feedbackResult = await pool.request()
            .input('UserID', id)
            .query(`
                SELECT TOP 5
                    cf.Rating,
                    cf.Comment,
                    cf.Categories,
                    cf.CreatedAt,
                    cf.IsAnonymous,
                    m.FirstName as MemberFirstName,
                    m.LastName as MemberLastName,
                    m.Avatar as MemberAvatar
                FROM CoachFeedback cf
                INNER JOIN Users m ON cf.MemberID = m.UserID
                WHERE cf.CoachID = @UserID AND cf.Status = 'active'
                ORDER BY cf.CreatedAt DESC
            `);

        // Get assigned members (DISTINCT to avoid duplicates from multiple QuitPlans)
        const membersResult = await pool.request()
            .input('UserID', id)
            .query(`
                SELECT DISTINCT
                    m.UserID,
                    m.FirstName,
                    m.LastName,
                    m.Email,
                    m.Avatar,
                    qp_latest.Status as PlanStatus,
                    qp_latest.StartDate,
                    qp_latest.CreatedAt as AssignedAt
                FROM (
                    -- Get latest QuitPlan for each user assigned to this coach
                    SELECT qp.*,
                           ROW_NUMBER() OVER (PARTITION BY qp.UserID ORDER BY qp.CreatedAt DESC) as rn
                    FROM QuitPlans qp
                    WHERE qp.CoachID = @UserID
                        AND qp.Status = 'active'
                ) qp_latest
                INNER JOIN Users m ON qp_latest.UserID = m.UserID
                WHERE qp_latest.rn = 1
                ORDER BY qp_latest.CreatedAt DESC
            `);

        const coachData = result.recordset[0];

        res.json({
            success: true,
            data: {
                ...coachData,
                recentFeedback: feedbackResult.recordset,
                assignedMembers: membersResult.recordset
            },
            message: 'Thông tin chi tiết coach được tải thành công'
        });

    } catch (error) {
        console.error('Get coach details error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tải thông tin chi tiết coach',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get all assignable members
router.get('/members', protect, authorize('admin'), async (req, res) => {
    try {
        const result = await pool.request().query(`
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

        res.json({
            success: true,
            data: result.recordset,
            message: 'Danh sách members được tải thành công'
        });

    } catch (error) {
        console.error('Get members error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tải danh sách members',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Assign member to coach
router.post('/assign-coach', protect, authorize('admin'), async (req, res) => {
    try {
        const { memberID, coachID, reason } = req.body;

        console.log('🎯 Assign coach request:', { memberID, coachID, reason });

        // Validate input
        if (!memberID || !coachID) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng chọn member và coach'
            });
        }

        // Check if member exists and is active
        const memberCheck = await pool.request()
            .input('UserID', memberID)
            .query(`
                SELECT UserID, FirstName, LastName, Email FROM Users 
                WHERE UserID = @UserID AND Role = 'member' AND IsActive = 1
            `);

        if (memberCheck.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Member không tồn tại hoặc không hoạt động'
            });
        }

        // Check if coach exists and is active
        const coachCheck = await pool.request()
            .input('UserID', coachID)
            .query(`
                SELECT UserID, FirstName, LastName, Email FROM Users 
                WHERE UserID = @UserID AND Role = 'coach' AND IsActive = 1
            `);

        if (coachCheck.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Coach không tồn tại hoặc không hoạt động'
            });
        }

        const member = memberCheck.recordset[0];
        const coach = coachCheck.recordset[0];

        console.log('✅ Member found:', member);
        console.log('✅ Coach found:', coach);

        // Begin transaction to ensure data consistency
        const transaction = pool.transaction();
        await transaction.begin();

        try {
            // First, deactivate any existing active quit plans for this member
            const deactivateResult = await transaction.request()
                .input('UserID', memberID)
                .query(`
                    UPDATE QuitPlans 
                    SET Status = 'cancelled'
                    OUTPUT DELETED.PlanID, DELETED.CoachID
                    WHERE UserID = @UserID AND Status = 'active'
                `);

            console.log('🔄 Deactivated old plans:', deactivateResult.recordset);

            // Create new quit plan with coach assignment
            const createPlanResult = await transaction.request()
                .input('UserID', memberID)
                .input('CoachID', coachID)
                .input('StartDate', new Date())
                .input('TargetDate', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)) // 90 days later
                .input('Reason', reason || 'Phân công bởi admin')
                .input('DetailedPlan', 'Kế hoạch cai thuốc được tạo bởi admin')
                .query(`
                    INSERT INTO QuitPlans (UserID, CoachID, StartDate, TargetDate, Reason, DetailedPlan, Status, MotivationLevel)
                    OUTPUT INSERTED.PlanID, INSERTED.UserID, INSERTED.CoachID, INSERTED.Status
                    VALUES (@UserID, @CoachID, @StartDate, @TargetDate, @Reason, @DetailedPlan, 'active', 7)
                `);

            const newPlan = createPlanResult.recordset[0];
            console.log('✅ Created new quit plan:', newPlan);

            // Verify the plan was created correctly
            const verifyPlan = await transaction.request()
                .input('PlanID', newPlan.PlanID)
                .query(`
                    SELECT qp.*, u.FirstName + ' ' + u.LastName as MemberName, 
                           c.FirstName + ' ' + c.LastName as CoachName
                    FROM QuitPlans qp
                    INNER JOIN Users u ON qp.UserID = u.UserID
                    INNER JOIN Users c ON qp.CoachID = c.UserID
                    WHERE qp.PlanID = @PlanID
                `);

            console.log('✅ Plan verification:', verifyPlan.recordset[0]);

            // Create or update conversation between coach and member
            const conversationCheck = await transaction.request()
                .input('CoachID', coachID)
                .input('MemberID', memberID)
                .query(`
                    SELECT ConversationID FROM Conversations 
                    WHERE CoachID = @CoachID AND MemberID = @MemberID
                `);

            if (conversationCheck.recordset.length === 0) {
                const conversationResult = await transaction.request()
                    .input('CoachID', coachID)
                    .input('MemberID', memberID)
                    .query(`
                        INSERT INTO Conversations (CoachID, MemberID, LastMessageAt, IsActive)
                        OUTPUT INSERTED.ConversationID
                        VALUES (@CoachID, @MemberID, GETDATE(), 1)
                    `);
                console.log('✅ Created new conversation:', conversationResult.recordset[0]);
            } else {
                // Reactivate existing conversation
                await transaction.request()
                    .input('CoachID', coachID)
                    .input('MemberID', memberID)
                    .query(`
                        UPDATE Conversations 
                        SET IsActive = 1, LastMessageAt = GETDATE()
                        WHERE CoachID = @CoachID AND MemberID = @MemberID
                    `);
                console.log('✅ Reactivated existing conversation');
            }

            // Commit transaction
            await transaction.commit();
            console.log('✅ Transaction committed successfully');

            // Final verification - test assigned coach query
            const finalCheck = await pool.request()
                .input('UserID', memberID)
                .query(`
                    SELECT 
                        c.UserID as CoachID,
                        c.Email as CoachEmail,
                        c.FirstName as CoachFirstName,
                        c.LastName as CoachLastName,
                        qp.PlanID as QuitPlanID,
                        qp.Status as QuitPlanStatus
                    FROM QuitPlans qp
                    INNER JOIN Users c ON qp.CoachID = c.UserID
                    WHERE qp.UserID = @UserID 
                        AND qp.Status = 'active'
                        AND qp.CoachID IS NOT NULL
                        AND c.Role = 'coach'
                        AND c.IsActive = 1
                `);

            console.log('🔍 Final assignment verification:', finalCheck.recordset);

            res.json({
                success: true,
                data: {
                    planID: newPlan.PlanID,
                    memberID: memberID,
                    coachID: coachID,
                    memberName: `${member.FirstName} ${member.LastName}`,
                    coachName: `${coach.FirstName} ${coach.LastName}`,
                    assignmentVerified: finalCheck.recordset.length > 0
                },
                message: `Đã phân công ${member.FirstName} ${member.LastName} cho coach ${coach.FirstName} ${coach.LastName}`
            });

        } catch (transactionError) {
            await transaction.rollback();
            console.error('❌ Transaction failed:', transactionError);
            throw transactionError;
        }

    } catch (error) {
        console.error('❌ Assign coach error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi phân công coach',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Remove coach assignment
router.delete('/assign-coach/:memberID', protect, authorize('admin'), async (req, res) => {
    try {
        const { memberID } = req.params;

        // Check if member has an active quit plan
        const existingPlan = await pool.request()
            .input('UserID', memberID)
            .query(`
                SELECT PlanID, CoachID FROM QuitPlans 
                WHERE UserID = @UserID AND Status = 'active' AND CoachID IS NOT NULL
            `);

        if (existingPlan.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Member không có coach được phân công'
            });
        }

        // Update quit plan status to cancelled
        await pool.request()
            .input('PlanID', existingPlan.recordset[0].PlanID)
            .query(`
                UPDATE QuitPlans 
                SET Status = 'cancelled', CoachID = NULL
                WHERE PlanID = @PlanID
            `);

        res.json({
            success: true,
            message: 'Đã hủy phân công coach thành công'
        });

    } catch (error) {
        console.error('Remove coach assignment error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi hủy phân công coach',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Toggle coach active status
router.patch('/coaches/:id/toggle-status', protect, authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;

        // Check if coach exists
        const coachCheck = await pool.request()
            .input('UserID', id)
            .query(`
                SELECT UserID, IsActive, FirstName, LastName FROM Users 
                WHERE UserID = @UserID AND Role = 'coach'
            `);

        if (coachCheck.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Coach không tồn tại'
            });
        }

        const coach = coachCheck.recordset[0];
        const newStatus = !coach.IsActive;

        // Update coach status
        await pool.request()
            .input('UserID', id)
            .input('IsActive', newStatus)
            .query(`
                UPDATE Users 
                SET IsActive = @IsActive 
                WHERE UserID = @UserID
            `);

        res.json({
            success: true,
            data: {
                coachID: id,
                isActive: newStatus,
                coachName: `${coach.FirstName} ${coach.LastName}`
            },
            message: `Đã ${newStatus ? 'kích hoạt' : 'vô hiệu hóa'} coach thành công`
        });

    } catch (error) {
        console.error('Toggle coach status error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi thay đổi trạng thái coach',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ==================== BLOG MANAGEMENT ====================

// Get all blog posts for admin
router.get('/blog-posts', protect, authorize('admin'), async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT 
                p.*,
                u.FirstName as AuthorFirstName,
                u.LastName as AuthorLastName,
                (SELECT COUNT(*) FROM Comments c WHERE c.PostID = p.PostID AND c.Status = 'approved') as CommentCount
            FROM BlogPosts p
            JOIN Users u ON p.AuthorID = u.UserID
            ORDER BY p.CreatedAt DESC
        `);

        res.json({
            success: true,
            data: result.recordset,
            message: 'Danh sách blog posts được tải thành công'
        });

    } catch (error) {
        console.error('Get blog posts error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tải danh sách blog posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Update blog post status (approve/reject)
router.patch('/blog-posts/:postId/status', protect, authorize('admin'), async (req, res) => {
    try {
        const { postId } = req.params;
        const { status } = req.body;

        if (!['published', 'Pending', 'draft', 'rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Trạng thái không hợp lệ'
            });
        }

        // Get the blog post info first to know the author
        const postInfo = await pool.request()
            .input('PostID', postId)
            .query(`
                SELECT p.AuthorID, p.Title, u.FirstName, u.LastName 
                FROM BlogPosts p
                JOIN Users u ON p.AuthorID = u.UserID
                WHERE p.PostID = @PostID
            `);

        if (postInfo.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy bài viết'
            });
        }

        const post = postInfo.recordset[0];

        const result = await pool.request()
            .input('PostID', postId)
            .input('Status', status)
            .query(`
                UPDATE BlogPosts
                SET Status = @Status,
                    PublishedAt = CASE WHEN @Status = 'published' THEN GETDATE() ELSE PublishedAt END
                OUTPUT INSERTED.*
                WHERE PostID = @PostID
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy bài viết'
            });
        }

        // Create notification for the author (if not admin themselves)
        if (post.AuthorID !== req.user.id) {
            let notificationMessage = '';
            let notificationType = '';

            if (status === 'published') {
                notificationMessage = `Bài viết "${post.Title}" của bạn đã được phê duyệt và xuất bản thành công!`;
                notificationType = 'blog_approved';
            } else if (status === 'rejected') {
                notificationMessage = `Bài viết "${post.Title}" của bạn đã bị từ chối. Vui lòng chỉnh sửa và gửi lại.`;
                notificationType = 'blog_rejected';
            }

            if (notificationMessage) {
                try {
                    // Try to create notification - create table if it doesn't exist
                    await pool.request()
                        .input('UserID', post.AuthorID)
                        .input('Type', notificationType)
                        .input('Title', status === 'published' ? 'Bài viết đã được phê duyệt' : 'Bài viết bị từ chối')
                        .input('Message', notificationMessage)
                        .input('RelatedID', postId)
                        .query(`
                            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Notifications' AND xtype='U')
                            BEGIN
                                CREATE TABLE Notifications (
                                    NotificationID INT IDENTITY(1,1) PRIMARY KEY,
                                    UserID INT NOT NULL,
                                    Type NVARCHAR(50) NOT NULL,
                                    Title NVARCHAR(255) NOT NULL,
                                    Message NVARCHAR(MAX) NOT NULL,
                                    RelatedID INT NULL,
                                    IsRead BIT DEFAULT 0,
                                    CreatedAt DATETIME DEFAULT GETDATE(),
                                    FOREIGN KEY (UserID) REFERENCES Users(UserID)
                                )
                            END
                            
                            INSERT INTO Notifications (UserID, Type, Title, Message, RelatedID, IsRead, CreatedAt)
                            VALUES (@UserID, @Type, @Title, @Message, @RelatedID, 0, GETDATE())
                        `);
                } catch (notificationError) {
                    console.error('Error creating notification:', notificationError);
                    // Don't fail the main operation if notification fails
                }
            }
        }

        res.json({
            success: true,
            data: result.recordset[0],
            message: `Bài viết đã được ${status === 'published' ? 'phê duyệt' : status === 'rejected' ? 'từ chối' : 'cập nhật trạng thái'}`
        });

    } catch (error) {
        console.error('Update blog post status error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật trạng thái bài viết',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Admin create blog post
router.post('/blog-posts', protect, authorize('admin'), async (req, res) => {
    try {
        const { title, content, metaDescription, thumbnailURL, status = 'published' } = req.body;

        if (!title || !content) {
            return res.status(400).json({
                success: false,
                message: 'Tiêu đề và nội dung là bắt buộc'
            });
        }

        const result = await pool.request()
            .input('Title', title)
            .input('Content', content)
            .input('MetaDescription', metaDescription || '')
            .input('ThumbnailURL', thumbnailURL || '')
            .input('AuthorID', req.user.id)
            .input('Status', status)
            .query(`
                INSERT INTO BlogPosts (Title, Content, MetaDescription, ThumbnailURL, AuthorID, Status, PublishedAt)
                OUTPUT INSERTED.*
                VALUES (@Title, @Content, @MetaDescription, @ThumbnailURL, @AuthorID, @Status, 
                        CASE WHEN @Status = 'published' THEN GETDATE() ELSE NULL END)
            `);

        res.status(201).json({
            success: true,
            data: result.recordset[0],
            message: 'Bài viết được tạo thành công'
        });

    } catch (error) {
        console.error('Create blog post error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tạo bài viết',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Admin update blog post
router.put('/blog-posts/:postId', protect, authorize('admin'), async (req, res) => {
    try {
        const { postId } = req.params;
        const { title, content, metaDescription, thumbnailURL, status } = req.body;

        const result = await pool.request()
            .input('PostID', postId)
            .input('Title', title)
            .input('Content', content)
            .input('MetaDescription', metaDescription || '')
            .input('ThumbnailURL', thumbnailURL || '')
            .input('Status', status)
            .query(`
                UPDATE BlogPosts
                SET Title = @Title,
                    Content = @Content,
                    MetaDescription = @MetaDescription,
                    ThumbnailURL = @ThumbnailURL,
                    Status = @Status,
                    PublishedAt = CASE WHEN @Status = 'published' AND PublishedAt IS NULL THEN GETDATE() ELSE PublishedAt END
                OUTPUT INSERTED.*
                WHERE PostID = @PostID
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy bài viết'
            });
        }

        res.json({
            success: true,
            data: result.recordset[0],
            message: 'Bài viết được cập nhật thành công'
        });

    } catch (error) {
        console.error('Update blog post error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật bài viết',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Admin delete blog post
router.delete('/blog-posts/:postId', protect, authorize('admin'), async (req, res) => {
    try {
        const { postId } = req.params;

        // First delete related comments
        await pool.request()
            .input('PostID', postId)
            .query('DELETE FROM Comments WHERE PostID = @PostID');

        // Then delete the blog post
        const result = await pool.request()
            .input('PostID', postId)
            .query('DELETE FROM BlogPosts WHERE PostID = @PostID');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy bài viết'
            });
        }

        res.json({
            success: true,
            message: 'Bài viết đã được xóa thành công'
        });

    } catch (error) {
        console.error('Delete blog post error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xóa bài viết',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get blog comments for moderation
router.get('/blog-comments', protect, authorize('admin'), async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT 
                c.*,
                u.FirstName,
                u.LastName,
                u.Email,
                p.Title as PostTitle
            FROM Comments c
            JOIN Users u ON c.UserID = u.UserID
            JOIN BlogPosts p ON c.PostID = p.PostID
            ORDER BY c.CreatedAt DESC
        `);

        res.json({
            success: true,
            data: result.recordset,
            message: 'Danh sách comments được tải thành công'
        });

    } catch (error) {
        console.error('Get blog comments error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tải danh sách comments',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Moderate comment
router.patch('/blog-comments/:commentId/status', protect, authorize('admin'), async (req, res) => {
    try {
        const { commentId } = req.params;
        const { status } = req.body;

        if (!['approved', 'rejected', 'pending'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Trạng thái comment không hợp lệ'
            });
        }

        const result = await pool.request()
            .input('CommentID', commentId)
            .input('Status', status)
            .query(`
                UPDATE Comments
                SET Status = @Status
                OUTPUT INSERTED.*
                WHERE CommentID = @CommentID
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy comment'
            });
        }

        res.json({
            success: true,
            data: result.recordset[0],
            message: `Comment đã được ${status === 'approved' ? 'phê duyệt' : status === 'rejected' ? 'từ chối' : 'cập nhật trạng thái'}`
        });

    } catch (error) {
        console.error('Moderate comment error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi kiểm duyệt comment',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get all community posts for moderation
router.get('/community-posts', protect, authorize('admin'), async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT 
                p.*,
                u.FirstName,
                u.LastName,
                u.Email,
                a.Name as AchievementName,
                a.Description as AchievementDescription,
                (SELECT COUNT(*) FROM CommunityComments c WHERE c.PostID = p.PostID) as CommentCount,
                (SELECT COUNT(*) FROM PostLikes pl WHERE pl.PostID = p.PostID) as LikesCount
            FROM CommunityPosts p
            JOIN Users u ON p.UserID = u.UserID
            LEFT JOIN Achievements a ON p.AchievementID = a.AchievementID
            ORDER BY p.CreatedAt DESC
        `);

        res.json({
            success: true,
            data: result.recordset,
            message: 'Danh sách bài viết community được tải thành công'
        });

    } catch (error) {
        console.error('Get community posts error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tải danh sách bài viết community',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get all community comments for moderation
router.get('/community-comments', protect, authorize('admin'), async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT 
                c.*,
                u.FirstName,
                u.LastName,
                u.Email,
                p.Title as PostTitle
            FROM CommunityComments c
            JOIN Users u ON c.UserID = u.UserID
            JOIN CommunityPosts p ON c.PostID = p.PostID
            ORDER BY c.CreatedAt DESC
        `);

        res.json({
            success: true,
            data: result.recordset,
            message: 'Danh sách comments community được tải thành công'
        });

    } catch (error) {
        console.error('Get community comments error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tải danh sách comments community',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Delete community post (admin)
router.delete('/community-posts/:postId', protect, authorize('admin'), async (req, res) => {
    try {
        const { postId } = req.params;

        // First delete related comments and likes
        await pool.request()
            .input('PostID', postId)
            .query(`
                DELETE FROM CommunityComments WHERE PostID = @PostID;
                DELETE FROM PostLikes WHERE PostID = @PostID;
            `);

        // Then delete the community post
        const result = await pool.request()
            .input('PostID', postId)
            .query(`
                DELETE FROM CommunityPosts 
                OUTPUT DELETED.*
                WHERE PostID = @PostID
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy bài viết'
            });
        }

        res.json({
            success: true,
            data: result.recordset[0],
            message: 'Bài viết community đã được xóa thành công'
        });

    } catch (error) {
        console.error('Delete community post error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xóa bài viết community',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Delete community comment (admin)
router.delete('/community-comments/:commentId', protect, authorize('admin'), async (req, res) => {
    try {
        const { commentId } = req.params;

        const result = await pool.request()
            .input('CommentID', commentId)
            .query(`
                DELETE FROM CommunityComments 
                OUTPUT DELETED.*
                WHERE CommentID = @CommentID
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy comment'
            });
        }

        res.json({
            success: true,
            data: result.recordset[0],
            message: 'Comment community đã được xóa thành công'
        });

    } catch (error) {
        console.error('Delete community comment error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xóa comment community',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get pending payments for admin approval
router.get('/pending-payments', protect, authorize('admin'), async (req, res) => {
    try {
        console.log('🔍 Admin pending-payments endpoint called');

        const result = await pool.request().query(`
            SELECT DISTINCT
                p.PaymentID,
                p.UserID,
                p.PlanID,
                p.Amount,
                p.PaymentMethod,
                p.Status,
                p.TransactionID,
                p.PaymentDate,
                u.FirstName,
                u.LastName,
                u.Email,
                u.PhoneNumber,
                mp.Name as PlanName,
                mp.Description as PlanDescription,
                mp.Duration,
                um.StartDate,
                um.EndDate,
                um.Status as MembershipStatus
            FROM Payments p
            JOIN Users u ON p.UserID = u.UserID
            JOIN MembershipPlans mp ON p.PlanID = mp.PlanID
            LEFT JOIN UserMemberships um ON p.UserID = um.UserID AND um.PlanID = mp.PlanID
            WHERE p.Status = 'pending'
            ORDER BY p.PaymentDate DESC
        `);

        console.log(`📊 Found ${result.recordset.length} pending payments`);

        res.json({
            success: true,
            data: result.recordset,
            total: result.recordset.length
        });
    } catch (error) {
        console.error('Error getting pending payments:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách thanh toán chờ xác nhận',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Confirm payment by admin
router.post('/confirm-payment/:paymentId', protect, authorize('admin'), async (req, res) => {
    try {
        const { paymentId } = req.params;
        const { notes } = req.body;

        // Start transaction
        const transaction = pool.transaction();
        await transaction.begin();

        try {
            // Check if payment exists and is pending
            const paymentResult = await transaction.request()
                .input('PaymentID', paymentId)
                .query(`
                    SELECT p.*, mp.Duration, mp.Name as PlanName
                    FROM Payments p
                    JOIN MembershipPlans mp ON p.PlanID = mp.PlanID
                    WHERE p.PaymentID = @PaymentID AND p.Status = 'pending'
                `);

            if (paymentResult.recordset.length === 0) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy thanh toán hoặc thanh toán đã được xử lý'
                });
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
            const confirmationResult = await transaction.request()
                .input('PaymentID', paymentId)
                .input('ConfirmedByUserID', req.user.id)
                .input('ConfirmationCode', `ADMIN-${Date.now()}`)
                .input('Notes', notes || 'Thanh toán được xác nhận bởi admin')
                .query(`
                    INSERT INTO PaymentConfirmations (PaymentID, ConfirmedByUserID, ConfirmationCode, Notes)
                    OUTPUT INSERTED.*
                    VALUES (@PaymentID, @ConfirmedByUserID, @ConfirmationCode, @Notes)
                `);

            // Calculate membership dates
            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + payment.Duration);

            // Update existing pending membership to active
            await transaction.request()
                .input('UserID', payment.UserID)
                .input('PlanID', payment.PlanID)
                .input('StartDate', startDate)
                .input('EndDate', endDate)
                .query(`
                    UPDATE UserMemberships
                    SET Status = 'active',
                        StartDate = @StartDate,
                        EndDate = @EndDate
                    WHERE UserID = @UserID AND PlanID = @PlanID AND Status = 'pending'
                `);

            // Update user role to member if they're currently a guest
            await transaction.request()
                .input('UserID', payment.UserID)
                .query(`
                    UPDATE Users
                    SET Role = 'member'
                    WHERE UserID = @UserID AND Role = 'guest'
                `);

            // Create notification for user
            await transaction.request()
                .input('UserID', payment.UserID)
                .input('Title', 'Thanh toán đã được xác nhận')
                .input('Message', `Thanh toán cho gói ${payment.PlanName} đã được admin xác nhận. Chào mừng bạn đến với dịch vụ của chúng tôi!`)
                .input('Type', 'payment')
                .query(`
                    INSERT INTO Notifications (UserID, Title, Message, Type)
                    VALUES (@UserID, @Title, @Message, @Type)
                `);

            await transaction.commit();

            res.json({
                success: true,
                message: 'Xác nhận thanh toán thành công',
                data: {
                    payment: payment,
                    confirmation: confirmationResult.recordset[0]
                }
            });

        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Error confirming payment:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xác nhận thanh toán'
        });
    }
});

// Reject payment by admin
router.post('/reject-payment/:paymentId', protect, authorize('admin'), async (req, res) => {
    try {
        const { paymentId } = req.params;
        const { notes } = req.body;

        // Start transaction
        const transaction = pool.transaction();
        await transaction.begin();

        try {
            // Check if payment exists and is pending
            const paymentResult = await transaction.request()
                .input('PaymentID', paymentId)
                .query(`
                    SELECT p.*, mp.Name as PlanName
                    FROM Payments p
                    JOIN MembershipPlans mp ON p.PlanID = mp.PlanID
                    WHERE p.PaymentID = @PaymentID AND p.Status = 'pending'
                `);

            if (paymentResult.recordset.length === 0) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy thanh toán hoặc thanh toán đã được xử lý'
                });
            }

            const payment = paymentResult.recordset[0];

            // Update payment status to rejected
            await transaction.request()
                .input('PaymentID', paymentId)
                .query(`
                    UPDATE Payments
                    SET Status = 'rejected'
                    WHERE PaymentID = @PaymentID
                `);

            // Remove or update pending membership
            await transaction.request()
                .input('UserID', payment.UserID)
                .query(`
                    UPDATE UserMemberships
                    SET Status = 'cancelled'
                    WHERE UserID = @UserID AND Status = 'pending'
                `);

            // Create notification for user
            await transaction.request()
                .input('UserID', payment.UserID)
                .input('Title', 'Thanh toán bị từ chối')
                .input('Message', `Thanh toán cho gói ${payment.PlanName} đã bị từ chối. Lý do: ${notes || 'Không có lý do cụ thể'}. Vui lòng liên hệ admin để biết thêm chi tiết.`)
                .input('Type', 'payment')
                .query(`
                    INSERT INTO Notifications (UserID, Title, Message, Type)
                    VALUES (@UserID, @Title, @Message, @Type)
                `);

            await transaction.commit();

            res.json({
                success: true,
                message: 'Đã từ chối thanh toán',
                data: payment
            });

        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Error rejecting payment:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi từ chối thanh toán'
        });
    }
});

// Get payment confirmations history
router.get('/payment-confirmations', protect, authorize('admin'), async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT 
                pc.*,
                p.Amount,
                p.PaymentMethod,
                p.TransactionID,
                p.PaymentDate,
                u1.FirstName + ' ' + u1.LastName as CustomerName,
                u1.Email as CustomerEmail,
                u2.FirstName + ' ' + u2.LastName as AdminName,
                mp.Name as PlanName
            FROM PaymentConfirmations pc
            JOIN Payments p ON pc.PaymentID = p.PaymentID
            JOIN Users u1 ON p.UserID = u1.UserID
            JOIN Users u2 ON pc.ConfirmedByUserID = u2.UserID
            JOIN MembershipPlans mp ON p.PlanID = mp.PlanID
            ORDER BY pc.ConfirmationDate DESC
        `);

        res.json({
            success: true,
            data: result.recordset
        });
    } catch (error) {
        console.error('Error getting payment confirmations:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy lịch sử xác nhận thanh toán'
        });
    }
});

module.exports = router; 
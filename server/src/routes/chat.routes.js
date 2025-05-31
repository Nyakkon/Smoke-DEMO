const express = require('express');
const { pool } = require('../config/database');
const router = express.Router();
const { auth: authenticateToken, authorize: authorizeRole } = require('../middleware/auth.middleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file upload in chat
const uploadsDir = path.join(__dirname, '../../uploads/chat');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        cb(null, `${name}-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow common file types
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|mp3|mp4|avi|mov/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Chỉ cho phép upload các file: hình ảnh, PDF, tài liệu, âm thanh, video'));
        }
    }
});

// Debug middleware
const debugMiddleware = (req, res, next) => {
    console.log('🔍 Chat route accessed:', req.method, req.path);
    console.log('🔍 User from auth middleware:', req.user);
    next();
};

// Test route for debugging
router.get('/test-auth', authenticateToken, (req, res) => {
    console.log('🧪 Test auth route - req.user:', req.user);
    res.json({
        success: true,
        message: 'Auth middleware works',
        user: req.user
    });
});

// Debug route to check current user
router.get('/debug-user', authenticateToken, (req, res) => {
    console.log('🔍 Debug user route - req.user:', req.user);
    res.json({
        success: true,
        message: 'User info retrieved',
        user: req.user,
        userRole: req.user?.Role,
        userRoleType: typeof req.user?.Role
    });
});

// Lấy conversation của member với assigned coach only
router.get('/member/conversation', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.UserID;
        console.log('🔍 Member conversation - UserID:', userId, 'Role:', req.user.Role);

        // Tìm coach được phân công cho member này thông qua QuitPlans
        let assignedCoachResult = await pool.request()
            .input('userId', userId)
            .query(`
                SELECT qp.CoachID
                FROM QuitPlans qp
                INNER JOIN Users c ON qp.CoachID = c.UserID
                WHERE qp.UserID = @userId 
                    AND qp.Status = 'active'
                    AND c.Role = 'coach'
                    AND c.IsActive = 1
            `);

        if (assignedCoachResult.recordset.length === 0) {
            console.log('❌ No assigned coach found for member:', userId);
            return res.status(404).json({
                success: false,
                message: 'Bạn chưa được phân công coach nào. Vui lòng liên hệ admin để được phân công coach trước khi có thể chat.',
                error_code: 'NO_ASSIGNED_COACH',
                helpText: 'Để có thể sử dụng tính năng chat, bạn cần được admin phân công một coach. Vui lòng liên hệ quản trị viên hệ thống.'
            });
        }

        const coachId = assignedCoachResult.recordset[0].CoachID;
        console.log('✅ Found assigned coach:', coachId, 'for member:', userId);

        // Tìm hoặc tạo conversation với assigned coach
        let conversation = await pool.request()
            .input('coachId', coachId)
            .input('userId', userId)
            .query(`
                SELECT ConversationID, CoachID, MemberID
                FROM Conversations 
                WHERE CoachID = @coachId AND MemberID = @userId
            `);

        if (conversation.recordset.length === 0) {
            // Tạo conversation mới với assigned coach
            console.log('📝 Creating new conversation between member', userId, 'and assigned coach', coachId);
            await pool.request()
                .input('coachId', coachId)
                .input('userId', userId)
                .query(`
                    INSERT INTO Conversations (CoachID, MemberID, LastMessageAt)
                    VALUES (@coachId, @userId, GETDATE())
                `);

            conversation = await pool.request()
                .input('coachId', coachId)
                .input('userId', userId)
                .query(`
                    SELECT ConversationID, CoachID, MemberID
                    FROM Conversations 
                    WHERE CoachID = @coachId AND MemberID = @userId
                `);
        }

        // Lấy thông tin assigned coach
        const coachInfo = await pool.request()
            .input('coachId', coachId)
            .query(`
                SELECT 
                    u.UserID, 
                    u.FirstName + ' ' + u.LastName as FullName, 
                    u.Avatar, 
                    u.Email,
                    cp.Specialization,
                    cp.Bio
                FROM Users u
                LEFT JOIN CoachProfiles cp ON u.UserID = cp.UserID
                WHERE u.UserID = @coachId
            `);

        res.json({
            success: true,
            data: {
                conversation: conversation.recordset[0],
                coach: coachInfo.recordset[0]
            },
            message: `Kết nối với coach được phân công: ${coachInfo.recordset[0].FullName}`
        });

    } catch (error) {
        console.error('Error loading member conversation:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tải cuộc trò chuyện',
            error: error.message
        });
    }
});

// API lấy lịch sử chat cho member (any coach can chat with any member)
router.get('/member/messages', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.UserID;
        const { limit = 50, before } = req.query;

        let query = `
            SELECT 
                m.MessageID,
                m.SenderID,
                m.ReceiverID,
                m.Content,
                m.MessageType,
                m.IsRead,
                m.RelatedPlanID,
                m.CreatedAt,
                sender.FirstName as SenderFirstName,
                sender.LastName as SenderLastName,
                sender.Avatar as SenderAvatar,
                sender.Role as SenderRole,
                receiver.FirstName as ReceiverFirstName,
                receiver.LastName as ReceiverLastName,
                receiver.Avatar as ReceiverAvatar
            FROM Messages m
            INNER JOIN Users sender ON m.SenderID = sender.UserID
            INNER JOIN Users receiver ON m.ReceiverID = receiver.UserID
            WHERE (m.SenderID = @userId OR m.ReceiverID = @userId)
        `;

        if (before) {
            query += ` AND m.MessageID < @before`;
        }

        query += ` ORDER BY m.MessageID DESC OFFSET 0 ROWS FETCH NEXT @limit ROWS ONLY`;

        const request = pool.request()
            .input('userId', userId)
            .input('limit', parseInt(limit));

        if (before) {
            request.input('before', parseInt(before));
        }

        const result = await request.query(query);

        // Format messages to match ChatBox expectations
        const messages = result.recordset.map(msg => ({
            MessageID: msg.MessageID,
            SenderID: msg.SenderID,
            ReceiverID: msg.ReceiverID,
            Content: msg.Content,
            MessageType: msg.MessageType,
            IsRead: msg.IsRead,
            RelatedPlanID: msg.RelatedPlanID,
            CreatedAt: msg.CreatedAt,
            SenderName: `${msg.SenderFirstName} ${msg.SenderLastName}`,
            SenderAvatar: msg.SenderAvatar,
            SenderRole: msg.SenderRole
        }));

        res.json({
            success: true,
            data: messages
        });

    } catch (error) {
        console.error('Error getting member messages:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi tải tin nhắn',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// API gửi tin nhắn cho coach (endpoint theo yêu cầu) - bypass role check for now
router.post('/coach/chat/send', authenticateToken, async (req, res) => {
    try {
        const { content, messageType = 'text', relatedPlanId = null } = req.body;
        const senderId = req.user.UserID;
        const userRole = req.user.Role;

        console.log('🔍 Send message - UserID:', senderId, 'Role:', userRole, 'Content:', content);

        if (!content) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu nội dung tin nhắn'
            });
        }

        let receiverId;

        if (userRole === 'member') {
            // Member chỉ có thể gửi tin nhắn cho assigned coach
            let assignedCoachResult = await pool.request()
                .input('senderId', senderId)
                .query(`
                    SELECT qp.CoachID
                    FROM QuitPlans qp
                    INNER JOIN Users c ON qp.CoachID = c.UserID
                    WHERE qp.UserID = @senderId 
                        AND qp.Status = 'active'
                        AND c.Role = 'coach'
                        AND c.IsActive = 1
                `);

            if (assignedCoachResult.recordset.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn chưa được phân công coach nào. Vui lòng liên hệ admin để được phân công coach.',
                    error_code: 'NO_ASSIGNED_COACH'
                });
            }

            receiverId = assignedCoachResult.recordset[0].CoachID;
            console.log('✅ Member sending message to assigned coach:', receiverId);
        } else if (userRole === 'coach') {
            // Coach cần chỉ định member để gửi tin nhắn - và chỉ được chat với member được phân công
            const { memberId } = req.body;
            if (!memberId) {
                return res.status(400).json({
                    success: false,
                    message: 'Coach cần chỉ định member để gửi tin nhắn'
                });
            }

            // Kiểm tra xem member có được phân công cho coach này không
            const assignmentCheck = await pool.request()
                .input('coachId', senderId)
                .input('memberId', memberId)
                .query(`
                    SELECT qp.PlanID
                    FROM QuitPlans qp
                    INNER JOIN Users u ON qp.UserID = u.UserID
                    WHERE qp.CoachID = @coachId 
                        AND qp.UserID = @memberId
                        AND qp.Status = 'active'
                        AND u.Role IN ('member', 'guest')
                        AND u.IsActive = 1
                `);

            if (assignmentCheck.recordset.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn chỉ có thể chat với member được phân công cho bạn.',
                    error_code: 'MEMBER_NOT_ASSIGNED'
                });
            }

            receiverId = memberId;
        } else {
            return res.status(403).json({
                success: false,
                message: 'Chỉ member và coach mới có thể sử dụng chức năng chat'
            });
        }

        // Kiểm tra người nhận tồn tại
        const receiverCheck = await pool.request()
            .input('receiverId', receiverId)
            .query(`
                SELECT UserID, Role FROM Users WHERE UserID = @receiverId
            `);

        if (receiverCheck.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Người nhận không tồn tại'
            });
        }

        // Tạo tin nhắn
        const messageResult = await pool.request()
            .input('senderId', senderId)
            .input('receiverId', receiverId)
            .input('content', content)
            .input('messageType', messageType)
            .input('relatedPlanId', relatedPlanId)
            .query(`
                INSERT INTO Messages (SenderID, ReceiverID, Content, MessageType, RelatedPlanID)
                OUTPUT INSERTED.MessageID, INSERTED.CreatedAt
                VALUES (@senderId, @receiverId, @content, @messageType, @relatedPlanId)
            `);

        const messageId = messageResult.recordset[0].MessageID;
        const createdAt = messageResult.recordset[0].CreatedAt;

        // Tìm hoặc tạo conversation
        const coachId = userRole === 'coach' ? senderId : receiverId;
        const memberId = userRole === 'member' ? senderId : receiverId;

        let conversation = await pool.request()
            .input('coachId', coachId)
            .input('memberId', memberId)
            .query(`
                SELECT ConversationID FROM Conversations 
                WHERE CoachID = @coachId AND MemberID = @memberId
            `);

        if (conversation.recordset.length === 0) {
            await pool.request()
                .input('coachId', coachId)
                .input('memberId', memberId)
                .input('messageId', messageId)
                .input('createdAt', createdAt)
                .query(`
                    INSERT INTO Conversations (CoachID, MemberID, LastMessageID, LastMessageAt)
                    VALUES (@coachId, @memberId, @messageId, @createdAt)
                `);
        } else {
            await pool.request()
                .input('messageId', messageId)
                .input('createdAt', createdAt)
                .input('conversationId', conversation.recordset[0].ConversationID)
                .query(`
                    UPDATE Conversations 
                    SET LastMessageID = @messageId, LastMessageAt = @createdAt
                    WHERE ConversationID = @conversationId
                `);
        }

        // Lấy thông tin tin nhắn vừa gửi để trả về
        const messageInfo = await pool.request()
            .input('messageId', messageId)
            .query(`
                SELECT 
                    m.MessageID,
                    m.SenderID,
                    m.ReceiverID,
                    m.Content,
                    m.MessageType,
                    m.IsRead,
                    m.RelatedPlanID,
                    m.CreatedAt,
                    u.FirstName + ' ' + u.LastName as SenderName,
                    u.Avatar as SenderAvatar,
                    u.Role as SenderRole
                FROM Messages m
                INNER JOIN Users u ON m.SenderID = u.UserID
                WHERE m.MessageID = @messageId
            `);

        res.json({
            success: true,
            message: 'Tin nhắn đã được gửi',
            data: messageInfo.recordset[0]
        });

    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi gửi tin nhắn',
            error: error.message
        });
    }
});

// Đánh dấu tin nhắn đã đọc
router.put('/messages/:messageId/read', authenticateToken, async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.UserID;

        await pool.request()
            .input('messageId', messageId)
            .input('userId', userId)
            .query(`
                UPDATE Messages 
                SET IsRead = 1 
                WHERE MessageID = @messageId AND ReceiverID = @userId
            `);

        res.json({
            success: true,
            message: 'Đã đánh dấu tin nhắn đã đọc'
        });

    } catch (error) {
        console.error('Error marking message as read:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi đánh dấu tin nhắn đã đọc'
        });
    }
});

// Lấy số tin nhắn chưa đọc
router.get('/unread-count', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.UserID;

        const result = await pool.request()
            .input('userId', userId)
            .query(`
                SELECT COUNT(*) as unreadCount
                FROM Messages 
                WHERE ReceiverID = @userId AND IsRead = 0
            `);

        res.json({
            success: true,
            data: {
                unreadCount: result.recordset[0].unreadCount
            }
        });

    } catch (error) {
        console.error('Error getting unread count:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy số tin nhắn chưa đọc'
        });
    }
});

// Fix member-coach conversation (API endpoint for frontend)
router.post('/fix-member-coach', authenticateToken, async (req, res) => {
    try {
        const memberId = req.user.UserID;
        const memberRole = req.user.Role;

        console.log('🔧 Auto-fixing member-coach conversation for:', memberId, memberRole);

        if (memberRole !== 'member') {
            return res.status(403).json({
                success: false,
                message: 'Chỉ member mới có thể sử dụng chức năng này'
            });
        }

        // 1. Find available coaches
        const coaches = await pool.request().query(`
            SELECT UserID, Email, FirstName, LastName 
            FROM Users 
            WHERE Role = 'coach' AND IsActive = 1
        `);

        if (coaches.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy coach nào trong hệ thống'
            });
        }

        const coach = coaches.recordset[0];
        console.log(`Creating conversation with coach: ${coach.FirstName} ${coach.LastName} (ID: ${coach.UserID})`);

        // 2. Check/Create Conversation
        const existingConv = await pool.request()
            .input('coachId', coach.UserID)
            .input('memberId', memberId)
            .query(`
                SELECT ConversationID FROM Conversations 
                WHERE CoachID = @coachId AND MemberID = @memberId
            `);

        let conversationId;
        if (existingConv.recordset.length === 0) {
            const convResult = await pool.request()
                .input('coachId', coach.UserID)
                .input('memberId', memberId)
                .query(`
                    INSERT INTO Conversations (CoachID, MemberID, LastMessageAt, IsActive)
                    OUTPUT INSERTED.ConversationID
                    VALUES (@coachId, @memberId, GETDATE(), 1)
                `);
            conversationId = convResult.recordset[0].ConversationID;

            // Add welcome message
            await pool.request()
                .input('senderId', coach.UserID)
                .input('receiverId', memberId)
                .input('content', `Xin chào! Tôi là ${coach.FirstName} ${coach.LastName}, coach sẽ hỗ trợ bạn trong quá trình cai thuốc. Hãy cho tôi biết nếu bạn cần hỗ trợ gì nhé!`)
                .query(`
                    INSERT INTO Messages (SenderID, ReceiverID, Content, MessageType, IsRead)
                    VALUES (@senderId, @receiverId, @content, 'text', 0)
                `);
        } else {
            conversationId = existingConv.recordset[0].ConversationID;
        }

        res.json({
            success: true,
            message: 'Đã tạo conversation với coach thành công!',
            data: {
                coach: {
                    UserID: coach.UserID,
                    FullName: `${coach.FirstName} ${coach.LastName}`,
                    Email: coach.Email
                },
                conversationId: conversationId
            }
        });

    } catch (error) {
        console.error('Error fixing member-coach conversation:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tạo conversation với coach',
            error: error.message
        });
    }
});

// ===== COACH ENDPOINTS =====

// Lấy danh sách conversations của coach
router.get('/coach/conversations', authenticateToken, async (req, res) => {
    try {
        const coachId = req.user.UserID;
        const userRole = req.user.Role;

        console.log('🔍 Coach conversations - UserID:', coachId, 'Role:', userRole);

        // Check if user is coach (bypass strict role check for now)
        if (userRole !== 'coach') {
            console.log('⚠️ User is not coach, but allowing access for testing');
        }

        const result = await pool.request()
            .input('coachId', coachId)
            .query(`
                SELECT 
                    u.UserID,
                    u.FirstName + ' ' + u.LastName as FullName,
                    u.Email,
                    u.Avatar,
                    u.Role,
                    u.IsActive,
                    c.ConversationID,
                    CASE WHEN c.ConversationID IS NOT NULL THEN 1 ELSE 0 END as HasConversation,
                    (SELECT COUNT(*) FROM Messages WHERE ReceiverID = @coachId AND SenderID = u.UserID AND IsRead = 0) as UnreadCount,
                    qp_latest.Status as QuitPlanStatus,
                    qp_latest.StartDate as AssignmentDate,
                    qp_latest.MotivationLevel,
                    ISNULL(c.LastMessageAt, qp_latest.StartDate) as LastActivity
                FROM Users u
                INNER JOIN (
                    -- Get latest active QuitPlan for each user assigned to this coach
                    SELECT qp.*,
                           ROW_NUMBER() OVER (PARTITION BY qp.UserID ORDER BY qp.CreatedAt DESC) as rn
                    FROM QuitPlans qp
                    WHERE qp.CoachID = @coachId AND qp.Status = 'active'
                ) qp_latest ON u.UserID = qp_latest.UserID AND qp_latest.rn = 1
                LEFT JOIN Conversations c ON u.UserID = c.MemberID AND c.CoachID = @coachId
                WHERE u.Role IN ('member', 'guest') AND u.IsActive = 1
                ORDER BY ISNULL(c.LastMessageAt, qp_latest.StartDate) DESC, u.FirstName, u.LastName
            `);

        console.log(`🔍 Found ${result.recordset.length} conversations for coach`);

        res.json({
            success: true,
            data: result.recordset
        });

    } catch (error) {
        console.error('Error loading coach conversations:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tải danh sách cuộc trò chuyện',
            error: error.message
        });
    }
});

// Lấy danh sách members cho coach
router.get('/coach/members', authenticateToken, async (req, res) => {
    try {
        const coachId = req.user.UserID;
        const userRole = req.user.Role;

        console.log('🔍 Coach members - UserID:', coachId, 'Role:', userRole);

        // Check if user is coach (bypass strict role check for now)
        if (userRole !== 'coach') {
            console.log('⚠️ User is not coach, but allowing access for testing');
        }

        // Use the fixed query that was tested
        const fixedQuery = `
            SELECT 
                u.UserID,
                u.FirstName + ' ' + u.LastName as FullName,
                u.Email,
                u.Avatar,
                u.Role,
                u.IsActive,
                c.ConversationID,
                CASE WHEN c.ConversationID IS NOT NULL THEN 1 ELSE 0 END as HasConversation,
                (SELECT COUNT(*) FROM Messages WHERE ReceiverID = @coachId AND SenderID = u.UserID AND IsRead = 0) as UnreadCount,
                qp_latest.Status as QuitPlanStatus,
                qp_latest.StartDate as AssignmentDate,
                qp_latest.MotivationLevel,
                ISNULL(c.LastMessageAt, qp_latest.StartDate) as LastActivity
            FROM Users u
            INNER JOIN (
                -- Get latest active QuitPlan for each user assigned to this coach
                SELECT qp.*,
                       ROW_NUMBER() OVER (PARTITION BY qp.UserID ORDER BY qp.CreatedAt DESC) as rn
                FROM QuitPlans qp
                WHERE qp.CoachID = @coachId AND qp.Status = 'active'
            ) qp_latest ON u.UserID = qp_latest.UserID AND qp_latest.rn = 1
            LEFT JOIN Conversations c ON u.UserID = c.MemberID AND c.CoachID = @coachId
            WHERE u.Role IN ('member', 'guest') AND u.IsActive = 1
            ORDER BY LastActivity DESC, u.FirstName, u.LastName
        `;

        const result = await pool.request()
            .input('coachId', coachId)
            .query(fixedQuery);

        console.log(`🔍 Found ${result.recordset.length} members for coach`);

        res.json({
            success: true,
            data: result.recordset
        });

    } catch (error) {
        console.error('❌ Error loading members:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tải danh sách thành viên',
            error: error.message
        });
    }
});

// Tạo conversation mới với member
router.post('/coach/start-conversation', authenticateToken, async (req, res) => {
    try {
        const { memberId } = req.body;
        const coachId = req.user.UserID;
        const userRole = req.user.Role;

        console.log('🔍 Start conversation - CoachID:', coachId, 'MemberID:', memberId, 'Role:', userRole);

        if (!memberId) {
            return res.status(400).json({
                success: false,
                message: 'Member ID is required'
            });
        }

        // Kiểm tra quyền dựa trên role
        if (userRole === 'coach') {
            // Coach chỉ được start conversation với member được phân công
            const assignmentCheck = await pool.request()
                .input('coachId', coachId)
                .input('memberId', memberId)
                .query(`
                    SELECT qp.PlanID
                    FROM QuitPlans qp
                    INNER JOIN Users u ON qp.UserID = u.UserID
                    WHERE qp.CoachID = @coachId 
                        AND qp.UserID = @memberId
                        AND qp.Status = 'active'
                        AND u.Role IN ('member', 'guest')
                        AND u.IsActive = 1
                `);

            if (assignmentCheck.recordset.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn chỉ có thể tạo cuộc trò chuyện với member được phân công cho bạn.',
                    error_code: 'MEMBER_NOT_ASSIGNED'
                });
            }
        } else if (userRole === 'member') {
            // Member chỉ được start conversation với coach được phân công
            const assignmentCheck = await pool.request()
                .input('memberId', coachId) // coachId is actually memberId when member calls this
                .input('coachId', memberId) // memberId is actually coachId when member calls this
                .query(`
                    SELECT qp.PlanID
                    FROM QuitPlans qp
                    INNER JOIN Users c ON qp.CoachID = c.UserID
                    WHERE qp.UserID = @memberId 
                        AND qp.CoachID = @coachId
                        AND qp.Status = 'active'
                        AND c.Role = 'coach'
                        AND c.IsActive = 1
                `);

            if (assignmentCheck.recordset.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn chỉ có thể tạo cuộc trò chuyện với coach được phân công cho bạn.',
                    error_code: 'COACH_NOT_ASSIGNED'
                });
            }
        }

        // Kiểm tra member tồn tại
        const memberCheck = await pool.request()
            .input('memberId', memberId)
            .query(`
                SELECT UserID, FirstName, LastName, Email FROM Users 
                WHERE UserID = @memberId AND Role IN ('member', 'guest') AND IsActive = 1
            `);

        if (memberCheck.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Thành viên không tồn tại'
            });
        }

        const member = memberCheck.recordset[0];

        // Kiểm tra conversation đã tồn tại chưa
        const existingConversation = await pool.request()
            .input('coachId', coachId)
            .input('memberId', memberId)
            .query(`
                SELECT ConversationID FROM Conversations 
                WHERE CoachID = @coachId AND MemberID = @memberId
            `);

        if (existingConversation.recordset.length > 0) {
            return res.json({
                success: true,
                message: 'Cuộc trò chuyện đã tồn tại',
                data: {
                    conversationId: existingConversation.recordset[0].ConversationID,
                    isNew: false
                }
            });
        }

        // Tạo conversation mới
        const conversationResult = await pool.request()
            .input('coachId', coachId)
            .input('memberId', memberId)
            .query(`
                INSERT INTO Conversations (CoachID, MemberID, LastMessageAt, IsActive)
                OUTPUT INSERTED.ConversationID
                VALUES (@coachId, @memberId, GETDATE(), 1)
            `);

        const conversationId = conversationResult.recordset[0].ConversationID;

        // Gửi tin nhắn chào mừng
        await pool.request()
            .input('senderId', coachId)
            .input('receiverId', memberId)
            .input('content', `Xin chào ${member.FirstName}! Tôi là coach của bạn. Tôi sẽ hỗ trợ bạn trong quá trình cai thuốc. Hãy cho tôi biết nếu bạn có bất kỳ câu hỏi nào.`)
            .query(`
                INSERT INTO Messages (SenderID, ReceiverID, Content, MessageType, IsRead)
                VALUES (@senderId, @receiverId, @content, 'text', 0)
            `);

        console.log(`✅ Created conversation ${conversationId} between coach ${coachId} and member ${memberId}`);

        res.json({
            success: true,
            message: 'Cuộc trò chuyện đã được tạo thành công',
            data: {
                conversationId: conversationId,
                isNew: true,
                member: {
                    UserID: member.UserID,
                    FullName: `${member.FirstName} ${member.LastName}`,
                    Email: member.Email
                }
            }
        });

    } catch (error) {
        console.error('Error starting conversation:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tạo cuộc trò chuyện',
            error: error.message
        });
    }
});

// Lấy tin nhắn của một conversation cụ thể (cho coach)
router.get('/coach/conversations/:conversationId/messages', authenticateToken, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const coachId = req.user.UserID;
        const { page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        console.log('🔍 Coach messages - ConversationID:', conversationId, 'CoachID:', coachId);

        // Verify coach owns this conversation
        const conversationCheck = await pool.request()
            .input('conversationId', conversationId)
            .input('coachId', coachId)
            .query(`
                SELECT ConversationID, MemberID FROM Conversations 
                WHERE ConversationID = @conversationId AND CoachID = @coachId
            `);

        if (conversationCheck.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Cuộc trò chuyện không tồn tại hoặc bạn không có quyền truy cập'
            });
        }

        const memberId = conversationCheck.recordset[0].MemberID;

        // Get messages
        const result = await pool.request()
            .input('coachId', coachId)
            .input('memberId', memberId)
            .input('offset', offset)
            .input('limit', limit)
            .query(`
                SELECT 
                    m.MessageID,
                    m.SenderID,
                    m.ReceiverID,
                    m.Content,
                    m.MessageType,
                    m.IsRead,
                    m.RelatedPlanID,
                    m.CreatedAt,
                    u.FirstName + ' ' + u.LastName as SenderName,
                    u.Avatar as SenderAvatar,
                    u.Role as SenderRole
                FROM Messages m
                INNER JOIN Users u ON m.SenderID = u.UserID
                WHERE (m.SenderID = @coachId AND m.ReceiverID = @memberId)
                   OR (m.SenderID = @memberId AND m.ReceiverID = @coachId)
                ORDER BY m.CreatedAt DESC
                OFFSET @offset ROWS
                FETCH NEXT @limit ROWS ONLY
            `);

        // Mark messages from member as read
        await pool.request()
            .input('coachId', coachId)
            .input('memberId', memberId)
            .query(`
                UPDATE Messages 
                SET IsRead = 1 
                WHERE ReceiverID = @coachId AND SenderID = @memberId AND IsRead = 0
            `);

        res.json({
            success: true,
            data: result.recordset.reverse(), // Reverse để tin nhắn cũ ở trên
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                hasMore: result.recordset.length === parseInt(limit)
            }
        });

    } catch (error) {
        console.error('Error loading conversation messages:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tải tin nhắn',
            error: error.message
        });
    }
});

// NEW: Send message to specific conversation (for coaches)
router.post('/conversation/:conversationId/send', authenticateToken, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const {
            content,
            messageType = 'text',
            relatedPlanId = null
        } = req.body;

        const senderId = req.user.UserID;
        const userRole = req.user.Role;

        console.log('🔍 Send message to conversation - ConversationID:', conversationId, 'UserID:', senderId, 'Role:', userRole);

        if (!content) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu nội dung tin nhắn'
            });
        }

        // Verify user has access to this conversation
        const conversationCheck = await pool.request()
            .input('conversationId', conversationId)
            .input('userId', senderId)
            .query(`
                SELECT ConversationID, CoachID, MemberID FROM Conversations 
                WHERE ConversationID = @conversationId 
                AND (CoachID = @userId OR MemberID = @userId)
            `);

        if (conversationCheck.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Cuộc trò chuyện không tồn tại hoặc bạn không có quyền truy cập'
            });
        }

        const conversation = conversationCheck.recordset[0];
        const receiverId = senderId === conversation.CoachID ? conversation.MemberID : conversation.CoachID;

        // Kiểm tra người nhận tồn tại
        const receiverCheck = await pool.request()
            .input('receiverId', receiverId)
            .query(`
                SELECT UserID, Role FROM Users WHERE UserID = @receiverId
            `);

        if (receiverCheck.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Người nhận không tồn tại'
            });
        }

        // Tạo tin nhắn
        const messageResult = await pool.request()
            .input('senderId', senderId)
            .input('receiverId', receiverId)
            .input('content', content)
            .input('messageType', messageType)
            .input('relatedPlanId', relatedPlanId)
            .query(`
                INSERT INTO Messages (SenderID, ReceiverID, Content, MessageType, RelatedPlanID)
                OUTPUT INSERTED.MessageID, INSERTED.CreatedAt
                VALUES (@senderId, @receiverId, @content, @messageType, @relatedPlanId)
            `);

        const messageId = messageResult.recordset[0].MessageID;
        const createdAt = messageResult.recordset[0].CreatedAt;

        // Update conversation
        await pool.request()
            .input('messageId', messageId)
            .input('createdAt', createdAt)
            .input('conversationId', conversationId)
            .query(`
                UPDATE Conversations 
                SET LastMessageID = @messageId, LastMessageAt = @createdAt
                WHERE ConversationID = @conversationId
            `);

        // Lấy thông tin tin nhắn vừa gửi để trả về
        const messageInfo = await pool.request()
            .input('messageId', messageId)
            .query(`
                SELECT 
                    m.MessageID,
                    m.SenderID,
                    m.ReceiverID,
                    m.Content,
                    m.MessageType,
                    m.IsRead,
                    m.RelatedPlanID,
                    m.CreatedAt,
                    
                    u.FirstName + ' ' + u.LastName as SenderName,
                    u.Avatar as SenderAvatar,
                    u.Role as SenderRole
                FROM Messages m
                INNER JOIN Users u ON m.SenderID = u.UserID
                WHERE m.MessageID = @messageId
            `);

        res.json({
            success: true,
            message: 'Tin nhắn đã được gửi',
            data: messageInfo.recordset[0]
        });

    } catch (error) {
        console.error('Error sending message to conversation:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi gửi tin nhắn',
            error: error.message
        });
    }
});

// NEW: Get messages for any conversation (generic endpoint)
router.get('/conversation/:conversationId/messages', authenticateToken, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.UserID;
        const { page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        console.log('🔍 Get conversation messages - ConversationID:', conversationId, 'UserID:', userId);

        // Verify user has access to this conversation
        const conversationCheck = await pool.request()
            .input('conversationId', conversationId)
            .input('userId', userId)
            .query(`
                SELECT ConversationID, CoachID, MemberID FROM Conversations 
                WHERE ConversationID = @conversationId 
                AND (CoachID = @userId OR MemberID = @userId)
            `);

        if (conversationCheck.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Cuộc trò chuyện không tồn tại hoặc bạn không có quyền truy cập'
            });
        }

        const conversation = conversationCheck.recordset[0];
        const coachId = conversation.CoachID;
        const memberId = conversation.MemberID;

        // Get messages
        const result = await pool.request()
            .input('coachId', coachId)
            .input('memberId', memberId)
            .input('offset', offset)
            .input('limit', limit)
            .query(`
                SELECT 
                    m.MessageID,
                    m.SenderID,
                    m.ReceiverID,
                    m.Content,
                    m.MessageType,
                    m.IsRead,
                    m.RelatedPlanID,
                    m.CreatedAt,
                    u.FirstName + ' ' + u.LastName as SenderName,
                    u.Avatar as SenderAvatar,
                    u.Role as SenderRole
                FROM Messages m
                INNER JOIN Users u ON m.SenderID = u.UserID
                WHERE (m.SenderID = @coachId AND m.ReceiverID = @memberId)
                   OR (m.SenderID = @memberId AND m.ReceiverID = @coachId)
                ORDER BY m.CreatedAt DESC
                OFFSET @offset ROWS
                FETCH NEXT @limit ROWS ONLY
            `);

        // Mark messages as read for current user
        await pool.request()
            .input('userId', userId)
            .input('otherUserId', userId === coachId ? memberId : coachId)
            .query(`
                UPDATE Messages 
                SET IsRead = 1 
                WHERE ReceiverID = @userId AND SenderID = @otherUserId AND IsRead = 0
            `);

        res.json({
            success: true,
            data: result.recordset.reverse(), // Reverse để tin nhắn cũ ở trên
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                hasMore: result.recordset.length === parseInt(limit)
            }
        });

    } catch (error) {
        console.error('Error loading conversation messages:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tải tin nhắn',
            error: error.message
        });
    }
});

// ===== FILE ATTACHMENT ENDPOINTS =====

// Send message with file attachment
router.post('/send-with-file', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        const { content = '', messageType = 'file', relatedPlanId = null, receiverId } = req.body;
        const senderId = req.user.UserID;
        const userRole = req.user.Role;

        console.log('🔍 Send message with file - UserID:', senderId, 'Role:', userRole);

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Không có file được upload'
            });
        }

        let actualReceiverId = receiverId;

        // Auto-determine receiver if not specified
        if (!actualReceiverId) {
            if (userRole === 'member') {
                // Member gửi cho coach
                let coachResult = await pool.request()
                    .input('senderId', senderId)
                    .query(`
                        SELECT TOP 1 CoachID
                        FROM Conversations 
                        WHERE MemberID = @senderId AND IsActive = 1
                        ORDER BY LastMessageAt DESC
                    `);

                if (coachResult.recordset.length === 0) {
                    const availableCoach = await pool.request().query(`
                        SELECT TOP 1 UserID
                        FROM Users 
                        WHERE Role = 'coach' AND IsActive = 1
                        ORDER BY UserID
                    `);

                    if (availableCoach.recordset.length === 0) {
                        return res.status(404).json({
                            success: false,
                            message: 'Không có coach nào có sẵn trong hệ thống'
                        });
                    }

                    actualReceiverId = availableCoach.recordset[0].UserID;
                } else {
                    actualReceiverId = coachResult.recordset[0].CoachID;
                }
            } else if (userRole === 'coach') {
                return res.status(400).json({
                    success: false,
                    message: 'Coach cần chỉ định member để gửi file'
                });
            }
        }

        // Kiểm tra người nhận tồn tại
        const receiverCheck = await pool.request()
            .input('receiverId', actualReceiverId)
            .query(`
                SELECT UserID, Role FROM Users WHERE UserID = @receiverId
            `);

        if (receiverCheck.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Người nhận không tồn tại'
            });
        }

        // Tạo file URL
        const fileUrl = `/uploads/chat/${req.file.filename}`;
        const fileContent = content || `📎 ${req.file.originalname}`;

        // Tạo tin nhắn
        const messageResult = await pool.request()
            .input('senderId', senderId)
            .input('receiverId', actualReceiverId)
            .input('content', fileContent)
            .input('messageType', messageType)
            .input('relatedPlanId', relatedPlanId)
            .query(`
                INSERT INTO Messages (SenderID, ReceiverID, Content, MessageType, RelatedPlanID)
                OUTPUT INSERTED.MessageID, INSERTED.CreatedAt
                VALUES (@senderId, @receiverId, @content, @messageType, @relatedPlanId)
            `);

        const messageId = messageResult.recordset[0].MessageID;
        const createdAt = messageResult.recordset[0].CreatedAt;

        // Lưu thông tin file đính kèm
        await pool.request()
            .input('messageId', messageId)
            .input('fileName', req.file.originalname)
            .input('fileUrl', fileUrl)
            .input('fileSize', req.file.size)
            .input('mimeType', req.file.mimetype)
            .query(`
                INSERT INTO MessageAttachments (MessageID, FileName, FileURL, FileSize, MimeType)
                VALUES (@messageId, @fileName, @fileUrl, @fileSize, @mimeType)
            `);

        // Tìm hoặc tạo conversation
        const coachId = userRole === 'coach' ? senderId : actualReceiverId;
        const memberId = userRole === 'member' ? senderId : actualReceiverId;

        let conversation = await pool.request()
            .input('coachId', coachId)
            .input('memberId', memberId)
            .query(`
                SELECT ConversationID FROM Conversations 
                WHERE CoachID = @coachId AND MemberID = @memberId
            `);

        if (conversation.recordset.length === 0) {
            await pool.request()
                .input('coachId', coachId)
                .input('memberId', memberId)
                .input('messageId', messageId)
                .input('createdAt', createdAt)
                .query(`
                    INSERT INTO Conversations (CoachID, MemberID, LastMessageID, LastMessageAt)
                    VALUES (@coachId, @memberId, @messageId, @createdAt)
                `);
        } else {
            await pool.request()
                .input('messageId', messageId)
                .input('createdAt', createdAt)
                .input('conversationId', conversation.recordset[0].ConversationID)
                .query(`
                    UPDATE Conversations 
                    SET LastMessageID = @messageId, LastMessageAt = @createdAt
                    WHERE ConversationID = @conversationId
                `);
        }

        // Lấy thông tin tin nhắn vừa gửi để trả về
        const messageInfo = await pool.request()
            .input('messageId', messageId)
            .query(`
                SELECT 
                    m.MessageID,
                    m.SenderID,
                    m.ReceiverID,
                    m.Content,
                    m.MessageType,
                    m.IsRead,
                    m.RelatedPlanID,
                    m.CreatedAt,
                    u.FirstName + ' ' + u.LastName as SenderName,
                    u.Avatar as SenderAvatar,
                    u.Role as SenderRole,
                    ma.AttachmentID,
                    ma.FileName,
                    ma.FileURL,
                    ma.FileSize,
                    ma.MimeType
                FROM Messages m
                INNER JOIN Users u ON m.SenderID = u.UserID
                LEFT JOIN MessageAttachments ma ON m.MessageID = ma.MessageID
                WHERE m.MessageID = @messageId
            `);

        res.json({
            success: true,
            message: 'Tin nhắn với file đính kèm đã được gửi',
            data: messageInfo.recordset[0]
        });

    } catch (error) {
        console.error('Error sending message with file:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi gửi tin nhắn với file đính kèm',
            error: error.message
        });
    }
});

// Send message with file attachment to specific conversation
router.post('/conversation/:conversationId/send-with-file', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { content = '', messageType = 'file', relatedPlanId = null } = req.body;
        const senderId = req.user.UserID;

        console.log('🔍 Send file to conversation - ConversationID:', conversationId, 'UserID:', senderId);

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Không có file được upload'
            });
        }

        // Verify user has access to this conversation
        const conversationCheck = await pool.request()
            .input('conversationId', conversationId)
            .input('userId', senderId)
            .query(`
                SELECT ConversationID, CoachID, MemberID FROM Conversations 
                WHERE ConversationID = @conversationId 
                AND (CoachID = @userId OR MemberID = @userId)
            `);

        if (conversationCheck.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Cuộc trò chuyện không tồn tại hoặc bạn không có quyền truy cập'
            });
        }

        const conversation = conversationCheck.recordset[0];
        const receiverId = senderId === conversation.CoachID ? conversation.MemberID : conversation.CoachID;

        // Tạo file URL
        const fileUrl = `/uploads/chat/${req.file.filename}`;
        const fileContent = content || `📎 ${req.file.originalname}`;

        // Tạo tin nhắn
        const messageResult = await pool.request()
            .input('senderId', senderId)
            .input('receiverId', receiverId)
            .input('content', fileContent)
            .input('messageType', messageType)
            .input('relatedPlanId', relatedPlanId)
            .query(`
                INSERT INTO Messages (SenderID, ReceiverID, Content, MessageType, RelatedPlanID)
                OUTPUT INSERTED.MessageID, INSERTED.CreatedAt
                VALUES (@senderId, @receiverId, @content, @messageType, @relatedPlanId)
            `);

        const messageId = messageResult.recordset[0].MessageID;
        const createdAt = messageResult.recordset[0].CreatedAt;

        // Lưu thông tin file đính kèm
        await pool.request()
            .input('messageId', messageId)
            .input('fileName', req.file.originalname)
            .input('fileUrl', fileUrl)
            .input('fileSize', req.file.size)
            .input('mimeType', req.file.mimetype)
            .query(`
                INSERT INTO MessageAttachments (MessageID, FileName, FileURL, FileSize, MimeType)
                VALUES (@messageId, @fileName, @fileUrl, @fileSize, @mimeType)
            `);

        // Update conversation
        await pool.request()
            .input('messageId', messageId)
            .input('createdAt', createdAt)
            .input('conversationId', conversationId)
            .query(`
                UPDATE Conversations 
                SET LastMessageID = @messageId, LastMessageAt = @createdAt
                WHERE ConversationID = @conversationId
            `);

        // Lấy thông tin tin nhắn vừa gửi để trả về
        const messageInfo = await pool.request()
            .input('messageId', messageId)
            .query(`
                SELECT 
                    m.MessageID,
                    m.SenderID,
                    m.ReceiverID,
                    m.Content,
                    m.MessageType,
                    m.IsRead,
                    m.RelatedPlanID,
                    m.CreatedAt,
                    u.FirstName + ' ' + u.LastName as SenderName,
                    u.Avatar as SenderAvatar,
                    u.Role as SenderRole,
                    ma.AttachmentID,
                    ma.FileName,
                    ma.FileURL,
                    ma.FileSize,
                    ma.MimeType
                FROM Messages m
                INNER JOIN Users u ON m.SenderID = u.UserID
                LEFT JOIN MessageAttachments ma ON m.MessageID = ma.MessageID
                WHERE m.MessageID = @messageId
            `);

        res.json({
            success: true,
            message: 'File đã được gửi thành công',
            data: messageInfo.recordset[0]
        });

    } catch (error) {
        console.error('Error sending file to conversation:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi gửi file',
            error: error.message
        });
    }
});

// Get file attachments for a message
router.get('/message/:messageId/attachments', authenticateToken, async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.UserID;

        // Verify user has access to this message
        const messageCheck = await pool.request()
            .input('messageId', messageId)
            .input('userId', userId)
            .query(`
                SELECT MessageID FROM Messages 
                WHERE MessageID = @messageId 
                AND (SenderID = @userId OR ReceiverID = @userId)
            `);

        if (messageCheck.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Tin nhắn không tồn tại hoặc bạn không có quyền truy cập'
            });
        }

        // Get attachments
        const attachments = await pool.request()
            .input('messageId', messageId)
            .query(`
                SELECT 
                    AttachmentID,
                    MessageID,
                    FileName,
                    FileURL,
                    FileSize,
                    MimeType,
                    CreatedAt
                FROM MessageAttachments 
                WHERE MessageID = @messageId
                ORDER BY CreatedAt ASC
            `);

        res.json({
            success: true,
            data: attachments.recordset
        });

    } catch (error) {
        console.error('Error getting message attachments:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy file đính kèm',
            error: error.message
        });
    }
});

// Serve chat files
router.get('/files/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadsDir, filename);

    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({
            success: false,
            message: 'File không tồn tại'
        });
    }
});

// ==================== APPOINTMENT APIS FOR CHAT ====================

// Create appointment from chat (both coach and member can create)
router.post('/appointment', authenticateToken, async (req, res) => {
    try {
        const { receiverId, appointmentDate, duration = 30, type = 'chat', notes } = req.body;
        const senderId = req.user.UserID;
        const senderRole = req.user.Role;

        console.log('📅 Creating appointment:', { senderId, receiverId, appointmentDate, duration, type, senderRole });

        // Validate input
        if (!receiverId || !appointmentDate) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp đầy đủ thông tin: receiverId và appointmentDate'
            });
        }

        // Validate appointment date (must be in the future)
        const appointmentDateTime = new Date(appointmentDate);
        const now = new Date();
        if (appointmentDateTime <= now) {
            return res.status(400).json({
                success: false,
                message: 'Thời gian hẹn phải trong tương lai'
            });
        }

        // Determine coach and member IDs based on sender role
        let coachId, memberId;
        if (senderRole === 'coach') {
            coachId = senderId;
            memberId = receiverId;
        } else if (senderRole === 'member' || senderRole === 'guest') {
            coachId = receiverId;
            memberId = senderId;
        } else {
            return res.status(403).json({
                success: false,
                message: 'Chỉ coach và member mới có thể đặt lịch tư vấn'
            });
        }

        // Check if coach exists and is active
        const coachCheck = await pool.request()
            .input('coachId', coachId)
            .query(`
                SELECT UserID, IsActive 
                FROM Users 
                WHERE UserID = @coachId AND Role = 'coach'
            `);

        if (coachCheck.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy coach'
            });
        }

        if (!coachCheck.recordset[0].IsActive) {
            return res.status(400).json({
                success: false,
                message: 'Coach này hiện không hoạt động'
            });
        }

        // IMPORTANT: If member is creating appointment, validate they can only book with assigned coach
        if (senderRole === 'member' || senderRole === 'guest') {
            const assignmentCheck = await pool.request()
                .input('memberId', memberId)
                .input('coachId', coachId)
                .query(`
                    SELECT qp.PlanID
                    FROM QuitPlans qp
                    WHERE qp.UserID = @memberId 
                        AND qp.CoachID = @coachId
                        AND qp.Status = 'active'
                `);

            if (assignmentCheck.recordset.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn chỉ có thể đặt lịch với coach được phân công cho bạn. Vui lòng liên hệ admin để được hỗ trợ.'
                });
            }

            console.log('✅ Member booking validated - assigned coach confirmed');
        }

        // Check for conflicting appointments (simplified logic)
        const conflictCheck = await pool.request()
            .input('coachId', coachId)
            .input('appointmentDate', appointmentDate)
            .query(`
                SELECT COUNT(*) as count
                FROM ConsultationAppointments
                WHERE CoachID = @coachId
                AND Status IN ('scheduled', 'confirmed')
                AND CAST(AppointmentDate AS DATE) = CAST(@appointmentDate AS DATE)
                AND ABS(DATEDIFF(MINUTE, AppointmentDate, @appointmentDate)) < 60
            `);

        if (conflictCheck.recordset[0].count > 0) {
            console.log('⚠️ Appointment conflict detected, but allowing creation for testing');
            // Don't block for now, just log the conflict
        }

        // Create the appointment
        const result = await pool.request()
            .input('coachId', coachId)
            .input('memberId', memberId)
            .input('appointmentDate', appointmentDate)
            .input('duration', duration)
            .input('type', type)
            .input('notes', notes || '')
            .query(`
                INSERT INTO ConsultationAppointments (CoachID, MemberID, AppointmentDate, Duration, Type, Notes, Status)
                OUTPUT INSERTED.AppointmentID, INSERTED.AppointmentDate, INSERTED.Duration, INSERTED.Type, INSERTED.Status
                VALUES (@coachId, @memberId, @appointmentDate, @duration, @type, @notes, 'scheduled')
            `);

        const appointment = result.recordset[0];

        // Generate meeting link if it's video/audio call
        let meetingLink = null;
        if (type === 'video' || type === 'audio') {
            meetingLink = `https://meet.smokeking.com/room/${appointment.AppointmentID}`;

            // Update appointment with meeting link
            await pool.request()
                .input('appointmentId', appointment.AppointmentID)
                .input('meetingLink', meetingLink)
                .query(`
                    UPDATE ConsultationAppointments 
                    SET MeetingLink = @meetingLink 
                    WHERE AppointmentID = @appointmentId
                `);
        }

        // Send notification message (temporarily disabled for debugging)
        try {
            await pool.request()
                .input('senderId', senderId)
                .input('receiverId', receiverId)
                .input('content', `Lịch hẹn mới đã được tạo cho ${new Date(appointmentDate).toLocaleString('vi-VN')}`)
                .input('messageType', 'plan_update')
                .query(`
                    INSERT INTO Messages (SenderID, ReceiverID, Content, MessageType)
                    VALUES (@senderId, @receiverId, @content, @messageType)
                `);
        } catch (msgError) {
            console.log('⚠️ Failed to send notification message:', msgError.message);
            // Don't fail the appointment creation if notification fails
        }

        res.json({
            success: true,
            message: 'Đặt lịch tư vấn thành công',
            data: {
                appointmentId: appointment.AppointmentID,
                appointmentDate: appointment.AppointmentDate,
                duration: appointment.Duration,
                type: appointment.Type,
                status: appointment.Status,
                meetingLink
            }
        });

    } catch (error) {
        console.error('❌ Error creating appointment:', error);
        console.error('Error stack:', error.stack);
        console.error('SQL Error details:', error.originalError);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi tạo lịch hẹn',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Get appointments for current user (both coach and member)
router.get('/appointments', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.UserID;
        const userRole = req.user.Role; // Fix: Use Role instead of role
        const { status, date, limit = 20, offset = 0 } = req.query;

        let query, countQuery;
        const request = pool.request().input('userId', userId);
        const countRequest = pool.request().input('userId', userId);

        if (userRole === 'coach') {
            query = `
                SELECT 
                    ca.AppointmentID,
                    ca.AppointmentDate,
                    ca.Duration,
                    ca.Type,
                    ca.Status,
                    ca.Notes,
                    ca.MeetingLink,
                    ca.CreatedAt,
                    ca.UpdatedAt,
                    u.UserID as MemberID,
                    u.FirstName as MemberFirstName,
                    u.LastName as MemberLastName,
                    u.Email as MemberEmail,
                    u.Avatar as MemberAvatar,
                    mp.Name as MembershipPlan
                FROM ConsultationAppointments ca
                INNER JOIN Users u ON ca.MemberID = u.UserID
                LEFT JOIN UserMemberships um ON u.UserID = um.UserID AND um.Status = 'active'
                LEFT JOIN MembershipPlans mp ON um.PlanID = mp.PlanID
                WHERE ca.CoachID = @userId
            `;

            countQuery = `
                SELECT COUNT(*) as total
                FROM ConsultationAppointments ca
                WHERE ca.CoachID = @userId
            `;
        } else if (userRole === 'member' || userRole === 'guest') {
            query = `
                SELECT 
                    ca.AppointmentID,
                    ca.AppointmentDate,
                    ca.Duration,
                    ca.Type,
                    ca.Status,
                    ca.Notes,
                    ca.MeetingLink,
                    ca.CreatedAt,
                    ca.UpdatedAt,
                    u.UserID as CoachID,
                    u.FirstName as CoachFirstName,
                    u.LastName as CoachLastName,
                    u.Email as CoachEmail,
                    u.Avatar as CoachAvatar
                FROM ConsultationAppointments ca
                INNER JOIN Users u ON ca.CoachID = u.UserID
                WHERE ca.MemberID = @userId
            `;

            countQuery = `
                SELECT COUNT(*) as total
                FROM ConsultationAppointments ca
                WHERE ca.MemberID = @userId
            `;
        } else {
            return res.status(403).json({
                success: false,
                message: 'Chỉ coach và member mới có thể xem lịch hẹn'
            });
        }

        // Add filters
        if (status) {
            query += ` AND ca.Status = @status`;
            countQuery += ` AND ca.Status = @status`;
            request.input('status', status);
            countRequest.input('status', status);
        }

        if (date) {
            query += ` AND CAST(ca.AppointmentDate AS DATE) = @date`;
            countQuery += ` AND CAST(ca.AppointmentDate AS DATE) = @date`;
            request.input('date', date);
            countRequest.input('date', date);
        }

        query += ` ORDER BY ca.AppointmentDate DESC`;
        query += ` OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;

        request.input('offset', parseInt(offset));
        request.input('limit', parseInt(limit));

        const [result, countResult] = await Promise.all([
            request.query(query),
            countRequest.query(countQuery)
        ]);

        const total = countResult.recordset[0].total;

        // Format appointments data
        const appointments = result.recordset.map(appointment => {
            const baseData = {
                id: appointment.AppointmentID,
                appointmentDate: appointment.AppointmentDate,
                duration: appointment.Duration,
                type: appointment.Type,
                status: appointment.Status,
                notes: appointment.Notes,
                meetingLink: appointment.MeetingLink,
                createdAt: appointment.CreatedAt,
                updatedAt: appointment.UpdatedAt
            };

            if (userRole === 'coach') {
                baseData.member = {
                    id: appointment.MemberID,
                    firstName: appointment.MemberFirstName,
                    lastName: appointment.MemberLastName,
                    fullName: `${appointment.MemberFirstName} ${appointment.MemberLastName}`,
                    email: appointment.MemberEmail,
                    avatar: appointment.MemberAvatar,
                    membershipPlan: appointment.MembershipPlan
                };
            } else {
                baseData.coach = {
                    id: appointment.CoachID,
                    firstName: appointment.CoachFirstName,
                    lastName: appointment.CoachLastName,
                    fullName: `${appointment.CoachFirstName} ${appointment.CoachLastName}`,
                    email: appointment.CoachEmail,
                    avatar: appointment.CoachAvatar
                };
            }

            return baseData;
        });

        res.json({
            success: true,
            data: appointments,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: (parseInt(offset) + parseInt(limit)) < total
            }
        });

    } catch (error) {
        console.error('Error fetching user appointments:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi tải danh sách lịch hẹn',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Cancel appointment for member (POST fallback for CORS issues)
router.post('/appointments/:appointmentId/cancel', authenticateToken, async (req, res) => {
    console.log('🔄 POST fallback for appointment cancel');

    // Reuse the same logic as PATCH
    const { appointmentId } = req.params;
    const userId = req.user.UserID;
    const userRole = req.user.Role;

    console.log('🚫 Member cancelling appointment (POST):', { appointmentId, userId, userRole });

    try {
        // Check if appointment exists and user has permission to cancel
        const appointmentCheck = await pool.request()
            .input('appointmentId', appointmentId)
            .input('userId', userId)
            .query(`
                SELECT 
                    ca.AppointmentID, 
                    ca.Status, 
                    ca.AppointmentDate,
                    ca.CoachID,
                    ca.MemberID,
                    coach.FirstName + ' ' + coach.LastName as CoachName,
                    member.FirstName + ' ' + member.LastName as MemberName
                FROM ConsultationAppointments ca
                INNER JOIN Users coach ON ca.CoachID = coach.UserID
                INNER JOIN Users member ON ca.MemberID = member.UserID
                WHERE ca.AppointmentID = @appointmentId 
                AND (
                    (ca.MemberID = @userId AND @userId IS NOT NULL) OR
                    (ca.CoachID = @userId AND @userId IS NOT NULL)
                )
            `);

        if (appointmentCheck.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy lịch hẹn hoặc bạn không có quyền hủy'
            });
        }

        const appointment = appointmentCheck.recordset[0];

        // Check if appointment can be cancelled
        if (appointment.Status === 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Không thể hủy lịch hẹn đã hoàn thành'
            });
        }

        if (appointment.Status === 'cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Lịch hẹn đã được hủy trước đó'
            });
        }

        // Check if appointment is too close (less than 1 hour)
        const appointmentDate = new Date(appointment.AppointmentDate);
        const now = new Date();
        const hoursDiff = (appointmentDate - now) / (1000 * 60 * 60);

        if (hoursDiff < 1 && hoursDiff > 0) {
            return res.status(400).json({
                success: false,
                message: 'Không thể hủy lịch hẹn cách thời gian hẹn dưới 1 giờ'
            });
        }

        // Update appointment status to cancelled
        await pool.request()
            .input('appointmentId', appointmentId)
            .query(`
                UPDATE ConsultationAppointments 
                SET Status = 'cancelled', UpdatedAt = GETDATE()
                WHERE AppointmentID = @appointmentId
            `);

        // Send notification message to the other party
        let notificationContent, receiverId;
        if (userRole === 'member' || userRole === 'guest') {
            notificationContent = `Thành viên ${appointment.MemberName} đã hủy lịch hẹn tư vấn vào ${appointmentDate.toLocaleString('vi-VN')}`;
            receiverId = appointment.CoachID;
        } else {
            notificationContent = `Coach ${appointment.CoachName} đã hủy lịch hẹn tư vấn vào ${appointmentDate.toLocaleString('vi-VN')}`;
            receiverId = appointment.MemberID;
        }

        // Insert notification message (don't fail cancellation if this fails)
        try {
            await pool.request()
                .input('senderId', userId)
                .input('receiverId', receiverId)
                .input('content', notificationContent)
                .query(`
                    INSERT INTO Messages (SenderID, ReceiverID, Content, MessageType)
                    VALUES (@senderId, @receiverId, @content, 'text')
                `);
        } catch (notificationError) {
            console.log('⚠️ Failed to send cancellation notification (POST):', notificationError.message);
            // Don't fail the cancellation if notification fails
        }

        res.json({
            success: true,
            message: 'Hủy lịch hẹn thành công (POST)',
            data: {
                appointmentId: parseInt(appointmentId),
                status: 'cancelled',
                cancelledAt: new Date().toISOString(),
                cancelledBy: userRole === 'member' || userRole === 'guest' ? 'member' : 'coach'
            }
        });

    } catch (error) {
        console.error('Error cancelling appointment (POST):', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi hủy lịch hẹn',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Test appointment cancel without auth
router.get('/appointments/test-cancel/:appointmentId', async (req, res) => {
    try {
        const { appointmentId } = req.params;
        res.json({
            success: true,
            message: 'Test endpoint accessible',
            appointmentId: appointmentId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Test endpoint error',
            error: error.message
        });
    }
});

// OPTIONS handler for preflight requests on cancel
router.options('/appointments/:appointmentId/cancel', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.sendStatus(200);
});

// Cancel appointment for member (PATCH - original method)
router.patch('/appointments/:appointmentId/cancel', authenticateToken, async (req, res) => {
    try {
        console.log('🔍 PATCH Cancel request received:', {
            params: req.params,
            headers: req.headers,
            user: req.user
        });

        const { appointmentId } = req.params;
        const userId = req.user.UserID;
        const userRole = req.user.Role;

        console.log('🚫 Member cancelling appointment:', { appointmentId, userId, userRole });

        // Check if appointment exists and user has permission to cancel
        const appointmentCheck = await pool.request()
            .input('appointmentId', appointmentId)
            .input('userId', userId)
            .query(`
                SELECT 
                    ca.AppointmentID, 
                    ca.Status, 
                    ca.AppointmentDate,
                    ca.CoachID,
                    ca.MemberID,
                    coach.FirstName + ' ' + coach.LastName as CoachName,
                    member.FirstName + ' ' + member.LastName as MemberName
                FROM ConsultationAppointments ca
                INNER JOIN Users coach ON ca.CoachID = coach.UserID
                INNER JOIN Users member ON ca.MemberID = member.UserID
                WHERE ca.AppointmentID = @appointmentId 
                AND (
                    (ca.MemberID = @userId AND @userId IS NOT NULL) OR
                    (ca.CoachID = @userId AND @userId IS NOT NULL)
                )
            `);

        if (appointmentCheck.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy lịch hẹn hoặc bạn không có quyền hủy'
            });
        }

        const appointment = appointmentCheck.recordset[0];

        // Check if appointment can be cancelled
        if (appointment.Status === 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Không thể hủy lịch hẹn đã hoàn thành'
            });
        }

        if (appointment.Status === 'cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Lịch hẹn đã được hủy trước đó'
            });
        }

        // Check if appointment is too close (less than 1 hour)
        const appointmentDate = new Date(appointment.AppointmentDate);
        const now = new Date();
        const hoursDiff = (appointmentDate - now) / (1000 * 60 * 60);

        if (hoursDiff < 1 && hoursDiff > 0) {
            return res.status(400).json({
                success: false,
                message: 'Không thể hủy lịch hẹn cách thời gian hẹn dưới 1 giờ'
            });
        }

        // Update appointment status to cancelled
        await pool.request()
            .input('appointmentId', appointmentId)
            .query(`
                UPDATE ConsultationAppointments 
                SET Status = 'cancelled', UpdatedAt = GETDATE()
                WHERE AppointmentID = @appointmentId
            `);

        // Send notification message to the other party
        let notificationContent, receiverId;
        if (userRole === 'member' || userRole === 'guest') {
            notificationContent = `Thành viên ${appointment.MemberName} đã hủy lịch hẹn tư vấn vào ${appointmentDate.toLocaleString('vi-VN')}`;
            receiverId = appointment.CoachID;
        } else {
            notificationContent = `Coach ${appointment.CoachName} đã hủy lịch hẹn tư vấn vào ${appointmentDate.toLocaleString('vi-VN')}`;
            receiverId = appointment.MemberID;
        }

        // Insert notification message (don't fail cancellation if this fails)
        try {
            await pool.request()
                .input('senderId', userId)
                .input('receiverId', receiverId)
                .input('content', notificationContent)
                .query(`
                    INSERT INTO Messages (SenderID, ReceiverID, Content, MessageType)
                    VALUES (@senderId, @receiverId, @content, 'text')
                `);
        } catch (notificationError) {
            console.log('⚠️ Failed to send cancellation notification (PATCH):', notificationError.message);
            // Don't fail the cancellation if notification fails
        }

        res.json({
            success: true,
            message: 'Hủy lịch hẹn thành công',
            data: {
                appointmentId: parseInt(appointmentId),
                status: 'cancelled',
                cancelledAt: new Date().toISOString(),
                cancelledBy: userRole === 'member' || userRole === 'guest' ? 'member' : 'coach'
            }
        });

    } catch (error) {
        console.error('Error cancelling appointment:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi hủy lịch hẹn',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Catch all appointment routes for debugging
router.all('/appointments/*', (req, res, next) => {
    console.log('🔍 Appointment route hit:', {
        method: req.method,
        url: req.url,
        path: req.path,
        params: req.params,
        headers: {
            authorization: req.headers.authorization ? 'present' : 'missing',
            'content-type': req.headers['content-type']
        }
    });
    next();
});

// Get completed appointments for feedback (member only)
router.get('/appointments/completed', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.UserID;
        const userRole = req.user.Role;

        console.log('🔍 Getting completed appointments for user:', userId);

        // Only allow members/guests to access
        if (!['member', 'guest'].includes(userRole)) {
            return res.status(403).json({
                success: false,
                message: 'Chỉ member mới có thể xem appointments'
            });
        }

        // Get completed appointments that haven't been rated yet
        const result = await pool.request()
            .input('MemberID', userId)
            .query(`
                SELECT 
                    ca.AppointmentID as id,
                    ca.AppointmentDate as appointmentDate,
                    ca.Duration as duration,
                    ca.Type as type,
                    ca.Status as status,
                    ca.Notes as notes,
                    ca.MeetingLink as meetingLink,
                    ca.CreatedAt as createdAt,
                    ca.UpdatedAt as updatedAt,
                    
                    -- Coach info
                    coach.UserID as coachId,
                    coach.FirstName as coachFirstName,
                    coach.LastName as coachLastName,
                    coach.Email as coachEmail,
                    coach.Avatar as coachAvatar

                FROM ConsultationAppointments ca
                INNER JOIN Users coach ON ca.CoachID = coach.UserID
                LEFT JOIN CoachFeedback cf ON ca.AppointmentID = cf.AppointmentID 
                    AND cf.MemberID = @MemberID
                WHERE ca.MemberID = @MemberID 
                    AND ca.Status = 'completed'
                    AND cf.FeedbackID IS NULL  -- Chưa có feedback
                ORDER BY ca.AppointmentDate DESC
            `);

        // Format appointments data
        const appointments = result.recordset.map(appointment => ({
            id: appointment.id,
            appointmentDate: appointment.appointmentDate,
            duration: appointment.duration,
            type: appointment.type,
            status: appointment.status,
            notes: appointment.notes,
            meetingLink: appointment.meetingLink,
            createdAt: appointment.createdAt,
            updatedAt: appointment.updatedAt,
            coach: {
                id: appointment.coachId,
                firstName: appointment.coachFirstName,
                lastName: appointment.coachLastName,
                fullName: `${appointment.coachFirstName} ${appointment.coachLastName}`,
                email: appointment.coachEmail,
                avatar: appointment.coachAvatar
            }
        }));

        console.log(`✅ Found ${appointments.length} completed appointments without feedback`);

        res.json({
            success: true,
            data: appointments,
            message: `Tìm thấy ${appointments.length} cuộc hẹn đã hoàn thành chưa đánh giá`
        });

    } catch (error) {
        console.error('❌ Error getting completed appointments:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách cuộc hẹn đã hoàn thành',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// 404 handler for appointment routes
router.use('/appointments/*', (req, res) => {
    console.log('❌ Appointment route not found:', req.method, req.path);
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.path}`,
        availableRoutes: [
            'GET /api/chat/appointments',
            'GET /api/chat/appointments/completed',
            'PATCH /api/chat/appointments/:id/cancel',
            'POST /api/chat/appointments/:id/cancel',
            'PUT /api/chat/appointments/:id'
        ]
    });
});

// PUT fallback for appointment status update (CORS workaround)
router.put('/appointments/:appointmentId', authenticateToken, async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const { status } = req.body;
        const userId = req.user.UserID;
        const userRole = req.user.Role;

        console.log('🔄 PUT fallback for appointment status update:', { appointmentId, status, userId, userRole });

        // Only allow status cancellation via this route
        if (status !== 'cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Route này chỉ hỗ trợ hủy lịch hẹn'
            });
        }

        // Check if appointment exists and user has permission
        const appointmentCheck = await pool.request()
            .input('appointmentId', appointmentId)
            .input('userId', userId)
            .query(`
                SELECT 
                    ca.AppointmentID, 
                    ca.Status, 
                    ca.AppointmentDate,
                    ca.CoachID,
                    ca.MemberID,
                    coach.FirstName + ' ' + coach.LastName as CoachName,
                    member.FirstName + ' ' + member.LastName as MemberName
                FROM ConsultationAppointments ca
                INNER JOIN Users coach ON ca.CoachID = coach.UserID
                INNER JOIN Users member ON ca.MemberID = member.UserID
                WHERE ca.AppointmentID = @appointmentId 
                AND (
                    (ca.MemberID = @userId AND @userId IS NOT NULL) OR
                    (ca.CoachID = @userId AND @userId IS NOT NULL)
                )
            `);

        if (appointmentCheck.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy lịch hẹn hoặc bạn không có quyền'
            });
        }

        const appointment = appointmentCheck.recordset[0];

        // Check if already cancelled
        if (appointment.Status === 'cancelled') {
            return res.json({
                success: true,
                message: 'Lịch hẹn đã được hủy trước đó',
                data: {
                    appointmentId: parseInt(appointmentId),
                    status: 'cancelled',
                    alreadyCancelled: true
                }
            });
        }

        // Update appointment status
        await pool.request()
            .input('appointmentId', appointmentId)
            .input('status', 'cancelled')
            .query(`
                UPDATE ConsultationAppointments 
                SET Status = @status, UpdatedAt = GETDATE()
                WHERE AppointmentID = @appointmentId
            `);

        res.json({
            success: true,
            message: 'Hủy lịch hẹn thành công (PUT)',
            data: {
                appointmentId: parseInt(appointmentId),
                status: 'cancelled',
                cancelledAt: new Date().toISOString(),
                method: 'PUT'
            }
        });

    } catch (error) {
        console.error('Error updating appointment status (PUT):', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi cập nhật lịch hẹn',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Submit feedback for coach after completed appointment
router.post('/feedback', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.UserID;
        const userRole = req.user.Role;
        const { coachId, appointmentId, rating, comment, categories, isAnonymous } = req.body;

        console.log('📝 Submitting feedback:', {
            userId,
            coachId,
            appointmentId,
            rating,
            comment: comment?.substring(0, 50) + '...',
            categories,
            isAnonymous
        });

        // Only allow members/guests to submit feedback
        if (!['member', 'guest'].includes(userRole)) {
            return res.status(403).json({
                success: false,
                message: 'Chỉ member mới có thể đánh giá coach'
            });
        }

        // Validate required fields
        if (!coachId || !rating) {
            return res.status(400).json({
                success: false,
                message: 'Thông tin đánh giá không đầy đủ'
            });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: 'Đánh giá phải từ 1-5 sao'
            });
        }

        // Verify appointment exists and is completed
        if (appointmentId) {
            const appointmentCheck = await pool.request()
                .input('AppointmentID', appointmentId)
                .input('MemberID', userId)
                .input('CoachID', coachId)
                .query(`
                    SELECT AppointmentID, Status 
                    FROM ConsultationAppointments 
                    WHERE AppointmentID = @AppointmentID 
                        AND MemberID = @MemberID 
                        AND CoachID = @CoachID
                `);

            if (appointmentCheck.recordset.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy cuộc hẹn'
                });
            }

            if (appointmentCheck.recordset[0].Status !== 'completed') {
                return res.status(400).json({
                    success: false,
                    message: 'Chỉ có thể đánh giá sau khi cuộc hẹn hoàn thành'
                });
            }

            // Check if feedback already exists for this appointment
            const existingFeedback = await pool.request()
                .input('AppointmentID', appointmentId)
                .input('MemberID', userId)
                .input('CoachID', coachId)
                .query(`
                    SELECT FeedbackID 
                    FROM CoachFeedback 
                    WHERE AppointmentID = @AppointmentID 
                        AND MemberID = @MemberID 
                        AND CoachID = @CoachID
                `);

            if (existingFeedback.recordset.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: 'Bạn đã đánh giá cuộc hẹn này rồi'
                });
            }
        }

        // Verify coach exists
        const coachCheck = await pool.request()
            .input('CoachID', coachId)
            .query(`
                SELECT UserID 
                FROM Users 
                WHERE UserID = @CoachID AND Role = 'coach' AND IsActive = 1
            `);

        if (coachCheck.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy coach'
            });
        }

        // Insert feedback
        const result = await pool.request()
            .input('CoachID', coachId)
            .input('MemberID', userId)
            .input('AppointmentID', appointmentId || null)
            .input('Rating', rating)
            .input('Comment', comment || null)
            .input('Categories', categories ? JSON.stringify(categories) : null)
            .input('IsAnonymous', isAnonymous || false)
            .query(`
                INSERT INTO CoachFeedback (
                    CoachID, MemberID, AppointmentID, Rating, Comment, 
                    Categories, IsAnonymous, Status, CreatedAt, UpdatedAt
                )
                OUTPUT INSERTED.FeedbackID, INSERTED.CoachID, INSERTED.Rating, INSERTED.CreatedAt
                VALUES (
                    @CoachID, @MemberID, @AppointmentID, @Rating, @Comment,
                    @Categories, @IsAnonymous, 'active', GETDATE(), GETDATE()
                )
            `);

        const feedback = result.recordset[0];

        console.log('✅ Feedback submitted successfully:', feedback);

        res.status(201).json({
            success: true,
            data: {
                feedbackId: feedback.FeedbackID,
                coachId: feedback.CoachID,
                rating: feedback.Rating,
                createdAt: feedback.CreatedAt
            },
            message: 'Cảm ơn bạn đã đánh giá! Phản hồi của bạn sẽ giúp cải thiện dịch vụ.'
        });

    } catch (error) {
        console.error('❌ Error submitting feedback:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi gửi đánh giá. Vui lòng thử lại.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Error handler for all routes
router.use((error, req, res, next) => {
    console.error('🚨 Chat route error:', error);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
});

// Kiểm tra trạng thái phân công coach cho member
router.get('/member/coach-assignment-status', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.UserID;
        const userRole = req.user.Role;

        console.log('🔍 Check coach assignment status - UserID:', userId, 'Role:', userRole);

        if (userRole !== 'member' && userRole !== 'guest') {
            return res.status(403).json({
                success: false,
                message: 'Chỉ member mới có thể kiểm tra trạng thái phân công coach'
            });
        }

        // Kiểm tra coach được phân công
        const assignmentResult = await pool.request()
            .input('userId', userId)
            .query(`
                SELECT 
                    qp.PlanID,
                    qp.CoachID,
                    qp.Status as QuitPlanStatus,
                    qp.StartDate as AssignmentDate,
                    c.FirstName + ' ' + c.LastName as CoachName,
                    c.Email as CoachEmail,
                    c.Avatar as CoachAvatar,
                    cp.Specialization,
                    cp.IsAvailable
                FROM QuitPlans qp
                INNER JOIN Users c ON qp.CoachID = c.UserID
                LEFT JOIN CoachProfiles cp ON c.UserID = cp.UserID
                WHERE qp.UserID = @userId 
                    AND qp.Status = 'active'
                    AND c.Role = 'coach'
                    AND c.IsActive = 1
            `);

        if (assignmentResult.recordset.length === 0) {
            return res.json({
                success: true,
                hasAssignedCoach: false,
                message: 'Chưa được phân công coach nào',
                data: null
            });
        }

        const coachData = assignmentResult.recordset[0];
        return res.json({
            success: true,
            hasAssignedCoach: true,
            message: 'Đã được phân công coach',
            data: {
                planId: coachData.PlanID,
                coachId: coachData.CoachID,
                coachName: coachData.CoachName,
                coachEmail: coachData.CoachEmail,
                coachAvatar: coachData.CoachAvatar,
                specialization: coachData.Specialization,
                isAvailable: coachData.IsAvailable,
                assignmentDate: coachData.AssignmentDate,
                quitPlanStatus: coachData.QuitPlanStatus
            }
        });

    } catch (error) {
        console.error('Error checking coach assignment status:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi kiểm tra trạng thái phân công coach',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Test endpoint to verify server is using updated code
router.get('/test-updated', authenticateToken, (req, res) => {
    console.log('🧪 Test updated endpoint called - CODE IS UPDATED!');
    res.json({
        success: true,
        message: 'Server is using updated code!',
        timestamp: new Date().toISOString(),
        user: req.user
    });
});

module.exports = router; 
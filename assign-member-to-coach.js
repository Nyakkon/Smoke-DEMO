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

async function assignMemberToCoach() {
    let pool = null;
    try {
        console.log('🔗 Connecting to database...');
        pool = await sql.connect(config);
        console.log('✅ Database connected');

        // Find the new coach (UserID 7)
        const coachId = 7;
        console.log(`👨‍⚕️ Using Coach ID: ${coachId}`);

        // Find a member to assign
        const memberResult = await pool.request()
            .query(`
                SELECT TOP 1 UserID, FirstName, LastName, Email 
                FROM Users 
                WHERE Role IN ('member', 'guest') AND IsActive = 1
                ORDER BY UserID
            `);

        if (memberResult.recordset.length === 0) {
            console.log('❌ No members found to assign');
            return;
        }

        const member = memberResult.recordset[0];
        console.log(`👤 Found member: ${member.FirstName} ${member.LastName} (${member.Email})`);

        // Check if already assigned
        const existingPlan = await pool.request()
            .input('memberId', member.UserID)
            .input('coachId', coachId)
            .query(`
                SELECT PlanID FROM QuitPlans 
                WHERE UserID = @memberId AND CoachID = @coachId AND Status = 'active'
            `);

        if (existingPlan.recordset.length > 0) {
            console.log('✅ Member already assigned to this coach');
            return;
        }

        // Create QuitPlan to assign member to coach
        const planResult = await pool.request()
            .input('memberId', member.UserID)
            .input('coachId', coachId)
            .query(`
                INSERT INTO QuitPlans (
                    UserID, CoachID, Status, StartDate, TargetDate, MotivationLevel, 
                    CreatedAt
                )
                OUTPUT INSERTED.PlanID
                VALUES (
                    @memberId, @coachId, 'active', GETDATE(), DATEADD(month, 3, GETDATE()), 7,
                    GETDATE()
                )
            `);

        const planId = planResult.recordset[0].PlanID;
        console.log(`✅ Created QuitPlan ${planId} - Assigned member ${member.UserID} to coach ${coachId}`);

        // Create conversation
        const convResult = await pool.request()
            .input('coachId', coachId)
            .input('memberId', member.UserID)
            .query(`
                INSERT INTO Conversations (CoachID, MemberID, LastMessageAt, IsActive)
                OUTPUT INSERTED.ConversationID
                VALUES (@coachId, @memberId, GETDATE(), 1)
            `);

        const conversationId = convResult.recordset[0].ConversationID;
        console.log(`✅ Created conversation ${conversationId}`);

        // Add welcome message
        await pool.request()
            .input('senderId', coachId)
            .input('receiverId', member.UserID)
            .input('content', `Xin chào ${member.FirstName}! Tôi là coach được phân công hỗ trợ bạn cai thuốc. Hãy cho tôi biết nếu bạn cần hỗ trợ gì nhé!`)
            .query(`
                INSERT INTO Messages (SenderID, ReceiverID, Content, MessageType, IsRead)
                VALUES (@senderId, @receiverId, @content, 'text', 0)
            `);

        console.log('✅ Added welcome message');
        console.log('\n🎉 Assignment completed successfully!');
        console.log(`Coach ${coachId} now has member ${member.UserID} assigned`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

assignMemberToCoach(); 
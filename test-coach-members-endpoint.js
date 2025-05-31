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

async function testCoachMembersEndpoint() {
    let pool = null;
    try {
        console.log('🔍 TESTING COACH MEMBERS ENDPOINT QUERY');
        console.log('======================================\n');

        // Connect to database
        console.log('🔗 Connecting to database...');
        pool = await sql.connect(config);
        console.log('✅ Database connected');

        // Get coach ID (Coach Smith)
        const coachId = 3; // From previous check
        console.log(`👨‍⚕️ Testing with Coach ID: ${coachId} (Coach Smith)`);

        // Test the exact query from endpoint
        const exactQuery = `
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

        console.log('🔄 Executing query...');
        const result = await pool.request()
            .input('coachId', coachId)
            .query(exactQuery);

        console.log(`✅ Query executed successfully!`);
        console.log(`📊 Found ${result.recordset.length} members for coach`);

        if (result.recordset.length > 0) {
            console.log('\n👥 Members found:');
            result.recordset.forEach((member, index) => {
                console.log(`${index + 1}. ${member.FullName} (${member.Email})`);
                console.log(`   - User ID: ${member.UserID}`);
                console.log(`   - Role: ${member.Role}`);
                console.log(`   - Has conversation: ${member.HasConversation ? 'Yes' : 'No'}`);
                console.log(`   - Quit plan status: ${member.QuitPlanStatus}`);
                console.log(`   - Assignment date: ${member.AssignmentDate ? new Date(member.AssignmentDate).toLocaleDateString('vi-VN') : 'N/A'}`);
                console.log(`   - Unread messages: ${member.UnreadCount}`);
                console.log(`   - Last activity: ${member.LastActivity ? new Date(member.LastActivity).toLocaleDateString('vi-VN') : 'N/A'}`);
                console.log('');
            });

            console.log('✅ The query works perfectly! The API should return this data.');
            console.log('\n🔧 Simulating API response:');
            console.log(JSON.stringify({
                success: true,
                data: result.recordset
            }, null, 2));
        } else {
            console.log('❌ No members found for this coach');
        }

        return true;

    } catch (error) {
        console.error('❌ Error:', error);
        console.error('❌ SQL Error Details:', error.message);
        return false;
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

// Run the test
testCoachMembersEndpoint(); 
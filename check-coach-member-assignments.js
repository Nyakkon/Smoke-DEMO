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

async function checkCoachMemberAssignments() {
    let pool = null;
    try {
        console.log('🔍 CHECKING COACH-MEMBER ASSIGNMENTS');
        console.log('====================================\n');

        // Connect to database
        console.log('🔗 Connecting to database...');
        pool = await sql.connect(config);
        console.log('✅ Database connected');

        // Check coaches
        console.log('\n👨‍⚕️ Available coaches:');
        const coachesQuery = `
            SELECT UserID, FirstName, LastName, Email, IsActive
            FROM Users
            WHERE Role = 'coach'
            ORDER BY FirstName
        `;

        const coaches = await pool.request().query(coachesQuery);
        if (coaches.recordset.length > 0) {
            coaches.recordset.forEach((coach, index) => {
                const status = coach.IsActive ? '✅ Active' : '❌ Inactive';
                console.log(`${index + 1}. ${coach.FirstName} ${coach.LastName} (ID: ${coach.UserID}) - ${coach.Email} ${status}`);
            });
        } else {
            console.log('❌ No coaches found');
        }

        // Check members
        console.log('\n👥 Available members:');
        const membersQuery = `
            SELECT UserID, FirstName, LastName, Email, Role, IsActive
            FROM Users
            WHERE Role IN ('member', 'guest')
            ORDER BY FirstName
        `;

        const members = await pool.request().query(membersQuery);
        if (members.recordset.length > 0) {
            members.recordset.forEach((member, index) => {
                const status = member.IsActive ? '✅ Active' : '❌ Inactive';
                console.log(`${index + 1}. ${member.FirstName} ${member.LastName} (ID: ${member.UserID}) - ${member.Email} [${member.Role}] ${status}`);
            });
        } else {
            console.log('❌ No members found');
        }

        // Check quit plans
        console.log('\n📋 Quit plans:');
        const quitPlansQuery = `
            SELECT 
                qp.PlanID,
                qp.UserID,
                qp.CoachID,
                qp.Status,
                qp.StartDate,
                qp.TargetDate,
                qp.CreatedAt,
                u.FirstName + ' ' + u.LastName as MemberName,
                u.Email as MemberEmail,
                c.FirstName + ' ' + c.LastName as CoachName,
                c.Email as CoachEmail
            FROM QuitPlans qp
            JOIN Users u ON qp.UserID = u.UserID
            LEFT JOIN Users c ON qp.CoachID = c.UserID
            ORDER BY qp.CreatedAt DESC
        `;

        const quitPlans = await pool.request().query(quitPlansQuery);
        if (quitPlans.recordset.length > 0) {
            console.log(`Found ${quitPlans.recordset.length} quit plans:`);
            quitPlans.recordset.forEach((plan, index) => {
                const startDate = plan.StartDate ? new Date(plan.StartDate).toLocaleDateString('vi-VN') : 'N/A';
                const coachInfo = plan.CoachName ? `${plan.CoachName} (${plan.CoachEmail})` : 'No coach assigned';
                console.log(`${index + 1}. ${plan.MemberName} → ${coachInfo}`);
                console.log(`   Status: ${plan.Status}, Start: ${startDate}, Plan ID: ${plan.PlanID}`);
            });
        } else {
            console.log('❌ No quit plans found');
        }

        // Check active assignments specifically for each coach
        if (coaches.recordset.length > 0) {
            for (const coach of coaches.recordset) {
                console.log(`\n📊 Active assignments for ${coach.FirstName} ${coach.LastName} (ID: ${coach.UserID}):`);

                const assignmentsQuery = `
                    SELECT 
                        u.UserID,
                        u.FirstName + ' ' + u.LastName as FullName,
                        u.Email,
                        u.Role,
                        u.IsActive,
                        qp.Status as QuitPlanStatus,
                        qp.StartDate,
                        qp.PlanID
                    FROM QuitPlans qp
                    JOIN Users u ON qp.UserID = u.UserID
                    WHERE qp.CoachID = ${coach.UserID}
                        AND qp.Status = 'active'
                        AND u.Role IN ('member', 'guest')
                        AND u.IsActive = 1
                    ORDER BY qp.StartDate DESC
                `;

                const assignments = await pool.request().query(assignmentsQuery);
                if (assignments.recordset.length > 0) {
                    console.log(`   ✅ Found ${assignments.recordset.length} active assignments:`);
                    assignments.recordset.forEach((assignment, idx) => {
                        const startDate = assignment.StartDate ? new Date(assignment.StartDate).toLocaleDateString('vi-VN') : 'N/A';
                        console.log(`   ${idx + 1}. ${assignment.FullName} (${assignment.Email}) [${assignment.Role}] - Plan ID: ${assignment.PlanID}, Start: ${startDate}`);
                    });
                } else {
                    console.log('   ❌ No active assignments for this coach');
                }
            }
        }

        // Show the exact query being used in chat.routes.js
        console.log('\n🔍 Testing the exact query from chat.routes.js:');
        if (coaches.recordset.length > 0) {
            const testCoachId = coaches.recordset[0].UserID; // Use first coach
            console.log(`Using coach ID: ${testCoachId} (${coaches.recordset[0].FirstName} ${coaches.recordset[0].LastName})`);

            const chatQuery = `
                SELECT DISTINCT
                    u.UserID,
                    u.FirstName + ' ' + u.LastName as FullName,
                    u.Email,
                    u.Avatar,
                    u.Role,
                    u.IsActive,
                    c.ConversationID,
                    CASE WHEN c.ConversationID IS NOT NULL THEN 1 ELSE 0 END as HasConversation,
                    qp_latest.Status as QuitPlanStatus,
                    qp_latest.StartDate as AssignmentDate,
                    qp_latest.MotivationLevel
                FROM Users u
                INNER JOIN (
                    SELECT qp.*,
                           ROW_NUMBER() OVER (PARTITION BY qp.UserID ORDER BY qp.CreatedAt DESC) as rn
                    FROM QuitPlans qp
                    WHERE qp.CoachID = ${testCoachId} AND qp.Status = 'active'
                ) qp_latest ON u.UserID = qp_latest.UserID AND qp_latest.rn = 1
                LEFT JOIN Conversations c ON u.UserID = c.MemberID AND c.CoachID = ${testCoachId}
                WHERE u.Role IN ('member', 'guest') AND u.IsActive = 1
                ORDER BY c.LastMessageAt DESC, qp_latest.StartDate DESC, u.FirstName, u.LastName
            `;

            const chatResult = await pool.request().query(chatQuery);
            console.log(`Result: ${chatResult.recordset.length} members found`);
            if (chatResult.recordset.length > 0) {
                chatResult.recordset.forEach((member, idx) => {
                    console.log(`   ${idx + 1}. ${member.FullName} (${member.Email}) - Plan: ${member.QuitPlanStatus}`);
                });
            }
        }

        console.log('\n✅ Analysis completed!');
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

// Run the check
checkCoachMemberAssignments(); 
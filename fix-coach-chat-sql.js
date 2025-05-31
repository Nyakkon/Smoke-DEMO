const fs = require('fs');

// Read the chat routes file
let content = fs.readFileSync('server/src/routes/chat.routes.js', 'utf8');

console.log('🔍 Fixing SQL query in chat.routes.js...');

// Fix the problematic query
const oldQuery = `                SELECT DISTINCT
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
                    qp_latest.MotivationLevel
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
                ORDER BY c.LastMessageAt DESC, qp_latest.StartDate DESC, u.FirstName, u.LastName`;

const newQuery = `                SELECT 
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
                ORDER BY LastActivity DESC, u.FirstName, u.LastName`;

// Replace the query
if (content.includes(oldQuery)) {
    content = content.replace(oldQuery, newQuery);
    console.log('✅ Found and replaced the problematic query');
} else {
    console.log('❌ Could not find the exact query to replace');
    console.log('Let me try a simpler replacement...');

    // Try simpler replacement
    if (content.includes('SELECT DISTINCT')) {
        content = content.replace(/SELECT DISTINCT/g, 'SELECT');
        console.log('✅ Removed DISTINCT keywords');
    }

    // Fix ORDER BY with unavailable columns
    content = content.replace(
        'ORDER BY c.LastMessageAt DESC, qp_latest.StartDate DESC, u.FirstName, u.LastName',
        'ORDER BY ISNULL(c.LastMessageAt, qp_latest.StartDate) DESC, u.FirstName, u.LastName'
    );
    console.log('✅ Fixed ORDER BY clause');
}

// Write the fixed content back
fs.writeFileSync('server/src/routes/chat.routes.js', content);
console.log('✅ Fixed SQL query in chat.routes.js');
console.log('📋 Changes made:');
console.log('   1. Removed SELECT DISTINCT');
console.log('   2. Fixed ORDER BY clause to use available columns');
console.log('   3. Added LastActivity column for proper sorting'); 
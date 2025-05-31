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

async function checkUsers() {
    let pool = null;
    try {
        console.log('🔍 CHECKING USERS IN DATABASE');
        console.log('==============================\n');

        // Connect to database
        console.log('🔗 Connecting to database...');
        pool = await sql.connect(config);
        console.log('✅ Database connected');

        // Check all users
        console.log('\n👥 All users:');
        const usersQuery = `
            SELECT 
                UserID,
                FirstName,
                LastName,
                Email,
                Role,
                IsActive,
                CreatedAt
            FROM Users
            ORDER BY Role, FirstName
        `;

        const users = await pool.request().query(usersQuery);

        if (users.recordset.length > 0) {
            console.log(`Found ${users.recordset.length} users:`);
            users.recordset.forEach((user, index) => {
                const fullName = `${user.FirstName} ${user.LastName}`;
                const status = user.IsActive ? '✅ Active' : '❌ Inactive';
                console.log(`${index + 1}. ${fullName} (${user.Email}) - ${user.Role} ${status}`);
            });

            // Show member users specifically
            const members = users.recordset.filter(u => u.Role === 'member');
            console.log(`\n📋 Member users (${members.length}):`);
            members.forEach((member, index) => {
                console.log(`${index + 1}. ${member.FirstName} ${member.LastName} - ${member.Email}`);
            });

            // Show first member's progress data
            if (members.length > 0) {
                const firstMember = members[0];
                console.log(`\n📊 Progress data for ${firstMember.FirstName} ${firstMember.LastName}:`);

                const progressQuery = `
                    SELECT TOP 5 *
                    FROM ProgressTracking
                    WHERE UserID = ${firstMember.UserID}
                    ORDER BY Date DESC
                `;

                const progress = await pool.request().query(progressQuery);
                if (progress.recordset.length > 0) {
                    console.log(`   Found ${progress.recordset.length} progress records:`);
                    progress.recordset.forEach((record, index) => {
                        const date = new Date(record.Date).toLocaleDateString('vi-VN');
                        console.log(`   ${index + 1}. ${date}: ${record.CigarettesSmoked || 0} cigarettes, craving ${record.CravingLevel || 0}/10`);
                    });
                } else {
                    console.log('   No progress data found');
                }

                // Check achievements
                const achievementsQuery = `
                    SELECT 
                        ua.EarnedAt,
                        a.Name,
                        a.Description,
                        a.IconURL
                    FROM UserAchievements ua
                    JOIN Achievements a ON ua.AchievementID = a.AchievementID
                    WHERE ua.UserID = ${firstMember.UserID}
                    ORDER BY ua.EarnedAt DESC
                `;

                const achievements = await pool.request().query(achievementsQuery);
                console.log(`\n🏆 Achievements for ${firstMember.FirstName} ${firstMember.LastName}:`);
                if (achievements.recordset.length > 0) {
                    console.log(`   Found ${achievements.recordset.length} achievements:`);
                    achievements.recordset.forEach((ach, index) => {
                        const earnedDate = new Date(ach.EarnedAt).toLocaleDateString('vi-VN');
                        console.log(`   ${index + 1}. ${ach.IconURL} ${ach.Name} - ${earnedDate}`);
                    });
                } else {
                    console.log('   No achievements found');
                }
            }

        } else {
            console.log('❌ No users found in database');
        }

        console.log('\n✅ Users check completed!');
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
checkUsers(); 
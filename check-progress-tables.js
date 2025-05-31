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

async function checkProgressTables() {
    let pool = null;
    try {
        console.log('🔍 CHECKING PROGRESS TRACKING TABLES');
        console.log('=====================================\n');

        // Connect to database
        console.log('🔗 Connecting to database...');
        pool = await sql.connect(config);
        console.log('✅ Database connected');

        const progressTables = ['ProgressTracking', 'SmokingStatus', 'QuitPlans', 'UserAchievements', 'Achievements'];

        for (const tableName of progressTables) {
            console.log(`\n📋 Table: ${tableName}`);
            console.log(''.padEnd(50, '-'));

            // Get columns
            const columnsQuery = `
                SELECT 
                    COLUMN_NAME,
                    DATA_TYPE,
                    IS_NULLABLE,
                    CHARACTER_MAXIMUM_LENGTH,
                    COLUMN_DEFAULT
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = '${tableName}'
                ORDER BY ORDINAL_POSITION
            `;

            const columns = await pool.request().query(columnsQuery);
            console.log('📊 Columns:');
            columns.recordset.forEach(col => {
                const maxLength = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : '';
                const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
                console.log(`   - ${col.COLUMN_NAME}: ${col.DATA_TYPE}${maxLength} ${nullable}`);
            });

            // Get row count
            const countQuery = `SELECT COUNT(*) as count FROM ${tableName}`;
            const count = await pool.request().query(countQuery);
            console.log(`📈 Records: ${count.recordset[0].count}`);

            // Show sample data if available
            if (count.recordset[0].count > 0) {
                const sampleQuery = `SELECT TOP 3 * FROM ${tableName} ORDER BY 1 DESC`;
                const sample = await pool.request().query(sampleQuery);
                console.log('🔬 Sample data:');
                sample.recordset.forEach((row, index) => {
                    console.log(`   ${index + 1}. ${JSON.stringify(row, null, 2)}`);
                });
            }
        }

        // Check for specific member's progress data
        console.log('\n🔍 Checking specific member progress data...');
        const memberProgressQuery = `
            SELECT TOP 5 
                pt.*,
                u.FirstName,
                u.LastName,
                u.Email
            FROM ProgressTracking pt
            JOIN Users u ON pt.UserID = u.UserID
            WHERE u.Role = 'member'
            ORDER BY pt.Date DESC
        `;

        try {
            const memberProgress = await pool.request().query(memberProgressQuery);
            if (memberProgress.recordset.length > 0) {
                console.log('📈 Recent member progress data:');
                memberProgress.recordset.forEach((row, index) => {
                    console.log(`   ${index + 1}. ${row.FirstName} ${row.LastName} - Date: ${row.Date}, Cigarettes: ${row.CigarettesSmoked || 'N/A'}`);
                });
            } else {
                console.log('❌ No member progress data found');
            }
        } catch (error) {
            console.log('❌ Error checking member progress:', error.message);
        }

        // Check smoking status
        console.log('\n🚬 Checking smoking status data...');
        const smokingStatusQuery = `
            SELECT TOP 5 
                ss.*,
                u.FirstName,
                u.LastName
            FROM SmokingStatus ss
            JOIN Users u ON ss.UserID = u.UserID
            WHERE u.Role = 'member'
        `;

        try {
            const smokingStatus = await pool.request().query(smokingStatusQuery);
            if (smokingStatus.recordset.length > 0) {
                console.log('🚬 Member smoking status:');
                smokingStatus.recordset.forEach((row, index) => {
                    console.log(`   ${index + 1}. ${row.FirstName} ${row.LastName} - Start: ${row.QuitStartDate}, Per Day: ${row.CigarettesPerDay || 'N/A'}`);
                });
            } else {
                console.log('❌ No smoking status data found');
            }
        } catch (error) {
            console.log('❌ Error checking smoking status:', error.message);
        }

        console.log('\n✅ Progress tables check completed!');
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
checkProgressTables(); 
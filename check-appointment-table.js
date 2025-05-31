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

async function checkAppointmentTable() {
    let pool = null;
    try {
        console.log('🔍 CHECKING APPOINTMENT TABLE STRUCTURE');
        console.log('======================================\n');

        // Connect to database
        console.log('🔗 Connecting to database...');
        pool = await sql.connect(config);
        console.log('✅ Database connected');

        // List all tables
        console.log('\n📋 Listing all tables in database...');
        const tablesQuery = `
            SELECT 
                TABLE_NAME,
                TABLE_TYPE
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_NAME
        `;

        const tables = await pool.request().query(tablesQuery);
        console.log('📊 Available tables:');
        tables.recordset.forEach(table => {
            console.log(`   - ${table.TABLE_NAME}`);
        });

        // Look for appointment-related tables
        console.log('\n🔍 Looking for appointment-related tables...');
        const appointmentTables = tables.recordset.filter(table =>
            table.TABLE_NAME.toLowerCase().includes('appointment') ||
            table.TABLE_NAME.toLowerCase().includes('schedule') ||
            table.TABLE_NAME.toLowerCase().includes('booking')
        );

        if (appointmentTables.length > 0) {
            console.log('📅 Found appointment-related tables:');
            for (const table of appointmentTables) {
                console.log(`\n   Table: ${table.TABLE_NAME}`);

                // Get columns for this table
                const columnsQuery = `
                    SELECT 
                        COLUMN_NAME,
                        DATA_TYPE,
                        IS_NULLABLE,
                        COLUMN_DEFAULT
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_NAME = '${table.TABLE_NAME}'
                    ORDER BY ORDINAL_POSITION
                `;

                const columns = await pool.request().query(columnsQuery);
                console.log('     Columns:');
                columns.recordset.forEach(col => {
                    console.log(`       - ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
                });

                // Check if table has data
                const countQuery = `SELECT COUNT(*) as count FROM ${table.TABLE_NAME}`;
                const count = await pool.request().query(countQuery);
                console.log(`     Records: ${count.recordset[0].count}`);
            }
        } else {
            console.log('❌ No appointment-related tables found');
        }

        // Also check for coach-related queries in server code
        console.log('\n🔍 Checking if there might be other related tables...');

        // Check for any table that might store coach/member relationships
        const relationshipTables = tables.recordset.filter(table =>
            table.TABLE_NAME.toLowerCase().includes('coach') ||
            table.TABLE_NAME.toLowerCase().includes('member') ||
            table.TABLE_NAME.toLowerCase().includes('assignment')
        );

        if (relationshipTables.length > 0) {
            console.log('👥 Found coach/member related tables:');
            relationshipTables.forEach(table => {
                console.log(`   - ${table.TABLE_NAME}`);
            });
        }

        console.log('\n✅ Table structure check completed!');
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
checkAppointmentTable(); 
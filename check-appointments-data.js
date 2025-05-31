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

async function checkAppointmentsData() {
    let pool = null;
    try {
        console.log('🔍 CHECKING CONSULTATION APPOINTMENTS DATA');
        console.log('==========================================\n');

        // Connect to database
        console.log('🔗 Connecting to database...');
        pool = await sql.connect(config);
        console.log('✅ Database connected');

        // Check total count
        console.log('\n📊 Checking total appointments count...');
        const countQuery = `SELECT COUNT(*) as count FROM ConsultationAppointments`;
        const count = await pool.request().query(countQuery);
        console.log(`Total appointments: ${count.recordset[0].count}`);

        if (count.recordset[0].count > 0) {
            // Get all appointments data
            console.log('\n📅 All appointments data:');
            const allAppointmentsQuery = `
                SELECT 
                    ca.AppointmentID,
                    ca.CoachID,
                    ca.MemberID,
                    ca.AppointmentDate,
                    ca.Duration,
                    ca.Type,
                    ca.Status,
                    ca.Notes,
                    ca.CreatedAt,
                    u.FirstName,
                    u.LastName,
                    u.Email,
                    c.FirstName as CoachFirstName,
                    c.LastName as CoachLastName
                FROM ConsultationAppointments ca
                LEFT JOIN Users u ON ca.MemberID = u.UserID
                LEFT JOIN Users c ON ca.CoachID = c.UserID
                ORDER BY ca.AppointmentDate DESC
            `;

            const allAppointments = await pool.request().query(allAppointmentsQuery);

            console.log(`Found ${allAppointments.recordset.length} appointment records:`);
            allAppointments.recordset.forEach((apt, index) => {
                const date = apt.AppointmentDate ? new Date(apt.AppointmentDate).toLocaleString('vi-VN') : 'N/A';
                const memberName = apt.FirstName && apt.LastName ? `${apt.FirstName} ${apt.LastName}` : 'Unknown Member';
                const coachName = apt.CoachFirstName && apt.CoachLastName ? `${apt.CoachFirstName} ${apt.CoachLastName}` : 'Unknown Coach';

                console.log(`${index + 1}. ID: ${apt.AppointmentID}`);
                console.log(`   Member: ${memberName} (ID: ${apt.MemberID})`);
                console.log(`   Coach: ${coachName} (ID: ${apt.CoachID})`);
                console.log(`   Date: ${date}`);
                console.log(`   Duration: ${apt.Duration} minutes`);
                console.log(`   Type: ${apt.Type}`);
                console.log(`   Status: ${apt.Status}`);
                console.log('   ---');
            });

            // Check for duplicates by ID
            const appointmentIds = allAppointments.recordset.map(apt => apt.AppointmentID);
            const uniqueIds = [...new Set(appointmentIds)];

            console.log(`\n🔍 Duplicate check:`);
            console.log(`Total records: ${appointmentIds.length}`);
            console.log(`Unique IDs: ${uniqueIds.length}`);
            console.log(`Status: ${appointmentIds.length === uniqueIds.length ? '✅ NO DUPLICATES' : '❌ DUPLICATES FOUND'}`);

            // Check available coach IDs
            console.log('\n👨‍⚕️ Available coach IDs in appointments:');
            const coachIds = [...new Set(allAppointments.recordset.map(apt => apt.CoachID))];
            coachIds.forEach(coachId => {
                const coachAppointments = allAppointments.recordset.filter(apt => apt.CoachID === coachId);
                const coachName = coachAppointments[0]?.CoachFirstName && coachAppointments[0]?.CoachLastName
                    ? `${coachAppointments[0].CoachFirstName} ${coachAppointments[0].CoachLastName}`
                    : 'Unknown';
                console.log(`   Coach ID ${coachId} (${coachName}): ${coachAppointments.length} appointments`);
            });

        } else {
            console.log('\n❌ No appointments found in ConsultationAppointments table');

            // Check if the frontend is using mock data or different source
            console.log('\n🔍 Checking Users table for coaches...');
            const coachesQuery = `
                SELECT UserID, FirstName, LastName, Email, Role 
                FROM Users 
                WHERE Role = 'coach'
            `;
            const coaches = await pool.request().query(coachesQuery);

            if (coaches.recordset.length > 0) {
                console.log(`Found ${coaches.recordset.length} coaches:`);
                coaches.recordset.forEach(coach => {
                    console.log(`   - ID: ${coach.UserID}, Name: ${coach.FirstName} ${coach.LastName}, Email: ${coach.Email}`);
                });
            } else {
                console.log('   No coaches found in Users table');
            }
        }

        console.log('\n✅ Appointments data check completed!');
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
checkAppointmentsData(); 
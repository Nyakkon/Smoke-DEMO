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

async function testAppointmentDuplicates() {
    let pool = null;
    try {
        console.log('🔍 TESTING APPOINTMENT DUPLICATES FIX');
        console.log('=====================================\n');

        // Connect to database
        console.log('🔗 Connecting to database...');
        pool = await sql.connect(config);
        console.log('✅ Database connected');

        // Test coach appointments API data
        console.log('\n📅 Testing coach appointments data...');

        // Query similar to coach appointments API
        const appointmentsQuery = `
            SELECT DISTINCT
                ca.AppointmentID as id,
                ca.MemberID,
                ca.CoachID,
                ca.AppointmentDate as appointmentDate,
                ca.Duration as duration,
                ca.Type as type,
                ca.Status as status,
                ca.Notes as notes,
                ca.MeetingLink as meetingLink,
                ca.CreatedAt,
                u.FirstName,
                u.LastName,
                u.Email,
                CONCAT(u.FirstName, ' ', u.LastName) as fullName
            FROM ConsultationAppointments ca
            JOIN Users u ON ca.MemberID = u.UserID
            WHERE ca.CoachID = 2  -- Assuming coach ID 2
            ORDER BY ca.AppointmentDate DESC
        `;

        const appointments = await pool.request().query(appointmentsQuery);

        console.log(`📊 Total appointments found: ${appointments.recordset.length}`);

        // Check for duplicates by AppointmentID
        const appointmentIds = appointments.recordset.map(apt => apt.id);
        const uniqueIds = [...new Set(appointmentIds)];

        console.log(`🆔 Unique appointment IDs: ${uniqueIds.length}`);
        console.log(`🔍 Duplicate check: ${appointmentIds.length === uniqueIds.length ? '✅ NO DUPLICATES' : '❌ DUPLICATES FOUND'}`);

        if (appointmentIds.length !== uniqueIds.length) {
            console.log('\n❌ Duplicate appointments found:');
            const duplicates = appointmentIds.filter((id, index) => appointmentIds.indexOf(id) !== index);
            duplicates.forEach(duplicateId => {
                const duplicateAppointments = appointments.recordset.filter(apt => apt.id === duplicateId);
                console.log(`   Appointment ID ${duplicateId}: found ${duplicateAppointments.length} times`);
            });
        }

        // Show appointments by member
        console.log('\n📋 Appointments by member:');
        const appointmentsByMember = {};
        appointments.recordset.forEach(apt => {
            const memberKey = `${apt.MemberID} (${apt.fullName})`;
            if (!appointmentsByMember[memberKey]) {
                appointmentsByMember[memberKey] = [];
            }
            appointmentsByMember[memberKey].push(apt);
        });

        Object.entries(appointmentsByMember).forEach(([memberKey, memberAppointments]) => {
            console.log(`   ${memberKey}: ${memberAppointments.length} appointments`);
            memberAppointments.forEach(apt => {
                const date = new Date(apt.appointmentDate).toLocaleString('vi-VN');
                console.log(`     - ${date} (${apt.duration}min, ${apt.status})`);
            });
        });

        // Test for a specific problematic member if any
        console.log('\n🔍 Checking for "Tran Huy" appointments...');
        const tranHuyAppointments = appointments.recordset.filter(apt =>
            apt.fullName && apt.fullName.toLowerCase().includes('tran huy')
        );

        if (tranHuyAppointments.length > 0) {
            console.log(`   Found ${tranHuyAppointments.length} appointments for Tran Huy:`);
            tranHuyAppointments.forEach(apt => {
                const date = new Date(apt.appointmentDate).toLocaleString('vi-VN');
                console.log(`     - ID: ${apt.id}, Date: ${date}, Duration: ${apt.duration}min, Status: ${apt.status}`);
            });

            // Check for exact duplicates
            const exactDuplicates = tranHuyAppointments.filter((apt, index, array) =>
                array.findIndex(other =>
                    other.appointmentDate === apt.appointmentDate &&
                    other.duration === apt.duration &&
                    other.status === apt.status
                ) !== index
            );

            if (exactDuplicates.length > 0) {
                console.log('   ❌ Found exact duplicate appointments for Tran Huy!');
            } else {
                console.log('   ✅ No exact duplicates found for Tran Huy');
            }
        } else {
            console.log('   No appointments found for "Tran Huy"');
        }

        console.log('\n✅ Appointment duplicate test completed!');
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

// Run the test
testAppointmentDuplicates(); 
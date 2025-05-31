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

async function fixMembershipPlans() {
    let pool = null;
    try {
        console.log('🔧 FIXING MEMBERSHIP PLANS');
        console.log('=========================\n');

        // Connect to database
        console.log('🔗 Connecting to database...');
        pool = await sql.connect(config);
        console.log('✅ Database connected');

        // 1. Check if MembershipPlans table exists
        console.log('🔍 Checking MembershipPlans table...');
        const tableCheck = await pool.request().query(`
            SELECT COUNT(*) as tableExists 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = 'MembershipPlans'
        `);

        if (tableCheck.recordset[0].tableExists === 0) {
            console.log('📋 Creating MembershipPlans table...');
            await pool.request().query(`
                CREATE TABLE MembershipPlans (
                    PlanID INT IDENTITY(1,1) PRIMARY KEY,
                    Name NVARCHAR(255) NOT NULL,
                    Description NVARCHAR(MAX),
                    Price DECIMAL(10,2) NOT NULL,
                    Duration INT NOT NULL, -- in days
                    Features NVARCHAR(MAX),
                    IsActive BIT DEFAULT 1,
                    CreatedAt DATETIME DEFAULT GETDATE()
                )
            `);
            console.log('✅ MembershipPlans table created');
        }

        // 2. Check existing plans
        const existingPlans = await pool.request().query(`
            SELECT PlanID, Name, Description, Price, Duration
            FROM MembershipPlans
            ORDER BY PlanID
        `);

        console.log(`📋 Found ${existingPlans.recordset.length} existing plans:`);
        existingPlans.recordset.forEach(plan => {
            console.log(`  - ID: ${plan.PlanID}, Name: ${plan.Name}, Price: ${plan.Price}`);
        });

        // 3. Create default plans if none exist
        if (existingPlans.recordset.length === 0) {
            console.log('📝 Creating default membership plans...');

            await pool.request().query(`
                INSERT INTO MembershipPlans (Name, Description, Price, Duration, Features) VALUES
                (N'Basic Plan', N'Kế hoạch cơ bản với hỗ trợ căn bản', 99000, 30, N'• Kế hoạch mẫu 3 tuần\n• Hỗ trợ chat cơ bản\n• Theo dõi tiến trình'),
                (N'Premium Plan', N'Kế hoạch cao cấp với hỗ trợ chuyên sâu', 299000, 60, N'• Kế hoạch mẫu 8 tuần chi tiết\n• Hỗ trợ coach chuyên nghiệp\n• Theo dõi sức khỏe\n• Tư vấn tâm lý'),
                (N'Pro Plan', N'Kế hoạch chuyên nghiệp toàn diện', 599000, 90, N'• Kế hoạch mẫu 12 tuần\n• Coach 1-on-1\n• Theo dõi sức khỏe 24/7\n• Liệu pháp chuyên sâu\n• Hỗ trợ cộng đồng')
            `);

            console.log('✅ Default plans created');
        } else {
            console.log('✅ Plans already exist');

            // Check if Premium Plan exists (most important for templates)
            const premiumPlan = existingPlans.recordset.find(plan =>
                plan.Name.includes('Premium'));

            if (!premiumPlan) {
                console.log('❌ Premium Plan not found, creating...');
                await pool.request().query(`
                    INSERT INTO MembershipPlans (Name, Description, Price, Duration, Features) VALUES
                    (N'Premium Plan', N'Kế hoạch cao cấp với hỗ trợ chuyên sâu', 299000, 60, N'• Kế hoạch mẫu 8 tuần chi tiết\n• Hỗ trợ coach chuyên nghiệp\n• Theo dõi sức khỏe\n• Tư vấn tâm lý')
                `);
                console.log('✅ Premium Plan created');
            }
        }

        // 4. Final check
        const finalPlans = await pool.request().query(`
            SELECT PlanID, Name, Description, Price, Duration
            FROM MembershipPlans
            ORDER BY PlanID
        `);

        console.log('\n📋 Final plans list:');
        finalPlans.recordset.forEach(plan => {
            console.log(`  - ID: ${plan.PlanID}, Name: "${plan.Name}", Price: ${plan.Price} VND`);
        });

        console.log('\n✅ MembershipPlans setup completed!');
        console.log('💡 Now you can run template setup');

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

// Run the fix
fixMembershipPlans(); 
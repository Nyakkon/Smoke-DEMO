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

async function directTemplateTest() {
    let pool = null;
    try {
        console.log('🔍 DIRECT TEMPLATE TEST');
        console.log('======================\n');

        // Connect to database
        console.log('🔗 Connecting to database...');
        pool = await sql.connect(config);
        console.log('✅ Database connected');

        // 1. Check PlanTemplates table
        console.log('📋 Checking PlanTemplates table...');
        const templates = await pool.request().query(`
            SELECT 
                pt.TemplateID,
                pt.PlanID,
                pt.PhaseName,
                pt.PhaseDescription,
                pt.DurationDays,
                pt.SortOrder,
                mp.Name as PlanName,
                mp.Description as PlanDescription,
                mp.Price,
                mp.Duration as PlanDuration
            FROM PlanTemplates pt
            JOIN MembershipPlans mp ON pt.PlanID = mp.PlanID
            ORDER BY pt.PlanID, pt.SortOrder
        `);

        console.log(`✅ Found ${templates.recordset.length} templates:`);
        templates.recordset.forEach((template, index) => {
            console.log(`${index + 1}. ${template.PlanName} - ${template.PhaseName}`);
            console.log(`   ${template.PhaseDescription.substring(0, 100)}...`);
        });

        // 2. Test the API response format
        console.log('\n📤 Testing API response format...');

        // Group by plan (same logic as API)
        const groupedByPlan = templates.recordset.reduce((acc, item) => {
            const planKey = item.PlanID;
            if (!acc[planKey]) {
                acc[planKey] = {
                    planInfo: {
                        planId: item.PlanID,
                        planName: item.PlanName,
                        planDescription: item.PlanDescription,
                        price: item.Price,
                        duration: item.PlanDuration
                    },
                    phases: []
                };
            }
            acc[planKey].phases.push({
                templateId: item.TemplateID,
                phaseName: item.PhaseName,
                phaseDescription: item.PhaseDescription,
                durationDays: item.DurationDays,
                sortOrder: item.SortOrder
            });
            return acc;
        }, {});

        const apiResponse = {
            success: true,
            data: Object.values(groupedByPlan),
            totalTemplates: templates.recordset.length,
            message: 'Lấy kế hoạch mẫu thành công'
        };

        console.log('API Response Structure:');
        console.log(JSON.stringify(apiResponse, null, 2));

        // 3. Test specific Premium Plan format
        const premiumPlan = Object.values(groupedByPlan).find(plan =>
            plan.planInfo.planName === 'Premium Plan');

        if (premiumPlan) {
            console.log('\n📋 Premium Plan phases:');
            premiumPlan.phases.forEach((phase, index) => {
                console.log(`${index + 1}. ${phase.phaseName} (${phase.durationDays} ngày)`);
            });
        }

        console.log('\n✅ Test completed successfully!');
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
directTemplateTest(); 
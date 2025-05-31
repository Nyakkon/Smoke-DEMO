const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const { pool } = require('../config/database');
const AchievementService = require('../services/achievementService');
const sql = require('mssql');

// Get all achievements with user's earned status
router.get('/', protect, async (req, res) => {
    try {
        // Get user's progress data to check eligibility
        const progressData = await AchievementService.getUserProgressData(req.user.UserID);
        const userPlan = await AchievementService.getUserMembershipPlan(req.user.UserID);

        const result = await pool.request()
            .input('UserID', req.user.UserID)
            .query(`
                SELECT 
                    a.*,
                    CASE WHEN ua.UserAchievementID IS NOT NULL THEN 1 ELSE 0 END as IsEarned,
                    ua.EarnedAt
                FROM Achievements a
                LEFT JOIN UserAchievements ua ON a.AchievementID = ua.AchievementID 
                    AND ua.UserID = @UserID
                WHERE a.IsActive = 1
                ORDER BY a.Category, a.Difficulty
            `);

        // Add eligibility check for each achievement
        const achievementsWithEligibility = result.recordset.map(achievement => {
            let isEligible = false;

            // Check milestone days
            if (achievement.MilestoneDays !== null) {
                isEligible = progressData.SmokeFreeDays >= achievement.MilestoneDays;
            }

            // Check saved money
            if (achievement.SavedMoney !== null) {
                isEligible = progressData.TotalMoneySaved >= achievement.SavedMoney;
            }

            // If no specific requirements, consider eligible
            if (achievement.MilestoneDays === null && achievement.SavedMoney === null) {
                isEligible = true;
            }

            return {
                ...achievement,
                IsEligible: isEligible ? 1 : 0,
                // Progress towards this achievement
                Progress: achievement.MilestoneDays
                    ? Math.min(progressData.SmokeFreeDays / achievement.MilestoneDays * 100, 100)
                    : achievement.SavedMoney
                        ? Math.min(progressData.TotalMoneySaved / achievement.SavedMoney * 100, 100)
                        : 100
            };
        });

        res.json({
            success: true,
            data: achievementsWithEligibility
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error getting achievements'
        });
    }
});

// Get user's earned achievements
router.get('/earned', protect, async (req, res) => {
    try {
        // Set cache control headers to prevent 304 responses
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Last-Modified': new Date().toUTCString()
        });

        const achievements = await AchievementService.getUserAchievements(req.user.UserID);

        res.status(200).json({
            success: true,
            timestamp: new Date().toISOString(),
            data: achievements
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error getting earned achievements'
        });
    }
});

// Get user's top badge for display
router.get('/top-badge', protect, async (req, res) => {
    try {
        const topBadge = await AchievementService.getUserTopBadge(req.user.UserID);

        res.json({
            success: true,
            data: topBadge
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error getting top badge'
        });
    }
});

// Check and award achievements for current user
router.post('/check', protect, async (req, res) => {
    try {
        const result = await AchievementService.checkAndAwardAchievements(req.user.UserID);

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error checking achievements'
        });
    }
});

// Trigger achievement check on progress update
router.post('/progress-update', protect, async (req, res) => {
    try {
        const result = await AchievementService.onProgressUpdate(req.user.UserID);

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error processing progress update'
        });
    }
});

// Get achievement statistics
router.get('/stats', protect, async (req, res) => {
    try {
        // Set cache control headers to prevent 304 responses
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Last-Modified': new Date().toUTCString()
        });

        const result = await pool.request()
            .input('UserID', req.user.UserID)
            .query(`
                SELECT 
                    COUNT(*) as TotalAchievements,
                    (SELECT COUNT(*) FROM UserAchievements WHERE UserID = @UserID) as EarnedCount,
                    (SELECT SUM(Points) FROM Achievements a 
                     JOIN UserAchievements ua ON a.AchievementID = ua.AchievementID 
                     WHERE ua.UserID = @UserID) as TotalPoints,
                    (SELECT COUNT(DISTINCT Category) FROM Achievements a 
                     JOIN UserAchievements ua ON a.AchievementID = ua.AchievementID 
                     WHERE ua.UserID = @UserID) as CategoriesCompleted
                FROM Achievements 
                WHERE IsActive = 1
            `);

        const stats = result.recordset[0];
        const completionRate = stats.TotalAchievements > 0
            ? Math.round((stats.EarnedCount / stats.TotalAchievements) * 100)
            : 0;

        res.status(200).json({
            success: true,
            timestamp: new Date().toISOString(),
            data: {
                ...stats,
                CompletionRate: completionRate
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error getting achievement statistics'
        });
    }
});

// Get achievements by category
router.get('/categories/:category', protect, async (req, res) => {
    try {
        const { category } = req.params;

        const result = await pool.request()
            .input('UserID', req.user.UserID)
            .input('Category', category)
            .query(`
                SELECT 
                    a.*,
                    CASE WHEN ua.UserAchievementID IS NOT NULL THEN 1 ELSE 0 END as IsEarned,
                    ua.EarnedAt
                FROM Achievements a
                LEFT JOIN UserAchievements ua ON a.AchievementID = ua.AchievementID 
                    AND ua.UserID = @UserID
                WHERE a.Category = @Category AND a.IsActive = 1
                ORDER BY a.Difficulty
            `);

        res.json({
            success: true,
            data: result.recordset
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error getting achievements by category'
        });
    }
});

// PUBLIC endpoint: Get all achievements without authentication (for display purposes)
router.get('/public', async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT 
                AchievementID,
                Name,
                Description,
                IconURL,
                Category,
                MilestoneDays,
                SavedMoney,
                RequiredPlan,
                Difficulty,
                Points
            FROM Achievements
            WHERE IsActive = 1
            ORDER BY Category, Difficulty
        `);

        res.json({
            success: true,
            data: result.recordset
        });
    } catch (error) {
        console.error('Error getting public achievements:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting achievements',
            error: error.message
        });
    }
});

// === ADMIN ONLY ROUTES ===

// Create new achievement (admin only)
router.post('/', protect, authorize('admin'), async (req, res) => {
    try {
        const {
            name, description, iconUrl, category,
            milestoneDays, savedMoney, requiredPlan,
            difficulty, points
        } = req.body;

        const result = await pool.request()
            .input('Name', name)
            .input('Description', description)
            .input('IconURL', iconUrl)
            .input('Category', category)
            .input('MilestoneDays', milestoneDays)
            .input('SavedMoney', savedMoney)
            .input('RequiredPlan', requiredPlan)
            .input('Difficulty', difficulty)
            .input('Points', points)
            .query(`
                INSERT INTO Achievements (
                    Name, Description, IconURL, Category, MilestoneDays, 
                    SavedMoney, RequiredPlan, Difficulty, Points, IsActive, CreatedAt
                )
                OUTPUT INSERTED.*
                VALUES (
                    @Name, @Description, @IconURL, @Category, @MilestoneDays, 
                    @SavedMoney, @RequiredPlan, @Difficulty, @Points, 1, GETDATE()
                )
            `);

        res.status(201).json({
            success: true,
            data: result.recordset[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error creating achievement'
        });
    }
});

// Award achievement to user (admin only)
router.post('/award', protect, authorize('admin'), async (req, res) => {
    try {
        const { userId, achievementId } = req.body;

        await AchievementService.awardAchievement(userId, achievementId);

        res.json({
            success: true,
            message: 'Achievement awarded successfully'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error awarding achievement'
        });
    }
});

// Check achievements for any user (admin only)
router.post('/check/:userId', protect, authorize('admin'), async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await AchievementService.checkAndAwardAchievements(parseInt(userId));

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error checking user achievements'
        });
    }
});

// Manual fix achievements endpoint
router.post('/fix-unlock', protect, async (req, res) => {
    try {
        console.log('🔓 Manual achievement fix requested by user:', req.user.UserID);

        // Get user's actual progress data using the AchievementService method
        const progressData = await AchievementService.getUserProgressData(req.user.UserID);
        console.log('📊 User progress data:', progressData);

        // If no progress data, don't create fake data - just inform user
        if (progressData.ProgressEntries === 0) {
            return res.json({
                success: false,
                message: 'Bạn chưa có dữ liệu tiến trình nào. Hãy ghi nhật ký tiến trình trước khi kiểm tra huy hiệu.',
                needsProgress: true,
                progressData: {
                    SmokeFreeDays: 0,
                    TotalMoneySaved: 0,
                    ProgressEntries: 0
                }
            });
        }

        // Get achievements user doesn't have yet using AchievementService
        const availableAchievements = await AchievementService.getAvailableAchievements(req.user.UserID);
        console.log(`🎯 Available achievements: ${availableAchievements.length}`);

        const newAchievements = [];

        // Check each achievement using proper AchievementService logic
        for (const achievement of availableAchievements) {
            let shouldUnlock = false;

            // Use the same logic as AchievementService.checkAchievementEligibility
            if (achievement.MilestoneDays !== null) {
                // Check smoke-free days requirement
                if (progressData.SmokeFreeDays >= achievement.MilestoneDays) {
                    shouldUnlock = true;
                    console.log(`✅ User qualifies for "${achievement.Name}" (${progressData.SmokeFreeDays}/${achievement.MilestoneDays} days)`);
                } else {
                    console.log(`❌ User does NOT qualify for "${achievement.Name}" (${progressData.SmokeFreeDays}/${achievement.MilestoneDays} days)`);
                }
            }

            if (achievement.SavedMoney !== null) {
                // Check saved money requirement
                if (progressData.TotalMoneySaved >= achievement.SavedMoney) {
                    shouldUnlock = true;
                    console.log(`✅ User qualifies for "${achievement.Name}" (${progressData.TotalMoneySaved}/${achievement.SavedMoney} VND)`);
                } else {
                    console.log(`❌ User does NOT qualify for "${achievement.Name}" (${progressData.TotalMoneySaved}/${achievement.SavedMoney} VND)`);
                }
            }

            // If both MilestoneDays and SavedMoney are null, it's a special achievement
            if (achievement.MilestoneDays === null && achievement.SavedMoney === null) {
                // For special achievements, use AchievementService logic
                const userPlan = await AchievementService.getUserMembershipPlan(req.user.UserID);
                shouldUnlock = await AchievementService.checkAchievementEligibility(
                    achievement,
                    progressData,
                    userPlan,
                    req.user.UserID
                );
                console.log(`🔍 Special achievement "${achievement.Name}": ${shouldUnlock ? 'ELIGIBLE' : 'NOT ELIGIBLE'}`);
            }

            // Only award if truly eligible
            if (shouldUnlock) {
                try {
                    await AchievementService.awardAchievement(req.user.UserID, achievement.AchievementID);
                    newAchievements.push(achievement);
                    console.log(`🏆 UNLOCKED: ${achievement.Name}`);
                } catch (error) {
                    if (!error.message.includes('duplicate')) {
                        console.error(`❌ Error unlocking "${achievement.Name}":`, error.message);
                    }
                }
            }
        }

        res.json({
            success: true,
            message: newAchievements.length > 0
                ? `Đã mở khóa ${newAchievements.length} huy hiệu mới!`
                : 'Không có huy hiệu mới để mở khóa. Hãy tiếp tục cố gắng!',
            newAchievements,
            progressData: {
                SmokeFreeDays: progressData.SmokeFreeDays,
                TotalMoneySaved: progressData.TotalMoneySaved,
                ProgressEntries: progressData.ProgressEntries
            },
            debug: {
                availableCount: availableAchievements.length,
                unlockedCount: newAchievements.length,
                requirements: availableAchievements.map(a => ({
                    name: a.Name,
                    milestoneDays: a.MilestoneDays,
                    savedMoney: a.SavedMoney,
                    userDays: progressData.SmokeFreeDays,
                    userMoney: progressData.TotalMoneySaved,
                    eligible: a.MilestoneDays !== null
                        ? progressData.SmokeFreeDays >= a.MilestoneDays
                        : a.SavedMoney !== null
                            ? progressData.TotalMoneySaved >= a.SavedMoney
                            : false
                }))
            }
        });

    } catch (error) {
        console.error('❌ Error fixing achievements:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi kiểm tra huy hiệu: ' + error.message
        });
    }
});

// Test endpoint for achievement logic (development only)
router.get('/test-logic', async (req, res) => {
    try {
        // Mock data for testing
        const mockProgressData = {
            SmokeFreeDays: parseInt(req.query.days) || 0,
            TotalMoneySaved: parseInt(req.query.money) || 0,
            ProgressEntries: 1
        };

        const mockAchievements = [
            {
                AchievementID: 1,
                Name: 'Ngày đầu tiên',
                Description: 'Chúc mừng bạn đã hoàn thành ngày đầu tiên không hút thuốc!',
                IconURL: '🏆',
                MilestoneDays: 1,
                SavedMoney: null,
                Category: 'milestone',
                Difficulty: 1,
                Points: 10,
                IsActive: 1
            },
            {
                AchievementID: 2,
                Name: 'Tuần lễ khởi đầu',
                Description: 'Bạn đã không hút thuốc được 7 ngày liên tiếp!',
                IconURL: '⭐',
                MilestoneDays: 7,
                SavedMoney: null,
                Category: 'milestone',
                Difficulty: 2,
                Points: 50,
                IsActive: 1
            },
            {
                AchievementID: 3,
                Name: 'Tháng đầu tiên',
                Description: 'Một tháng không hút thuốc - một cột mốc quan trọng!',
                IconURL: '👑',
                MilestoneDays: 30,
                SavedMoney: null,
                Category: 'milestone',
                Difficulty: 3,
                Points: 200,
                IsActive: 1
            },
            {
                AchievementID: 4,
                Name: 'Tiết kiệm 100K',
                Description: 'Bạn đã tiết kiệm được 100,000 VNĐ nhờ việc không hút thuốc!',
                IconURL: '💰',
                MilestoneDays: null,
                SavedMoney: 100000,
                Category: 'savings',
                Difficulty: 1,
                Points: 30,
                IsActive: 1
            },
            {
                AchievementID: 5,
                Name: 'Tiết kiệm 500K',
                Description: 'Tuyệt vời! Bạn đã tiết kiệm được 500,000 VNĐ!',
                IconURL: '💎',
                MilestoneDays: null,
                SavedMoney: 500000,
                Category: 'savings',
                Difficulty: 2,
                Points: 100,
                IsActive: 1
            }
        ];

        // Test achievement eligibility logic
        const achievementsWithEligibility = mockAchievements.map(achievement => {
            let isEligible = false;
            let progress = 0;

            // Check milestone days
            if (achievement.MilestoneDays !== null) {
                isEligible = mockProgressData.SmokeFreeDays >= achievement.MilestoneDays;
                progress = Math.min(mockProgressData.SmokeFreeDays / achievement.MilestoneDays * 100, 100);
            }

            // Check saved money
            if (achievement.SavedMoney !== null) {
                isEligible = mockProgressData.TotalMoneySaved >= achievement.SavedMoney;
                progress = Math.min(mockProgressData.TotalMoneySaved / achievement.SavedMoney * 100, 100);
            }

            return {
                ...achievement,
                IsEligible: isEligible ? 1 : 0,
                IsEarned: 0, // Mock as not earned yet
                Progress: Math.round(progress * 10) / 10
            };
        });

        res.json({
            success: true,
            message: 'Test achievement logic',
            testData: {
                userProgress: mockProgressData,
                achievements: achievementsWithEligibility,
                eligibleCount: achievementsWithEligibility.filter(a => a.IsEligible === 1).length,
                totalAchievements: achievementsWithEligibility.length
            },
            instructions: {
                usage: 'Thêm ?days=X&money=Y để test với giá trị khác',
                examples: [
                    '/api/achievements/test-logic?days=1&money=50000 - Test với 1 ngày và 50K',
                    '/api/achievements/test-logic?days=7&money=350000 - Test với 7 ngày và 350K',
                    '/api/achievements/test-logic?days=30&money=1500000 - Test với 30 ngày và 1.5M'
                ]
            }
        });
    } catch (error) {
        console.error('Error in test logic:', error);
        res.status(500).json({
            success: false,
            message: 'Error testing achievement logic'
        });
    }
});

// Debug endpoint to check achievement logic
router.get('/debug', protect, async (req, res) => {
    try {
        console.log('🔍 DEBUGGING ACHIEVEMENT LOGIC FOR USER:', req.user.UserID);

        // 1. Raw progress data
        const rawProgressResult = await pool.request()
            .input('UserID', req.user.UserID)
            .query(`
                SELECT 
                    Date,
                    CigarettesSmoked,
                    MoneySaved,
                    DaysSmokeFree,
                    CravingLevel
                FROM ProgressTracking 
                WHERE UserID = @UserID
                ORDER BY Date DESC
            `);

        // 2. Calculated summary
        const summaryResult = await pool.request()
            .input('UserID', req.user.UserID)
            .query(`
                SELECT 
                    COUNT(CASE WHEN CigarettesSmoked = 0 THEN 1 END) as SmokeFreeDays,
                    COALESCE(SUM(MoneySaved), 0) as TotalMoneySaved,
                    COUNT(*) as ProgressEntries,
                    AVG(CAST(CigarettesSmoked AS FLOAT)) as AvgCigarettes,
                    MIN(Date) as FirstEntry,
                    MAX(Date) as LastEntry
                FROM ProgressTracking 
                WHERE UserID = @UserID
            `);

        // 3. AchievementService calculation
        const progressData = await AchievementService.getUserProgressData(req.user.UserID);

        // 4. Current earned achievements
        const earnedResult = await pool.request()
            .input('UserID', req.user.UserID)
            .query(`
                SELECT a.Name, a.MilestoneDays, a.SavedMoney, ua.EarnedAt
                FROM UserAchievements ua
                JOIN Achievements a ON ua.AchievementID = a.AchievementID
                WHERE ua.UserID = @UserID
                ORDER BY ua.EarnedAt
            `);

        // 5. All achievements with eligibility check
        const allAchievements = await pool.request().query(`
            SELECT AchievementID, Name, MilestoneDays, SavedMoney, Category
            FROM Achievements 
            WHERE IsActive = 1
            ORDER BY AchievementID
        `);

        const achievementAnalysis = allAchievements.recordset.map(ach => {
            const isEarned = earnedResult.recordset.some(e => e.Name === ach.Name);
            let shouldBeEligible = false;
            let reason = '';
            let progressTowards = 0;

            if (ach.MilestoneDays !== null) {
                shouldBeEligible = progressData.SmokeFreeDays >= ach.MilestoneDays;
                reason = `SmokeFreeDays (${progressData.SmokeFreeDays}) >= Required (${ach.MilestoneDays})`;
                progressTowards = Math.round((progressData.SmokeFreeDays / ach.MilestoneDays) * 100);
            } else if (ach.SavedMoney !== null) {
                shouldBeEligible = progressData.TotalMoneySaved >= ach.SavedMoney;
                reason = `TotalMoneySaved (${progressData.TotalMoneySaved}) >= Required (${ach.SavedMoney})`;
                progressTowards = Math.round((progressData.TotalMoneySaved / ach.SavedMoney) * 100);
            } else {
                reason = 'Special achievement';
                progressTowards = 0;
            }

            return {
                name: ach.Name,
                required: ach.MilestoneDays || ach.SavedMoney,
                isEarned,
                shouldBeEligible,
                reason,
                progressTowards: Math.min(progressTowards, 100),
                status: isEarned ? 'EARNED' : shouldBeEligible ? 'ELIGIBLE_NOT_EARNED' : 'NOT_ELIGIBLE'
            };
        });

        res.json({
            success: true,
            debug: {
                userID: req.user.UserID,
                userEmail: req.user.Email,
                rawProgress: rawProgressResult.recordset,
                calculatedSummary: summaryResult.recordset[0],
                achievementServiceData: progressData,
                currentEarnedAchievements: earnedResult.recordset,
                achievementAnalysis,
                issues: achievementAnalysis.filter(a => a.status === 'EARNED' && !a.shouldBeEligible)
                    .map(a => `"${a.name}" is earned but user doesn't meet requirements: ${a.reason}`),
                recommendations: achievementAnalysis.filter(a => a.status === 'ELIGIBLE_NOT_EARNED')
                    .map(a => `"${a.name}" should be unlocked: ${a.reason}`)
            }
        });
    } catch (error) {
        console.error('❌ Error in debug endpoint:', error);
        res.status(500).json({
            success: false,
            message: 'Debug error: ' + error.message
        });
    }
});

// Clear user's achievements (for testing)
router.post('/clear-my-achievements', protect, async (req, res) => {
    try {
        console.log('🗑️ Clearing achievements for user:', req.user.UserID);

        const result = await pool.request()
            .input('UserID', req.user.UserID)
            .query('DELETE FROM UserAchievements WHERE UserID = @UserID');

        res.json({
            success: true,
            message: `Đã xóa ${result.rowsAffected[0]} huy hiệu. Bây giờ chỉ những huy hiệu đủ điều kiện mới có thể mở khóa.`,
            clearedCount: result.rowsAffected[0]
        });
    } catch (error) {
        console.error('❌ Error clearing achievements:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xóa achievements: ' + error.message
        });
    }
});

// Debug endpoint to update achievements to use emojis
router.post('/update-emojis', async (req, res) => {
    try {
        const pool = await sql.connect();

        // Update achievements to use emojis instead of image paths
        const updates = [
            { id: 1, emoji: '🏆' }, // Ngày đầu tiên
            { id: 2, emoji: '⭐' }, // Tuần lễ khởi đầu
            { id: 3, emoji: '👑' }, // Tháng đầu tiên
            { id: 4, emoji: '💎' }, // Quý đầu tiên
            { id: 5, emoji: '💰' }, // Tiết kiệm 100K
            { id: 6, emoji: '💵' }, // Tiết kiệm 500K
            { id: 7, emoji: '🤑' }  // Tiết kiệm 1 triệu
        ];

        for (const update of updates) {
            await pool.request()
                .input('id', sql.Int, update.id)
                .input('emoji', sql.NVarChar, update.emoji)
                .query('UPDATE Achievements SET IconURL = @emoji WHERE AchievementID = @id');
        }

        // Verify the updates
        const result = await pool.request().query('SELECT AchievementID, Name, IconURL FROM Achievements ORDER BY AchievementID');

        res.json({
            success: true,
            message: 'Achievements updated to use emojis',
            data: result.recordset
        });

    } catch (error) {
        console.error('Error updating achievement emojis:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật emoji huy hiệu: ' + error.message
        });
    }
});

module.exports = router; 
// server/routes/admin.js
const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth.middleware');
const authorize = require('../middleware/authorize');
const { pool } = require('../config/database');

// Route yêu cầu người dùng phải là admin
router.get('/admin-only', auth, authorize('admin'), (req, res) => {
    res.json({ success: true, message: 'Welcome, admin!' });
});

// ------------------------------------------
// Admin API Root
// ------------------------------------------
router.get('/', auth, authorize('admin'), (req, res) => {
  res.json({
    message: 'Admin API root',
    endpoints: [
      '/dashboard',
      '/plans',
      '/coaches',
      '/coaches/:coachId/assignments',
      '/coaches/:coachId/assign',
      '/quitting',
      '/support-needed',
      '/achievements-progress'
    ]
  });
});

// ------------------------------------------
// Dashboard Metrics
// ------------------------------------------
router.get('/dashboard', auth, authorize('admin'), async (req, res, next) => {
  try {
    const u = await pool.request().query('SELECT COUNT(*) AS count FROM Users');
    const p = await pool.request().query("SELECT COUNT(*) AS count FROM Payments WHERE Status='confirmed'");
    const a = await pool.request().query("SELECT COUNT(*) AS count FROM UserMemberships WHERE Status='active'");
    const q = await pool.request().query(
      "SELECT COUNT(DISTINCT UserID) AS count FROM SmokingStatus WHERE CigarettesPerDay = 0"
    );
    const r = await pool.request().query("SELECT SUM(Amount) AS total FROM Payments WHERE Status='confirmed'");

    const trends = [
      { date: '2024-01', value1: 100, value2: 200 },
      { date: '2024-02', value1: 150, value2: 250 },
      { date: '2024-03', value1: 200, value2: 300 },
      { date: '2024-04', value1: 180, value2: 280 },
      { date: '2024-05', value1: 220, value2: 320 },
    ];

    res.json({
      usersCount: u.recordset[0].count,
      paymentsCount: p.recordset[0].count,
      activePlans: a.recordset[0].count,
      successfulQuitters: q.recordset[0].count,
      totalRevenue: r.recordset[0].total || 0,
      trends
    });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------
// Quitting Users
// ------------------------------------------
router.get('/quitting', auth, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT u.UserID, u.Email, u.FirstName, u.LastName, ss.CigarettesPerDay, ss.SmokingFrequency
      FROM Users u
      JOIN SmokingStatus ss ON u.UserID = ss.UserID
      WHERE ss.CigarettesPerDay = 0
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error retrieving quitting users' });
  }
});

// ------------------------------------------
// Users Needing Support
// ------------------------------------------
router.get('/support-needed', auth, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT u.UserID, u.Email, u.FirstName, u.LastName, qp.MotivationLevel, qp.Status
      FROM Users u
      JOIN QuitPlans qp ON u.UserID = qp.UserID
      WHERE qp.Status = 'active' AND qp.MotivationLevel <= 3
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error retrieving users needing support' });
  }
});

// GET /api/admin/members
// Trả về danh sách tất cả users có role = 'member'
router.get(
  '/members',
  auth,
  authorize('admin'),
  async (req, res, next) => {
    try {
      const result = await pool.request().query(`
        SELECT
          UserID,
          Email,
          FirstName,
          LastName,
          IsActive,
          CreatedAt
        FROM Users
        WHERE role = 'member'
        ORDER BY CreatedAt DESC
      `);
      res.json({ success: true, data: result.recordset });
    } catch (err) {
      next(err);
    }
  }
);

// ------------------------------------------
// Achievements Progress
// ------------------------------------------
router.get('/achievements-progress', auth, authorize('admin'), async (req, res) => {
  try {
    const ach = await pool.request().query(`
      SELECT 
        a.AchievementID,
        a.AchievementName,
        a.Description,
        COUNT(ua.UserID) AS TimesAwarded
      FROM Achievements a
      LEFT JOIN UserAchievements ua ON a.AchievementID = ua.AchievementID
      GROUP BY a.AchievementID, a.AchievementName, a.Description
      ORDER BY TimesAwarded DESC
    `);
    const usr = (await pool.request().query(`
      SELECT 
        COUNT(DISTINCT u.UserID) AS TotalUsers,
        COUNT(DISTINCT ua.UserID) AS UsersWithAchievements
      FROM Users u
      LEFT JOIN UserAchievements ua ON u.UserID = ua.UserID
    `)).recordset[0];
    const prg = (await pool.request().query(`
      SELECT 
        COUNT(DISTINCT UserID)               AS UsersTrackingProgress,
        COUNT(*)                             AS TotalProgressEntries,
        AVG(CAST(CigarettesSmoked AS FLOAT)) AS AvgCigarettesSmoked,
        AVG(CAST(CravingLevel   AS FLOAT))   AS AvgCravingLevel,
        AVG(CAST(MoneySpent      AS FLOAT))  AS AvgMoneySpent
      FROM ProgressTracking
    `)).recordset[0];

    res.json({
      success: true,
      data: {
        achievements: ach.recordset,
        users: {
          TotalUsers:           usr.TotalUsers,
          UsersWithAchievements: usr.UsersWithAchievements
        },
        progress: {
          UsersTrackingProgress: prg.UsersTrackingProgress,
          TotalProgressEntries:  prg.TotalProgressEntries,
          AvgCigarettesSmoked:   Math.round(prg.AvgCigarettesSmoked || 0),
          AvgCravingLevel:       Math.round(prg.AvgCravingLevel   || 0),
          AvgMoneySpent:         Math.round(prg.AvgMoneySpent      || 0)
        }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error retrieving achievements-progress' });
  }
});

// ------------------------------------------
// Plans Management (MembershipPlans)
// ------------------------------------------
router.get('/plans', auth, authorize('admin'), async (req, res, next) => {
  try {
    const r = await pool.request().query(`
      SELECT PlanID, [Name], [Description], [Price], [Duration], [Features], CreatedAt
      FROM MembershipPlans
      ORDER BY CreatedAt DESC
    `);
    res.json({ success: true, data: r.recordset });
  } catch (err) {
    next(err);
  }
});
router.post('/plans', auth, authorize('admin'), async (req, res, next) => {
  try {
    const { name, description, price, duration, features } = req.body;
    if (!name || price == null || duration == null) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    const r = await pool.request()
      .input('name', name)
      .input('description', description||'')
      .input('price', price)
      .input('duration', duration)
      .input('features', features||'')
      .query(`
        INSERT INTO MembershipPlans ([Name],[Description],[Price],[Duration],[Features],CreatedAt)
        VALUES(@name,@description,@price,@duration,@features,GETUTCDATE());
        SELECT SCOPE_IDENTITY() AS PlanID;
      `);
    res.status(201).json({ success: true, planId: r.recordset[0].PlanID });
  } catch (err) {
    next(err);
  }
});
router.put('/plans/:planId', auth, authorize('admin'), async (req, res, next) => {
  try {
    const { planId } = req.params;
    const { name, description, price, duration, features } = req.body;
    await pool.request()
      .input('planId', planId)
      .input('name', name)
      .input('description', description||'')
      .input('price', price)
      .input('duration', duration)
      .input('features', features||'')
      .query(`
        UPDATE MembershipPlans
        SET [Name]=@name,[Description]=@description,
            [Price]=@price,[Duration]=@duration,
            [Features]=@features
        WHERE PlanID=@planId
      `);
    res.json({ success: true, message: 'Plan updated' });
  } catch (err) {
    next(err);
  }
});
router.delete('/plans/:planId', auth, authorize('admin'), async (req, res, next) => {
  try {
    const { planId } = req.params;
    await pool.request()
      .input('planId', planId)
      .query(`DELETE FROM MembershipPlans WHERE PlanID=@planId`);
    res.json({ success: true, message: 'Plan deleted' });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------
// Coaches Management (Users with role='coach')
// ------------------------------------------
router.get('/coaches', auth, authorize('admin'), async (req, res, next) => {
  try {
    const r = await pool.request().query(`
  SELECT 
    u.UserID   AS CoachID,
    u.Email,
    u.FirstName,
    u.LastName,
    u.IsActive,
    COUNT(ca.MemberID) AS AssignedUsers,
    u.CreatedAt
  FROM Users u
  LEFT JOIN CoachAssignments ca
    ON u.UserID = ca.CoachID
  WHERE u.role = 'coach'
  GROUP BY 
    u.UserID,
    u.Email,
    u.FirstName,
    u.LastName,
    u.IsActive,
    u.CreatedAt
  ORDER BY u.CreatedAt DESC
`);
    res.json({ success: true, data: r.recordset });
  } catch (err) {
    next(err);
  }
});
router.post('/coaches', auth, authorize('admin'), async (req, res, next) => {
  try {
    const { email, firstName, lastName, password } = req.body;
    const r = await pool.request()
      .input('email', email)
      .input('firstName', firstName)
      .input('lastName', lastName)
      .input('password', password)
      .query(`
        INSERT INTO Users
          (Email,FirstName,LastName,PasswordHash,role,IsActive,CreatedAt)
        VALUES
          (@email,@firstName,@lastName,@password,'coach',1,GETUTCDATE());
        SELECT SCOPE_IDENTITY() AS CoachID;
      `);
    res.status(201).json({ success: true, coachId: r.recordset[0].CoachID });
  } catch (err) {
    next(err);
  }
});
router.put('/coaches/:coachId', auth, authorize('admin'), async (req, res, next) => {
  try {
    const { coachId } = req.params;
    const { firstName, lastName, isActive } = req.body;
    await pool.request()
      .input('coachId', coachId)
      .input('firstName', firstName)
      .input('lastName', lastName)
      .input('isActive', isActive)
      .query(`
        UPDATE Users
        SET FirstName=@firstName,LastName=@lastName,IsActive=@isActive,UpdatedAt=GETUTCDATE()
        WHERE UserID=@coachId AND role='coach'
      `);
    res.json({ success: true, message: 'Coach updated' });
  } catch (err) {
    next(err);
  }
});
router.delete('/coaches/:coachId', auth, authorize('admin'), async (req, res, next) => {
  try {
    const { coachId } = req.params;
    await pool.request()
      .input('coachId', coachId)
      .query(`
        UPDATE Users
        SET IsActive=0,UpdatedAt=GETUTCDATE()
        WHERE UserID=@coachId AND role='coach'
      `);
    res.json({ success: true, message: 'Coach deactivated' });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------
// CoachAssignments Management
// ------------------------------------------
router.get('/coaches/:coachId/assignments', auth, authorize('admin'), async (req, res, next) => {
  const { coachId } = req.params;
  try {
    const r = await pool.request()
      .input('coachId', coachId)
      .query(`
        SELECT 
          ca.AssignmentID,
          m.UserID   AS MemberID,
          m.Email,
          m.FirstName,
          m.LastName,
          ca.AssignedAt
        FROM CoachAssignments ca
        JOIN Users m ON ca.MemberID = m.UserID
        WHERE ca.CoachID = @coachId
        ORDER BY ca.AssignedAt DESC
      `);
    res.json({ success: true, data: r.recordset });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/coaches/:coachId/assign
router.post('/coaches/:coachId/assign', auth, authorize('admin'), async (req, res, next) => {
  const { coachId } = req.params;
  const { memberIds } = req.body; // array of member UserIDs
  const maxMembersPerCoach = 5; // Giới hạn số lượng thành viên một huấn luyện viên có thể huấn luyện

  let transaction;  // Khai báo transaction ngoài try-catch

  try {
    // Kiểm tra số lượng thành viên đã được phân công cho huấn luyện viên
    const existingAssignments = await pool.request()
      .input('coachId', coachId)
      .query(`SELECT COUNT(*) AS assignedCount FROM CoachAssignments WHERE CoachID = @coachId`);
    
    const assignedCount = existingAssignments.recordset[0].assignedCount;

    if (assignedCount + memberIds.length > maxMembersPerCoach) {
      return res.status(400).json({
        success: false,
        message: `Huấn luyện viên này đã có tối đa ${maxMembersPerCoach} thành viên. Vui lòng chọn huấn luyện viên khác.`
      });
    }

    // Tiến hành phân công thành viên cho huấn luyện viên
    transaction = await pool.transaction();  // Khởi tạo transaction đúng cách
    await transaction.begin();  // Bắt đầu transaction

    const tx = transaction.request();
    tx.input('coachId', coachId);

    // Xóa các phân công cũ (nếu có) - nếu bạn muốn giữ lại các phân công cũ, xóa dòng này
    await tx.query(`DELETE FROM CoachAssignments WHERE CoachID=@coachId`); 

    // Thêm các phân công mới
    for (let i = 0; i < memberIds.length; i++) {
      const memberIDToAssign = memberIds[i];  // Đổi tên tham số ở đây
      await tx.input(`memberId_${i}`, memberIDToAssign).query(`
        INSERT INTO CoachAssignments (CoachID, MemberID, AssignedAt)
        VALUES (@coachId, @memberId_${i}, GETUTCDATE())
      `);
    }

    // Cam kết giao dịch
    await transaction.commit();  // Commit để lưu các thay đổi

    res.json({ success: true, message: 'Phân công thành viên cho huấn luyện viên thành công' });

  } catch (err) {
    // Nếu có lỗi, rollback giao dịch
    if (transaction) {
      await transaction.rollback();  // Rollback khi có lỗi
    }
    next(err);  // Truyền lỗi cho middleware xử lý
  }
});

// PUT /api/admin/coaches/:coachId/activate
router.put('/coaches/:coachId/activate', auth, authorize('admin'), async (req, res) => {
  const { coachId } = req.params;
  try {
    await pool.request()
      .input('coachId', coachId)
      .query(`
        UPDATE Users
        SET IsActive = 1
        WHERE UserID = @coachId AND role = 'coach'
      `);
    res.json({ success: true, message: 'Coach activated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error activating coach' });
  }
});


router.delete('/coaches/:coachId/assign/:assignmentId', auth, authorize('admin'), async (req, res, next) => {
  try {
    await pool.request()
      .input('assignmentId', req.params.assignmentId)
      .query(`DELETE FROM CoachAssignments WHERE AssignmentID=@assignmentId`);
    res.json({ success: true, message: 'Assignment removed' });
  } catch (err) {
    next(err);
  }
});


// GET /api/admin/members-assignments
router.get(
  '/members-assignments',
  auth,
  authorize('admin'),
  async (req, res, next) => {
    try {
      const result = await pool.request().query(`
        SELECT 
          m.UserID      AS MemberID,
          m.Email,
          m.FirstName   AS MemberFirstName,
          m.LastName    AS MemberLastName,
          c.UserID      AS CoachID,
          c.FirstName   AS CoachFirstName,
          c.LastName    AS CoachLastName,
          m.IsActive,
          m.CreatedAt
        FROM Users m
        LEFT JOIN CoachAssignments ca
          ON m.UserID = ca.MemberID
        LEFT JOIN Users c
          ON ca.CoachID = c.UserID AND c.role = 'coach'
        WHERE m.role = 'member'
        ORDER BY m.CreatedAt DESC
      `);
      res.json({ success: true, data: result.recordset });
    } catch (err) {
      next(err);
    }
  }
);


// GET /api/admin/members/:userId/detail
router.get(
  '/members/:userId/detail',
  auth,
  authorize('admin'),
  async (req, res, next) => {
    const { userId } = req.params;
    try {
      // 1) Profile
      const userRes = await pool.request()
        .input('userId', userId)
        .query(`
          SELECT UserID, Email, FirstName, LastName
          FROM Users
          WHERE UserID = @userId
        `);

      // 2) Smoking Status
      const statusRes = await pool.request()
        .input('userId', userId)
        .query(`
          SELECT CigarettesPerDay,
                 CigarettePrice,
                 SmokingFrequency,
                 LastUpdated
          FROM SmokingStatus
          WHERE UserID = @userId
        `);

      // 3) Quit Plan (chỉ lấy motivation + status)
      const planRes = await pool.request()
        .input('userId', userId)
        .query(`
          SELECT MotivationLevel,
                 Status
          FROM QuitPlans
          WHERE UserID = @userId
        `);

      // 4) Recent Progress
      const progRes = await pool.request()
        .input('userId', userId)
        .query(`
          SELECT Date,
                 CigarettesSmoked,
                 CravingLevel,
                 MoneySpent
          FROM ProgressTracking
          WHERE UserID = @userId
          ORDER BY Date DESC
          OFFSET 0 ROWS FETCH NEXT 30 ROWS ONLY
        `);

      // 5) Achievements unlocked (chỉ lấy tên)
      const achRes = await pool.request()
        .input('userId', userId)
        .query(`
          SELECT a.[Name] AS AchievementName
          FROM UserAchievements ua
          JOIN Achievements a
            ON ua.AchievementID = a.AchievementID
          WHERE ua.UserID = @userId
          ORDER BY ua.UserID        -- chỉ để có ORDER BY, thay thế nếu cần
        `);

      res.json({
        success: true,
        data: {
          profile:      userRes.recordset[0]   || null,
          status:       statusRes.recordset[0] || null,
          plan:         planRes.recordset[0]   || null,
          progress:     progRes.recordset,
          achievements: achRes.recordset,
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Error retrieving user detail' });
    }
  }
);

// GET /api/admin/achievements
router.get(
  '/achievements',
  auth,
  authorize('admin'),
  async (req, res, next) => {
    try {
      const result = await pool.request().query(`
        SELECT
          AchievementID,
          [Name],
          [Description],
          [IconURL],
          [Category],
          [MilestoneDays],
          [SavedMoney],
          [RequiredPlan],
          [Difficulty],
          [Points],
          [IsActive],
          CreatedAt
        FROM Achievements
        ORDER BY CreatedAt DESC
      `);
      res.json({ success: true, data: result.recordset });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/admin/achievements
router.post(
  '/achievements',
  auth,
  authorize('admin'),
  async (req, res, next) => {
    try {
      const {
        Name,
        Description,
        IconURL,
        Category,
        MilestoneDays,
        SavedMoney,
        RequiredPlan,
        Difficulty,
        Points,
        IsActive
      } = req.body;

      const insert = await pool.request()
        .input('Name',           Name)
        .input('Description',    Description  || '')
        .input('IconURL',        IconURL      || '')
        .input('Category',       Category     || '')
        .input('MilestoneDays',  MilestoneDays|| null)
        .input('SavedMoney',     SavedMoney   || null)
        .input('RequiredPlan',   RequiredPlan || null)
        .input('Difficulty',     Difficulty   || null)
        .input('Points',         Points       || null)
        .input('IsActive',       IsActive != null ? IsActive : 1)
        .query(`
          INSERT INTO Achievements
              ([Name],[Description],[IconURL],[Category],[MilestoneDays],
               [SavedMoney],[RequiredPlan],[Difficulty],[Points],[IsActive],CreatedAt)
          VALUES
              (@Name,@Description,@IconURL,@Category,@MilestoneDays,
               @SavedMoney,@RequiredPlan,@Difficulty,@Points,@IsActive,GETUTCDATE());
          SELECT SCOPE_IDENTITY() AS AchievementID;
        `);

      res.status(201).json({
        success: true,
        achievementId: insert.recordset[0].AchievementID
      });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/admin/achievements/:id
router.put(
  '/achievements/:id',
  auth,
  authorize('admin'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const {
        Name,
        Description,
        IconURL,
        Category,
        MilestoneDays,
        SavedMoney,
        RequiredPlan,
        Difficulty,
        Points,
        IsActive
      } = req.body;

      await pool.request()
        .input('id',             id)
        .input('Name',           Name)
        .input('Description',    Description  || '')
        .input('IconURL',        IconURL      || '')
        .input('Category',       Category     || '')
        .input('MilestoneDays',  MilestoneDays|| null)
        .input('SavedMoney',     SavedMoney   || null)
        .input('RequiredPlan',   RequiredPlan || null)
        .input('Difficulty',     Difficulty   || null)
        .input('Points',         Points       || null)
        .input('IsActive',       IsActive != null ? IsActive : 1)
        .query(`
          UPDATE Achievements
          SET
            [Name]          = @Name,
            [Description]   = @Description,
            [IconURL]       = @IconURL,
            [Category]      = @Category,
            [MilestoneDays] = @MilestoneDays,
            [SavedMoney]    = @SavedMoney,
            [RequiredPlan]  = @RequiredPlan,
            [Difficulty]    = @Difficulty,
            [Points]        = @Points,
            [IsActive]      = @IsActive
          WHERE AchievementID = @id
        `);

      res.json({ success: true, message: 'Achievement updated' });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/admin/achievements/:id
router.delete(
  '/achievements/:id',
  auth,
  authorize('admin'),
  async (req, res, next) => {
    try {
      await pool.request()
        .input('id', req.params.id)
        .query(`
          DELETE FROM Achievements
          WHERE AchievementID = @id
        `);
      res.json({ success: true, message: 'Achievement deleted' });
    } catch (err) {
      next(err);
    }
  }
);
// ------------------------------------------
// Achievements Progress
// ------------------------------------------
router.get('/achievements-progress', auth, authorize('admin'), async (req, res) => {
  try {
    // 1) Per-achievement award counts
    const ach = await pool.request().query(`
      SELECT
        a.AchievementID,
        a.[Name]           AS Name,
        a.[Description]    AS Description,
        COUNT(ua.UserID)   AS TimesAwarded
      FROM Achievements a
      LEFT JOIN UserAchievements ua
        ON a.AchievementID = ua.AchievementID
      GROUP BY
        a.AchievementID,
        a.[Name],
        a.[Description]
      ORDER BY TimesAwarded DESC
    `);

    // 2) User stats
    const usrRes = await pool.request().query(`
      SELECT
        COUNT(DISTINCT u.UserID)    AS TotalUsers,
        COUNT(DISTINCT ua.UserID)   AS UsersWithAchievements
      FROM Users u
      LEFT JOIN UserAchievements ua
        ON u.UserID = ua.UserID
    `);
    const usr = usrRes.recordset[0];

    // 3) Progress-tracking stats
    const prgRes = await pool.request().query(`
      SELECT
        COUNT(DISTINCT UserID)               AS UsersTrackingProgress,
        COUNT(*)                             AS TotalProgressEntries,
        AVG(CAST(CigarettesSmoked AS FLOAT)) AS AvgCigarettesSmoked,
        AVG(CAST(CravingLevel   AS FLOAT))   AS AvgCravingLevel,
        AVG(CAST(MoneySpent      AS FLOAT))  AS AvgMoneySpent
      FROM ProgressTracking
    `);
    const prg = prgRes.recordset[0];

    res.json({
      success: true,
      data: {
        achievements: ach.recordset,
        users: {
          TotalUsers:            usr.TotalUsers,
          UsersWithAchievements: usr.UsersWithAchievements
        },
        progress: {
          UsersTrackingProgress: prg.UsersTrackingProgress,
          TotalProgressEntries:  prg.TotalProgressEntries,
          AvgCigarettesSmoked:   Math.round(prg.AvgCigarettesSmoked || 0),
          AvgCravingLevel:       Math.round(prg.AvgCravingLevel   || 0),
          AvgMoneySpent:         Math.round(prg.AvgMoneySpent      || 0)
        }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error retrieving achievements-progress' });
  }
});


// GET /api/admin/reports/summary
router.get(
  '/reports/summary',
  auth,
  authorize('admin'),
  async (req, res, next) => {
    try {
      // Tổng số user (role = 'member')
      const totalUsersResult = await pool.request().query(`
        SELECT COUNT(*) AS totalUsers
        FROM Users
        WHERE role = 'member'
      `);
      const totalUsers = totalUsersResult.recordset[0].totalUsers;

      // Tổng số subscriptions
      const totalSubsResult = await pool.request().query(`
        SELECT COUNT(*) AS totalSubscriptions
        FROM UserMemberships
      `);
      const totalSubscriptions = totalSubsResult.recordset[0].totalSubscriptions;

      // Số subscriptions đang active
      const activeSubsResult = await pool.request().query(`
        SELECT COUNT(*) AS activeSubscriptions
        FROM UserMemberships
        WHERE Status = 'active'
      `);
      const activeSubscriptions = activeSubsResult.recordset[0].activeSubscriptions;

      // Doanh thu (giả sử trả tiền mỗi khi tạo subscription và lưu Amount trong Payments)
      const revenueResult = await pool.request().query(`
        SELECT SUM(p.Amount) AS totalRevenue
        FROM Payments p
        JOIN UserMemberships um ON p.UserID = um.UserID
        WHERE p.Status = 'confirmed'
      `);
      const totalRevenue = revenueResult.recordset[0].totalRevenue || 0;

      // Phân bổ subscriptions theo gói
      const byPlanResult = await pool.request().query(`
        SELECT 
          mp.PlanID,
          mp.Name         AS planName,
          COUNT(um.MembershipID) AS subscriberCount
        FROM UserMemberships um
        JOIN MembershipPlans mp ON um.PlanID = mp.PlanID
        GROUP BY mp.PlanID, mp.Name
        ORDER BY subscriberCount DESC
      `);
      const subscriptionsByPlan = byPlanResult.recordset;

      res.json({
        success: true,
        data: {
          totalUsers,
          totalSubscriptions,
          activeSubscriptions,
          totalRevenue,
          subscriptionsByPlan
        }
      });
    } catch (err) {
      console.error('Error in /api/admin/reports/summary:', err);
      next(err);
    }
  }
);


/**
 * GET /api/admin/subscriptions/expiring-soon?days=7
 * Trả về danh sách users có gói membership sắp hết hạn trong `days` ngày tới
 */
router.get(
  '/subscriptions/expiring-soon',
  auth,
  authorize('admin'),
  async (req, res, next) => {
    try {
      // nếu không truyền days, mặc định 7
      const days = parseInt(req.query.days, 10) || 7;

      // giả sử bảng UserMemberships có trường EndDate
      const result = await pool
        .request()
        .input('days', days)
        .query(`
          SELECT 
            u.UserID,
            u.Email,
            u.FirstName,
            u.LastName,
            mp.Name       AS PlanName,
            um.EndDate
          FROM UserMemberships um
          JOIN Users u   ON um.UserID = u.UserID
          JOIN MembershipPlans mp
            ON um.PlanID  = mp.PlanID
          WHERE 
            um.Status = 'active'
            AND um.EndDate BETWEEN GETUTCDATE() AND DATEADD(day, @days, GETUTCDATE())
          ORDER BY um.EndDate ASC
        `);

      res.json({
        success: true,
        data: result.recordset
      });
    } catch (err) {
      console.error(err);
      next(err);
    }
  }
);

// ------------------------------------------
// Xác nhận thanh toán
// ------------------------------------------
// Xác nhận thanh toán - đổi trạng thái từ 'pending' thành 'confirmed'
router.post('/confirm-payment', auth, authorize('admin'), async (req, res) => {
    const { paymentId, status } = req.body;
    const confirmedByUserID = req.user.id;  // Giả sử bạn lấy ID người xác nhận từ yêu cầu
    const confirmationDate = new Date();

    console.log('Payment ID received:', paymentId); // Log paymentId

    try {
        const paymentUpdate = await pool.request()
            .input('PaymentID', paymentId)
            .input('status', status)
            .query(`
                UPDATE Payments 
                SET Status = @status 
                WHERE PaymentID = @PaymentID AND Status = 'pending'
            `);

        if (paymentUpdate.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found or already confirmed'
            });
        }

        // Insert vào PaymentConfirmations
        await pool.request()
            .input('PaymentID', paymentId)
            .input('ConfirmationDate', confirmationDate)
            .input('ConfirmedByUserID', confirmedByUserID)
            .query(`
                INSERT INTO PaymentConfirmations (PaymentID, ConfirmationDate, ConfirmedByUserID)
                VALUES (@PaymentID, @ConfirmationDate, @ConfirmedByUserID)
            `);

        res.json({
            success: true,
            message: 'Payment confirmed successfully'
        });
    } catch (err) {
        console.error('Error confirming payment:', err);
        res.status(500).json({
            success: false,
            message: 'Error confirming payment'
        });
    }
});


// Lấy danh sách thanh toán chờ xác nhận (trạng thái 'pending')
router.get('/payments', auth, authorize('admin'), async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT PaymentID, UserID, Amount, PaymentMethod, Status
            FROM Payments
            WHERE Status = 'pending'
        `);

        res.json({
            success: true,
            data: result.recordset
        });
    } catch (err) {
        console.error('Error fetching pending payments:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching pending payments'
        });
    }
});

module.exports = router;

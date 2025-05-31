const { connectDB, pool } = require('./server/src/config/database');

(async () => {
    try {
        await connectDB();

        // Update blog post thumbnails to use SVG files
        await pool.request().query(`
      UPDATE BlogPosts 
      SET ThumbnailURL = '/api/images/blog/quit-smoking-journey.svg' 
      WHERE ThumbnailURL LIKE '%quit-smoking-journey%'
    `);

        await pool.request().query(`
      UPDATE BlogPosts 
      SET ThumbnailURL = '/api/images/blog/coping-with-cravings.svg' 
      WHERE ThumbnailURL LIKE '%coping-with-cravings%'
    `);

        await pool.request().query(`
      UPDATE BlogPosts 
      SET ThumbnailURL = '/api/images/blog/health-benefits.svg' 
      WHERE ThumbnailURL LIKE '%health-benefits%'
    `);

        await pool.request().query(`
      UPDATE BlogPosts 
      SET ThumbnailURL = '/api/images/default-blog.svg' 
      WHERE ThumbnailURL = '/api/images/default-blog.jpg'
    `);

        // Update achievement icon URLs to use API paths
        await pool.request().query(`
      UPDATE Achievements 
      SET IconURL = '/api/images/achievements/trophy-bronze.png' 
      WHERE IconURL = '/images/achievements/trophy-bronze.png'
    `);

        await pool.request().query(`
      UPDATE Achievements 
      SET IconURL = '/api/images/achievements/star-silver.png' 
      WHERE IconURL = '/images/achievements/star-silver.png'
    `);

        await pool.request().query(`
      UPDATE Achievements 
      SET IconURL = '/api/images/achievements/crown-gold.png' 
      WHERE IconURL = '/images/achievements/crown-gold.png'
    `);

        await pool.request().query(`
      UPDATE Achievements 
      SET IconURL = '/api/images/achievements/gem-diamond.png' 
      WHERE IconURL = '/images/achievements/gem-diamond.png'
    `);

        // Create missing achievement icons if they don't exist
        const result = await pool.request().query(`
      SELECT Name, IconURL FROM Achievements WHERE IconURL LIKE '%money%'
    `);

        if (result.recordset.length > 0) {
            await pool.request().query(`
      UPDATE Achievements 
      SET IconURL = '/api/images/achievements/money-bronze.png' 
      WHERE IconURL = '/images/achievements/money-bronze.png'
    `);

            await pool.request().query(`
      UPDATE Achievements 
      SET IconURL = '/api/images/achievements/money-silver.png' 
      WHERE IconURL = '/images/achievements/money-silver.png'
    `);

            await pool.request().query(`
      UPDATE Achievements 
      SET IconURL = '/api/images/achievements/money-gold.png' 
      WHERE IconURL = '/images/achievements/money-gold.png'
    `);
        }

        console.log('✅ Updated blog post thumbnail URLs to use SVG files');
        console.log('✅ Updated achievement icon URLs to use API paths');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error updating URLs:', error);
        process.exit(1);
    }
})(); 
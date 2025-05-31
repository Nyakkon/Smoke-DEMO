const fs = require('fs');

console.log('🔧 Fixing coach members SQL ORDER BY error...');

let content = fs.readFileSync('server/src/routes/chat.routes.js', 'utf8');

// Fix the ORDER BY clause that's causing 500 error
const oldOrderBy = 'ORDER BY c.LastMessageAt DESC, qp_latest.StartDate DESC, u.FirstName, u.LastName';
const newOrderBy = 'ORDER BY ISNULL(c.LastMessageAt, qp_latest.StartDate) DESC, u.FirstName, u.LastName';

if (content.includes(oldOrderBy)) {
    content = content.replace(oldOrderBy, newOrderBy);

    fs.writeFileSync('server/src/routes/chat.routes.js', content);
    console.log('✅ Fixed SQL ORDER BY clause');
    console.log('   Old:', oldOrderBy);
    console.log('   New:', newOrderBy);
} else {
    console.log('⚠️ ORDER BY clause not found or already fixed');
}

console.log('\n🚀 Now restart server: cd server && npm start'); 
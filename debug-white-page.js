const fs = require('fs');
const path = require('path');

console.log('🔍 DEBUGGING WHITE PAGE ISSUE');
console.log('=============================\n');

// 1. Check if essential files exist
console.log('1. 📁 Checking essential chat files...');
const chatFiles = [
    'client/src/components/chat/CoachChat.jsx',
    'client/src/components/chat/MemberList.jsx',
    'client/src/components/chat/ConversationList.jsx',
    'client/src/components/chat/ChatBox.jsx',
    'client/src/components/chat/index.js'
];

chatFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`✅ ${file} exists`);
    } else {
        console.log(`❌ ${file} MISSING!`);
    }
});

// 2. Check for common syntax issues
console.log('\n2. 🔍 Checking syntax issues...');

// Check CoachChat.jsx for common issues
console.log('\n📋 CoachChat.jsx issues:');
try {
    const coachChatContent = fs.readFileSync('client/src/components/chat/CoachChat.jsx', 'utf8');

    // Check for common JSX issues
    const issues = [];

    // Check for missing closing parentheses
    const openParens = (coachChatContent.match(/\(/g) || []).length;
    const closeParens = (coachChatContent.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
        issues.push(`❌ Parentheses mismatch: ${openParens} open, ${closeParens} close`);
    } else {
        console.log('✅ Parentheses balanced');
    }

    // Check for missing closing braces
    const openBraces = (coachChatContent.match(/\{/g) || []).length;
    const closeBraces = (coachChatContent.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
        issues.push(`❌ Braces mismatch: ${openBraces} open, ${closeBraces} close`);
    } else {
        console.log('✅ Braces balanced');
    }

    // Check for TabPane usage (should be Tabs.TabPane in newer versions)
    if (coachChatContent.includes('TabPane') && !coachChatContent.includes('Tabs.TabPane')) {
        console.log('⚠️ Warning: Using deprecated TabPane - should use Tabs.TabPane');
    }

    // Check for missing imports
    const requiredImports = ['React', 'useState', 'useEffect', 'Row', 'Col', 'Tabs'];
    requiredImports.forEach(imp => {
        if (!coachChatContent.includes(imp)) {
            issues.push(`❌ Missing import: ${imp}`);
        }
    });

    if (issues.length === 0) {
        console.log('✅ No obvious syntax issues found');
    } else {
        issues.forEach(issue => console.log(issue));
    }

} catch (error) {
    console.log('❌ Error reading CoachChat.jsx:', error.message);
}

// 3. Check package.json for Antd version
console.log('\n3. 📦 Checking Antd version...');
try {
    const packageJson = JSON.parse(fs.readFileSync('client/package.json', 'utf8'));
    const antdVersion = packageJson.dependencies?.antd || packageJson.devDependencies?.antd;
    if (antdVersion) {
        console.log(`✅ Antd version: ${antdVersion}`);
        if (antdVersion.includes('5.')) {
            console.log('⚠️ Warning: Antd v5 has breaking changes (TabPane deprecated)');
        }
    } else {
        console.log('❌ Antd not found in package.json');
    }
} catch (error) {
    console.log('❌ Error reading package.json:', error.message);
}

// 4. Check for component export issues
console.log('\n4. 🔗 Checking component exports...');
try {
    const indexContent = fs.readFileSync('client/src/components/chat/index.js', 'utf8');
    if (indexContent.includes('CoachChat')) {
        console.log('✅ CoachChat exported correctly');
    } else {
        console.log('❌ CoachChat not exported in index.js');
    }
} catch (error) {
    console.log('❌ Error reading chat/index.js:', error.message);
}

// 5. Common white page solutions
console.log('\n🔧 COMMON WHITE PAGE SOLUTIONS:');
console.log('================================');
console.log('1. 🔄 Clear browser cache (Ctrl+Shift+R)');
console.log('2. 🖥️ Check browser console (F12 → Console)');
console.log('3. 🌐 Check Network tab for failed requests');
console.log('4. 🔥 Clear localStorage: localStorage.clear()');
console.log('5. 📦 Update dependencies: npm install');
console.log('6. 🧹 Clean build: npm run build');
console.log('7. 🔄 Restart dev server: npm start');

console.log('\n🐛 DEBUGGING STEPS:');
console.log('==================');
console.log('1. Open browser DevTools (F12)');
console.log('2. Check Console for JavaScript errors');
console.log('3. Check Network tab for 500/400 errors');
console.log('4. Check Application > Local Storage for auth data');
console.log('5. Try login again if token expired');
console.log('6. Check if server is running on port 4000');

console.log('\n💡 QUICK FIXES TO TRY:');
console.log('======================');
console.log('// In browser console:');
console.log('localStorage.clear();');
console.log('location.reload();');
console.log('');
console.log('// Or login again:');
console.log('- Go to login page');
console.log('- Login with: coach@example.com / password123');
console.log('- Try accessing chat again');

console.log('\n🔧 If still white page, check:');
console.log('- Is server running? (http://localhost:4000)');
console.log('- Any JavaScript errors in console?');
console.log('- Are all imports correct?');
console.log('- Is authentication token valid?'); 
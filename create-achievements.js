const fs = require('fs');
const path = require('path');

const icons = {
    'star-silver.png': `<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="silverGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#E6E6FA;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#C0C0C0;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#A9A9A9;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Star shape -->
  <polygon points="32,8 40,24 58,24 44,36 48,54 32,44 16,54 20,36 6,24 24,24" 
           fill="url(#silverGradient)" stroke="#808080" stroke-width="2"/>
  
  <!-- Inner star -->
  <polygon points="32,16 36,28 48,28 38,36 42,48 32,42 22,48 26,36 16,28 28,28" 
           fill="#F5F5F5"/>
           
  <!-- Shine effects -->
  <circle cx="28" cy="20" r="2" fill="#FFFFFF" opacity="0.8"/>
  <circle cx="38" cy="24" r="1.5" fill="#FFFFFF" opacity="0.6"/>
</svg>`,

    'crown-gold.png': `<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="goldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#FFD700;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#FFA500;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#FF8C00;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Crown base -->
  <rect x="12" y="40" width="40" height="8" fill="url(#goldGradient)" rx="2"/>
  
  <!-- Crown points -->
  <polygon points="12,40 18,20 24,35 32,12 40,35 46,20 52,40" fill="url(#goldGradient)"/>
  
  <!-- Gems -->
  <circle cx="18" cy="24" r="3" fill="#FF0000"/>
  <circle cx="32" cy="18" r="4" fill="#0000FF"/>
  <circle cx="46" cy="24" r="3" fill="#00FF00"/>
  
  <!-- Crown details -->
  <rect x="14" y="38" width="36" height="3" fill="#FFFF88"/>
</svg>`,

    'gem-diamond.png': `<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="diamondGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#E8F5FF;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#B8E6FF;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#87CEEB;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Diamond shape -->
  <polygon points="32,8 48,24 32,56 16,24" fill="url(#diamondGradient)" stroke="#4682B4" stroke-width="2"/>
  
  <!-- Diamond facets -->
  <polygon points="32,8 40,24 32,32 24,24" fill="#F0F8FF"/>
  <polygon points="24,24 32,32 16,24" fill="#E0F6FF"/>
  <polygon points="40,24 48,24 32,32" fill="#E0F6FF"/>
  <polygon points="32,32 32,56 16,24" fill="#D0F0FF"/>
  <polygon points="32,32 48,24 32,56" fill="#D0F0FF"/>
  
  <!-- Sparkles -->
  <circle cx="20" cy="16" r="1" fill="#FFFFFF"/>
  <circle cx="44" cy="20" r="1.5" fill="#FFFFFF"/>
  <circle cx="48" cy="40" r="1" fill="#FFFFFF"/>
</svg>`
};

console.log('Creating achievement icons...');

const achievementsDir = 'server/src/public/images/achievements';

// Create achievement icons
Object.entries(icons).forEach(([filename, content]) => {
    const filePath = path.join(achievementsDir, filename);

    // Delete if exists
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    // Write new content
    fs.writeFileSync(filePath, content);
    console.log(`✅ Created ${filename}`);
});

console.log('🎉 Achievement icons created!'); 
const fs = require('fs');
const path = 'context/AppContext.tsx';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

// We want to remove lines 1555 to 1749 (1-based)
// Arrays are 0-based, so index 1554 to 1748
const newLines = [
    ...lines.slice(0, 1554),
    ...lines.slice(1749)
];

fs.writeFileSync(path, newLines.join('\n'));
console.log('Fixed AppContext.tsx');

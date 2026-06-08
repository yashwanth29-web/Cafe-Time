const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync('eslint.json', 'utf8').replace(/^\uFEFF/, ''));
const results = [];
data.forEach(file => {
    file.messages.forEach(msg => {
        if (msg.ruleId !== 'no-unused-vars') {
            results.push(`${path.basename(file.filePath)}:${msg.line}:${msg.column} - ${msg.message} (${msg.ruleId})`);
        }
    });
});
console.log(results.join('\n'));

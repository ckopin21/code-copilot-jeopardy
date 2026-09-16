const fs = require('node:fs');
fs.mkdirSync('dist-server', { recursive: true });
fs.writeFileSync('dist-server/package.json', JSON.stringify({ type: 'commonjs' }));

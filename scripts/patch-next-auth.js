
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'node_modules', 'next-auth', 'lib', 'env.js');

try {
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        if (content.includes('"next/server"')) {
            console.log('Found problematic import. Patching...');
            content = content.replace('"next/server"', '"next/server.js"');
            fs.writeFileSync(filePath, content);
            console.log('✅ Patched next-auth/lib/env.js');
        } else if (content.includes('"next/server.js"')) {
            console.log('Already patched.');
        } else {
            console.log('⚠️ Could not find "next/server" string in file. Content might be different.');
            console.log('File content preview:', content.slice(0, 500));
        }
    } else {
        console.error('❌ File not found:', filePath);
    }
} catch (error) {
    console.error('❌ Error patching:', error);
}

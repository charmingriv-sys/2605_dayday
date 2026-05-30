// tests/security/security_scan_test.mjs
// Static Security Credential Scanner

import fs from 'fs';
import path from 'path';

console.log('--- Starting Static Security Credential Scan ---');

const TARGET_DIR = path.resolve('.');
const EXCLUDE_DIRS = ['.git', 'node_modules', 'scratch', 'tests/fixtures'];
const EXCLUDE_FILES = ['security_scan_test.mjs']; // self exclude

const RULES = [
    { name: 'GitHub Personal Access Token (Classic)', regex: /ghp_[a-zA-Z0-9]{36}/, level: 'CRITICAL' },
    { name: 'GitHub Fine-grained Personal Access Token', regex: /github_pat_[a-zA-Z0-9_]{82}/, level: 'CRITICAL' },
    { name: 'Generic Private Key Header', regex: /-----BEGIN[ A-Z0-9_-]+PRIVATE KEY-----/, level: 'CRITICAL' },
    { name: 'Supabase Service Role Key Indicator', regex: /SUPABASE_SERVICE_ROLE/i, level: 'WARNING' },
    { name: 'Toss Secret Key Indicator', regex: /TOSS_SECRET/i, level: 'WARNING' },
    { name: 'Kakao Secret Key Indicator', regex: /KAKAO_SECRET/i, level: 'WARNING' }
];

const FILE_PATTERN_RULES = [
    { pattern: /\.env$/, name: 'Environment Configuration File (.env)', level: 'CRITICAL' },
    { pattern: /\.pem$/, name: 'PEM Private Key File (.pem)', level: 'CRITICAL' },
    { pattern: /\.key$/, name: 'Key File (.key)', level: 'CRITICAL' },
    { pattern: /\.backup$/, name: 'Backup Data File (.backup)', level: 'WARNING' }
];

let filesScannedCount = 0;
const violations = [];

function scanDirectory(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const relPath = path.relative(TARGET_DIR, fullPath);
        
        // Skip excluded directories/files
        if (EXCLUDE_DIRS.some(ex => relPath === ex || relPath.startsWith(ex + path.sep))) {
            continue;
        }
        if (EXCLUDE_FILES.includes(item)) {
            continue;
        }

        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            scanDirectory(fullPath);
        } else if (stat.isFile()) {
            filesScannedCount++;
            
            // Check file name rules
            for (const rule of FILE_PATTERN_RULES) {
                if (rule.pattern.test(item)) {
                    violations.push({
                        type: 'FILE_PATTERN',
                        name: rule.name,
                        file: relPath,
                        level: rule.level,
                        detail: `Matched file pattern: ${item}`
                    });
                }
            }

            // Check file content rules for text files
            const ext = path.extname(item).toLowerCase();
            const textExtensions = ['.js', '.mjs', '.html', '.css', '.md', '.json', '.sql', '.txt', '.xml', '.yml', '.yaml', '.sh', '.bat'];
            if (textExtensions.includes(ext)) {
                try {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    const lines = content.split('\n');
                    
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];
                        
                        // Run rules
                        for (const rule of RULES) {
                            if (rule.regex.test(line)) {
                                // Exclude lines that are clearly documentation examples or safe comments
                                const isDemoOrMock = /mock|demo|example|sample|placeholder|test_instance|your_supabase|dummy/i.test(line) 
                                    || relPath.startsWith('docs' + path.sep) 
                                    || relPath.startsWith('tests' + path.sep);
                                
                                violations.push({
                                    type: 'CONTENT_MATCH',
                                    name: rule.name,
                                    file: relPath,
                                    line: i + 1,
                                    level: rule.level,
                                    isMock: isDemoOrMock,
                                    snippet: line.trim().slice(0, 100)
                                });
                            }
                        }
                    }
                } catch (err) {
                    // Ignore read errors for binary or locked files
                }
            }
        }
    }
}

scanDirectory(TARGET_DIR);

console.log(`Scan completed. Total files scanned: ${filesScannedCount}`);

const realCriticalViolations = violations.filter(v => v.level === 'CRITICAL' && !v.isMock);
const warnings = violations.filter(v => v.level === 'WARNING' || v.isMock);

if (realCriticalViolations.length > 0) {
    console.error(`\n❌ SECURITY ALERT: Found ${realCriticalViolations.length} critical secret leak(s)!`);
    realCriticalViolations.forEach(v => {
        console.error(`  - [${v.level}] ${v.name} in ${v.file}:${v.line || 'N/A'}`);
        if (v.snippet) console.error(`    Snippet: ${v.snippet}`);
    });
} else {
    console.log('\n✓ No critical production credentials or secrets found.');
}

if (warnings.length > 0) {
    console.log(`\n[Info/Warnings] Found ${warnings.length} occurrences (Mock credentials, docs, or minor warnings):`);
    warnings.forEach(v => {
        const prefix = v.isMock ? '[MOCK/DOCS]' : `[${v.level}]`;
        console.log(`  - ${prefix} ${v.name} in ${v.file}:${v.line || 'N/A'}`);
        if (v.snippet) console.log(`    Snippet: ${v.snippet}`);
    });
}

// Exit with 0 if no real production secrets are leaked
if (realCriticalViolations.length > 0) {
    process.exit(1);
} else {
    process.exit(0);
}

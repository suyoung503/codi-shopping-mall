const { hashPassword, isPasswordHash, validPasswordInput } = require('../lib/passwords');

async function migratePasswords(db, { apply = false, hash = hashPassword } = {}) {
    let started = false;
    try {
        if (apply) { await db.beginTransaction(); started = true; }
        const [rows] = await db.execute('SELECT id, password FROM users');
        const pending = rows.filter(row => !isPasswordHash(row.password));
        // This tool is only for this project's known plaintext schema, not other hash formats.
        if (pending.some(row => !validPasswordInput(row.password) || row.password.startsWith('scrypt$'))) {
            throw new Error('Unsupported password rows; reset or review them before migration.');
        }
        if (apply) {
            for (const row of pending) {
                const encoded = await hash(row.password);
                const [result] = await db.execute(
                    'UPDATE users SET password = ? WHERE id = ? AND BINARY password = BINARY ?',
                    [encoded, row.id, row.password]
                );
                if (result.affectedRows !== 1) throw new Error('Concurrent account change; migration rolled back.');
            }
            await db.commit();
        }
        return { total: rows.length, alreadyHashed: rows.length - pending.length, pending: pending.length, applied: apply ? pending.length : 0 };
    } catch (error) {
        if (started) await db.rollback();
        throw error;
    }
}

async function main() {
    require('dotenv').config();
    const args = process.argv.slice(2);
    if (args.some(arg => arg !== '--apply')) throw new Error('Usage: node scripts/migrate-passwords.js [--apply]');
    const db = await require('mysql2/promise').createConnection({
        host: process.env.DB_HOST || 'localhost', user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME || 'product'
    });
    try {
        console.log(JSON.stringify(await migratePasswords(db, { apply: args.includes('--apply') })));
    } finally {
        await db.end();
    }
}

if (require.main === module) main().catch(() => {
    console.error('비밀번호 전환 실패. 연결·스키마·지원되지 않는 값·동시 변경 여부를 확인하세요. DB 오류나 계정 정보는 출력하지 않습니다.');
    process.exitCode = 1;
});
module.exports = { migratePasswords };

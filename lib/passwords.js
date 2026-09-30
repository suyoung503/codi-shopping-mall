const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');

const derive = promisify(scrypt);
// OWASP scrypt minimum: N=2^17, r=8, p=1 (approximately 128 MiB per job).
const OPTIONS = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const HASH_PATTERN = /^scrypt\$131072\$8\$1\$([0-9a-f]{32})\$([0-9a-f]{128})$/;
let activeJobs = 0;

function validPasswordInput(value) {
    return typeof value === 'string' && value.length > 0 && Buffer.byteLength(value, 'utf8') <= 1024;
}

function isPasswordHash(value) {
    return typeof value === 'string' && HASH_PATTERN.test(value);
}

async function deriveKey(password, salt) {
    // Bound memory usage; callers return a retryable error rather than queuing unbounded work.
    if (activeJobs >= 2) {
        const error = new Error('Password service busy');
        error.code = 'AUTH_BUSY';
        throw error;
    }
    activeJobs += 1;
    try {
        return await derive(password, salt, 64, OPTIONS);
    } finally {
        activeJobs -= 1;
    }
}

async function hashPassword(password) {
    if (!validPasswordInput(password)) throw new TypeError('Invalid password input');
    const salt = randomBytes(16);
    const key = await deriveKey(password, salt);
    return `scrypt$131072$8$1$${salt.toString('hex')}$${key.toString('hex')}`;
}

async function verifyPassword(password, stored) {
    if (!validPasswordInput(password) || !isPasswordHash(stored)) return false;
    const [, salt, expected] = stored.match(HASH_PATTERN);
    const actual = await deriveKey(password, Buffer.from(salt, 'hex'));
    return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}

module.exports = { hashPassword, verifyPassword, isPasswordHash, validPasswordInput };

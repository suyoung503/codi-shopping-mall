const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const session = require('express-session');
const { createApp } = require('../codi');
const { hashPassword, verifyPassword, isPasswordHash } = require('../lib/passwords');
const { clothesQuery, bestClothesQuery } = require('../lib/product-queries');
const { migratePasswords } = require('../scripts/migrate-passwords');

test('scrypt uses random salts, verifies Unicode, rejects wrong/plaintext/malformed values', async () => {
    const password = '안전한 비밀번호 🔐';
    const a = await hashPassword(password);
    const b = await hashPassword(password);
    assert.notEqual(a, b);
    assert.ok(isPasswordHash(a));
    assert.ok(a.length <= 255);
    assert.equal(await verifyPassword(password, a), true);
    assert.equal(await verifyPassword('incorrect', a), false);
    assert.equal(await verifyPassword(password, password), false);
    assert.equal(await verifyPassword(password, a.replace('131072', '999999999')), false);
    assert.equal(await verifyPassword(password, a.slice(0, -1)), false);
    assert.equal(await verifyPassword({ password }, a), false);
    await assert.rejects(hashPassword('a'.repeat(1025)));
    await assert.rejects(hashPassword(''));
});

test('product queries bind category/search values, including SQL-looking strings', () => {
    const attack = "' OR 1=1 --";
    assert.deepEqual(clothesQuery({ category: attack, search: attack }), {
        sql: 'SELECT * FROM PT WHERE category = ? AND name LIKE ?', values: [attack, `%${attack}%`]
    });
    assert.deepEqual(clothesQuery({}), { sql: 'SELECT * FROM PT', values: [] });
    assert.deepEqual(clothesQuery({ category: '상의' }).values, ['상의']);
    assert.deepEqual(clothesQuery({ search: '셔츠' }).values, ['%셔츠%']);
    assert.equal(bestClothesQuery({ category: attack }).sql, 'SELECT * FROM PT WHERE category = ? ORDER BY `like` DESC');
    assert.deepEqual(bestClothesQuery({ category: attack }).values, [attack]);
    assert.equal(bestClothesQuery({}).sql, 'SELECT * FROM PT ORDER BY `like` DESC');
    for (const invalid of [[], {}, 12, null]) {
        assert.throws(() => clothesQuery({ search: invalid }));
        assert.throws(() => bestClothesQuery({ category: invalid }));
    }
    assert.throws(() => clothesQuery({ search: 'a'.repeat(201) }));
});

function fakeDatabase() {
    const users = new Map();
    const calls = [];
    return {
        users, calls, fail: false,
        execute(sql, values, cb) {
            calls.push({ sql, values });
            if (this.fail) return cb(new Error('PRIVATE_DATABASE_DETAILS'));
            if (sql.startsWith('SELECT id FROM users')) return cb(null, users.has(values[0]) ? [{ id: values[0] }] : []);
            if (sql.startsWith('INSERT INTO users')) {
                if (users.has(values[0])) return cb(Object.assign(new Error('duplicate'), { code: 'ER_DUP_ENTRY' }));
                users.set(values[0], { id: values[0], password: values[1], address: values[2], phone: values[3] });
                return cb(null, { affectedRows: 1 });
            }
            if (sql.startsWith('SELECT id, password')) return cb(null, users.has(values[0]) ? [{ ...users.get(values[0]) }] : []);
            if (sql.startsWith('SELECT * FROM PT')) return cb(null, []);
            throw new Error(`Unexpected test query: ${sql}`);
        }
    };
}

test('HTTP signup/login and search regressions with a fake DB; no real account data', async t => {
    const db = fakeDatabase();
    const store = new session.MemoryStore();
    const app = createApp({ db, sessionStore: store });
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise(resolve => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}`;
    const post = (url, body, cookie) => fetch(base + url, {
        method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body)
    });
    const account = { id: 'test-user', pw: 'long-test-password', address: 'test', phone: '000-0000-0000' };
    let response = await post('/register', account);
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/login');
    assert.ok(isPasswordHash(db.users.get(account.id).password));
    assert.notEqual(db.users.get(account.id).password, account.pw);
    response = await post('/register', account);
    assert.equal(response.headers.get('location'), '/register?error=duplicate');
    for (const body of [{ ...account, id: {} }, { ...account, pw: ['bad'] }, { ...account, pw: 'short' }]) {
        assert.equal((await post('/register', body)).status, 400);
    }
    response = await post('/login', { username: account.id, password: account.pw });
    assert.equal(response.headers.get('location'), '/');
    const cookie = response.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    const sessions = await new Promise((resolve, reject) => store.all((e, data) => e ? reject(e) : resolve(data)));
    const saved = Object.values(sessions)[0];
    assert.equal(saved.userId, account.id);
    assert.equal('password' in saved.user, false);
    assert.deepEqual(Object.keys(saved.user).sort(), ['address', 'id', 'phone']);
    const secondLogin = await post('/login', { username: account.id, password: account.pw }, cookie.split(';')[0]);
    assert.notEqual(secondLogin.headers.get('set-cookie').split(';')[0], cookie.split(';')[0]);
    for (const body of [
        { username: account.id, password: 'wrong' },
        { username: "' OR 1=1 --", password: account.pw }
    ]) assert.equal((await post('/login', body)).headers.get('location'), '/login?error=invalid_credentials');
    db.users.set('legacy', { id: 'legacy', password: 'old-plain-password' });
    assert.equal((await post('/login', { username: 'legacy', password: 'old-plain-password' })).headers.get('location'), '/login?error=invalid_credentials');
    assert.equal((await post('/login', { username: {}, password: account.pw })).status, 400);
    const attack = "' OR 1=1 --";
    response = await fetch(base + '/api/clothes?' + new URLSearchParams({ category: attack, search: attack }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), []);
    assert.deepEqual(db.calls.at(-1), clothesQuery({ category: attack, search: attack }));
    response = await fetch(base + '/clothes/best?' + new URLSearchParams({ category: attack }));
    assert.equal(response.status, 200);
    assert.deepEqual(db.calls.at(-1), bestClothesQuery({ category: attack }));
    assert.equal((await fetch(base + '/api/clothes?search[]=x')).status, 400);
    assert.equal((await fetch(base + '/clothes/best?category[]=x')).status, 400);
    db.fail = true;
    response = await post('/login', { username: account.id, password: account.pw });
    assert.equal(response.status, 500);
    assert.doesNotMatch(await response.text(), /PRIVATE_DATABASE_DETAILS/);
});

test('legacy migration defaults to dry-run, skips hashes, uses conditional writes and rollback', async () => {
    const encoded = 'scrypt$131072$8$1$' + 'a'.repeat(32) + '$' + 'b'.repeat(128);
    const rows = [{ id: 'old', password: 'old-password' }, { id: 'new', password: encoded }];
    const events = [];
    let affectedRows = 1;
    const db = {
        async execute(sql, values) { events.push({ sql, values }); return sql.startsWith('SELECT') ? [rows] : [{ affectedRows }]; },
        async beginTransaction() { events.push('begin'); },
        async commit() { events.push('commit'); },
        async rollback() { events.push('rollback'); }
    };
    assert.deepEqual(await migratePasswords(db), { total: 2, alreadyHashed: 1, pending: 1, applied: 0 });
    assert.equal(events.length, 1);
    assert.equal((await migratePasswords(db, { apply: true, hash: async () => encoded })).applied, 1);
    const update = events.find(e => e.sql?.startsWith('UPDATE'));
    assert.match(update.sql, /BINARY password = BINARY \?/);
    assert.deepEqual(update.values, [encoded, 'old', 'old-password']);
    assert.equal(events.at(-1), 'commit');
    affectedRows = 0;
    await assert.rejects(migratePasswords(db, { apply: true, hash: async () => encoded }));
    assert.equal(events.at(-1), 'rollback');
    rows[0].password = 'scrypt$malformed';
    await assert.rejects(migratePasswords(db));
});

test('production startup rejects absent or placeholder session secrets', () => {
    const previousEnv = process.env.NODE_ENV;
    const previousSecret = process.env.SESSION_SECRET;
    try {
        process.env.NODE_ENV = 'production';
        for (const secret of ['', 'short', 'replace_with_a_random_secret']) {
            process.env.SESSION_SECRET = secret;
            assert.throws(() => createApp({ db: fakeDatabase() }), /SESSION_SECRET/);
        }
    } finally {
        if (previousEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousEnv;
        if (previousSecret === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = previousSecret;
    }
});

test('my page never renders a stored password or hash', async () => {
    const path = require('node:path');
    const ejs = require('ejs');
    const html = await ejs.renderFile(path.join(__dirname, '../views/myPage.ejs'), {
        user: { id: 'test-user', address: '', phone: '', password: 'DO_NOT_RENDER_PASSWORD' }, ptData: []
    });
    assert.doesNotMatch(html, /DO_NOT_RENDER_PASSWORD|비밀번호:/);
});

const { hashPassword, verifyPassword, validPasswordInput } = require('./passwords');

const text = (value, max, required = true) =>
    typeof value === 'string' && (!required || value.trim().length > 0) && value.length <= max;

function execute(db, sql, params) {
    return new Promise((resolve, reject) => db.execute(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
}

function authError(res, error) {
    // Do not expose SQL, connection details, plaintext passwords, or stored hashes.
    if (error.code === 'AUTH_BUSY') return res.status(503).send('요청이 많습니다. 잠시 후 다시 시도해 주세요.');
    return res.status(500).send('요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.');
}

function registerAuthRoutes(app, db) {
    app.post('/register', async (req, res) => {
        const { id, pw, address = '', phone } = req.body || {};
        if (!text(id, 50) || !validPasswordInput(pw) || pw.length < 8 || !text(address, 255, false) || !text(phone, 20)) {
            return res.status(400).send('입력 형식을 확인해 주세요. 비밀번호는 8자 이상, UTF-8 기준 1024바이트 이하입니다.');
        }
        try {
            const found = await execute(db, 'SELECT id FROM users WHERE id = ?', [id]);
            if (found.length) return res.redirect('/register?error=duplicate');
            const encoded = await hashPassword(pw);
            await execute(db, 'INSERT INTO users (id, password, address, phone) VALUES (?, ?, ?, ?)', [id, encoded, address, phone]);
            return res.redirect('/login');
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') return res.redirect('/register?error=duplicate');
            return authError(res, error);
        }
    });

    app.post('/login', async (req, res) => {
        const { username, password } = req.body || {};
        if (!text(username, 50) || !validPasswordInput(password)) return res.status(400).send('로그인 입력 형식을 확인해 주세요.');
        try {
            const rows = await execute(db, 'SELECT id, password, address, phone FROM users WHERE id = ?', [username]);
            const user = rows[0];
            // No plaintext fallback. Existing rows must be migrated offline first.
            if (!user || !await verifyPassword(password, user.password)) return res.redirect('/login?error=invalid_credentials');
            await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
            req.session.userId = user.id;
            req.session.user = { id: user.id, address: user.address, phone: user.phone };
            await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
            return res.redirect('/');
        } catch (error) {
            return authError(res, error);
        }
    });
}

module.exports = { registerAuthRoutes };

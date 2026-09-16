require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const session = require('express-session');
const bodyParser = require('body-parser');
const app = express();
const port = 3002;

const connection = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'product'
});

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-only-change-me',
    resave: false,
    saveUninitialized: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.set('view engine', 'ejs'); // EJS를 뷰 엔진으로 사용
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads/:codi_id/:filename', (req, res, next) => {
    const { codi_id, filename } = req.params;
    const filePath = path.join(__dirname, 'uploads', codi_id, filename);
    res.sendFile(filePath);
});

function requireLogin(req, res, next) {
    if (req.session && req.session.userId) {
        return next();
    } else {
        return res.redirect('/login');
    }
}

app.get('/', (req, res) => {
    const query = 'SELECT * FROM Codi ORDER BY FIELD(weather, "봄", "여름", "가을", "겨울")';
    connection.query(query, (err, results) => {
        if (err) {
            console.error('데이터베이스 오류:', err);
            res.status(500).send('서버 오류');
        } else {
            let html = `<!DOCTYPE html>
            <html lang="ko">
            <head>
                <meta charset="UTF-8">
                <title>코디 목록</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        margin: 0;
                        padding: 20px;
                    }
                    nav {
                        width: 100%;
                        background-color: #333;
                        overflow: hidden;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .nav-left, .nav-right {
                        display: flex;
                    }
                    .nav-left {
                        margin-left: 20px;
                    }
                    .nav-right {
                        margin-right: 20px;
                    }
                    nav ul {
                        margin: 0;
                        padding: 0;
                        list-style: none;
                        display: flex;
                    }
                    nav ul li {
                        display: inline;
                    }
                    nav ul li a {
                        display: block;
                        color: white;
                        text-align: center;
                        padding: 14px 16px;
                        text-decoration: none;
                    }
                    nav ul li a:hover {
                        background-color: #ddd;
                        color: black;
                    }
                    .banner {
                        background-color: #f0f0f0;
                        text-align: center;
                        padding: 10px 0;
                        margin-bottom: 20px;
                    }
                    .banner-text {
                        font-size: 20px;
                        font-weight: bold;
                    }
                    .season-grid {
                        margin-bottom: 30px;
                    }
                    .season-title {
                        text-align: center;
                        font-size: 24px;
                        margin-bottom: 10px;
                    }
                    .codi-grid {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 20px;
                    }
                    .codi-item {
                        border: 1px solid #ccc;
                        padding: 10px;
                        text-align: center;
                        cursor: pointer;
                    }
                    .codi-img {
                        max-width: 100%;
                        height: auto;
                    }
                </style>
            </head>
            <body>
                <nav>
                    <div class="nav-left">
                        <ul>
                            <li><a href="/">아뜨랑스에 오신걸 환영합니다</a></li>
                        </ul>
                    </div>
                    <div class="nav-right">
                        <ul>
                            <li><a href="/">코디</a></li>
                            <li><a href="/clothes">옷</a></li>`;

            if (req.session.user) {
                html += `<li><a href="/mypage">마이페이지</a></li>
                         <li><a href="/logout">로그아웃</a></li>`;
            } else {
                html += `<li><a href="/login">로그인</a></li>`;
            }

            html += `       </ul>
                    </div>
                </nav>
                <div class="banner">
                    <p class="banner-text">어서오세요 아뜨랑스에!</p>
                </div>`;

           
            const codisByWeather = {};
            results.forEach(codi => {
                if (!codisByWeather[codi.weather]) {
                    codisByWeather[codi.weather] = [];
                }
                codisByWeather[codi.weather].push(codi);
            });

         
            Object.keys(codisByWeather).forEach(weather => {
                html += `<div class="season-grid">
                            <h2 class="season-title">${weather}</h2>
                            <div class="codi-grid">`;

                codisByWeather[weather].forEach(codi => {
                    const imageUrl = `/uploads/${codi.codi_id}/${path.basename(codi.photo_path)}`;
                    html += `<div class="codi-item">
                                <a href="/codi/${codi.codi_id}"><img class="codi-img" src="${imageUrl}" alt="코디 이미지"></a>
                             </div>`;
                });

                html += `       </div>
                        </div>`;
            });

            html += `</body>
                    </html>`;
            res.send(html);
        }
    });
});


app.get('/check-login-status', (req, res) => {
    if (req.session && req.session.userId) {
        res.json({ loggedIn: true });
    } else {
        res.json({ loggedIn: false });
    }
});
const router = express.Router();


app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});
module.exports = router;

// 파일 업로드 및 데이터베이스 저장 라우팅
app.post('/upload', upload.fields([{ name: 'codiPhoto', maxCount: 1 }, { name: 'image[]'}]), (req, res) => {
    const productInfo = req.body;
    const codiPhoto = req.files['codiPhoto'] ? req.files['codiPhoto'][0].path : null;
    const weather = productInfo.weather;
    let codiId;

    if (codiPhoto) {
        // 코디사진을 Codi 테이블에 삽입
        const codiQuery = 'INSERT INTO Codi (photo_path, weather) VALUES (?, ?)';
        connection.execute(codiQuery, [codiPhoto, weather], (err, results) => {
            if (err) {
                console.error('코디사진 데이터베이스 오류:', err);
                res.status(500).send('서버 오류');
                return;
            }
            // 삽입된 코디 사진의 ID를 가져옴
            codiId = results.insertId;
            // 코디 폴더 생성 및 사진 이동
            handleCodiFolder(codiPhoto, req.files['image[]'], codiId, () => {
                // 상품 등록 처리
                registerProducts(productInfo, req.files['image[]'], codiId, res);
            });
        });
    } else {
        // 코디사진이 없으면 즉시 상품 등록 처리
        registerProducts(productInfo, req.files['image[]'], codiId, res);
    }
});

// 코디 폴더 생성 및 파일 이동 함수
function handleCodiFolder(codiPhoto, images, codiId, callback) {
    const codiDir = path.join(__dirname, 'uploads', `${codiId}`);
    if (!fs.existsSync(codiDir)) {
        fs.mkdirSync(codiDir, { recursive: true });
    }

    // 코디사진 이동
    if (codiPhoto) {
        const codiPhotoFilename = path.basename(codiPhoto);
        const codiPhotoDest = path.join(codiDir, codiPhotoFilename);
        fs.rename(codiPhoto, codiPhotoDest, (err) => {
            if (err) {
                console.error('코디사진 이동 오류:', err);
                return;
            }
        });
    }

    // 상품 이미지 이동
    images.forEach(image => {
        const imageFilename = path.basename(image.path);
        const imageDest = path.join(codiDir, imageFilename);
        fs.rename(image.path, imageDest, (err) => {
            if (err) {
                console.error('상품 이미지 이동 오류:', err);
                return;
            }
        });
    });

    callback();
}
// 상품 등록 함수
function registerProducts(productInfo, images, codiId, res) {
    const productNames = Array.isArray(productInfo.name) ? productInfo.name : [productInfo.name];
    const categories = Array.isArray(productInfo.category) ? productInfo.category : [productInfo.category];
    const colors = Array.isArray(productInfo.color) ? productInfo.color : [productInfo.color];
    const prices = Array.isArray(productInfo.price) ? productInfo.price : [productInfo.price];
    const imageCounts = Array.isArray(productInfo.imageCount) ? productInfo.imageCount : [productInfo.imageCount];

    let currentImageIndex = 0;

    productNames.forEach((productName, index) => {
        const category = categories[index];
        const color = colors[index];
        const price = prices[index];
        const imageCount = parseInt(imageCounts[index], 10);

        // 이미지 경로 처리
        const imagePaths = images.slice(currentImageIndex, currentImageIndex + imageCount)
            .map(image => path.resolve(image.path)).join(',');

        // 다음 이미지 인덱스를 업데이트
        currentImageIndex += imageCount;

        // 상품 등록 쿼리
        const query = 'INSERT INTO PT (name, image, category, color, price, codi_id, `like`) VALUES (?, ?, ?, ?, ?, ?, ?)';
        connection.execute(query, [productName, imagePaths, category, color, price, codiId, 0], (err, results) => {
            if (err) {
                console.error('상품 데이터베이스 오류:', err);
                res.status(500).send('서버 오류');
                return;
            }
        });
    });
    res.redirect('/myPage');
}
// 회원가입 페이지로 이동하는 경로 처리
app.get('/register', (req, res) => {
   
    res.sendFile(path.join(__dirname, 'register.html'));
});
// 회원가입 처리
app.post('/register', (req, res) => {
    const { id, pw, address, phone } = req.body;
    const checkQuery = 'SELECT * FROM users WHERE id = ?';
    const insertQuery = 'INSERT INTO users (id, password, address, phone) VALUES (?, ?, ?, ?)';

    connection.query(checkQuery, [id], (error, results) => {
        if (error) {
            res.status(500).send('회원가입 실패: ' + error.message);
        } else if (results.length > 0) {
            // 이미 존재하는 아이디
            res.redirect('/register?error=duplicate');
        } else {
            connection.query(insertQuery, [id, pw, address, phone], (error, results) => {
                if (error) {
                    res.status(500).send('회원가입 실패: ' + error.message);
                } else {
                    res.redirect('/login');
                }
            });
        }
    });
});

// 로그인 페이지로 이동하는 경로 처리
app.get('/login', (req, res) => {
    
    res.sendFile(path.join(__dirname, 'login.html'));
});

// 로그인 처리
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const query = 'SELECT * FROM users WHERE id = ? AND password = ?';

    connection.query(query, [username, password], (error, results) => {
        if (error) {
            res.status(500).send('로그인 실패: ' + error.message);
        } else if (results.length > 0) {
            req.session.userId = results[0].id;
            req.session.user = results[0];
            res.redirect('/');
        } else {
            return res.redirect('/login?error=invalid_credentials');
        }
    });
});
// /myPage 라우트
app.get('/myPage', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }

    const userId = req.session.userId;

    connection.query('SELECT cart FROM users WHERE id = ?', [userId], (err, results) => {
        if (err) {
            console.error('사용자의 카트 조회 중 오류 발생:', err);
            return res.status(500).send('서버 오류');
        }

        let cart = results[0].cart || '';
        let productIds = Array.from(new Set(cart.split(',').map(id => id.trim()).filter(id => id)));

        if (productIds.length === 0) {
            return res.render('myPage', { user: req.session.user, ptData: [] });
        }

        let placeholders = productIds.map(() => '?').join(',');
        let sql = `SELECT * FROM PT WHERE product_id IN (${placeholders})`;

        connection.query(sql, productIds, (err, results) => {
            if (err) {
                console.error('상품 조회 중 오류 발생:', err);
                return res.status(500).send('서버 오류');
            }

            res.render('myPage', { user: req.session.user, ptData: results });
        });
    });
});

app.delete('/delete-product/:productId', (req, res) => {
    const productId = req.params.productId;
    const userId = req.session.userId;

    const deleteProductFromCart = () => {
        
        const query = `
            UPDATE users
            SET cart = ? -- 수정된 카트 값으로 업데이트
            WHERE id = ?
        `;

        // 현재 카트 가져오기
        connection.query('SELECT cart FROM users WHERE id = ?', [userId], (err, results) => {
            if (err) {
                console.error('Error fetching cart:', err);
                res.status(500).send('Error fetching cart');
            } else {
                // 카트에서 제품 제거
                let updatedCart = results[0].cart.split(',').filter(item => item !== productId).join(',');
                
                // 쉼표 여러 개를 하나의 쉼표로 변경
                updatedCart = updatedCart.replace(/,{2,}/g, ',');

                // 수정된 카트로 업데이트
                connection.query(query, [updatedCart, userId], (err, results) => {
                    if (err) {
                        console.error('Error updating cart:', err);
                        res.status(500).send('Error updating cart');
                    } else {
                        }
                });
            }
        });
    };

    // 첫 번째 호출
    deleteProductFromCart();
});



app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('로그아웃 실패');
        }
        res.redirect('/');
    });
});


app.get('/api/clothes', (req, res) => {
    const { category, search } = req.query;


    let sql = 'SELECT * FROM PT';

    // 카테고리와 검색어가 모두 제공된 경우
    if (category && search) {
        sql += ` WHERE category = '${category}' AND name LIKE '%${search}%'`;
    }
    // 카테고리만 제공된 경우
    else if (category) {
        sql += ` WHERE category = '${category}'`;
    }
    // 검색어만 제공된 경우
    else if (search) {
        sql += ` WHERE name LIKE '%${search}%'`;
    }


    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error executing MySQL query:', err);
            res.status(500).json({ error: 'Internal server error' });
            return;
        }
        res.json(results);
    });
});
app.get('/api/categories', (req, res) => {
    const query = 'SELECT DISTINCT category FROM PT';

    connection.query(query, (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Server error');
        }

        const categories = results.map(row => row.category);
        res.json(categories);
    });
});

// '/clothes' 경로 처리: clothes.html 파일 서빙
app.get('/clothes', (req, res) => {
    res.sendFile(path.join(__dirname, 'clothes.html'));
});
app.get('/api/product-id', (req, res) => {
    const productName = req.query.productName;
    const query = 'SELECT product_id FROM PT WHERE name = ?';
    connection.query(query, [productName], (err, results) => {
        if (err) {
            console.error('데이터베이스 오류:', err);
            res.status(500).json({ error: '서버 오류' });
        } else {
            if (results.length > 0) {
                res.json({ productId: results[0].product_id });
            } else {
                res.status(404).json({ error: '상품을 찾을 수 없습니다.' });
            }
        }
    });
});

app.get('/clothes/best', (req, res) => {
    let query = 'SELECT * FROM PT ORDER BY `like` DESC';

    const category = req.query.category;
    if (category) {
        query = `SELECT * FROM PT WHERE category = '${category}' ORDER BY \`like\` DESC`;
    }

    connection.query(query, (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Server error');
        }

        res.render('best-clothes', { products: results }); // 렌더링된 HTML을 클라이언트에게 응답
    });
});

app.get('/codi/:codiId', (req, res) => {
    const codiId = req.params.codiId;
    const query = 'SELECT * FROM PT WHERE codi_id = ?';

    connection.query(query, [codiId], (err, results) => {
        if (err) {
            console.error('데이터베이스 오류:', err);
            res.status(500).send('서버 오류');
        } else {
            let html = `<!DOCTYPE html>
                        <html lang="ko">
                        <head>
                            <meta charset="UTF-8">
                            <title>관련 상품 목록</title>
                            <style>
                                body {
                                    font-family: Arial, sans-serif;
                                    margin: 0;
                                    padding: 20px;
                                }

                                .product-grid {
                                    display: grid;
                                    grid-template-columns: repeat(4, 1fr); /* 한 행에 4개의 열로 설정 */
                                    gap: 20px; /* 그리드 간격 설정 */
                                }

                                .product-item {
                                    border: 1px solid #ccc;
                                    padding: 10px;
                                    text-align: center;
                                    cursor: pointer; /* 클릭 가능한 요소로 설정 */
                                }

                                .product-img {
                                    max-width: 100%;
                                    max-height: 250px;
                                    height:auto;
                                }
                            </style>
                        </head>
                        <body>
                            <h1>관련 상품 목록</h1>
                            <div id="product-grid" class="product-grid">`;

            results.forEach(product => {
                const imageArray = product.image.split(',').map(image => image.trim());
                const firstImagePath = imageArray[0]; // 첫 번째 이미지 경로 선택
                const relativeImagePath = path.relative(__dirname, firstImagePath);
                const imageUrl = encodeURIComponent(relativeImagePath); // 이미지 경로 수정 및 URL 인코딩

                // 이미지 URL에 codi_id와 파일명 추가
                const imageUrlWithCodiId = `/uploads/${codiId}/${path.basename(firstImagePath)}`;

                html += `<div class="product-item">
                            <h2>${product.name}</h2>
                            <a href="/image/${product.product_id}"><img class="product-img" src="${imageUrlWithCodiId}" alt="${product.name}"></a>
                            <p>카테고리: ${product.category}</p>
                            <p>색상: ${product.color}</p>
                            <p>가격: ${product.price}원</p>
                            
                        </div>`;
            });

            html += `   </div>
                        </body>
                        </html>`;
            res.send(html);
        }
    });
});
// /add-to-cart 라우트
app.post('/add-to-cart', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).send('로그인이 필요합니다.');
    }

    const userId = req.session.userId;
    const productId = req.body.product_id;

    connection.query('SELECT cart FROM users WHERE id = ?', [userId], (err, results) => {
        if (err) {
            console.error('사용자의 카트 조회 중 오류 발생:', err);
            return res.status(500).send('서버 오류');
        }

        let currentCart = results[0].cart;
        let updatedCart;

        if (!currentCart) {
            updatedCart = productId;
        } else {
            updatedCart = currentCart.split(',').concat(productId).join(',');
        }

        connection.query('UPDATE users SET cart = ? WHERE id = ?', [updatedCart, userId], (err, results) => {
            if (err) {
                console.error('카트 업데이트 중 오류 발생:', err);
                return res.status(500).send('서버 오류');
            }

            res.redirect('/myPage'); // 업데이트 후 /myPage로 리디렉션
        });
    });
});

// /image/:product_id 라우트
app.get('/image/:product_id', (req, res) => {
    const productId = req.params.product_id;

    const incrementLikeQuery = 'UPDATE PT SET `like` = `like` + 1 WHERE product_id = ?';

    connection.query(incrementLikeQuery, [productId], (err) => {
        if (err) {
            console.error('조회수 증가 중 오류 발생:', err);
            return res.status(500).send('서버 오류');
        }

        
        const query = 'SELECT PT.*, Codi.photo_path AS codi_photo_path FROM PT JOIN Codi ON PT.codi_id = Codi.codi_id WHERE PT.product_id = ?';

        connection.query(query, [productId], (err, results) => {
            if (err) {
                console.error('데이터베이스 오류:', err);
                return res.status(500).send('서버 오류');
            } else if (results.length === 0) {
                return res.status(404).send('상품을 찾을 수 없습니다.');
            } else {
                const product = results[0];
                const productImages = product.image;
                const codiId = product.codi_id;
                const cleanedString = productImages.replace(/[\[\]"]/g, '');
                const imageArray = cleanedString.split(',').map(image => path.basename(image.trim()));

                res.render('image', { product, relativeImagePaths: imageArray, codiId });
            }
        });
    });
});

app.listen(port, () => {
    console.log(`서버가 http://localhost:${port} 에서 실행 중입니다.`);
});
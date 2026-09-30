# Codi Shopping Mall

코디 사진을 중심으로 관련 상품을 탐색할 수 있도록 구현한 개인 웹 쇼핑몰 프로젝트입니다.
인터넷 프로그래밍 수업의 기말 대체 과제로 제작했으며, Node.js/Express 서버와 MySQL 관계형 데이터베이스를 사용했습니다.

## 주요 기능

- 계절별 코디 이미지 목록 조회
- 코디 이미지 선택 시 해당 코디와 연결된 상품 조회
- 상품 상세 이미지 및 정보 조회
- 카테고리/검색어 기반 상품 조회
- 조회수(`like`) 기준 인기 상품 조회
- 회원가입 / 로그인 / 로그아웃 (세션 기반)
- 장바구니 추가 / 삭제 및 마이페이지 조회
- 관리자 페이지에서 코디 사진과 여러 상품 이미지 업로드

## 기술 스택

- Node.js
- Express
- MySQL / mysql2
- EJS
- express-session
- Multer
- HTML / CSS / JavaScript

## 데이터 구조

- `Codi`: 코디 이미지, 계절 정보
- `PT`: 상품명, 이미지, 카테고리, 색상, 가격, 조회수, 연결된 코디 ID
- `users`: 사용자 계정, 주소, 전화번호, 장바구니

## 실행 방법

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

`.env.example`을 복사해 `.env`를 만들고 MySQL 접속 정보를 입력합니다.

```bash
cp .env.example .env
```

### 3. MySQL 데이터베이스 생성

```sql
CREATE DATABASE product;
USE product;

CREATE TABLE Codi (
    codi_id INT NOT NULL AUTO_INCREMENT,
    photo_path VARCHAR(255) NOT NULL,
    photo_description TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    weather VARCHAR(50) DEFAULT NULL,
    PRIMARY KEY (codi_id)
);

CREATE TABLE PT (
    product_id INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,
    image LONGTEXT NOT NULL,
    category LONGTEXT NOT NULL,
    color LONGTEXT NOT NULL,
    price LONGTEXT NOT NULL,
    `like` INT NOT NULL DEFAULT 0,
    codi_id INT DEFAULT NULL,
    PRIMARY KEY (product_id)
);

CREATE TABLE users (
    id VARCHAR(50) NOT NULL,
    password VARCHAR(255) NOT NULL,
    address VARCHAR(255) DEFAULT NULL,
    phone VARCHAR(20) NOT NULL,
    cart VARCHAR(255) DEFAULT NULL,
    PRIMARY KEY (id)
);
```

### 4. 서버 실행

```bash
npm start
```

기본 포트는 `3002`입니다.

## 프로젝트에서 다룬 내용

코디 이미지와 개별 상품을 `codi_id`로 연결하여, 사용자가 코디를 먼저 보고 해당 스타일에 포함된 상품으로 이동할 수 있도록 구성했습니다. 서버에서 MySQL 데이터를 조회해 페이지와 API에 전달하고, 이미지 업로드 파일을 코디별 디렉터리에 저장하도록 구현했습니다. 또한 세션 기반 로그인과 사용자별 장바구니 데이터를 연동했습니다.

## Troubleshooting — 코디 이미지와 연관 상품의 매칭 오류

### 문제와 영향

코디 상세 화면에서 선택한 이미지와 연관 상품이 제대로 매칭되지 않는 문제가 발생했습니다. 목록 화면과 DB 조회는 정상처럼 보였지만, 상세 화면이 잘못 동작해 상품 확인에서 장바구니로 이어지는 사용자 흐름이 막혔습니다.

### 원인을 좁힌 과정

처음에는 렌더링 조건문과 화면에 전달되는 값을 수정했지만 문제가 반복됐습니다. 이후 데이터 이동 경로를 다음과 같이 나눠 각 단계의 값을 비교했습니다.

| 확인 단계 | 확인한 내용 |
|---|---|
| DB 조회 | 선택한 코디와 연결된 상품 데이터가 조회되는지 확인 |
| 서버 전달 | 조회 결과의 이미지·상품 연결 값이 응답이나 화면 데이터로 전달되는 과정 확인 |
| 클라이언트 수신 | 받은 값이 서버가 전달한 값과 일치하는지 비교 |
| 렌더링 | 수신한 연결 값이 올바른 상품과 이미지 표시로 이어지는지 확인 |

정상 동작하는 다른 화면의 데이터와도 대조하여, 처음 값이 예상과 달라지는 구간을 좁혔습니다.

### 해결과 배운 점

이미지와 상품을 연결하는 값이 전달 중 예상과 다르게 처리되는 지점을 수정해 상세 화면을 정상적으로 완성했습니다. 이후에는 화면부터 추측해 수정하기보다 **DB 조회 → 서버 전달 → 클라이언트 수신 → 렌더링** 순서로 데이터의 이동을 확인하는 기준을 갖게 됐습니다.

현재 코드에서는 `Codi.codi_id`와 `PT.codi_id`가 코디와 상품을 연결하고, `GET /codi/:codiId`가 해당 코디의 상품을 조회합니다. 이 설명은 당시 문제 해결 경험을 정리한 것이며, 과거 오류의 정확한 코드 변경 내역이나 당시 로그가 보존돼 있다고 주장하지 않습니다.

## 보안 보완 내용

- **비밀번호 해싱:** Node.js 내장 `crypto.scrypt`로 회원가입 비밀번호를 저장합니다. 계정마다 무작위 16바이트 salt를 사용하며 `N=131072, r=8, p=1`, 64바이트 키를 사용합니다. 검증은 `timingSafeEqual`로 수행하고 평문 비교로 돌아가는 경로는 없습니다.
- **인증 SQL:** 아이디만 prepared statement로 조회한 뒤 서버에서 해시를 검증합니다. 회원가입 INSERT도 파라미터 바인딩을 사용합니다.
- **검색 SQL:** `/api/clothes`의 카테고리·검색어와 `/clothes/best`의 카테고리를 SQL 문자열에 직접 넣지 않고 `mysql2.execute()`의 `?` 값으로 전달합니다.
- **입력·오류 처리:** 인증 입력 및 검색 쿼리의 타입·길이를 검사하고, 인증 오류 응답에 DB 내부 오류를 노출하지 않습니다.
- **세션:** 로그인 성공 시 세션 ID를 재발급합니다. 비밀번호/해시는 세션에 넣지 않으며 마이페이지의 비밀번호 표시도 제거했습니다. 쿠키에 HttpOnly·SameSite=Lax를 설정하고 production에서는 Secure를 적용합니다.
- **비용 제한:** 메모리 사용이 큰 scrypt 작업은 프로세스당 최대 2개로 제한하고 초과 요청에는 503을 반환합니다. 이는 요청 빈도 제한이나 분산 환경의 남용 방어를 대체하지 않습니다.

구현 위치: [비밀번호 해시](lib/passwords.js), [인증 처리](lib/auth.js), [검색 쿼리](lib/product-queries.js), [검증 테스트](test/security.test.js).

### 기존 평문 비밀번호의 전환

**기존 DB를 사용하는 경우 먼저 백업하고, 서비스 쓰기를 중지한 유지보수 시간에 전환하세요. 전환 전의 평문 계정은 새 로그인 코드에서 인증되지 않습니다.** 신규 회원만 사용하는 빈 DB에서는 필요하지 않습니다.

```bash
# .env가 대상 DB를 가리키는지 확인 후 개수만 점검 — DB 변경 없음
npm run passwords:check

# 백업 및 유지보수 준비가 끝난 뒤 관리자가 명시적으로 실행
npm run passwords:migrate
```

- 이 도구는 기존 수업 프로젝트의 **평문 users.password**만을 대상으로 합니다. 다른 암호화/해시 형식이 섞인 DB에 사용하지 마세요.
- 트랜잭션을 지원하는 InnoDB와 `password VARCHAR(255)` 이상의 컬럼이 필요합니다.
- 이미 이 프로젝트 형식의 scrypt 해시인 계정은 건너뜁니다. 비정상 값은 수동 검토/비밀번호 재설정이 필요합니다.
- 전환은 순차적으로 수행하며, 조회 이후 값이 바뀐 행은 덮어쓰지 않고 전체 전환을 롤백합니다. SQL 비교에 `BINARY`를 사용하여 비밀번호의 대소문자를 구분합니다.
- 계정명·평문·해시는 출력하지 않고 개수만 출력합니다. 과거 평문이 남아 있는 백업과 로그도 별도 보안 관리가 필요합니다.
- 저장소 정리 작업 중 실제 사용자 DB에 전환을 실행하지 않았습니다. 운영 DB 이전은 관리자가 수행해야 합니다.

### 테스트 및 검증 범위

Node.js 20 이상에서 다음을 실행합니다.

```bash
npm ci
npm test
```

해시 생성·검증, 잘못된 값/평문 거부, 회원가입·로그인, 세션 재발급과 비밀번호 제외, SQL 공격 형태의 문자열 바인딩, DB 오류 비노출, 전환의 dry-run·조건부 갱신·롤백을 자동 점검합니다. HTTP 테스트는 가짜 DB와 로컬 서버를 사용하며 **실제 MySQL 통합 테스트나 운영 배포 검증을 대신하지 않습니다.**

### 남아 있는 운영 전 보완 사항

이번 수정은 비밀번호 저장과 일부 SQL 처리 개선 범위입니다. 현재 앱은 수업용 프로젝트이며 **운영 배포 준비가 완료된 서비스는 아닙니다.**

- 관리자·업로드 경로의 서버 측 권한 검사, 업로드 파일 형식·이름·크기 제한
- CSRF 방어, 출력 이스케이프/XSS 점검, 전체 입력 검증, 요청 빈도 제한
- 구버전 Multer 등 의존성의 보안 업데이트 및 업로드 회귀 테스트
- 영속 세션 저장소, HTTPS 종료 지점과 신뢰할 프록시 설정, 안전한 세션 키 관리
- 실제 MySQL 환경에서 스키마·기존 계정 전환·동시성 검증

`NODE_ENV=production`에서 SESSION_SECRET은 최소 32자의 강한 무작위 값이어야 합니다. Secure 쿠키는 HTTPS가 필요하며, 프록시 뒤에서는 해당 배포 환경에 맞는 신뢰 설정을 별도로 적용해야 합니다. 기본 MemoryStore는 운영용이 아닙니다.

참고: [OWASP 비밀번호 저장 지침](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [Node.js scrypt](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback), [MySQL2 prepared statements](https://sidorares.github.io/node-mysql2/docs).

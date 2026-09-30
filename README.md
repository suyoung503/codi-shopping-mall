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

## 참고

수업 프로젝트 원본의 DB 비밀번호와 세션 키는 공개 저장소에 노출되지 않도록 환경변수 방식으로 변경했습니다. 실제 서비스 수준의 인증·보안 구현을 목표로 한 프로젝트는 아니므로 운영 환경에서는 비밀번호 해싱, 입력 검증, CSRF 방어, SQL 쿼리 파라미터화 등의 추가 보완이 필요합니다.

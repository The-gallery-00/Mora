# MORA

**명함을 찍으면, AI가 정리하고, 말로 찾는다.**

---

## 이런 경험 있으시죠?

- 명함을 받았는데 어디 뒀는지 모르겠다
- 연락처를 하나하나 직접 입력하기 귀찮다
- "그때 만난 디자이너 김 아무개..." 이름이 정확히 기억 안 난다

MORA는 이 문제를 해결합니다.

---

## 어떻게 동작하나요?

### 1. 찍으면 끝
명함 사진을 올리면 AI가 텍스트를 자동으로 읽어냅니다.

### 2. 알아서 정리
이름, 회사, 직책, 전화번호, 이메일을 자동으로 분류합니다.
틀린 부분이 있으면 직접 수정할 수도 있습니다.

### 3. 맥락 검색
"모라테크 이사", "김 대리", "디자이너" 같이 기억나는 대로 검색하면 찾아줍니다.
단순 텍스트 매칭이 아닌, 의미를 이해하는 맥락 검색입니다.

---

## 프로젝트 목표

- **수작업 제거**: 명함 정보를 직접 타이핑하지 않아도 되게 만든다
- **자연어 검색**: 정확한 이름을 몰라도 기억나는 키워드로 찾을 수 있게 만든다
- **개인 명함 데이터베이스**: 내가 받은 명함을 한 곳에서 관리할 수 있게 만든다

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | Next.js 16, React 19, TypeScript, Tailwind CSS |
| API 서버 | Java Spring Boot 3.5, JPA, Spring Security |
| OCR 엔진 | Python 3.11, FastAPI, PaddleOCR 3.4 |
| 데이터베이스 | PostgreSQL 16 + pgvector |
| 임베딩 | OpenAI text-embedding-3-small (1536차원) |
| 인증 | JWT + bcrypt + Google/Kakao OAuth |

---

## 시스템 구조

```
사용자 (브라우저)
    │
    ▼
Next.js (:3000)          ← 화면
    │
    ▼
Spring Boot (:8080)      ← 인증, 명함 저장/수정/삭제, 벡터 검색
    │
    ├──→ Python OCR (:8000)     ← 명함 이미지 → 텍스트 추출
    ├──→ PostgreSQL + pgvector  ← 데이터 저장 + 벡터 검색
    └──→ OpenAI API             ← 텍스트 → 벡터 변환
```

---

## 실행

```bash
.\start.bat
```

| 서비스 | 주소 |
|--------|------|
| 프론트엔드 | http://localhost:3000 |
| API 서버 | http://localhost:8080 |
| OCR 서비스 | http://localhost:8000 |
| 데이터베이스 | localhost:5433 |

---

## 팀

| GitHub | 역할 |
|--------|------|
| [@The-gallery-00](https://github.com/The-gallery-00) | PM |
| [@lavermeanyou](https://github.com/lavermeanyou) | 기획 / OCR |
| [@ose0919](https://github.com/ose0919) | 백엔드 |
| [@Seeun126](https://github.com/Seeun126) | 백엔드 |
| [@powdang](https://github.com/powdang) | 디자인 |
| [@cjftns](https://github.com/cjftns) | 프론트 |


---

## 라이선스




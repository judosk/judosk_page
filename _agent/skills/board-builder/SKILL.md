---
name: board-builder
description: GitHub API & Vercel 기반 정적 게시판 홈페이지 구축 스킬. 부동산 홈페이지의 게시판 기능(게시글 CRUD, 관리자 인증, 마크다운 렌더링)을 GitHub API를 통해 서버리스로 구현합니다.
---

# Board Builder Skill

## 프로젝트 개요

- **프레임워크**: Vanilla HTML/CSS/JS + Tailwind CSS CDN
- **데이터 저장소**: GitHub Repository (`data/posts.json`)
- **백엔드**: Vercel Serverless Function (`api/config.js`)
- **배포**: Vercel (zero-config)

## 파일 구조

```
judosk/
├── _agent/skills/board-builder/SKILL.md
├── api/config.js          # Vercel 서버리스 함수 (토큰 보안 전달)
├── config/git_config.json # GitHub 저장소 정보 (토큰 플레이스홀더)
├── data/posts.json        # 게시글 데이터
├── templates/post-template.md
├── vercel.json            # cleanUrls + trailingSlash
├── db.js                  # 핵심 로직 (GitHub API, 마크다운, 인증)
├── index.html             # 메인 페이지 + 최신글 3개 미리보기
├── news.html              # 게시글 목록 + 검색 + 카테고리
├── news-detail.html       # 게시글 상세 + 마크다운 렌더링
├── news-write.html        # 글쓰기/수정 (관리자 전용)
└── admin.html             # 관리자 로그인 + 대시보드
```

## 핵심 설계 원칙

### loadConfig() 이중 소스 병합
- `/api/config`: `github_token`, `admin_password` 반환 (Vercel 환경변수)
- `config/git_config.json`: `github_owner`, `github_repo`, `data_file_path` 반환
- 두 소스를 항상 병렬 조회 후 병합 → owner/repo가 undefined되지 않음

### 보안
- 토큰은 `config/git_config.json`에 `"YOUR_GITHUB_TOKEN"` 플레이스홀더로 저장 (Push Protection 우회)
- 실제 토큰은 Vercel 환경변수 `GITHUB_TOKEN`으로만 주입
- 토큰 공백/줄바꿈 정제: `.replace(/\s+/g, '')`

### 마크다운 렌더러 (renderMarkdown)
- HTML escape 후 서식 적용 (XSS 방지)
- 코드 스팬: 백틱 기준 분할 (숫자 오인 방지)
- 링크: `http/https/mailto`만 허용

### Vercel 배포 설정
- `vercel.json`: `cleanUrls + trailingSlash`만 선언 (builds 금지)
- `api/` 폴더 자동 서버리스 함수 배포
- `public/` 폴더 생성 금지 (Vercel output dir 충돌)

## Vercel 환경변수

| Key | Value |
|-----|-------|
| `GITHUB_TOKEN` | GitHub Personal Access Token (ghp_...) |
| `ADMIN_PASSWORD` | 관리자 로그인 비밀번호 |

## 카테고리 목록

- 정책 / 지역소식 / 시장동향 / 단지정보 / 전문가칼럼

## 관련 저장소

- GitHub: https://github.com/judosk/judosk_page

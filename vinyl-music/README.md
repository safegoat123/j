# Vinyl Music

로컬 음악 파일을 스캔·재생하는 독립형 플레이어 (Spotify 스타일 UI + LP 플레이어). Spotify 계정 불필요.

## 구조
- `server/` FastAPI + SQLite + mutagen (스캔, 메타데이터, Range 스트리밍, 재생목록, 즐겨찾기, 기록)
- `frontend-src/` 기존 `spotify-react-web-client/src` 에 덮어쓰거나 병합할 파일 (재생 엔진, player slice, LP 컴포넌트, 색상 추출, 설정 페이지)

## 실행
```
cd server && python -m venv .venv && .venv/Scripts/activate   # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt && pytest && python app.py     # http://127.0.0.1:8000
```
데이터(DB)는 `%LOCALAPPDATA%/vinyl-music` 또는 `~/.local/share/vinyl-music` (`DATA_DIR`로 변경). 환경 변수는 `.env.example` 참고.

## 지원 형식
mp3, flac, wav, m4a, aac, ogg, opus 는 브라우저 재생 시도. aiff 는 등록되지만 "재생 불가"로 표시.
(브라우저별 코덱 지원은 다를 수 있음)

## 제한
음원 가져오기(Mornye 연동), 가사/LRC, 파일 업로드 import, settings API 는 미구현.

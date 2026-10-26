# Vinyl Music — 기존 패치 반영

이 폴더는 사용자가 제공한 `vinyl-music-patch.zip`의 기존 구현을 저장소에 통합하기 위한 위치입니다.

## 원본 패치 구성
- `server/app.py`: FastAPI + SQLite 기반 로컬 음악 라이브러리 API
- `server/test_app.py`: 백엔드 테스트
- `server/requirements.txt`: 백엔드 의존성
- `frontend-src/`: 기존 React 앱에 병합할 바이닐 UI, 플레이어 상태, 오디오 엔진, 앨범 색상 추출 코드
- `.env.example`: 환경 변수 예시
- `THIRD_PARTY_NOTICES.md`: 제3자 고지

## 주의
이 코드는 단독 실행형 전체 프런트엔드가 아니라 기존 `spotify-react-web-client`에 병합하도록 구성된 패치입니다. 기존 폴더는 수정하지 않고 이 폴더 안에서 먼저 보존·검증합니다.

## 상태
이 커밋은 통합 폴더와 안내 문서를 추가합니다. 압축 파일의 모든 소스 파일을 저장소에 복사하고 테스트하는 작업은 아직 완료되지 않았습니다.
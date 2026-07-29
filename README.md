# GigaChad Discord Bot

디스코드에서 봇을 멘션하면 기가채드 스타일로 짧고 강하게 답하는 챗봇이다.

## 구조

`yddfhbh/kannyan`처럼 엔트리 포인트는 얇게 두고 역할별로 파일을 나눴다.

- `src/index.js`: 부팅
- `src/bot.js`: 디스코드 이벤트 처리
- `src/gemini-client.js`: Google AI Studio 호출
- `src/discord-message-context.js`: 멘션, 답글, 리셋 판별
- `src/conversation-store.js`: 대화 문맥 저장
- `src/permissions.js`: 리셋 권한 체크
- `src/gigachad-prompt.js`: 시스템 지침

## 기능

- `@봇 질문` 형태의 멘션 기반 대화
- 봇 답글에 대한 답장 인식
- DM 대화 지원
- Google AI Studio Gemini Interactions API 사용
- 채널별, 사용자별 문맥 유지
- 여러 Gemini API 키 순환 사용
- 메인 모델 실패 시 fallback 모델 시도
- 리셋 권한 제한

## 설치

```bash
npm install
```

`.env.example`을 보고 `.env`를 만든다.

```env
DISCORD_TOKEN=your_discord_bot_token
GEMINI_API_KEYS=key_one,key_two
GEMINI_API_KEY=your_google_ai_studio_api_key
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_FALLBACK_MODELS=gemini-3.1-flash-lite
RESET_COMMAND=!reset
RESET_ALLOWED_USER_ID=635107514471415808
MAX_PROMPT_CHARS=40000
```

## 키와 모델 동작 방식

- `GEMINI_API_KEYS`에 키를 쉼표로 넣으면 요청마다 키를 돌려 쓴다.
- `GEMINI_API_KEY`나 `GOOGLE_API_KEY`만 넣어도 단일 키로 동작한다.
- 메인 모델은 기본값으로 `gemini-3.5-flash-lite`를 쓴다.
- fallback 모델은 기본값으로 `gemini-3.1-flash-lite`를 추가 시도한다.
- 메인 모델이나 현재 키가 quota, rate limit, 모델 오류로 실패하면 다음 키나 다음 모델로 넘긴다.

## 디스코드 설정

Discord Developer Portal에서 `MESSAGE CONTENT INTENT`를 켜라.

권한은 최소 이 정도면 된다.

- `View Channels`
- `Send Messages`
- `Read Message History`

## 사용법

- 멘션: `@봇 오늘 루틴 짜줘`
- 봇 답글에 답장 달기
- 현재 대화 리셋: `!reset`
- 멘션 리셋: `@봇 reset`, `@봇 리셋`, `@봇 초기화`

공개 채널에서는 `길드:채널:사용자` 기준으로 문맥을 분리한다. DM은 DM 채널 단위로 문맥을 유지한다.

## 리셋 권한

다음 둘만 리셋할 수 있다.

- 디스코드 관리자 권한 보유자
- 사용자 ID `635107514471415808`

## 실행

```bash
npm start
```

개발 중 자동 재시작:

```bash
npm run dev
```

## 참고

- 대화 문맥은 Google Interactions API의 `previous_interaction_id`를 사용한다.
- `system_instruction`은 매 요청마다 다시 보낸다.
- 로컬 상태는 `data/conversations.json`에 저장된다.

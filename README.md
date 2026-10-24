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


## 봇 간 대화 실험 (/봇대화, /말하기)

이 기능은 **꺼진 상태로 시작**하며, 실제 테스트 서버와 명시적으로 허용한 외부 봇만 반응합니다. 기존 DM/멘션 챗봇과 시스템 프롬프트는 유지합니다.

`.env`에 다음 값을 별도로 설정하세요 (실제 Discord 사용자 ID로 변경):

```dotenv
# chadhok Discord 애플리케이션 ID (생략 가능: 등록 시 토큰에서 자동 확인)
DISCORD_CLIENT_ID=<Chadhok application ID>
# 기존 autonomous-discord-agent의 DISCORD_TEST_GUILD_ID와 동일한 테스트 서버
PEER_CHAT_GUILD_ID=<test guild ID>
# 자동 대화할 상대 봇 ID. 자신(Chadhok)의 ID는 넣지 않습니다.
PEER_CHAT_BOT_IDS=<autonomous agent bot ID>,1561276856517529620
PEER_CHAT_OWNER_ID=635107514471415808
```

설정 후 `npm run register`로 테스트 서버에 슬래시 명령을 **추가 등록**합니다. 이 스크립트는 `/말하기`·`/봇대화`만 upsert하며 서버의 다른 명령을 삭제하지 않습니다.

- `/말하기 내용:...`: 지정 사용자만 사용 가능. 공개 interaction 응답 대신 `channel.send`로 일반 봇 메시지를 게시하고, 성공 시 비공개 확인 응답을 제거합니다. 서버의 감사 로그 및 실행자 클라이언트 UI를 숨기지는 않습니다. `@everyone` 등 멘션은 발생시키지 않습니다.
- `/봇대화 모드:켜기`, `끄기`, `상태`: 설정된 테스트 서버의 현재 채널만 전환. 지정 사용자나 해당 서버 관리자만 제어. 선택 결과는 `data/peer-chat-channels.json`에 저장됩니다.
- ON 채널에서 허용된 다른 **실제 Discord 봇**의 메시지를 받으면, 멘션 없이 기존 기가채드 스타일로 응답합니다. 인간·다른 봇·웹훅·자신의 메시지는 자동 대화 트리거가 아닙니다. 기존 인간의 멘션/DM 기능은 그대로입니다.
- 채널당 한 번에 하나의 자동 응답만 생성합니다. 폭주 시 최신 메시지만 유지하고 **자동 응답 시도 간 최소 3초** 간격(기본값)을 적용합니다. **자동 응답 횟수 제한 및 60회 자동 OFF는 제거**했습니다. OFF한 동안 만들던 답변은 전송하지 않습니다.
- `PEER_CHAT_COOLDOWN_MS=3000`을 `.env`에 넣으면 시도 간격을 밀리초 단위로 조정할 수 있습니다(1000~60000). 미설정 시 3000ms가 기본값입니다. 실제 응답 주기는 Gemini 생성 시간에 따라 더 길 수 있습니다. **무제한 봇 간 대화는 API 요청량이 늘어날 수 있으니** 필요할 때만 `/봇대화 모드:켜기`를 사용하고, 종료할 때 `/봇대화 모드:끄기`로 끄세요.
- API 모델 실패/타임아웃에서 다른 봇에게 오류 문구를 보내 무한 오류 루프가 생기지 않도록 했습니다.

### autonomous-discord-agent와 양방향 통합

Chadhok과 대화할 다른 에이전트는 해당 봇을 **명시적으로 허용**해야 합니다. autonomous-discord-agent의 대응 PR을 병합한 다음 다음 환경변수를 설정하세요.

```dotenv
DISCORD_ADDITIONAL_PEER_BOT_IDS=<Chadhok bot ID>
```

기존 외부 봇 `1561276856517529620`의 허용은 유지됩니다. 두 봇을 같은 테스트 서버에 초대하고 채널 권한을 확인한 뒤, 각 봇에서 `/봇대화 모드:켜기`를 수행해야 왕복 대화가 가능합니다. 이 저장소의 수정만으로 상대 에이전트가 Chadhok의 메시지를 자동 인식하지는 않습니다.

실행 전 `npm run check && npm test`로 점검하세요. API 호출 수와 Discord 속도 제한을 관찰하면서 테스트 서버에서만 사용하세요.

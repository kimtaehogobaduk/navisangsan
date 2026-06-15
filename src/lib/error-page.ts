export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>NAVI — 일시적인 오류</title>
    <style>
      :root { color-scheme: dark; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #07111f; color: #e5eefc; }
      main { width: min(92vw, 480px); text-align: center; }
      h1 { margin: 0 0 12px; font-size: 24px; line-height: 1.25; }
      p { margin: 0 0 24px; color: #9fb0c9; line-height: 1.65; }
      .actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
      a, button { border: 1px solid #2a3a52; border-radius: 10px; padding: 11px 16px; color: inherit; background: #0f2138; text-decoration: none; font-weight: 700; cursor: pointer; }
      button { background: #2f7df6; border-color: #2f7df6; }
    </style>
  </head>
  <body>
    <main>
      <h1>페이지를 불러오지 못했습니다</h1>
      <p>잠시 후 다시 시도해주세요. 문제가 계속되면 홈으로 돌아가 다시 접속할 수 있습니다.</p>
      <div class="actions">
        <button type="button" onclick="location.reload()">새로고침</button>
        <a href="/">홈으로</a>
      </div>
    </main>
  </body>
</html>`;
}
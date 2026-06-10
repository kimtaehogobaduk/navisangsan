// 프로필이 없는 사용자를 /onboarding 으로 보낼 때, 어떤 기능에서 왔는지를
// sessionStorage 에 잠깐 기록해 두면 /onboarding 페이지가 친절한 안내 배너를
// 보여줄 수 있다. 사용자가 "버튼이 안 눌린다"고 느끼는 주된 원인이
// 조용한 redirect 였기 때문에, 이 경유 메시지로 UX 를 크게 개선한다.

const KEY = "navi.profileRequiredFrom";

export function markProfileRequired(featureLabel: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY, featureLabel);
  } catch {
    // ignore
  }
}

export function consumeProfileRequired(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = sessionStorage.getItem(KEY);
    if (v) sessionStorage.removeItem(KEY);
    return v;
  } catch {
    return null;
  }
}

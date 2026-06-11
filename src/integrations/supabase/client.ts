export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: (_cb: unknown) => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: async (_opts: { email: string; password: string }) => {
      return { error: new Error("로그인 기능이 비활성화되었습니다. 비회원으로 이용해주세요.") };
    },
    signUp: async (_opts: unknown) => {
      return { error: new Error("회원가입 기능이 비활성화되었습니다. 비회원으로 이용해주세요.") };
    },
    signOut: async () => ({ error: null }),
    getClaims: async (_token: string) => ({ data: null, error: new Error("not supported") }),
  },
  from: (_table: string) => ({
    select: (_cols?: string) => ({
      eq: (_col: string, _val: unknown) => ({
        eq: (_col2: string, _val2: unknown) => Promise.resolve({ data: [], error: null }),
        data: [] as unknown[],
        error: null,
      }),
      data: [] as unknown[],
      error: null,
    }),
    upsert: async (_data: unknown, _opts?: unknown) => ({ error: null }),
    delete: () => ({
      eq: (_col: string, _val: unknown) => ({
        eq: (_col2: string, _val2: unknown) => Promise.resolve({ error: null }),
      }),
    }),
  }),
};

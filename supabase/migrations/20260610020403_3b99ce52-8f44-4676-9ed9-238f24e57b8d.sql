CREATE TABLE public.admissions_info (
  id BIGSERIAL PRIMARY KEY,
  topic_key VARCHAR(255) UNIQUE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  bullets JSONB DEFAULT '[]'::jsonb,
  target_grade VARCHAR(50) NOT NULL DEFAULT '공통',
  universities JSONB DEFAULT '[]'::jsonb,
  info_type VARCHAR(100) NOT NULL DEFAULT '입시정보',
  importance INTEGER DEFAULT 3,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT SELECT ON public.admissions_info TO anon, authenticated;
GRANT ALL ON public.admissions_info TO service_role;
ALTER TABLE public.admissions_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read admissions_info" ON public.admissions_info FOR SELECT USING (true);
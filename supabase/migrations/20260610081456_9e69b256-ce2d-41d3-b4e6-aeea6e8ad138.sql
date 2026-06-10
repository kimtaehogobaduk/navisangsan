
-- 학교 조사 결과 캐시
CREATE TABLE public.school_research (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_key text NOT NULL UNIQUE,
  school_name text NOT NULL,
  region text,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.school_research TO authenticated, anon;
GRANT ALL ON public.school_research TO service_role;
ALTER TABLE public.school_research ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read school research" ON public.school_research FOR SELECT USING (true);

-- 관리자 학습 자료 (서버 저장, 전 사용자 공유)
CREATE TABLE public.training_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  source_type text NOT NULL DEFAULT 'manual', -- manual | youtube
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.training_docs TO authenticated, anon;
GRANT ALL ON public.training_docs TO service_role;
ALTER TABLE public.training_docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read training docs" ON public.training_docs FOR SELECT USING (true);

-- 유튜브(및 향후 기타) 학습 작업 큐
CREATE TABLE public.training_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL DEFAULT 'youtube',
  url text NOT NULL,
  category text NOT NULL DEFAULT '기타',
  status text NOT NULL DEFAULT 'pending', -- pending | processing | done | failed
  error text,
  doc_id uuid REFERENCES public.training_docs(id) ON DELETE SET NULL,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX training_jobs_status_idx ON public.training_jobs(status, created_at);
GRANT SELECT ON public.training_jobs TO authenticated, anon;
GRANT ALL ON public.training_jobs TO service_role;
ALTER TABLE public.training_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read training jobs" ON public.training_jobs FOR SELECT USING (true);

-- updated_at 트리거 재사용
CREATE TRIGGER school_research_touch BEFORE UPDATE ON public.school_research
  FOR EACH ROW EXECUTE FUNCTION public.user_data_touch_updated_at();
CREATE TRIGGER training_docs_touch BEFORE UPDATE ON public.training_docs
  FOR EACH ROW EXECUTE FUNCTION public.user_data_touch_updated_at();
CREATE TRIGGER training_jobs_touch BEFORE UPDATE ON public.training_jobs
  FOR EACH ROW EXECUTE FUNCTION public.user_data_touch_updated_at();

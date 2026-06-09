import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { cn } from "@/lib/utils";

type Props = {
  children: string;
  className?: string;
};

/**
 * AI 출력 전용 마크다운 렌더러.
 * 지원: 헤딩(#~####), 볼드(**), 이탤릭(*), 밑줄(<u>), 색(<span style="color:...">),
 * 인라인/블록 코드, 인용, 리스트, 체크박스, 표, 구분선, 별표 강조 등.
 */
export function Markdown({ children, className }: Props) {
  return (
    <div
      className={cn(
        "markdown-body text-sm leading-relaxed text-foreground",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          h1: ({ node, ...p }) => (
            <h1 className="mt-4 mb-3 text-2xl font-bold tracking-tight text-gradient-brand" {...p} />
          ),
          h2: ({ node, ...p }) => (
            <h2 className="mt-4 mb-2 text-xl font-bold tracking-tight" {...p} />
          ),
          h3: ({ node, ...p }) => (
            <h3 className="mt-3 mb-2 text-lg font-semibold text-brand" {...p} />
          ),
          h4: ({ node, ...p }) => (
            <h4 className="mt-3 mb-1.5 text-base font-semibold" {...p} />
          ),
          p: ({ node, ...p }) => <p className="my-2" {...p} />,
          strong: ({ node, ...p }) => (
            <strong className="font-bold text-foreground" {...p} />
          ),
          em: ({ node, ...p }) => <em className="italic" {...p} />,
          del: ({ node, ...p }) => <del className="opacity-70" {...p} />,
          a: ({ node, ...p }) => (
            <a className="text-brand underline underline-offset-2 hover:opacity-80" target="_blank" rel="noreferrer" {...p} />
          ),
          ul: ({ node, ...p }) => <ul className="my-2 ml-5 list-disc space-y-1" {...p} />,
          ol: ({ node, ...p }) => <ol className="my-2 ml-5 list-decimal space-y-1" {...p} />,
          li: ({ node, ...p }) => <li className="leading-relaxed" {...p} />,
          blockquote: ({ node, ...p }) => (
            <blockquote
              className="my-3 rounded-r-lg border-l-4 border-brand bg-surface-elevated/60 px-4 py-2 italic text-muted-foreground"
              {...p}
            />
          ),
          hr: () => <hr className="my-4 border-border" />,
          code: ({ node, className, children, ...p }) => {
            const isBlock = /language-/.test(className ?? "");
            if (isBlock) {
              return (
                <pre className="my-3 overflow-x-auto rounded-xl border border-border bg-background p-3 text-xs">
                  <code className={className} {...p}>
                    {children}
                  </code>
                </pre>
              );
            }
            return (
              <code className="rounded bg-surface-elevated px-1.5 py-0.5 text-[0.85em] font-mono text-brand" {...p}>
                {children}
              </code>
            );
          },
          table: ({ node, ...p }) => (
            <div className="my-3 overflow-x-auto rounded-xl border border-border">
              <table className="w-full border-collapse text-left text-xs" {...p} />
            </div>
          ),
          thead: ({ node, ...p }) => <thead className="bg-surface-elevated" {...p} />,
          th: ({ node, ...p }) => (
            <th className="border-b border-border px-3 py-2 font-semibold text-foreground" {...p} />
          ),
          td: ({ node, ...p }) => (
            <td className="border-b border-border/50 px-3 py-2 align-top" {...p} />
          ),
          input: ({ node, ...p }) =>
            p.type === "checkbox" ? (
              <input
                {...p}
                disabled
                className="mr-1.5 h-3.5 w-3.5 translate-y-0.5 rounded border-border accent-brand"
              />
            ) : (
              <input {...p} />
            ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

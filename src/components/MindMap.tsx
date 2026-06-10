import { useState } from "react";
import type { RoadmapMonth, RoadmapTask } from "@/lib/roadmap";
import { CATEGORY_META } from "@/lib/roadmap";

interface MindMapProps {
  month: RoadmapMonth;
}

const CAT_ORDER: Array<RoadmapTask["category"]> = [
  "study", "exam", "records", "essay", "activity", "mental",
];

export function MindMap({ month }: MindMapProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const W = 900, H = 600;
  const cx = W / 2, cy = H / 2;
  const R_CAT = 145, R_TASK = 275;

  // Group tasks by category
  const catGroups: Partial<Record<RoadmapTask["category"], RoadmapTask[]>> = {};
  for (const t of month.tasks) {
    if (!catGroups[t.category]) catGroups[t.category] = [];
    catGroups[t.category]!.push(t);
  }
  const usedCats = CAT_ORDER.filter((c) => (catGroups[c]?.length ?? 0) > 0);
  const catCount = usedCats.length || 1;

  type NodeDef = {
    id: string; label: string; x: number; y: number;
    type: "center" | "category" | "task";
    color: string; bg: string;
    task?: RoadmapTask; catKey?: string;
  };
  type EdgeDef = { x1: number; y1: number; x2: number; y2: number; color: string };

  const nodes: NodeDef[] = [];
  const edges: EdgeDef[] = [];

  nodes.push({ id: "center", label: month.focus, x: cx, y: cy, type: "center", color: "#fff", bg: "url(#gradCenter)" });

  usedCats.forEach((cat, ci) => {
    const angle = (ci / catCount) * Math.PI * 2 - Math.PI / 2;
    const catX = cx + Math.cos(angle) * R_CAT;
    const catY = cy + Math.sin(angle) * R_CAT;
    const meta = CATEGORY_META[cat];

    nodes.push({ id: `cat-${cat}`, label: meta.label, x: catX, y: catY, type: "category", color: meta.color, bg: meta.color, catKey: cat });
    edges.push({ x1: cx, y1: cy, x2: catX, y2: catY, color: meta.color });

    const tasks = catGroups[cat] ?? [];
    const spread = Math.min((Math.PI * 2) / catCount, 1.0);

    tasks.forEach((task, ti) => {
      const taskAngle = angle + (ti - (tasks.length - 1) / 2) * (spread / Math.max(tasks.length, 1));
      const tX = cx + Math.cos(taskAngle) * R_TASK;
      const tY = cy + Math.sin(taskAngle) * R_TASK;

      nodes.push({ id: task.id, label: task.title, x: tX, y: tY, type: "task", color: meta.color, bg: meta.bg, task, catKey: cat });
      edges.push({ x1: catX, y1: catY, x2: tX, y2: tY, color: meta.color });
    });
  });

  const selNode = nodes.find((n) => n.id === selected);

  return (
    <div className="relative">
      <div className="overflow-x-auto rounded-2xl border border-border bg-[#060b18]">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px]" style={{ minHeight: 320, maxHeight: 520 }}>
          <defs>
            <radialGradient id="gradCenter" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </radialGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
              <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {edges.map((e, i) => (
            <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
              stroke={e.color} strokeWidth={1.5} strokeOpacity={0.4} strokeDasharray="4 3" />
          ))}

          {nodes.map((n) => {
            const isSel = selected === n.id;

            if (n.type === "center") return (
              <g key={n.id}>
                <circle cx={n.x} cy={n.y} r={52} fill="url(#gradCenter)" filter="url(#glow)" />
                <circle cx={n.x} cy={n.y} r={52} fill="none" stroke="#6366f1" strokeWidth={2} />
                <foreignObject x={n.x - 44} y={n.y - 26} width={88} height={52}>
                  <div style={{ fontSize: 10, color: "#fff", textAlign: "center", fontWeight: 700, lineHeight: "1.3", padding: "0 4px", wordBreak: "keep-all" }}>
                    {n.label}
                  </div>
                </foreignObject>
              </g>
            );

            if (n.type === "category") return (
              <g key={n.id} onClick={() => setSelected(selected === n.id ? null : n.id)} style={{ cursor: "pointer" }}>
                <circle cx={n.x} cy={n.y} r={28} fill={n.bg} stroke={n.color} strokeWidth={2} fillOpacity={0.2} filter="url(#glow)" />
                <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize={10} fontWeight={700} fill={n.color}>{n.label}</text>
              </g>
            );

            // task node
            const w = 90, h = 32;
            return (
              <g key={n.id} onClick={() => setSelected(isSel ? null : n.id)} style={{ cursor: "pointer" }}>
                <rect x={n.x - w / 2} y={n.y - h / 2} width={w} height={h} rx={8}
                  fill={isSel ? n.color : "#0d1425"} stroke={n.color} strokeWidth={isSel ? 2 : 1} />
                <foreignObject x={n.x - w / 2 + 4} y={n.y - h / 2 + 3} width={w - 8} height={h - 6}>
                  <div style={{ fontSize: 9, color: isSel ? "#fff" : n.color, textAlign: "center", fontWeight: 600, lineHeight: "1.3", overflow: "hidden", wordBreak: "keep-all" }}>
                    {n.label}
                  </div>
                </foreignObject>
                {(n.task?.tips?.length ?? 0) > 0 && (
                  <circle cx={n.x + w / 2 - 4} cy={n.y - h / 2 + 4} r={4} fill={n.color} />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {selNode?.task && (
        <div className="mt-3 rounded-2xl border p-4" style={{ borderColor: selNode.color, background: `${selNode.color}12` }}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: selNode.color, color: "#fff" }}>
                {CATEGORY_META[selNode.task.category].label}
              </span>
              <h4 className="text-sm font-bold">{selNode.task.title}</h4>
              <p className="mt-1 text-xs text-muted-foreground">{selNode.task.detail}</p>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[10px] text-muted-foreground">예상 소요</div>
              <div className="text-sm font-bold" style={{ color: selNode.color }}>{selNode.task.estimatedHours}h</div>
            </div>
          </div>
          {selNode.task.tips?.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {selNode.task.tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <span className="mt-0.5 text-[10px]" style={{ color: selNode.color }}>▸</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="mt-2 text-center text-[10px] text-muted-foreground">
        카테고리/과제 클릭 → 상세 보기
      </p>
    </div>
  );
}

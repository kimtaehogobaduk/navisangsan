import { useState } from "react";
import type { RoadmapMonth, RoadmapTask } from "@/lib/roadmap";
import { CATEGORY_META } from "@/lib/roadmap";

interface MindMapProps {
  month: RoadmapMonth;
  studentName?: string;
}

const CAT_ORDER: Array<RoadmapTask["category"]> = [
  "study", "exam", "records", "essay", "activity", "mental",
];

const BRANCH_PALETTE = [
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#6366f1",
  "#ec4899",
  "#8b5cf6",
  "#84cc16",
];

const CAT_EMOJI: Record<RoadmapTask["category"], string> = {
  study: "📚",
  exam: "📝",
  records: "📒",
  essay: "✍️",
  activity: "🎯",
  mental: "💪",
};

export function MindMap({ month, studentName }: MindMapProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const W = 1400, H = 1000;
  const cx = W / 2, cy = H / 2;
  const R_CAT = 230;
  const R_TASK = 450;
  const R_TIP = 130;

  const catGroups: Partial<Record<RoadmapTask["category"], RoadmapTask[]>> = {};
  for (const t of month.tasks) {
    if (!catGroups[t.category]) catGroups[t.category] = [];
    catGroups[t.category]!.push(t);
  }
  const usedCats = CAT_ORDER.filter((c) => (catGroups[c]?.length ?? 0) > 0);
  const catCount = usedCats.length || 1;

  type Node = {
    id: string;
    label: string;
    x: number;
    y: number;
    type: "center" | "category" | "task" | "tip";
    color: string;
    task?: RoadmapTask;
  };
  type Edge = {
    x1: number; y1: number; x2: number; y2: number;
    color: string;
    width: number;
    curve: number;
  };

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const centerLabel = studentName ? `${studentName}의\n공부 솔루션` : "나의\n공부 솔루션";

  nodes.push({
    id: "center",
    label: centerLabel,
    x: cx, y: cy,
    type: "center",
    color: "#fbbf24",
  });

  usedCats.forEach((cat, ci) => {
    const branchColor = BRANCH_PALETTE[ci % BRANCH_PALETTE.length];
    const angle = (ci / catCount) * Math.PI * 2 - Math.PI / 2;
    const catX = cx + Math.cos(angle) * R_CAT;
    const catY = cy + Math.sin(angle) * R_CAT;
    const meta = CATEGORY_META[cat];

    nodes.push({
      id: `cat-${cat}`,
      label: `${CAT_EMOJI[cat]} ${meta.label}`,
      x: catX, y: catY,
      type: "category",
      color: branchColor,
    });
    edges.push({
      x1: cx, y1: cy, x2: catX, y2: catY,
      color: branchColor, width: 4, curve: 0.3,
    });

    const tasks = catGroups[cat] ?? [];
    const maxSpread = Math.min((Math.PI * 2) / catCount * 0.9, 1.3);

    tasks.forEach((task, ti) => {
      const taskAngle = angle + (ti - (tasks.length - 1) / 2) * (maxSpread / Math.max(tasks.length, 1));
      const tX = cx + Math.cos(taskAngle) * R_TASK;
      const tY = cy + Math.sin(taskAngle) * R_TASK;

      nodes.push({
        id: task.id,
        label: task.title,
        x: tX, y: tY,
        type: "task",
        color: branchColor,
        task,
      });
      edges.push({
        x1: catX, y1: catY, x2: tX, y2: tY,
        color: branchColor, width: 2.5, curve: 0.22,
      });

      if (selected === task.id && task.tips?.length) {
        const tipCount = Math.min(task.tips.length, 4);
        task.tips.slice(0, tipCount).forEach((tip, tipI) => {
          const tipAngle = taskAngle + (tipI - (tipCount - 1) / 2) * 0.28;
          const lx = tX + Math.cos(tipAngle) * R_TIP;
          const ly = tY + Math.sin(tipAngle) * R_TIP;
          nodes.push({
            id: `${task.id}-tip-${tipI}`,
            label: tip.length > 22 ? tip.slice(0, 21) + "…" : tip,
            x: lx, y: ly,
            type: "tip",
            color: branchColor,
          });
          edges.push({
            x1: tX, y1: tY, x2: lx, y2: ly,
            color: branchColor, width: 1.5, curve: 0.15,
          });
        });
      }
    });
  });

  const curvedPath = (e: Edge): string => {
    const mx = (e.x1 + e.x2) / 2;
    const my = (e.y1 + e.y2) / 2;
    const dx = e.x2 - e.x1;
    const dy = e.y2 - e.y1;
    const len = Math.hypot(dx, dy);
    const offX = (-dy / len) * len * e.curve;
    const offY = (dx / len) * len * e.curve;
    return `M ${e.x1} ${e.y1} Q ${mx + offX} ${my + offY} ${e.x2} ${e.y2}`;
  };

  const selNode = nodes.find((n) => n.id === selected);

  return (
    <div className="relative">
      <div className="overflow-x-auto rounded-2xl border border-border bg-gradient-to-br from-[#fffdf6] to-[#fef3c7] shadow-inner">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[700px]"
          style={{ minHeight: 480, maxHeight: 780 }}
        >
          <defs>
            <radialGradient id="centerGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="60%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#f59e0b" />
            </radialGradient>
            <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.18" />
            </filter>
            <pattern id="paper" width="6" height="6" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.4" fill="#d4a373" opacity="0.08" />
            </pattern>
          </defs>

          <rect width={W} height={H} fill="url(#paper)" />

          {edges.map((e, i) => (
            <path
              key={i}
              d={curvedPath(e)}
              stroke={e.color}
              strokeWidth={e.width}
              strokeLinecap="round"
              fill="none"
              opacity={0.82}
            />
          ))}

          {nodes.map((n) => {
            const isSel = selected === n.id;

            if (n.type === "center") {
              const lines = n.label.split("\n");
              return (
                <g key={n.id} filter="url(#softShadow)">
                  <circle cx={n.x} cy={n.y} r={86} fill="url(#centerGrad)" stroke="#b45309" strokeWidth={3} />
                  <text x={n.x - 66} y={n.y - 58} fontSize={24}>✨</text>
                  <text x={n.x + 48} y={n.y + 75} fontSize={22}>⭐</text>
                  <foreignObject x={n.x - 78} y={n.y - 44} width={156} height={88}>
                    <div
                      style={{
                        fontSize: 15,
                        color: "#7c2d12",
                        textAlign: "center",
                        fontWeight: 900,
                        lineHeight: "1.3",
                        padding: "0 6px",
                        wordBreak: "keep-all",
                        textShadow: "0 1px 0 #fff8",
                      }}
                    >
                      {lines.map((line, i) => (
                        <div key={i}>{line}</div>
                      ))}
                    </div>
                  </foreignObject>
                </g>
              );
            }

            if (n.type === "category") {
              const w = 136, h = 48;
              return (
                <g
                  key={n.id}
                  style={{ cursor: "default" }}
                  filter="url(#softShadow)"
                >
                  <rect
                    x={n.x - w / 2}
                    y={n.y - h / 2}
                    width={w}
                    height={h}
                    rx={24}
                    fill="#fff"
                    stroke={n.color}
                    strokeWidth={3}
                  />
                  <foreignObject x={n.x - w / 2 + 4} y={n.y - h / 2 + 4} width={w - 8} height={h - 8}>
                    <div
                      style={{
                        fontSize: 14,
                        color: n.color,
                        textAlign: "center",
                        fontWeight: 800,
                        lineHeight: "1.6",
                        wordBreak: "keep-all",
                      }}
                    >
                      {n.label}
                    </div>
                  </foreignObject>
                </g>
              );
            }

            if (n.type === "task") {
              const w = 138, h = 46;
              const hasTips = (n.task?.tips?.length ?? 0) > 0;
              return (
                <g
                  key={n.id}
                  onClick={() => setSelected(isSel ? null : n.id)}
                  style={{ cursor: "pointer" }}
                  filter="url(#softShadow)"
                >
                  <rect
                    x={n.x - w / 2}
                    y={n.y - h / 2}
                    width={w}
                    height={h}
                    rx={10}
                    fill={isSel ? n.color : "#fff"}
                    stroke={n.color}
                    strokeWidth={isSel ? 3 : 2}
                  />
                  {n.task?.priority === "high" && !isSel && (
                    <rect
                      x={n.x - w / 2}
                      y={n.y - h / 2}
                      width={4}
                      height={h}
                      rx={2}
                      fill={n.color}
                    />
                  )}
                  <foreignObject x={n.x - w / 2 + 6} y={n.y - h / 2 + 3} width={w - 14} height={h - 6}>
                    <div
                      style={{
                        fontSize: 11,
                        color: isSel ? "#fff" : "#1f2937",
                        textAlign: "center",
                        fontWeight: 700,
                        lineHeight: "1.25",
                        overflow: "hidden",
                        wordBreak: "keep-all",
                      }}
                    >
                      {n.label}
                    </div>
                  </foreignObject>
                  {hasTips && (
                    <circle
                      cx={n.x + w / 2 - 7}
                      cy={n.y - h / 2 + 7}
                      r={5.5}
                      fill={isSel ? "#fff" : n.color}
                      stroke={isSel ? n.color : "#fff"}
                      strokeWidth={1.5}
                    />
                  )}
                  {n.task?.estimatedHours && (
                    <text
                      x={n.x + w / 2 - 5}
                      y={n.y + h / 2 - 3}
                      fontSize={8}
                      fill={isSel ? "#fff8" : "#9ca3af"}
                      textAnchor="end"
                      fontWeight={600}
                    >
                      {n.task.estimatedHours}h
                    </text>
                  )}
                </g>
              );
            }

            return (
              <g key={n.id}>
                <circle cx={n.x} cy={n.y} r={5.5} fill={n.color} stroke="#fff" strokeWidth={2} />
                <text
                  x={n.x + 9}
                  y={n.y + 4}
                  fontSize={9.5}
                  fontWeight={600}
                  fill="#374151"
                  style={{ paintOrder: "stroke" }}
                  stroke="#fff"
                  strokeWidth={3}
                >
                  {n.label}
                </text>
                <text x={n.x + 9} y={n.y + 4} fontSize={9.5} fontWeight={600} fill="#374151">
                  {n.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {selNode?.task && (
        <div
          className="mt-3 rounded-2xl border-2 p-4"
          style={{ borderColor: selNode.color, background: `${selNode.color}10` }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span
                  className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white"
                  style={{ background: selNode.color }}
                >
                  {CAT_EMOJI[selNode.task.category]} {CATEGORY_META[selNode.task.category].label}
                </span>
                <span
                  className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{ background: `${selNode.color}20`, color: selNode.color }}
                >
                  {selNode.task.priority === "high" ? "🔥 긴급" : selNode.task.priority === "medium" ? "📌 중요" : "✅ 일반"}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {selNode.task.week}주차
                </span>
              </div>
              <h4 className="text-sm font-bold leading-snug">{selNode.task.title}</h4>
              <p className="mt-0.5 text-xs text-muted-foreground">{selNode.task.detail}</p>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[10px] text-muted-foreground">예상 소요</div>
              <div className="text-sm font-bold" style={{ color: selNode.color }}>
                {selNode.task.estimatedHours}h
              </div>
            </div>
          </div>
          {selNode.task.tips?.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] font-bold mb-1.5" style={{ color: selNode.color }}>
                ✏️ 실전 실행 팁
              </p>
              <ul className="space-y-1.5">
                {selNode.task.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span
                      className="mt-0.5 shrink-0 rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold text-white"
                      style={{ background: selNode.color }}
                    >
                      {i + 1}
                    </span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <p className="mt-2 text-center text-[10px] text-muted-foreground">
        가지를 클릭하면 구체적인 실전 팁이 펼쳐져요 ✏️ &nbsp;|&nbsp; 🔴 빨간 막대 = 긴급 과제
      </p>
    </div>
  );
}

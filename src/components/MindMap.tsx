import { useState } from "react";
import type { RoadmapMonth, RoadmapTask } from "@/lib/roadmap";
import { CATEGORY_META } from "@/lib/roadmap";

interface MindMapProps {
  month: RoadmapMonth;
}

const CAT_ORDER: Array<RoadmapTask["category"]> = [
  "study", "exam", "records", "essay", "activity", "mental",
];

// 손그림 마인드맵 느낌의 비비드 팔레트 (브랜치마다 다른 톤)
const BRANCH_PALETTE = [
  "#ef4444", // red
  "#f59e0b", // amber
  "#10b981", // emerald
  "#06b6d4", // cyan
  "#6366f1", // indigo
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#84cc16", // lime
];

// 카테고리별 이모지 아이콘 (손그림 마인드맵 느낌)
const CAT_EMOJI: Record<RoadmapTask["category"], string> = {
  study: "📚",
  exam: "📝",
  records: "📒",
  essay: "✍️",
  activity: "🎯",
  mental: "💪",
};

export function MindMap({ month }: MindMapProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const W = 1100, H = 760;
  const cx = W / 2, cy = H / 2;
  const R_CAT = 215;
  const R_TASK = 380;
  const R_TIP = 110; // task에서 tip까지 거리

  // Group tasks by category
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
    curve: number; // 곡률
  };

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  nodes.push({
    id: "center",
    label: month.focus,
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
      color: branchColor, width: 4, curve: 0.35,
    });

    const tasks = catGroups[cat] ?? [];
    const spread = Math.min((Math.PI * 2) / catCount * 0.85, 1.15);

    tasks.forEach((task, ti) => {
      const taskAngle = angle + (ti - (tasks.length - 1) / 2) * (spread / Math.max(tasks.length, 1));
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
        color: branchColor, width: 2.5, curve: 0.25,
      });

      // Tip leaves (선택된 task에만 표시 → 너무 복잡해지지 않도록)
      if (selected === task.id && task.tips?.length) {
        const tipCount = Math.min(task.tips.length, 5);
        task.tips.slice(0, tipCount).forEach((tip, tipI) => {
          const tipAngle = taskAngle + (tipI - (tipCount - 1) / 2) * 0.32;
          const lx = tX + Math.cos(tipAngle) * R_TIP;
          const ly = tY + Math.sin(tipAngle) * R_TIP;
          nodes.push({
            id: `${task.id}-tip-${tipI}`,
            label: tip.length > 18 ? tip.slice(0, 17) + "…" : tip,
            x: lx, y: ly,
            type: "tip",
            color: branchColor,
          });
          edges.push({
            x1: tX, y1: tY, x2: lx, y2: ly,
            color: branchColor, width: 1.5, curve: 0.18,
          });
        });
      }
    });
  });

  // Bezier curved path between two points
  const curvedPath = (e: Edge): string => {
    const mx = (e.x1 + e.x2) / 2;
    const my = (e.y1 + e.y2) / 2;
    const dx = e.x2 - e.x1;
    const dy = e.y2 - e.y1;
    const len = Math.hypot(dx, dy);
    // 수직 방향으로 살짝 오프셋 → 손그림 곡선 느낌
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
          className="w-full min-w-[640px]"
          style={{ minHeight: 420, maxHeight: 680 }}
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
            {/* 종이 질감 살짝 */}
            <pattern id="paper" width="6" height="6" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.4" fill="#d4a373" opacity="0.08" />
            </pattern>
          </defs>

          <rect width={W} height={H} fill="url(#paper)" />

          {/* 곡선 가지들 */}
          {edges.map((e, i) => (
            <path
              key={i}
              d={curvedPath(e)}
              stroke={e.color}
              strokeWidth={e.width}
              strokeLinecap="round"
              fill="none"
              opacity={0.85}
            />
          ))}

          {/* 노드 */}
          {nodes.map((n) => {
            const isSel = selected === n.id;

            if (n.type === "center") {
              return (
                <g key={n.id} filter="url(#softShadow)">
                  <circle cx={n.x} cy={n.y} r={78} fill="url(#centerGrad)" stroke="#b45309" strokeWidth={3} />
                  {/* 작은 데코 별 */}
                  <text x={n.x - 60} y={n.y - 55} fontSize={22}>✨</text>
                  <text x={n.x + 45} y={n.y + 70} fontSize={20}>⭐</text>
                  <foreignObject x={n.x - 70} y={n.y - 40} width={140} height={80}>
                    <div
                      style={{
                        fontSize: 16,
                        color: "#7c2d12",
                        textAlign: "center",
                        fontWeight: 900,
                        lineHeight: "1.2",
                        padding: "0 6px",
                        wordBreak: "keep-all",
                        textShadow: "0 1px 0 #fff8",
                      }}
                    >
                      {n.label}
                    </div>
                  </foreignObject>
                </g>
              );
            }

            if (n.type === "category") {
              const w = 130, h = 46;
              return (
                <g
                  key={n.id}
                  onClick={() => setSelected(selected === n.id ? null : n.id)}
                  style={{ cursor: "pointer" }}
                  filter="url(#softShadow)"
                >
                  <rect
                    x={n.x - w / 2}
                    y={n.y - h / 2}
                    width={w}
                    height={h}
                    rx={22}
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
              const w = 130, h = 44;
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
                  <foreignObject x={n.x - w / 2 + 4} y={n.y - h / 2 + 3} width={w - 8} height={h - 6}>
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
                  {(n.task?.tips?.length ?? 0) > 0 && (
                    <circle
                      cx={n.x + w / 2 - 6}
                      cy={n.y - h / 2 + 6}
                      r={5}
                      fill={n.color}
                      stroke="#fff"
                      strokeWidth={1.5}
                    />
                  )}
                </g>
              );
            }

            // tip leaf
            return (
              <g key={n.id}>
                <circle cx={n.x} cy={n.y} r={6} fill={n.color} stroke="#fff" strokeWidth={2} />
                <text
                  x={n.x + 10}
                  y={n.y + 4}
                  fontSize={10}
                  fontWeight={600}
                  fill="#374151"
                  style={{ paintOrder: "stroke" }}
                  stroke="#fff"
                  strokeWidth={3}
                >
                  {n.label}
                </text>
                <text x={n.x + 10} y={n.y + 4} fontSize={10} fontWeight={600} fill="#374151">
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
            <div>
              <span
                className="mb-1 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white"
                style={{ background: selNode.color }}
              >
                {CAT_EMOJI[selNode.task.category]} {CATEGORY_META[selNode.task.category].label}
              </span>
              <h4 className="text-sm font-bold">{selNode.task.title}</h4>
              <p className="mt-1 text-xs text-muted-foreground">{selNode.task.detail}</p>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[10px] text-muted-foreground">예상 소요</div>
              <div className="text-sm font-bold" style={{ color: selNode.color }}>
                {selNode.task.estimatedHours}h
              </div>
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
        가지를 클릭하면 세부 팁이 손그림처럼 펼쳐져요 ✏️
      </p>
    </div>
  );
}

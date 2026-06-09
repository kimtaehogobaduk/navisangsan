import { useState } from "react";
import type { RoadmapMonth, RoadmapTask } from "@/lib/roadmap";
import { CATEGORY_META } from "@/lib/roadmap";

interface MindMapProps {
  month: RoadmapMonth;
}

type Node = {
  id: string;
  label: string;
  x: number;
  y: number;
  type: "center" | "category" | "task" | "subtask";
  color: string;
  bg: string;
  task?: RoadmapTask;
  catKey?: string;
  parentX?: number;
  parentY?: number;
};

const CAT_ORDER: Array<RoadmapTask["category"]> = [
  "academics",
  "exam",
  "records",
  "essay",
  "activity",
  "mental",
];

export function MindMap({ month }: MindMapProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [expandedCat, setExpandedCat] = useState<Set<string>>(new Set());

  const W = 900;
  const H = 640;
  const cx = W / 2;
  const cy = H / 2;
  const R_CAT = 155;
  const R_TASK = 290;
  const R_SUB = 390;

  const allTasks = month.weeks.flatMap((w) => w.tasks);

  const catGroups: Partial<Record<string, RoadmapTask[]>> = {};
  for (const t of allTasks) {
    if (!catGroups[t.category]) catGroups[t.category] = [];
    catGroups[t.category]!.push(t);
  }

  const usedCats = CAT_ORDER.filter((c) => (catGroups[c]?.length ?? 0) > 0);
  const catCount = usedCats.length || 1;

  const nodes: Node[] = [];
  const edges: Array<{ x1: number; y1: number; x2: number; y2: number; color: string }> = [];

  nodes.push({
    id: "center",
    label: month.focus,
    x: cx,
    y: cy,
    type: "center",
    color: "#fff",
    bg: "url(#gradCenter)",
  });

  usedCats.forEach((cat, ci) => {
    const baseAngle = (ci / catCount) * Math.PI * 2 - Math.PI / 2;
    const catX = cx + Math.cos(baseAngle) * R_CAT;
    const catY = cy + Math.sin(baseAngle) * R_CAT;
    const meta = CATEGORY_META[cat];
    const catId = `cat-${cat}`;

    nodes.push({
      id: catId,
      label: meta.label,
      x: catX,
      y: catY,
      type: "category",
      color: meta.color,
      bg: meta.color,
      catKey: cat,
      parentX: cx,
      parentY: cy,
    });

    edges.push({ x1: cx, y1: cy, x2: catX, y2: catY, color: meta.color });

    const tasks = catGroups[cat] ?? [];
    const spread = Math.min((Math.PI * 2) / catCount, 1.1);

    tasks.forEach((task, ti) => {
      const taskAngle =
        baseAngle + (ti - (tasks.length - 1) / 2) * (spread / Math.max(tasks.length, 1));
      const tX = cx + Math.cos(taskAngle) * R_TASK;
      const tY = cy + Math.sin(taskAngle) * R_TASK;
      const taskId = task.id;

      nodes.push({
        id: taskId,
        label: task.title,
        x: tX,
        y: tY,
        type: "task",
        color: meta.color,
        bg: meta.bg,
        task,
        catKey: cat,
        parentX: catX,
        parentY: catY,
      });

      edges.push({ x1: catX, y1: catY, x2: tX, y2: tY, color: meta.color });

      if (expandedCat.has(task.id)) {
        task.subtasks.forEach((sub, si) => {
          const subAngle = taskAngle + (si - (task.subtasks.length - 1) / 2) * 0.25;
          const sX = cx + Math.cos(subAngle) * R_SUB;
          const sY = cy + Math.sin(subAngle) * R_SUB;
          const subId = `sub-${task.id}-${si}`;

          nodes.push({
            id: subId,
            label: sub.text,
            x: sX,
            y: sY,
            type: "subtask",
            color: meta.color,
            bg: meta.bg,
            parentX: tX,
            parentY: tY,
          });

          edges.push({ x1: tX, y1: tY, x2: sX, y2: sY, color: `${meta.color}88` });
        });
      }
    });
  });

  function handleNodeClick(node: Node) {
    if (node.type === "task") {
      setSelected(selected === node.id ? null : node.id);
      setExpandedCat((prev) => {
        const next = new Set(prev);
        if (next.has(node.id)) next.delete(node.id);
        else next.add(node.id);
        return next;
      });
    } else if (node.type === "category") {
      setExpandedCat((prev) => {
        const next = new Set(prev);
        const tasks = catGroups[node.catKey ?? ""] ?? [];
        const allExpanded = tasks.every((t) => prev.has(t.id));
        tasks.forEach((t) => (allExpanded ? next.delete(t.id) : next.add(t.id)));
        return next;
      });
    }
  }

  const selNode = nodes.find((n) => n.id === selected);

  return (
    <div className="relative">
      <div className="overflow-x-auto rounded-2xl border border-border bg-[#0a0e1a]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[600px]"
          style={{ minHeight: 340, maxHeight: 560 }}
        >
          <defs>
            <radialGradient id="gradCenter" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </radialGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {edges.map((e, i) => (
            <line
              key={i}
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              stroke={e.color}
              strokeWidth={1.5}
              strokeOpacity={0.5}
              strokeDasharray="4 3"
            />
          ))}

          {nodes.map((n) => {
            const isSelected = selected === n.id;
            if (n.type === "center") {
              return (
                <g key={n.id}>
                  <circle cx={n.x} cy={n.y} r={54} fill="url(#gradCenter)" filter="url(#glow)" />
                  <circle cx={n.x} cy={n.y} r={54} fill="none" stroke="#6366f1" strokeWidth={2} />
                  <foreignObject x={n.x - 46} y={n.y - 28} width={92} height={56}>
                    <div
                      style={{
                        fontSize: 10,
                        color: "#fff",
                        textAlign: "center",
                        fontWeight: 700,
                        lineHeight: "1.3",
                        padding: "0 4px",
                        wordBreak: "keep-all",
                      }}
                    >
                      {n.label}
                    </div>
                  </foreignObject>
                </g>
              );
            }

            if (n.type === "category") {
              return (
                <g key={n.id} onClick={() => handleNodeClick(n)} style={{ cursor: "pointer" }}>
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={30}
                    fill={n.bg}
                    stroke={n.color}
                    strokeWidth={2}
                    fillOpacity={0.2}
                    filter="url(#glow)"
                  />
                  <text
                    x={n.x}
                    y={n.y + 4}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={700}
                    fill={n.color}
                  >
                    {n.label}
                  </text>
                </g>
              );
            }

            if (n.type === "task") {
              const w = 88;
              const h = 34;
              return (
                <g key={n.id} onClick={() => handleNodeClick(n)} style={{ cursor: "pointer" }}>
                  <rect
                    x={n.x - w / 2}
                    y={n.y - h / 2}
                    width={w}
                    height={h}
                    rx={8}
                    fill={isSelected ? n.color : "#0f1729"}
                    stroke={n.color}
                    strokeWidth={isSelected ? 2 : 1}
                    fillOpacity={isSelected ? 0.9 : 1}
                  />
                  <foreignObject x={n.x - w / 2 + 4} y={n.y - h / 2 + 3} width={w - 8} height={h - 6}>
                    <div
                      style={{
                        fontSize: 9,
                        color: isSelected ? "#fff" : n.color,
                        textAlign: "center",
                        fontWeight: 600,
                        lineHeight: "1.3",
                        overflow: "hidden",
                        wordBreak: "keep-all",
                      }}
                    >
                      {n.label}
                    </div>
                  </foreignObject>
                  {(n.task?.subtasks.length ?? 0) > 0 && (
                    <circle cx={n.x + w / 2 - 5} cy={n.y - h / 2 + 5} r={5} fill={n.color} />
                  )}
                </g>
              );
            }

            if (n.type === "subtask") {
              const w = 80;
              const h = 26;
              return (
                <g key={n.id}>
                  <rect
                    x={n.x - w / 2}
                    y={n.y - h / 2}
                    width={w}
                    height={h}
                    rx={6}
                    fill="#0f1729"
                    stroke={n.color}
                    strokeWidth={1}
                    strokeOpacity={0.6}
                  />
                  <foreignObject x={n.x - w / 2 + 3} y={n.y - h / 2 + 3} width={w - 6} height={h - 6}>
                    <div
                      style={{
                        fontSize: 8,
                        color: n.color,
                        textAlign: "center",
                        fontWeight: 500,
                        lineHeight: "1.3",
                        overflow: "hidden",
                        wordBreak: "keep-all",
                        opacity: 0.85,
                      }}
                    >
                      {n.label}
                    </div>
                  </foreignObject>
                </g>
              );
            }

            return null;
          })}
        </svg>
      </div>

      {selNode?.task && (
        <div
          className="mt-3 rounded-2xl border p-4"
          style={{ borderColor: selNode.color, background: selNode.bg }}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <span
                className="mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: selNode.color, color: "#fff" }}
              >
                {CATEGORY_META[selNode.task.category].label}
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
          {selNode.task.subtasks.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {selNode.task.subtasks.map((sub, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <span className="mt-0.5 text-[10px]" style={{ color: selNode.color }}>
                    ▸
                  </span>
                  <div>
                    <span className="font-medium">{sub.text}</span>
                    {sub.detail && (
                      <span className="ml-1 text-muted-foreground">— {sub.detail}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="mt-2 text-center text-[10px] text-muted-foreground">
        카테고리 클릭 → 세부 펼치기 · 과제 클릭 → 상세 보기
      </p>
    </div>
  );
}

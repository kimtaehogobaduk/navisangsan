import { useState, useRef, useCallback, useEffect } from "react";
import type { RoadmapMonth, RoadmapTask } from "@/lib/roadmap";
import { CATEGORY_META } from "@/lib/roadmap";
import { ZoomIn, ZoomOut, Maximize2, Download, Move } from "lucide-react";

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

const W = 1400, H = 1000;
const cx = W / 2, cy = H / 2;
const R_CAT = 230;
const R_TASK = 450;
const R_TIP = 130;

export function MindMap({ month, studentName }: MindMapProps) {
  const [selected, setSelected] = useState<string | null>(null);

  // Pan/zoom state
  const [zoom, setZoom] = useState(0.72);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const lastTouches = useRef<React.Touch[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Recenter when month changes
  useEffect(() => {
    setZoom(0.72);
    setPan({ x: 0, y: 0 });
    setSelected(null);
  }, [month]);

  const clampZoom = (z: number) => Math.max(0.25, Math.min(4, z));

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.9;
    setZoom(z => clampZoom(z * factor));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-node]")) return;
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setPan(p => ({ x: p.x + dx, y: p.y + dy }));
  };

  const handleMouseUp = () => { isDragging.current = false; };

  // Touch pan
  const handleTouchStart = (e: React.TouchEvent) => {
    lastTouches.current = Array.from(e.touches);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touches = Array.from(e.touches);
    if (touches.length === 1 && lastTouches.current.length === 1) {
      const dx = touches[0].clientX - lastTouches.current[0].clientX;
      const dy = touches[0].clientY - lastTouches.current[0].clientY;
      setPan(p => ({ x: p.x + dx, y: p.y + dy }));
    } else if (touches.length === 2 && lastTouches.current.length === 2) {
      const d0 = Math.hypot(
        lastTouches.current[0].clientX - lastTouches.current[1].clientX,
        lastTouches.current[0].clientY - lastTouches.current[1].clientY,
      );
      const d1 = Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY,
      );
      if (d0 > 0) setZoom(z => clampZoom(z * (d1 / d0)));
    }
    lastTouches.current = touches;
  };

  // Save as PNG
  function savePNG() {
    const svg = svgRef.current;
    if (!svg) return;

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", String(W));
    clone.setAttribute("height", String(H));
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    // Add white background
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("width", String(W));
    bg.setAttribute("height", String(H));
    bg.setAttribute("fill", "#fffdf6");
    clone.insertBefore(bg, clone.firstChild);

    // Replace foreignObjects with SVG text (for canvas compatibility)
    clone.querySelectorAll("foreignObject").forEach((fo) => {
      const x = parseFloat(fo.getAttribute("x") || "0");
      const y = parseFloat(fo.getAttribute("y") || "0");
      const w = parseFloat(fo.getAttribute("width") || "100");
      const h = parseFloat(fo.getAttribute("height") || "30");
      const div = fo.querySelector("div");
      const rawText = div?.textContent?.trim() || "";
      const colorStr = div?.style?.color || "#1f2937";
      const fontSizeStr = div?.style?.fontSize || "12px";
      const fontSize = parseFloat(fontSizeStr) || 12;
      const bold = div?.style?.fontWeight === "900" || div?.style?.fontWeight === "800" || div?.style?.fontWeight === "700";

      // Split into lines of ~14 chars
      const words = rawText.split(/\s+/);
      const lines: string[] = [];
      let cur = "";
      for (const w2 of words) {
        if ((cur + " " + w2).trim().length > 14 && cur) {
          lines.push(cur.trim());
          cur = w2;
        } else {
          cur = cur ? cur + " " + w2 : w2;
        }
      }
      if (cur) lines.push(cur.trim());

      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      lines.forEach((line, i) => {
        const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
        const lineHeight = fontSize * 1.3;
        const totalH = lines.length * lineHeight;
        t.setAttribute("x", String(x + w / 2));
        t.setAttribute("y", String(y + h / 2 - totalH / 2 + i * lineHeight + fontSize * 0.85));
        t.setAttribute("text-anchor", "middle");
        t.setAttribute("font-size", String(fontSize));
        t.setAttribute("font-family", "Apple SD Gothic Neo, Noto Sans KR, sans-serif");
        t.setAttribute("fill", colorStr);
        if (bold) t.setAttribute("font-weight", "bold");
        t.textContent = line;
        g.appendChild(t);
      });
      fo.parentNode?.replaceChild(g, fo);
    });

    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(clone);
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = 2;
      canvas.width = W * scale;
      canvas.height = H * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(scale, scale);
      ctx.fillStyle = "#fffdf6";
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0, W, H);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => {
        if (!b) return;
        const a = document.createElement("a");
        const name = studentName ? `${studentName}_마인드맵.png` : "마인드맵.png";
        a.download = name;
        a.href = URL.createObjectURL(b);
        a.click();
      }, "image/png");
    };
    img.onerror = () => {
      // Fallback: SVG download
      const a = document.createElement("a");
      a.download = "마인드맵.svg";
      a.href = url;
      a.click();
    };
    img.src = url;
  }

  // ─── Build graph nodes/edges ──────────────────────────────────────────────
  const catGroups: Partial<Record<RoadmapTask["category"], RoadmapTask[]>> = {};
  for (const t of month.tasks) {
    if (!catGroups[t.category]) catGroups[t.category] = [];
    catGroups[t.category]!.push(t);
  }
  const usedCats = CAT_ORDER.filter((c) => (catGroups[c]?.length ?? 0) > 0);
  const catCount = usedCats.length || 1;

  type Node = {
    id: string; label: string; x: number; y: number;
    type: "center" | "category" | "task" | "tip";
    color: string; task?: RoadmapTask;
  };
  type Edge = { x1: number; y1: number; x2: number; y2: number; color: string; width: number; curve: number; };

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const centerLabel = studentName ? `${studentName}의\n공부 솔루션` : "나의\n공부 솔루션";
  nodes.push({ id: "center", label: centerLabel, x: cx, y: cy, type: "center", color: "#fbbf24" });

  usedCats.forEach((cat, ci) => {
    const branchColor = BRANCH_PALETTE[ci % BRANCH_PALETTE.length];
    const angle = (ci / catCount) * Math.PI * 2 - Math.PI / 2;
    const catX = cx + Math.cos(angle) * R_CAT;
    const catY = cy + Math.sin(angle) * R_CAT;
    const meta = CATEGORY_META[cat];

    nodes.push({ id: `cat-${cat}`, label: `${CAT_EMOJI[cat]} ${meta.label}`, x: catX, y: catY, type: "category", color: branchColor });
    edges.push({ x1: cx, y1: cy, x2: catX, y2: catY, color: branchColor, width: 4, curve: 0.3 });

    const tasks = catGroups[cat] ?? [];
    const maxSpread = Math.min((Math.PI * 2) / catCount * 0.9, 1.3);

    tasks.forEach((task, ti) => {
      const taskAngle = angle + (ti - (tasks.length - 1) / 2) * (maxSpread / Math.max(tasks.length, 1));
      const tX = cx + Math.cos(taskAngle) * R_TASK;
      const tY = cy + Math.sin(taskAngle) * R_TASK;

      nodes.push({ id: task.id, label: task.title, x: tX, y: tY, type: "task", color: branchColor, task });
      edges.push({ x1: catX, y1: catY, x2: tX, y2: tY, color: branchColor, width: 2.5, curve: 0.22 });

      if (selected === task.id && task.tips?.length) {
        const tipCount = Math.min(task.tips.length, 4);
        task.tips.slice(0, tipCount).forEach((tip, tipI) => {
          const tipAngle = taskAngle + (tipI - (tipCount - 1) / 2) * 0.28;
          const lx = tX + Math.cos(tipAngle) * R_TIP;
          const ly = tY + Math.sin(tipAngle) * R_TIP;
          nodes.push({ id: `${task.id}-tip-${tipI}`, label: tip.length > 22 ? tip.slice(0, 21) + "…" : tip, x: lx, y: ly, type: "tip", color: branchColor });
          edges.push({ x1: tX, y1: tY, x2: lx, y2: ly, color: branchColor, width: 1.5, curve: 0.15 });
        });
      }
    });
  });

  const curvedPath = (e: Edge): string => {
    const mx = (e.x1 + e.x2) / 2, my = (e.y1 + e.y2) / 2;
    const dx = e.x2 - e.x1, dy = e.y2 - e.y1;
    const len = Math.hypot(dx, dy);
    return `M ${e.x1} ${e.y1} Q ${mx + (-dy / len) * len * e.curve} ${my + (dx / len) * len * e.curve} ${e.x2} ${e.y2}`;
  };

  const selNode = nodes.find((n) => n.id === selected);

  return (
    <div className="relative space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2">
        <div className="flex items-center gap-1">
          <Move className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">드래그·스크롤로 탐색</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setZoom(z => clampZoom(z * 1.2))}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background transition hover:border-brand/40 hover:bg-surface-elevated"
            title="확대"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setZoom(z => clampZoom(z * 0.83))}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background transition hover:border-brand/40 hover:bg-surface-elevated"
            title="축소"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[40px] text-center text-xs font-mono text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => { setZoom(0.72); setPan({ x: 0, y: 0 }); }}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background transition hover:border-brand/40 hover:bg-surface-elevated"
            title="초기화"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <div className="h-4 w-px bg-border" />
          <button
            onClick={savePNG}
            className="flex items-center gap-1.5 rounded-lg border border-brand/40 bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand transition hover:bg-brand/20"
          >
            <Download className="h-3.5 w-3.5" />
            이미지 저장
          </button>
        </div>
      </div>

      {/* Map canvas */}
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-[#fffdf6] to-[#fef3c7] shadow-inner"
        style={{ height: 560, cursor: isDragging.current ? "grabbing" : "grab" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            width: "100%",
            height: "100%",
          }}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            style={{ width: "100%", height: "100%", display: "block" }}
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
              <path key={i} d={curvedPath(e)} stroke={e.color} strokeWidth={e.width}
                strokeLinecap="round" fill="none" opacity={0.82} />
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
                        style={{ fontSize: 15, color: "#7c2d12", textAlign: "center",
                          fontWeight: 900, lineHeight: "1.3", padding: "0 6px",
                          wordBreak: "keep-all", textShadow: "0 1px 0 #fff8" }}
                      >
                        {lines.map((line, i) => <div key={i}>{line}</div>)}
                      </div>
                    </foreignObject>
                  </g>
                );
              }

              if (n.type === "category") {
                const w = 136, h = 48;
                return (
                  <g key={n.id} filter="url(#softShadow)">
                    <rect x={n.x - w / 2} y={n.y - h / 2} width={w} height={h}
                      rx={24} fill="#fff" stroke={n.color} strokeWidth={3} />
                    <foreignObject x={n.x - w / 2 + 4} y={n.y - h / 2 + 4} width={w - 8} height={h - 8}>
                      <div style={{ fontSize: 14, color: n.color, textAlign: "center",
                        fontWeight: 800, lineHeight: "1.6", wordBreak: "keep-all" }}>
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
                  <g key={n.id} data-node="task" onClick={() => setSelected(isSel ? null : n.id)}
                    style={{ cursor: "pointer" }} filter="url(#softShadow)">
                    <rect x={n.x - w / 2} y={n.y - h / 2} width={w} height={h} rx={10}
                      fill={isSel ? n.color : "#fff"} stroke={n.color} strokeWidth={isSel ? 3 : 2} />
                    {n.task?.priority === "high" && !isSel && (
                      <rect x={n.x - w / 2} y={n.y - h / 2} width={4} height={h} rx={2} fill={n.color} />
                    )}
                    <foreignObject x={n.x - w / 2 + 6} y={n.y - h / 2 + 3} width={w - 14} height={h - 6}>
                      <div style={{ fontSize: 11, color: isSel ? "#fff" : "#1f2937", textAlign: "center",
                        fontWeight: 700, lineHeight: "1.25", overflow: "hidden", wordBreak: "keep-all" }}>
                        {n.label}
                      </div>
                    </foreignObject>
                    {hasTips && (
                      <circle cx={n.x + w / 2 - 7} cy={n.y - h / 2 + 7} r={5.5}
                        fill={isSel ? "#fff" : n.color} stroke={isSel ? n.color : "#fff"} strokeWidth={1.5} />
                    )}
                    {n.task?.estimatedHours && (
                      <text x={n.x + w / 2 - 5} y={n.y + h / 2 - 3}
                        fontSize={8} fill={isSel ? "#fff8" : "#9ca3af"} textAnchor="end" fontWeight={600}>
                        {n.task.estimatedHours}h
                      </text>
                    )}
                  </g>
                );
              }

              return (
                <g key={n.id}>
                  <circle cx={n.x} cy={n.y} r={5.5} fill={n.color} stroke="#fff" strokeWidth={2} />
                  <text x={n.x + 9} y={n.y + 4} fontSize={9.5} fontWeight={600} fill="#374151"
                    style={{ paintOrder: "stroke" }} stroke="#fff" strokeWidth={3}>{n.label}</text>
                  <text x={n.x + 9} y={n.y + 4} fontSize={9.5} fontWeight={600} fill="#374151">{n.label}</text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Zoom hint overlay */}
        <div className="pointer-events-none absolute bottom-2 right-2 rounded-lg bg-black/30 px-2 py-1 text-[10px] text-white/70">
          스크롤 = 줌 · 드래그 = 이동
        </div>
      </div>

      {/* Selected node detail */}
      {selNode?.task && (
        <div className="rounded-2xl border-2 p-4"
          style={{ borderColor: selNode.color, background: `${selNode.color}10` }}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white"
                  style={{ background: selNode.color }}>
                  {CAT_EMOJI[selNode.task.category]} {CATEGORY_META[selNode.task.category].label}
                </span>
                <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{ background: `${selNode.color}20`, color: selNode.color }}>
                  {selNode.task.priority === "high" ? "🔥 긴급" : selNode.task.priority === "medium" ? "📌 중요" : "✅ 일반"}
                </span>
                <span className="text-[10px] text-muted-foreground">{selNode.task.week}주차</span>
              </div>
              <h4 className="text-sm font-bold leading-snug">{selNode.task.title}</h4>
              <p className="mt-0.5 text-xs text-muted-foreground">{selNode.task.detail}</p>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[10px] text-muted-foreground">예상 소요</div>
              <div className="text-sm font-bold" style={{ color: selNode.color }}>{selNode.task.estimatedHours}h</div>
            </div>
          </div>
          {selNode.task.tips?.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] font-bold mb-1.5" style={{ color: selNode.color }}>✏️ 실전 실행 팁</p>
              <ul className="space-y-1.5">
                {selNode.task.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className="mt-0.5 shrink-0 rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold text-white"
                      style={{ background: selNode.color }}>{i + 1}</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <p className="text-center text-[10px] text-muted-foreground">
        가지 클릭 → 실전 팁 확인 &nbsp;|&nbsp; 🔴 빨간 막대 = 긴급 &nbsp;|&nbsp; 점 = 팁 있음
      </p>
    </div>
  );
}

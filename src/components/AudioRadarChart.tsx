import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from "recharts";

interface AudioScores {
  pronunciation: number;
  speed: number;
  fluency: number;
  intonation: number;
  delivery: number;
}

export default function AudioRadarChart({ scores }: { scores: AudioScores }) {
  const data = [
    { category: "발음·명확성", value: scores.pronunciation, fullMark: 20 },
    { category: "말하기 속도", value: scores.speed, fullMark: 20 },
    { category: "유창성", value: scores.fluency, fullMark: 20 },
    { category: "억양·강조", value: scores.intonation, fullMark: 20 },
    { category: "전달력", value: scores.delivery, fullMark: 20 },
  ];
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">음성 분석 결과</h3>
        <span className="rounded-full bg-brand/20 px-3 py-1 text-xs font-bold text-brand">
          {total}점 / 100점
        </span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid stroke="rgba(255,255,255,0.1)" />
          <PolarAngleAxis dataKey="category" tick={{ fill: "#94a3b8", fontSize: 11 }} />
          <PolarRadiusAxis angle={90} domain={[0, 20]} tick={false} axisLine={false} />
          <Radar
            name="점수"
            dataKey="value"
            stroke="#22d3ee"
            fill="#22d3ee"
            fillOpacity={0.25}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-2 gap-2 mt-2">
        {data.map((d) => (
          <div key={d.category} className="flex items-center justify-between rounded-xl bg-surface-elevated px-3 py-2">
            <span className="text-xs text-muted-foreground">{d.category}</span>
            <span className="text-sm font-bold text-brand">{d.value}점</span>
          </div>
        ))}
      </div>
    </div>
  );
}

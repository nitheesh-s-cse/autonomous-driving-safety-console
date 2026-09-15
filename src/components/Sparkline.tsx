export function Sparkline({
  data,
  color,
  height = 32,
  width = 120,
  markers,
  markerColor = "#FF4D5E",
  max,
}: {
  data: number[];
  color: string;
  height?: number;
  width?: number;
  markers?: boolean[];
  markerColor?: string;
  max?: number;
}) {
  if (data.length < 2) {
    return <svg width={width} height={height} />;
  }
  const finite = data.map((d) => (Number.isFinite(d) ? d : 0));
  const maxV = max ?? Math.max(...finite, 1);
  const minV = Math.min(...finite, 0);
  const range = maxV - minV || 1;

  const stepX = width / (data.length - 1);
  const points = finite.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - minV) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" />
      {markers &&
        markers.map((m, i) =>
          m ? <circle key={i} cx={i * stepX} cy={height - ((finite[i] - minV) / range) * height} r={1.8} fill={markerColor} /> : null,
        )}
    </svg>
  );
}

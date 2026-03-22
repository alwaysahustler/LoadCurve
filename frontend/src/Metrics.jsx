import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const GEN_COLORS = {
  Thermal:  "#E8623A",
  Solar:    "#F5A623",
  Hydro:    "#3498DB",
  Wind:     "#2ECC71",
  Nuclear:  "#9B59B6",
  Gas:      "#E74C3C",
};

// ── Gauge component ───────────────────────────────────────────────────────────
function Gauge({ value, max = 1, label, sublabel, color = "#6C63FF", format = v => v.toFixed(3) }) {
  const safe    = (value != null && !isNaN(value)) ? Number(value) : 0;
  const pct     = Math.min(safe / max, 1);
  const r       = 40;
  const cx      = 60;
  const cy      = 60;
  const startA  = Math.PI;
  const endA    = 0;
  const span    = endA - startA;
  const angle   = startA + span * pct;
  const x1 = cx + r * Math.cos(Math.PI);
  const y1 = cy + r * Math.sin(Math.PI);
  const x2 = cx + r * Math.cos(angle);
  const y2 = cy + r * Math.sin(angle);
  const large = pct > 0.5 ? 1 : 0;

  const trackPath = `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy}`;
  const fillPath  = (pct > 0 && !isNaN(x2) && !isNaN(y2))
    ? `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
    : `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx - r} ${cy}`;

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
      <svg width={120} height={72} viewBox="0 0 120 72">
        <path d={trackPath} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} strokeLinecap="round"/>
        <path d={fillPath}  fill="none" stroke={color} strokeWidth={10} strokeLinecap="round"/>
        <text x={cx} y={cy-2} textAnchor="middle" fill="#fff" fontSize={16} fontWeight={600}>{format(safe)}</text>
      </svg>
      <div style={{ fontSize:11, fontWeight:600, color:"#ccc", textAlign:"center" }}>{label}</div>
      {sublabel && <div style={{ fontSize:10, color:"#555", textAlign:"center" }}>{sublabel}</div>}
    </div>
  );
}

// ── Stat row ──────────────────────────────────────────────────────────────────
function StatRow({ label, value, unit, highlight, hint }) {
  return (
    <div style={{
      display:"flex", justifyContent:"space-between", alignItems:"baseline",
      padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,0.05)",
    }}>
      <div>
        <span style={{ fontSize:13, color: highlight ? "#a99fff" : "#aaa" }}>{label}</span>
        {hint && <div style={{ fontSize:10, color:"#444", marginTop:2 }}>{hint}</div>}
      </div>
      <div style={{ textAlign:"right" }}>
        <span style={{ fontSize:15, fontWeight:600, color: highlight ? "#a99fff" : "#fff" }}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
        {unit && <span style={{ fontSize:11, color:"#555", marginLeft:4 }}>{unit}</span>}
      </div>
    </div>
  );
}

// ── Frequency bar ─────────────────────────────────────────────────────────────
function FreqBar({ min, avg, max }) {
  const ideal = 50.0;
  const lo = 49.5; const hi = 50.5;
  const toX = v => ((v - lo) / (hi - lo)) * 100;

  const avgX = toX(avg);
  const color = Math.abs(avg - ideal) < 0.05 ? "#2ECC71"
              : Math.abs(avg - ideal) < 0.15 ? "#F5A623"
              : "#E8623A";

  return (
    <div style={{ marginTop:8 }}>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"#555", marginBottom:4 }}>
        <span>49.5 Hz</span><span>50.0 Hz (ideal)</span><span>50.5 Hz</span>
      </div>
      <div style={{ position:"relative", height:20, background:"rgba(255,255,255,0.05)", borderRadius:4 }}>
        {/* Green zone */}
        <div style={{ position:"absolute", left:"40%", width:"20%", height:"100%", background:"rgba(46,204,113,0.12)", borderRadius:2 }}/>
        {/* Ideal line */}
        <div style={{ position:"absolute", left:"50%", top:0, width:1, height:"100%", background:"rgba(46,204,113,0.4)" }}/>
        {/* Range bar */}
        <div style={{
          position:"absolute",
          left:`${toX(min)}%`, width:`${toX(max)-toX(min)}%`,
          top:"25%", height:"50%",
          background:`${color}44`, borderRadius:2,
        }}/>
        {/* Avg marker */}
        <div style={{
          position:"absolute", left:`${avgX}%`,
          top:"10%", height:"80%", width:3,
          background: color, borderRadius:2,
          transform:"translateX(-50%)",
        }}/>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"#666", marginTop:4 }}>
        <span>Min: {min?.toFixed(2)}</span>
        <span style={{ color }}> Avg: {avg?.toFixed(3)} Hz</span>
        <span>Max: {max?.toFixed(2)}</span>
      </div>
    </div>
  );
}

// ── Main Metrics component ────────────────────────────────────────────────────
export default function Metrics({ summary }) {
  if (!summary) return null;

  const s = summary;

  const genData = [
    { name:"Thermal",  value: s.avg_thermal_mw  || 0 },
    { name:"Solar",    value: s.avg_solar_mw    || 0 },
    { name:"Hydro",    value: s.avg_hydro_mw    || 0 },
    { name:"Wind",     value: s.avg_wind_mw     || 0 },
    { name:"Nuclear",  value: s.avg_nuclear_mw  || 0 },
    { name:"Gas",      value: s.avg_gas_mw      || 0 },
  ].filter(d => d.value > 0);

  return (
    <div style={{ marginTop:16 }}>
      <div style={{ fontSize:12, color:"#555", fontWeight:500, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:12 }}>
        Power engineering metrics — {s.reading_date}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))", gap:12 }}>

        {/* ── Card 1: Load metrics ── */}
        <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"14px 16px" }}>
          <div style={{ fontSize:12, color:"#666", marginBottom:10, fontWeight:500 }}>Load analysis</div>
          <StatRow label="Peak demand"      value={s.peak_demand_mw}      unit="MW"   highlight />
          <StatRow label="Average demand"   value={s.avg_demand_mw}       unit="MW"   />
          <StatRow label="Minimum demand"   value={s.min_demand_mw}       unit="MW"   />
          <StatRow label="Energy consumed"  value={s.energy_consumed_mu}  unit="MU"
            hint="Sum of 96 × 15-min demand × 0.25 hr ÷ 1000" />
        </div>

        {/* ── Card 2: Factors (gauges) ── */}
        <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"14px 16px" }}>
          <div style={{ fontSize:12, color:"#666", marginBottom:10, fontWeight:500 }}>System factors</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            <Gauge value={s.load_factor ?? 0}           max={1}   label="Load factor"        color="#6C63FF"
              sublabel="avg / peak"
              format={v => (v*100).toFixed(1)+"%"} />
            <Gauge value={s.utilisation_factor ?? 0}  max={1}   label="Utilisation factor" color="#F5A623"
              sublabel="peak demand / max gen"
              format={v => (v*100).toFixed(1)+"%"} />
            <Gauge value={s.diversity_factor ?? 0}    max={2}   label="Diversity factor"   color="#2ECC71"
              sublabel="peak gen / avg gen"
              format={v => v.toFixed(3)} />
            <Gauge value={Math.abs(s.loss_factor ?? 0)} max={0.1} label="Loss factor"      color="#E8623A"
              sublabel="1 - (demand/gen)"
              format={v => (v*100).toFixed(2)+"%"} />
          </div>
        </div>

        {/* ── Card 3: Generation mix ── */}
        <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"14px 16px" }}>
          <div style={{ fontSize:12, color:"#666", marginBottom:10, fontWeight:500 }}>
            Generation mix
            <span style={{ marginLeft:8, fontSize:11, color:"#2ECC71" }}>
              {s.renewable_pct}% renewable
            </span>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie data={genData} cx="50%" cy="50%" innerRadius={32} outerRadius={52} dataKey="value" strokeWidth={0}>
                  {genData.map(d => <Cell key={d.name} fill={GEN_COLORS[d.name] || "#888"} />)}
                </Pie>
                <Tooltip
                  formatter={(v, name) => [`${v.toLocaleString()} MW`, name]}
                  contentStyle={{ background:"#111", border:"1px solid #333", borderRadius:6, fontSize:11 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex:1 }}>
              {genData.map(d => (
                <div key={d.name} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <span style={{ width:8, height:8, borderRadius:"50%", background: GEN_COLORS[d.name], display:"inline-block" }}/>
                    <span style={{ fontSize:11, color:"#aaa" }}>{d.name}</span>
                  </div>
                  <span style={{ fontSize:11, color:"#fff", fontWeight:500 }}>{d.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Card 4: Frequency ── */}
        <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"14px 16px" }}>
          <div style={{ fontSize:12, color:"#666", marginBottom:10, fontWeight:500 }}>Grid frequency health</div>
          <FreqBar min={s.min_frequency_hz ?? 50} avg={s.avg_frequency_hz ?? 50} max={s.max_frequency_hz ?? 50} />
          <div style={{ marginTop:12 }}>
            <StatRow label="Deviation from 50 Hz"
              value={(Math.abs((s.avg_frequency_hz ?? 50) - 50) * 1000).toFixed(1)}
              unit="mHz"
              highlight={Math.abs((s.avg_frequency_hz ?? 50) - 50) > 0.1}
              hint="< 100 mHz = healthy grid" />
          </div>
        </div>

      </div>
    </div>
  );
}
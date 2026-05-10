// LuzAlerts — Screens 1–4: Onboarding, Map, List, Detail

/* ── FAKE MAP SVG (Google Maps dark style) ── */
const MAP_TOKENS = {
  bg:        '#1b2336',
  block:     '#1f2942',
  blockAlt:  '#1c2640',
  park:      '#22432d',
  parkLabel: '#5e8a6f',
  water:     '#102842',
  // Road tiers
  tertStroke: '#2a3550',
  secCasing:  '#2f3c5a',
  secFill:    '#3e4d6e',
  priCasing:  '#3b4b6c',
  priFill:    '#5a6b94',
  hwyCasing:  '#5a4a2a',
  hwyFill:    '#c8a559',
  // Labels
  labelMajor: '#aebbd2',
  labelMinor: '#7a8aa8',
};

const DarkMap = ({ h = 340, markerSelected = null }) => {
  const W = 393;
  const T = MAP_TOKENS;
  const hRoads = [
    { y: 36,  name: 'Av. Aviadores del Chaco', tier: 'pri', off: 16  },
    { y: 76,  name: 'Mcal. Estigarribia',       tier: 'sec', off: 22  },
    { y: 132, name: 'Av. Mcal. López',          tier: 'hwy', off: 18  },
    { y: 174, name: 'Brasilia',                 tier: 'sec', off: 60  },
    { y: 214, name: 'Av. España',               tier: 'pri', off: 28  },
    { y: 254, name: 'Cnel. Bogado',             tier: 'sec', off: 50  },
    { y: 296, name: 'Av. Eusebio Ayala',        tier: 'pri', off: 18  },
  ].filter(r => r.y > -10 && r.y < h + 10);
  const vRoads = [
    { x: 58,  name: 'Sajonia',          tier: 'sec', off: 22  },
    { x: 128, name: 'Cruz del Chaco',   tier: 'pri', off: 26  },
    { x: 208, name: 'Madame Lynch',     tier: 'pri', off: 24  },
    { x: 276, name: 'San Martín',       tier: 'sec', off: 28  },
    { x: 344, name: 'Las Heras',        tier: 'sec', off: 22  },
  ];

  // road widths per tier (casing, fill)
  const W_ROAD = { tert: [0, 1.5], sec: [4.5, 3], pri: [9, 7], hwy: [11, 8.5] };
  const COLOR = {
    tert: { c: T.tertStroke, f: T.tertStroke },
    sec:  { c: T.secCasing,  f: T.secFill    },
    pri:  { c: T.priCasing,  f: T.priFill    },
    hwy:  { c: T.hwyCasing,  f: T.hwyFill    },
  };

  const hRoadLine = (r, useFill) => (
    <line x1={-12} y1={r.y} x2={W + 12} y2={r.y - 6}
      stroke={useFill ? COLOR[r.tier].f : COLOR[r.tier].c}
      strokeWidth={useFill ? W_ROAD[r.tier][1] : W_ROAD[r.tier][0]}
      strokeLinecap="round"/>
  );
  const vRoadLine = (r, useFill) => (
    <line x1={r.x} y1={-12} x2={r.x + 8} y2={h + 12}
      stroke={useFill ? COLOR[r.tier].f : COLOR[r.tier].c}
      strokeWidth={useFill ? W_ROAD[r.tier][1] : W_ROAD[r.tier][0]}
      strokeLinecap="round"/>
  );

  const tertY = [56, 96, 154, 194, 234, 274].filter(y => y > 0 && y < h);
  const tertX = [28, 92, 166, 244, 308, 376];

  return (
    <svg width={W} height={h} viewBox={`0 0 ${W} ${h}`} style={{ display: 'block', flexShrink: 0 }}>
      {/* Base */}
      <rect width={W} height={h} fill={T.bg}/>

      {/* Block tinting — subtle alternating fills between major roads */}
      <g opacity="0.55">
        <rect x="0"   y="36"  width="128" height="96"  fill={T.block}/>
        <rect x="208" y="36"  width="136" height="96"  fill={T.blockAlt}/>
        <rect x="128" y="132" width="80"  height="82"  fill={T.blockAlt}/>
        <rect x="276" y="132" width="117" height="82"  fill={T.block}/>
        <rect x="0"   y="214" width="128" height="82"  fill={T.blockAlt}/>
        <rect x="208" y="214" width="136" height="82"  fill={T.block}/>
      </g>

      {/* Park (Parque de la Salud area) */}
      <path d="M 296 156 Q 360 152 376 188 Q 366 216 322 214 Q 290 200 296 156 Z" fill={T.park}/>
      <text x="335" y="190" textAnchor="middle" fontSize="9" fill={T.parkLabel}
            fontFamily="Roboto,sans-serif" fontStyle="italic">Parque{'\u00A0'}Caballero</text>

      {/* Tertiary grid (alleys / minor streets) */}
      {tertY.map((y, i) => <line key={'ty'+i} x1="0" y1={y} x2={W} y2={y - 4} stroke={T.tertStroke} strokeWidth="1.5"/>)}
      {tertX.map((x, i) => <line key={'tx'+i} x1={x} y1="0" x2={x + 5} y2={h} stroke={T.tertStroke} strokeWidth="1.4"/>)}

      {/* Road casings (darker outline below fills) */}
      {hRoads.map((r, i) => <g key={'hc'+i}>{hRoadLine(r, false)}</g>)}
      {vRoads.map((r, i) => <g key={'vc'+i}>{vRoadLine(r, false)}</g>)}
      {/* Road fills (lighter center) */}
      {hRoads.map((r, i) => <g key={'hf'+i}>{hRoadLine(r, true)}</g>)}
      {vRoads.map((r, i) => <g key={'vf'+i}>{vRoadLine(r, true)}</g>)}

      {/* Road labels */}
      {hRoads.map((r, i) => {
        const isMajor = r.tier === 'pri' || r.tier === 'hwy';
        return (
          <text key={'hl'+i} x={r.off} y={r.y + 3.5}
                transform={`rotate(-0.9 ${r.off} ${r.y + 3.5})`}
                fontSize={isMajor ? 9.5 : 8.5}
                fill={isMajor ? T.labelMajor : T.labelMinor}
                fontFamily="Roboto,sans-serif"
                fontWeight={isMajor ? 500 : 400}
                letterSpacing="0.2">
            {r.name}
          </text>
        );
      })}
      {vRoads.map((r, i) => {
        const isMajor = r.tier === 'pri';
        const cx = r.x + 3, cy = r.off + 60;
        return (
          <text key={'vl'+i} x={cx} y={cy}
                transform={`rotate(-89 ${cx} ${cy})`}
                fontSize={isMajor ? 9.5 : 8.5}
                fill={isMajor ? T.labelMajor : T.labelMinor}
                fontFamily="Roboto,sans-serif"
                fontWeight={isMajor ? 500 : 400}
                letterSpacing="0.2">
            {r.name}
          </text>
        );
      })}

      {/* User location — blue dot */}
      <circle cx="195" cy="195" r="16" fill="rgba(10,132,255,0.18)"/>
      <circle cx="195" cy="195" r="8"  fill="rgba(10,132,255,0.35)"/>
      <circle cx="195" cy="195" r="5"  fill="#0A84FF"/>
      <circle cx="195" cy="195" r="5"  fill="none" stroke="#fff" strokeWidth="1.5"/>

      {/* Markers — programado (amber) */}
      <MapPin cx={92}  cy={92}  color="#FBBF24" pulse={false}/>
      <MapPin cx={314} cy={56}  color="#FBBF24" pulse={false}/>
      <MapPin cx={264} cy={252} color="#FBBF24" pulse={false}/>
      {/* Markers — activo (red) */}
      <MapPin cx={156} cy={150} color="#EF4444" pulse={true} selected={markerSelected==='activo'}/>
      <MapPin cx={48}  cy={278} color="#EF4444" pulse={false}/>
      {/* Markers — resuelto (green) */}
      <MapPin cx={350} cy={132} color="#22C55E" pulse={false}/>
      {/* Marker — crowdsource (violet) */}
      <MapPin cx={224} cy={94}  color="#A855F7" pulse={false} crowd={true}/>
    </svg>
  );
};

const MapPin = ({ cx, cy, color, pulse = false, selected = false, crowd = false }) => {
  // cy = tip of pin. body sits above.
  const W = 20, H = 26, R = 5;
  const top = cy - H - 14; // top of rectangle
  return (
    <g>
      {pulse && (
        <circle cx={cx} cy={top + H/2} r={selected ? 22 : 16} fill={color} opacity="0.18">
          <animate attributeName="r" values={selected ? "18;26;18" : "12;18;12"} dur="2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.18;0.05;0.18" dur="2s" repeatCount="indefinite"/>
        </circle>
      )}
      {/* Badge body */}
      <rect x={cx - W/2} y={top} width={W} height={H} rx={R} fill={color}/>
      {/* Triangle tail */}
      <polygon points={`${cx-6},${top+H} ${cx+6},${top+H} ${cx},${cy}`} fill={color}/>
      {/* ! bar */}
      <rect x={cx-2.5} y={top+4} width={5} height={12} rx={2.5} fill="rgba(0,0,0,0.45)"/>
      {/* ! dot */}
      <rect x={cx-2.5} y={top+19} width={5} height={5} rx={2.5} fill="rgba(0,0,0,0.45)"/>
      {crowd && (
        <text x={cx} y={top - 2} textAnchor="middle" fontSize="8" fill={color}>👥</text>
      )}
    </g>
  );
};

const MiniMap = ({ color = '#EF4444' }) => {
  const T = MAP_TOKENS;
  const W = 361, H = 160;
  return (
    <div style={{ margin: '0 16px', borderRadius: 12, overflow: 'hidden', height: H, flexShrink: 0, position: 'relative', background: T.bg }}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        <rect width={W} height={H} fill={T.bg}/>
        {/* Block tints around the focus point */}
        <g opacity="0.55">
          <rect x="0"   y="0"   width="180" height="78"  fill={T.block}/>
          <rect x="180" y="0"   width="181" height="78"  fill={T.blockAlt}/>
          <rect x="0"   y="78"  width="180" height="82"  fill={T.blockAlt}/>
          <rect x="180" y="78"  width="181" height="82"  fill={T.block}/>
        </g>
        {/* Tertiary streets */}
        {[30, 120].map((y, i) => <line key={'ty'+i} x1="0" y1={y} x2={W} y2={y - 3} stroke={T.tertStroke} strokeWidth="1.4"/>)}
        {[80, 280].map((x, i) => <line key={'tx'+i} x1={x} y1="0" x2={x + 4} y2={H} stroke={T.tertStroke} strokeWidth="1.3"/>)}
        {/* Primary horizontal — Av. Mcal. López */}
        <line x1="-10" y1="78" x2={W + 10} y2="74" stroke={T.priCasing} strokeWidth="11"/>
        <line x1="-10" y1="78" x2={W + 10} y2="74" stroke={T.priFill}   strokeWidth="8"/>
        {/* Primary vertical — Cruz del Chaco */}
        <line x1="180" y1="-10" x2="186" y2={H + 10} stroke={T.priCasing} strokeWidth="10"/>
        <line x1="180" y1="-10" x2="186" y2={H + 10} stroke={T.priFill}   strokeWidth="7"/>
        {/* Labels */}
        <text x="14" y="73" fontSize="10" fill={T.labelMajor} fontFamily="Roboto,sans-serif" fontWeight="500" letterSpacing="0.2">Av. Mcal. López</text>
        <text x="190" y="40" transform="rotate(-89 190 40)" fontSize="10" fill={T.labelMajor} fontFamily="Roboto,sans-serif" fontWeight="500" letterSpacing="0.2">Cruz del Chaco</text>
        <text x="20" y="148" fontSize="8.5" fill={T.labelMinor} fontFamily="Roboto,sans-serif">Av. España</text>
        {/* Halo + pin at intersection */}
        <circle cx="181" cy="80" r="22" fill={`${color}22`}/>
        <circle cx="181" cy="80" r="11" fill={`${color}44`}/>
        <g transform="translate(181,80)">
          <rect x="-8" y="-22" width="16" height="22" rx="4" fill={color}/>
          <polygon points="-4,0 4,0 0,8" fill={color}/>
          <rect x="-1.8" y="-18" width="3.6" height="9" rx="1.8" fill="rgba(0,0,0,0.45)"/>
          <rect x="-1.8" y="-7"  width="3.6" height="3.6" rx="1.8" fill="rgba(0,0,0,0.45)"/>
        </g>
      </svg>
      <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(15,23,42,0.85)', borderRadius: 12, padding: '4px 10px', fontSize: 11, color: C.text, border: `1px solid ${C.border}` }}>
        Abrir en Mapa
      </div>
    </div>
  );
};

/* ── SCREEN 1: Onboarding ── */
const ONBOARDING_TOTAL = 4;
const OnboardingDots = ({ active }) => (
  <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
    {Array.from({ length: ONBOARDING_TOTAL }).map((_, i) => (
      <div key={i} style={{ width: i === active ? 20 : 8, height: 8, borderRadius: 4, background: i === active ? C.amber : C.surfaceVar, transition: 'width 0.3s' }}/>
    ))}
  </div>
);

const OnboardingSlide = ({ slide }) => {
  const slides = [
    { icon: IZap, color: '#F59E0B', title: 'Cortes de luz\nen tiempo real', body: 'Datos oficiales de la ANDE actualizados cada hora, más reportes de usuarios de toda Paraguay.', cta: 'Siguiente', dot: 0 },
    { icon: IPin, color: '#EF4444', title: 'Tu zona,\nsiempre actualizada', body: 'El mapa muestra cortes planificados y activos cerca de vos. Si hay un corte, podés reportarlo en un toque.', cta: 'Siguiente', dot: 1 },
    { icon: IBell, color: '#0A84FF', title: 'Avisamos cuando\nhay un corte', body: 'Activá las notificaciones y la ubicación para recibir alertas cuando haya un corte a menos de 5 km.', cta: 'Activar y empezar', dot: 3 },
  ];
  const s = slides[slide];
  const Icon = s.icon;
  return (
    <LuzDevice bgColor={C.bg} time="9:15">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 28px 24px', background: C.bg }}>
        <OnboardingDots active={s.dot}/>
        <div style={{ flex: 1 }} />
        {/* Icon circle */}
        <div style={{ width: 96, height: 96, borderRadius: 48, background: `${s.color}1F`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 36 }}>
          <Icon size={48} color={s.color} />
        </div>
        {/* Title */}
        <div style={{ fontSize: 32, fontWeight: 700, color: C.text, lineHeight: '40px', textAlign: 'center', whiteSpace: 'pre-line', marginBottom: 16 }}>{s.title}</div>
        {/* Body */}
        <div style={{ fontSize: 16, color: '#CBD5E1', lineHeight: '24px', textAlign: 'center', maxWidth: 310 }}>{s.body}</div>
        <div style={{ flex: 1 }} />
        {/* CTA */}
        <div style={{ width: '100%', height: 56, background: C.amber, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>{s.cta}</span>
        </div>
        <span style={{ fontSize: 14, color: C.textMuted }}>Saltar</span>
      </div>
    </LuzDevice>
  );
};

/* ── SCREEN 1b: Onboarding — leyenda de colores ── */
const LegendPin = ({ color, pulse = false, crowd = false }) => (
  <svg width="44" height="56" viewBox="0 0 44 56" style={{ display: 'block', flexShrink: 0 }}>
    {pulse && (
      <>
        <circle cx="22" cy="22" r="21" fill={color} opacity="0.10"/>
        <circle cx="22" cy="22" r="15" fill={color} opacity="0.18"/>
      </>
    )}
    {/* Pin body */}
    <rect x="10" y="6" width="24" height="32" rx="6" fill={color}/>
    <polygon points="14,38 30,38 22,50" fill={color}/>
    {/* ! glyph */}
    <rect x="19.5" y="11" width="5" height="14" rx="2.5" fill="rgba(0,0,0,0.45)"/>
    <rect x="19.5" y="27" width="5" height="5" rx="2.5" fill="rgba(0,0,0,0.45)"/>
    {crowd && (
      <g>
        <circle cx="34" cy="9" r="8" fill={color}/>
        <circle cx="34" cy="9" r="6.5" fill="#0F172A"/>
        <text x="34" y="12" textAnchor="middle" fontSize="9" fill={color} fontFamily="Roboto,sans-serif" fontWeight="700">3</text>
      </g>
    )}
  </svg>
);

const LegendRow = ({ color, pulse, crowd, label, term, body }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 14,
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 14, padding: '14px 16px',
  }}>
    <LegendPin color={color} pulse={pulse} crowd={crowd}/>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: '-0.2px' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 500, color, letterSpacing: '0.4px', textTransform: 'uppercase' }}>{term}</span>
      </div>
      <div style={{ fontSize: 13, color: C.textMid, lineHeight: '18px' }}>{body}</div>
    </div>
  </div>
);

const OnboardingLegend = () => (
  <LuzDevice bgColor={C.bg} time="9:15">
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px 24px 24px', background: C.bg }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <OnboardingDots active={2}/>
      </div>

      {/* Heading */}
      <div style={{ marginTop: 36, marginBottom: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: C.text, lineHeight: '34px', letterSpacing: '-0.6px', marginBottom: 10 }}>
          Conocé los marcadores
        </div>
        <div style={{ fontSize: 14, color: C.textMid, lineHeight: '20px', maxWidth: 300, marginInline: 'auto' }}>
          Cada color en el mapa indica el estado del corte.
        </div>
      </div>

      {/* Legend list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <LegendRow color={C.red}    pulse        label="Activo"     term="Activo"     body="Sin luz en este momento. Tocá el pin para ver detalles."/>
        <LegendRow color={C.amber}               label="Programado" term="Programado" body="Corte planificado por la ANDE — con horario anunciado."/>
        <LegendRow color={C.green}               label="Resuelto"   term="Resuelto"   body="La luz ya volvió. Se mantiene visible por 2 horas."/>
        <LegendRow color={C.violet}  crowd       label="Vecinal"    term="Vecinal"    body="Reportado por usuarios cerca tuyo. Se confirma con 3 reportes."/>
      </div>

      <div style={{ flex: 1 }} />

      {/* CTA */}
      <div style={{ width: '100%', height: 56, background: C.amber, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Siguiente</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <span style={{ fontSize: 14, color: C.textMuted }}>Saltar</span>
      </div>
    </div>
  </LuzDevice>
);

/* ── SCREEN 2: Mapa ── */
const ScreenMap = ({ showSheet = false }) => (
  <LuzDevice bgColor={C.bg}>
    {/* Top app bar */}
    <div style={{ height: 60, background: C.bg, display: 'flex', alignItems: 'center', padding: '0 8px', gap: 4, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, padding: '0 8px' }}>
        <IZap size={22} color={C.amber}/>
        <span style={{ fontSize: 20, fontWeight: 700, color: C.text }}>LuzAlerts</span>
      </div>
      <Btn48><IGear size={22} color={C.textMuted}/></Btn48>
    </div>
    {/* Map area */}
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      <DarkMap h={showSheet ? 420 : 520} markerSelected={showSheet ? 'activo' : null}/>
      {/* FABs */}
      <div style={{ position: 'absolute', bottom: showSheet ? 286 : 24, right: 16, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ width: 48, height: 48, borderRadius: 24, background: C.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
          <INav size={20} color={C.text}/>
        </div>
        <div style={{ height: 56, paddingInline: 20, borderRadius: 28, background: C.amber, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 20px rgba(251,191,36,0.35)' }}>
          <IWarn size={20} color="#0F172A"/>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Sin luz</span>
        </div>
      </div>
      {/* Bottom sheet */}
      {showSheet && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: C.surface, borderRadius: '16px 16px 0 0', padding: '0 0 8px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 8px' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#475569' }}/>
          </div>
          <div style={{ padding: '0 16px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <StatusChip status="activo"/>
              <span style={{ fontSize: 12, color: C.textMuted }}>Hace 23 min</span>
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 4 }}>Av. Eusebio Ayala y Cruz del Chaco</div>
            <div style={{ fontSize: 14, color: C.textMid, marginBottom: 8 }}>Mburucuyá, Asunción</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
              <IClock size={14} color={C.textMuted}/><span style={{ fontSize: 13, color: C.textMuted }}>Estimado: 18:00 – 22:00</span>
            </div>
            <div style={{ height: 44, border: `1px solid #475569`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: C.text }}>Ver detalles</span>
            </div>
          </div>
        </div>
      )}
    </div>
    <BottomNav active="map"/>
  </LuzDevice>
);

/* ── SCREEN 3: Lista ── */
const OutageCard = ({ status, title, subtitle, time, reports, comments, noTime }) => (
  <div style={{ background: C.surface, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <StatusChip status={status}/>
      <span style={{ fontSize: 12, color: C.textMuted }}>{time}</span>
    </div>
    <div style={{ fontSize: 15, fontWeight: 700, color: C.text, lineHeight: '21px' }}>{title}</div>
    <div style={{ fontSize: 13, color: C.textMid }}>{subtitle}</div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
      {!noTime && <><IClock size={13} color={C.textMuted}/><span style={{ fontSize: 12, color: C.textMuted }}>18:00 – 22:00</span></>}
      <div style={{ flex: 1 }}/>
      {reports && <span style={{ fontSize: 11, color: C.violetL, background: 'rgba(168,85,247,0.15)', padding: '2px 7px', borderRadius: 8, fontWeight: 600 }}>
        <IUsers size={11} color={C.violetL} style={{ verticalAlign: 'middle' }}/> {reports} reportes
      </span>}
      {comments && <span style={{ fontSize: 12, color: C.textMuted }}>💬 {comments}</span>}
    </div>
  </div>
);

const ScreenList = () => (
  <LuzDevice bgColor={C.bg}>
    <TopBar title="Cortes" large right={<Btn48><IGear size={22} color={C.textMuted}/></Btn48>}/>
    {/* Filter chips */}
    <div style={{ display: 'flex', gap: 8, padding: '4px 16px 12px', overflowX: 'auto', flexShrink: 0 }}>
      {[
        { label: 'Todos', active: true },
        { label: 'Programados' },
        { label: 'Activos' },
        { label: 'Resueltos' },
        { label: '📍 Cerca tuyo' },
      ].map(c => (
        <div key={c.label} style={{ flexShrink: 0, height: 34, paddingInline: 14, borderRadius: 17, background: c.active ? C.amber : 'transparent', border: c.active ? 'none' : `1px solid #475569`, display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: c.active ? 700 : 400, color: c.active ? '#0F172A' : C.textMid, whiteSpace: 'nowrap' }}>{c.label}</span>
        </div>
      ))}
    </div>
    {/* Cards */}
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <OutageCard status="programado" title="Gral. Santos c/ Mcal. Estigarribia" subtitle="Villa Morra, Asunción" time="Mañana 09:00"/>
      <OutageCard status="activo" title="Av. Eusebio Ayala y Cruz del Chaco" subtitle="Mburucuyá, Asunción" time="Hace 1h" reports={3} comments={5}/>
      <OutageCard status="reporte" title="Calle Pitiantuta c/ San Martín" subtitle="Sajonia, Asunción" time="Hace 34 min" reports={4} noTime/>
      <OutageCard status="resuelto" title="Av. Aviadores del Chaco 3500" subtitle="Ycuá Satí, Asunción" time="Hace 2h" comments={12}/>
      <OutageCard status="programado" title="Dr. Morra c/ Brasil" subtitle="Las Mercedes, Asunción" time="Mañana 14:00"/>
    </div>
    <BottomNav active="list"/>
  </LuzDevice>
);

/* ── SCREEN 4: Detalle ── */
const InfoCard = ({ icon: Icon, iconColor, title, children }) => (
  <div style={{ background: C.surface, borderRadius: 12, padding: 16 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <Icon size={18} color={iconColor}/><span style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>{title}</span>
    </div>
    {children}
  </div>
);

const InfoRow = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBlock: 4 }}>
    <span style={{ fontSize: 14, color: C.textMuted }}>{label}</span>
    <span style={{ fontSize: 14, color: C.text, fontWeight: 500 }}>{value}</span>
  </div>
);

const CommentCard = ({ avatar, bg, name, time, text }) => (
  <div style={{ background: C.surface, borderRadius: 12, padding: 12 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <div style={{ width: 32, height: 32, borderRadius: 16, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{avatar}</div>
      <span style={{ fontSize: 13, fontWeight: 500, color: C.textMid, flex: 1 }}>{name}</span>
      <span style={{ fontSize: 12, color: C.textMuted }}>{time}</span>
    </div>
    <div style={{ fontSize: 13, color: C.text, lineHeight: '19px' }}>{text}</div>
  </div>
);

const ScreenDetail = ({ crowdsource = false }) => (
  <LuzDevice bgColor={C.bg}>
    <TopBar
      title="Detalle del corte"
      left={<Btn48><IBack size={22} color={C.text}/></Btn48>}
      right={<Btn48><IShare size={20} color={C.textMuted}/></Btn48>}
    />
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header */}
      <div style={{ padding: '8px 16px 16px', background: C.bg }}>
        <div style={{ marginBottom: 8 }}><StatusChip status={crowdsource ? 'reporte' : 'activo'}/></div>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.text, lineHeight: '30px', marginBottom: 4 }}>Av. Eusebio Ayala c/ Cruz del Chaco</div>
        <div style={{ fontSize: 15, color: C.textMid, marginBottom: 10 }}>Mburucuyá, Asunción, Capital</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: crowdsource ? 'rgba(168,85,247,0.12)' : 'rgba(100,116,139,0.15)', padding: '4px 10px', borderRadius: 8 }}>
          {crowdsource ? <IUsers size={13} color={C.violetL}/> : <IBldg size={13} color={C.textMuted}/>}
          <span style={{ fontSize: 12, color: crowdsource ? C.violetL : C.textMuted }}>{crowdsource ? 'Reportado por vecinos' : 'Fuente: ANDE'}</span>
        </div>
      </div>
      {/* Mini map */}
      <MiniMap color={crowdsource ? C.violet : C.red}/>
      {/* Info cards */}
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!crowdsource && (
          <InfoCard icon={IClock} iconColor={C.amber} title="Horario">
            <InfoRow label="Inicio" value="Hoy 18:00"/>
            <InfoRow label="Fin estimado" value="Hoy 22:00"/>
            <InfoRow label="Duración" value="4 horas"/>
          </InfoCard>
        )}
        <InfoCard icon={IPin} iconColor={C.amber} title="Zona afectada">
          <div style={{ fontSize: 14, color: C.text, fontWeight: 500, marginBottom: 4 }}>Mburucuyá, Asunción</div>
          <div style={{ fontSize: 13, color: C.textMid }}>Mburucuyá, Madame Lynch, San Cristóbal</div>
        </InfoCard>
        <InfoCard icon={IUsers} iconColor={C.violet} title="Reportes vecinales">
          <div style={{ fontSize: 14, color: C.textMid }}>4 vecinos confirmaron este corte en los últimos 30 minutos.</div>
        </InfoCard>
        {/* Comments */}
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 12 }}>Comentarios (4)</div>
          {/* Input */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <div style={{ flex: 1, height: 48, border: `1px solid ${C.border}`, borderRadius: 10, padding: '0 14px', display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: C.textMuted }}>Compartí lo que está pasando…</span>
            </div>
            <div style={{ width: 44, height: 44, borderRadius: 22, background: C.amber, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ISend size={18} color="#0F172A"/>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <CommentCard avatar="J" bg="#A855F7" name="Vecino #4F2A" time="Hace 12 min" text="Confirmo, no hay luz en toda la cuadra de Mariscal López y Brasilia."/>
            <CommentCard avatar="M" bg="#22C55E" name="Vecino #8B1C" time="Hace 8 min" text="En mi casa volvió hace 5 minutos pero parece que la cuadra de al lado sigue sin luz."/>
            <CommentCard avatar="R" bg="#0A84FF" name="Vecino #2D9E" time="Hace 4 min" text="¿Alguien sabe si la ANDE dijo a qué hora vuelve?"/>
            <CommentCard avatar="S" bg="#EF4444" name="Vecino #7A3F" time="Hace 1 min" text="Estoy escuchando un transformador haciendo ruido raro en la esquina, ¿alguien más?"/>
          </div>
        </div>
      </div>
    </div>
  </LuzDevice>
);

Object.assign(window, { OnboardingSlide, OnboardingLegend, ScreenMap, ScreenList, ScreenDetail, DarkMap, MiniMap });

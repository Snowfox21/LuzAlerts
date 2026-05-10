// LuzAlerts — Shared device shell & base components

const C = {
  bg: '#0F172A', surface: '#1E293B', surfaceVar: '#334155',
  amber: '#FBBF24', amberDim: '#F59E0B',
  text: '#F8FAFC', textMid: '#CBD5E1', textMuted: '#94A3B8',
  border: '#334155',
  red: '#EF4444', redL: '#F87171',
  green: '#22C55E', greenL: '#4ADE80',
  violet: '#A855F7', violetL: '#C084FC',
  blue: '#0A84FF',
};

/* ── Device Shell ── */
const LuzStatusBar = ({ time = '21:43' }) => (
  <div style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', background: 'transparent', flexShrink: 0, position: 'relative', zIndex: 10 }}>
    <span style={{ fontSize: 13, fontWeight: 600, color: C.text, letterSpacing: 0.3 }}>{time}</span>
    <div style={{ position: 'absolute', left: '50%', top: 7, transform: 'translateX(-50%)', width: 20, height: 20, borderRadius: 10, background: '#0a0a14' }} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <svg width="17" height="12" viewBox="0 0 17 12" fill={C.text}>
        <rect x="0" y="8" width="3" height="4" rx="0.5"/><rect x="4.5" y="5" width="3" height="7" rx="0.5"/>
        <rect x="9" y="2" width="3" height="10" rx="0.5"/><rect x="13.5" y="0" width="3" height="12" rx="0.5" opacity="0.35"/>
      </svg>
      <svg width="16" height="11" viewBox="0 0 24 18" fill="none" stroke={C.text} strokeWidth="2.2" strokeLinecap="round">
        <path d="M1.5 7C6 2.5 18 2.5 22.5 7"/><path d="M5 11c3.5-3.5 11-3.5 14 0"/><path d="M9 15c1.5-1.5 5.5-1.5 6 0"/>
        <circle cx="12" cy="18" r="1.5" fill={C.text} stroke="none"/>
      </svg>
      <svg width="23" height="12" viewBox="0 0 26 13" fill="none">
        <rect x="0.75" y="0.75" width="21.5" height="11.5" rx="2" stroke={C.text} strokeWidth="1.5"/>
        <rect x="2" y="2" width="16" height="9" rx="1" fill={C.text}/>
        <path d="M23.5 4.5v4a2.2 2.2 0 0 0 0-4z" fill={C.text}/>
      </svg>
    </div>
  </div>
);

const LuzPill = () => (
  <div style={{ height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, flexShrink: 0 }}>
    <div style={{ width: 108, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.28)' }} />
  </div>
);

const LuzDevice = ({ children, bgColor = C.bg, statusBg = 'transparent', time }) => (
  <div style={{
    width: 393, height: 852, borderRadius: 48, overflow: 'hidden',
    background: bgColor, border: '9px solid #0d0d1a',
    outline: '2px solid #1e1e30',
    boxShadow: '0 0 0 1px #2a2a40, 0 50px 100px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)',
    display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
    fontFamily: 'Roboto, Inter, sans-serif', position: 'relative',
  }}>
    <div style={{ background: statusBg, position: 'relative', flexShrink: 0 }}>
      <LuzStatusBar time={time} />
    </div>
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {children}
    </div>
    <LuzPill />
  </div>
);

/* ── Shared atoms ── */
const StatusChip = ({ status }) => {
  const map = {
    activo:   { bg: 'rgba(239,68,68,0.15)',  text: C.redL,    label: 'ACTIVO' },
    programado:{ bg:'rgba(251,191,36,0.15)', text: C.amber,   label: 'PROGRAMADO' },
    resuelto: { bg: 'rgba(34,197,94,0.15)',  text: C.greenL,  label: 'RESUELTO' },
    reporte:  { bg: 'rgba(168,85,247,0.15)', text: C.violetL, label: 'REPORTADO' },
  };
  const s = map[status] || map.activo;
  return (
    <span style={{ background: s.bg, color: s.text, fontSize: 11, fontWeight: 700, letterSpacing: 0.8, padding: '3px 8px', borderRadius: 6, display: 'inline-block' }}>
      {s.label}
    </span>
  );
};

const BottomNav = ({ active = 'map' }) => {
  const tabs = [
    { id: 'map',     label: 'Mapa',     Icon: IMap },
    { id: 'list',    label: 'Lista',    Icon: IList },
    { id: 'reports', label: 'Reportes', Icon: IUsers, badge: 3 },
    { id: 'settings',label: 'Ajustes',  Icon: IGear },
  ];
  return (
    <div style={{ height: 76, background: C.surface, display: 'flex', alignItems: 'center', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
      {tabs.map(t => {
        const isActive = t.id === active;
        return (
          <div key={t.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, position: 'relative', paddingTop: 12 }}>
            {isActive && <div style={{ position: 'absolute', top: 4, width: 64, height: 32, borderRadius: 16, background: 'rgba(251,191,36,0.12)' }} />}
            <div style={{ position: 'relative' }}>
              <t.Icon size={22} color={isActive ? C.amber : C.textMuted} />
              {t.badge && !isActive && (
                <div style={{ position: 'absolute', top: -4, right: -6, width: 16, height: 16, borderRadius: 8, background: C.red, fontSize: 9, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t.badge}</div>
              )}
            </div>
            <span style={{ fontSize: 11, color: isActive ? C.amber : C.textMuted, fontWeight: isActive ? 600 : 400 }}>{t.label}</span>
          </div>
        );
      })}
    </div>
  );
};

const TopBar = ({ title, large = false, left = null, right = null }) => (
  <div style={{ background: C.bg, flexShrink: 0 }}>
    <div style={{ height: 60, display: 'flex', alignItems: 'center', padding: '0 4px 0 8px' }}>
      {left || <div style={{ width: 48 }} />}
      {!large && <span style={{ flex: 1, fontSize: 19, fontWeight: 500, color: C.text, padding: '0 8px' }}>{title}</span>}
      {large && <div style={{ flex: 1 }} />}
      {right}
    </div>
    {large && <div style={{ padding: '0 16px 16px', fontSize: 28, fontWeight: 700, color: C.text }}>{title}</div>}
  </div>
);

const Btn48 = ({ children, style = {}, ...p }) => (
  <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', ...style }} {...p}>{children}</div>
);

Object.assign(window, { C, LuzDevice, LuzStatusBar, LuzPill, StatusChip, BottomNav, TopBar, Btn48 });

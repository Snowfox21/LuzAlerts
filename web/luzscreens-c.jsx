// LuzAlerts — Onboarding: Zonas (familia) + Compartir por WhatsApp; botón de compartir

const WA_GREEN = '#25D366';
const IChat = p => <Ico {...p}><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></Ico>;
const IPlus = p => <Ico {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></Ico>;
const IHome = p => <Ico {...p}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z"/></Ico>;

const WhatsAppButton = ({ height = 48, label = 'Compartir por WhatsApp', compact = false }) => (
  <div style={{ height, flex: compact ? 1 : 'none', width: compact ? 'auto' : '100%', borderRadius: compact ? 8 : 12, background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
    <IChat size={18} color={WA_GREEN}/>
    <span style={{ fontSize: 14, fontWeight: 600, color: '#4ADE80' }}>{label}</span>
  </div>
);

const OnbShell = ({ dot, children, cta, secondary = 'Saltar' }) => (
  <LuzDevice bgColor={C.bg} time="9:15">
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px 24px 24px', background: C.bg }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}><OnboardingDots active={dot}/></div>
      {children}
      <div style={{ flex: 1 }}/>
      <div style={{ width: '100%', height: 56, background: C.amber, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>{cta}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}><span style={{ fontSize: 14, color: C.textMuted }}>{secondary}</span></div>
    </div>
  </LuzDevice>
);

const OnbHeading = ({ title, body }) => (
  <div style={{ marginTop: 32, marginBottom: 24, textAlign: 'center' }}>
    <div style={{ fontSize: 28, fontWeight: 700, color: C.text, lineHeight: '34px', letterSpacing: '-0.6px', marginBottom: 10, whiteSpace: 'pre-line' }}>{title}</div>
    <div style={{ fontSize: 15, color: C.textMid, lineHeight: '22px', maxWidth: 310, marginInline: 'auto', textWrap: 'pretty' }}>{body}</div>
  </div>
);

/* ── Slide: Zonas de tu familia ── */
const ZoneRow = ({ icon: Icon, color, name, place, you }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
    <div style={{ width: 36, height: 36, borderRadius: 18, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={18} color={color}/>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{name}</span>
        {you && <span style={{ fontSize: 10, fontWeight: 700, color: C.amber, background: 'rgba(251,191,36,0.15)', padding: '1px 6px', borderRadius: 5, letterSpacing: 0.4 }}>VOS</span>}
      </div>
      <div style={{ fontSize: 13, color: C.textMuted }}>{place}</div>
    </div>
    <IBell size={18} color={C.amber}/>
  </div>
);

const OnboardingZones = () => (
  <OnbShell dot={3} cta="Agregar una zona" secondary="Ahora no">
    <OnbHeading title={'Cuidá también\na los tuyos'} body="Seguí hasta 2 lugares más, como la casa de tus padres o tu oficina, aunque estén en otra ciudad."/>
    {/* Notificación de ejemplo */}
    <div style={{ background: C.surfaceVar, borderRadius: 14, padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}>
      <div style={{ width: 28, height: 28, borderRadius: 7, background: C.amber, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IZap size={16} color="#0F172A"/></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Casa de mamá · Encarnación</span>
          <span style={{ fontSize: 11, color: C.textMuted }}>ahora</span>
        </div>
        <div style={{ fontSize: 13, color: C.textMid, lineHeight: '18px' }}>Corte programado mañana de 08:00 a 12:00.</div>
      </div>
    </div>
    {/* Lista de zonas */}
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, display: 'flex', flexDirection: 'column' }}>
      <ZoneRow icon={IPin} color={C.amber} name="Mi zona" place="Villa Morra, Asunción" you/>
      <div style={{ height: 1, background: C.border, marginInline: 14 }}/>
      <ZoneRow icon={IHome} color={C.blue} name="Casa de mamá" place="Encarnación, Itapúa"/>
      <div style={{ height: 1, background: C.border, marginInline: 14 }}/>
      <ZoneRow icon={IBldg} color={C.violetL} name="Oficina" place="San Lorenzo, Central"/>
    </div>
  </OnbShell>
);

/* ── Slide: Compartir por WhatsApp ── */
const OnboardingShare = () => (
  <OnbShell dot={4} cta="Siguiente">
    <OnbHeading title={'Avisá a tu familia\npor WhatsApp'} body="Que nadie se quede a oscuras sin aviso. Mandá el corte con un toque: horario, zona y mapa incluidos."/>
    <div style={{ background: '#0B141A', borderRadius: 16, padding: '16px 14px', border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 16, background: '#7C4A6B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>A</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Abuela ❤️</span>
          <span style={{ fontSize: 11, color: '#8696A0' }}>en línea</span>
        </div>
      </div>
      <div style={{ alignSelf: 'flex-end', maxWidth: 280, background: '#005C4B', borderRadius: '10px 2px 10px 10px', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, color: '#E9EDEF', lineHeight: '18px' }}>Abu, mañana cortan la luz en tu barrio de 9 a 13 hs. Cargá el celu y sacá la carne del freezer 🙏</span>
        <div style={{ background: 'rgba(0,0,0,0.22)', borderRadius: 6, borderLeft: `3px solid ${C.amber}`, padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.amber }}>Corte programado · ANDE</span>
          <span style={{ fontSize: 12, color: '#D1D7DB' }}>Barrio Obrero, Asunción · 09:00 – 13:00</span>
          <span style={{ fontSize: 12, color: '#53BDEB' }}>luzalerts.com.py/c/8F2A</span>
        </div>
        <span style={{ fontSize: 10, color: 'rgba(233,237,239,0.6)', alignSelf: 'flex-end' }}>18:42 ✓✓</span>
      </div>
      <div style={{ alignSelf: 'flex-start', maxWidth: 230, background: '#202C33', borderRadius: '2px 10px 10px 10px', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 13, color: '#E9EDEF', lineHeight: '18px' }}>Gracias mi amor, ya pongo a cargar la radio 😘</span>
        <span style={{ fontSize: 10, color: 'rgba(233,237,239,0.6)', alignSelf: 'flex-end' }}>18:44</span>
      </div>
    </div>
    <div style={{ marginTop: 16 }}><WhatsAppButton/></div>
  </OnbShell>
);

/* ── Ajustes → Mis zonas ── */
const Toggle = ({ on }) => (
  <div style={{ width: 44, height: 26, borderRadius: 13, background: on ? C.amber : C.surfaceVar, position: 'relative', flexShrink: 0 }}>
    <div style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: 10, background: on ? '#0F172A' : C.textMuted }}/>
  </div>
);

const ZoneCard = ({ icon: Icon, color, name, place, radius, on = true, you, alert }) => (
  <div style={{ background: C.surface, borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: 20, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={20} color={color}/></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{name}</span>
          {you && <span style={{ fontSize: 10, fontWeight: 700, color: C.amber, background: 'rgba(251,191,36,0.15)', padding: '1px 6px', borderRadius: 5, letterSpacing: 0.4 }}>GPS</span>}
        </div>
        <div style={{ fontSize: 13, color: C.textMuted }}>{place} · radio {radius}</div>
      </div>
      <Toggle on={on}/>
    </div>
    {alert && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(251,191,36,0.10)', borderRadius: 8, padding: '6px 10px' }}>
        <SquareMarkerInline color={C.amber}/>
        <span style={{ fontSize: 12, color: C.amber, fontWeight: 500 }}>{alert}</span>
      </div>
    )}
  </div>
);

const SquareMarkerInline = ({ color }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" style={{ flexShrink: 0 }}><SquareMarker cx={8} cy={8} color={color} size={16}/></svg>
);

const ScreenZones = ({ adding = false }) => (
  <LuzDevice bgColor={C.bg}>
    <TopBar title="Mis zonas" left={<Btn48><IBack size={22} color={C.text}/></Btn48>}/>
    <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 14, color: C.textMid, lineHeight: '20px', marginBottom: 6 }}>Te avisamos de cortes en cada zona activa, estés donde estés.</div>
      <ZoneCard icon={IPin} color={C.amber} name="Mi zona" place="Villa Morra, Asunción" radius="5 km" you/>
      <ZoneCard icon={IHome} color={C.blue} name="Casa de mamá" place="Encarnación, Itapúa" radius="2 km" alert="Corte programado mañana 08:00 – 12:00"/>
      {!adding && <ZoneCard icon={IHome} color="#F472B6" name="Abuela" place="Barrio Obrero, Asunción" radius="1 km"/>}
      {adding ? (
        <div style={{ height: 52, borderRadius: 12, border: `1.5px dashed #475569`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}>
          <IPlus size={18} color={C.amber}/><span style={{ fontSize: 15, fontWeight: 600, color: C.amber }}>Agregar lugar</span>
        </div>
      ) : (
        <div style={{ height: 52, borderRadius: 12, border: `1.5px dashed ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4, opacity: 0.6 }}>
          <IPlus size={18} color={C.textMuted}/><span style={{ fontSize: 15, fontWeight: 600, color: C.textMuted }}>Agregar lugar</span>
        </div>
      )}
      <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', marginTop: 4, lineHeight: '17px', textWrap: 'pretty' }}>{adding ? 'Podés seguir hasta 2 lugares además de tu zona · 1 de 2' : 'Llegaste al máximo de 2 lugares. Borrá uno para agregar otro.'}</div>
    </div>
    {adding && (
      <>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 4 }}/>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 5, background: C.surface, borderRadius: '20px 20px 0 0', padding: '10px 20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}><div style={{ width: 36, height: 4, borderRadius: 2, background: '#475569' }}/></div>
          <span style={{ fontSize: 20, fontWeight: 700, color: C.text }}>Nuevo lugar</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, letterSpacing: 0.6, textTransform: 'uppercase' }}>Nombre</span>
            <div style={{ height: 48, borderRadius: 10, border: `1.5px solid ${C.amber}`, padding: '0 14px', display: 'flex', alignItems: 'center' }}><span style={{ fontSize: 15, color: C.text }}>Casa del tío Rubén</span><span style={{ width: 1.5, height: 20, background: C.amber, marginLeft: 2 }}/></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, letterSpacing: 0.6, textTransform: 'uppercase' }}>Dirección o barrio</span>
            <div style={{ height: 48, borderRadius: 10, border: `1px solid ${C.border}`, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 10 }}><IPin size={16} color={C.textMuted}/><span style={{ fontSize: 15, color: C.text }}>Fernando de la Mora, Central</span></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, letterSpacing: 0.6, textTransform: 'uppercase' }}>Radio de aviso</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {['1 km', '2 km', '5 km', '10 km'].map(r => {
                const a = r === '2 km';
                return <div key={r} style={{ flex: 1, height: 40, borderRadius: 20, background: a ? C.amber : 'transparent', border: a ? 'none' : '1px solid #475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 14, fontWeight: a ? 700 : 400, color: a ? '#0F172A' : C.textMid }}>{r}</span></div>;
              })}
            </div>
          </div>
          <div style={{ height: 56, borderRadius: 12, background: C.amber, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 4 }}><span style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Guardar lugar</span></div>
        </div>
      </>
    )}
  </LuzDevice>
);

Object.assign(window, { OnboardingZones, OnboardingShare, WhatsAppButton, IChat, ScreenZones });

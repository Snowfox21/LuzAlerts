// LuzAlerts — Screens 5–7: Reportes, Modal Reportar, Ajustes

/* ── SCREEN 5: Reportes vecinales ── */
const ReportCard = ({ name, bg, time, address, confirmed, total, expiring }) => {
  const pct = (confirmed / total) * 100;
  const chipColor = confirmed >= total ? C.greenL : expiring ? C.textMuted : C.amber;
  const chipBg = confirmed >= total ? 'rgba(74,222,128,0.15)' : expiring ? 'rgba(100,116,139,0.15)' : 'rgba(251,191,36,0.15)';
  return (
    <div style={{ background: C.surface, borderRadius: 12, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ width: 40, height: 40, borderRadius: 20, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{name[0]}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.textMid }}>{name}</div>
          <div style={{ fontSize: 12, color: C.textMuted }}>{time}</div>
        </div>
        {expiring && <span style={{ fontSize: 11, color: C.textMuted, background: 'rgba(100,116,139,0.2)', padding: '2px 8px', borderRadius: 8 }}>Expira en 12 min</span>}
      </div>
      <div style={{ fontSize: 14, color: C.text, marginBottom: 10 }}>{address}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: chipColor, background: chipBg, padding: '3px 8px', borderRadius: 8 }}>
          {confirmed >= total ? '✓ Confirmado' : `${confirmed} / ${total} confirmaciones`}
        </span>
      </div>
      <div style={{ height: 4, background: C.surfaceVar, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: confirmed >= total ? C.greenL : C.amber, borderRadius: 2, transition: 'width 0.4s' }}/>
      </div>
    </div>
  );
};

const ScreenReports = () => (
  <LuzDevice bgColor={C.bg}>
    <TopBar title="Reportes vecinales" large right={<Btn48><IGear size={22} color={C.textMuted}/></Btn48>}/>
    {/* Info banner */}
    <div style={{ margin: '0 16px 12px', padding: '10px 12px', borderRadius: 8, background: 'rgba(168,85,247,0.08)', borderLeft: `4px solid ${C.violet}`, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <IInfo size={15} color={C.violetL} style={{ flexShrink: 0, marginTop: 1 }}/>
      <span style={{ fontSize: 13, color: C.textMid, lineHeight: '19px' }}>Cuando 3 vecinos reportan el mismo corte en menos de 500m, se confirma para todos.</span>
    </div>
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <ReportCard name="Vecino #A1B2" bg="#A855F7" time="Hace 5 min" address="Av. Mariscal López y Brasilia" confirmed={1} total={3}/>
      <ReportCard name="Vecino #C3D4" bg="#0A84FF" time="Hace 18 min" address="Calle Pitiantuta c/ San Martín" confirmed={2} total={3}/>
      <ReportCard name="Vecino #E5F6" bg="#22C55E" time="Hace 31 min" address="Av. España esq. Mcal. Estigarribia" confirmed={3} total={3}/>
      <ReportCard name="Vecino #G7H8" bg="#EF4444" time="Hace 48 min" address="Gral. Santos c/ México" confirmed={1} total={3} expiring/>
    </div>
    {/* FAB */}
    <div style={{ position: 'absolute', bottom: 90, right: 16, height: 56, paddingInline: 20, borderRadius: 28, background: C.amber, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 20px rgba(251,191,36,0.35)', zIndex: 10 }}>
      <IWarn size={20} color="#0F172A"/>
      <span style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Reportar corte</span>
    </div>
    <BottomNav active="reports"/>
  </LuzDevice>
);

/* ── SCREEN 6: Modal reportar corte ── */
const ScreenReportModal = ({ state = 'default' }) => (
  <LuzDevice bgColor={C.bg}>
    {/* Blurred map bg */}
    <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
      <DarkMap h={852}/>
    </div>
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1 }}/>
    {/* Bottom sheet */}
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2, background: C.bg, borderRadius: '24px 24px 0 0', padding: '0 24px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 20px' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: '#475569' }}/>
      </div>
      {state === 'confirmed' ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 8 }}>
          <div style={{ width: 96, height: 96, borderRadius: 48, background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
            <ICheck size={48} color={C.greenL}/>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.text, textAlign: 'center', marginBottom: 12 }}>Reporte enviado ✓</div>
          <div style={{ fontSize: 15, color: C.textMid, textAlign: 'center', lineHeight: '22px', marginBottom: 32 }}>Si más vecinos reportan, te avisamos cuando se confirme.</div>
          <div style={{ width: '100%', height: 56, background: C.amber, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Listo</span>
          </div>
        </div>
      ) : state === 'no-permission' ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 8 }}>
          <div style={{ width: 96, height: 96, borderRadius: 48, background: 'rgba(251,191,36,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
            <IPinOff size={48} color={C.amber}/>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text, textAlign: 'center', marginBottom: 10 }}>Necesitamos tu ubicación</div>
          <div style={{ fontSize: 15, color: C.textMid, textAlign: 'center', lineHeight: '22px', marginBottom: 28 }}>Para registrar el reporte necesitamos acceder a tu ubicación actual.</div>
          <div style={{ width: '100%', height: 56, background: C.amber, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Activar ubicación</span>
          </div>
          <div style={{ width: '100%', height: 48, border: `1px solid ${C.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 15, color: C.text }}>Cancelar</span>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: 96, height: 96, borderRadius: 48, background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
            {state === 'loading' ? (
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={C.redL} strokeWidth="2" strokeLinecap="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
                  <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
                </path>
              </svg>
            ) : <IWarn size={48} color={C.red}/>}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text, textAlign: 'center', marginBottom: 10 }}>¿No hay luz en tu zona?</div>
          <div style={{ fontSize: 14, color: C.textMid, textAlign: 'center', lineHeight: '21px', marginBottom: 28, maxWidth: 300 }}>Vamos a usar tu ubicación actual para registrar el reporte. Si 3 vecinos reportan lo mismo en menos de 500m, se confirma como un corte real.</div>
          {/* Location card */}
          <div style={{ width: '100%', background: C.surface, borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <IPin size={20} color={C.amber}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Tu ubicación</div>
              <div style={{ fontSize: 13, color: C.textMid }}>Av. Mariscal López, Asunción</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>±15 m</div>
            </div>
            <IRefresh size={18} color={C.textMuted}/>
          </div>
          <div style={{ width: '100%', height: 56, background: state === 'loading' ? '#9ca3af' : C.amber, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>{state === 'loading' ? 'Detectando ubicación…' : 'Confirmar reporte'}</span>
          </div>
          <div style={{ width: '100%', height: 48, border: `1px solid ${C.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 15, color: C.text }}>Cancelar</span>
          </div>
        </div>
      )}
    </div>
  </LuzDevice>
);

/* ── SCREEN 7: Ajustes ── */
const SettingSection = ({ title, children }) => (
  <div style={{ marginBottom: 4 }}>
    <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, padding: '16px 16px 8px' }}>{title}</div>
    <div style={{ background: C.surface, borderRadius: 12, margin: '0 16px', overflow: 'hidden' }}>
      {children}
    </div>
  </div>
);

const SettingRow = ({ icon: Icon, iconColor = C.textMuted, label, sub, right, danger, divider = true }) => (
  <div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', minHeight: 52 }}>
      {Icon && <Icon size={20} color={danger ? C.redL : iconColor}/>}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, color: danger ? C.redL : C.text, fontWeight: 400 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>{sub}</div>}
      </div>
      {right}
    </div>
    {divider && <div style={{ height: 1, background: C.border, marginLeft: 52 }}/>}
  </div>
);

const Toggle = ({ on = true }) => (
  <div style={{ width: 48, height: 28, borderRadius: 14, background: on ? C.amber : C.surfaceVar, position: 'relative', flexShrink: 0 }}>
    <div style={{ width: 22, height: 22, borderRadius: 11, background: on ? '#0F172A' : C.textMuted, position: 'absolute', top: 3, left: on ? 23 : 3, transition: 'left 0.2s' }}/>
  </div>
);

const ScreenSettings = () => (
  <LuzDevice bgColor={C.bg}>
    <TopBar title="Ajustes" large right={<div style={{ width: 16 }}/>}/>
    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>
      <SettingSection title="Notificaciones">
        <SettingRow icon={IBell} iconColor={C.amber} label="Alertas de cortes" sub="Recibí avisos cuando hay cortes a menos de 5 km." right={<Toggle on={true}/>}/>
        <SettingRow icon={IZap} iconColor={C.greenL} label="Aviso cuando vuelve la luz" sub="Te notificamos también cuando un corte cercano se resuelve." right={<Toggle on={true}/>}/>
        <SettingRow icon={IPhone} iconColor={C.textMuted} label="Radio de alertas: 5 km" divider={false}
          sub={
            <div style={{ marginTop: 6 }}>
              <div style={{ height: 4, background: C.surfaceVar, borderRadius: 2, position: 'relative', marginBottom: 4 }}>
                <div style={{ width: '45%', height: '100%', background: C.amber, borderRadius: 2 }}/>
                <div style={{ width: 14, height: 14, borderRadius: 7, background: C.amber, position: 'absolute', left: 'calc(45% - 7px)', top: -5, boxShadow: '0 2px 8px rgba(251,191,36,0.5)' }}/>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.textMuted }}>
                <span>1km</span><span>3km</span><span style={{ color: C.amber, fontWeight: 600 }}>5km</span><span>10km</span><span>20km</span>
              </div>
            </div>
          }
        />
      </SettingSection>
      <SettingSection title="Ubicación">
        <SettingRow icon={IPin} iconColor={C.amber} label="Mi zona actual" sub="Asunción, Capital" right={<span style={{ fontSize: 13, color: C.amber }}>Cambiar</span>}/>
        <SettingRow icon={IMap} iconColor={C.textMuted} label="Zonas adicionales" divider={false} right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ background: C.amber, color: '#0F172A', borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '2px 7px' }}>2</span>
            <IRight size={16} color={C.textMuted}/>
          </div>
        }/>
      </SettingSection>
      <SettingSection title="Datos y privacidad">
        <SettingRow icon={IInfo} iconColor={C.textMuted} label="Mi ID anónimo" sub="#A1B2C3D4" right={<ICopy size={16} color={C.textMuted}/>}/>
        <SettingRow icon={ITrash} iconColor={C.redL} label="Eliminar mis datos" danger right={<IRight size={16} color={C.textMuted}/>}/>
        <SettingRow icon={IShare} iconColor={C.textMuted} label="Política de privacidad" right={<IRight size={16} color={C.textMuted}/>}/>
        <SettingRow icon={IInfo} iconColor={C.textMuted} label="Términos de uso" divider={false} right={<IRight size={16} color={C.textMuted}/>}/>
      </SettingSection>
      <SettingSection title="Información">
        <SettingRow label="Sobre LuzAlerts" sub="v1.0.0 · Proyecto independiente" right={<IRight size={16} color={C.textMuted}/>}/>
        <SettingRow label="Reportar un problema" divider={false} right={<IRight size={16} color={C.textMuted}/>}/>
      </SettingSection>
      <div style={{ padding: '20px 16px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
          <IZap size={14} color={C.textMuted}/>
          <span style={{ fontSize: 13, color: '#64748B', fontWeight: 600 }}>LuzAlerts v1.0.0</span>
        </div>
        <div style={{ fontSize: 11, color: '#64748B', lineHeight: '16px' }}>Proyecto independiente. No afiliado a la ANDE.</div>
      </div>
    </div>
    <BottomNav active="settings"/>
  </LuzDevice>
);

Object.assign(window, { ScreenReports, ScreenReportModal, ScreenSettings });

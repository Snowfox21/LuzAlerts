// Темная схема Google Maps, чтобы карта не выбивалась из темного интерфейса.
// Общий модуль для всех MapView в приложении (index.tsx и outage/[id].tsx).
export const darkMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#0D1626' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#0D1626' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#253348' }] },
    { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#64748B' }] },
    { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#334155' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0A1520' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1A2840' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#131E30' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#334155' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#22314D' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0A1520' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#253348' }] },
];

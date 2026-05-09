import React from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';

const LEVEL_COLORS = {
  safe: '#22c55e',
  moderate: '#f59e0b',
  avoid: '#ef4444',
};

export default function ComfortMap({ pings = [], center = [22.5561, 88.3629] }) {
  return (
    <MapContainer
      center={center}
      zoom={14}
      style={{ height: 400, width: '100%', borderRadius: '12px', zIndex: 0 }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
      />
      {pings.map((ping, i) => ping.lat && ping.lng && (
        <CircleMarker
          key={i}
          center={[ping.lat, ping.lng]}
          radius={18}
          fillColor={LEVEL_COLORS[ping.level] || '#6b7280'}
          color="transparent"
          fillOpacity={0.5}
        >
          <Popup>
            <strong>{ping.level === 'safe' ? '🟢 Safe' : ping.level === 'moderate' ? '🟡 Moderate' : '🔴 Avoid'}</strong>
            {ping.note && <><br />{ping.note}</>}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

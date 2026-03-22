import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export default function LiveMap({ center = [22.5561, 88.3629], members = [], zoom = 14 }) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: 400, width: '100%', borderRadius: '12px', zIndex: 0 }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
      />
      {members.map((member, i) => member.lat && member.lng && (
        <CircleMarker
          key={i}
          center={[member.lat, member.lng]}
          radius={10}
          fillColor="#3B82F6"
          color="#2563EB"
          fillOpacity={0.8}
        >
          <Popup>{member.name || 'Circle Member'}</Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

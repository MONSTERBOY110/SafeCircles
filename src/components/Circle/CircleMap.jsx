import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet default marker icon (known Vite/Webpack issue)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function CircleMap({ circleData }) {
  const meetingPoint = circleData?.meeting_point;
  const destCoords = circleData?.dest_coords || circleData?.destination_coords;

  const center = meetingPoint
    ? [meetingPoint.lat, meetingPoint.lng]
    : [22.5561, 88.3629]; // default: Jadavpur

  const routePoints = [];
  if (meetingPoint) routePoints.push([meetingPoint.lat, meetingPoint.lng]);
  if (destCoords) routePoints.push([destCoords.lat, destCoords.lng]);

  return (
    <MapContainer
      center={center}
      zoom={14}
      style={{ height: 380, width: '100%', borderRadius: '12px', zIndex: 0 }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
      />

      {meetingPoint && (
        <Marker position={[meetingPoint.lat, meetingPoint.lng]}>
          <Popup>
            📍 <strong>Meeting Point</strong><br />
            {meetingPoint.name || 'Starting Point'}<br />
            {meetingPoint.cctv_coverage && '🎥 CCTV Coverage'}
          </Popup>
        </Marker>
      )}

      {destCoords && (
        <Marker position={[destCoords.lat, destCoords.lng]}>
          <Popup>🏁 <strong>Destination</strong></Popup>
        </Marker>
      )}

      {routePoints.length === 2 && (
        <Polyline
          positions={routePoints}
          color="#3B82F6"
          weight={4}
          opacity={0.8}
          dashArray="8 4"
        />
      )}
    </MapContainer>
  );
}

import React from 'react';
import { TileLayer } from 'react-leaflet';
import { useTheme } from '../context/ThemeContext';

export default function ThemedTileLayer() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <TileLayer
      key={theme}
      url={
        isDark
          ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
          : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
      }
      attribution={
        isDark
          ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; CARTO'
          : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }
    />
  );
}

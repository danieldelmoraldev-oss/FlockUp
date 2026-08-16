import React from 'react';
// Importamos los iconos específicos que necesitamos del pack Ionicons 5
import { IoMapOutline, IoPeopleOutline, IoCarOutline } from 'react-icons/io5';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: 'radar' | 'social' | 'routes' | 'profile') => void;
}

// Físicas del Cristal iOS Bubble (Ligeramente retocadas para el nuevo estilo)
const navStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '30px',
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  gap: '10px',
  padding: '8px 15px',
  background: 'rgba(15, 20, 30, 0.7)', // Un pelín más oscuro para resaltar los iconos
  borderRadius: '40px',
  backdropFilter: 'blur(20px) saturate(160%)',
  WebkitBackdropFilter: 'blur(20px) saturate(160%)',
  boxShadow: `
    0 20px 40px rgba(0, 0, 0, 0.4),
    inset 0 1px 1px rgba(255, 255, 255, 0.15)
  `,
  border: '1px solid rgba(255, 255, 255, 0.08)',
  zIndex: 100,
};

// Contenedor vertical para Icono + Texto
const tabItemStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  width: '65px', // Un poco más ancho para el texto
  height: '60px',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', // Fuente limpia estilo iOS
};

export default function BottomNav({ activeTab, setActiveTab }: BottomNavProps) {
  
  // Función para calcular el color (Cyan activo, Gris apagado inactivo)
  const getItemColor = (isActive: boolean) => isActive ? '#00FFCC' : 'rgba(255, 255, 255, 0.5)';

  return (
    <div style={navStyle}>
      
      {/* Botón 1: El Radar */}
      <div style={tabItemStyle} onClick={() => setActiveTab('radar')}>
        <IoMapOutline 
          size={26} // Tamaño del icono vectorial
          color={getItemColor(activeTab === 'radar')}
          style={{ transition: 'color 0.2s ease' }}
        />
        <span style={{ 
          fontSize: '11px', 
          marginTop: '4px', 
          fontWeight: activeTab === 'radar' ? '600' : '400',
          color: getItemColor(activeTab === 'radar'),
          transition: 'color 0.2s ease'
        }}>
          Radar
        </span>
      </div>

      {/* Botón 2: La Bandada */}
      <div style={tabItemStyle} onClick={() => setActiveTab('social')}>
        <IoPeopleOutline 
          size={26}
          color={getItemColor(activeTab === 'social')}
          style={{ transition: 'color 0.2s ease' }}
        />
        <span style={{ 
          fontSize: '11px', 
          marginTop: '4px', 
          fontWeight: activeTab === 'social' ? '600' : '400',
          color: getItemColor(activeTab === 'social'),
          transition: 'color 0.2s ease'
        }}>
          Bandada
        </span>
      </div>

      {/* Botón 3: Tu Garaje */}
      <div style={tabItemStyle} onClick={() => setActiveTab('profile')}>
        <IoCarOutline 
          size={26}
          color={getItemColor(activeTab === 'profile')}
          style={{ transition: 'color 0.2s ease' }}
        />
        <span style={{ 
          fontSize: '11px', 
          marginTop: '4px', 
          fontWeight: activeTab === 'profile' ? '600' : '400',
          color: getItemColor(activeTab === 'profile'),
          transition: 'color 0.2s ease'
        }}>
          Garaje
        </span>
      </div>

    </div>
  );
}
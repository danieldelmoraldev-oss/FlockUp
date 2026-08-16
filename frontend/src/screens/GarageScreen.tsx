import React from 'react';
import { IoCarOutline, IoSpeedometerOutline, IoMapOutline, IoSettingsOutline, IoLogOutOutline, IoLockClosedOutline } from 'react-icons/io5';

interface GarageScreenProps {
  username: string | null;
  isLoggedIn: boolean;
  onLogout: () => void;
  onOpenAuth: () => void;
}

const screenStyle: React.CSSProperties = {
  width: '100%', height: '100%', backgroundColor: '#0B0F19', color: 'white',
  display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
  padding: '20px 20px 100px 20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  overflowY: 'auto'
};

const fixedScreenStyle: React.CSSProperties = {
  ...screenStyle, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(11, 15, 25, 0.98)', padding: '60px 24px 100px 24px', zIndex: 40,
  alignItems: 'center', justifyContent: 'center', textAlign: 'center'
};

const glassCardStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)',
  borderRadius: '24px', padding: '20px', marginBottom: '16px'
};

export default function GarageScreen({ username, isLoggedIn, onLogout, onOpenAuth }: GarageScreenProps) {
  
  if (!isLoggedIn) {
    return (
      <div style={fixedScreenStyle}>
        <IoLockClosedOutline size={80} color="rgba(255, 255, 255, 0.2)" style={{ marginBottom: '20px' }} />
        <h1 style={{ fontSize: '28px', margin: '0 0 12px 0', fontWeight: '700' }}>Garaje Clausurado</h1>
        <p style={{ margin: '0 0 32px 0', opacity: 0.6, fontSize: '16px', maxWidth: '300px' }}>
          Identifícate para acceder a tus estadísticas de vuelo, tu vehículo y tu configuración.
        </p>
        <button onClick={onOpenAuth} style={{ background: '#00FFCC', color: '#0B0F19', padding: '16px 40px', borderRadius: '50px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', border: 'none', boxShadow: '0 8px 20px rgba(0, 255, 204, 0.2)' }}>
          Entrar a la red
        </button>
      </div>
    );
  }

  return (
    <div style={screenStyle}>
      <h1 style={{ margin: '0 0 24px 0', fontSize: '28px', fontWeight: '800', letterSpacing: '-0.5px' }}>Tu Garaje 🏎️</h1>

      {/* TARJETA DE PILOTO */}
      <div style={{ ...glassCardStyle, display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ width: '70px', height: '70px', borderRadius: '20px', background: 'rgba(0, 255, 204, 0.1)', border: '1px solid rgba(0, 255, 204, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <IoCarOutline size={40} color="#00FFCC" />
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px' }}>ID de Piloto</p>
          <h2 style={{ margin: '4px 0 0 0', fontSize: '24px', color: '#00FFCC', fontWeight: '800' }}>{username}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00FFCC', boxShadow: '0 0 10px #00FFCC' }}></div>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>Conectado al radar</span>
          </div>
        </div>
      </div>

      {/* ESTADÍSTICAS (Placeholders por ahora) */}
      <h3 style={{ fontSize: '16px', margin: '10px 0 16px 0', opacity: 0.8 }}>Hoja de Ruta</h3>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <div style={{ ...glassCardStyle, flex: 1, margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <IoSpeedometerOutline size={28} color="rgba(255,255,255,0.8)" style={{ marginBottom: '8px' }} />
          <span style={{ fontSize: '24px', fontWeight: '800' }}>340</span>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Km Recorridos</span>
        </div>
        <div style={{ ...glassCardStyle, flex: 1, margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <IoMapOutline size={28} color="rgba(255,255,255,0.8)" style={{ marginBottom: '8px' }} />
          <span style={{ fontSize: '24px', fontWeight: '800' }}>12</span>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Rutas Completadas</span>
        </div>
      </div>

      {/* AJUSTES RÁPIDOS */}
      <h3 style={{ fontSize: '16px', margin: '0 0 16px 0', opacity: 0.8 }}>Configuración</h3>
      <div style={{ ...glassCardStyle, padding: '0' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <IoSettingsOutline size={20} color="rgba(255,255,255,0.6)" style={{ marginRight: '16px' }} />
          <span style={{ flex: 1, fontSize: '15px' }}>Ajustes de cuenta</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px' }}>
          <IoCarOutline size={20} color="rgba(255,255,255,0.6)" style={{ marginRight: '16px' }} />
          <span style={{ flex: 1, fontSize: '15px' }}>Cambiar vehículo (Próximamente)</span>
        </div>
      </div>

      {/* BOTÓN SALIR */}
      <button onClick={onLogout} style={{ marginTop: 'auto', width: '100%', background: 'rgba(255, 0, 85, 0.1)', border: '1px solid rgba(255, 0, 85, 0.3)', color: '#FF0055', padding: '16px', borderRadius: '20px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <IoLogOutOutline size={22} />
        Desconectar del Servidor
      </button>
    </div>
  );
}
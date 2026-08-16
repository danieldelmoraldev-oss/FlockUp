import React, { useState } from 'react';
import { IoCloseOutline } from 'react-icons/io5';

interface AuthModalProps {
  onClose: () => void;
  onLoginSuccess: (username: string) => void;
}

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed', // Cambiado a fixed
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.4)',
  zIndex: 200, 
  display: 'flex', 
  flexDirection: 'column', 
  justifyContent: 'flex-end',
};

const glassPanelStyle: React.CSSProperties = {
  background: 'rgba(15, 20, 30, 0.3)',
  backdropFilter: 'blur(40px) saturate(200%)',
  WebkitBackdropFilter: 'blur(40px) saturate(200%)',
  borderTop: '1px solid rgba(255, 255, 255, 0.2)',
  borderRadius: '40px 40px 0 0',
  padding: '24px 24px 32px 24px', // Paddings reducidos
  color: 'white',
  animation: 'slideUp 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  maxHeight: '90dvh', // Evita que crezca más que la pantalla
  overflowY: 'auto' // Si el móvil es enano, scrollea solo por dentro del cristal
};

const inputStyle: React.CSSProperties = {
  width: '100%', 
  padding: '14px 20px', // Un poco más estrechos
  borderRadius: '16px',
  background: 'rgba(0, 0, 0, 0.2)', 
  border: '1px solid rgba(255, 255, 255, 0.15)',
  color: 'white', 
  fontSize: '16px', 
  outline: 'none', 
  marginBottom: '12px', // Menos separación
  boxSizing: 'border-box'
};

export default function AuthModal({ onClose, onLoginSuccess }: AuthModalProps) {
  const [isRegister, setIsRegister] = useState(false);
  
  // Estados para los campos de texto
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 🚀 CONEXIÓN CON EL BACKEND Y MONGODB
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    const endpoint = isRegister ? '/auth/register' : '/auth/login';
    const payload = isRegister ? { username, email, password } : { email, password };

    try {
      // Llamamos a nuestro servidor Node.js (que hablará con Mongo)
      const res = await fetch(`${import.meta.env.VITE_API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        // Guardamos el token y el nombre en el navegador
        localStorage.setItem('flockup_token', data.token);
        localStorage.setItem('flockup_username', data.username); // 🔥 LÍNEA NUEVA
        
        // Avisamos a App.tsx de que ya estamos dentro y le pasamos el nombre
        onLoginSuccess(data.username);
      } else {
        // Si hay error (contraseña mal, correo existe...), lo mostramos
        setErrorMsg(data.message);
      }
    } catch (error) {
      setErrorMsg('Error de conexión con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={modalOverlayStyle}>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
      
      <div style={glassPanelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ margin: 0, fontSize: '28px', fontWeight: '700' }}>
            {isRegister ? 'Crear Cuenta' : 'Iniciar Sesión'}
          </h2>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IoCloseOutline size={24} />
          </button>
        </div>

        {errorMsg && (
          <div style={{ background: 'rgba(255,0,85,0.2)', color: '#FF0055', padding: '12px', borderRadius: '12px', marginBottom: '16px', textAlign: 'center', fontSize: '14px', border: '1px solid rgba(255,0,85,0.4)' }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleAuth}>
          {isRegister && (
            <input type="text" placeholder="Tu nombre de piloto (Ej: Dani)" style={inputStyle} value={username} onChange={e => setUsername(e.target.value)} required />
          )}
          <input type="email" placeholder="Correo electrónico" style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Contraseña" style={inputStyle} value={password} onChange={e => setPassword(e.target.value)} required />
          
          <button type="submit" disabled={isLoading} style={{
            width: '100%', padding: '16px', borderRadius: '16px', background: isLoading ? 'rgba(0, 255, 204, 0.5)' : '#00FFCC',
            color: '#0B0F19', fontSize: '18px', fontWeight: '700', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer',
            boxShadow: '0 8px 20px rgba(0, 255, 204, 0.3)'
          }}>
            {isLoading ? 'Cargando...' : (isRegister ? 'Registrarse en FlockUp' : 'Entrar a la Bandada')}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>
          {isRegister ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}
          <span onClick={() => { setIsRegister(!isRegister); setErrorMsg(''); }} style={{ color: '#00FFCC', marginLeft: '6px', cursor: 'pointer', fontWeight: '600' }}>
            {isRegister ? 'Inicia sesión' : 'Regístrate'}
          </span>
        </p>
      </div>
    </div>
  );
}
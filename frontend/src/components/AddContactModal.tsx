import React, { useState } from 'react';
import { IoCloseOutline, IoPeopleOutline, IoPersonOutline, IoAddCircleOutline } from 'react-icons/io5';

interface AddContactModalProps {
  onClose: () => void;
  initialMode?: 'friend' | 'join' | 'create';
  // NUEVO: Prop para avisar de que salte al chat
  onGroupCreated?: (groupData: any) => void;
  }

const modalOverlayStyle: React.CSSProperties = {
  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.6)', zIndex: 250, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
};

const glassPanelStyle: React.CSSProperties = {
  background: 'rgba(15, 20, 30, 0.85)', backdropFilter: 'blur(30px) saturate(200%)',
  WebkitBackdropFilter: 'blur(30px) saturate(200%)', borderTop: '1px solid rgba(255, 255, 255, 0.15)',
  borderRadius: '40px 40px 0 0', padding: '40px 30px', color: 'white',
  animation: 'slideUp 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)', fontFamily: 'system-ui, -apple-system, sans-serif',
};

export default function AddContactModal({ onClose, initialMode = 'friend', onGroupCreated }: AddContactModalProps) {
  const [mode, setMode] = useState<'friend' | 'join' | 'create'>(initialMode);
  
  // Estados para los inputs
  const [friendUsername, setFriendUsername] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [groupName, setGroupName] = useState('');

  // Estados para el feedback (mensajes de éxito o error)
  const [statusMsg, setStatusMsg] = useState('');
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 1️⃣ LÓGICA: Añadir Amigo
  const handleAddFriend = async () => {
    if (!friendUsername) return;
    setIsLoading(true); setStatusMsg('');
    
    try {
      const token = localStorage.getItem('flockup_token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/social/add-friend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ friendUsername })
      });
      const data = await res.json();
      setIsError(!res.ok);
      setStatusMsg(data.message);
      if (res.ok) setFriendUsername('');
    } catch (error) {
      setIsError(true); setStatusMsg('Error al conectar con el servidor.');
    } finally { setIsLoading(false); }
  };

  // 2️⃣ LÓGICA: Unirse a Grupo
  const handleJoinGroup = async () => {
    if (!inviteCode) return;
    setIsLoading(true); setStatusMsg('');
    
    try {
      const token = localStorage.getItem('flockup_token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/social/join-group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ inviteCode })
      });
      const data = await res.json();
      setIsError(!res.ok);
      setStatusMsg(data.message);
      if (res.ok) setInviteCode('');
    } catch (error) {
      setIsError(true); setStatusMsg('Error al conectar con el servidor.');
    } finally { setIsLoading(false); }
  };
    
  const handleCreateGroup = async () => {
    if (!groupName) return;
    setIsLoading(true); setStatusMsg('');
    try {
      const token = localStorage.getItem('flockup_token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/social/create-group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ groupName })
      });
      const data = await res.json();
      if (res.ok) {
        // 🔥 Llama a la prop para saltar al chat
        if (onGroupCreated) onGroupCreated(data.group);
      } else {
        setIsError(true); setStatusMsg(data.message);
      }
    } catch (error) {
      setIsError(true); setStatusMsg('Error al conectar con el servidor.');
    } finally { setIsLoading(false); }
  };

  // Función para cambiar de pestaña limpiando mensajes
  const changeMode = (newMode: 'friend' | 'join' | 'create') => {
    setMode(newMode);
    setStatusMsg('');
  };

  return (
    <div style={modalOverlayStyle}>
      <div style={glassPanelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>Expandir Bandada</h2>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IoCloseOutline size={24} /></button>
        </div>

        {/* FEEDBACK DE MENSAJES (Éxito o Error) */}
        {statusMsg && (
          <div style={{ 
            background: isError ? 'rgba(255,0,85,0.2)' : 'rgba(0,255,204,0.2)', 
            color: isError ? '#FF0055' : '#00FFCC', 
            padding: '12px', borderRadius: '12px', marginBottom: '16px', textAlign: 'center', fontSize: '14px', 
            border: `1px solid ${isError ? 'rgba(255,0,85,0.4)' : 'rgba(0,255,204,0.4)'}` 
          }}>
            {statusMsg}
          </div>
        )}

        {/* TABS DE SELECCIÓN */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '20px' }}>
          <button onClick={() => changeMode('friend')} style={{ flex: 1, padding: '10px 4px', borderRadius: '16px', background: mode === 'friend' ? '#00FFCC' : 'transparent', color: mode === 'friend' ? '#0B0F19' : 'white', border: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', transition: 'all 0.2s', fontSize: '12px' }}>
            <IoPersonOutline size={16} /> Añadir Piloto
          </button>
          <button onClick={() => changeMode('join')} style={{ flex: 1, padding: '10px 4px', borderRadius: '16px', background: mode === 'join' ? '#00FFCC' : 'transparent', color: mode === 'join' ? '#0B0F19' : 'white', border: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', transition: 'all 0.2s', fontSize: '12px' }}>
            <IoPeopleOutline size={16} /> Unirse
          </button>
          <button onClick={() => changeMode('create')} style={{ flex: 1, padding: '10px 4px', borderRadius: '16px', background: mode === 'create' ? '#00FFCC' : 'transparent', color: mode === 'create' ? '#0B0F19' : 'white', border: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', transition: 'all 0.2s', fontSize: '12px' }}>
            <IoAddCircleOutline size={16} /> Crear
          </button>
        </div>

        {/* CONTENIDO DINÁMICO */}
        {mode === 'friend' && (
          <div>
            <p style={{ opacity: 0.7, fontSize: '14px', marginBottom: '16px' }}>Busca a tus amigos usando su nombre de piloto exacto.</p>
            <input type="text" value={friendUsername} onChange={e => setFriendUsername(e.target.value)} placeholder="Nombre del piloto..." style={{ width: '100%', padding: '16px 20px', borderRadius: '16px', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'white', fontSize: '16px', outline: 'none', marginBottom: '16px', boxSizing: 'border-box' }} />
            <button onClick={handleAddFriend} disabled={isLoading} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: isLoading ? 'rgba(0,255,204,0.5)' : '#00FFCC', color: '#0B0F19', fontSize: '16px', fontWeight: '700', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer' }}>
              {isLoading ? 'Buscando...' : 'Enviar Solicitud'}
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div>
            <p style={{ opacity: 0.7, fontSize: '14px', marginBottom: '16px' }}>Introduce el código secreto de 5 dígitos para entrar al convoy.</p>
            <input type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="Ej: X7K9P" maxLength={5} style={{ width: '100%', padding: '16px 20px', borderRadius: '16px', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'white', fontSize: '20px', letterSpacing: '4px', textAlign: 'center', outline: 'none', marginBottom: '16px', boxSizing: 'border-box', textTransform: 'uppercase' }} />
            <button onClick={handleJoinGroup} disabled={isLoading} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: isLoading ? 'rgba(0,255,204,0.5)' : '#00FFCC', color: '#0B0F19', fontSize: '16px', fontWeight: '700', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer' }}>
              {isLoading ? 'Conectando...' : 'Entrar al Grupo'}
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div>
            <p style={{ opacity: 0.7, fontSize: '14px', marginBottom: '16px' }}>Dale un nombre a tu nueva bandada. El código de invitación se generará solo.</p>
            <input type="text" value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Nombre del grupo..." style={{ width: '100%', padding: '16px 20px', borderRadius: '16px', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'white', fontSize: '16px', outline: 'none', marginBottom: '16px', boxSizing: 'border-box' }} />
            <button onClick={handleCreateGroup} disabled={isLoading} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: isLoading ? 'rgba(0,255,204,0.5)' : '#00FFCC', color: '#0B0F19', fontSize: '16px', fontWeight: '700', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer' }}>
               {isLoading ? 'Creando...' : 'Crear Bandada'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
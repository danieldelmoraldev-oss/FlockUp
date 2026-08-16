import React, { useState, useEffect } from 'react';
import { IoLockClosedOutline, IoSearchOutline, IoPersonAddOutline, IoCompassOutline } from 'react-icons/io5';
import ChatScreen from './ChatScreen';
import AddContactModal from '../components/AddContactModal';
import io from 'socket.io-client';

interface SocialScreenProps {
  isLoggedIn: boolean;
  onOpenAuth: () => void;
  onJoinRoute?: (route: any) => void; 
  onCreateRoute?: () => void; // 🔥 AÑADE ESTA LÍNEA
}

const screenStyle: React.CSSProperties = { width: '100%', height: '100%', backgroundColor: '#0B0F19', color: 'white', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', paddingBottom: '80px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' };
const fixedScreenStyle: React.CSSProperties = { ...screenStyle, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(11, 15, 25, 0.98)', padding: '60px 24px 100px 24px', zIndex: 40 };

// 🔥 Ahora apuntamos directamente a tu servidor de Render
const socket = io(import.meta.env.VITE_SOCKET_URL);

// 🔥 PUNTOS ANIMADOS REFINADOS PARA LA LISTA
const TypingDots = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '3px', paddingLeft: '4px', height: '10px' }}>
    <style>{`
      @keyframes typingWaveSocial {
        0%, 60%, 100% { transform: translateY(0); }
        30% { transform: translateY(-4px); }
      }
      .typing-dot-social {
        width: 4px; height: 4px; background-color: #00FFCC; border-radius: 50%;
        animation: typingWaveSocial 1.2s infinite ease-in-out;
      }
      .typing-dot-social:nth-child(1) { animation-delay: 0s; }
      .typing-dot-social:nth-child(2) { animation-delay: 0.15s; }
      .typing-dot-social:nth-child(3) { animation-delay: 0.3s; }
    `}</style>
    <div className="typing-dot-social" />
    <div className="typing-dot-social" />
    <div className="typing-dot-social" />
  </div>
);

export default function SocialScreen({ isLoggedIn, onOpenAuth, onJoinRoute, onCreateRoute }: SocialScreenProps) {
  const [chats, setChats] = useState<any[]>([]); 
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [typingChats, setTypingChats] = useState<Record<string, string[]>>({});
  const [filter, setFilter] = useState<'all' | 'groups' | 'direct'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeChat, setActiveChat] = useState<any | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalInitialMode, setModalInitialMode] = useState<'friend' | 'join' | 'create'>('friend');

  const myUsername = localStorage.getItem('flockup_username') || '';

  const fetchMyChats = async () => {
    try {
      const token = localStorage.getItem('flockup_token');
      if (!token) return;
      
      const res = await fetch(`${import.meta.env.VITE_API_URL}/social/my-chats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        
        const formattedChats = data.map((c: any) => ({
          ...c,
          unreadCount: 0,
          actualRoomId: c.type === 'direct' ? [myUsername, c.name].sort().join('_') : c.id
        }));
        
        setChats(formattedChats);
        formattedChats.forEach((c: any) => socket.emit('join_room', c.actualRoomId));
      }
    } catch (error) {
      console.error("Error al descargar chats:", error);
    } finally {
      setIsLoadingChats(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) fetchMyChats();
  }, [isLoggedIn]);

  // 📡 ESCUCHA GLOBAL DE MENSAJES Y ESCRITURA
  useEffect(() => {
    const handleNewMsg = (newMsg: any) => {
      setChats(prevChats => prevChats.map(c => {
        if (c.actualRoomId === newMsg.chatId) {
          const isChatOpen = activeChat?.actualRoomId === newMsg.chatId;
          const displayMessage = c.type === 'group' && !newMsg.isSystem 
            ? `${newMsg.senderName}: ${newMsg.text}` 
            : newMsg.text;

          return {
            ...c,
            lastMessage: displayMessage,
            time: newMsg.time,
            unreadCount: isChatOpen ? 0 : (c.unreadCount || 0) + 1
          };
        }
        return c;
      }));
    };

    const handleTyping = (data: { roomId: string, username: string }) => {
      if (data.username === myUsername) return;
      setTypingChats(prev => {
        const currentTypers = prev[data.roomId] || [];
        if (!currentTypers.includes(data.username)) {
          return { ...prev, [data.roomId]: [...currentTypers, data.username] };
        }
        return prev;
      });
    };

    const handleStopTyping = (data: { roomId: string, username: string }) => {
      setTypingChats(prev => {
        const currentTypers = prev[data.roomId] || [];
        return { ...prev, [data.roomId]: currentTypers.filter(u => u !== data.username) };
      });
    };

    socket.on('receive_message', handleNewMsg);
    socket.on('display_typing', handleTyping);
    socket.on('hide_typing', handleStopTyping);

    return () => { 
      socket.off('receive_message', handleNewMsg); 
      socket.off('display_typing', handleTyping);
      socket.off('hide_typing', handleStopTyping);
    };
  }, [activeChat, myUsername]);

  const openAddModal = (mode: 'friend' | 'join' | 'create') => {
    setModalInitialMode(mode);
    setShowAddModal(true);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    fetchMyChats(); 
  };

  const handleOpenChat = (chat: any) => {
    setActiveChat(chat);
    setChats(prev => prev.map(c => c.id === chat.id ? { ...c, unreadCount: 0 } : c));
  };

  if (!isLoggedIn) {
    return (
      <div style={{ ...fixedScreenStyle, alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <IoLockClosedOutline size={80} color="rgba(255, 255, 255, 0.2)" style={{ marginBottom: '20px' }} />
        <h1 style={{ fontSize: '28px', margin: '0 0 12px 0', fontWeight: '700' }}>Bandada Bloqueada</h1>
        <p style={{ margin: '0 0 32px 0', opacity: 0.6, fontSize: '16px', maxWidth: '300px' }}>Para unirte a grupos, chatear y planear rutas conjuntas, necesitas entrar a la red.</p>
        <button onClick={onOpenAuth} style={{ background: 'rgba(0, 255, 204, 0.15)', border: '1px solid #00FFCC', color: '#00FFCC', padding: '16px 40px', borderRadius: '50px', fontSize: '16px', fontWeight: '700', cursor: 'pointer' }}>Iniciar Sesión o Registrarse</button>
      </div>
    );
  }

  const filteredChats = chats.filter(chat => {
    if (filter === 'groups' && chat.type !== 'group') return false;
    if (filter === 'direct' && chat.type !== 'direct') return false;
    return chat.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <>
      {activeChat && (
        <ChatScreen 
          chat={activeChat} 
          socket={socket} 
          onBack={() => setActiveChat(null)} 
          onJoinRoute={onJoinRoute || (() => {})} 
          onCreateRoute={onCreateRoute || (() => {})} // 🔥 AÑADE ESTA LÍNEA
        />
      )}

      {/* 🟢 ZONA 2: LA LISTA DE BANDADA (Se oculta si estás en un chat, pero NO se destruye) */}
      <div style={{ ...screenStyle, display: activeChat ? 'none' : 'flex' }}>
        <div style={{ padding: '20px 20px 10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '800', letterSpacing: '-0.5px' }}>Radar Social 📡</h1>
          <button onClick={() => openAddModal('friend')} style={{ background: 'rgba(0, 255, 204, 0.15)', border: '1px solid rgba(0, 255, 204, 0.4)', color: '#00FFCC', borderRadius: '50%', width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <IoPersonAddOutline size={20} />
          </button>
        </div>

        {chats.length > 0 && (
          <>
            <div style={{ padding: '0 20px 12px 20px' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.05)', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', padding: '0 16px' }}>
                <IoSearchOutline color="rgba(255,255,255,0.4)" size={20} />
                <input type="text" placeholder="Buscar grupos o pilotos..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '100%', background: 'transparent', border: 'none', color: 'white', padding: '12px', outline: 'none', fontSize: '15px' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', padding: '0 20px 16px 20px' }}>
              {[ { id: 'all', label: 'Todos' }, { id: 'groups', label: 'Bandadas' }, { id: 'direct', label: 'Pilotos' } ].map(tab => (
                <button key={tab.id} onClick={() => setFilter(tab.id as any)} style={{ background: filter === tab.id ? '#00FFCC' : 'rgba(255, 255, 255, 0.05)', color: filter === tab.id ? '#0B0F19' : 'rgba(255, 255, 255, 0.7)', border: filter === tab.id ? 'none' : '1px solid rgba(255, 255, 255, 0.1)', padding: '8px 16px', borderRadius: '20px', fontWeight: filter === tab.id ? '700' : '500', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' }}>
                  {tab.label}
                </button>
              ))}
            </div>
          </>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
          {isLoadingChats ? (
             <div style={{ textAlign: 'center', marginTop: '40px', color: '#00FFCC' }}>Cargando radar...</div>
          ) : chats.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: 'rgba(0, 255, 204, 0.1)', border: '1px solid rgba(0, 255, 204, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}><IoCompassOutline size={48} color="#00FFCC" /></div>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '22px', fontWeight: '700' }}>Vuela en Bandada</h2>
              <p style={{ margin: '0 0 24px 0', color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px', lineHeight: '1.5', maxWidth: '280px' }}>Aún no tienes grupos ni amigos. Crea una bandada para planear rutas o añade pilotos.</p>
              <button onClick={() => openAddModal('create')} style={{ width: '100%', maxWidth: '280px', padding: '16px', borderRadius: '16px', background: '#00FFCC', color: '#0B0F19', border: 'none', fontWeight: '700', fontSize: '16px', marginBottom: '12px', cursor: 'pointer', boxShadow: '0 6px 20px rgba(0, 255, 204, 0.3)' }}>+ Crear Nueva Bandada</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredChats.map(chat => {
                const typingUsersInChat = typingChats[chat.actualRoomId] || [];
                const isSomeoneTyping = typingUsersInChat.length > 0;

                return (
                  <div key={chat.id} onClick={() => handleOpenChat(chat)} style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '20px', border: '1px solid rgba(255, 255, 255, 0.05)', cursor: 'pointer' }}>
                    <div style={{ width: '50px', height: '50px', borderRadius: chat.type === 'group' ? '16px' : '50%', background: 'rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', marginRight: '14px' }}>
                      {chat.avatar}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontWeight: '700', fontSize: '16px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{chat.name}</span>
                        <span style={{ fontSize: '12px', color: chat.unreadCount > 0 || isSomeoneTyping ? '#00FFCC' : 'rgba(255, 255, 255, 0.4)' }}>{chat.time}</span>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {isSomeoneTyping ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', margin: 0, fontSize: '13px', color: '#00FFCC', fontWeight: '600', height: '18px' }}>
                            <span>{chat.type === 'group' ? `${typingUsersInChat[0]} escribiendo` : 'Escribiendo'}</span>
                            <TypingDots />
                          </div>
                        ) : (
                          <p style={{ margin: 0, fontSize: '13px', color: chat.unreadCount > 0 ? 'white' : 'rgba(255, 255, 255, 0.6)', fontWeight: chat.unreadCount > 0 ? '600' : 'normal', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                            {chat.lastMessage}
                          </p>
                        )}

                        {chat.unreadCount > 0 && !isSomeoneTyping && (
                          <span style={{ background: '#00FFCC', color: '#0B0F19', borderRadius: '50%', minWidth: '20px', height: '20px', padding: '0 4px', fontSize: '11px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {chat.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {showAddModal && (
          <AddContactModal 
            initialMode={modalInitialMode} 
            onClose={handleCloseModal} 
            onGroupCreated={(newGroup) => {
              setShowAddModal(false);
              setActiveChat(newGroup);
            }}
          />
        )}
      </div>
    </>
  );
}
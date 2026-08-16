import React, { useState, useEffect, useRef } from 'react';
import { IoArrowBackOutline, IoMapOutline, IoAddOutline, IoSendOutline } from 'react-icons/io5';

interface ChatScreenProps {
  chat: any;
  socket: any; 
  onBack: () => void;
  onJoinRoute: (route: any) => void; 
  onCreateRoute: () => void; // 🔥 AÑADE ESTA LÍNEA
}

const ultraGlassStyle: React.CSSProperties = {
  background: 'rgba(15, 20, 30, 0.65)',
  backdropFilter: 'blur(25px) saturate(200%)',
  WebkitBackdropFilter: 'blur(25px) saturate(200%)',
  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
};

// 🔥 PUNTOS ANIMADOS REFINADOS
const TypingDots = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', paddingLeft: '4px', height: '10px' }}>
    <style>{`
      @keyframes typingWave {
        0%, 60%, 100% { transform: translateY(0); }
        30% { transform: translateY(-4px); }
      }
      .typing-dot {
        width: 5px; height: 5px; background-color: #00FFCC; border-radius: 50%;
        animation: typingWave 1.2s infinite ease-in-out;
      }
      .typing-dot:nth-child(1) { animation-delay: 0s; }
      .typing-dot:nth-child(2) { animation-delay: 0.15s; }
      .typing-dot:nth-child(3) { animation-delay: 0.3s; }
    `}</style>
    <div className="typing-dot" />
    <div className="typing-dot" />
    <div className="typing-dot" />
  </div>
);

// 🔥 DISEÑO DE LA TARJETA DE RUTA COMPARTIDA
const ConvoyCard = ({ msg, isMe, onJoin }: { msg: any, isMe: boolean, onJoin: () => void }) => {
  return (
    <div style={{
      background: isMe ? 'linear-gradient(135deg, rgba(0, 255, 204, 0.15) 0%, rgba(0, 150, 150, 0.4) 100%)' : 'rgba(255, 255, 255, 0.05)',
      border: `1px solid ${isMe ? 'rgba(0, 255, 204, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
      borderRadius: '20px',
      padding: '16px',
      width: '240px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      {/* Cabecera de la tarjeta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isMe ? '#00FFCC' : 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IoMapOutline size={18} color={isMe ? '#0B0F19' : 'white'} />
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '12px', color: isMe ? '#00FFCC' : 'rgba(255,255,255,0.6)', fontWeight: 'bold', textTransform: 'uppercase' }}>
            Nuevo Convoy
          </p>
          <p style={{ margin: 0, fontSize: '14px', color: 'white', fontWeight: '600' }}>
            {msg.senderName}
          </p>
        </div>
      </div>

      {/* Detalles de la Ruta */}
      <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '12px', position: 'relative' }}>
        {/* Línea vertical que une origen y destino */}
        <div style={{ position: 'absolute', left: '17px', top: '24px', bottom: '24px', width: '2px', background: 'rgba(255,255,255,0.2)' }}></div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'white', zIndex: 2 }}></div>
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {msg.routeData?.origin || 'Ubicación actual'}
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FF0055', boxShadow: '0 0 8px #FF0055', zIndex: 2 }}></div>
          <span style={{ fontSize: '13px', color: 'white', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {msg.routeData?.destination || 'Destino Desconocido'}
          </span>
        </div>
      </div>

      {/* Botón de Acción */}
      {!isMe && (
        <button onClick={onJoin} style={{
          width: '100%', padding: '12px', borderRadius: '12px', background: '#00FFCC', color: '#0B0F19',
          border: 'none', fontWeight: '700', fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0, 255, 204, 0.2)'
        }}>
          Unirse al Convoy
        </button>
      )}
      {isMe && (
        <div style={{ textAlign: 'center', fontSize: '12px', color: '#00FFCC', fontWeight: '600' }}>
          Esperando a la bandada...
        </div>
      )}
    </div>
  );
};

export default function ChatScreen({ chat, socket, onBack, onJoinRoute, onCreateRoute }: ChatScreenProps) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  
  // 🔥 NUEVO: Estado para mostrar/ocultar el menú del botón +
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);
  const myUsername = localStorage.getItem('flockup_username') || '';

  const actualChatId = chat.type === 'direct' 
    ? [myUsername, chat.name].sort().join('_') 
    : chat.id;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const fetchHistory = async () => {
      const token = localStorage.getItem('flockup_token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/social/messages/${actualChatId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
        scrollToBottom();
      }
    };
    fetchHistory();

    socket.emit('join_room', actualChatId);

    const handleReceiveMessage = (newMsg: any) => {
      setMessages((prev) => [...prev, newMsg]);
      scrollToBottom();
    };

    const handleDisplayTyping = (data: any) => {
  // 🔥 AÑADIR ESTA LÍNEA: Ignorar si no es de este chat
  if (data.roomId !== actualChatId) return; 
  
  if (data.username !== myUsername) {
    setTypingUsers((prev) => prev.includes(data.username) ? prev : [...prev, data.username]);
  }
};

const handleHideTyping = (data: any) => {
  // 🔥 AÑADIR ESTA LÍNEA AQUÍ TAMBIÉN
  if (data.roomId !== actualChatId) return;
  setTypingUsers((prev) => prev.filter(user => user !== data.username));
};

    socket.on('receive_message', handleReceiveMessage);
    socket.on('display_typing', handleDisplayTyping);
    socket.on('hide_typing', handleHideTyping);

    return () => {
    // 🔥 Avisar al salir de que paramos de escribir
    socket.emit('stop_typing', { roomId: actualChatId, username: myUsername });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    socket.off('receive_message', handleReceiveMessage);
    socket.off('display_typing', handleDisplayTyping);
    socket.off('hide_typing', handleHideTyping);
  };
}, [actualChatId, socket, myUsername]);

  useEffect(() => { scrollToBottom(); }, [messages, typingUsers]);

  const [isTyping, setIsTyping] = useState(false); // Añade este estado arriba

const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const val = e.target.value;
  setMessage(val);
  
  if (val.trim() === '') {
    socket.emit('stop_typing', { roomId: actualChatId, username: myUsername });
    setIsTyping(false); // Reseteamos
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    return;
  }
  
  // 🔥 Solo avisamos al servidor si no estábamos ya escribiendo
  if (!isTyping) {
    socket.emit('typing', { roomId: actualChatId, username: myUsername });
    setIsTyping(true);
  }
  
  if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  typingTimeoutRef.current = setTimeout(() => {
    socket.emit('stop_typing', { roomId: actualChatId, username: myUsername });
    setIsTyping(false); // Volvemos a falso tras 2 segundos
  }, 2000);
};

  const handleSend = () => {
    if (!message.trim()) return;
    
    const msgData = {
      chatId: actualChatId,
      senderName: myUsername,
      text: message.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSystem: false
    };

    socket.emit('send_message', msgData);
    socket.emit('stop_typing', { roomId: actualChatId, username: myUsername });
    setMessage('');
  };

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0B0F19', zIndex: 150, display: 'flex', flexDirection: 'column', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      {/* 1. HEADER */}
      <div style={{ ...ultraGlassStyle, padding: '20px 20px 16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: 0 }}>
            <IoArrowBackOutline size={28} />
          </button>
          <div style={{ width: '42px', height: '42px', borderRadius: chat.type === 'group' ? '12px' : '50%', background: 'rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
            {chat.avatar}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'white' }}>{chat.name}</h2>
            {/* INDICADOR PEQUEÑO ARRIBA */}
            <div style={{ fontSize: '11px', color: typingUsers.length > 0 ? '#00FFCC' : 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: '2px', height: '14px' }}>
              {typingUsers.length > 0 ? (
                <>
                   {chat.type === 'group' ? `${typingUsers[0]} escribiendo` : 'Escribiendo'}
                   <TypingDots />
                </>
              ) : (
                chat.type === 'group' && chat.inviteCode ? `Código: ${chat.inviteCode}` : 'En línea'
              )}
            </div>
          </div>
        </div>
        <button style={{ background: 'rgba(0, 255, 204, 0.15)', border: '1px solid rgba(0,255,204,0.3)', color: '#00FFCC', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <IoMapOutline size={20} />
        </button>
      </div>

      {/* 2. ZONA DE MENSAJES */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {messages.map((msg, index) => {
          const isMe = msg.senderName === myUsername;

          if (msg.isSystem) {
            return (
              <div key={index} style={{ alignSelf: 'center', background: 'rgba(0, 255, 204, 0.1)', border: '1px solid rgba(0, 255, 204, 0.3)', color: '#00FFCC', padding: '12px 16px', borderRadius: '16px', fontSize: '13px', textAlign: 'center', maxWidth: '85%' }}>
                <span style={{ fontWeight: 'bold' }}>🤖 FlockUp:</span> {msg.text}
              </div>
            );
          }

          return (
            <div key={index} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
              {!isMe && chat.type === 'group' && <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', marginLeft: '8px' }}>{msg.senderName}</div>}
              
              {/* 🔥 CONDICIONAL: ¿Es una ruta o un texto normal? */}
              {msg.type === 'route' ? (
                <ConvoyCard 
                  msg={msg} 
                  isMe={isMe} 
                  onJoin={() => onJoinRoute(msg)} // 🔥 AHORA PASAMOS TODO EL MENSAJE
                />
              ) : (
                <div style={{ background: isMe ? '#00FFCC' : 'rgba(255, 255, 255, 0.08)', color: isMe ? '#0B0F19' : 'white', padding: '12px 16px', borderRadius: isMe ? '20px 20px 4px 20px' : '20px 20px 20px 4px', fontSize: '15px', lineHeight: '1.4' }}>
                  {msg.text}
                </div>
              )}
              
              <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', marginTop: '4px', textAlign: isMe ? 'right' : 'left' }}>
                {msg.time}
              </div>
            </div>
          );
        })}
        
        {/* INDICADOR GRANDE DE BURBUJA ABAJO CON ANIMACIÓN */}
        {typingUsers.length > 0 && (
          <div style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.05)', color: '#00FFCC', padding: '10px 16px', borderRadius: '20px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontWeight: '600' }}>
              {chat.type === 'group' ? `${typingUsers.join(', ')} escribiendo` : 'Escribiendo'}
            </span>
            <TypingDots />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. INPUT DE TEXTO */}
      {/* 🔥 NUEVO: MENÚ DESPLEGABLE DE ADJUNTOS */}
      {showAttachMenu && (
        <div style={{ position: 'absolute', bottom: '85px', left: '20px', background: 'rgba(15, 20, 30, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 -10px 40px rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)', zIndex: 20 }}>
          
          <button 
            onClick={() => { setShowAttachMenu(false); onCreateRoute(); }} 
            style={{ background: 'rgba(0, 255, 204, 0.1)', color: '#00FFCC', border: '1px solid rgba(0,255,204,0.3)', padding: '12px 16px', borderRadius: '12px', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', textAlign: 'left' }}
          >
            <IoMapOutline size={20} /> Planear Ruta
          </button>
          
          <button style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: 'none', padding: '12px 16px', borderRadius: '12px', fontSize: '14px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'not-allowed', textAlign: 'left' }}>
            <span style={{ fontSize: '20px' }}>📷</span> Galería (Pronto)
          </button>
        </div>
      )}

      {/* 3. INPUT DE TEXTO */}
      <div style={{ padding: '16px 20px', background: 'rgba(11, 15, 25, 0.9)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '12px', zIndex: 10 }}>
        
        <button 
          onClick={() => setShowAttachMenu(!showAttachMenu)} 
          style={{ background: showAttachMenu ? '#00FFCC' : 'rgba(255, 255, 255, 0.05)', border: 'none', borderRadius: '50%', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: showAttachMenu ? '#0B0F19' : '#00FFCC', cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s' }}
        >
          <IoAddOutline size={24} style={{ transform: showAttachMenu ? 'rotate(45deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
        </button>

        <input type="text" placeholder="Escribe un mensaje..." value={message} onChange={handleInputChange} onKeyDown={(e) => e.key === 'Enter' && handleSend()} style={{ flex: 1, background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'white', padding: '14px 20px', borderRadius: '24px', outline: 'none', fontSize: '15px' }} />
        
        <button onClick={handleSend} style={{ background: message.trim() ? '#00FFCC' : 'rgba(255, 255, 255, 0.05)', border: 'none', borderRadius: '50%', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: message.trim() ? '#0B0F19' : 'rgba(255,255,255,0.3)', cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s' }}>
          <IoSendOutline size={20} style={{ marginLeft: '2px' }} />
        </button>
      </div>
    </div>
  );
}
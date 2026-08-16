import { useState, useEffect } from 'react';
import MapScreen from './screens/MapScreen'; 
import SocialScreen from './screens/SocialScreen';
import BottomNav from './components/BottomNav';
import AuthModal from './components/AuthModal';
import GarageScreen from './screens/GarageScreen';

export default function App() {
  const [activeTab, setActiveTab] = useState<'radar' | 'social' | 'routes' | 'profile'>('radar');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);  
  
  // 🔥 NUEVO: Estado para guardar la ruta compartida que recibes del chat
  const [incomingRoute, setIncomingRoute] = useState<any>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('flockup_token');
    const savedUsername = localStorage.getItem('flockup_username');
    if (savedToken && savedUsername) {
      setUsername(savedUsername);
    }
  }, []);

  const handleLoginSuccess = (user: string) => {
    setUsername(user);
    setIsAuthOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('flockup_token');
    localStorage.removeItem('flockup_username');
    setUsername(null);
    setActiveTab('radar'); 
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100dvh', overflow: 'hidden', backgroundColor: '#0B0F19' }}>
      
      <main style={{ width: '100%', height: '100%', position: 'relative' }}>
        
        {/* RADAR */}
        <div style={{ display: activeTab === 'radar' ? 'block' : 'none', height: '100%' }}>
          <MapScreen 
            onOpenAuth={() => setIsAuthOpen(true)} 
            username={username} 
            onTravelChange={setIsNavigating} 
            incomingRoute={incomingRoute} // 🔥 Le pasamos la ruta nueva
            onRouteLoaded={() => setIncomingRoute(null)} // 🔥 Limpiamos al cargarla
          />
        </div>
        
        {/* BANDADA (SOCIAL) */}
        <div style={{ display: activeTab === 'social' ? 'block' : 'none', height: '100%' }}>
          <SocialScreen 
            isLoggedIn={!!username} 
            onOpenAuth={() => setIsAuthOpen(true)} 
            onJoinRoute={(route) => {
              setIncomingRoute(route);
              setActiveTab('radar');
            }}
            // 🔥 NUEVO: Te lleva al mapa cuando le das al + en el chat
            onCreateRoute={() => setActiveTab('radar')} 
          />
        </div>

        {/* GARAJE / PERFIL */}
        <div style={{ display: activeTab === 'profile' ? 'block' : 'none', height: '100%' }}>
          <GarageScreen 
            username={username}
            isLoggedIn={!!username}
            onLogout={handleLogout}
            onOpenAuth={() => setIsAuthOpen(true)}
          />
        </div>
      </main>

      {!isNavigating && (
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      )}

      {isAuthOpen && (
        <AuthModal 
          onClose={() => setIsAuthOpen(false)} 
          onLoginSuccess={handleLoginSuccess} 
        />
      )}
    </div>
  );
}
import React, { useState, useRef, useEffect } from 'react';
import Map, { Marker, Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { 
  IoCloseOutline, IoArrowUpOutline, IoArrowDownOutline, IoAddOutline, 
  IoSearchOutline, IoVolumeHighOutline, IoVolumeMuteOutline, IoWarningOutline, 
  IoShareOutline, IoLocationOutline, IoNavigateOutline 
} from 'react-icons/io5';
import { io } from 'socket.io-client';

const mapSocket = io('/', { path: '/socket.io' });

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN; 
const START_POINT = [-3.7038, 40.4168]; 

const getBearing = (start: number[], end: number[]) => {
  const lon1 = start[0] * (Math.PI / 180);
  const lat1 = start[1] * (Math.PI / 180);
  const lon2 = end[0] * (Math.PI / 180);
  const lat2 = end[1] * (Math.PI / 180);
  const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
  return ((Math.atan2(y, x) * (180 / Math.PI)) + 360) % 360;
};

const getDistance = (start: number[], end: number[]) => {
  return Math.sqrt(Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2));
};
// 🔥 1. MAGIA SNAP-TO-ROAD (Debajo de getDistance)
const sqDist = (p1: number[], p2: number[]) => Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2);

const projectPointOnSegment = (p: number[], v: number[], w: number[]) => {
  const l2 = sqDist(v, w);
  if (l2 === 0) return v;
  let t = ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / l2;
  t = Math.max(0, Math.min(1, t));
  return [v[0] + t * (w[0] - v[0]), v[1] + t * (w[1] - v[1])];
};

const snapToRoute = (gpsPoint: number[], routeCoords: number[][]) => {
  let minDist = Infinity;
  let snappedPoint = gpsPoint;
  let snappedBearing = null;

  for (let i = 0; i < routeCoords.length - 1; i++) {
    const start = routeCoords[i];
    const end = routeCoords[i + 1];
    const projected = projectPointOnSegment(gpsPoint, start, end);
    const dist = sqDist(gpsPoint, projected);

    if (dist < minDist) {
      minDist = dist;
      snappedPoint = projected;
      snappedBearing = getBearing(start, end);
    }
  }

  // Si estás a más de ~50 metros de la carretera, te saliste de la ruta. (No hacemos snap)
  if (minDist > 0.0000025) return { coords: gpsPoint, bearing: null };

  return { coords: snappedPoint, bearing: snappedBearing };
};

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h} h y ${m} min` : `${m} min`;
};

const ultraGlassStyle: React.CSSProperties = {
  background: 'rgba(15, 20, 30, 0.85)', borderRadius: '25px',
  backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  boxShadow: `0 12px 46px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.2)`,
  color: 'rgba(255, 255, 255, 0.95)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

interface MapScreenProps {
  onOpenAuth: () => void;
  username: string | null;
  onTravelChange?: (isTraveling: boolean) => void;
  incomingRoute?: any;
  onRouteLoaded?: () => void; 
}

export default function MapScreen({ onOpenAuth, username, onTravelChange, incomingRoute, onRouteLoaded }: MapScreenProps) {
  const [currentLocation, setCurrentLocation] = useState<number[]>(START_POINT);
  const [gpsReady, setGpsReady] = useState(false);
  const [viewState, setViewState] = useState({ 
    longitude: START_POINT[0], latitude: START_POINT[1], zoom: 15, pitch: 45, bearing: 0,
    padding: { top: 0, bottom: 0, left: 0, right: 0 } 
  });
  
  const [mainSearchQuery, setMainSearchQuery] = useState('');
  const [mainSearchResults, setMainSearchResults] = useState<any[]>([]);
  
  const [waypoints, setWaypoints] = useState<Array<{ id: string, name: string, coords: number[] | null }>>([
    { id: 'wp_0', name: '📍 Mi Ubicación', coords: null },
    { id: 'wp_1', name: '', coords: null }
  ]);
  const [activeWaypointIndex, setActiveWaypointIndex] = useState<number | null>(null);
  const [plannerSearchResults, setPlannerSearchResults] = useState<any[]>([]);
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);
  
  const [routeData, setRouteData] = useState<{ geometry: any, duration: number, distance: number } | null>(null);
  
  const [carPosition, setCarPosition] = useState<number[]>(START_POINT);
  
  // 🔥 NUEVO: Diccionario para los amigos del Convoy { "Carlos": { coords, bearing, speed } }
  const [convoyMembers, setConvoyMembers] = useState<Record<string, { coords: number[], bearing: number, speed: number }>>({});
  
  const [isTraveling, setIsTraveling] = useState(false);
  const [activeConvoy, setActiveConvoy] = useState<{ host: string, chatId: string } | null>(null);
  const [userIsExploring, setUserIsExploring] = useState(false);
  const [waypointNotice, setWaypointNotice] = useState<string | null>(null);
  
  const [isMuted, setIsMuted] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);

  const [showShareModal, setShowShareModal] = useState(false);
  const [shareChats, setShareChats] = useState<any[]>([]);

  const mapRef = useRef<any>(null); 
  const userExploringRef = useRef<boolean>(false);
  const autoCenterTimeoutRef = useRef<any>(null);
  const passedWaypointsRef = useRef<Set<string>>(new Set());

  // Refs de estado para el GPS real (así no recreamos el Listener de GPS)
  const isTravelingRef = useRef(isTraveling);
  const activeConvoyRef = useRef(activeConvoy);
  // 🔥 2. AÑADE ESTA REFERENCIA (Debajo de tus otros useRef)
  const routeDataRef = useRef(routeData);
  useEffect(() => { routeDataRef.current = routeData; }, [routeData]);
  
  useEffect(() => { isTravelingRef.current = isTraveling; }, [isTraveling]);
  useEffect(() => { activeConvoyRef.current = activeConvoy; }, [activeConvoy]);

  // 🔥 1. ESCUCHADOR DEL SOCKET PARA PINTAR AMIGOS
  useEffect(() => {
    const handleLocationUpdate = (data: any) => {
      if (data.username !== username) {
        setConvoyMembers(prev => ({
          ...prev,
          [data.username]: { coords: data.coords, bearing: data.bearing, speed: data.speed }
        }));
      }
    };
    mapSocket.on('convoy_location_update', handleLocationUpdate);
    return () => { mapSocket.off('convoy_location_update', handleLocationUpdate); };
  }, [username]);

  // 🔥 2. GPS REAL (Reemplaza a la simulación anterior)
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsReady(true);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const coords = [position.coords.longitude, position.coords.latitude];
        const speed = position.coords.speed ? Math.floor(position.coords.speed * 3.6) : 0; 
        let heading = position.coords.heading || 0; 
        let finalCoords = coords;

        setCurrentLocation(coords);

        if (isTravelingRef.current) {
          
          // ✨ MAGIA: Si tenemos ruta, nos "pegamos" a ella y leemos su dirección
          if (routeDataRef.current && routeDataRef.current.geometry.coordinates) {
            const snap = snapToRoute(coords, routeDataRef.current.geometry.coordinates);
            finalCoords = snap.coords;
            if (snap.bearing !== null) heading = snap.bearing; // Sustituimos la brújula por la carretera
          }

          setCarPosition(finalCoords);
          setCurrentSpeed(speed);

          // Actualizamos cámara (Solo si el usuario no toca la pantalla)
          if (!userExploringRef.current) {
            setViewState(prev => ({
              ...prev,
              longitude: finalCoords[0],
              latitude: finalCoords[1],
              bearing: heading,
              pitch: 60,
              zoom: 17,
              padding: { top: 350, bottom: 0, left: 0, right: 0 },
              transitionDuration: 1000 // ✨ Suaviza el salto de la cámara
            }));
          }

          // Emitimos al convoy
          if (activeConvoyRef.current && username) {
            mapSocket.emit('update_location', {
              roomId: activeConvoyRef.current.chatId,
              username: username,
              coords: finalCoords,
              bearing: heading,
              speed: speed
            });
          }

        } else {
          setViewState(prev => ({ ...prev, longitude: coords[0], latitude: coords[1] }));
        }
        
        setGpsReady(true);
      },
      (error) => {
        console.error("Error GPS:", error);
        setGpsReady(true);
      }, 
      { enableHighAccuracy: true, maximumAge: 0 } // Máxima precisión real-time
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [username]);

  // Si vienes desde el chat pulsando "Unirse"
  useEffect(() => {
    if (incomingRoute && incomingRoute.routeData) {
      setWaypoints(incomingRoute.routeData.waypoints);
      setActiveConvoy({ host: incomingRoute.senderName, chatId: incomingRoute.chatId }); 
      mapSocket.emit('join_room', incomingRoute.chatId); // 🔥 Conectamos al socket room
      calculateFullRoute(incomingRoute.routeData.waypoints);
      if (onRouteLoaded) onRouteLoaded();
    }
  }, [incomingRoute]);

  const handleMainSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setMainSearchQuery(query);
    if (query.length > 2) {
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=4`;
        const response = await fetch(url);
        const data = await response.json();
        setMainSearchResults(data.features);
      } catch (error) { console.error(error); }
    } else { setMainSearchResults([]); }
  };

  const selectMainSearchResult = (feature: any) => {
    const coords = feature.center;
    const newWaypoints = [
      { id: 'wp_0', name: '📍 Mi Ubicación', coords: null },
      { id: 'wp_1', name: feature.place_name, coords: coords }
    ];
    setWaypoints(newWaypoints);
    setMainSearchQuery('');
    setMainSearchResults([]);
    setIsPlannerOpen(false); 
    calculateFullRoute(newWaypoints);
  };

  const handlePlannerSearch = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const query = e.target.value;
    const newWaypoints = [...waypoints];
    newWaypoints[index].name = query;
    newWaypoints[index].coords = null; 
    setWaypoints(newWaypoints);
    setActiveWaypointIndex(index);
    setRouteData(null); 
    if (query.length > 2) {
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=4`;
        const response = await fetch(url);
        const data = await response.json();
        setPlannerSearchResults(data.features);
      } catch (error) { console.error(error); }
    } else { setPlannerSearchResults([]); }
  };

  const selectMyLocation = () => {
    if (activeWaypointIndex === null) return;
    const isAlreadyUsed = waypoints.some((wp, i) => wp.coords === null && i !== activeWaypointIndex);
    if (isAlreadyUsed) {
      alert('📍 Ya estás usando tu ubicación en otra parte de la ruta.');
      return;
    }
    const newWaypoints = [...waypoints];
    newWaypoints[activeWaypointIndex].name = '📍 Mi Ubicación';
    newWaypoints[activeWaypointIndex].coords = null; 
    setWaypoints(newWaypoints);
    setPlannerSearchResults([]);
    setActiveWaypointIndex(null);
    setIsPlannerOpen(false); 
    calculateFullRoute(newWaypoints);
  };

  const selectPlannerSearchResult = (feature: any) => {
    if (activeWaypointIndex === null) return;
    const coords = feature.center;
    const newWaypoints = [...waypoints];
    newWaypoints[activeWaypointIndex].name = feature.place_name;
    newWaypoints[activeWaypointIndex].coords = coords;
    setWaypoints(newWaypoints);
    setPlannerSearchResults([]);
    setActiveWaypointIndex(null);
    setIsPlannerOpen(false); 
    calculateFullRoute(newWaypoints);
  };

  const addWaypoint = () => setWaypoints(prev => [...prev, { id: `wp_${Date.now()}`, name: '', coords: null }]);

  const removeWaypoint = (index: number) => {
    if (waypoints.length <= 2) return;
    const newWaypoints = waypoints.filter((_, i) => i !== index);
    setWaypoints(newWaypoints);
    calculateFullRoute(newWaypoints);
  };

  const moveWaypoint = (index: number, direction: 'up' | 'down') => {
    const newWaypoints = [...waypoints];
    if (direction === 'up' && index > 0) {
      [newWaypoints[index - 1], newWaypoints[index]] = [newWaypoints[index], newWaypoints[index - 1]];
    } else if (direction === 'down' && index < newWaypoints.length - 1) {
      [newWaypoints[index + 1], newWaypoints[index]] = [newWaypoints[index], newWaypoints[index + 1]];
    }
    setWaypoints(newWaypoints);
    calculateFullRoute(newWaypoints);
  };

  const calculateFullRoute = (currentWaypoints: any[]) => {
    const validPoints = currentWaypoints.map((wp) => wp.coords === null ? currentLocation : wp.coords);
    if (validPoints.length >= 2 && currentWaypoints[currentWaypoints.length - 1].name !== '') {
      getRoute(validPoints);
    } else {
      setRouteData(null);
    }
  };

  const getRoute = async (points: number[][]) => {
    try {
      const coordsString = points.map(p => `${p[0]},${p[1]}`).join(';');
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsString}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.code === 'NoRoute') { alert('📍 No hay carreteras viables.'); return; }
      
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        setRouteData({
          geometry: route.geometry,
          duration: route.duration,
          distance: route.distance
        });

        if (mapRef.current) {
          const coords = route.geometry.coordinates;
          const bounds = coords.reduce((acc: any, coord: any) => {
            return [
              [Math.min(acc[0][0], coord[0]), Math.min(acc[0][1], coord[1])], 
              [Math.max(acc[1][0], coord[0]), Math.max(acc[1][1], coord[1])]  
            ];
          }, [[coords[0][0], coords[0][1]], [coords[0][0], coords[0][1]]]);

          mapRef.current.fitBounds(bounds, {
            padding: { top: 80, bottom: 380, left: 40, right: 40 }, 
            duration: 1200 
          });
        }
      }
    } catch (error) { console.error(error); }
  };

  const openShareModal = async () => {
    if (!username) { alert('Debes iniciar sesión para compartir en la bandada.'); onOpenAuth(); return; }
    setShowShareModal(true);
    try {
      const token = localStorage.getItem('flockup_token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/social/my-chats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setShareChats(data);
      }
    } catch (error) { console.error(error); }
  };

  const shareToChat = (chat: any) => {
    const actualChatId = chat.type === 'direct' ? [username, chat.name].sort().join('_') : chat.id;
    const msgData = {
      chatId: actualChatId,
      senderName: username,
      type: 'route',
      text: 'Compartiendo ruta',
      routeData: {
        origin: waypoints[0].name,
        destination: waypoints[waypoints.length - 1].name,
        waypoints: waypoints
      },
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSystem: false
    };

    mapSocket.emit('send_message', msgData);
    setShowShareModal(false);
    
    // 🔥 Entramos nosotros mismos a la sala para emitir ubicacion
    setActiveConvoy({ host: username || 'Mí', chatId: actualChatId });
    mapSocket.emit('join_room', actualChatId); 
    
    startTravel(); 
  };

  // 🔥 3. PARAR EL VIAJE
  const stopTravel = () => {
    setIsTraveling(false); 
    onTravelChange?.(false);
    setUserIsExploring(false); 
    userExploringRef.current = false;
    setWaypoints([{ id: 'wp_0', name: '📍 Mi Ubicación', coords: null }, { id: 'wp_1', name: '', coords: null }]);
    setRouteData(null); 
    setIsPlannerOpen(false); 
    setWaypointNotice(null);
    setConvoyMembers({}); // Limpiamos a los amigos
    
    if (autoCenterTimeoutRef.current) clearTimeout(autoCenterTimeoutRef.current);
    
    setViewState(prev => ({ ...prev, zoom: 15, pitch: 0, bearing: 0, padding: { top: 0, bottom: 0, left: 0, right: 0 }, transitionDuration: 0 }));
    setActiveConvoy(null); 
  };

  // 🔥 4. EMPEZAR VIAJE (Sin requestAnimationFrame)
  const startTravel = () => {
    if (!routeData) return;
    setIsTraveling(true); 
    onTravelChange?.(true); 
    setIsPlannerOpen(false); 
    setUserIsExploring(false);
    userExploringRef.current = false;
    passedWaypointsRef.current.clear();
    
    // En cuanto cambie `isTraveling` a true, el `useEffect` del GPS de arriba
    // se encargará él solo de mover el coche con cada coordenada física nueva.
  };

  const handleInteractionStart = () => { if (!isTraveling) return; setUserIsExploring(true); userExploringRef.current = true; if (autoCenterTimeoutRef.current) clearTimeout(autoCenterTimeoutRef.current); };
  const handleInteractionEnd = () => { if (!isTraveling) return; autoCenterTimeoutRef.current = setTimeout(() => forceCenterCamera(), 4000); };
  const forceCenterCamera = () => { setUserIsExploring(false); userExploringRef.current = false; };

  if (!gpsReady) return <div style={{ width: '100%', height: '100%', backgroundColor: '#0B0D14', color: '#00FFCC', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Conectando GPS...</div>;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', backgroundColor: '#0B0F19' }}>
      
      <Map ref={mapRef} {...viewState} onMove={evt => setViewState(evt.viewState)} onDragStart={handleInteractionStart} onDragEnd={handleInteractionEnd} onZoomStart={handleInteractionStart} onZoomEnd={handleInteractionEnd} mapStyle="mapbox://styles/mapbox/dark-v11" mapboxAccessToken={MAPBOX_TOKEN} interactive={true}>
        
        {/* 🔥 RENDERIZADO DINÁMICO DE LOS AMIGOS REALES */}
        {Object.entries(convoyMembers).map(([friendName, data]) => (
          <Marker key={friendName} longitude={data.coords[0]} latitude={data.coords[1]}>
            <div style={{ 
              transform: `rotate(${data.bearing - viewState.bearing}deg)`, // Ajustamos para que apunten a su dirección frente a nuestra rotación
              transition: 'transform 0.5s ease, top 1s linear, left 1s linear' // Suaviza los saltos del GPS
            }}>
              <svg width="44" height="44" viewBox="0 0 32 32" fill="none" style={{ filter: 'drop-shadow(0px 8px 12px rgba(176, 38, 255, 0.7))' }}>
                <path d="M16 2L30 30L16 22L2 30L16 2Z" fill="#B026FF" stroke="#FFFFFF" strokeWidth="2.5" strokeLinejoin="round"/>
              </svg>
              <div style={{ 
                position: 'absolute', top: '45px', left: '50%', transform: 'translateX(-50%)', 
                background: 'rgba(0,0,0,0.6)', color: '#B026FF', padding: '2px 8px', 
                borderRadius: '10px', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap'
              }}>
                {friendName}
              </div>
            </div>
          </Marker>
        ))}

        {/* TU COCHE */}
        <Marker longitude={carPosition[0]} latitude={carPosition[1]}>
          {isTraveling ? (
            <svg width="44" height="44" viewBox="0 0 32 32" fill="none" style={{ filter: 'drop-shadow(0px 8px 12px rgba(0,255,204,0.7))' }}>
              <path d="M16 2L30 30L16 22L2 30L16 2Z" fill="#00FFCC" stroke="#FFFFFF" strokeWidth="2.5" strokeLinejoin="round"/>
            </svg>
          ) : (
            <div style={{ fontSize: '32px', filter: 'drop-shadow(0px 6px 10px rgba(0,255,204,0.6))', zIndex: 10 }}>🚘</div>
          )}
        </Marker>

        {waypoints.map((wp, index) => {
          if (!wp.coords || index === 0) return null; 
          return (
            <Marker key={wp.id} longitude={wp.coords[0]} latitude={wp.coords[1]}>
              <div style={{ fontSize: '38px', filter: 'drop-shadow(0px 12px 16px rgba(255,0,85,0.7))', transform: 'translateY(-40%)' }}>📍</div>
            </Marker>
          );
        })}

        {routeData && (
          <Source id="route-source" type="geojson" data={routeData.geometry}>
            <Layer id="route-layer" type="line" layout={{ 'line-join': 'round', 'line-cap': 'round' }} paint={{ 'line-color': '#00FFCC', 'line-width': 7, 'line-opacity': 0.85 }} />
          </Source>
        )}
      </Map>

      {/* --- PANELES DEL MAPA (IGUAL QUE ANTES) --- */}
      {!isTraveling && !isPlannerOpen && !routeData && (
        <div style={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)', width: '92%', maxWidth: '420px', zIndex: 10 }}>
          <div style={{ ...ultraGlassStyle, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <IoSearchOutline size={22} color="rgba(255,255,255,0.6)" />
            <input 
              placeholder="¿A dónde vamos?" 
              value={mainSearchQuery}
              onChange={handleMainSearch}
              style={{ width: '100%', background: 'transparent', border: 'none', color: '#FFFFFF', fontSize: '16px', outline: 'none' }} 
            />
          </div>

          {mainSearchResults.length > 0 && (
            <div style={{ ...ultraGlassStyle, marginTop: '10px', padding: '8px 0', display: 'flex', flexDirection: 'column' }}>
              {mainSearchResults.map((result) => (
                <div key={result.id} onClick={() => selectMainSearchResult(result)} style={{ padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '15px' }} onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                  {result.place_name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PREVISUALIZACIÓN DE RUTA */}
      {!isTraveling && !isPlannerOpen && routeData && (
        <div style={{ position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)', width: '95%', maxWidth: '420px', zIndex: 10, background: 'rgba(15, 20, 30, 0.9)', borderRadius: '24px', padding: '24px', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 -10px 40px rgba(0,0,0,0.5)' }}>
          
          <button onClick={() => { setRouteData(null); setWaypoints([{ id: 'wp_0', name: '📍 Mi Ubicación', coords: null }, { id: 'wp_1', name: '', coords: null }]); }} style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <IoCloseOutline size={20} />
          </button>

          <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', color: '#00FFCC', fontWeight: '800' }}>
            {formatTime(routeData.duration)}
          </h2>
          <p style={{ margin: '0 0 20px 0', color: 'rgba(255,255,255,0.7)', fontSize: '15px' }}>
            {(routeData.distance / 1000).toFixed(1)} km · La ruta más rápida
          </p>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={startTravel} style={{ flex: 1, background: '#00FFCC', color: '#0B0F19', border: 'none', padding: '14px', borderRadius: '16px', fontSize: '16px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}>
              <IoNavigateOutline size={20} /> Iniciar
            </button>
            <button onClick={() => setIsPlannerOpen(true)} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '14px', borderRadius: '16px', fontSize: '15px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}>
              <IoLocationOutline size={18} /> Paradas
            </button>
            <button onClick={openShareModal} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '14px', borderRadius: '16px', fontSize: '15px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}>
              <IoShareOutline size={18} /> Convoy
            </button>
          </div>
        </div>
      )}

      {/* MODAL COMPARTIR RUTA */}
      {showShareModal && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ ...ultraGlassStyle, width: '100%', maxWidth: '380px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '800' }}>Enviar a...</h3>
              <button onClick={() => setShowShareModal(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><IoCloseOutline size={24}/></button>
            </div>
            
            <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {shareChats.length === 0 ? (
                <p style={{ opacity: 0.6, textAlign: 'center' }}>Cargando chats o no hay bandadas disponibles...</p>
              ) : (
                shareChats.map((chat) => (
                  <div key={chat.id} onClick={() => shareToChat(chat)} style={{ display: 'flex', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: chat.type === 'group' ? '12px' : '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '12px', fontSize: '20px' }}>
                      {chat.avatar}
                    </div>
                    <span style={{ fontWeight: '600' }}>{chat.name}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* PLANIFICADOR ABIERTO */}
      {!isTraveling && isPlannerOpen && (
        <div style={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)', width: '92%', maxWidth: '420px', zIndex: 10 }}>
          <div style={{ ...ultraGlassStyle, padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>Planificador</h3>
              <button onClick={() => setIsPlannerOpen(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IoCloseOutline size={20} />
              </button>
            </div>

            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ position: 'absolute', left: '11px', top: '20px', bottom: '20px', width: '2px', background: 'rgba(255,255,255,0.2)', zIndex: 0 }}></div>
              {waypoints.map((wp, index) => (
                <div key={wp.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', zIndex: 1 }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: index === 0 ? 'white' : (index === waypoints.length - 1 ? '#FF0055' : '#00FFCC'), border: '4px solid rgba(15, 20, 30, 0.8)', display: 'flex', flexShrink: 0 }} />
                  <div style={{ flex: 1, background: 'rgba(0,0,0,0.4)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', padding: '0 12px', display: 'flex', alignItems: 'center' }}>
                    <input 
                      placeholder={index === 0 ? 'Punto de partida...' : 'Añadir destino...'}
                      value={wp.name} 
                      onFocus={() => { setActiveWaypointIndex(index); setPlannerSearchResults([]); }}
                      onChange={(e) => handlePlannerSearch(e, index)} 
                      style={{ width: '100%', background: 'transparent', border: 'none', color: '#FFFFFF', fontSize: '15px', outline: 'none', padding: '12px 0' }} 
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {index > 0 && (
                      <button onClick={() => moveWaypoint(index, 'up')} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', color: 'white', width: '30px', height: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <IoArrowUpOutline />
                      </button>
                    )}
                    {index < waypoints.length - 1 && (
                      <button onClick={() => moveWaypoint(index, 'down')} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', color: 'white', width: '30px', height: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <IoArrowDownOutline />
                      </button>
                    )}
                    {waypoints.length > 2 && index !== 0 && (
                      <button onClick={() => removeWaypoint(index)} style={{ background: 'rgba(255,0,85,0.2)', border: 'none', borderRadius: '8px', color: '#FF0055', width: '30px', height: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <IoCloseOutline />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button onClick={addWaypoint} style={{ background: 'transparent', border: '1px dashed rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.7)', padding: '12px', borderRadius: '12px', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '4px' }}>
              <IoAddOutline size={18} /> Añadir Parada
            </button>
          </div>

          {activeWaypointIndex !== null && (
            <div style={{ ...ultraGlassStyle, marginTop: '10px', padding: '8px 0', display: 'flex', flexDirection: 'column' }}>
              {!waypoints.some((wp, i) => wp.coords === null && i !== activeWaypointIndex) && (
                <div onClick={selectMyLocation} style={{ padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#00FFCC', fontSize: '15px', fontWeight: 'bold' }}>
                  📍 Usar mi ubicación actual
                </div>
              )}
              {plannerSearchResults.map((result) => (
                <div key={result.id} onClick={() => selectPlannerSearchResult(result)} style={{ padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '15px' }}>
                  {result.place_name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODO VIAJE ACTIVO - HUD MULTIJUGADOR */}
      {isTraveling && (
        <>
          <div style={{ 
            position: 'absolute', top: 0, left: 0, right: 0, 
            background: activeConvoy 
              ? 'linear-gradient(180deg, rgba(176, 38, 255, 0.95) 0%, rgba(0,0,0,0) 100%)' 
              : 'linear-gradient(180deg, rgba(0, 150, 150, 0.9) 0%, rgba(0,0,0,0) 100%)', 
            padding: '40px 20px 40px 20px', zIndex: 10, transition: 'background 0.5s'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'space-between' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: activeConvoy ? '#B026FF' : '#00FFCC', color: activeConvoy ? 'white' : '#0B0F19', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: activeConvoy ? '0 0 15px #B026FF' : 'none' }}>
                  <IoNavigateOutline size={28} style={{ transform: 'rotate(45deg)' }} />
                </div>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {activeConvoy ? 'Convoy Activo' : 'Ruta en Solitario'}
                  </div>
                  <div style={{ color: 'white', fontSize: '22px', fontWeight: '800', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                    {waypoints[waypoints.length - 1].name.split(',')[0]}
                  </div>
                </div>
              </div>

              {activeConvoy && (
                <div style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '6px', backdropFilter: 'blur(10px)' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00FFCC', boxShadow: '0 0 8px #00FFCC', animation: 'pulse 2s infinite' }}></span>
                  <span style={{ color: 'white', fontSize: '13px', fontWeight: '700' }}>En línea</span>
                </div>
              )}

            </div>
          </div>

          <div style={{ position: 'absolute', bottom: '120px', right: '20px', display: 'flex', flexDirection: 'column', gap: '16px', zIndex: 10 }}>
            <button onClick={() => setIsMuted(!isMuted)} style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(15, 20, 30, 0.8)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)', cursor: 'pointer', boxShadow: '0 8px 16px rgba(0,0,0,0.3)' }}>
              {isMuted ? <IoVolumeMuteOutline size={28} /> : <IoVolumeHighOutline size={28} />}
            </button>
            <button style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(255, 153, 0, 0.8)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)', cursor: 'pointer', boxShadow: '0 8px 16px rgba(0,0,0,0.3)' }}>
              <IoWarningOutline size={28} />
            </button>
            {userIsExploring && (
              <button onClick={forceCenterCamera} style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(0, 255, 204, 0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#0B0F19', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)', cursor: 'pointer', boxShadow: '0 8px 16px rgba(0,255,204,0.3)' }}>
                🎯
              </button>
            )}
          </div>

          <div style={{ position: 'absolute', bottom: '40px', left: '20px', width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(15, 20, 30, 0.9)', border: '3px solid rgba(255,255,255,0.8)', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 10 }}>
            <span style={{ fontSize: '24px', fontWeight: '800', lineHeight: '1' }}>{currentSpeed}</span>
            <span style={{ fontSize: '11px', fontWeight: '600', opacity: 0.7 }}>km/h</span>
          </div>

          <button onClick={stopTravel} style={{ position: 'absolute', bottom: '40px', right: '20px', width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(255, 0, 85, 0.9)', color: 'white', border: '2px solid rgba(255, 255, 255, 0.2)', backdropFilter: 'blur(15px)', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 10px 30px rgba(255, 0, 85, 0.4)', cursor: 'pointer', zIndex: 10 }}>
            <IoCloseOutline size={36} />
          </button>

          {waypointNotice && (
            <div style={{ position: 'absolute', top: '120px', left: '50%', transform: 'translateX(-50%)', padding: '12px 20px', background: 'rgba(0, 255, 204, 0.2)', border: '1px solid #00FFCC', color: '#00FFCC', fontWeight: '600', borderRadius: '50px', backdropFilter: 'blur(10px)' }}>
              {waypointNotice}
            </div>
          )}
        </>
      )}
    </div>
  );
}
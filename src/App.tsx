import { useState, useRef } from 'react';
import Map, { Marker, Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN; 
const START_POINT = [-3.7038, 40.4168]; 

// --- FUNCIONES MATEMÁTICAS ---
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

// --- EL "SANTO GRIAL" DEL GLASSMORPHISM (Adaptado de tu código) ---
const ultraGlassStyle: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.25)',
  borderRadius: '25px',
  backdropFilter: 'blur(15px)',
  WebkitBackdropFilter: 'blur(15px)',
  boxShadow: `
    rgba(0, 0, 0, 0.4) 0px 12px 46px,
    rgba(0, 0, 0, 0.2) 0px 12px 22px,
    inset rgba(255, 255, 255, 0.1) 0px -10px 20px -5px,
    inset rgba(255, 255, 255, 0.4) 0px -1px 1px -1px
  `,
  color: 'rgba(244, 244, 255, 0.95)',
  fontFamily: '"Open Sans", -apple-system, sans-serif',
};

const ultraGlassButtonStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.25)',
  border: 'none',
  borderRadius: '50px',
  padding: '14px 28px',
  fontSize: '16px',
  fontWeight: '600',
  color: '#FFFFFF',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  boxShadow: `
    rgba(0, 0, 0, 0.1) 0px 6px 8px,
    inset rgba(255, 255, 255, 0.2) 0px -10px 20px -5px,
    inset rgba(255, 255, 255, 0.5) 0px -1px 1px -1px
  `,
  transition: 'all 0.3s ease',
  textShadow: '0 1px 2px rgba(0,0,0,0.3)'
};

export default function App() {
  const [viewState, setViewState] = useState({
    longitude: START_POINT[0],
    latitude: START_POINT[1],
    zoom: 13,
    pitch: 45,
    bearing: 0 
  });

  const [destination, setDestination] = useState<number[] | null>(null);
  const [routeData, setRouteData] = useState<any>(null);
  const [carPosition, setCarPosition] = useState<number[]>(START_POINT);
  
  const [isTraveling, setIsTraveling] = useState(false);
  const [userIsExploring, setUserIsExploring] = useState(false);

  const animationRef = useRef<number | null>(null);
  const currentCameraBearingRef = useRef<number>(0); 
  const userExploringRef = useRef<boolean>(false);
  const autoCenterTimeoutRef = useRef<any>(null);

  const onMapClick = async (event: any) => {
    if (isTraveling) return;

    const coords = [event.lngLat.lng, event.lngLat.lat];
    setDestination(coords);
    getRoute(coords);
    setCarPosition(START_POINT);
  };

  const getRoute = async (endCoords: number[]) => {
    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${START_POINT[0]},${START_POINT[1]};${endCoords[0]},${endCoords[1]}?geometries=geojson&access_token=${MAPBOX_TOKEN}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.routes && data.routes.length > 0) setRouteData(data.routes[0].geometry);
    } catch (error) {
      console.error("Error ruta: ", error);
    }
  };

  const handleInteractionStart = () => {
    if (!isTraveling) return;
    setUserIsExploring(true);
    userExploringRef.current = true;
    if (autoCenterTimeoutRef.current) clearTimeout(autoCenterTimeoutRef.current);
  };

  const handleInteractionEnd = () => {
    if (!isTraveling) return;
    autoCenterTimeoutRef.current = setTimeout(() => {
      forceCenterCamera();
    }, 4000);
  };

  const forceCenterCamera = () => {
    setUserIsExploring(false);
    userExploringRef.current = false;
  };

  const stopTravel = () => {
    setIsTraveling(false);
    setUserIsExploring(false);
    userExploringRef.current = false;
    setDestination(null);
    setRouteData(null);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (autoCenterTimeoutRef.current) clearTimeout(autoCenterTimeoutRef.current);
    
    setViewState(prev => ({ ...prev, zoom: 13, pitch: 0, bearing: 0 }));
  };

  const startTravel = () => {
    if (!routeData) return;
    setIsTraveling(true);
    forceCenterCamera();
    
    const coords = routeData.coordinates;
    let currentSegment = 0;
    let progress = 0; 
    const TARGET_SPEED = 0.0001; 

    currentCameraBearingRef.current = viewState.bearing;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    const animate = () => {
      if (currentSegment < coords.length - 1) {
        const start = coords[currentSegment];
        const end = coords[currentSegment + 1];

        if (!start || !end) return;

        const segmentDistance = getDistance(start, end);
        const progressStep = segmentDistance > 0 ? TARGET_SPEED / segmentDistance : 1;

        const currentLon = start[0] + (end[0] - start[0]) * progress;
        const currentLat = start[1] + (end[1] - start[1]) * progress;
        setCarPosition([currentLon, currentLat]);
        
        if (!userExploringRef.current) {
          const targetBearing = getBearing(start, end);
          let currentBearing = currentCameraBearingRef.current;
          let angleDifference = ((targetBearing - currentBearing + 540) % 360) - 180;
          currentBearing = (currentBearing + angleDifference * 0.05 + 360) % 360;
          currentCameraBearingRef.current = currentBearing;

          setViewState({
            longitude: currentLon,
            latitude: currentLat,
            zoom: 17, 
            pitch: 60,
            bearing: currentBearing
          });
        }

        progress += progressStep;
        if (progress >= 1) {
          progress = 0;
          currentSegment++;
        }
        animationRef.current = requestAnimationFrame(animate);
      } else {
        stopTravel();
        alert('¡Has llegado a tu destino!');
      }
    };
    animationRef.current = requestAnimationFrame(animate);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#0B0D14', position: 'relative', overflow: 'hidden' }}>
      <Map
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        onDragStart={handleInteractionStart}
        onDragEnd={handleInteractionEnd}
        onZoomStart={handleInteractionStart}
        onZoomEnd={handleInteractionEnd}
        onClick={onMapClick}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
        interactive={true}
      >
        {/* EL AVATAR DINÁMICO */}
        <Marker longitude={carPosition[0]} latitude={carPosition[1]}>
          {isTraveling ? (
            // Flecha 3D de navegación durante el viaje
            <svg 
              width="44" height="44" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" 
              style={{ filter: 'drop-shadow(0px 8px 12px rgba(0,255,204,0.7))' }}
            >
              <path d="M16 2L30 30L16 22L2 30L16 2Z" fill="#00FFCC" stroke="#FFFFFF" strokeWidth="2.5" strokeLinejoin="round"/>
            </svg>
          ) : (
            // Coche cuando está parado seleccionando ruta
            <div style={{ fontSize: '32px', filter: 'drop-shadow(0px 6px 10px rgba(0,255,204,0.6))' }}>🚘</div>
          )}
        </Marker>

        {/* EL MARCADOR DE DESTINO */}
        {destination && (
          <Marker longitude={destination[0]} latitude={destination[1]}>
            <div style={{ 
              fontSize: '38px', 
              filter: 'drop-shadow(0px 12px 16px rgba(255,0,85,0.7))',
              transform: 'translateY(-40%)' // Para que la punta del pin señale exacto
            }}>📍</div>
          </Marker>
        )}

        {/* Línea de Ruta */}
        {routeData && (
          <Source id="route-source" type="geojson" data={routeData}>
            <Layer 
              id="route-layer" type="line" layout={{ 'line-join': 'round', 'line-cap': 'round' }} 
              paint={{ 'line-color': '#00FFCC', 'line-width': 7, 'line-opacity': 0.85 }} 
            />
          </Source>
        )}
      </Map>

      {/* --- MODO SELECCIÓN --- */}
      {!isTraveling && (
        <>
          {/* Top Search Bar */}
          <div style={{
            ...ultraGlassStyle,
            position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)',
            padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '14px',
            width: '88%', maxWidth: '420px', boxSizing: 'border-box'
          }}>
            <span style={{ fontSize: '18px' }}>🔍</span>
            <input 
              placeholder="¿A dónde vamos?"
              readOnly
              style={{
                background: 'transparent', border: 'none', color: '#FFFFFF',
                fontSize: '16px', fontWeight: '500', width: '100%', outline: 'none',
              }}
            />
          </div>

          {/* Bottom Card */}
          {routeData && (
            <div style={{
              ...ultraGlassStyle,
              position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
              padding: '28px', width: '90%', maxWidth: '400px', display: 'flex',
              flexDirection: 'column', gap: '20px', boxSizing: 'border-box', textAlign: 'center'
            }}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: '400', margin: '0 0 8px 0', letterSpacing: '0.5px' }}>Ruta Encontrada</h2>
                <p style={{ margin: 0, opacity: 0.7, fontSize: '14px' }}>Camino despejado hacia el destino.</p>
              </div>

              <button 
                style={ultraGlassButtonStyle}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.4)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)'}
                onClick={startTravel}
              >
                🚀 Empezar Viaje
              </button>
            </div>
          )}
        </>
      )}

      {/* --- MODO VIAJE ACTIVO --- */}
      {isTraveling && (
        <>
          <div style={{
            ...ultraGlassStyle,
            position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)',
            padding: '16px 24px', width: '88%', maxWidth: '380px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box'
          }}>
            <div>
              <div style={{ fontSize: '12px', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '1px' }}>En Ruta</div>
              <div style={{ fontSize: '20px', fontWeight: '600', marginTop: '4px' }}>Sigue la carretera</div>
            </div>

            <button 
              onClick={stopTravel}
              style={{
                ...ultraGlassButtonStyle,
                background: 'rgba(255, 0, 85, 0.2)',
                color: '#FF0055', padding: '12px', borderRadius: '50%', width: '46px', height: '46px'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 0, 85, 0.4)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 0, 85, 0.2)'}
            >
              ✕
            </button>
          </div>

          {userIsExploring && (
            <button 
              onClick={forceCenterCamera}
              style={{
                ...ultraGlassButtonStyle,
                background: 'rgba(0, 255, 204, 0.2)', color: '#00FFCC',
                position: 'absolute', bottom: 50, left: '50%', transform: 'translateX(-50%)'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0, 255, 204, 0.4)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'rgba(0, 255, 204, 0.2)'}
            >
              🎯 Recentrar
            </button>
          )}
        </>
      )}
    </div>
  );
}
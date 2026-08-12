import { useState } from 'react';
import Map, { Marker, Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Vite utiliza import.meta.env para leer el archivo .env de forma segura
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN; 

// Coordenada inicial simulada (Ej: Tu casa o posición actual en Madrid)
const START_POINT = [-3.7038, 40.4168];

export default function App() {
  const [viewState, setViewState] = useState({
    longitude: START_POINT[0],
    latitude: START_POINT[1],
    zoom: 13,
    pitch: 45
  });

  const [destination, setDestination] = useState<number[] | null>(null);
  const [routeData, setRouteData] = useState<any>(null);

  // 1. Al hacer clic en el mapa, guardamos el destino y calculamos la ruta
  const onMapClick = async (event: any) => {
    const coords = [event.lngLat.lng, event.lngLat.lat];
    setDestination(coords);
    getRoute(coords);
  };

  // 2. Función para preguntar a Mapbox por dónde ir (Directions API)
  const getRoute = async (endCoords: number[]) => {
    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${START_POINT[0]},${START_POINT[1]};${endCoords[0]},${endCoords[1]}?geometries=geojson&access_token=${MAPBOX_TOKEN}`;
      const response = await fetch(url);
      const data = await response.json();
      
      // Guardamos la línea de la ruta que nos devuelve el servidor
      if (data.routes && data.routes.length > 0) {
        setRouteData(data.routes[0].geometry);
      }
    } catch (error) {
      console.error("Error calculando la ruta: ", error);
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#000', position: 'relative' }}>
      <Map
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        onClick={onMapClick}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
      >
        {/* Marcador de Inicio (Tu coche) */}
        <Marker longitude={START_POINT[0]} latitude={START_POINT[1]} color="#00FFCC" />

        {/* Marcador de Destino (Solo aparece si haces clic) */}
        {destination && (
          <Marker longitude={destination[0]} latitude={destination[1]} color="#FF0055" />
        )}

        {/* La línea Neón de la ruta (Solo se dibuja si hay ruta calculada) */}
        {routeData && (
          <Source id="route-source" type="geojson" data={routeData}>
            <Layer 
              id="route-layer" 
              type="line" 
              layout={{ 'line-join': 'round', 'line-cap': 'round' }} 
              paint={{ 'line-color': '#00FFCC', 'line-width': 6, 'line-opacity': 0.8 }} 
            />
          </Source>
        )}
      </Map>

      {/* Interfaz de Usuario Flotante (Glassmorphism básico) */}
      {routeData && (
        <div style={{
          position: 'absolute', bottom: 50, left: '50%', transform: 'translateX(-50%)',
          backgroundColor: 'rgba(11, 19, 38, 0.8)', padding: '20px 40px',
          borderRadius: 30, border: '1px solid rgba(0, 255, 204, 0.3)',
          backdropFilter: 'blur(10px)', color: 'white', fontFamily: 'sans-serif',
          display: 'flex', flexDirection: 'column', alignItems: 'center'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#00FFCC' }}>Ruta Encontrada</h3>
          <button 
            style={{
              backgroundColor: '#00FFCC', color: '#0b1326', border: 'none',
              padding: '12px 24px', borderRadius: 20, fontSize: '16px',
              fontWeight: 'bold', cursor: 'pointer'
            }}
            onClick={() => alert('¡Preparando motor de animación!')}
          >
            Empezar Viaje
          </button>
        </div>
      )}
    </div>
  );
}
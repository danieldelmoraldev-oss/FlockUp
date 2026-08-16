import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // Se actualiza sola cuando subes cambios a Vercel
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'FlockUp',
        short_name: 'FlockUp',
        description: 'Navegador GPS Social y Multijugador',
        theme_color: '#0B0F19', // El color oscuro de tu interfaz
        background_color: '#0B0F19',
        display: 'standalone', // Magia: Oculta la barra del navegador
        orientation: 'portrait', // Bloquea la app en vertical
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/rrhh-pwa/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Los iconos viven en public/ y se copian tal cual. Antes se pedían
      // archivos que no existían en el proyecto.
      includeAssets: ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'IMPREDIMEX — Recursos Humanos',
        short_name: 'RRHH',
        description: 'Directorio de personal, incidencias, capacitación y vacantes — IMPREDIMEX',
        lang: 'es-MX',
        // Colores de la paleta de la suite.
        theme_color: '#003580',
        background_color: '#003580',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/rrhh-pwa/',
        scope: '/rrhh-pwa/',
        icons: [
          {
            // Archivo local. Antes apuntaba a cdn-icons-png.flaticon.com: si ese
            // servicio cambiaba, o el dispositivo estaba sin red al instalar, la
            // aplicación quedaba sin icono.
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
});

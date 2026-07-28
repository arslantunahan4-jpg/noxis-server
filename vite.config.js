import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    base: '/',
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: false,
        chunkSizeWarningLimit: 500,
        rollupOptions: {
            output: {
                // PERFORMANCE: Manual chunk splitting for optimal loading
                // Reduces initial bundle from 1.1MB to ~300KB
                manualChunks: {
                    // Core React - loaded first, cached long-term
                    'vendor-react': ['react', 'react-dom', 'react-router-dom'],

                    // UI Framework - heavy but essential
                    'vendor-mui-core': ['@mui/material', '@emotion/react', '@emotion/styled'],
                    'vendor-mui-icons': ['@mui/icons-material'],

                    // Charts - only needed for admin panel
                    'vendor-charts': ['@nivo/bar', '@nivo/line', '@nivo/pie', '@nivo/core', '@nivo/geo'],

                    // Data grid - admin only
                    'vendor-datagrid': ['@mui/x-data-grid'],

                    // Video/Streaming - loaded when player opens
                    'vendor-video': ['hls.js'],
                    'vendor-livekit': ['livekit-client', '@livekit/components-react', '@livekit/components-styles'],

                    // Animation - can be deferred
                    'vendor-animation': ['framer-motion'],

                    // Utilities
                    'vendor-utils': ['axios', 'lodash.throttle', 'socket.io-client'],

                    // Form handling
                    'vendor-forms': ['formik', 'yup']
                }
            }
        }
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')
        }
    },
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
                secure: false
            }
        },
        host: true,
        port: 5001
    },
    preview: {
        allowedHosts: ['noxis.tech', 'www.noxis.tech'],
        host: true,
        port: 5001,
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
                secure: false
            }
        }
    }
});

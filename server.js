import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Reverse Proxy for HCMUTE API to bypass CORS in production
app.use(
  '/api',
  createProxyMiddleware({
    target: 'https://dangkyapi.hcmute.edu.vn',
    changeOrigin: true,
    secure: false,
    on: {
      proxyReq: (proxyReq, req, res) => {
        proxyReq.setHeader('origin', 'https://dkmh.hcmute.edu.vn');
        proxyReq.setHeader('referer', 'https://dkmh.hcmute.edu.vn/');
      }
    }
  })
);

// Serve static assets from Vite build output
app.use(express.static(path.join(__dirname, 'web-app/dist')));

// SPA Fallback: send index.html for non-file routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'web-app/dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});

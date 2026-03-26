import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

dotenv.config();

// ES Modules directory name polyfill
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ==========================================
// PUBLIC API ROUTES
// ==========================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'Platform API is active', time: new Date() });
});

// ==========================================
// HOTMART WEBHOOK ROUTE
// ==========================================
app.post('/api/webhooks/hotmart', async (req, res) => {
  try {
    // Hotmart Webhook verification
    const hottok = req.headers['x-hotmart-hottok'] || req.query.hottok;
    if (process.env.HOTMART_HOTTOK && hottok !== process.env.HOTMART_HOTTOK) {
      return res.status(401).json({ error: 'Invalid Hotmart Token' });
    }

    // TODO: Process incoming purchase payload
    console.log('Webhook Received:', req.body);
    
    // Always return 200 OK so Hotmart stops retrying
    return res.status(200).json({ status: 'Received' });

  } catch (error) {
    console.error('Webhook Error:', error);
    return res.status(500).json({ error: 'Internal Processing Error' });
  }
});

// ==========================================
// ADMIN DASHBOARD ROUTES
// ==========================================
const adminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const adminPassword = req.headers['x-admin-password'];
  if (!process.env.ADMIN_PASSWORD || adminPassword !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized Access. Invalid Master Password.' });
  }
  next();
};

app.get('/api/admin/ebooks', adminAuth, async (req, res) => {
  try {
    const ebooks = await prisma.ebook.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(ebooks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch eBooks' });
  }
});

app.post('/api/admin/ebooks', adminAuth, async (req, res) => {
  try {
    const { title, author, coverUrl, pdfUrl, salesUrl, hotmartOffer } = req.body;
    const newEbook = await prisma.ebook.create({
      data: { title, author, coverUrl, pdfUrl, salesUrl, hotmartOffer }
    });
    res.json(newEbook);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create eBook' });
  }
});

// ==========================================
// SERVE STATIC PWA
// ==========================================
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  
  // Client side routing fallback
  app.use((req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  console.warn(`[WARN] Static directory not found at ${distPath}. Build the frontend first.`);
}

// ==========================================
// SERVER INITIALIZATION
// ==========================================
app.listen(PORT, () => {
  console.log(`[EbookPro API] Server running centrally on port ${PORT}`);
});

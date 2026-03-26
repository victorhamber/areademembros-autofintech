import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';

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
// FILE UPLOADS (MULTER)
// ==========================================
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    // Sanitize filename to prevent encoding issues
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '');
    cb(null, uniqueSuffix + '-' + safeName);
  }
});
const upload = multer({ storage });

// Serve uploaded files publicly
app.use('/uploads', express.static(uploadDir));

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
    const hottok = req.headers['x-hotmart-hottok'] || req.query.hottok;
    if (process.env.HOTMART_HOTTOK && hottok !== process.env.HOTMART_HOTTOK) {
      return res.status(401).json({ error: 'Invalid Hotmart Token' });
    }
    console.log('Webhook Received:', req.body);
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

app.post('/api/admin/upload', adminAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

app.get('/api/admin/ebooks', adminAuth, async (req, res) => {
  try {
    const ebooks = await prisma.ebook.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(ebooks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch eBooks' });
  }
});

app.post('/api/admin/ebooks', adminAuth, async (req, res) => {
  try {
    const { title, author, coverUrl, pdfUrl, salesUrl, hotmartOffer } = req.body;
    const newEbook = await prisma.ebook.create({
      data: { title, author: author || null, coverUrl, pdfUrl, salesUrl, hotmartOffer }
    });
    res.json(newEbook);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create eBook' });
  }
});

app.put('/api/admin/ebooks/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, author, coverUrl, pdfUrl, salesUrl, hotmartOffer } = req.body;
    const updatedEbook = await prisma.ebook.update({
      where: { id },
      data: { title, author: author || null, coverUrl, pdfUrl, salesUrl, hotmartOffer }
    });
    res.json(updatedEbook);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update eBook' });
  }
});

app.delete('/api/admin/ebooks/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.ebook.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete eBook' });
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

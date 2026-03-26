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
// USER AUTHENTICATION & ACCESS ROUTES
// ==========================================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    let user = await prisma.user.findUnique({ where: { email } });
    
    // First-Time Login Logic: If user exists from Hotmart but has no password yet
    if (user && !user.password) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { password } // In a real app, hash this with bcrypt!
      });
      return res.json({ id: user.id, email: user.email, name: user.name });
    }
    
    // Validate Existing User
    if (user && user.password === password) {
      return res.json({ id: user.id, email: user.email, name: user.name });
    }
    
    // MVP Access: Auto-create user if they don't exist in the system yet.
    if (!user) {
      user = await prisma.user.create({ data: { email, password } });
      return res.json({ id: user.id, email: user.email, name: user.name });
    }

    return res.status(401).json({ error: 'E-mail ou senha incorretos. Acesso negado.' });
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
});

app.get('/api/ebooks/my', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const purchases = await prisma.purchase.findMany({
      where: { userId },
      include: { ebook: true }
    });

    const myBooks = purchases.map(p => ({
      ...p.ebook,
      lastReadAt: p.lastReadAt,
      lastPage: p.lastPage
    }));
    res.json(myBooks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch your library' });
  }
});

// PROFILE
app.get('/api/profile', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

app.put('/api/profile', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { name } = req.body;
    const user = await prisma.user.update({ where: { id: userId }, data: { name } });
    res.json({ id: user.id, email: user.email, name: user.name });
  } catch (error) { res.status(500).json({ error: 'Failed to update profile' }); }
});

app.put('/api/profile/password', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.password !== currentPassword) {
      return res.status(400).json({ error: 'Senha atual incorreta.' });
    }
    await prisma.user.update({ where: { id: userId }, data: { password: newPassword } });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

// READING PROGRESS
app.post('/api/reading-progress', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { ebookId, page } = req.body;
    await prisma.purchase.updateMany({
      where: { userId, ebookId },
      data: { lastReadAt: new Date(), lastPage: page || 1 }
    });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

// HIGHLIGHTS
app.get('/api/highlights/:ebookId', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { ebookId } = req.params;
    const highlights = await prisma.highlight.findMany({
      where: { userId, ebookId },
      orderBy: { createdAt: 'asc' }
    });
    res.json(highlights);
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/highlights', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { ebookId, pageNumber, text, color } = req.body;
    const highlight = await prisma.highlight.create({
      data: { userId, ebookId, pageNumber, text, color: color || 'yellow' }
    });
    res.json(highlight);
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

app.delete('/api/highlights/:id', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    await prisma.highlight.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

// WISHLIST (synced across devices)
app.get('/api/wishlist', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const items = await prisma.wishlist.findMany({ where: { userId }, select: { ebookId: true } });
    res.json(items.map(i => i.ebookId));
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/wishlist/toggle', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { ebookId } = req.body;
    
    const existing = await prisma.wishlist.findUnique({ where: { userId_ebookId: { userId, ebookId } } });
    if (existing) {
      await prisma.wishlist.delete({ where: { id: existing.id } });
      return res.json({ wishlisted: false });
    } else {
      await prisma.wishlist.create({ data: { userId, ebookId } });
      return res.json({ wishlisted: true });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle wishlist' });
  }
});

app.get('/api/ebooks', async (req, res) => {
  try {
    const ebooks = await prisma.ebook.findMany({ 
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        _count: { select: { purchases: true } }
      }
    });
    res.json(ebooks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch catalog' });
  }
});

app.post('/api/webhooks/hotmart', async (req, res) => {
  try {
    const hottok = (req.headers['x-hotmart-hottok'] || req.query.hottok) as string;
    if (process.env.HOTMART_HOTTOK && hottok !== process.env.HOTMART_HOTTOK) {
      await prisma.webhookLog.create({
        data: { event: 'AUTH_FAILED', status: 'rejected', details: 'Invalid hottok token' }
      });
      return res.status(401).json({ error: 'Invalid Hotmart Token' });
    }

    const body = req.body;
    const event = body.event || 'UNKNOWN';
    const buyerEmail = body.data?.buyer?.email?.toLowerCase()?.trim();
    const buyerName = body.data?.buyer?.name || body.data?.buyer?.first_name || null;
    const productId = String(body.data?.product?.id || body.data?.product?.ucode || '');
    const offerCode = body.data?.product?.offer_code || body.data?.purchase?.offer?.code || productId;

    console.log(`[Hotmart Webhook] Event: ${event}, Buyer: ${buyerEmail}, Product: ${productId}, Offer: ${offerCode}`);

    // PURCHASE_APPROVED — Create user + grant access
    if (event === 'PURCHASE_APPROVED' || event === 'PURCHASE_COMPLETE') {
      if (!buyerEmail) {
        await prisma.webhookLog.create({
          data: { event, status: 'error', details: 'Missing buyer email' }
        });
        return res.status(200).json({ status: 'Error: no buyer email' });
      }

      // Find or create user
      let user = await prisma.user.findUnique({ where: { email: buyerEmail } });
      if (!user) {
        user = await prisma.user.create({
          data: { email: buyerEmail, name: buyerName }
        });
      } else if (buyerName && !user.name) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { name: buyerName }
        });
      }

      // Find ebook by hotmartOffer (try offer code, then product ID)
      let ebook = await prisma.ebook.findUnique({ where: { hotmartOffer: offerCode } });
      if (!ebook && productId !== offerCode) {
        ebook = await prisma.ebook.findUnique({ where: { hotmartOffer: productId } });
      }

      if (!ebook) {
        await prisma.webhookLog.create({
          data: { event, buyerEmail, buyerName, productId: offerCode, status: 'error', details: `No ebook found for offer: ${offerCode}` }
        });
        return res.status(200).json({ status: 'No matching ebook' });
      }

      // Grant access (idempotent)
      try {
        await prisma.purchase.create({
          data: { userId: user.id, ebookId: ebook.id }
        });
      } catch (e: any) {
        // Already has access — no problem
        if (!e.message?.includes('Unique constraint')) {
          throw e;
        }
      }

      await prisma.webhookLog.create({
        data: { event, buyerEmail, buyerName, productId: offerCode, status: 'success', details: `Granted access to "${ebook.title}"` }
      });

      console.log(`[Hotmart] ✅ Access granted: ${buyerEmail} -> ${ebook.title}`);
      return res.status(200).json({ status: 'Access granted' });
    }

    // PURCHASE_CANCELED / PURCHASE_REFUNDED — Revoke access
    if (event === 'PURCHASE_CANCELED' || event === 'PURCHASE_REFUNDED' || event === 'PURCHASE_CHARGEBACK') {
      if (buyerEmail) {
        const user = await prisma.user.findUnique({ where: { email: buyerEmail } });
        const ebook = await prisma.ebook.findUnique({ where: { hotmartOffer: offerCode } }) 
                   || (productId !== offerCode ? await prisma.ebook.findUnique({ where: { hotmartOffer: productId } }) : null);

        if (user && ebook) {
          await prisma.purchase.deleteMany({ where: { userId: user.id, ebookId: ebook.id } });
          await prisma.webhookLog.create({
            data: { event, buyerEmail, buyerName, productId: offerCode, status: 'success', details: `Revoked access to "${ebook.title}"` }
          });
          console.log(`[Hotmart] ❌ Access revoked: ${buyerEmail} -> ${ebook.title}`);
        } else {
          await prisma.webhookLog.create({
            data: { event, buyerEmail, buyerName, productId: offerCode, status: 'warning', details: 'User or ebook not found for revocation' }
          });
        }
      }
      return res.status(200).json({ status: 'Processed' });
    }

    // Other events — just log
    await prisma.webhookLog.create({
      data: { event, buyerEmail, buyerName, productId: offerCode, status: 'ignored', details: `Unhandled event type: ${event}` }
    });

    return res.status(200).json({ status: 'Event logged' });
  } catch (error) {
    console.error('[Hotmart Webhook Error]', error);
    await prisma.webhookLog.create({
      data: { event: 'SYSTEM_ERROR', status: 'error', details: String(error) }
    }).catch(() => {});
    return res.status(200).json({ status: 'Internal error logged' });
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

app.get('/api/admin/categories', adminAuth, async (req, res) => {
  try {
    const cats = await prisma.category.findMany({ orderBy: { name: 'asc' } });
    res.json(cats);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/admin/categories', adminAuth, async (req, res) => {
  try {
    const { name } = req.body;
    const cat = await prisma.category.create({ data: { name } });
    res.json(cat);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create Category' });
  }
});

app.post('/api/admin/upload', adminAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// -- USER & ACCESS MANAGEMENT --
app.get('/api/admin/users', adminAuth, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        purchases: { include: { ebook: true } }
      }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/admin/users', adminAuth, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.create({ data: { email, password } });
    res.json(user);
  } catch(error) {
    res.status(400).json({ error: 'Erro. Talvez e-mail já exista.' });
  }
});

app.post('/api/admin/purchases', adminAuth, async (req, res) => {
  try {
    const { userId, ebookId } = req.body;
    const purchase = await prisma.purchase.create({ data: { userId, ebookId } });
    res.json(purchase);
  } catch (error) {
    res.status(400).json({ error: 'Falha ao conceder acesso ou o usuário já o possui.' });
  }
});

app.delete('/api/admin/purchases/:userId/:ebookId', adminAuth, async (req, res) => {
  try {
    const { userId, ebookId } = req.params;
    await prisma.purchase.deleteMany({ where: { userId, ebookId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Falha ao revogar acesso' });
  }
});
// -----------------------------

// -- WEBHOOK LOGS --
app.get('/api/admin/webhook-logs', adminAuth, async (req, res) => {
  try {
    const logs = await prisma.webhookLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch webhook logs' });
  }
});

app.delete('/api/admin/webhook-logs', adminAuth, async (req, res) => {
  try {
    await prisma.webhookLog.deleteMany({});
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear logs' });
  }
});

app.get('/api/admin/ebooks', adminAuth, async (req, res) => {
  try {
    const ebooks = await prisma.ebook.findMany({ 
      orderBy: { createdAt: 'desc' },
      include: { category: true }
    });
    res.json(ebooks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch eBooks' });
  }
});

app.post('/api/admin/ebooks', adminAuth, async (req, res) => {
  try {
    const { title, author, description, coverUrl, pdfUrl, salesUrl, hotmartOffer, categoryId, featuredList } = req.body;
    const newEbook = await prisma.ebook.create({
      data: { title, author: author || null, description: description || null, coverUrl, pdfUrl, salesUrl, hotmartOffer, categoryId: categoryId || null, featuredList: featuredList || null }
    });
    res.json(newEbook);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create eBook' });
  }
});

app.put('/api/admin/ebooks/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, author, description, coverUrl, pdfUrl, salesUrl, hotmartOffer, categoryId, featuredList } = req.body;
    const updatedEbook = await prisma.ebook.update({
      where: { id: String(id) },
      data: { title, author: author || null, description: description || null, coverUrl, pdfUrl, salesUrl, hotmartOffer, categoryId: categoryId || null, featuredList: featuredList || null }
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

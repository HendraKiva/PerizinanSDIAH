import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PengajuanController } from './controllers/pengajuanController';
import { pool } from './db';

dotenv.config();

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'SDI Abu Hurairah Perizinan API Running' });
});

// Master & Statistik
app.get('/api/stats', PengajuanController.getStats);
app.get('/api/jenis-izin', async (req, res) => {
  const result = await pool.query('SELECT * FROM jenis_perizinan ORDER BY id_jenis ASC');
  res.json({ success: true, data: result.rows });
});

// CRUD Pengajuan & Disposisi Otorisator
app.get('/api/pengajuan', PengajuanController.getAllPengajuan);
app.get('/api/pengajuan/:id', PengajuanController.getPengajuanById);
app.post('/api/pengajuan', PengajuanController.createPengajuan);
app.patch('/api/pengajuan/:id/status', PengajuanController.updateStatus);
app.delete('/api/pengajuan/:id', PengajuanController.deletePengajuan);

// Jalankan Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SERVER] Berjalan di port ${PORT}`);
});
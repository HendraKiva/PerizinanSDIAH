import { Request, Response } from 'express';
import { pool } from '../db';

export const PengajuanController = {
  // 1. GET: Ambil statistik ringkasan perizinan
  getStats: async (req: Request, res: Response) => {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) AS total_pengajuan,
          COUNT(*) FILTER (WHERE status_pengajuan IN ('DIAJUKAN', 'VERIFIKASI_BERKAS', 'SURVEI_LAPANGAN')) AS total_pending,
          COUNT(*) FILTER (WHERE status_pengajuan = 'DISETUJUI') AS total_disetujui,
          COUNT(*) FILTER (WHERE status_pengajuan = 'DITOLAK') AS total_ditolak
        FROM pengajuan_izin;
      `;
      const result = await pool.query(statsQuery);
      return res.json({ success: true, data: result.rows[0] });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // 2. GET: Ambil daftar seluruh pengajuan izin (beserta filter status)
  getAllPengajuan: async (req: Request, res: Response) => {
    try {
      const { status, id_pengguna, search } = req.query;
      let query = `
        SELECT 
          p.id_pengajuan,
          p.nomor_registrasi,
          p.nomor_surat_izin,
          p.status_pengajuan,
          p.data_pemohon,
          p.dokumen_lampiran,
          p.catatan_pemohon,
          p.created_at,
          p.updated_at,
          json_build_object(
            'id_pengguna', u.id_pengguna,
            'nama_lengkap', u.nama_lengkap,
            'email', u.email,
            'nomor_identitas', u.nomor_identitas,
            'no_telepon', u.no_telepon,
            'jabatan', u.jabatan,
            'peran', u.peran
          ) AS pengguna,
          json_build_object(
            'id_jenis', j.id_jenis,
            'kode_izin', j.kode_izin,
            'nama_izin', j.nama_izin
          ) AS jenis_perizinan
        FROM pengajuan_izin p
        JOIN pengguna u ON p.id_pengguna = u.id_pengguna
        JOIN jenis_perizinan j ON p.id_jenis = j.id_jenis
        WHERE 1=1
      `;
      const params: any[] = [];

      if (status && status !== 'SEMUA') {
        params.push(status);
        query += ` AND p.status_pengajuan = $${params.length}`;
      }

      if (id_pengguna) {
        params.push(id_pengguna);
        query += ` AND p.id_pengguna = $${params.length}`;
      }

      if (search) {
        params.push(`%${search}%`);
        query += ` AND (
          p.nomor_registrasi ILIKE $${params.length} OR 
          p.data_pemohon->>'nama_guru_pegawai' ILIKE $${params.length} OR
          p.data_pemohon->>'nuptk_nip' ILIKE $${params.length}
        )`;
      }

      query += ` ORDER BY p.created_at DESC;`;

      const result = await pool.query(query, params);
      return res.json({ success: true, data: result.rows });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // 3. GET: Ambil detail 1 pengajuan beserta riwayat log persetujuan
  getPengajuanById: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const pengajuanRes = await pool.query(
        `SELECT p.*, 
                json_build_object('id_pengguna', u.id_pengguna, 'nama_lengkap', u.nama_lengkap, 'jabatan', u.jabatan) AS pengguna,
                json_build_object('id_jenis', j.id_jenis, 'nama_izin', j.nama_izin, 'kode_izin', j.kode_izin) AS jenis_perizinan
         FROM pengajuan_izin p
         JOIN pengguna u ON p.id_pengguna = u.id_pengguna
         JOIN jenis_perizinan j ON p.id_jenis = j.id_jenis
         WHERE p.id_pengajuan = $1`,
        [id]
      );

      if (pengajuanRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Data pengajuan tidak ditemukan' });
      }

      const logRes = await pool.query(
        `SELECT l.*, u.nama_lengkap AS nama_petugas, u.jabatan AS jabatan_petugas
         FROM log_status l
         LEFT JOIN pengguna u ON l.id_petugas = u.id_pengguna
         WHERE l.id_pengajuan = $1
         ORDER BY l.waktu_perubahan DESC`,
        [id]
      );

      return res.json({
        success: true,
        data: {
          ...pengajuanRes.rows[0],
          riwayat_log: logRes.rows,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // 4. POST: Guru mengajukan permohonan izin baru
  createPengajuan: async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { id_pengguna, id_jenis, data_pemohon, dokumen_lampiran, catatan_pemohon } = req.body;

      if (!id_pengguna || !id_jenis || !data_pemohon) {
        return res.status(400).json({ success: false, message: 'Data formulir tidak lengkap' });
      }

      // Generate Nomor Registrasi Otomatis (REG-SDIAH-YYYYMMDD-XXX)
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      const nomorRegistrasi = `REG-SDIAH-${dateStr}-${randomSuffix}`;

      const insertPengajuanQuery = `
        INSERT INTO pengajuan_izin 
          (nomor_registrasi, id_pengguna, id_jenis, status_pengajuan, data_pemohon, dokumen_lampiran, catatan_pemohon)
        VALUES 
          ($1, $2, $3, 'DIAJUKAN', $4, $5, $6)
        RETURNING *;
      `;
      const pengajuanResult = await client.query(insertPengajuanQuery, [
        nomorRegistrasi,
        id_pengguna,
        id_jenis,
        JSON.stringify(data_pemohon),
        JSON.stringify(dokumen_lampiran || []),
        catatan_pemohon || null,
      ]);

      const newPengajuan = pengajuanResult.rows[0];

      // Catat Log Status Awal
      await client.query(
        `INSERT INTO log_status (id_pengajuan, status_sebelumnya, status_baru, id_petugas, keterangan)
         VALUES ($1, NULL, 'DIAJUKAN', $2, 'Permohonan izin diajukan oleh guru melalui aplikasi.')`,
        [newPengajuan.id_pengajuan, id_pengguna]
      );

      await client.query('COMMIT');
      return res.status(201).json({
        success: true,
        message: 'Permohonan izin berhasil diajukan dan masuk antrean Kepala Sekolah.',
        data: newPengajuan,
      });
    } catch (error: any) {
      await client.query('ROLLBACK');
      return res.status(500).json({ success: false, message: error.message });
    } finally {
      client.release();
    }
  },

  // 5. PATCH: Otorisator (Kepala Sekolah / Admin Yayasan) Mengubah Status (SETUJUI / TOLAK)
  updateStatus: async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { id } = req.params;
      const { status_baru, id_petugas, keterangan, nomor_surat_izin } = req.body;

      if (!status_baru || !id_petugas) {
        return res.status(400).json({ success: false, message: 'Status baru dan ID petugas wajib diisi' });
      }

      // Cek data saat ini
      const checkRes = await client.query('SELECT status_pengajuan, nomor_surat_izin FROM pengajuan_izin WHERE id_pengajuan = $1', [id]);
      if (checkRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan' });
      }

      const statusSebelumnya = checkRes.rows[0].status_pengajuan;
      const finalSkNumber = nomor_surat_izin || checkRes.rows[0].nomor_surat_izin;

      // Update tabel pengajuan_izin
      const updateQuery = `
        UPDATE pengajuan_izin 
        SET status_pengajuan = $1,
            nomor_surat_izin = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id_pengajuan = $3
        RETURNING *;
      `;
      const updateRes = await client.query(updateQuery, [status_baru, finalSkNumber, id]);

      // Catat ke log_status
      await client.query(
        `INSERT INTO log_status (id_pengajuan, status_sebelumnya, status_baru, id_petugas, keterangan)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, statusSebelumnya, status_baru, id_petugas, keterangan || `Status diperbarui menjadi ${status_baru}`]
      );

      await client.query('COMMIT');
      return res.json({
        success: true,
        message: `Status izin berhasil diperbarui menjadi ${status_baru}`,
        data: updateRes.rows[0],
      });
    } catch (error: any) {
      await client.query('ROLLBACK');
      return res.status(500).json({ success: false, message: error.message });
    } finally {
      client.release();
    }
  },

  // 6. DELETE: Hapus Pengajuan Izin
  deletePengajuan: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const deleteRes = await pool.query('DELETE FROM pengajuan_izin WHERE id_pengajuan = $1 RETURNING id_pengajuan', [id]);
      if (deleteRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Data izin tidak ditemukan' });
      }
      return res.json({ success: true, message: 'Permohonan izin berhasil dihapus' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },
};
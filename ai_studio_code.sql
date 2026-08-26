-- TABEL PENGGUNA (Guru, Kepala Sekolah, Admin Yayasan, TU)
CREATE TABLE IF NOT EXISTS pengguna (
    id_pengguna SERIAL PRIMARY KEY,
    nama_lengkap VARCHAR(150) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    kata_sandi_hash VARCHAR(255) NOT NULL,
    nomor_identitas VARCHAR(50), -- NIP / NUPTK
    no_telepon VARCHAR(20),
    peran VARCHAR(30) NOT NULL DEFAULT 'GURU', -- 'GURU', 'KEPALA_SEKOLAH', 'ADMIN_YAYASAN', 'TATA_USAHA'
    jabatan VARCHAR(100),
    status_aktif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TABEL JENIS PERIZINAN
CREATE TABLE IF NOT EXISTS jenis_perizinan (
    id_jenis SERIAL PRIMARY KEY,
    kode_izin VARCHAR(20) UNIQUE NOT NULL,
    nama_izin VARCHAR(100) NOT NULL,
    deskripsi TEXT,
    maksimal_hari_kerja INT DEFAULT 3,
    butuh_lampiran_surat BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TABEL UTAMA PENGAJUAN IZIN
CREATE TABLE IF NOT EXISTS pengajuan_izin (
    id_pengajuan SERIAL PRIMARY KEY,
    nomor_registrasi VARCHAR(50) UNIQUE NOT NULL,
    nomor_surat_izin VARCHAR(100),
    id_pengguna INT NOT NULL REFERENCES pengguna(id_pengguna) ON DELETE CASCADE,
    id_jenis INT NOT NULL REFERENCES jenis_perizinan(id_jenis),
    status_pengajuan VARCHAR(30) NOT NULL DEFAULT 'DIAJUKAN', -- 'DIAJUKAN', 'VERIFIKASI_BERKAS', 'DISETUJUI', 'DITOLAK'
    data_pemohon JSONB NOT NULL,
    dokumen_lampiran JSONB DEFAULT '[]'::jsonb,
    catatan_pemohon TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TABEL AUDIT LOG & DISPOSISI KEPUTUSAN
CREATE TABLE IF NOT EXISTS log_status (
    id_log SERIAL PRIMARY KEY,
    id_pengajuan INT NOT NULL REFERENCES pengajuan_izin(id_pengajuan) ON DELETE CASCADE,
    status_sebelumnya VARCHAR(30),
    status_baru VARCHAR(30) NOT NULL,
    id_petugas INT REFERENCES pengguna(id_pengguna),
    keterangan TEXT,
    waktu_perubahan TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SEED DATA AWAL
INSERT INTO jenis_perizinan (kode_izin, nama_izin, deskripsi, maksimal_hari_kerja, butuh_lampiran_surat) VALUES
('IZN-SKT', 'Izin Sakit Guru / Pegawai', 'Izin ketidakhadiran karena kondisi kesehatan/sakit', 3, TRUE),
('IZN-DNS', 'Izin Dinas Luar & Pelatihan', 'Izin penugasan dinas luar dari sekolah atau Diknas', 7, TRUE),
('IZN-CUT', 'Cuti Tahunan / Melahirkan', 'Hak cuti kerja resmi guru dan pegawai sekolah', 90, TRUE),
('IZN-URG', 'Izin Keperluan Mendesak / Keluarga', 'Izin urusan darurat keluarga atau pernikahan', 2, FALSE)
ON CONFLICT (kode_izin) DO NOTHING;

INSERT INTO pengguna (id_pengguna, nama_lengkap, email, kata_sandi_hash, nomor_identitas, peran, jabatan) VALUES
(1, 'Hendra, S.Pd.', 'kepsek@sdiah-lahat.sch.id', '$2b$10$...', '198205142008011003', 'KEPALA_SEKOLAH', 'Kepala Sekolah SDI Abu Hurairah Lahat'),
(2, 'Pengurus Yayasan Al Afwa', 'yayasan@sdiah-lahat.sch.id', '$2b$10$...', 'YAA-LHT-001', 'ADMIN_YAYASAN', 'Ketua Yayasan Al Afwa Wal Afiah Lahat'),
(7, 'Nia Wulandari, S.Pd. SD', 'nia@sdiah-lahat.sch.id', '$2b$10$...', '198907122013012019', 'GURU', 'Guru Kelas VI')
ON CONFLICT (email) DO NOTHING;
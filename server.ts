import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

// Types
interface Pengguna {
  id_pengguna: number;
  nama_lengkap: string;
  nik: string;
  email: string;
  password_hash: string;
  no_telepon: string;
  alamat: string;
  peran: 'guru_pegawai' | 'pemohon' | 'kepala_sekolah' | 'verifikator' | 'pimpinan_yayasan' | 'kepala_dinas' | 'admin';
  jabatan?: string;
  nuptk_nip?: string;
  kategori_staf?: string;
  fcm_token?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface JenisPerizinan {
  id_jenis: number;
  kode_izin: string;
  nama_izin: string;
  deskripsi: string;
  persyaratan: string[];
  estimasi_hari_kerja: number;
  biaya_retribusi: number;
  masa_berlaku_tahun: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface PengajuanIzin {
  id_pengajuan: number;
  nomor_registrasi: string;
  id_pengguna: number;
  id_jenis: number;
  data_pemohon: Record<string, any>;
  dokumen_lampiran: Array<{
    id_dokumen: string;
    nama_dokumen: string;
    url: string;
    tipe_file: string;
    ukuran_kb?: number;
    uploaded_at: string;
  }>;
  status_pengajuan: string;
  catatan_petugas: string | null;
  nomor_surat_izin: string | null;
  tgl_terbit: string | null;
  tgl_kedaluwarsa: string | null;
  biaya_final: number;
  status_pembayaran: 'BELUM_BAYAR' | 'LUNAS' | 'GRATIS';
  created_at: string;
  updated_at: string;
}

interface LogStatus {
  id_log: number;
  id_pengajuan: number;
  status_sebelumnya: string | null;
  status_baru: string;
  id_petugas: number | null;
  keterangan: string;
  created_at: string;
}

// 37 Dewan Guru & Pegawai SDI Abu Hurairah Lahat
const DAFTAR_GURU_RAW = [
  { nama: 'HENDRA, S.Pd.', jabatan: 'Kepala Sekolah / Guru', kategori: 'Pimpinan', nuptk: '197805122005011002', hp: '081271234001', peran: 'kepala_sekolah' as const },
  { nama: 'APYURI PAREZKA AMA.PUST', jabatan: 'Pustakawan / Tenaga Perpustakaan', kategori: 'Pegawai / Tata Usaha', nuptk: '198902142012012003', hp: '081373456002', peran: 'guru_pegawai' as const },
  { nama: 'EVIANI FRANSISKA S.Pd', jabatan: 'Guru Kelas / Wali Kelas', kategori: 'Guru', nuptk: '198506212009012004', hp: '082181234003', peran: 'guru_pegawai' as const },
  { nama: 'MUTIARA S.Pd', jabatan: 'Guru Kelas / Wali Kelas', kategori: 'Guru', nuptk: '199003182014012005', hp: '085267123004', peran: 'guru_pegawai' as const },
  { nama: 'DINIA ALFAIZAH S.Pd', jabatan: 'Guru Mata Pelajaran', kategori: 'Guru', nuptk: '199211052016012006', hp: '081278901005', peran: 'guru_pegawai' as const },
  { nama: 'RESTI HANDAIANI', jabatan: 'Staf Tata Usaha & Keuangan', kategori: 'Pegawai / Tata Usaha', nuptk: '199307252017012007', hp: '081369012006', peran: 'guru_pegawai' as const },
  { nama: 'NIA WULANDARI S.PD SD', jabatan: 'Guru Kelas SD', kategori: 'Guru', nuptk: '198812102011012008', hp: '082280123007', peran: 'guru_pegawai' as const },
  { nama: 'WIWIN WINDRIANI', jabatan: 'Guru / Tenaga Pendidik', kategori: 'Guru', nuptk: '199104082015012009', hp: '085381234008', peran: 'guru_pegawai' as const },
  { nama: 'AYU ANDIRA', jabatan: 'Guru / Tenaga Pendidik', kategori: 'Guru', nuptk: '199408192018012010', hp: '081273456009', peran: 'guru_pegawai' as const },
  { nama: 'ELIP NURYANA', jabatan: 'Guru / Tenaga Pendidik', kategori: 'Guru', nuptk: '198709302010012011', hp: '081377890010', peran: 'guru_pegawai' as const },
  { nama: 'MERLIN ASNITA S.Sos', jabatan: 'Staf Kepegawaian & Administrasi', kategori: 'Pegawai / Tata Usaha', nuptk: '198603152008012012', hp: '082185678011', peran: 'guru_pegawai' as const },
  { nama: 'TARI CAHYANI, S.Pd.', jabatan: 'Guru Kelas / Wali Kelas', kategori: 'Guru', nuptk: '199205142016012013', hp: '085269012012', peran: 'guru_pegawai' as const },
  { nama: 'ARYANTI RIZKIYAH S.Pd', jabatan: 'Guru Kelas', kategori: 'Guru', nuptk: '199301222017012014', hp: '081279123013', peran: 'guru_pegawai' as const },
  { nama: 'SRI RAHAYU', jabatan: 'Guru / Tenaga Kependidikan', kategori: 'Guru', nuptk: '198910042013012015', hp: '081374567014', peran: 'guru_pegawai' as const },
  { nama: 'RENSI RATNA SARI S.E', jabatan: 'Bendahara Sekolah / Keuangan', kategori: 'Pegawai / Tata Usaha', nuptk: '199008122014012016', hp: '082281234015', peran: 'guru_pegawai' as const },
  { nama: 'HENI SUVIANTI', jabatan: 'Guru Kelas', kategori: 'Guru', nuptk: '198807162012012017', hp: '085382345016', peran: 'guru_pegawai' as const },
  { nama: 'NURCHENI ASTARA S.Pi', jabatan: 'Guru Mapel IPA / Tematik', kategori: 'Guru', nuptk: '198611282009012018', hp: '081271901017', peran: 'guru_pegawai' as const },
  { nama: 'RANGGA ABDUL BARI', jabatan: 'Guru Tahfidz & PAI', kategori: 'Guru', nuptk: '199504102019011019', hp: '081378123018', peran: 'guru_pegawai' as const },
  { nama: 'SURNIYATI S.Pd', jabatan: 'Guru Kelas SD', kategori: 'Guru', nuptk: '198402172007012020', hp: '082186789019', peran: 'guru_pegawai' as const },
  { nama: 'RETIA ABILLILA', jabatan: 'Guru / Tenaga Kependidikan', kategori: 'Guru', nuptk: '199412032018012021', hp: '085261234020', peran: 'guru_pegawai' as const },
  { nama: 'CRISMALAYANI S.PD.I', jabatan: 'Guru Pendidikan Agama Islam (PAI)', kategori: 'Guru', nuptk: '198705092010012022', hp: '081272345021', peran: 'guru_pegawai' as const },
  { nama: 'DELLA ARISKA', jabatan: 'Staf Administrasi & Kesiswaan', kategori: 'Pegawai / Tata Usaha', nuptk: '199609142020012023', hp: '081379012022', peran: 'guru_pegawai' as const },
  { nama: 'NORMANSYAH S.Pd', jabatan: 'Guru PJOK / Olahraga & Kesehatan', kategori: 'Guru', nuptk: '198801252011011024', hp: '082282345023', peran: 'guru_pegawai' as const },
  { nama: 'APRIYANI', jabatan: 'Guru / Tenaga Pendidik', kategori: 'Guru', nuptk: '199106182015012025', hp: '085383456024', peran: 'guru_pegawai' as const },
  { nama: 'BETA TIARA SARI, S.SOS', jabatan: 'Staf BK & Tata Usaha', kategori: 'Pegawai / Tata Usaha', nuptk: '199203112016012026', hp: '081273901025', peran: 'guru_pegawai' as const },
  { nama: 'BALQIS SALSABILLA', jabatan: 'Guru Bahasa Arab & Inggris', kategori: 'Guru', nuptk: '199708202021012027', hp: '081371234026', peran: 'guru_pegawai' as const },
  { nama: 'DEWI NURSELA', jabatan: 'Guru Kelas', kategori: 'Guru', nuptk: '199310052017012028', hp: '082187890027', peran: 'guru_pegawai' as const },
  { nama: 'RAMA HIDAYAT', jabatan: 'Operator Sekolah & IT Support', kategori: 'Pegawai / Tata Usaha', nuptk: '199402282018011029', hp: '085262345028', peran: 'admin' as const },
  { nama: 'NOPRIANI, S.PD SD', jabatan: 'Guru Kelas SD', kategori: 'Guru', nuptk: '198511152009012030', hp: '081274567029', peran: 'guru_pegawai' as const },
  { nama: 'MELA AILSA SALSABILLA', jabatan: 'Guru / Tenaga Pendidik', kategori: 'Guru', nuptk: '199806142022012031', hp: '081372345030', peran: 'guru_pegawai' as const },
  { nama: 'IMAM MUTTAQIN S.Sos', jabatan: 'Wakil Kepala Sekolah / Humas', kategori: 'Pimpinan', nuptk: '198308072006011032', hp: '082283456031', peran: 'verifikator' as const },
  { nama: 'EFTA SYATRIANSA', jabatan: 'Staf Sarana & Prasarana', kategori: 'Pegawai / Tata Usaha', nuptk: '199109232015011033', hp: '085384567032', peran: 'guru_pegawai' as const },
  { nama: 'MIKO RAHMAN, S.A.P.', jabatan: 'Kepala Tata Usaha (Ka. TU)', kategori: 'Pegawai / Tata Usaha', nuptk: '198710182010011034', hp: '081275678033', peran: 'verifikator' as const },
  { nama: 'EFFELL HELLEVENT', jabatan: 'Tenaga Kebersihan & Keamanan', kategori: 'Pegawai / Tata Usaha', nuptk: '199005122014011035', hp: '081373901034', peran: 'guru_pegawai' as const },
  { nama: 'AKBAR SAPUTRA', jabatan: 'Guru Pendamping & Ekskul', kategori: 'Guru', nuptk: '199601192020011036', hp: '082188901035', peran: 'guru_pegawai' as const },
  { nama: 'RENNY MELIA SARI, Dipl, Phil, B.A.', jabatan: 'Koordinator Kurikulum & Bahasa', kategori: 'Guru', nuptk: '198904032013012037', hp: '085263456036', peran: 'verifikator' as const },
  { nama: 'RAMA JEA, S.Pd.', jabatan: 'Guru Kelas & Pembina Prestasi', kategori: 'Guru', nuptk: '199308142017011038', hp: '081276789037', peran: 'guru_pegawai' as const },
];

const INITIAL_USERS: Pengguna[] = DAFTAR_GURU_RAW.map((g, idx) => {
  const cleanEmail = g.nama
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\.|\.$/g, '');

  return {
    id_pengguna: idx + 1,
    nama_lengkap: g.nama,
    nik: g.nuptk,
    email: `${cleanEmail}@sdiah-lahat.sch.id`,
    password_hash: `$2b$10$hashedpw${idx + 1}`,
    no_telepon: g.hp,
    alamat: 'Kec. Lahat, Kabupaten Lahat, Sumatera Selatan',
    peran: g.peran,
    jabatan: g.jabatan,
    nuptk_nip: g.nuptk,
    kategori_staf: g.kategori,
    fcm_token: `fcm_sdiah_${idx + 1}_token`,
    is_active: true,
    created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 90 * 86400000).toISOString(),
  };
});

// Add Yayasan Leadership Account
INITIAL_USERS.push({
  id_pengguna: 38,
  nama_lengkap: 'Pengurus Yayasan Al Afwa Wal Afiah',
  nik: '197001012000031001',
  email: 'pengurus@yayasan-alafwawalafiah.org',
  password_hash: '$2b$10$hashedpwYayasan',
  no_telepon: '081173009999',
  alamat: 'Kantor Yayasan Al Afwa Wal Afiah Kabupaten Lahat',
  peran: 'pimpinan_yayasan',
  jabatan: 'Ketua / Pengurus Yayasan',
  kategori_staf: 'Pimpinan',
  nuptk_nip: '197001012000031001',
  fcm_token: 'fcm_yayasan_token',
  is_active: true,
  created_at: new Date(Date.now() - 120 * 86400000).toISOString(),
  updated_at: new Date(Date.now() - 120 * 86400000).toISOString(),
});

const INITIAL_JENIS: JenisPerizinan[] = [
  {
    id_jenis: 1,
    kode_izin: 'IZN-SKT',
    nama_izin: 'Izin Sakit Guru & Pegawai',
    deskripsi: 'Permohonan izin tidak dapat melaksanakan tugas mengajar/piket karena sakit yang memerlukan istirahat atau perawatan medis.',
    persyaratan: [
      'Surat Keterangan Dokter / Klinik / Puskesmas',
      'Informasi Rencana Pembelajaran / Modul Ajar Inval',
      'Konfirmasi ke Guru Piket Harian'
    ],
    estimasi_hari_kerja: 1,
    biaya_retribusi: 0,
    masa_berlaku_tahun: 1,
    is_active: true,
    created_at: new Date(Date.now() - 100 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 100 * 86400000).toISOString(),
  },
  {
    id_jenis: 2,
    kode_izin: 'IZN-PBD',
    nama_izin: 'Izin Keperluan Pribadi / Keluarga Mendesak',
    deskripsi: 'Izin tidak hadir sementara untuk keperluan keluarga penting, musibah, hajatan keluarga inti, atau keperluan pribadi mendesak.',
    persyaratan: [
      'Formulir Permohonan Izin Guru/Pegawai',
      'Pelimpahan Tugas Mengajar / Modul Inval',
      'Persetujuan Rekan Guru Pengganti (Inval)'
    ],
    estimasi_hari_kerja: 1,
    biaya_retribusi: 0,
    masa_berlaku_tahun: 1,
    is_active: true,
    created_at: new Date(Date.now() - 100 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 100 * 86400000).toISOString(),
  },
  {
    id_jenis: 3,
    kode_izin: 'IZN-TGS',
    nama_izin: 'Izin Tugas Kedinasan / Workshop / Pelatihan',
    deskripsi: 'Penugasan luar sekolah untuk menghadiri undangan Diknas, KKG/MGMP, Bimtek Kurikulum Merdeka, Lomba Siswa, atau agenda Yayasan.',
    persyaratan: [
      'Surat Undangan / Surat Tugas Resmi',
      'Lembar Disposisi Kepala Sekolah SDI Abu Hurairah',
      'Materi / Agenda Kegiatan Pelatihan'
    ],
    estimasi_hari_kerja: 1,
    biaya_retribusi: 0,
    masa_berlaku_tahun: 1,
    is_active: true,
    created_at: new Date(Date.now() - 100 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 100 * 86400000).toISOString(),
  },
  {
    id_jenis: 4,
    kode_izin: 'IZN-DSP',
    nama_izin: 'Dispensasi Jam Mengajar / Izin Keluar Sekolah Sementara',
    deskripsi: 'Dispensasi meninggalkan lingkungan sekolah beberapa jam untuk keperluan dinas singkat, administrasi yayasan, atau urusan penting.',
    persyaratan: [
      'Pemberitahuan Guru Piket & Ka. TU',
      'Tugas Mandiri Siswa di Kelas',
      'Konfirmasi Jam Kembali Mengajar'
    ],
    estimasi_hari_kerja: 1,
    biaya_retribusi: 0,
    masa_berlaku_tahun: 1,
    is_active: true,
    created_at: new Date(Date.now() - 100 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 100 * 86400000).toISOString(),
  },
  {
    id_jenis: 5,
    kode_izin: 'IZN-CTI',
    nama_izin: 'Permohonan Cuti Tahunan / Melahirkan / Umroh & Haji',
    deskripsi: 'Cuti resmi bagi pendidik dan tenaga kependidikan mencakup cuti melahirkan, cuti tahunan, ibadah haji/umroh, atau cuti alasan penting.',
    persyaratan: [
      'Surat Permohonan Cuti Tertulis',
      'Rekomendasi Kepala Sekolah SDI Abu Hurairah',
      'Persetujuan Pengurus Yayasan Al Afwa Wal Afiah',
      'Rencana Guru Pengganti (Inval Jangka Panjang)'
    ],
    estimasi_hari_kerja: 3,
    biaya_retribusi: 0,
    masa_berlaku_tahun: 1,
    is_active: true,
    created_at: new Date(Date.now() - 100 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 100 * 86400000).toISOString(),
  }
];

const INITIAL_PENGAJUAN: PengajuanIzin[] = [
  {
    id_pengajuan: 1,
    nomor_registrasi: 'REG-SDIAH-2026-08001',
    id_pengguna: 7, // NIA WULANDARI S.PD SD
    id_jenis: 1, // Izin Sakit
    data_pemohon: {
      nama_guru_pegawai: 'NIA WULANDARI S.PD SD',
      jabatan: 'Guru Kelas SD (Kelas 3B)',
      nuptk_nip: '198812102011012008',
      mata_pelajaran_kelas: 'Tematik & Matematika Kelas 3B',
      alasan_izin: 'Kondisi demam tinggi dan radang tenggorokan, disarankan istirahat dokter 2 hari.',
      tgl_mulai_izin: '2026-08-25',
      tgl_selesai_izin: '2026-08-26',
      durasi_hari: 2,
      guru_pengganti_inval: 'WIWIN WINDRIANI',
      tugas_inval_siswa: 'Mengerjakan LKS Tematik Tema 2 Hal 45-48 dan mewarnai lembar kaligrafi.',
      keterangan_tambahan: 'Surat dokter dari RSUD Lahat telah dilampirkan via sistem.'
    },
    dokumen_lampiran: [
      {
        id_dokumen: 'doc_skt_01',
        nama_dokumen: 'Surat_Keterangan_Dokter_RSUD_Lahat.pdf',
        url: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=600&auto=format&fit=crop&q=60',
        tipe_file: 'application/pdf',
        ukuran_kb: 420,
        uploaded_at: '2026-08-25T07:15:00.000Z',
      },
      {
        id_dokumen: 'doc_rpp_01',
        nama_dokumen: 'Modul_Ajar_Inval_Kelas_3B.pdf',
        url: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=600&auto=format&fit=crop&q=60',
        tipe_file: 'application/pdf',
        ukuran_kb: 890,
        uploaded_at: '2026-08-25T07:20:00.000Z',
      }
    ],
    status_pengajuan: 'VERIFIKASI_BERKAS',
    catatan_petugas: 'Surat dokter dan tugas inval sudah dicek oleh Koordinator Kurikulum. Menunggu tanda tangan digital Kepala Sekolah.',
    nomor_surat_izin: null,
    tgl_terbit: null,
    tgl_kedaluwarsa: null,
    biaya_final: 0,
    status_pembayaran: 'GRATIS',
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 0.5 * 86400000).toISOString(),
  },
  {
    id_pengajuan: 2,
    nomor_registrasi: 'REG-SDIAH-2026-08002',
    id_pengguna: 18, // RANGGA ABDUL BARI
    id_jenis: 3, // Izin Tugas Dinas
    data_pemohon: {
      nama_guru_pegawai: 'RANGGA ABDUL BARI',
      jabatan: 'Guru Tahfidz & PAI',
      nuptk_nip: '199504102019011019',
      mata_pelajaran_kelas: 'Tahfidz Al-Qur\'an Juz 30 & PAI',
      alasan_izin: 'Menghadiri Pelatihan Peningkatan Kompetensi Guru Tahfidz se-Kabupaten Lahat oleh Kemenag.',
      tgl_mulai_izin: '2026-08-27',
      tgl_selesai_izin: '2026-08-28',
      durasi_hari: 2,
      guru_pengganti_inval: 'CRISMALAYANI S.PD.I',
      tugas_inval_siswa: 'Muroja\'ah hafalan Surah An-Naba\' s.d. Abasa didampingi Guru Piket.',
      keterangan_tambahan: 'Undangan resmi Kemenag No: B-142/Kemenag.Lahat/PAI/VIII/2026 terlampir.'
    },
    dokumen_lampiran: [
      {
        id_dokumen: 'doc_und_02',
        nama_dokumen: 'Undangan_Kemenag_Pelatihan_Tahfidz.pdf',
        url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=60',
        tipe_file: 'application/pdf',
        ukuran_kb: 512,
        uploaded_at: '2026-08-24T09:00:00.000Z',
      }
    ],
    status_pengajuan: 'DISETUJUI',
    catatan_petugas: 'Disetujui oleh Kepala Sekolah HENDRA, S.Pd. Surat Tugas & Izin Resmi diterbitkan.',
    nomor_surat_izin: 'SK-IZN/SDIAH-YAA/VIII/2026/014',
    tgl_terbit: '2026-08-25',
    tgl_kedaluwarsa: '2026-08-29',
    biaya_final: 0,
    status_pembayaran: 'GRATIS',
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id_pengajuan: 3,
    nomor_registrasi: 'REG-SDIAH-2026-08003',
    id_pengguna: 11, // MERLIN ASNITA S.Sos
    id_jenis: 4, // Dispensasi Keluar Sementara
    data_pemohon: {
      nama_guru_pegawai: 'MERLIN ASNITA S.Sos',
      jabatan: 'Staf Kepegawaian & Administrasi',
      nuptk_nip: '198603152008012012',
      mata_pelajaran_kelas: 'Tata Usaha / Administrasi Sekolah',
      alasan_izin: 'Koordinasi berkas verifikasi Dapodik dan pelaporan BOS ke Kantor Dinas Pendidikan Kabupaten Lahat (Pukul 09.30 - 13.00 WIB).',
      tgl_mulai_izin: '2026-08-26',
      tgl_selesai_izin: '2026-08-26',
      durasi_hari: 1,
      guru_pengganti_inval: 'RESTI HANDAIANI',
      tugas_inval_siswa: 'Pelayanan administrasi TU diserahkan kepada Sdri. Resti Handaniani.',
      keterangan_tambahan: 'Kembali ke kantor SDI Abu Hurairah pukul 13.15 WIB.'
    },
    dokumen_lampiran: [
      {
        id_dokumen: 'doc_disp_03',
        nama_dokumen: 'Formulir_Dispensasi_Dinas_Lahat.pdf',
        url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600&auto=format&fit=crop&q=60',
        tipe_file: 'application/pdf',
        ukuran_kb: 310,
        uploaded_at: '2026-08-25T08:00:00.000Z',
      }
    ],
    status_pengajuan: 'DIAJUKAN',
    catatan_petugas: 'Pengajuan baru masuk ke antrean verifikasi Ka. TU dan Waka Humas.',
    nomor_surat_izin: null,
    tgl_terbit: null,
    tgl_kedaluwarsa: null,
    biaya_final: 0,
    status_pembayaran: 'GRATIS',
    created_at: new Date(Date.now() - 0.2 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 0.2 * 86400000).toISOString(),
  }
];

const INITIAL_LOGS: LogStatus[] = [
  {
    id_log: 1,
    id_pengajuan: 1,
    status_sebelumnya: null,
    status_baru: 'DIAJUKAN',
    id_petugas: 7,
    keterangan: 'Permohonan Izin Sakit diajukan oleh Ustadzah Nia Wulandari, S.Pd. SD via Aplikasi Mobile SDIAH.',
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id_log: 2,
    id_pengajuan: 1,
    status_sebelumnya: 'DIAJUKAN',
    status_baru: 'VERIFIKASI_BERKAS',
    id_petugas: 36, // Renny Melia Sari (Koordinator Kurikulum)
    keterangan: 'Surat dokter RSUD dan rencana tugas inval telah diverifikasi sesuai kurikulum kelas.',
    created_at: new Date(Date.now() - 0.5 * 86400000).toISOString(),
  },
  {
    id_log: 3,
    id_pengajuan: 2,
    status_sebelumnya: null,
    status_baru: 'DIAJUKAN',
    id_petugas: 18,
    keterangan: 'Permohonan Izin Tugas Dinas Pelatihan Tahfidz Kemenag diajukan oleh Ust. Rangga Abdul Bari.',
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id_log: 4,
    id_pengajuan: 2,
    status_sebelumnya: 'DIAJUKAN',
    status_baru: 'VERIFIKASI_BERKAS',
    id_petugas: 33, // Miko Rahman (Ka TU)
    keterangan: 'Surat undangan resmi dan agenda pelatihan telah diverifikasi oleh bagian Tata Usaha.',
    created_at: new Date(Date.now() - 1.5 * 86400000).toISOString(),
  },
  {
    id_log: 5,
    id_pengajuan: 2,
    status_sebelumnya: 'VERIFIKASI_BERKAS',
    status_baru: 'DISETUJUI',
    id_petugas: 1, // Hendra, S.Pd. (Kepala Sekolah)
    keterangan: 'Kepala Sekolah SDI Abu Hurairah Lahat menyetujui penugasan dan menandatangani Surat Izin & Penugasan Resmi No: SK-IZN/SDIAH-YAA/VIII/2026/014.',
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id_log: 6,
    id_pengajuan: 3,
    status_sebelumnya: null,
    status_baru: 'DIAJUKAN',
    id_petugas: 11,
    keterangan: 'Dispensasi keluar sekolah sementara diajukan oleh Sdri. Merlin Asnita, S.Sos untuk urusan Dapodik di Diknas Lahat.',
    created_at: new Date(Date.now() - 0.2 * 86400000).toISOString(),
  }
];

// Current State
let usersStore: Pengguna[] = JSON.parse(JSON.stringify(INITIAL_USERS));
let jenisStore: JenisPerizinan[] = JSON.parse(JSON.stringify(INITIAL_JENIS));
let pengajuanStore: PengajuanIzin[] = JSON.parse(JSON.stringify(INITIAL_PENGAJUAN));
let logsStore: LogStatus[] = JSON.parse(JSON.stringify(INITIAL_LOGS));

let nextPengajuanId = 4;
let nextLogId = 7;
let nextJenisId = 6;
let nextUserId = 39;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const populatePengajuan = (item: PengajuanIzin) => {
    const user = usersStore.find((u) => u.id_pengguna === item.id_pengguna);
    const jenis = jenisStore.find((j) => j.id_jenis === item.id_jenis);
    const safeUser = user ? { ...user, password_hash: undefined } : undefined;

    return {
      ...item,
      pengguna: safeUser,
      jenis_perizinan: jenis,
    };
  };

  // 1. READ ALL (GET /api/pengajuan)
  app.get('/api/pengajuan', (req: Request, res: Response) => {
    try {
      const { search, status, id_pengguna, id_jenis, page = '1', limit = '15' } = req.query;

      let results = [...pengajuanStore];

      if (status && status !== 'SEMUA') {
        results = results.filter((p) => p.status_pengajuan === status);
      }

      if (id_pengguna) {
        results = results.filter((p) => p.id_pengguna === Number(id_pengguna));
      }

      if (id_jenis) {
        results = results.filter((p) => p.id_jenis === Number(id_jenis));
      }

      if (search && typeof search === 'string') {
        const query = search.toLowerCase().trim();
        results = results.filter((p) => {
          const user = usersStore.find((u) => u.id_pengguna === p.id_pengguna);
          const jenis = jenisStore.find((j) => j.id_jenis === p.id_jenis);
          const namaGuru = p.data_pemohon?.nama_guru_pegawai || p.data_pemohon?.nama_usaha || '';
          const alasan = p.data_pemohon?.alasan_izin || '';
          const noSurat = p.nomor_surat_izin || '';
          const nuptk = p.data_pemohon?.nuptk_nip || '';
          const pengganti = p.data_pemohon?.guru_pengganti_inval || '';

          return (
            p.nomor_registrasi.toLowerCase().includes(query) ||
            namaGuru.toLowerCase().includes(query) ||
            alasan.toLowerCase().includes(query) ||
            noSurat.toLowerCase().includes(query) ||
            nuptk.toLowerCase().includes(query) ||
            pengganti.toLowerCase().includes(query) ||
            (user && user.nama_lengkap.toLowerCase().includes(query)) ||
            (user && user.nik.toLowerCase().includes(query)) ||
            (jenis && jenis.nama_izin.toLowerCase().includes(query)) ||
            (jenis && jenis.kode_izin.toLowerCase().includes(query))
          );
        });
      }

      results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
      const limitNum = Math.max(1, parseInt(limit as string, 10) || 15);
      const total = results.length;
      const totalPages = Math.ceil(total / limitNum) || 1;
      const startIndex = (pageNum - 1) * limitNum;
      const paginatedItems = results.slice(startIndex, startIndex + limitNum).map(populatePengajuan);

      res.status(200).json({
        success: true,
        message: 'Data perizinan guru & pegawai SDI Abu Hurairah Lahat berhasil diambil',
        data: paginatedItems,
        meta: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Gagal mengambil data pengajuan perizinan',
        error: error.message,
      });
    }
  });

  // 2. READ ONE DETAIL (GET /api/pengajuan/:id)
  app.get('/api/pengajuan/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const item = pengajuanStore.find((p) => p.id_pengajuan === id);

      if (!item) {
        return res.status(404).json({
          success: false,
          message: `Pengajuan izin dengan ID ${id} tidak ditemukan`,
        });
      }

      const logs = logsStore
        .filter((l) => l.id_pengajuan === id)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map((log) => {
          const petugas = usersStore.find((u) => u.id_pengguna === log.id_petugas);
          return {
            ...log,
            petugas: petugas ? { ...petugas, password_hash: undefined } : null,
          };
        });

      const fullData = {
        ...populatePengajuan(item),
        logs,
      };

      res.status(200).json({
        success: true,
        message: 'Detail perizinan guru/pegawai berhasil diambil',
        data: fullData,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Gagal mengambil detail perizinan',
        error: error.message,
      });
    }
  });

  // 3. CREATE (POST /api/pengajuan)
  app.post('/api/pengajuan', (req: Request, res: Response) => {
    try {
      const { id_pengguna, id_jenis, data_pemohon, dokumen_lampiran, catatan_pemohon } = req.body;

      if (!id_pengguna || !id_jenis) {
        return res.status(400).json({
          success: false,
          message: 'Field id_pengguna (Guru/Pegawai) dan id_jenis perizinan wajib diisi',
        });
      }

      const user = usersStore.find((u) => u.id_pengguna === Number(id_pengguna));
      if (!user) {
        return res.status(400).json({
          success: false,
          message: `Data Guru/Pegawai dengan ID ${id_pengguna} tidak ditemukan`,
        });
      }

      const jenis = jenisStore.find((j) => j.id_jenis === Number(id_jenis));
      if (!jenis) {
        return res.status(400).json({
          success: false,
          message: `Jenis perizinan dengan ID ${id_jenis} tidak ditemukan`,
        });
      }

      // Generate School Registration No: REG-SDIAH-YYYYMM-XXXX
      const date = new Date();
      const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
      const randomSeq = String(Math.floor(1000 + Math.random() * 9000));
      const nomor_registrasi = `REG-SDIAH-${yearMonth}-${randomSeq}`;

      const nowISO = new Date().toISOString();

      const newPengajuan: PengajuanIzin = {
        id_pengajuan: nextPengajuanId++,
        nomor_registrasi,
        id_pengguna: Number(id_pengguna),
        id_jenis: Number(id_jenis),
        data_pemohon: {
          nama_guru_pegawai: user.nama_lengkap,
          jabatan: user.jabatan || 'Guru / Pegawai',
          nuptk_nip: user.nuptk_nip || user.nik,
          ...data_pemohon,
        },
        dokumen_lampiran: dokumen_lampiran || [],
        status_pengajuan: 'DIAJUKAN',
        catatan_petugas: null,
        nomor_surat_izin: null,
        tgl_terbit: null,
        tgl_kedaluwarsa: null,
        biaya_final: jenis.biaya_retribusi,
        status_pembayaran: 'GRATIS',
        created_at: nowISO,
        updated_at: nowISO,
      };

      pengajuanStore.unshift(newPengajuan);

      const initialLog: LogStatus = {
        id_log: nextLogId++,
        id_pengajuan: newPengajuan.id_pengajuan,
        status_sebelumnya: null,
        status_baru: 'DIAJUKAN',
        id_petugas: Number(id_pengguna),
        keterangan: catatan_pemohon || `Permohonan ${jenis.nama_izin} baru didaftarkan secara online oleh ${user.nama_lengkap}.`,
        created_at: nowISO,
      };
      logsStore.push(initialLog);

      res.status(201).json({
        success: true,
        message: 'Permohonan izin guru/pegawai berhasil didaftarkan ke sistem SDI Abu Hurairah',
        data: populatePengajuan(newPengajuan),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Gagal membuat permohonan izin',
        error: error.message,
      });
    }
  });

  // 4. UPDATE DATA PENGAJUAN (PUT /api/pengajuan/:id)
  app.put('/api/pengajuan/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const index = pengajuanStore.findIndex((p) => p.id_pengajuan === id);

      if (index === -1) {
        return res.status(404).json({
          success: false,
          message: `Pengajuan izin dengan ID ${id} tidak ditemukan`,
        });
      }

      const existing = pengajuanStore[index];
      const { data_pemohon, dokumen_lampiran, catatan_petugas, biaya_final, status_pembayaran } = req.body;

      const updatedItem: PengajuanIzin = {
        ...existing,
        data_pemohon: data_pemohon !== undefined ? { ...existing.data_pemohon, ...data_pemohon } : existing.data_pemohon,
        dokumen_lampiran: dokumen_lampiran !== undefined ? dokumen_lampiran : existing.dokumen_lampiran,
        catatan_petugas: catatan_petugas !== undefined ? catatan_petugas : existing.catatan_petugas,
        biaya_final: biaya_final !== undefined ? Number(biaya_final) : existing.biaya_final,
        status_pembayaran: status_pembayaran !== undefined ? status_pembayaran : existing.status_pembayaran,
        updated_at: new Date().toISOString(),
      };

      pengajuanStore[index] = updatedItem;

      res.status(200).json({
        success: true,
        message: 'Data permohonan izin berhasil diperbarui',
        data: populatePengajuan(updatedItem),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Gagal memperbarui permohonan izin',
        error: error.message,
      });
    }
  });

  // 5. UPDATE STATUS & WORKFLOW (PATCH /api/pengajuan/:id/status)
  app.patch('/api/pengajuan/:id/status', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const index = pengajuanStore.findIndex((p) => p.id_pengajuan === id);

      if (index === -1) {
        return res.status(404).json({
          success: false,
          message: `Pengajuan izin dengan ID ${id} tidak ditemukan`,
        });
      }

      const { status_baru, id_petugas, keterangan, nomor_surat_izin, tgl_terbit, masa_berlaku_tahun } = req.body;

      if (!status_baru) {
        return res.status(400).json({
          success: false,
          message: 'Parameter status_baru wajib disertakan',
        });
      }

      const current = pengajuanStore[index];
      const previousStatus = current.status_pengajuan;
      const nowISO = new Date().toISOString();

      let suratIzinNo = current.nomor_surat_izin;
      let dateTerbit = current.tgl_terbit;
      let dateKedaluwarsa = current.tgl_kedaluwarsa;

      // Auto generate Official School Certificate No if approved
      if (status_baru === 'DISETUJUI') {
        const jenis = jenisStore.find((j) => j.id_jenis === current.id_jenis);
        const kodeIzin = jenis ? jenis.kode_izin : 'IZN';
        const dateNow = new Date();
        const year = dateNow.getFullYear();
        const monthRomawi = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][dateNow.getMonth()];
        const randomNum = String(Math.floor(10 + Math.random() * 90));
        
        suratIzinNo = nomor_surat_izin || `SK-${kodeIzin}/SDIAH-YAA/${monthRomawi}/${year}/${randomNum}`;
        dateTerbit = tgl_terbit || dateNow.toISOString().split('T')[0];

        const validityDays = current.data_pemohon?.durasi_hari || 3;
        const expDate = new Date(dateNow);
        expDate.setDate(expDate.getDate() + validityDays);
        dateKedaluwarsa = expDate.toISOString().split('T')[0];
      }

      const updatedItem: PengajuanIzin = {
        ...current,
        status_pengajuan: status_baru,
        catatan_petugas: keterangan || current.catatan_petugas,
        nomor_surat_izin: suratIzinNo,
        tgl_terbit: dateTerbit,
        tgl_kedaluwarsa: dateKedaluwarsa,
        updated_at: nowISO,
      };

      pengajuanStore[index] = updatedItem;

      const newLog: LogStatus = {
        id_log: nextLogId++,
        id_pengajuan: id,
        status_sebelumnya: previousStatus,
        status_baru,
        id_petugas: id_petugas ? Number(id_petugas) : 1, // Default Kepsek Hendra, S.Pd.
        keterangan: keterangan || `Status izin diubah dari ${previousStatus} menjadi ${status_baru}`,
        created_at: nowISO,
      };
      logsStore.push(newLog);

      res.status(200).json({
        success: true,
        message: `Status permohonan izin berhasil diubah menjadi ${status_baru}`,
        data: {
          pengajuan: populatePengajuan(updatedItem),
          log: newLog,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Gagal memperbarui status permohonan izin',
        error: error.message,
      });
    }
  });

  // 6. DELETE (DELETE /api/pengajuan/:id)
  app.delete('/api/pengajuan/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const index = pengajuanStore.findIndex((p) => p.id_pengajuan === id);

      if (index === -1) {
        return res.status(404).json({
          success: false,
          message: `Pengajuan izin dengan ID ${id} tidak ditemukan`,
        });
      }

      const deletedItem = pengajuanStore[index];
      pengajuanStore.splice(index, 1);
      logsStore = logsStore.filter((l) => l.id_pengajuan !== id);

      res.status(200).json({
        success: true,
        message: `Pengajuan izin ${deletedItem.nomor_registrasi} berhasil dihapus`,
        data: deletedItem,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Gagal menghapus pengajuan izin',
        error: error.message,
      });
    }
  });

  // GET /api/jenis-perizinan
  app.get('/api/jenis-perizinan', (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'Master jenis perizinan sekolah berhasil diambil',
      data: jenisStore,
    });
  });

  // GET /api/pengguna (All 37 Teachers and Staff)
  app.get('/api/pengguna', (_req: Request, res: Response) => {
    const safeUsers = usersStore.map((u) => {
      const { password_hash, ...safe } = u;
      return safe;
    });
    res.status(200).json({
      success: true,
      message: 'Daftar 37 Dewan Guru & Pegawai SDI Abu Hurairah Lahat berhasil diambil',
      data: safeUsers,
    });
  });

  // GET /api/log-status/:id_pengajuan
  app.get('/api/log-status/:id_pengajuan', (req: Request, res: Response) => {
    const id = parseInt(req.params.id_pengajuan, 10);
    const logs = logsStore
      .filter((l) => l.id_pengajuan === id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((log) => {
        const petugas = usersStore.find((u) => u.id_pengguna === log.id_petugas);
        return {
          ...log,
          petugas: petugas ? { ...petugas, password_hash: undefined } : null,
        };
      });

    res.status(200).json({
      success: true,
      message: `Riwayat status izin ID ${id} berhasil diambil`,
      data: logs,
    });
  });

  // GET /api/stats (Summary KPIs for School)
  app.get('/api/stats', (_req: Request, res: Response) => {
    const totalPengajuan = pengajuanStore.length;
    const diajukan = pengajuanStore.filter((p) => p.status_pengajuan === 'DIAJUKAN').length;
    const dalamProses = pengajuanStore.filter((p) => ['VERIFIKASI_BERKAS', 'SURVEI_LAPANGAN', 'MENUNGGU_PEMBAYARAN'].includes(p.status_pengajuan)).length;
    const disetujui = pengajuanStore.filter((p) => p.status_pengajuan === 'DISETUJUI').length;
    const ditolak = pengajuanStore.filter((p) => p.status_pengajuan === 'DITOLAK').length;

    res.status(200).json({
      success: true,
      data: {
        totalPengajuan,
        diajukan,
        dalamProses,
        disetujui,
        ditolak,
        totalRetribusi: 0,
        totalJenisIzin: jenisStore.length,
        totalPengguna: usersStore.length,
      },
    });
  });

  // POST /api/reset-sample-data
  app.post('/api/reset-sample-data', (_req: Request, res: Response) => {
    usersStore = JSON.parse(JSON.stringify(INITIAL_USERS));
    jenisStore = JSON.parse(JSON.stringify(INITIAL_JENIS));
    pengajuanStore = JSON.parse(JSON.stringify(INITIAL_PENGAJUAN));
    logsStore = JSON.parse(JSON.stringify(INITIAL_LOGS));
    nextPengajuanId = 4;
    nextLogId = 7;

    res.status(200).json({
      success: true,
      message: 'Data perizinan SDI Abu Hurairah Lahat telah di-reset ke data awal.',
    });
  });

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'Sistem Perizinan Guru & Pegawai SDI Abu Hurairah Lahat',
      yayasan: 'Yayasan Al Afwa Wal Afiah Kabupaten Lahat',
      timestamp: new Date().toISOString(),
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SDI Abu Hurairah Lahat] Server running on http://localhost:${PORT}`);
  });
}

startServer();

// --- IMPORT MODULES ---
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// --- INISIALISASI ---
const app = express();
const PORT = 3001;

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// --- PASTIKAN FOLDER UPLOADS ADA ---
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// --- KONFIGURASI DATABASE ---
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('Gagal terhubung ke database:', err.message);
    } else {
        console.log('Berhasil terhubung ke SQLite database.');
    }
});

// --- BUAT TABEL-TABEL BARU (VERSI LENGKAP TANPA PLACEHOLDER) ---
db.serialize(() => {
    console.log("Memulai pembuatan tabel...");
    // Tabel Surat Masuk
    db.run(`CREATE TABLE IF NOT EXISTS surat_masuk (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        no_agenda TEXT NOT NULL,
        tgl_terima TEXT NOT NULL,
        no_surat TEXT NOT NULL,
        perihal TEXT NOT NULL,
        asal TEXT NOT NULL,
        file_name TEXT NOT NULL,
        original_name TEXT NOT NULL,
        upload_date TEXT NOT NULL
    )`, (err) => {
        if (err) {
            console.error("Gagal membuat tabel surat_masuk:", err.message);
        } else {
            console.log("Tabel 'surat_masuk' siap.");
        }
    });

    // Tabel Surat Keluar
    db.run(`CREATE TABLE IF NOT EXISTS surat_keluar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        no_agenda TEXT NOT NULL,
        tgl_surat TEXT NOT NULL,
        no_surat TEXT NOT NULL,
        perihal TEXT NOT NULL,
        tujuan TEXT NOT NULL,
        file_name TEXT NOT NULL,
        original_name TEXT NOT NULL,
        upload_date TEXT NOT NULL
    )`, (err) => {
        if (err) {
            console.error("Gagal membuat tabel surat_keluar:", err.message);
        } else {
            console.log("Tabel 'surat_keluar' siap.");
        }
    });

    // Tabel Dokumen Kegiatan
    db.run(`CREATE TABLE IF NOT EXISTS dokumen_kegiatan (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nama_kegiatan TEXT NOT NULL,
        tgl_pelaksanaan TEXT NOT NULL,
        pic TEXT NOT NULL,
        file_name TEXT NOT NULL,
        original_name TEXT NOT NULL,
        upload_date TEXT NOT NULL
    )`, (err) => {
        if (err) {
            console.error("Gagal membuat tabel dokumen_kegiatan:", err.message);
        } else {
            console.log("Tabel 'dokumen_kegiatan' siap.");
        }
    });

    // Tabel Laporan
    db.run(`CREATE TABLE IF NOT EXISTS laporan (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        judul_laporan TEXT NOT NULL,
        periode TEXT NOT NULL,
        file_name TEXT NOT NULL,
        original_name TEXT NOT NULL,
        upload_date TEXT NOT NULL
    )`, (err) => {
        if (err) {
            console.error("Gagal membuat tabel laporan:", err.message);
        } else {
            console.log("Tabel 'laporan' siap.");
        }
    });
    console.log("Proses pembuatan tabel selesai.");
});


// --- KONFIGURASI MULTER ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });


// --- HELPER FUNCTION UNTUK MENANGANI ENDPOINT (VERSI URUTAN BENAR) ---
function createCRUDEndpoints(tableName, uniqueFields, searchableFields) {
    
    // 1. Route untuk Download (paling spesifik)
    app.get(`/api/${tableName}/:id/download`, (req, res) => {
        const id = req.params.id;
        db.get(`SELECT * FROM ${tableName} WHERE id = ?`, [id], (err, doc) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!doc) return res.status(404).json({ error: "Dokumen tidak ditemukan." });
            const filePath = path.join(__dirname, 'uploads', doc.file_name);
            res.setHeader('Content-Disposition', `attachment; filename="${doc.original_name}"`);
            res.download(filePath, doc.original_name, (err) => {
                if (err && !res.headersSent) {
                    res.status(500).json({ error: "Gagal mengunduh file." });
                }
            });
        });
    });

    // 2. Route untuk DELETE
    app.delete(`/api/${tableName}/:id`, (req, res) => {
        const id = req.params.id;
        db.get(`SELECT file_name FROM ${tableName} WHERE id = ?`, [id], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: "Dokumen tidak ditemukan." });
            const filePath = path.join(__dirname, 'uploads', row.file_name);
            db.run(`DELETE FROM ${tableName} WHERE id = ?`, [id], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                fs.unlink(filePath, (err) => console.error("Gagal menghapus file:", err));
                res.json({ message: "Dokumen berhasil dihapus." });
            });
        });
    });

    // 3. Route untuk POST
    app.post(`/api/${tableName}`, upload.single('documentFile'), (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'Tidak ada file yang diunggah.' });
        const { originalname, filename } = req.file;
        const fieldValues = uniqueFields.map(f => req.body[f]);
        const columnNames = [...uniqueFields, 'file_name', 'original_name', 'upload_date'];
        const placeholders = columnNames.map(() => '?').join(', ');
        const sql = `INSERT INTO ${tableName} (${columnNames.join(', ')}) VALUES (${placeholders})`;
        const params = [...fieldValues, filename, originalname, new Date().toISOString()];

        db.run(sql, params, function(err) {
            if (err) {
                console.error(`POST Error on ${tableName}:`, err.message);
                return res.status(500).json({ error: err.message });
            }
            res.json({ id: this.lastID, message: "Dokumen berhasil diunggah!" });
        });
    });

    // 4. Route untuk GET daftar (paling umum)
    app.get(`/api/${tableName}`, (req, res) => {
        const searchTerm = req.query.search || '';
        let sql = `SELECT * FROM ${tableName}`;
        let params = [];

        if (searchTerm) {
            const whereClauses = searchableFields.map(field => `${field} LIKE ?`);
            sql += ` WHERE ${whereClauses.join(' OR ')}`;
            params = searchableFields.map(() => `%${searchTerm}%`);
        }

        sql += ` ORDER BY id DESC`;

        db.all(sql, params, (err, rows) => {
            if (err) {
                console.error(`GET Error on ${tableName}:`, err.message);
                return res.status(500).json({ error: err.message });
            }
            res.json(rows);
        });
    });
}

// --- BUAT SEMUA ENDPOINT (PASTIKAN MENGGUNAKAN UNDERSCORE) ---
createCRUDEndpoints('surat_masuk', ['no_agenda', 'tgl_terima', 'no_surat', 'perihal', 'asal'], ['perihal', 'asal', 'original_name']);
createCRUDEndpoints('surat_keluar', ['no_agenda', 'tgl_surat', 'no_surat', 'perihal', 'tujuan'], ['perihal', 'tujuan', 'original_name']);
createCRUDEndpoints('dokumen_kegiatan', ['nama_kegiatan', 'tgl_pelaksanaan', 'pic'], ['nama_kegiatan', 'pic', 'original_name']);
createCRUDEndpoints('laporan', ['judul_laporan', 'periode'], ['judul_laporan', 'periode', 'original_name']);


// --- START SERVER ---
app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`Server berjalan di http://localhost:${PORT}`);
    console.log(`========================================`);
});
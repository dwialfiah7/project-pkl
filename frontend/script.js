document.addEventListener('DOMContentLoaded', () => {
    const appContent = document.getElementById('app-content');
    const navButtons = document.querySelectorAll('.nav-btn');
    const API_URL = 'http://localhost:3001/api';

    let currentPage = 'surat_masuk'; // PERUBAHAN 1: Gunakan underscore
    let currentDocuments = [];

    // --- DEFINISI STRUKTUR HALAMAN ---
    const pageStructures = {
        // PERUBAHAN 2: Semua key menggunakan underscore
        'surat_masuk': {
            title: 'Arsip Surat Masuk',
            formFields: [
                { name: 'no_agenda', label: 'No. Agenda', type: 'text' },
                { name: 'tgl_terima', label: 'Tanggal Penerimaan', type: 'date' },
                { name: 'no_surat', label: 'Nomor Surat', type: 'text' },
                { name: 'perihal', label: 'Perihal', type: 'text' },
                { name: 'asal', label: 'Asal/Pengirim', type: 'text' },
            ],
            tableHeaders: ['No. Agenda', 'Tgl. Terima', 'No. Surat', 'Perihal', 'Asal', 'File', 'Aksi']
        },
        'surat_keluar': {
            title: 'Arsip Surat Keluar',
            formFields: [
                { name: 'no_agenda', label: 'No. Agenda', type: 'text' },
                { name: 'tgl_surat', label: 'Tanggal Surat', type: 'date' },
                { name: 'no_surat', label: 'Nomor Surat', type: 'text' },
                { name: 'perihal', label: 'Perihal', type: 'text' },
                { name: 'tujuan', label: 'Tujuan', type: 'text' },
            ],
            tableHeaders: ['No. Agenda', 'Tgl. Surat', 'No. Surat', 'Perihal', 'Tujuan', 'File', 'Aksi']
        },
        'dokumen_kegiatan': {
            title: 'Arsip Dokumen Kegiatan',
            formFields: [
                { name: 'nama_kegiatan', label: 'Nama Kegiatan', type: 'text' },
                { name: 'tgl_pelaksanaan', label: 'Tanggal Pelaksanaan', type: 'date' },
                { name: 'pic', label: 'Penanggung Jawab (PIC)', type: 'text' },
            ],
            tableHeaders: ['Nama Kegiatan', 'Tgl. Pelaksanaan', 'PIC', 'File', 'Aksi']
        },
        'laporan': {
            title: 'Arsip Laporan',
            formFields: [
                { name: 'judul_laporan', label: 'Judul Laporan', type: 'text' },
                { name: 'periode', label: 'Periode Laporan', type: 'text' },
            ],
            tableHeaders: ['Judul Laporan', 'Periode', 'File', 'Aksi']
        }
    };

    // --- FUNGSI RENDER HALAMAN (DENGAN PENCARIAN) ---
    function renderPage(pageId) {
        const structure = pageStructures[pageId];
        if (!structure) return;

        let formHTML = `
            <section class="upload-section">
                <h2>Unggah ${structure.title.replace('Arsip ', '')} Baru</h2>
                <form id="upload-form" class="document-form">
                    <div class="form-grid">
                        ${structure.formFields.map(field => `
                            <div class="form-group">
                                <label for="${field.name}">${field.label}</label>
                                <input type="${field.type}" id="${field.name}" name="${field.name}" required>
                            </div>
                        `).join('')}
                        <div class="form-group full-width">
                            <label for="documentFile" class="custom-file-upload">
                                <i class="fas fa-cloud-upload-alt"></i> Pilih File
                            </label>
                            <input id="documentFile" name="documentFile" type="file" required>
                            <span class="file-name"></span>
                        </div>
                    </div>
                    <button type="submit"><i class="fas fa-save"></i> Simpan Dokumen</button>
                </form>
            </section>
        `;

        let tableHTML = `
            <section class="document-list-section">
                <h2>Daftar ${structure.title}</h2>
                <!-- PERUBAHAN 3: Kotak pencarian ditambahkan -->
                <div class="search-box">
                    <i class="fas fa-search"></i>
                    <input type="text" id="search-input" placeholder="Cari dokumen...">
                </div>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                ${structure.tableHeaders.map(header => `<th>${header}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody id="document-tbody">
                            <!-- Baris akan ditambahkan oleh JavaScript -->
                        </tbody>
                    </table>
                </div>
            </section>
        `;

        appContent.innerHTML = formHTML + tableHTML;
        
        attachFormListener(pageId);
        attachSearchListener(pageId); // PERUBAHAN 4: Tambahkan listener pencarian
    }

    // --- FUNGSI RENDER DATA KE TABEL ---
    function renderTable(documents, pageId) {
        const tbody = document.getElementById('document-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        if (documents.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${pageStructures[pageId].tableHeaders.length}">Tidak ada dokumen.</td></tr>`;
            return;
        }

        documents.forEach(doc => {
            const tr = document.createElement('tr');
            let rowData = '';
            const structure = pageStructures[pageId];
            
            structure.tableHeaders.slice(0, -2).forEach(header => {
                const fieldName = header.toLowerCase().replace(' ', '_').replace('.', '');
                rowData += `<td>${doc[fieldName] || '-'}</td>`;
            });

            tr.innerHTML = `
                ${rowData}
                <td><a href="${API_URL}/${pageId}/${doc.id}/download" class="download-link">${doc.original_name}</a></td>
                <td>
                    <button class="delete-btn" data-id="${doc.id}" title="Hapus"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // --- FETCH DATA (DENGAN DUKUNGAN PENCARIAN) ---
    async function fetchDocuments(pageId, searchTerm = '') {
        try {
            const url = searchTerm ? `${API_URL}/${pageId}?search=${encodeURIComponent(searchTerm)}` : `${API_URL}/${pageId}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Gagal mengambil dokumen');
            currentDocuments = await response.json();
            renderTable(currentDocuments, pageId);
        } catch (error) {
            console.error('Error:', error);
            const tbody = document.getElementById('document-tbody');
            if (tbody) tbody.innerHTML = `<tr><td colspan="100%">Gagal memuat data.</td></tr>`;
        }
    }

    // --- EVENT LISTENERS ---
    function attachFormListener(pageId) {
        const form = document.getElementById('upload-form');
        const fileInput = document.getElementById('documentFile');
        const fileNameSpan = document.querySelector('.file-name');

        if (fileInput) {
            fileInput.addEventListener('change', () => {
                fileNameSpan.textContent = fileInput.files.length > 0 ? fileInput.files[0].name : '';
            });
        }

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                
                try {
                    const response = await fetch(`${API_URL}/${pageId}`, {
                        method: 'POST',
                        body: formData,
                    });
                    if (!response.ok) throw new Error('Gagal mengunggah dokumen');
                    
                    form.reset();
                    fileNameSpan.textContent = '';
                    await fetchDocuments(pageId); // Refresh data
                    alert('Dokumen berhasil diunggah!');
                } catch (error) {
                    console.error('Error:', error);
                    alert('Gagal mengunggah file!');
                }
            });
        }
    }

    // PERUBAHAN 5: Tambahkan fungsi listener untuk pencarian
    function attachSearchListener(pageId) {
        const searchInput = document.getElementById('search-input');
        if (!searchInput) return;

        let debounceTimer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            const searchTerm = e.target.value;
            debounceTimer = setTimeout(() => {
                fetchDocuments(pageId, searchTerm);
            }, 300);
        });
    }
    
    appContent.addEventListener('click', async (e) => {
        if (e.target.closest('.delete-btn')) {
            e.preventDefault();
            if (!confirm('Apakah Anda yakin ingin menghapus dokumen ini?')) return;
            
            const btn = e.target.closest('.delete-btn');
            const docId = btn.dataset.id;
            
            try {
                const response = await fetch(`${API_URL}/${currentPage}/${docId}`, { method: 'DELETE' });
                if (!response.ok) throw new Error('Gagal menghapus dokumen');
                await fetchDocuments(currentPage); // Refresh data
            } catch (error) {
                console.error('Error:', error);
                alert('Gagal menghapus dokumen!');
            }
        }
    });

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentPage = btn.dataset.page;
            renderPage(currentPage);
            fetchDocuments(currentPage);
        });
    });

    // --- INISIALISASI ---
    renderPage(currentPage);
    fetchDocuments(currentPage);
});
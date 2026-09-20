document.addEventListener('DOMContentLoaded', () => {
    // --- NAVIGASI TAB ---
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            const tabName = this.getAttribute('data-tab');
            document.querySelectorAll('.tab-content').forEach(content => {
                content.style.display = "none";
                content.classList.remove("active");
            });
            document.querySelectorAll('.tab-btn').forEach(tab => tab.classList.remove("active"));
            
            document.getElementById(tabName).style.display = "block";
            document.getElementById(tabName).classList.add("active");
            e.currentTarget.classList.add("active");

            if (tabName === 'Quran' && document.getElementById('daftar-surah').innerHTML === '') {
                fetchDaftarSurah();
            }
        });
    });

    // --- MODUL ADZAN (LIVE CLOCK & 3 CARDS) ---
    let currentJadwal = null;
    let clockInterval = null;

    document.getElementById('btn-lokasi').addEventListener('click', getLocationAdzan);
    document.getElementById('btn-kota').addEventListener('click', () => {
        const kota = document.getElementById('inputKota').value;
        if(!kota) return alert("Masukkan nama kota!");
        getAdzanByCity(kota);
    });

    async function getLocationAdzan() {
        if (!navigator.geolocation) return alert("Geolocation tidak didukung.");
        const loading = document.getElementById('loading-adzan');
        const hasil = document.getElementById('hasil-adzan');
        
        loading.style.display = 'block';
        loading.innerText = 'Melacak lokasi GPS...';
        hasil.style.display = 'none';

        navigator.geolocation.getCurrentPosition(async (pos) => {
            try {
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;
                const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=id`);
                const geoData = await geoRes.json();
                
                if (!geoData || !geoData.address) throw new Error("Gagal membaca koordinat satelit.");
                const addr = geoData.address;
                let candidates = [addr.city, addr.regency, addr.town, addr.county, addr.municipality, addr.state_district];
                candidates = candidates.filter(Boolean).map(c => c.replace(/Kota |Kabupaten |Kab\. |Regency|City|Administrasi |Kecamatan /ig, '').trim());
                const firstWords = candidates.map(c => c.split(' ')[0]);
                candidates = [...new Set([...candidates, ...firstWords])];
                
                let foundCityId = null;
                let foundCityName = null;
                loading.innerText = 'Mencocokkan database Kemenag...';

                for (let keyword of candidates) {
                    if (!keyword || keyword.length < 3) continue;
                    try {
                        const searchRes = await fetch(`https://api.myquran.com/v2/sholat/kota/cari/${encodeURIComponent(keyword)}`);
                        const searchData = await searchRes.json();
                        if (searchData.status && searchData.data && searchData.data.length > 0) {
                            foundCityId = searchData.data[0].id;
                            foundCityName = searchData.data[0].lokasi;
                            break;
                        }
                    } catch (e) {}
                }
                
                if (!foundCityId) throw new Error(`Kota tidak dikenali. Silakan ketik manual.`);
                
                loading.innerText = 'Mengambil jadwal shalat...';
                const now = new Date();
                const jadwalRes = await fetch(`https://api.myquran.com/v2/sholat/jadwal/${foundCityId}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`);
                const jadwalData = await jadwalRes.json();
                
                document.getElementById('lokasi-text').innerText = `📍 Lokasi GPS: ${foundCityName}`;
                tampilkanJadwalCards(jadwalData.data.jadwal);
                
            } catch(err) {
                loading.style.display = 'none';
                alert(err.message);
            }
        }, () => {
            document.getElementById('loading-adzan').style.display = 'none';
            alert("Izin lokasi ditolak.");
        }, { enableHighAccuracy: true });
    }

    async function getAdzanByCity(cityName) {
        document.getElementById('loading-adzan').style.display = 'block';
        document.getElementById('hasil-adzan').style.display = 'none';
        try {
            const searchRes = await fetch(`https://api.myquran.com/v2/sholat/kota/cari/${encodeURIComponent(cityName)}`);
            const searchData = await searchRes.json();
            if (!searchData.status || searchData.data.length === 0) throw new Error("Kota tidak ditemukan.");
            
            const kotaId = searchData.data[0].id;
            const namaKotaDb = searchData.data[0].lokasi;
            const now = new Date();
            
            const jadwalRes = await fetch(`https://api.myquran.com/v2/sholat/jadwal/${kotaId}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`);
            const jadwalData = await jadwalRes.json();
            
            document.getElementById('lokasi-text').innerText = `📍 Kota: ${namaKotaDb}`;
            tampilkanJadwalCards(jadwalData.data.jadwal);
        } catch (err) {
            alert(err.message);
            document.getElementById('loading-adzan').style.display = 'none';
        }
    }

    function tampilkanJadwalCards(jadwal) {
        currentJadwal = jadwal;
        document.getElementById('loading-adzan').style.display = 'none';
        document.getElementById('hasil-adzan').style.display = 'block';
        
        // Render Card 2 (Wajib)
        const gridWajib = document.getElementById('grid-wajib');
        gridWajib.innerHTML = '';
        const waktuWajib = [
            { id: 'subuh', label: 'Subuh', time: jadwal.subuh },
            { id: 'dzuhur', label: 'Dzuhur', time: jadwal.dzuhur },
            { id: 'ashar', label: 'Ashar', time: jadwal.ashar },
            { id: 'maghrib', label: 'Maghrib', time: jadwal.maghrib },
            { id: 'isya', label: 'Isya', time: jadwal.isya }
        ];
        
        waktuWajib.forEach(w => {
            gridWajib.innerHTML += `<div class="jadwal-item" id="card-${w.id}">
                <small>${w.label}</small>
                <span>${w.time}</span>
            </div>`;
        });

        // Render Card 3 (Sunnah & Lainnya)
        const gridSunnah = document.getElementById('grid-sunnah');
        gridSunnah.innerHTML = '';
        const waktuSunnah = [
            { label: 'Imsak', time: jadwal.imsak, note: 'Batas Sahur' },
            { label: 'Terbit', time: jadwal.terbit, note: 'Syuruq (Dilarang)' },
            { label: 'Dhuha', time: jadwal.dhuha, note: 'Sunnah Dhuha' }
        ];
        
        waktuSunnah.forEach(w => {
            gridSunnah.innerHTML += `<div class="jadwal-item">
                <small>${w.label}</small>
                <span style="color:var(--sunnah-color);">${w.time}</span>
                <small style="font-size:0.65rem;">${w.note}</small>
            </div>`;
        });

        // Jalankan Live Timer
        if(clockInterval) clearInterval(clockInterval);
        clockInterval = setInterval(updateLiveClock, 1000);
        updateLiveClock(); // Eksekusi langsung tanpa delay 1 detik
    }

    function updateLiveClock() {
        const now = new Date();
        
        // Update Waktu & Tanggal
        document.getElementById('live-clock').innerText = 
            `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        document.getElementById('live-date').innerText = 
            new Intl.DateTimeFormat('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(now);

        if(!currentJadwal) return;

        // Reset highlight grid
        document.querySelectorAll('.jadwal-item').forEach(el => el.classList.remove('next-waktu'));

        // Cari waktu shalat berikutnya
        const prayers = [
            { id: 'subuh', name: 'Subuh', time: currentJadwal.subuh },
            { id: 'dzuhur', name: 'Dzuhur', time: currentJadwal.dzuhur },
            { id: 'ashar', name: 'Ashar', time: currentJadwal.ashar },
            { id: 'maghrib', name: 'Maghrib', time: currentJadwal.maghrib },
            { id: 'isya', name: 'Isya', time: currentJadwal.isya }
        ];

        let nextP = null;
        for(let p of prayers) {
            const [h, m] = p.time.split(':').map(Number);
            const pTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
            if(pTime > now) {
                nextP = { ...p, obj: pTime };
                break;
            }
        }

        // Jika semua terlewati, maka shalat selanjutnya adalah Subuh esok hari
        if(!nextP) {
            const [h, m] = prayers[0].time.split(':').map(Number);
            const pTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, h, m, 0);
            nextP = { id: 'subuh', name: 'Subuh (Besok)', time: prayers[0].time, obj: pTime };
        }

        // Highlight jadwal selanjutnya di grid
        const targetGrid = document.getElementById(`card-${nextP.id}`);
        if(targetGrid) targetGrid.classList.add('next-waktu');

        // Update Info Selanjutnya
        document.getElementById('next-prayer-name').innerText = nextP.name;
        document.getElementById('next-prayer-time').innerText = nextP.time;

        // Kalkulasi Countdown
        const diffMs = nextP.obj - now;
        const dH = Math.floor(diffMs / (1000 * 60 * 60));
        const dM = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const dS = Math.floor((diffMs % (1000 * 60)) / 1000);

        document.getElementById('next-prayer-countdown').innerText = 
            `-${String(dH).padStart(2,'0')}:${String(dM).padStart(2,'0')}:${String(dS).padStart(2,'0')}`;
    }

    // --- MODUL QURAN ---
    let surahDataRaw = [];
    document.getElementById('searchSurah').addEventListener('keyup', filterSurah);
    document.getElementById('btn-back-quran').addEventListener('click', backToSurahList);

    function fetchDaftarSurah() {
        document.getElementById('loading-quran').style.display = 'block';
        fetch('https://api.alquran.cloud/v1/surah').then(res => res.json()).then(data => {
            document.getElementById('loading-quran').style.display = 'none';
            surahDataRaw = data.data; renderSurahList(surahDataRaw);
        }).catch(() => {
            document.getElementById('loading-quran').style.display = 'none'; alert("Gagal memuat daftar Surah.");
        });
    }

    function renderSurahList(data) {
        const container = document.getElementById('daftar-surah'); container.innerHTML = '';
        data.forEach(surah => {
            const btn = document.createElement('div'); btn.className = 'surah-btn';
            btn.innerHTML = `<div style="font-size: 0.9rem;"><strong>${surah.number}. ${surah.englishName}</strong><br><small>${surah.numberOfAyahs} Ayat</small></div><div class="surah-arab">${surah.name}</div>`;
            btn.addEventListener('click', () => loadAyat(surah.number, surah.englishName, surah.name));
            container.appendChild(btn);
        });
    }

    function filterSurah() {
        const keyword = document.getElementById('searchSurah').value.toLowerCase();
        renderSurahList(surahDataRaw.filter(s => s.englishName.toLowerCase().includes(keyword)));
    }

    function loadAyat(nomorSurah, namaLatin, namaArab) {
        document.getElementById('quran-home').style.display = 'none';
        document.getElementById('quran-baca').style.display = 'block';
        document.getElementById('judul-surah').innerText = `${namaLatin} - ${namaArab}`;
        document.getElementById('daftar-ayat').innerHTML = '';
        document.getElementById('loading-ayat').style.display = 'block';

        Promise.all([
            fetch(`https://api.alquran.cloud/v1/surah/${nomorSurah}`).then(res => res.json()),
            fetch(`https://api.alquran.cloud/v1/surah/${nomorSurah}/id.indonesian`).then(res => res.json())
        ]).then(([resArab, resIndo]) => {
            document.getElementById('loading-ayat').style.display = 'none';
            const container = document.getElementById('daftar-ayat');
            resArab.data.ayahs.forEach((ayat, index) => {
                const div = document.createElement('div'); div.className = 'ayat-item';
                div.innerHTML = `<div class="ayat-arab">${ayat.text} <span style="font-size: 1rem; color: var(--primary-color); font-family: 'Segoe UI', sans-serif;">(${ayat.numberInSurah})</span></div><div class="ayat-arti">${resIndo.data.ayahs[index].text}</div>`;
                container.appendChild(div);
            });
        }).catch(() => {
            document.getElementById('loading-ayat').style.display = 'none'; alert("Gagal memuat ayat.");
        });
    }

    function backToSurahList() {
        document.getElementById('quran-baca').style.display = 'none'; document.getElementById('quran-home').style.display = 'block';
    }

    // --- MODUL KALENDER (3 CARD) ---
    const inputBulan = document.getElementById('inputBulan');
    inputBulan.addEventListener('change', renderKalenderBulan);

    function initKalender() {
        const now = new Date();
        inputBulan.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        renderCardHariIni(); renderKalenderBulan(); renderPeristiwaMendatang();
    }

    function cekPuasa(hrM, tglH) {
        let p = [];
        if(hrM === 1) p.push("Senin"); if(hrM === 4) p.push("Kamis"); if(tglH >= 13 && tglH <= 15) p.push("Ayyamul Bidh");
        return p;
    }

    function renderCardHariIni() {
        const now = new Date();
        document.getElementById('hari-ini-masehi').innerText = new Intl.DateTimeFormat('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(now);
        document.getElementById('hari-ini-hijriah').innerText = new Intl.DateTimeFormat('id-ID-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(now) + " H";
        
        const dp = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {day: 'numeric'}).formatToParts(now);
        const puasa = cekPuasa(now.getDay(), parseInt(dp.find(p => p.type === 'day').value));
        const c = document.getElementById('hari-ini-puasa');
        c.innerHTML = puasa.length > 0 ? `<span class="badge-puasa">Puasa Sunnah: ${puasa.join(" & ")}</span>` : `<span style="color:#777; font-size:0.9rem;">Tidak ada jadwal puasa sunnah hari ini</span>`;
    }

    function renderKalenderBulan() {
        const val = inputBulan.value; if(!val) return;
        const [year, month] = val.split('-').map(Number);
        const firstDay = new Date(year, month - 1, 1);
        const grid = document.getElementById('grid-bulan'); grid.innerHTML = '';
        
        for(let i=0; i < (firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1); i++) grid.innerHTML += `<div></div>`;
        const todayStr = new Date().toDateString();
        
        for(let d = 1; d <= new Date(year, month, 0).getDate(); d++) {
            const current = new Date(year, month - 1, d);
            const dp = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {day: 'numeric', month: 'numeric'}).formatToParts(current);
            const tglH = parseInt(dp.find(p => p.type === 'day').value);
            const puasa = cekPuasa(current.getDay(), tglH);
            
            grid.innerHTML += `<div class="cell-hari ${current.toDateString() === todayStr ? 'hari-ini' : ''} ${puasa.length > 0 ? 'ada-puasa' : ''}">
                <span class="tgl-masehi">${d}</span><span class="tgl-hijri">${tglH}/${parseInt(dp.find(p => p.type === 'month').value)}</span>
                ${puasa.length > 0 ? `<span class="badge-puasa-mini">${puasa.join(', ')}</span>` : ''}
            </div>`;
        }
    }

    function renderPeristiwaMendatang() {
        const list = document.getElementById('list-peristiwa');
        const targetEvents = [{ id: '1-1', name: 'Tahun Baru Islam (1 Muharram)' }, { id: '27-7', name: 'Isra Mi\'raj (27 Rajab)' }, { id: '1-9', name: 'Awal Ramadhan (1 Ramadhan)' }, { id: '1-10', name: 'Idul Fitri (1 Syawal)' }, { id: '10-12', name: 'Idul Adha (10 Dzulhijjah)' }];
        const foundEvents = []; let today = new Date(); today.setHours(0,0,0,0);
        
        for(let i=0; i <= 355; i++) {
            let current = new Date(today); current.setDate(today.getDate() + i);
            const dp = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {day: 'numeric', month: 'numeric'}).formatToParts(current);
            const eventMatch = targetEvents.find(e => e.id === `${parseInt(dp.find(p => p.type === 'day').value)}-${parseInt(dp.find(p => p.type === 'month').value)}`);
            if (eventMatch && !foundEvents.find(e => e.name === eventMatch.name)) foundEvents.push({ name: eventMatch.name, dateMasehi: new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(current), daysLeft: i });
        }
        
        list.innerHTML = '';
        foundEvents.forEach(ev => list.innerHTML += `<div class="peristiwa-item"><div><strong style="color:var(--primary-color);">${ev.name}</strong><br><small style="color:#666;">${ev.dateMasehi}</small></div><div style="background:var(--primary-color); color:white; padding:5px 12px; border-radius:15px; font-size:0.85rem; font-weight:bold;">${ev.daysLeft === 0 ? 'Hari Ini!' : ev.daysLeft + ' Hari'}</div></div>`);
    }

    // --- MODUL ZAKAT ---
    document.getElementById('btn-hitung-zakat').addEventListener('click', () => {
        const he = parseFloat(document.getElementById('hargaEmas').value) || 0;
        const tot = (parseFloat(document.getElementById('tabungan').value) || 0) + (parseFloat(document.getElementById('asetEmas').value) || 0) + (parseFloat(document.getElementById('asetDagang').value) || 0) - (parseFloat(document.getElementById('hutang').value) || 0);
        const nisab = he * 85;
        document.getElementById('total-harta').innerText = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(tot);
        document.getElementById('nilai-nisab').innerText = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(nisab);
        document.getElementById('status-nisab').innerText = tot >= nisab ? "Wajib Zakat" : "Belum Mencapai Nisab";
        document.getElementById('wajib-zakat').innerText = tot >= nisab ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(tot * 0.025) : "-";
        document.getElementById('hasil-zakat').style.display = "block";
    });

    initKalender();
    // Jika ingin load otomatis Adzan saat pertama kali dibuka, hapus "//" di bawah ini:
    // getLocationAdzan(); 
});
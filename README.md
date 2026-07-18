# MayzaaCloud Uploader

File uploader + link shortener API, bisa dijalankan di **Vercel**, **VPS**, **Windows**, atau **Replit** tanpa ubah kode — cuma beda cara start-nya aja.

## Endpoint

| Method | Path | Fungsi |
|---|---|---|
| `POST` | `/api/upload` | Upload file (multipart, field name bebas asal ada `filename`, disarankan `files`) |
| `GET` | `/api/upload` | List semua file |
| `GET` | `/api/upload/:filename` | Download / akses file langsung |
| `DELETE` | `/api/upload?file=nama.ext` | Hapus file (bisa juga `?id=...`) |
| `POST` | `/api/botupload?filename=nama.ext` | Upload raw bytes (buat bot/script, body = isi file apa adanya) |
| `POST` / `GET` | `/api/shorten` | Convert link panjang jadi link pendek — `POST` body JSON `{"url":"..."}` atau `GET ?url=...` |
| `GET` | `/api/shorten` (tanpa `?url=`) | List semua short link |
| `GET` | `/s/:code` | Redirect ke link asli |

### Format response upload

```json
{
  "author": "Mayzaa",
  "file": "namafile.png",
  "link": "https://uploader.mayzaa.my.id/api/upload/namafile.png"
}
```

### Format response shorten

Paling gampang, tinggal GET biasa (link asli wajib di-`encodeURIComponent` dulu kalau ada tanda `?` / `&` di dalamnya, biar gak ke-parse sebagai parameter terpisah):

```bash
curl "https://uploader.mayzaa.my.id/api/shorten?url=https%3A%2F%2Fimage.pollinations.ai%2Fprompt%2Fblackhole%3Fmodel%3Dflux%26width%3D1024%26height%3D1024%26nologo%3Dtrue%26private%3Dfalse%26enhance%3Dfalse%26safe%3Dfalse"
```

Atau bisa juga langsung dibuka di address bar browser. Kalau lebih suka kirim JSON lewat POST, tetep bisa:

```bash
curl -X POST https://uploader.mayzaa.my.id/api/shorten \
  -H "Content-Type: application/json" \
  -d '{"url":"https://image.pollinations.ai/prompt/blackhole?model=flux&width=1024&height=1024&nologo=true&private=false&enhance=false&safe=false"}'
```

Response (sama untuk keduanya):
```json
{
  "author": "Mayzaa",
  "code": "aZ3kq1",
  "original": "https://image.pollinations.ai/prompt/blackhole?model=flux&width=1024&height=1024&nologo=true&private=false&enhance=false&safe=false",
  "link": "https://uploader.mayzaa.my.id/s/aZ3kq1"
}
```

Buka `https://uploader.mayzaa.my.id/s/aZ3kq1` otomatis redirect ke link aslinya.

## Struktur project

```
mayzaa-uploader/
├── api/upload.js     # entrypoint Vercel (serverless function)
├── server.js         # entrypoint standalone (VPS / Windows / Replit)
├── lib/
│   ├── config.js      # resolve BASE_URL & lokasi penyimpanan
│   ├── store.js        # "database" JSON + penyimpanan blob file
│   ├── multipart.js    # parser multipart/form-data & mime type
│   └── router.js        # semua logic endpoint (dipakai bareng oleh api/upload.js & server.js)
├── public/index.html  # frontend
└── vercel.json        # rewrite rules khusus Vercel
```

Kode intinya cuma satu (`lib/router.js`), jadi Vercel dan server standalone selalu punya behavior yang sama persis.

## Deploy ke Vercel

1. Push folder ini ke GitHub repo.
2. Import di [vercel.com/new](https://vercel.com/new).
3. Set Environment Variable:
   - `BASE_URL` = `https://uploader.mayzaa.my.id` (domain custom kamu)
4. Deploy. Setelah itu tinggal add domain `uploader.mayzaa.my.id` di tab Domains project Vercel-nya.

⚠️ **Catatan penting**: di Vercel, storage cuma nulis ke `/tmp` yang **ephemeral** (bisa hilang tiap deploy baru / cold start baru). Cocok buat testing/demo, tapi kalau butuh file permanen selamanya, sebaiknya pakai VPS, atau sambungkan ke storage eksternal (S3/R2/Vercel Blob) — kabarin aja kalau mau saya bikinin versi itu.

## Deploy ke VPS (Ubuntu/Debian dll)

```bash
# install Node.js 18+ kalau belum ada
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# clone / upload project, lalu:
cd mayzaa-uploader
cp .env.example .env
nano .env   # isi BASE_URL=https://uploader.mayzaa.my.id, PORT=3000

npm start   # atau: node server.js
```

Biar tetap jalan setelah SSH ditutup, pakai **pm2**:
```bash
npm install -g pm2
pm2 start server.js --name mayzaa-uploader
pm2 save
pm2 startup
```

Terus arahkan domain `uploader.mayzaa.my.id` via reverse proxy (nginx contoh):
```nginx
server {
    listen 80;
    server_name uploader.mayzaa.my.id;
    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Lalu pasang SSL gratis pakai `certbot --nginx -d uploader.mayzaa.my.id`.

## Deploy di Windows

1. Install [Node.js LTS](https://nodejs.org) (centang "Add to PATH" pas install).
2. Extract project, buka folder-nya di **Command Prompt** / **PowerShell**.
3. Copy `.env.example` jadi `.env`, isi `BASE_URL` & `PORT`.
4. Jalankan:
   ```
   npm start
   ```
5. Buka `http://localhost:3000` di browser. Kalau mau diakses dari internet, tinggal forward port di router / pakai Cloudflare Tunnel / ngrok, lalu arahkan domain ke situ.

## Deploy di Replit

1. Import repo ini ke Replit (New Repl → Import from GitHub).
2. File `.replit` sudah disiapkan supaya otomatis run `node server.js`.
3. Buka tab **Secrets**, tambahkan `BASE_URL` = `https://uploader.mayzaa.my.id`.
4. Klik **Run**. Replit otomatis kasih PORT lewat env, server sudah handle itu.
5. Kalau mau domain custom, hubungkan di Replit Deployments, lalu arahkan DNS domain kamu (CNAME) sesuai instruksi Replit.

## Custom domain (uploader.mayzaa.my.id)

Apapun platform hosting-nya, urutannya sama:
1. Deploy dulu (dapat URL bawaan platform, misal `.vercel.app` / IP VPS / `.repl.co`).
2. Set DNS `uploader.mayzaa.my.id` (A record ke IP VPS, atau CNAME ke target platform).
3. Pasang domain custom itu di dashboard platform (Vercel Domains / nginx server_name / Replit Deployments).
4. **Wajib**: set env `BASE_URL=https://uploader.mayzaa.my.id` supaya semua link yang dihasilkan API selalu pakai domain ini, apapun host header yang masuk.

## Batas ukuran file

- Frontend browser membatasi 4.5 MB per file secara default (batas request body Vercel serverless function di paket gratis).
- Kalau self-host di VPS/Windows/Replit dan mau upload lebih besar, ubah `MAX_SIZE` di `public/index.html` (variabel `MAX_SIZE`) — server standalone sendiri tidak membatasi ukuran.

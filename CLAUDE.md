# FBU Laboratuvar Yazılım Talep Sistemi — Claude için proje notları

Bu dosya OneDrive ile senkronize olan proje klasörünün içinde yaşar, bu yüzden hangi
bilgisayardan açılırsa açılsın (Claude Code'un kendi `.claude` hafızası o bilgisayara
özel olduğu için taşınmaz) bu bilgiler proje ile birlikte gelir. Yeni bir makinede bu
projeye dönüldüğünde önce bu dosyayı oku.

## Production sunucusu

- Host: **SV-DK-ND-01** (iç IP `10.2.0.87`), Fenerbahçe Üniversitesi SSH konsolu
  arkasında ("Fenerbahce University SSH Consol" banner'ı çıkar).
- Bağlantı: `ssh SV-DK-ND-01` — SSH config alias'ı `~/.ssh/config` içinde tanımlı
  olmalı (`HostName 10.2.0.87`, `User muhammet.ozdemir`, `Port 22`,
  `IdentityFile ~/.ssh/id_ed25519`). **Bu key her makineye özeldir, senkronize olmaz**
  — yeni makinede yeniden oluşturup sunucudaki `~/.ssh/authorized_keys`'e eklenmesi
  gerekir.
- Uygulama dosyaları (kaynak kod, derlenmemiş): `/opt/fbu-lab-yazilim-talep-8099/`
  — bu klasör **git repository değil** (2026-08-19 itibarıyla `.git` yok), dosyalar
  elle/scp ile deploy ediliyor.
- Docker: bu sunucu **paylaşılan bir docker host'u** — Portainer, Zabbix, LibreNMS,
  Security Command Center (çok sayıda container), IT Portal, WAF Manager, IS Takip vb.
  onlarca farklı stack aynı hostta çalışıyor. **Bu projeyle ilgisi olmayan hiçbir
  container'a/stack'e dokunma.**
- Bu projenin stack'i: `docker-compose.server.yml` içinde `name: fbu-lab-yazilim-talep-8099`
  olarak sabitlenmiş — proje dizininden (`/opt/fbu-lab-yazilim-talep-8099`) bu dosyayla
  (`-f docker-compose.server.yml`) çalıştırılan her `docker compose` komutu otomatik
  olarak sadece bu iki servise (`backend`, `frontend`) scope olur. Container adları:
  `fbu-lab-backend`, `fbu-lab-frontend`. Frontend `0.0.0.0:8099->80` ile dışarı açık,
  backend'e sadece iç ağdan (`fbu_network`) erişilir.
- Canlı adres: `https://yazilimtalep.fbu.edu.tr` (Caddy/nginx reverse proxy sunucuda
  ayrı bir yerde olmalı, bu compose dosyasında değil).
- Secrets (`pg_password`, `jwt_secret`) dosya tabanlı, `/opt/fbu-lab-yazilim-talep-8099/secrets/`
  altında — repoya asla girmemeli (`.gitignore` zaten hariç tutuyor).

### Değişiklik yapma / deploy akışı (2026-08-19'da izlenen ve doğrulanan yöntem)

1. Önce sunucudaki dosyaları localdeki dosyalarla **karşılaştır** (`scp` ile indirip
   `Compare-Object`/diff) — local eski olabilir, sapma varsa önce onu anla.
2. Değiştirilecek dosyaları sunucuda zaman damgalı bir yedeğe kopyala
   (`.deploy-backup-<timestamp>/...`) — geri dönülebilirlik için.
3. Düzenlenmiş dosyaları `scp` ile sunucuya yükle, üstüne yazdıktan sonra tekrar
   indirip diff'siz olduğunu doğrula.
4. `cd /opt/fbu-lab-yazilim-talep-8099 && docker compose -f docker-compose.server.yml build backend frontend`
   — **sadece bu iki servisi** build et, `docker compose build` (servis adı vermeden)
   çalıştırma.
5. `docker compose -f docker-compose.server.yml up -d backend frontend` ile yeniden
   oluştur/başlat.
6. `docker ps` ile container'ların "healthy" olduğunu, `curl localhost:8099/` ve
   `curl localhost:8099/api/health` ile HTTP 200 döndüğünü doğrula.
7. İstersen deploy edilen JS/CSS bundle içinde yeni kodun gerçekten var olduğunu
   `docker exec fbu-lab-frontend grep <boşluksuz-anahtar-kelime> /usr/share/nginx/html/assets/*.js`
   ile teyit et (boşluklu string arama nested shell quoting yüzünden kırılabiliyor,
   boşluksuz benzersiz bir tanımlayıcı kullan).

Not: Frontend build'i localde asla test edilemedi — bu makinede (ve muhtemelen diğer
istemci makinelerde) `node`/`npm`/`dotnet` SDK PATH'te yok, sadece PowerShell var.
Bu yüzden gerçek doğrulama sunucudaki `docker compose build` çıktısı üzerinden yapıldı
(ör. `RequestFilters` tipine yeni zorunlu alan eklenince bir test dosyasının derlemesi
kırıldı, hata mesajından anlaşılıp düzeltildi).

## GitHub

- Hedef repository (private): `git@github.com:kursat-ozdemir4562/fbu-lab-yazilim-talep-sistemi.git`
- Hesap: `kursat-ozdemir4562`
- **2026-08-19 itibarıyla sunucuda bu repoya push için hiçbir kimlik bilgisi yok**
  (ne `git config user.*`, ne `gh` CLI, ne GitHub'a özel bir SSH key — `ssh -T git@github.com`
  "Permission denied (publickey)" veriyor). `/opt/fbu-lab-yazilim-talep-8099` klasörü
  git repo bile değil.
- Kullanıcı bu adımı bilinçli olarak "şimdilik atla" dedi (2026-08-19) — yani sunucudaki
  kod ile GitHub reposu **senkron değil**. Bu durum değişene kadar (kullanıcı deploy key/PAT
  sağlayana ya da push'u kendisi yapana kadar) böyle kalacak, sürpriz yapma.

## Bu projeyle ilgili genel notlar

- Yerelde (bu OneDrive klasöründeki checkout) proje `backend/`, `frontend/`, `.git/`
  içeriyor ama bu makinede git/node/dotnet CLI'ları PATH'te değildi (2026-08-19).
  Kod değişikliği yapmadan önce hangi araçların gerçekten çalıştığını kontrol et.
- Uygulama: akademisyenlerin laboratuvarlar için yazılım talep ettiği, kataloğa
  kayıtlı olmayan programları da serbest metin (`OtherSoftwareName`/"İstediğim Program
  Listede Yok") olarak ekleyebildiği bir talep/onay sistemi. Admin tarafı "Bütün
  Talepler" ekranında (`frontend/src/pages/RequestsPage.tsx`) bu kataloğa kayıtlı
  olmayan programları rozet/filtre ile ayırt edebiliyor (2026-08-19'da eklendi).

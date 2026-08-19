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

- Gerçek/doğru hedef repository (private): `git@github.com:kursat-ozdemir4562/fbu-yazilimtalep.git`
  (**Prompt.md ve README'de geçen `fbu-lab-yazilim-talep-sistemi` adı yanlış/eski plan** —
  repo gerçekte `fbu-yazilimtalep` adıyla oluşturulmuş, local `.git/config`'teki
  `remote origin` bunu doğruluyor. Karışıklığa düşme, her zaman `.git/config`'e güven.)
- Hesap: `kursat-ozdemir4562`
- **Push yeri: sunucu değil, bu OneDrive'daki local checkout.** `/opt/fbu-lab-yazilim-talep-8099`
  (sunucu) hâlâ git repo değil, dosyalar oraya elle/scp ile deploy ediliyor — GitHub push
  akışının parçası değil. Local checkout'ta zaten **gerçek, uzun bir commit geçmişi** var
  (2026-08-12/13 tarihli, önceki oturumlardan kalma — proje sıfırdan değil, üzerine
  devam edilen bir iş). Bir önceki commit'in mesajı "Yakalama: sunucuda deploy edilmiş,
  henüz commit edilmemiş değişiklikler" idi — yani önceki oturumda da aynı desen
  izlenmiş: sunucu otoriter, local ona göre senkronize edilip commit'lenmiş.
- **GitHub kimlik doğrulama yöntemi: SSH key, HTTPS/GCM değil.** Bu makinede git yoktu,
  `winget install --exact --id Git.Git --silent` ile kuruldu (2026-08-19). Git Credential
  Manager (HTTPS) OAuth/tarayıcı akışı otomasyondan güvenilir şekilde sürülemediği için
  tercih edilmedi. Bunun yerine:
  - `~/.ssh/id_ed25519_github` adında **ayrı, sadece GitHub'a özel** bir ed25519 key
    üretildi (SV-DK-ND-01 sunucu key'inden bağımsız).
  - `~/.ssh/config`'e `Host github.com` bloğu eklendi (`IdentityFile ~/.ssh/id_ed25519_github`,
    `IdentitiesOnly yes`).
  - Public key kullanıcı tarafından https://github.com/settings/ssh/new üzerinden hesaba eklendi.
  - `origin` remote'u `https://...` yerine `git@github.com:...` (SSH) formuna çevrildi
    (`git remote set-url origin git@github.com:kursat-ozdemir4562/fbu-yazilimtalep.git`).
  - `ssh-keyscan` bu makinedeki eski Windows OpenSSH ile KEX uyumsuzluğu yüzünden
    çalışmadı (`choose_kex: unsupported KEX method`) — GitHub'ın herkese açık yayınladığı
    ed25519 host key parmak izi doğrudan `known_hosts`'a eklendi.
  - Bu yöntem **2026-08-19'da doğrulandı ve çalıştı** — `git push origin main` başarılı
    (commit `c508da5`, "listede olmayan program" özelliği + bu `CLAUDE.md`).
- Yeni bir makinede bu deponun push'una devam edileceği zaman: git kurulu değilse kur,
  `~/.ssh/id_ed25519_github` yoksa yeniden üret (veya yenisini üret), public key'i tekrar
  GitHub hesabına ekletmesi için kullanıcıya sor, remote'un SSH formunda olduğunu
  (`git remote -v`) doğrula.
- **OneDrive özel notu:** bu klasör OneDrive senkronizasyonundadır; `git commit` bazen
  `unable to append to '.git/logs/refs/heads/main': Invalid argument` hatası veriyor
  (OneDrive dosya kilidi/senkron müdahalesi). Çözüm: `git config windows.appendAtomically false`
  bir kere ayarlanınca sorun geçiyor.

## Bu projeyle ilgili genel notlar

- Yerelde (bu OneDrive klasöründeki checkout) proje `backend/`, `frontend/`, `.git/`
  içeriyor. 2026-08-19'da bu makinede git/node/dotnet SDK PATH'te yoktu; git winget ile
  kuruldu ama `git` komutu hâlâ PATH'te değil — `"C:\Program Files\Git\cmd\git.exe"` tam
  yoluyla çağırmak gerekiyor (yeni PowerShell oturumu PATH'i yenilerse artık gerekmeyebilir,
  önce dene). node/dotnet SDK hâlâ kurulu değildi — frontend/backend build'i bu makinede
  test edilemiyor, gerçek build doğrulaması sunucu üzerinden yapılmalı. Kod değişikliği
  yapmadan önce hangi araçların gerçekten çalıştığını kontrol et.
- `Oryantasyon/` klasörü (kullanım kılavuzu PDF + video) bilinçli olarak git dışı
  bırakıldı — kod deposunun parçası değil, kullanıcının kendi materyali. `git add -A`
  yapma, dosyaları tek tek/scope'lu ekle.
- Uygulama: akademisyenlerin laboratuvarlar için yazılım talep ettiği, kataloğa
  kayıtlı olmayan programları da serbest metin (`OtherSoftwareName`/"İstediğim Program
  Listede Yok") olarak ekleyebildiği bir talep/onay sistemi. Admin tarafı "Bütün
  Talepler" ekranında (`frontend/src/pages/RequestsPage.tsx`) bu kataloğa kayıtlı
  olmayan programları rozet/filtre ile ayırt edebiliyor (2026-08-19'da eklendi).

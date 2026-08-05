# Docker secret dosyaları (yalnızca production sunucusu)

`docker-compose.server.yml` artık DB şifresini ve JWT imzalama anahtarını environment
variable yerine bu klasördeki dosyalardan okuyor (Docker Compose `secrets:` — dosyalar
container'a `/run/secrets/<isim>` olarak monte edilir, `docker inspect`/Portainer container
detaylarında GÖRÜNMEZLER).

Bu dosyalar repoya commit edilmez (`.gitignore`), yalnızca sunucuda
`/opt/fbu-lab-yazilim-talep-8099/secrets/` altında bulunmalıdır:

```
secrets/
  pg_password.txt   # mevcut PG_PASSWORD değeriyle AYNI olmalı (DB şifresi değişmedi)
  jwt_secret.txt     # mevcut JWT_SECRET değeriyle AYNI olmalı (değişirse tüm oturumlar geçersiz olur)
```

Oluşturma (sunucuda, mevcut `.env` içindeki değerlerle — yeni değer ÜRETME):

```bash
cd /opt/fbu-lab-yazilim-talep-8099
mkdir -p secrets
printf '%s' "$PG_PASSWORD" > secrets/pg_password.txt
printf '%s' "$JWT_SECRET" > secrets/jwt_secret.txt
chmod 600 secrets/*.txt
```

`printf '%s'` kullan (`echo` değil) — sonuna yeni satır eklemez, uygulama tarafında
`File.ReadAllText(...).Trim()` ile okunuyor ama gereksiz baytlardan kaçınmak için tercih edilir.

Dosyalar oluşturulduktan sonra `.env`'deki `PG_PASSWORD`/`JWT_SECRET` satırları silinebilir
(compose dosyası artık bunları kullanmıyor).

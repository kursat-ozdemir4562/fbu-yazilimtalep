# Güvenlik Notları

Bu belge development teslimindeki güvenlik sınırlarını ve production öncesi zorunlu kontrolleri özetler.

## Kimlik ve oturum

- Parolalar ASP.NET Core Identity ile hashlenir; kaynak kodda veya seed dosyasında parola bulunmaz.
- Access token kısa ömürlüdür. Refresh token rotation, iptal ve tekrar kullanım engeli sunucu tarafında uygulanır.
- Token ve parola değerleri log, hata yanıtı veya audit içeriğine yazılmaz.
- Development seed kullanıcılarının parolaları `INITIAL_*_PASSWORD`, JWT imza anahtarı `JWT_SECRET` değişkenlerinden okunur.
- Account lockout ve API rate limit kaba kuvvet saldırılarının etkisini azaltır.

## Yetkilendirme ve IDOR

- Yetki yalnız menü gizleme ile sağlanmaz; tüm kontroller API katmanında zorunludur.
- Akademisyen kapsamı JWT kullanıcı kimliğine, fakülte yetkilisi kapsamı kalıcı izin tablosuna dayanır.
- Talep ayrıntısı, öğrenci listesi, kopyalama, export ve rapor uçları aynı kapsam kontrolünü kullanır.
- Kapsam dışı bir kimliği URL içinde tahmin etmek veriye erişim sağlamaz.

## Öğrenci verileri ve dosyalar

- Öğrenci dosyaları frontend `public` alanına yazılmaz.
- Uzantı, içerik türü, boyut ve dosya biçimi doğrulanır; kaynak dosya adı depolama yolu olarak kullanılmaz.
- Kaydedilen dosya adları rastgele üretilir ve hedef yolun depolama kökü altında kaldığı doğrulanır.
- Öğrenci numarası ve e-posta normal uygulama loglarına eklenmez.
- İndirme yalnız yetkili API uçlarından yapılır.

## Secret yönetimi

Gerçek değerleri `.env.example` içine yazmayın. Yerel değerler process/user environment variable veya .NET User Secrets ile tutulmalıdır. Commit öncesinde:

```powershell
.\scripts\check-secrets.ps1
```

komutunu çalıştırın. Git ignore kuralları `.env`, production ayarı, sertifika/private key, yüklenen öğrenci listesi, local database ve logları dışarıda bırakır.

## Production öncesi zorunlu işler

1. En az 256 bit rastgele JWT anahtarı ve kurumsal secret store kullanın.
2. TLS sonlandırmasını ve güvenli proxy başlıklarını yapılandırın.
3. CORS listesini gerçek origin ile sınırlandırın.
4. Swagger erişimini kapatın veya yönetici/ağ politikasıyla sınırlayın.
5. SQL Server için en az yetkili servis hesabı, şifreleme, yedekleme ve geri dönüş testi kurun.
6. Dosya alanında zararlı yazılım taraması, saklama süresi ve silme politikası uygulayın.
7. SMTP/Entra/AD bağlantılarını ayrı servis hesabı ve secret store ile etkinleştirin.
8. Audit saklama, kişisel veri erişimi ve KVKK süreçlerini kurum politikasıyla eşleştirin.
9. Güvenlik başlıklarını kurumun reverse proxy yapılandırmasıyla tekrar doğrulayın.
10. SAST, bağımlılık, container ve sızma testlerini CI/CD aşamasına ekleyin.

Güvenlik açığı şüphesinde hassas ayrıntıları issue içine koymadan üniversitenin Bilgi Teknolojileri birimine bildirin.


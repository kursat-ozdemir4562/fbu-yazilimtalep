Fenerbahçe Üniversitesi bilgisayar laboratuvarlarında kullanılacak yazılımların akademisyenlerden toplanması, değerlendirilmesi, raporlanması ve kurulum süreçlerinin takip edilmesi için tam çalışan bir web uygulaması geliştir.

Yalnızca plan, örnek kod veya açıklama üretme. Proje dosyalarını gerçekten oluştur, uygulamayı yerel ortamda çalıştır, test et, Git repository oluştur ve başarılı çalışan sürümü GitHub’a pushla.

# 1. Proje Konumu

Projeyi yalnızca aşağıdaki klasör altında oluştur:

```text
C:\Users\muhammet.ozdemir\OneDrive - Fenerbahçe Üniversitesi\PROBOOK 440 G7\CODEX
```

Proje klasörünün adı:

```text
FBU-Lab-Yazilim-Talep-Sistemi
```

Tam proje yolu:

```text
C:\Users\muhammet.ozdemir\OneDrive - Fenerbahçe Üniversitesi\PROBOOK 440 G7\CODEX\FBU-Lab-Yazilim-Talep-Sistemi
```

Başka klasörlerde işlem yapma. Üst klasörde bulunan diğer proje ve dosyalara müdahale etme.

Hedef proje klasörü önceden oluşturulmuşsa içeriğini kontrol et. Başka bir projeye ait dosyalar varsa üzerine yazma. Mevcut klasör bu projeye aitse çalışmaya mevcut yapı üzerinden güvenli şekilde devam et.

Uygulamanın görünen adı:

```text
FBU Laboratuvar Yazılım Talep Sistemi
```

GitHub repository adı:

```text
fbu-lab-yazilim-talep-sistemi
```

# 2. Uygulamanın Amacı

Akademisyenler, üniversite laboratuvarlarında verecekleri derslerde ihtiyaç duydukları programları, eklentileri, laboratuvar bilgilerini, ders gün ve saatlerini ve öğrenci listelerini sisteme girecek.

Akademisyenler yalnızca kendi kayıtlarını görebilecek.

Fakülte yetkilileri yalnızca kendilerine yetki verilen fakültelerin kayıtlarını görebilecek.

Sistem yöneticileri bütün fakültelerin ve kullanıcıların verilerini görebilecek.

Fakülte, laboratuvar, akademik dönem ve ana program listeleri yalnızca sistem yöneticisi tarafından yönetilecek.

Akademisyen program listesinden seçim yapacak. İstediği program listede yoksa yeni program önerisi girebilecek. Yeni program önerisi doğrudan ana listeye eklenmeyecek ve yönetici onayına düşecek.

# 3. Teknoloji Yapısı

Projeyi aşağıdaki teknolojilerle geliştir:

## Backend

* ASP.NET Core 8 Web API
* C#
* Clean Architecture
* Entity Framework Core
* Microsoft SQL Server
* SQL Server LocalDB development desteği
* ASP.NET Core Identity
* JWT access token
* Refresh token
* Refresh token rotation
* FluentValidation
* AutoMapper veya eş değer mapping altyapısı
* Swagger / OpenAPI
* Serilog veya eş değer merkezi loglama
* Global exception handling middleware
* Health checks
* Unit testler
* Integration testler

## Frontend

* React
* TypeScript
* Vite
* TypeScript strict mode
* React Router
* TanStack Query
* React Hook Form
* Zod veya eş değer frontend doğrulama
* Responsive tasarım
* Türkçe arayüz
* Dark mode ve light mode
* ESLint
* Prettier

## Veritabanı

* Microsoft SQL Server
* Development ortamında SQL Server LocalDB
* Entity Framework Core migration
* Seed data
* Soft delete
* Audit log

# 4. Proje Klasör Yapısı

En az aşağıdaki klasör yapısını oluştur:

```text
FBU-Lab-Yazilim-Talep-Sistemi
│
├── backend
│   ├── src
│   │   ├── FbuLabSoftware.Domain
│   │   ├── FbuLabSoftware.Application
│   │   ├── FbuLabSoftware.Infrastructure
│   │   └── FbuLabSoftware.Api
│   └── tests
│       ├── FbuLabSoftware.UnitTests
│       └── FbuLabSoftware.IntegrationTests
│
├── frontend
│
├── docs
│
├── scripts
│
├── storage
│   └── development
│
├── .gitignore
├── README.md
├── docker-compose.yml
└── FbuLabSoftware.sln
```

Backend içerisindeki sorumlulukları katmanlara uygun ayır.

* Domain: Entity, enum ve temel domain kuralları
* Application: Use case, servis interface, DTO, validator ve authorization kuralları
* Infrastructure: Entity Framework, Identity, dosya işlemleri, e-posta ve repository implementasyonları
* API: Controller, middleware, authentication ve uygulama başlangıç yapılandırması

Controller içerisine doğrudan iş mantığı yazma.

# 5. Yerel Çalışma Ortamı

İlk aşamada uygulama yalnızca yerel Windows bilgisayarımda çalıştırılıp test edilecek.

Bu aşamada:

* Canlı sunuculara bağlanma.
* Production deployment yapma.
* Üniversitenin Active Directory sistemine bağlanma.
* Microsoft Entra ID bağlantısı yapma.
* Üniversitenin SQL Server sistemlerine bağlanma.
* DNS kaydı oluşturma.
* SSL sertifikası oluşturma.
* IIS, Nginx veya Apache üzerinde yayınlama yapma.
* Üniversitenin canlı SMTP, dosya, öğrenci veya personel sistemlerine bağlanma.

Development ortamında SQL Server LocalDB kullan.

Örnek development connection string:

```text
Server=(localdb)\MSSQLLocalDB;Database=FbuLabSoftwareDb;Trusted_Connection=True;MultipleActiveResultSets=true;TrustServerCertificate=True
```

Connection string’i kod içerisine sabit olarak gömme.

Development bağlantı bilgilerini aşağıdaki yöntemlerden biriyle yönet:

* appsettings.Development.json
* .NET User Secrets
* Environment variable

Gerçek parola, JWT secret, connection string veya credential bilgilerini GitHub’a gönderme.

# 6. Tema ve Dark Mode

Uygulama ilk açılışta varsayılan olarak dark mode kullansın.

Arayüz:

* Kurumsal
* Sade
* Modern
* Responsive
* Kolay okunabilir
* Masaüstü, tablet ve mobil uyumlu

olsun.

Sağ üst bölümde dark mode ve light mode arasında geçiş sağlayan tema butonu bulunsun.

Kullanıcının tema seçimini tarayıcının local storage alanında sakla.

Kayıtlı tema tercihi bulunmuyorsa dark mode kullan.

Tema sistemi merkezi CSS değişkenleri, theme provider veya eş değer merkezi yapı üzerinden yönetilsin.

Bileşenlere tek tek sabit renk yazma.

Aşağıdaki bileşenlerin her iki tema ile uyumlu olmasını sağla:

* Login ekranı
* Sidebar
* Üst menü
* Dashboard kartları
* Form alanları
* Açılır listeler
* Tablolar
* Modal pencereler
* Bildirimler
* Durum rozetleri
* Dosya yükleme alanları
* Rapor ekranları
* Hata sayfaları

# 7. Kullanıcı Rolleri

Aşağıdaki rolleri oluştur:

```text
Academic
FacultyAuthorizedUser
SystemAdministrator
```

## 7.1 Academic

Akademisyen:

* Yalnızca kendi oluşturduğu kayıtları görebilsin.
* Yalnızca kendi kayıtlarını ekleyebilsin.
* Kendi taslak kayıtlarını düzenleyebilsin.
* İzin verilen durumlarda kendi kayıtlarını güncelleyebilsin.
* Başka akademisyenlerin kayıtlarını göremesin.
* Başka akademisyenlere ait kayıt ID değerini URL’ye yazarak erişemesin.
* Başka fakültelerin verilerini göremesin.
* Fakülte alanını değiştiremesin.
* Yeni fakülte ekleyemesin.
* Yeni laboratuvar ekleyemesin.
* Yeni akademik dönem ekleyemesin.
* Mevcut program listesinden program seçebilsin.
* Program listede yoksa yeni program önerisi oluşturabilsin.
* Kendi taleplerini PDF, Excel veya CSV olarak dışarı aktarabilsin.
* Kendi bildirimlerini görebilsin.

## 7.2 FacultyAuthorizedUser

Fakülte yetkilisi:

* Yalnızca kendisine atanan fakültelerin kayıtlarını görebilsin.
* Birden fazla fakülte için yetkilendirilebilsin.
* Yetkili olmadığı fakültelerin kayıtlarını göremesin.
* Fakültesindeki talepleri filtreleyebilsin.
* Fakülte bazlı rapor oluşturabilsin.
* Program önerilerini görebilsin.
* Kendisine düzenleme yetkisi verilmişse kayıtları düzenleyebilsin.
* Fakülte veya laboratuvar ekleyemesin.
* Sistem yöneticisi yetkilerini kullanamasın.

Fakülte yetkisi kullanıcı bazlı tanımlanabilsin.

Yetki türleri gerektiğinde aşağıdaki gibi ayrılabilsin:

* Görüntüleme
* Düzenleme
* Raporlama
* Durum değiştirme

## 7.3 SystemAdministrator

Sistem yöneticisi:

* Tüm kullanıcıları görebilsin.
* Tüm fakülteleri görebilsin.
* Tüm talepleri görebilsin.
* Fakülte ekleyebilsin.
* Fakülte düzenleyebilsin.
* Fakülteyi pasif yapabilsin.
* Laboratuvar ekleyebilsin.
* Laboratuvar düzenleyebilsin.
* Laboratuvarı pasif yapabilsin.
* Program ekleyebilsin.
* Program düzenleyebilsin.
* Programı pasif yapabilsin.
* Program önerilerini onaylayabilsin.
* Program önerilerini reddedebilsin.
* Kullanıcı oluşturabilsin.
* Kullanıcı düzenleyebilsin.
* Kullanıcıyı pasif yapabilsin.
* Kullanıcılara rol atayabilsin.
* Kullanıcılara bir veya birden fazla fakülte yetkisi atayabilsin.
* Akademik dönemleri yönetebilsin.
* Taleplerin durumlarını değiştirebilsin.
* Rapor oluşturabilsin.
* Audit log kayıtlarını görebilsin.
* Sistem ayarlarını yönetebilsin.

# 8. Yetkilendirme Kuralları

Yetkilendirmeyi yalnızca frontend menü gizleme yöntemiyle yapma.

Bütün yetki kontrolleri backend API seviyesinde zorunlu olarak uygulansın.

Aşağıdaki kuralları uygula:

* Aktif kullanıcının UserId değerini JWT claim içinden al.
* Frontend’den gönderilen UserId değerine güvenme.
* Frontend’den gönderilen FacultyId değerine güvenme.
* Akademisyenin fakültesini backend tarafında kullanıcı hesabından belirle.
* Akademisyen sadece kendi UserId değeriyle ilişkili talepleri okuyabilsin.
* Akademisyen başka bir kayıt ID değeri göndererek başka kayda erişemesin.
* Fakülte yetkilisi sadece UserFacultyPermissions tablosunda izin verilen fakültelere erişebilsin.
* Sistem yöneticisi bütün verilere erişebilsin.
* Yetkisiz erişimlerde 403 Forbidden dön.
* Kayıt bulunamadığında 404 Not Found dön.
* Kimlik doğrulama yapılmadığında 401 Unauthorized dön.
* Dosya indirme işlemlerinde de aynı yetki kontrollerini uygula.
* Rapor oluşturma işlemlerinde de aynı fakülte ve kullanıcı filtrelerini uygula.
* Öğrenci listelerine erişimde özel yetki kontrolü uygula.
* Frontend’de yetkisiz menüleri gizle ancak backend kontrolünü kaldırma.

Yetki ihlallerini integration testlerle doğrula.

# 9. Fakülte Yönetimi

Fakülte verilerini yalnızca sistem yöneticisi ekleyebilsin.

Akademisyenler ve fakülte yetkilileri yeni fakülte ekleyemesin.

Fakülte tablosunda aşağıdaki alanlar bulunsun:

* Id
* Name
* Code
* Description
* IsActive
* CreatedAt
* UpdatedAt
* CreatedByUserId
* UpdatedByUserId
* IsDeleted
* DeletedAt

Akademisyenin fakültesi kullanıcı hesabına atanmış olsun.

Akademisyen yeni kayıt oluştururken fakülte alanı otomatik gelsin ve salt okunur gösterilsin.

Fakülte değişiklikleri audit log içine kaydedilsin.

# 10. Laboratuvar Yönetimi

Laboratuvar bilgilerini yalnızca sistem yöneticisi oluşturabilsin.

Laboratuvar tablosunda aşağıdaki alanlar bulunsun:

* Id
* Name
* Code
* Building
* Floor
* Capacity
* ComputerCount
* OperatingSystem
* Description
* IsActive
* CreatedAt
* UpdatedAt
* IsDeleted

Akademisyen talep oluştururken laboratuvar listesinden seçim yapabilsin.

Akademisyen yeni laboratuvar ekleyemesin.

Bir talep için bir veya birden fazla laboratuvar seçilebilsin.

Öğrenci sayısı laboratuvar kapasitesini aşarsa kullanıcıya uyarı göster.

Bu durum kayıt oluşturmayı tamamen engellemesin ancak uyarı ve yönetici raporuna yansısın.

# 11. Akademik Dönem

Her talep bir akademik dönem ile ilişkili olsun.

Akademik dönem tablosunda aşağıdaki alanlar bulunsun:

* Id
* AcademicYear
* TermName
* StartDate
* EndDate
* RequestStartDate
* RequestEndDate
* IsCurrent
* IsActive
* CreatedAt
* UpdatedAt

Örnek dönem adları:

* Güz
* Bahar
* Yaz Okulu

Talep dönemi sona ermişse akademisyen yeni talep oluşturamasın.

Sistem yöneticisi gerektiğinde belirli kullanıcı veya fakültelere ek süre verebilecek genişletilebilir bir yapı oluştur.

# 12. Program Yönetimi

Ana program listesini öncelikle sistem yöneticisi oluşturacak.

Program tablosunda aşağıdaki alanlar bulunsun:

* Id
* Name
* Manufacturer
* Description
* DefaultDownloadUrl
* LicenseType
* IsPaid
* SupportedOperatingSystems
* DefaultLanguage
* Version
* IsActive
* ApprovalStatus
* CreatedByUserId
* CreatedAt
* UpdatedAt
* IsDeleted

Ücret veya lisans alanı için aşağıdaki seçenekleri destekle:

* Ücretsiz
* Ücretli
* Üniversite Lisanslı
* Deneme Sürümü
* Açık Kaynak
* Bilinmiyor

Program seçim alanı aranabilir ve otomatik tamamlamalı olsun.

Aramada sonuç bulunamazsa aşağıdaki mesajı göster:

```text
Aradığınız program listede bulunamadı. Yeni program önerisi oluşturmak ister misiniz?
```

Yanında:

```text
Yeni Program Öner
```

butonu bulunsun.

# 13. Yeni Program Önerisi

Akademisyen program listede yoksa yeni program önerisi oluşturabilsin.

Program önerisi alanları:

* Program Adı
* Üretici
* Açıklama
* Program İndirme Linki
* Ücretli mi?
* Lisans Türü
* Program Dili
* Gerekli İşletim Sistemi
* Önerilen Sürüm
* Ek Not

Yeni program önerisinin başlangıç durumu:

```text
Onay Bekliyor
```

olsun.

Öneri doğrudan ana program listesine eklenmesin.

Yönetici öneriyi:

* Onaylayabilsin
* Reddedebilsin
* Düzenleyerek onaylayabilsin

Reddedilirken ret nedeni zorunlu olsun.

Programı öneren kullanıcı sonucu görebilsin.

Onaylanan program ana program listesine aktarılsın.

Aynı veya çok benzer isimli program önerisi varsa kullanıcı uyarılsın.

Mükerrer kontrolünde:

* Büyük-küçük harf
* Baştaki ve sondaki boşluklar
* Birden fazla boşluk
* Türkçe karakter karşılaştırması
* Yakın isim kontrolü

dikkate alınsın.

# 14. Laboratuvar Yazılım Talep Formu

Talep formunda aşağıdaki ana alanlar bulunacak:

* Ders Kodu
* Ders Adı
* Program Adı
* Gerekli Eklentiler
* Ücretli mi?
* Program İndirme Linki
* Dersin Hocasının E-Posta Adresi
* Ders Günü
* Ders Saati
* Lab Sınıfı
* Öğrenci Listesi
* Program Dili
* Fakülte

Ek olarak aşağıdaki alanları da ekle:

* Akademik Dönem
* Talep Açıklaması
* Talep Durumu
* Yönetici Notu
* Oluşturulma Tarihi
* Son Güncellenme Tarihi
* Oluşturan Kullanıcı
* Son Güncelleyen Kullanıcı

Talep formunu adımlı wizard yapısında oluştur:

1. Ders Bilgileri
2. Program Bilgileri
3. Eklenti Bilgileri
4. Ders Gün ve Saatleri
5. Laboratuvar Seçimi
6. Öğrenci Listesi
7. Kontrol ve Gönderim

Kullanıcı adımlar arasında ilerlerken kayıt taslak olarak otomatik kaydedilebilsin.

Son aşamada bütün bilgiler özet olarak gösterilsin.

Eksik zorunlu alan varsa talep gönderilemesin.

# 15. Talep Alanlarının Davranışları

## Ders Kodu

* Zorunlu olsun.
* En fazla 50 karakter kabul etsin.
* Baştaki ve sondaki boşlukları temizle.
* Büyük harfe dönüştürerek kaydet.

## Ders Adı

* Zorunlu olsun.
* En fazla 250 karakter kabul etsin.

## Program Adı

* Zorunlu olsun.
* Ana program listesinden seçilebilsin.
* Bir talebe birden fazla program eklenebilsin.
* Her program için farklı sürüm, eklenti, lisans, indirme linki ve dil bilgisi girilebilsin.

## Gerekli Eklentiler

Her programa birden fazla eklenti eklenebilsin.

Eklenti alanları:

* Eklenti Adı
* Sürüm
* İndirme Linki
* Açıklama

Eklenti gerekmiyorsa:

```text
Eklenti Gerekmiyor
```

seçeneği işaretlenebilsin.

## Ücretli mi?

Program kaydından otomatik gelebilsin.

Akademisyen gerektiğinde farklı lisans durumu seçebilsin ancak açıklama girmesi zorunlu olsun.

## Program İndirme Linki

* Program kaydında bağlantı varsa otomatik doldur.
* Kullanıcı farklı sürüm bağlantısı girebilsin.
* URL doğrulaması yap.
* HTTP ve HTTPS destekle.
* Zararlı veya geçersiz URL formatlarını engelle.

## Dersin Hocasının E-Posta Adresi

* Giriş yapan kullanıcının e-posta adresini varsayılan getir.
* Kullanıcı gerektiğinde değiştirebilsin.
* Geçerli e-posta formatı kontrolü yap.
* Üniversite e-posta domain kontrolünü sistem ayarlarından yapılandırılabilir yap.

## Ders Günü

Aşağıdaki seçenekleri kullan:

* Pazartesi
* Salı
* Çarşamba
* Perşembe
* Cuma
* Cumartesi
* Pazar

Bir ders için birden fazla gün ve saat eklenebilsin.

## Ders Saati

* Başlangıç ve bitiş saati ayrı alanlar olsun.
* 24 saat formatı kullan.
* Bitiş saati başlangıç saatinden önce olamasın.
* Birden fazla ders oturumu eklenebilsin.

## Lab Sınıfı

* Yönetici tarafından tanımlanmış laboratuvar listesinden seçilsin.
* Birden fazla laboratuvar seçilebilsin.
* Kapasite ve bilgisayar sayısı gösterilsin.

## Program Dili

Başlangıç seçenekleri:

* Türkçe
* İngilizce
* Almanca
* Fransızca
* Arapça
* Diğer
* Dil Bağımsız

“Diğer” seçildiğinde açıklama alanı açılsın.

## Fakülte

* Kullanıcı profilinden otomatik gelsin.
* Akademisyen değiştiremesin.
* Backend tarafında oturum bilgisinden belirlensin.
* Sistem yöneticisi gerektiğinde değiştirebilsin.
* Değişiklik audit log kaydına yazılsın.

# 16. Öğrenci Listesi

Öğrenci listesi iki yöntemle eklenebilsin:

1. Manuel öğrenci ekleme
2. Excel veya CSV yükleme

Öğrenci alanları:

* Öğrenci Numarası
* Ad
* Soyad
* E-Posta Adresi

Örnek Excel şablonunu oluştur:

```text
docs/Ogrenci-Listesi-Sablonu.xlsx
```

Dosya yüklemede:

* XLSX ve CSV destekle.
* Dosya uzantısını kontrol et.
* MIME type kontrol et.
* Dosya boyutu sınırı uygula.
* Maksimum dosya boyutunu yapılandırılabilir yap.
* Hatalı satırları kullanıcıya göster.
* Yüklemeden önce ön izleme göster.
* Kullanıcı onayından sonra kaydet.
* Aynı öğrenci numarasını aynı talep içinde iki kez ekleme.
* Bozuk veya parola korumalı dosyaları reddet.
* Yüklenen dosyalara rastgele güvenli dosya adı ver.
* Path traversal saldırılarına karşı koruma uygula.
* Öğrenci verilerini frontend public klasöründe saklama.
* Dosya indirmeyi yetkilendirilmiş API endpoint’i üzerinden yap.

Öğrenci listesine yalnızca:

* Talebi oluşturan akademisyen
* İlgili fakülte yetkilisi
* Sistem yöneticisi

erişebilsin.

Öğrenci numarası ve e-posta adresini normal uygulama loglarına yazma.

# 17. Talep Durumları

Aşağıdaki durumları oluştur:

* Taslak
* Gönderildi
* İnceleniyor
* Eksik Bilgi Bekleniyor
* Onaylandı
* Reddedildi
* Kurulum Planlandı
* Kurulum Tamamlandı
* İptal Edildi

Durum geçişleri kontrollü olsun.

Kurallar:

* Akademisyen taslak kaydı düzenleyebilsin.
* Gönderilen kayıtlardaki değişiklikler geçmişte tutulsun.
* Eksik Bilgi Bekleniyor durumuna alınırken açıklama zorunlu olsun.
* Akademisyen eksik bilgiyi tamamlayıp tekrar gönderebilsin.
* Reddedilirken ret nedeni zorunlu olsun.
* Kurulum tamamlandığında kurulum detayları kaydedilsin.

Kurulum alanları:

* Kurulumu Yapan Personel
* Kurulum Tarihi
* Kurulan Sürüm
* Kurulum Yapılan Laboratuvarlar
* Kurulum Notu

# 18. Kullanıcı Ekranları

## 18.1 Giriş Ekranı

* E-posta
* Parola
* Beni hatırla
* Parolayı göster/gizle
* Giriş butonu
* Hata mesajı
* Dark mode tasarım

İlk aşamada parola sıfırlama ekranını görsel olarak oluştur ancak gerçek e-posta gönderme işlemini development ortamında mock veya local mail service olarak bırak.

## 18.2 Akademisyen Dashboard

Aşağıdaki kartları göster:

* Toplam Talep
* Taslak
* Gönderildi
* İnceleniyor
* Eksik Bilgi Bekleniyor
* Onaylandı
* Kurulum Planlandı
* Kurulum Tamamlandı

Ayrıca:

* Son talepler
* Yaklaşan dersler
* Son bildirimler
* Onay bekleyen program önerileri

gösterilsin.

Akademisyen sadece kendi verilerini görsün.

## 18.3 Taleplerim

Tablo kolonları:

* Ders Kodu
* Ders Adı
* Programlar
* Fakülte
* Akademik Dönem
* Ders Günü
* Laboratuvar
* Talep Durumu
* Oluşturulma Tarihi
* İşlemler

İşlemler:

* Görüntüle
* Düzenle
* Kopyala
* Sil
* PDF indir
* Excel indir

Kopyala işleminde öğrenci listesinin kopyalanıp kopyalanmayacağı sorulsun.

## 18.4 Yönetici Paneli

Aşağıdaki menüler bulunsun:

* Genel Gösterge Paneli
* Bütün Talepler
* Program Yönetimi
* Program Önerileri
* Fakülte Yönetimi
* Laboratuvar Yönetimi
* Kullanıcı Yönetimi
* Rol ve Yetki Yönetimi
* Akademik Dönem Yönetimi
* Raporlar
* Bildirimler
* Audit Log
* Sistem Ayarları

# 19. Arama, Filtreleme ve Tablolar

Bütün ana tablolarda:

* Sayfalama
* Sıralama
* Serbest metin arama
* Kolon filtreleme
* Aktif filtreleri gösterme
* Filtreleri temizleme
* Sunucu taraflı pagination
* Sunucu taraflı filtering

özelliklerini uygula.

Talep filtreleri:

* Akademik dönem
* Fakülte
* Akademisyen
* Ders kodu
* Ders adı
* Program
* Laboratuvar
* Talep durumu
* Ücretli veya ücretsiz
* Ders günü
* Tarih aralığı

# 20. Raporlama

Sistem yöneticisi aşağıdaki raporları alabilsin:

* Fakülte bazlı program listesi
* Ders bazlı program listesi
* Laboratuvar bazlı program listesi
* Program bazlı kullanım listesi
* Ücretli programlar listesi
* Üniversite lisansı gerektiren programlar
* Program indirme linkleri
* Eklenti gerektiren programlar
* Program dili dağılımı
* Ders günü ve saatine göre laboratuvar kullanımı
* Laboratuvar kapasite raporu
* Akademisyen bazlı talep raporu
* Kurulumu tamamlanan programlar
* Kurulum bekleyen programlar
* Onay bekleyen program önerileri
* Fakülte bazlı öğrenci sayıları

Fakülte yetkilisi sadece yetkili olduğu fakültelerin raporlarını alabilsin.

Akademisyen sadece kendi kayıtları için rapor alabilsin.

Rapor formatları:

* Excel
* CSV
* PDF

Excel export formatında başlıklar Türkçe olsun.

# 21. Bildirimler

Uygulama içi bildirim sistemi oluştur.

Aşağıdaki durumlarda bildirim üret:

* Akademisyen yeni talep gönderdiğinde ilgili yetkililere
* Yeni program önerisi oluşturulduğunda yöneticilere
* Talep durumu değiştiğinde akademisyene
* Eksik bilgi istendiğinde akademisyene
* Program önerisi onaylandığında veya reddedildiğinde öneren kullanıcıya
* Kurulum tamamlandığında akademisyene
* Talep dönemi sona yaklaşırken henüz talep girmemiş kullanıcılara

İlk aşamada uygulama içi bildirimler çalışsın.

E-posta bildirim sistemi interface ve servis yapısıyla oluşturulsun ancak gerçek SMTP kullanımı environment ayarına bağlı olsun.

SMTP bilgilerini kod içine yazma.

# 22. Audit Log

Aşağıdaki işlemleri audit log içinde tut:

* Başarılı giriş
* Başarısız giriş
* Çıkış
* Kayıt oluşturma
* Kayıt güncelleme
* Kayıt silme
* Talep gönderme
* Talep durumu değiştirme
* Fakülte değiştirme
* Program ekleme
* Program önerme
* Program onaylama
* Program reddetme
* Kullanıcı oluşturma
* Kullanıcı rolü değiştirme
* Kullanıcı fakülte yetkisi değiştirme
* Öğrenci listesi yükleme
* Öğrenci listesi indirme
* Rapor indirme

Audit log alanları:

* Id
* UserId
* UserName
* ActionType
* EntityType
* EntityId
* OldValues
* NewValues
* IpAddress
* UserAgent
* CreatedAt

Parola, token, öğrenci listesi içeriği ve hassas bilgiler audit log içinde açık şekilde tutulmasın.

# 23. Veritabanı Tabloları

En az aşağıdaki tabloları oluştur:

* Users
* Roles
* UserRoles
* RefreshTokens
* Faculties
* UserFacultyPermissions
* AcademicTerms
* AcademicTermExtensions
* Laboratories
* Courses
* SoftwareApplications
* SoftwareSuggestions
* SoftwareRequests
* SoftwareRequestItems
* SoftwarePlugins
* CourseSchedules
* RequestLaboratories
* Students
* RequestStudents
* UploadedFiles
* Notifications
* AuditLogs
* SystemSettings

İlişkileri doğru foreign key yapısıyla oluştur.

Entity Framework migration dosyalarını üret.

İlk migration için anlamlı bir ad kullan:

```text
InitialCreate
```

# 24. Başlangıç Verileri

İlk çalıştırmada aşağıdaki roller otomatik oluşturulsun:

* Academic
* FacultyAuthorizedUser
* SystemAdministrator

Development ortamında aşağıdaki test kullanıcılarını oluştur:

```text
admin@fbu.edu.tr
akademisyen@fbu.edu.tr
fakulteyetkilisi@fbu.edu.tr
```

Roller:

```text
admin@fbu.edu.tr → SystemAdministrator
akademisyen@fbu.edu.tr → Academic
fakulteyetkilisi@fbu.edu.tr → FacultyAuthorizedUser
```

Parolaları kaynak kod içerisine yazma.

Environment variable kullan:

```text
INITIAL_ADMIN_PASSWORD
INITIAL_ACADEMIC_PASSWORD
INITIAL_FACULTY_USER_PASSWORD
```

Environment variable tanımlı değilse development seed işlemi güvenli ve açıklayıcı hata versin veya yalnızca development için güvenli bir kurulum yönergesi göster.

Development ortamında örnek fakülte oluştur:

```text
Mühendislik ve Mimarlık Fakültesi
```

Development ortamında örnek laboratuvar oluştur:

```text
Bilgisayar Laboratuvarı 301
```

Örnek programlar:

* Microsoft Office
* Microsoft Visual Studio
* Visual Studio Code
* MATLAB
* SPSS
* AutoCAD
* Adobe Creative Cloud
* Python
* R
* Java JDK
* Android Studio
* Cisco Packet Tracer

Örnek verileri yalnızca development seed içinde oluştur.

Production ortamında otomatik örnek fakülte veya kullanıcı oluşturma.

# 25. API Endpoint Yapısı

RESTful API yapısı oluştur.

En az aşağıdaki endpoint’leri geliştir:

## Authentication

```text
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
```

## Faculties

```text
GET    /api/faculties
GET    /api/faculties/{id}
POST   /api/faculties
PUT    /api/faculties/{id}
DELETE /api/faculties/{id}
```

## Laboratories

```text
GET    /api/laboratories
GET    /api/laboratories/{id}
POST   /api/laboratories
PUT    /api/laboratories/{id}
DELETE /api/laboratories/{id}
```

## Software

```text
GET    /api/software
GET    /api/software/{id}
GET    /api/software/search
POST   /api/software
PUT    /api/software/{id}
DELETE /api/software/{id}
```

## Software Suggestions

```text
POST /api/software/suggestions
GET  /api/software/suggestions
GET  /api/software/suggestions/my
POST /api/software/suggestions/{id}/approve
POST /api/software/suggestions/{id}/reject
```

## Requests

```text
GET    /api/requests/my
GET    /api/requests
GET    /api/requests/{id}
POST   /api/requests
PUT    /api/requests/{id}
DELETE /api/requests/{id}
POST   /api/requests/{id}/submit
POST   /api/requests/{id}/status
POST   /api/requests/{id}/copy
```

## Students

```text
POST /api/requests/{id}/students/import
POST /api/requests/{id}/students
GET  /api/requests/{id}/students
DELETE /api/requests/{requestId}/students/{studentId}
GET  /api/student-import/template
```

## Reports

```text
GET /api/reports/software
GET /api/reports/faculties
GET /api/reports/laboratories
GET /api/reports/requests
```

## Notifications

```text
GET  /api/notifications
POST /api/notifications/{id}/read
POST /api/notifications/read-all
```

## Audit

```text
GET /api/audit-logs
```

## Health

```text
GET /api/health
```

Swagger üzerinde request ve response modelleri anlaşılır şekilde gösterilsin.

# 26. Health Check

`GET /api/health` endpoint’i aşağıdaki kontrolleri yapsın:

* API çalışıyor mu?
* Veritabanına erişilebiliyor mu?
* Environment bilgisi
* Uygulama sürümü
* UTC tarih ve saat

Health check yanıtında:

* Connection string
* Parola
* Token
* Kullanıcı bilgisi
* Sunucu credential bilgisi

gösterme.

# 27. Güvenlik

Aşağıdaki güvenlik önlemlerini uygula:

* Parolaları ASP.NET Core Identity ile güvenli şekilde hashle.
* JWT access token kullan.
* Refresh token rotation uygula.
* Refresh token iptal mekanizması oluştur.
* Rate limiting uygula.
* Account lockout uygula.
* CORS ayarlarını environment bazlı yap.
* SQL injection riskine karşı Entity Framework ve parametrik sorgular kullan.
* XSS riskine karşı kullanıcı girdilerini güvenli işle.
* Dosya yüklemelerinde uzantı ve MIME type kontrolü yap.
* Path traversal saldırılarını engelle.
* Dosya boyutu sınırlaması uygula.
* Hassas değerleri environment variable veya user secrets ile yönet.
* Production ortamında Swagger erişimini sınırlandırılabilir yap.
* Stack trace bilgisini kullanıcıya gösterme.
* Güvenli HTTP başlıkları ekle.
* Development ve production ayarlarını ayır.
* API endpoint’lerine doğru authorization policy uygula.
* IDOR yetki açıklarını test et.
* Soft delete kullan.
* Log injection risklerine karşı girdileri güvenli işle.

# 28. Local PowerShell Scriptleri

Aşağıdaki scriptleri oluştur:

```text
scripts/setup-local.ps1
scripts/start-local.ps1
scripts/stop-local.ps1
scripts/reset-database.ps1
scripts/run-tests.ps1
scripts/check-secrets.ps1
```

## setup-local.ps1

* .NET paketlerini restore etsin.
* Frontend npm paketlerini yüklesin.
* User secret veya environment variable eksiklerini kontrol etsin.
* Veritabanı migration çalıştırsın.
* Development seed verilerini oluştursun.
* Gerekli development klasörlerini oluştursun.

## start-local.ps1

* Backend’i başlatsın.
* Frontend’i başlatsın.
* Kullanılan adresleri terminalde göstersin.
* Swagger adresini göstersin.
* Health check adresini göstersin.
* İşlemlerin process ID değerlerini saklasın.
* Aynı uygulama zaten çalışıyorsa ikinci kopyayı başlatmasın.

Varsayılan adresler:

```text
Frontend: http://localhost:5173
Backend: https://localhost:7001
Swagger: https://localhost:7001/swagger
Health: https://localhost:7001/api/health
```

Port kullanımdaysa rastgele başka porta geçme. Kullanıcıya anlaşılır hata ver.

## stop-local.ps1

Yalnızca bu projeye ait başlatılmış frontend ve backend process’lerini güvenli şekilde durdursun.

Başka Node.js veya .NET uygulamalarını topluca sonlandırma.

## reset-database.ps1

Development veritabanını silip migration ve seed ile yeniden oluştursun.

Production ortamında çalışmayı reddetsin.

İşlem öncesinde kullanıcıya açık bir uyarı göstersin.

## run-tests.ps1

* Backend unit testleri
* Backend integration testleri
* Frontend testleri
* Frontend lint
* Backend build
* Frontend build

işlemlerini çalıştırsın.

## check-secrets.ps1

Commit öncesinde aşağıdakileri kontrol etsin:

* .env dosyaları
* Parola içeren dosyalar
* JWT secret değerleri
* Connection string
* API key
* Private key
* Gerçek credential
* Öğrenci listesi
* Local veritabanı dosyaları

# 29. Docker Compose

Development kolaylığı için docker-compose.yml oluştur.

En az aşağıdaki servisleri destekle:

* Backend
* Frontend
* SQL Server

Ancak ilk varsayılan çalışma yöntemi Windows LocalDB ve PowerShell scriptleri olsun.

Docker kullanımı zorunlu olmasın.

README içinde hem LocalDB hem Docker yöntemini açıkla.

# 30. Testler

## Backend Unit Testleri

En az aşağıdaki testleri oluştur:

* Ders kodu doğrulama
* E-posta doğrulama
* Ders saati doğrulama
* Program önerisi mükerrer kontrolü
* Talep durum geçişleri
* Fakülte yetki kontrolü
* Program indirme linki doğrulaması

## Backend Integration Testleri

En az aşağıdaki senaryoları test et:

* Akademisyen kendi kaydını görebiliyor.
* Akademisyen başka akademisyenin kaydını göremiyor.
* Akademisyen URL ID değiştirerek başka kayda erişemiyor.
* Fakülte yetkilisi atanmış fakülteyi görebiliyor.
* Fakülte yetkilisi yetkisiz fakülteyi göremiyor.
* Sistem yöneticisi tüm kayıtları görebiliyor.
* Frontend’den farklı FacultyId gönderildiğinde backend bunu kabul etmiyor.
* Program önerisi onay bekliyor durumunda oluşuyor.
* Program onayı ana program kaydı oluşturuyor.
* Reddedilen program önerisinde ret nedeni zorunlu.
* Dosya yükleme doğrulamaları çalışıyor.
* Aynı öğrenci numarası iki kez eklenemiyor.
* Raporlarda kullanıcı ve fakülte filtresi uygulanıyor.
* Soft delete çalışıyor.
* Refresh token rotation çalışıyor.

## Frontend Testleri

* Login form doğrulaması
* Rol bazlı menü
* Dark mode varsayılanı
* Tema tercihini local storage içinde saklama
* Talep wizard adımları
* Program arama
* Yeni program önerme
* Öğrenci dosyası ön izleme
* Yetkisiz sayfaya erişim engeli
* Form hata mesajları
* Filtreleme ve pagination

# 31. README

README.md içinde aşağıdakileri ayrıntılı açıkla:

* Projenin amacı
* Teknoloji yapısı
* Mimari yapı
* Klasör yapısı
* Gereksinimler
* .NET 8 SDK kurulumu
* Node.js kurulumu
* SQL Server LocalDB kurulumu
* Docker ile çalıştırma
* Development environment variable tanımlama
* .NET User Secrets kullanımı
* İlk migration
* Veritabanı oluşturma
* Seed kullanıcıları
* Development kullanıcı e-posta adresleri
* Development parolalarının nasıl tanımlanacağı
* Backend çalıştırma
* Frontend çalıştırma
* PowerShell scriptleri
* Swagger kullanımı
* Health check kullanımı
* Testleri çalıştırma
* Git komutları
* GitHub repository bilgisi
* Güvenlik notları
* Bilinen eksikler
* Sonraki geliştirme aşamaları
* Active Directory ve Entra ID entegrasyonu için genişletme noktaları
* Production deployment öncesi yapılması gerekenler

README komutları Windows PowerShell ile uyumlu olsun.

# 32. Git Yapılandırması

Proje oluşturulduktan sonra Git repository başlat:

```powershell
git init
git branch -M main
```

Kapsamlı bir `.gitignore` oluştur.

Aşağıdaki dosya ve klasörlerin GitHub’a gönderilmesini engelle:

* .env
* .env.local
* .env.development.local
* appsettings.Production.json
* User Secrets
* Gerçek connection string içeren dosyalar
* JWT secret
* Parolalar
* API key değerleri
* Sertifikalar
* Private key dosyaları
* Yüklenen öğrenci listeleri
* Local veritabanı dosyaları
* Log dosyaları
* bin
* obj
* node_modules
* dist
* coverage
* .vs
* .vscode içerisindeki kişisel ayarlar
* IDE geçici dosyaları
* storage/development içeriği

`.env.example` oluştur ancak gerçek değer koyma.

# 33. GitHub İşlemleri

GitHub hesabı:

```text
kursat-ozdemir4562
```

GitHub repository adı:

```text
fbu-lab-yazilim-talep-sistemi
```

Repository private olarak oluşturulsun.

Repository açıklaması:

```text
Fenerbahçe Üniversitesi laboratuvarlarında kullanılacak yazılım taleplerinin akademisyenlerden toplanması ve yönetilmesi için geliştirilen web uygulaması.
```

Önce aşağıdaki kontrolleri yap:

```powershell
git --version
ssh -T git@github.com
gh auth status
```

Daha önce yapılandırılmış GitHub SSH bağlantısını kullan.

GitHub CLI kullanılabiliyorsa aşağıdaki yapıya eş değer işlem yap:

```powershell
gh repo create kursat-ozdemir4562/fbu-lab-yazilim-talep-sistemi `
  --private `
  --description "Fenerbahçe Üniversitesi laboratuvarlarında kullanılacak yazılım taleplerinin akademisyenlerden toplanması ve yönetilmesi için geliştirilen web uygulaması." `
  --source . `
  --remote origin
```

Beklenen SSH remote adresi:

```text
git@github.com:kursat-ozdemir4562/fbu-lab-yazilim-talep-sistemi.git
```

Repository zaten mevcutsa yeni repository oluşturmaya çalışma.

Mevcut repository’nin bu projeye ait olup olmadığını kontrol et.

`origin` remote zaten varsa mevcut adresi kontrol et.

Yanlış remote varsa güvenli şekilde düzeltmeden önce durumu kayda geçir.

Başka repository’ye yanlışlıkla push yapma.

# 34. Commit ve Push

İlk çalışan sürüm tamamlandıktan sonra şu kontrolleri sırayla yap:

1. Backend paketlerini restore et.
2. Backend’i derle.
3. Frontend paketlerini yükle.
4. Frontend lint çalıştır.
5. Frontend’i derle.
6. Migration oluştur.
7. Migration çalıştır.
8. Development seed verilerini oluştur.
9. Unit testleri çalıştır.
10. Integration testlerini çalıştır.
11. Frontend testlerini çalıştır.
12. Uygulamayı yerel ortamda başlat.
13. Health endpoint’ini kontrol et.
14. Admin login işlemini test et.
15. Akademisyen login işlemini test et.
16. Akademisyenin sadece kendi kaydını gördüğünü test et.
17. Fakülte yetkilisinin yalnızca atanmış fakülteyi gördüğünü test et.
18. Program önerisi oluşturmayı test et.
19. Dark mode açılışını kontrol et.
20. Secret taraması yap.
21. Git status çıktısını kontrol et.
22. Gerçek parola veya öğrenci verisi bulunmadığını doğrula.
23. Commit oluştur.
24. GitHub remote kontrolü yap.
25. Main branch’ini GitHub’a pushla.

İlk commit mesajı:

```text
feat: initialize FBU laboratory software request system
```

Komutlar:

```powershell
git add .
git commit -m "feat: initialize FBU laboratory software request system"
git push -u origin main
```

Build veya test hatası varsa çalışan sürüm gibi commit ve push yapma.

Önce hatayı analiz et ve mümkün olduğunca düzelt.

Tamamlanmamış özellikleri açık şekilde belirt.

# 35. Uygulama Tasarım Detayları

Sidebar menüsü rol bazlı olsun.

Admin menüsü ile akademisyen menüsü farklı olsun.

Kurumsal tasarımda aşağıdaki yapı kullanılabilir:

* Sol tarafta daraltılabilir sidebar
* Üstte kullanıcı bilgisi ve tema seçimi
* Dashboard kartları
* Modern tablo yapısı
* Durumlar için badge
* Formlarda adım göstergesi
* Mobil cihazlarda açılır menü
* Türkçe tarih ve saat formatı
* Yükleme işlemlerinde progress göstergesi
* Kaydetme işlemlerinde loading durumu
* Başarılı işlemlerde toast bildirimi
* Hatalarda anlaşılır Türkçe mesaj

Fenerbahçe Üniversitesi adını kullan ancak resmi logo dosyası verilmediği için internetten logo indirip kullanma.

Logo yerine başlangıçta metin veya sade `FBU` placeholder kullan.

# 36. Kod Kalitesi

* Nullable reference types aktif olsun.
* TypeScript strict mode aktif olsun.
* DTO ile entity modellerini ayır.
* Repository veya uygun data access abstraction kullan.
* Dependency Injection kullan.
* CancellationToken destekle.
* Async metotları doğru kullan.
* Merkezi hata yönetimi oluştur.
* Tutarlı API response modeli kullan.
* Kritik işlemlerde transaction kullan.
* Kod tekrarından kaçın.
* Magic string yerine enum veya constant kullan.
* Pagination modellerini standartlaştır.
* Tarihleri backend’de UTC sakla.
* Frontend’de Türkiye saatine uygun göster.
* Türkçe karakterleri doğru destekle.
* Veritabanında Unicode alanlar kullan.
* Hassas verileri loglama.
* N+1 query oluşmasını önle.
* Gerekli indexleri oluştur.

# 37. İlk Sürüm Öncelikleri

Aşağıdaki sıraya göre önceliklendir:

1. Projenin belirtilen klasörde oluşturulması
2. Güvenli authentication
3. Backend seviyesinde yetkilendirme
4. Akademisyenin yalnızca kendi verisini görmesi
5. Fakültenin otomatik gelmesi
6. Fakülte yetkilisinin yalnızca atanmış fakülteleri görmesi
7. Sistem yöneticisinin bütün verilere erişmesi
8. Talep oluşturma formu
9. Program listesi
10. Yeni program önerisi
11. Öğrenci listesi yükleme
12. Dark mode tasarım
13. Yönetici ekranları
14. Raporlama
15. Testler
16. Local çalışma scriptleri
17. README
18. GitHub private repository
19. Commit ve push

# 38. Çalışma Sırası

Aşağıdaki sırayla ilerle:

1. Hedef ana klasörün varlığını kontrol et.
2. Proje klasörünü oluştur.
3. Git repository başlat.
4. Backend solution ve projelerini oluştur.
5. Frontend React TypeScript projesini oluştur.
6. Temel klasör yapısını oluştur.
7. Domain entity ve enum yapılarını oluştur.
8. Entity Framework DbContext oluştur.
9. Migration oluştur.
10. Identity kullanıcı ve rol yapısını oluştur.
11. JWT ve refresh token altyapısını oluştur.
12. Seed rollerini oluştur.
13. Development kullanıcı seed yapısını oluştur.
14. Fakülte, laboratuvar ve akademik dönem yönetimini geliştir.
15. Program yönetimini geliştir.
16. Program önerisi sistemini geliştir.
17. Talep yönetimini geliştir.
18. Öğrenci listesi işlemlerini geliştir.
19. Yetkilendirme policy’lerini geliştir.
20. Audit log altyapısını geliştir.
21. Bildirim altyapısını geliştir.
22. Raporlama altyapısını geliştir.
23. Frontend login ekranını oluştur.
24. Dark mode altyapısını oluştur.
25. Akademisyen dashboard oluştur.
26. Talep wizard ekranını oluştur.
27. Taleplerim ekranını oluştur.
28. Fakülte yetkilisi ekranlarını oluştur.
29. Yönetici panelini oluştur.
30. Tablolar, filtreler ve sayfalamayı ekle.
31. Local scriptleri oluştur.
32. Excel öğrenci şablonunu oluştur.
33. README ve teknik dokümantasyonu oluştur.
34. Backend build çalıştır.
35. Frontend build çalıştır.
36. Testleri çalıştır.
37. Uygulamayı local başlat.
38. Health endpoint’ini kontrol et.
39. Login ve yetki testlerini yap.
40. Hataları düzelt.
41. Secret taraması yap.
42. Git commit oluştur.
43. GitHub private repository oluştur veya mevcut repository’ye bağlan.
44. Main branch’ini GitHub’a pushla.

# 39. İşlem Sonu Raporu

Bütün işlemler tamamlandığında aşağıdaki bilgileri açık bir özet halinde göster:

* Projenin tam klasör yolu
* Frontend adresi
* Backend adresi
* Swagger adresi
* Health check adresi
* Veritabanı adı
* Migration adı
* Development kullanıcıları
* Environment variable olarak tanımlanması gereken değerler
* Backend build sonucu
* Frontend build sonucu
* Unit test sonucu
* Integration test sonucu
* Frontend test sonucu
* Local çalışma sonucu
* Health check sonucu
* Git branch adı
* Son commit hash değeri
* GitHub repository adı
* GitHub remote adresi
* Repository private mı?
* Push işlemi başarılı mı?
* Tamamlanan özellikler
* Tamamlanmayan özellikler
* Mock veya geçici bırakılan özellikler
* Bilinen sorunlar
* Uygulamayı tekrar çalıştırmak için kullanılacak komut

Çalışmayan, test edilmemiş veya geçici bırakılan bir özelliği tamamlanmış gibi gösterme.

Herhangi bir GitHub authentication sorunu olursa proje geliştirme ve yerel test işlemlerini tamamla. GitHub push işleminin neden yapılamadığını açıkça raporla.

Herhangi bir gereksinim belirsizse güvenli, yönetilebilir ve üniversite ortamına uygun varsayımlar kullan. Gereksiz yere soru sormadan çalışan ilk sürümü tamamlamaya odaklan.


# ############################################################

Uygulamada hiç time out koymadık 15 dakika hiç bir işlem yapılmazsa zorunlu logout yap. Sekmeler arası paylaşımlı olsun aynı anda 1 den fazla sekme açıksa herhenagi bir sekmede yapılan işlem yeterlidir.
# ############################################################
SAML ekranı wazuhmanager gibi olsun
Talep Toplama tarih ayarları girilen alanda saat ayarlama da  olsun.


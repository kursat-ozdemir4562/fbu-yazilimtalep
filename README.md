# FBU Laboratuvar Yazılım Talep Sistemi

Fenerbahçe Üniversitesi bilgisayar laboratuvarlarında kullanılacak program, eklenti, ders oturumu, laboratuvar ve öğrenci listesi gereksinimlerinin akademisyenlerden toplanması; fakülte kapsamına göre değerlendirilmesi, raporlanması ve kurulum sürecinin izlenmesi için geliştirilen web uygulamasıdır.

Bu depo yerel geliştirme/MVP teslimidir. Üniversitenin canlı Active Directory, Microsoft Entra ID, SQL Server, SMTP, dosya servisi, DNS veya yayın altyapısına bağlanmaz.

## Güncel doğrulama durumu

> Aşağıdaki kayıt 28 Temmuz 2026 tarihinde bu geliştirme bilgisayarında yapılan önkoşul kontrollerini gösterir. README içindeki komutlar bir çalıştırma kılavuzudur; bu tablo açıkça başarılı demedikçe build, test, migration, login veya health check işlemlerinin geçtiği anlamına gelmez.

| Kontrol | Bu makinedeki durum | Sonuç |
| --- | --- | --- |
| .NET 8 SDK | Kurulu değil; yalnız .NET 10 SDK sürümleri var | `net8.0` API/Infrastructure build'i SDK 10 ile geçti; belirtilen geliştirme toolchain'i için .NET 8 SDK yine kurulmalıdır |
| Node.js / npm | Node.js `24.18.0` ve npm `11.16.0` kullanıcı `PATH` alanına kuruldu | Eski açık terminallerde yeni `PATH` için PowerShell yeniden açılmalı veya script kullanılmalıdır |
| Backend build | Nihai kaynak ağacında Release build başarılı | 0 uyarı, 0 hata; LocalDB çalışma zamanı doğrulaması değildir |
| Backend unit test | Nihai koşuda 24/24 başarılı | Tüm unit testleri geçti |
| Backend integration test | Nihai koşuda izole InMemory sağlayıcısıyla 20/20 başarılı | Tüm integration testleri geçti; SQL Server migration testi yerine geçmez |
| Frontend build | Vite `8.1.5` production build başarılı | Son paket JS 439,70 kB (gzip 126,65 kB), CSS 48,54 kB (gzip 9,51 kB) |
| Frontend lint/format | ESLint 0 uyarı; Prettier check başarılı | Kaynak kalite kontrolleri geçti |
| Frontend test | 7 test dosyasında 25/25 başarılı | Login, tema/menü, guard/hata, wizard, import, filtre/sayfalama ve API contract testleri geçti |
| Frontend dependency audit | Production ve tüm bağımlılıklarda 0 güvenlik açığı | `npm audit --omit=dev` ve `npm audit` başarılı |
| SQL Server LocalDB | `SqlLocalDB.exe` bulunamadı | Varsayılan LocalDB kurulumu, migration ve seed çalıştırılamadı |
| Docker | Docker istemcisi var, Docker Desktop/Linux daemon çalışmıyor | Compose ile çalışma doğrulanmadı |
| GitHub CLI | Kimliği doğrulanmış bir `gh` oturumu kullanılamıyor | Private repository oluşturma ve push doğrulanmadı |
| Git | `main` dalı başlatıldı; henüz doğrulanmış commit veya `origin` yok | Build/test/secret taraması tamamlanmadan push yapılmamalıdır |
| Uygulamanın yerel çalışması | Önkoşullar eksik | Swagger, health, seed hesapları ve rol senaryoları henüz çalışma zamanında doğrulanmış sayılmaz |

## Amaç ve yetki sınırları

Sistem üç rolü destekleyecek şekilde tasarlanmıştır:

- `Academic`: Yalnız kendi taleplerini görür ve yönetir. Fakültesi oturum açan kullanıcının profilinden sunucu tarafında belirlenir.
- `FacultyAuthorizedUser`: Yalnız kendisine atanmış fakültelerde, verilmiş görüntüleme/düzenleme/raporlama/durum değiştirme izinleri kapsamında işlem yapar.
- `SystemAdministrator`: Kullanıcı, fakülte, laboratuvar, akademik dönem, ana program listesi, öneri, talep, rapor ve audit kayıtlarını sistem genelinde yönetir.

Yetkilendirme yalnız frontend menülerini gizlemeye dayanmaz. API; JWT içindeki kullanıcı kimliğini ve kalıcı fakülte izinlerini kullanır, istemciden gelen `UserId` veya akademisyen için gönderilen `FacultyId` değerine güvenmez. Talep ayrıntısı, öğrenci listesi, dosya indirme ve rapor işlemleri de aynı kapsam kontrolünden geçmelidir.

Başlıca iş akışları şunlardır:

- Çok adımlı talep sihirbazı ve taslak kaydı
- Bir talepte birden fazla program, eklenti, ders oturumu ve laboratuvar
- Manuel veya XLSX/CSV üzerinden öğrenci listesi
- Listede olmayan program için yönetici onaylı öneri süreci
- Talep durum yaşam döngüsü ve kurulum takibi
- Rol kapsamını koruyan raporlama, bildirim ve audit kayıtları
- Varsayılan koyu tema ve tarayıcıda saklanan tema tercihi

## Teknoloji yapısı

| Katman | Teknolojiler |
| --- | --- |
| Backend | ASP.NET Core 8 Web API, C#, Entity Framework Core 8, SQL Server, ASP.NET Core Identity, JWT access token ve refresh token rotation, FluentValidation, Swagger/OpenAPI, merkezi hata yönetimi, health checks |
| Frontend | React 18, TypeScript strict mode, Vite, React Router, TanStack Query, React Hook Form, Zod, Vitest, Testing Library, ESLint ve Prettier |
| Veri ve raporlama | SQL Server LocalDB veya SQL Server container, EF Core migration, development seed, soft delete, audit log, ClosedXML |
| Çalıştırma | Windows PowerShell scriptleri; isteğe bağlı Docker Compose, Nginx ve SQL Server 2022 container |
| Test/CI | xUnit unit ve integration testleri, Vitest frontend testleri ve GitHub Actions iş akışı |

## Mimari

Backend, Clean Architecture bağımlılık yönünü izleyen dört projeye ayrılır:

```text
React + TypeScript
        |
        | HTTPS / JSON / JWT
        v
FbuLabSoftware.Api
        |
        v
FbuLabSoftware.Application ---> FbuLabSoftware.Domain
        ^                              ^
        |                              |
FbuLabSoftware.Infrastructure --------+
        |
        +---- SQL Server / dosya alanı / harici servis adaptörleri
```

- `Domain`: Entity, enum, durum geçişi ve saf domain kuralları.
- `Application`: Use-case sözleşmeleri, DTO, validator, sayfalama ve yetkilendirme bağlamları.
- `Infrastructure`: EF Core, Identity, JWT/refresh token, repository/servis uygulamaları, seed, audit, dosya ve rapor işlemleri.
- `Api`: Controller, authentication/authorization policy, middleware, rate limit, Swagger ve health check yapılandırması.
- `frontend`: API istemcisi, route guard, sorgu önbelleği, formlar, tema ve rol bazlı kullanıcı deneyimi.

Controller içinde doğrudan iş kuralı veya veri erişimi bulunmaması hedeflenir. Ayrıntılı tasarım için [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) dosyasına bakın.

## Klasör yapısı

```text
FBU-Lab-Yazilim-Talep-Sistemi/
├── .config/                         # Yerel dotnet tool manifesti
├── .github/workflows/               # CI iş akışı
├── backend/
│   ├── src/
│   │   ├── FbuLabSoftware.Domain/
│   │   ├── FbuLabSoftware.Application/
│   │   ├── FbuLabSoftware.Infrastructure/
│   │   └── FbuLabSoftware.Api/
│   └── tests/
│       ├── FbuLabSoftware.UnitTests/
│       └── FbuLabSoftware.IntegrationTests/
├── frontend/                        # React + TypeScript + Vite
├── docs/                            # Mimari, güvenlik ve test belgeleri
├── scripts/                         # Windows yerel çalışma scriptleri
├── storage/development/             # Git dışı yükleme ve log alanı
├── .env.example                     # Yalnız boş Docker değişken şablonu
├── docker-compose.yml
├── FbuLabSoftware.sln
└── README.md
```

## Önkoşullar

Varsayılan yöntem Windows + LocalDB + PowerShell'dir. Docker isteğe bağlıdır.

- Windows 10/11 ve Windows PowerShell 5.1 veya PowerShell 7
- [.NET 8 SDK](https://learn.microsoft.com/dotnet/core/install/windows)
- [Node.js LTS](https://nodejs.org/en/download) ve npm
- [SQL Server Express LocalDB](https://learn.microsoft.com/sql/database-engine/configure-windows/sql-server-express-localdb) — varsayılan yöntem için
- Git
- İsteğe bağlı: Docker Desktop ve GitHub CLI

### .NET 8 SDK kurulumu

Yönetici PowerShell'inde:

```powershell
winget install --exact --id Microsoft.DotNet.SDK.8
```

Terminali kapatıp yeniden açtıktan sonra doğrulayın:

```powershell
dotnet --list-sdks
dotnet --version
```

Listede bir `8.0.x` SDK bulunmalıdır. Yalnız runtime kurulması geliştirme için yeterli değildir.

### Node.js kurulumu

```powershell
winget install --exact --id OpenJS.NodeJS.LTS
```

Yeni bir PowerShell açıp doğrulayın:

```powershell
node --version
npm.cmd --version
```

Komut hâlâ bulunamıyorsa açık terminal eski kullanıcı `PATH` değerini kullanıyordur; yeni oturum açın. Proje scriptleri Windows'ta yürütülebilir dosyayı açıkça çağırmak için `npm.cmd` kullanır.

### SQL Server LocalDB kurulumu

SQL Server Express kurulum medyasında **LocalDB** özelliğini seçin. Alternatif olarak Visual Studio Installer içindeki **Data storage and processing / Veri depolama ve işleme** iş yükünden veya tekil **SQL Server Express LocalDB** bileşeninden kurabilirsiniz.

Kurulumdan sonra yeni PowerShell'de:

```powershell
Get-Command SqlLocalDB.exe
SqlLocalDB.exe info
```

`MSSQLLocalDB` örneği yoksa oluşturup başlatın; varsa yalnız başlatın:

```powershell
$instances = @(SqlLocalDB.exe info)
if ($instances -notcontains 'MSSQLLocalDB') {
    SqlLocalDB.exe create MSSQLLocalDB -s
}
else {
    SqlLocalDB.exe start MSSQLLocalDB
}

SqlLocalDB.exe info MSSQLLocalDB
```

Başka LocalDB örneklerini silmeyin. Bu projenin development veritabanı adı `FbuLabSoftwareDb`'dir.

## Proje dizinine geçiş

Tüm komutları proje kökünde çalıştırın:

```powershell
$projectRoot = 'C:\Users\muhammet.ozdemir\OneDrive - Fenerbahçe Üniversitesi\PROBOOK 440 G7\CODEX\FBU-Lab-Yazilim-Talep-Sistemi'
Set-Location -LiteralPath $projectRoot
```

## Development yapılandırması ve sırlar

Gerçek parola, JWT anahtarı, credential, öğrenci listesi veya kimlik bilgili connection string'i kaynak koda, `appsettings*.json`, `.env.example`, terminal çıktısı ya da Git geçmişine yazmayın.

### Gerekli değişkenler

| Anahtar | Kullanım | Zorunluluk |
| --- | --- | --- |
| `ConnectionStrings__DefaultConnection` | Yerel SQL Server bağlantısı | LocalDB için önerilir; yapılandırılmış varsayılan yoksa zorunlu |
| `Database__Provider` / `Database__Name` | `SqlServer` veya geçici `InMemory` sağlayıcısı ve InMemory adı | Normal geliştirmede `SqlServer`; yalnız smoke/test için override |
| `JWT_SECRET` / `Jwt__Secret` | JWT imza anahtarı | Development çalıştırması için zorunlu |
| `INITIAL_ADMIN_PASSWORD` | Admin seed hesabının kullanıcı tarafından seçilen parolası | Development seed için zorunlu |
| `INITIAL_ACADEMIC_PASSWORD` | Akademisyen seed hesabının kullanıcı tarafından seçilen parolası | Development seed için zorunlu |
| `INITIAL_FACULTY_USER_PASSWORD` | Fakülte yetkilisi seed hesabının kullanıcı tarafından seçilen parolası | Development seed için zorunlu |
| `Cors__AllowedOrigins__0` | İzinli frontend origin'i | Yerelde varsayılan `http://localhost:5173` |
| `Storage__StudentImportsPath` | Korumalı öğrenci yükleme alanı | Yerelde `storage\development\student-imports` |
| `Uploads__MaxStudentFileBytes` | İşlenen öğrenci dosyası sınırı | Varsayılan `5242880` (5 MiB) |
| `Uploads__AbsoluteMaxFileBytes` | Sunucu tarafı mutlak yükleme üst sınırı | Varsayılan `52428800` (50 MiB); düşürülebilir |
| `VITE_API_BASE_URL` | Frontend API taban yolu | Varsayılan `/api` |
| `VITE_PROXY_TARGET` | Vite development proxy hedefi | Varsayılan `https://localhost:7001` |
| `VITE_MAX_STUDENT_FILE_MB` | Frontend öğrenci dosyası sınırı | Varsayılan `5` |
| `SQL_SA_PASSWORD` | Docker SQL Server `sa` parolası | Yalnız Docker için zorunlu |
| `Smtp__Username`, `Smtp__Password` | Talep gönderildiğinde adminlere/fakülte yetkililerine ve talebi açan kişiye otomatik bilgi e-postası göndermek için kullanılan SMTP sağlayıcısının (isteğe bağlı) kimlik bilgileri | Host/Port/From/EnableSsl artık ortam değişkeni değil — Sistem Ayarları ekranından (`SmtpHost`, `SmtpPort`, `SmtpFrom`, `SmtpEnableSsl` anahtarları) yönetilir; `SmtpHost`/`SmtpFrom` boşsa e-posta gönderilmez, yalnızca loglanır |

ASP.NET Core hiyerarşik anahtarlarında environment variable için `:` yerine çift alt çizgi (`__`) kullanılır.

`appsettings.Development.json`, yalnız Windows Integrated Authentication kullanan parolasız LocalDB varsayılanını içerir. Environment variable veya User Secrets aynı anahtarı güvenli biçimde override eder; kullanıcı adı/parola içeren gerçek SQL bağlantısı dosyaya eklenmemelidir.

### Geçerli PowerShell oturumu için environment variable

Parolaları komut geçmişine yazmamak için etkileşimli okuyun:

```powershell
function Set-ProcessSecret {
    param([Parameter(Mandatory)][string]$Name)

    $secureValue = Read-Host "$Name değerini girin" -AsSecureString
    $plainValue = [System.Net.NetworkCredential]::new('', $secureValue).Password
    Set-Item -Path "Env:$Name" -Value $plainValue
    Remove-Variable secureValue, plainValue
}

$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:ConnectionStrings__DefaultConnection = 'Server=(localdb)\MSSQLLocalDB;Database=FbuLabSoftwareDb;Trusted_Connection=True;MultipleActiveResultSets=true;TrustServerCertificate=True'
$env:Cors__AllowedOrigins__0 = 'http://localhost:5173'
$env:Storage__StudentImportsPath = Join-Path $PWD 'storage\development\student-imports'

Set-ProcessSecret 'JWT_SECRET'
$env:Jwt__Secret = $env:JWT_SECRET
Set-ProcessSecret 'INITIAL_ADMIN_PASSWORD'
Set-ProcessSecret 'INITIAL_ACADEMIC_PASSWORD'
Set-ProcessSecret 'INITIAL_FACULTY_USER_PASSWORD'
```

Bu değerler yalnız açık PowerShell sürecinde ve bu süreçten başlatılan uygulamalarda yaşar. Yeni terminalde yeniden tanımlanmalıdır. Uzun ömürlü sırları kullanıcı environment variable alanına yazmak düz metin saklama riski taşıdığı için önerilmez.

### .NET User Secrets

User Secrets development içindir; şifreli bir production secret kasası değildir ve Git'e eklenmez. API projesi `fbu-lab-software-api-development` User Secrets kimliğiyle hazırlanmıştır. Proje yolunu tanımlayın:

```powershell
$apiProject = '.\backend\src\FbuLabSoftware.Api\FbuLabSoftware.Api.csproj'
```

LocalDB bağlantısını kaydedin:

```powershell
dotnet user-secrets set 'ConnectionStrings:DefaultConnection' `
  'Server=(localdb)\MSSQLLocalDB;Database=FbuLabSoftwareDb;Trusted_Connection=True;MultipleActiveResultSets=true;TrustServerCertificate=True' `
  --project $apiProject
```

JWT anahtarını etkileşimli alıp kaydedin:

```powershell
$secureValue = Read-Host 'JWT imza anahtarı' -AsSecureString
$plainValue = [System.Net.NetworkCredential]::new('', $secureValue).Password
dotnet user-secrets set 'Jwt:Secret' $plainValue --project $apiProject
Remove-Variable secureValue, plainValue
```

Uygulama seed parolalarını önce `Seed:<ENV_KEY>` yapılandırmasından, sonra aynı adlı environment variable'dan okuyabilir. Script kullanmadan elle çalıştırmada parolaları User Secrets'a etkileşimli kaydetmek için:

```powershell
function Set-SeedUserSecret {
    param([Parameter(Mandatory)][string]$EnvironmentKey)

    $secureValue = Read-Host "$EnvironmentKey değerini girin" -AsSecureString
    $plainValue = [System.Net.NetworkCredential]::new('', $secureValue).Password
    dotnet user-secrets set "Seed:$EnvironmentKey" $plainValue --project $apiProject
    Remove-Variable secureValue, plainValue
}

Set-SeedUserSecret 'INITIAL_ADMIN_PASSWORD'
Set-SeedUserSecret 'INITIAL_ACADEMIC_PASSWORD'
Set-SeedUserSecret 'INITIAL_FACULTY_USER_PASSWORD'
```

`setup-local.ps1` ise ön kontrolünde özellikle `INITIAL_*_PASSWORD` process/user/machine environment variable adlarını arar. Bu scripti kullanırken üç parolayı environment variable bölümündeki etkileşimli yöntemle tanımlayın. Parolalar birbirinden farklı, Identity politikasını karşılayan ve yalnız yerel test için üretilmiş değerler olmalıdır. Bu depo hiçbir varsayılan parola yayımlamaz.

Mevcut Identity politikası parolada en az 10 karakter, büyük harf, küçük harf, rakam ve alfasayısal olmayan karakter ister. JWT imza anahtarı UTF-8 olarak en az 32 bayt olmalıdır. Bunlar asgari geliştirme kontrolleridir; production politikası kurum güvenlik standardına göre sertleştirilmelidir.

## İlk kurulum: LocalDB

Önkoşullar ve sırlar hazırlandıktan sonra önerilen yol:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\setup-local.ps1
```

Script; NuGet restore, frontend paket kurulumu, development klasörleri, EF tool restore, migration uygulama ve development seed adımlarını yürütür. Veritabanı olmadan yalnız bağımlılık/klasör hazırlamak için:

```powershell
.\scripts\setup-local.ps1 -SkipDatabase
```

`-SkipDatabase`, migration veya seed işleminin başarılı olduğunu göstermez.

### Geçici InMemory smoke modu

LocalDB henüz kurulmamışsa yalnız API/UI geliştirme duman testi için kalıcı olmayan InMemory sağlayıcısı kullanılabilir:

```powershell
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:Database__Provider = 'InMemory'
$env:Database__Name = 'FbuLabSoftware-LocalSmoke'
```

Ardından önceki bölümlerdeki JWT/seed sırlarını tanımlayıp backend'i elle başlatın. Bu mod yalnız `Development` ve `Testing` ortamlarında kabul edilir; süreç durunca veri kaybolur, SQL Server davranışını veya EF migration'larını doğrulamaz ve production için kullanılamaz. `setup-local.ps1` ile paketleri hazırlarken `-SkipDatabase` kullanın.

### Migration ve veritabanını elle yönetme

Değişkenleri tanımladıktan sonra:

```powershell
$apiProject = '.\backend\src\FbuLabSoftware.Api\FbuLabSoftware.Api.csproj'
$infrastructureProject = '.\backend\src\FbuLabSoftware.Infrastructure\FbuLabSoftware.Infrastructure.csproj'

dotnet tool restore
dotnet ef database update `
  --project $infrastructureProject `
  --startup-project $apiProject `
  --context AppDbContext
```

Depodaki ilk migration `20260728074019_InitialCreate` olup `backend\src\FbuLabSoftware.Infrastructure\Persistence\Migrations` altında tutulur. Yeniden aynı adlı migration üretmeyin. Veri modeli bilinçli olarak değiştirildiğinde yeni migration oluşturma örneği:

```powershell
dotnet ef migrations add DegisikligiAciklayanAd `
  --project $infrastructureProject `
  --startup-project $apiProject `
  --context AppDbContext `
  --output-dir Persistence\Migrations
```

İlk migration henüz depoda yoksa bakım sorumlusu aşağıdaki komutla bir kez oluşturur:

```powershell
dotnet ef migrations add InitialCreate `
  --project $infrastructureProject `
  --startup-project $apiProject `
  --context AppDbContext `
  --output-dir Persistence\Migrations
```

Migration uygulandığında `FbuLabSoftwareDb` veritabanı oluşturulur. Development seed'i tek başına çalıştırmak için:

```powershell
$env:ASPNETCORE_ENVIRONMENT = 'Development'
dotnet run --project $apiProject --no-launch-profile -- --seed-only
```

Seed işlemi yalnız `Development` ortamında çalışmalıdır ve gerçek/production veri üretmez.

API başlangıçta ilişkisel veritabanına bekleyen migration'ları uygular; ardından rol seed'ini ve yalnız Development/Testing ortamında örnek verileri çalıştırır. `--seed-only`, bu hazırlık tamamlanınca HTTP sunucusunu açmadan çıkar. Production'da otomatik migration yerine kurumun onaylı release/migration prosedürü tercih edilmelidir.

## Development seed verileri

Parolalar kaynak kodda bulunmaz; yukarıdaki environment variable değerlerinden çalışma anında alınır.

| E-posta | Rol | Parola kaynağı |
| --- | --- | --- |
| `admin@fbu.edu.tr` | `SystemAdministrator` | `INITIAL_ADMIN_PASSWORD` |
| `akademisyen@fbu.edu.tr` | `Academic` | `INITIAL_ACADEMIC_PASSWORD` |
| `fakulteyetkilisi@fbu.edu.tr` | `FacultyAuthorizedUser` | `INITIAL_FACULTY_USER_PASSWORD` |

Development seed ayrıca `Mühendislik ve Mimarlık Fakültesi`, `Bilgisayar Laboratuvarı 301`, güncel örnek akademik dönem ve örnek program kataloğunu oluşturur. Seed tekrar çalıştırılabilir olmalı, aynı kayıtları çoğaltmamalıdır. Production ortamında örnek kullanıcı, fakülte veya laboratuvar otomatik oluşturulmamalıdır.

## Uygulamayı çalıştırma

### Önerilen PowerShell scripti

```powershell
.\scripts\start-local.ps1
```

Beklenen yerel adresler:

| Bileşen | Adres |
| --- | --- |
| Frontend | `http://localhost:5173` |
| Backend HTTPS | `https://localhost:7001` |
| Backend HTTP | `http://localhost:7000` |
| Swagger | `https://localhost:7001/swagger` |
| Health | `https://localhost:7001/api/health` |

Script 5173 ve 7001 portlarını kontrol eder, rastgele porta geçmez, PID bilgilerini `.local\processes.json` içinde ve çıktıları `storage\development\logs` altında tutar. Aynı proje zaten çalışıyorsa ikinci kopyayı başlatmayı reddeder.

Development HTTPS sertifikası güvenilmiyorsa:

```powershell
dotnet dev-certs https --trust
```

Yalnız bu projeye ait kayıtlı süreçleri durdurmak için:

```powershell
.\scripts\stop-local.ps1
```

### Backend'i elle çalıştırma

Birinci PowerShell:

```powershell
dotnet restore .\FbuLabSoftware.sln
dotnet run `
  --project .\backend\src\FbuLabSoftware.Api\FbuLabSoftware.Api.csproj `
  --no-launch-profile `
  -- `
  --urls 'https://localhost:7001;http://localhost:7000'
```

Bu terminal, development environment variable değerlerini veya User Secrets erişimini görmelidir.

### Frontend'i elle çalıştırma

İkinci PowerShell:

```powershell
Set-Location -LiteralPath .\frontend
if (Test-Path -LiteralPath .\package-lock.json) {
    npm.cmd ci
}
else {
    npm.cmd install
}
npm.cmd run dev -- --host localhost --port 5173 --strictPort
```

Vite, `/api` isteklerini varsayılan olarak `https://localhost:7001` adresine yönlendirir. Farklı bir API hedefi gerekiyorsa frontend'i başlatmadan önce `$env:VITE_PROXY_TARGET` tanımlayın.

## PowerShell scriptleri

| Script | İşlev |
| --- | --- |
| `.\scripts\setup-local.ps1` | Backend/frontend bağımlılıklarını hazırlar, klasörleri oluşturur, migration ve seed çalıştırır |
| `.\scripts\setup-local.ps1 -SkipDatabase` | Migration/seed olmadan bağımlılıkları hazırlar |
| `.\scripts\start-local.ps1` | Backend ve frontend'i başlatır, PID ve log yollarını saklar |
| `.\scripts\stop-local.ps1` | Yalnız kayıtlı proje süreçlerini durdurur |
| `.\scripts\reset-database.ps1` | Onay alarak development veritabanını siler, migration ve seed ile yeniden oluşturur |
| `.\scripts\reset-database.ps1 -Force` | Etkileşimli onayı atlar; tüm yerel development verisini geri alınamaz biçimde siler |
| `.\scripts\run-tests.ps1` | Backend build/unit/integration ile frontend install/lint/test/build adımlarını çalıştırır |
| `.\scripts\check-secrets.ps1` | Commit öncesi secret, credential, öğrenci dosyası ve yerel veritabanı taraması yapar |

`reset-database.ps1 -Force` yalnız silinecek verinin gerçekten development verisi olduğu doğrulandıktan sonra kullanılmalıdır. Script production ortamında çalışmayı reddeder.

## Swagger ve health check

Development API çalışırken Swagger UI:

```powershell
Start-Process 'https://localhost:7001/swagger'
```

Korumalı endpoint'ler için önce `POST /api/auth/login` ile access token alın, Swagger'daki **Authorize** alanına `Bearer <access-token>` biçiminde girin. Token veya login yanıtını ekran görüntüsü, issue ya da log içinde paylaşmayın.

Health endpoint'i API, veritabanı erişimi, environment, uygulama sürümü ve UTC zamanı hakkında hassas olmayan durum döndürür:

```powershell
curl.exe --fail --show-error --insecure 'https://localhost:7001/api/health'
```

HTTP üzerinden yalnız yerel doğrulama alternatifi:

```powershell
Invoke-RestMethod -Method Get -Uri 'http://localhost:7000/api/health'
```

Health yanıtı connection string, parola, token, kullanıcı verisi veya sunucu credential bilgisi içermemelidir. `Healthy` yanıtı alınmadan uygulamanın veritabanıyla birlikte çalıştığı kabul edilmemelidir.

## Test, lint ve build

Tüm kontroller:

```powershell
.\scripts\run-tests.ps1
```

Ayrı ayrı:

```powershell
dotnet restore .\FbuLabSoftware.sln
dotnet build .\FbuLabSoftware.sln --configuration Release --no-restore

dotnet test .\backend\tests\FbuLabSoftware.UnitTests\FbuLabSoftware.UnitTests.csproj `
  --configuration Release

dotnet test .\backend\tests\FbuLabSoftware.IntegrationTests\FbuLabSoftware.IntegrationTests.csproj `
  --configuration Release

Push-Location .\frontend
npm.cmd run lint
npm.cmd run format:check
npm.cmd run test
npm.cmd run build
Pop-Location
```

Integration testleri gerçek development kayıtlarını kullanmamalı; izole test veritabanı/fixture üzerinde çalışmalıdır. Ayrıntılı senaryolar için [docs/TESTING.md](docs/TESTING.md) dosyasına bakın.

## Docker ile çalıştırma

Docker yöntemi LocalDB kullanmaz; Compose içinde SQL Server 2022, backend ve Nginx üzerinden frontend başlatır. Varsayılan yerel geliştirme yöntemi yine LocalDB + PowerShell'dir.

1. Docker Desktop'ı başlatın ve daemon'ın hazır olduğunu doğrulayın:

   ```powershell
   docker version
   docker info
   ```

2. Git'e alınmayan yerel Docker ayarını oluşturun:

   ```powershell
   Copy-Item -LiteralPath .\.env.example -Destination .\.env
   notepad.exe .\.env
   ```

3. `.env` içindeki `SQL_SA_PASSWORD`, `JWT_SECRET` ve üç `INITIAL_*_PASSWORD` alanına birbirinden bağımsız, güçlü development değerleri girin. `.env.example` dosyasını doldurmayın ve `.env` dosyasını commit etmeyin.

4. Servisleri oluşturup başlatın:

   ```powershell
   docker compose up --build --detach
   docker compose ps
   ```

   Backend ilk açılışta SQL Server hazır olduktan sonra bekleyen migration'ı ve Development seed'ini uygular.

5. Beklenen adresleri kontrol edin:

   - Frontend: `http://localhost:5173`
   - Backend/Swagger: `http://localhost:7001/swagger`
   - Health: `http://localhost:7001/api/health`
   - SQL Server host portu: `localhost:14333`

   ```powershell
   Invoke-RestMethod -Method Get -Uri 'http://localhost:7001/api/health'
   docker compose logs --tail 100 backend
   ```

6. Servisleri durdurun:

   ```powershell
   docker compose down
   ```

`docker compose down --volumes` SQL Server ve yükleme volume'larındaki development verisini siler; normal durdurma için kullanmayın.

## Git ve GitHub

Hedef private repository:

- Hesap: `kursat-ozdemir4562`
- Repository: `fbu-lab-yazilim-talep-sistemi`
- Beklenen SSH remote: `git@github.com:kursat-ozdemir4562/fbu-lab-yazilim-talep-sistemi.git`
- Açıklama: “Fenerbahçe Üniversitesi laboratuvarlarında kullanılacak yazılım taleplerinin akademisyenlerden toplanması ve yönetilmesi için geliştirilen web uygulaması.”

Bu README yazılırken remote/push başarısı doğrulanmamıştır. Önce araç ve kimlik durumunu kontrol edin:

```powershell
git --version
ssh -T git@github.com
gh auth status
```

`gh` kurulu değilse:

```powershell
winget install --exact --id GitHub.cli
```

Kimlik doğrulaması yoksa kullanıcının kendi GitHub oturumuyla:

```powershell
gh auth login --git-protocol ssh --web
gh auth status
```

Yanlış hesaba veya yanlış repository'ye push etmemek için önce hedefi sorgulayın:

```powershell
gh repo view kursat-ozdemir4562/fbu-lab-yazilim-talep-sistemi
git remote -v
```

Repository gerçekten yoksa ve oturum doğru hesaba yetkiliyse private olarak oluşturma komutu:

```powershell
gh repo create kursat-ozdemir4562/fbu-lab-yazilim-talep-sistemi `
  --private `
  --description 'Fenerbahçe Üniversitesi laboratuvarlarında kullanılacak yazılım taleplerinin akademisyenlerden toplanması ve yönetilmesi için geliştirilen web uygulaması.' `
  --source . `
  --remote origin
```

Git deposunu ilk kez hazırlamak veya mevcut durumu doğrulamak için:

```powershell
git init
git branch -M main
git status --short
git remote -v
```

Commit öncesi:

```powershell
.\scripts\run-tests.ps1
.\scripts\check-secrets.ps1
git diff --check
git status --short
```

Yalnız bu kontroller gerçekten başarılı olduktan ve değişiklik kapsamı incelendikten sonra:

```powershell
git add .
git diff --cached --stat
git commit -m 'feat: initialize FBU laboratory software request system'
git push -u origin main
```

Build/test hatası, secret bulgusu veya şüpheli remote varsa commit/push yapılmamalıdır. Repository GitHub tarafında ayrıca **Private** görünmelidir.

## Güvenlik notları

- Parolalar ASP.NET Core Identity ile hashlenir; kaynak kodda veya seed dosyasında parola bulunmaz.
- Access token kısa ömürlü olmalı; refresh token yalnız hashlenmiş biçimde saklanmalı, rotation ve tekrar kullanım iptali uygulanmalıdır.
- Backend authorization; IDOR'a karşı kullanıcı ve fakülte kapsamını her okuma, güncelleme, indirme ve raporda yeniden denetlemelidir.
- Rate limit, account lockout, CORS allow-list, güvenli HTTP başlıkları ve merkezi hata yanıtı environment bazlı yapılandırılmalıdır.
- Öğrenci dosyaları `frontend/public` altına konmamalı; uzantı, MIME, boyut, içerik ve path traversal kontrolünden sonra rastgele adla korumalı alana yazılmalıdır.
- Öğrenci numarası/e-postası, token, parola, connection string ve stack trace normal log/audit yanıtlarına girmemelidir.
- `.env`, production ayarları, sertifika/private key, local database, log ve `storage/development` içeriği Git dışında tutulur.
- User Secrets yalnız development kolaylığıdır; production secret yönetimi değildir.
- MVP frontend'i access/refresh token'ı “beni hatırla” seçimine göre `sessionStorage` veya `localStorage` içinde tutar. Web Storage token'ları XSS'e açıktır; production öncesinde BFF veya `HttpOnly`/`Secure`/`SameSite` cookie tabanlı oturum tasarımı kurumun tehdit modeline göre değerlendirilmelidir.
- Commit öncesinde `.\scripts\check-secrets.ps1` ve `git diff --cached` birlikte incelenmelidir.

Daha ayrıntılı tehdit ve yayın notları için [docs/SECURITY.md](docs/SECURITY.md) dosyasına bakın.

## Bilinen eksikler ve yerel sınırlamalar

- Bu makinede .NET 8 SDK ve SQL Server LocalDB bulunmadığı için LocalDB migration, development seed ve uçtan uca rol senaryoları henüz çalışma zamanında doğrulanmamıştır.
- Docker daemon çalışmadığı için üç servisli Compose kurulumu ve container health check doğrulanmamıştır.
- GitHub CLI için doğrulanmış oturum bulunmadığından private repository oluşturma, `origin` ve `main` push işlemi tamamlanmış kabul edilmez.
- Active Directory, Microsoft Entra ID, canlı SMTP, kurumsal SQL Server, kurumsal dosya servisi ve diğer üniversite sistemleri bilinçli olarak bağlı değildir.
- `DevelopmentEmailSender` yalnız alıcı domaini/konuyu güvenli biçimde loglayan mock'tur; gerçek SMTP, backend parola sıfırlama endpoint'i/e-postası ve arka plan deadline hatırlatıcısı yoktur.
- Tarayıcı token saklama yaklaşımı production için henüz sertleştirilmemiştir.
- PDF rapor çıktısı MVP düzeyinde tek sayfa/ilk 45 satır ve temel Helvetica/ASCII dönüşümü kullanır; tam Türkçe font gömme, çok sayfalama ve kurumsal rapor şablonu sonraki aşamadır. CSV/XLSX çıktıları daha kapsamlı veri aktarımı için tercih edilmelidir.
- Rapor API'si talep, program, fakülte ve laboratuvar için dört kapsam filtreli birleşik rapor sunar; gereksinimdeki bütün özel rapor varyantları ayrı model/endpoint olarak tamamlanmamıştır.
- Öğrenci import kaynak dosyası korumalı alanda saklanır, ancak orijinal dosya için ayrıca indirme endpoint'i yoktur; öğrenci satırları yetkili JSON API üzerinden okunur.
- Yerel dosya depolama ve development sertifikası production dayanıklılığı/güvenliği sağlamaz.
- DNS, gerçek TLS sertifikası, IIS/Nginx reverse proxy, yedekleme, gözlemlenebilirlik ve production deployment bu teslimin kapsamı dışındadır.
- FBU logosu yerine geçici `FBU` işareti kullanılabilir; kurumsal logo ayrıca ve yetkili kaynaktan sağlanmalıdır.

Uygulanmış özellik ile hedef gereksinim aynı şey değildir. Son teslim raporunda build, test, health, login ve yetki sonuçları gerçek komut çıktılarıyla ayrıca belirtilmelidir.

## Sonraki geliştirme aşamaları

1. Bu makinenin eksik önkoşullarını tamamlayıp migration, seed, health ve üç rolün yetki senaryolarını doğrulamak.
2. Öğrenci importu, export biçimleri, öneri onayı, bildirim, audit ve durum geçişleri için kapsamlı integration testlerini tamamlamak.
3. SMTP/e-posta adaptörü, parola sıfırlama teslimi, deadline hatırlatma background job'ı ve kalıcı bildirim politikalarını eklemek.
4. Kurumsal dosya servisi, antivirüs taraması, saklama/silme ve KVKK politikalarını uygulamak.
5. CI içine SAST, bağımlılık, secret, container ve migration kontrollerini eklemek.
6. Gözlemlenebilirlik, yedekleme/geri dönüş, felaket kurtarma ve kapasite testlerini tamamlamak.
7. Kurum onayından sonra AD veya Entra ID entegrasyonunu devreye almak.

## Active Directory ve Microsoft Entra ID genişletme noktaları

Bu entegrasyonlar şu anda etkin değildir. Yerel Identity kullanıcı kaydı; uygulama rolü, fakülte ve ince taneli yetkilerin kaynağı olarak korunabilir, kimlik doğrulama sağlayıcısı değiştirilebilir.

Önerilen genişletme yaklaşımı:

- Entra ID için ayrı app registration, OpenID Connect Authorization Code + PKCE, tenant/issuer/audience doğrulaması ve koşullu erişim kullanın.
- Kurumsal on-prem AD için doğrudan kullanıcı parolası toplamaktansa Entra federation/AD FS ya da kurumun onayladığı Windows Authentication/Kerberos katmanını tercih edin.
- Dış sağlayıcının değişmez kullanıcı kimliğini yerel `ApplicationUser` ile eşleyen alan/tablo ekleyin; e-posta adresini tek başına kalıcı kimlik saymayın.
- Grup/claim değerlerini doğrudan sınırsız yetkiye çevirmeyin. `SystemAdministrator`, fakülte kapsamı ve işlem izinleri için açık eşleme/onay politikası kullanın.
- İlk girişte kullanıcı oluşturma mı, önceden senkronizasyon mu yapılacağına; işten ayrılma/pasifleştirme, isim/e-posta değişimi ve yetki geri alma süreçleriyle birlikte karar verin.
- Entra Graph/SCIM veya LDAP erişimi gerekiyorsa en az yetkili servis hesabı, sertifika/managed identity ve merkezi secret store kullanın.
- Yerel development login'i yalnız development ortamında tutun; production'da kapatın veya kontrollü, denetlenen acil durum hesabıyla sınırlandırın.
- Başarılı/başarısız dış kimlik girişlerini hassas token/claim içeriği olmadan audit edin.

## Production öncesi kontrol listesi

- [ ] Production environment için development seed ve yerel login kapatıldı.
- [ ] Tüm development parolaları/JWT anahtarları döndürüldü; Azure Key Vault veya kurumun secret kasasına taşındı.
- [ ] En az yetkili SQL servis hesabı, şifreli bağlantı, migration onayı, yedekleme ve geri dönüş testi hazır.
- [ ] TLS, HSTS, reverse proxy başlıkları, gerçek domain ve CORS allow-list doğrulandı.
- [ ] Swagger kapatıldı veya yönetici/ağ politikasıyla sınırlandı.
- [ ] Entra/AD tenant, issuer, audience, claim ve deprovisioning kuralları güvenlik ekibince onaylandı.
- [ ] SMTP/harici servis hesapları en az yetkiyle ve merkezi secret store üzerinden yapılandırıldı.
- [ ] Dosya alanı için MIME/içerik kontrolü, antivirüs, kota, şifreleme, yedekleme ve saklama/silme politikası uygulandı.
- [ ] KVKK kapsamı, öğrenci verisi erişimi, audit saklama süresi ve veri sahibi talepleri hukuk/güvenlik ekiplerince onaylandı.
- [ ] Rate limit, lockout, parola/token ömrü, refresh token iptali ve güvenlik başlıkları yük altında test edildi.
- [ ] Tarayıcı oturum modeli için XSS/CSRF tehdit analizi yapıldı; gerekiyorsa BFF veya güvenli `HttpOnly` cookie yaklaşımına geçildi.
- [ ] Unit, integration, frontend, IDOR, SAST, bağımlılık, secret, container ve sızma testleri geçti.
- [ ] Merkezi log/metric/trace, alarm, health probe ve olay müdahale runbook'u hazır.
- [ ] Kapasite, performans, erişilebilirlik, tarayıcı/mobil ve felaket kurtarma testleri tamamlandı.
- [ ] Private GitHub repository korumaları, zorunlu review/check, branch policy ve bağımlılık güncelleme süreci etkin.
- [ ] IIS/container/orchestrator yayın yöntemi, rollback ve sürümleme prosedürü belgelenip kurumca onaylandı.

## Ek teknik belgeler

- [Mimari](docs/ARCHITECTURE.md)
- [Güvenlik](docs/SECURITY.md)
- [Test stratejisi](docs/TESTING.md)

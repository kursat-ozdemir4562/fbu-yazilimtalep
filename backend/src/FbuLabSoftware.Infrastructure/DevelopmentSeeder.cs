using System.Xml.Linq;
using FbuLabSoftware.Application;
using FbuLabSoftware.Domain;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace FbuLabSoftware.Infrastructure;

public sealed class DevelopmentSeeder(
    AppDbContext db,
    RoleManager<IdentityRole> roleManager,
    UserManager<ApplicationUser> userManager,
    IConfiguration configuration,
    IHostEnvironment environment,
    IDataProtectionProvider dataProtectionProvider,
    ILogger<DevelopmentSeeder> logger) : IDevelopmentSeeder
{
    public async Task SeedAsync(CancellationToken cancellationToken)
    {
        foreach (var role in AppRoles.All)
            if (!await roleManager.RoleExistsAsync(role))
                EnsureSucceeded(await roleManager.CreateAsync(new IdentityRole(role)), $"Rol oluşturulamadı: {role}");

        if (!environment.IsDevelopment() && !environment.IsEnvironment("Testing"))
            return;

        // IgnoreQueryFilters: if an admin later soft-deleted this dev sample row, a filtered query
        // would no longer see it and this seeder would try to re-insert it, violating the unique
        // Code constraint on the still-present (soft-deleted) row. Re-running this seed must stay
        // idempotent even after the seeded rows were intentionally removed.
        var faculty = await db.Faculties.IgnoreQueryFilters().SingleOrDefaultAsync(x => x.Code == "MMF", cancellationToken);
        if (faculty is null)
        {
            faculty = new Faculty
            {
                Name = "Mühendislik ve Mimarlık Fakültesi",
                Code = "MMF",
                Description = "Development örnek fakültesi"
            };
            db.Faculties.Add(faculty);
            await db.SaveChangesAsync(cancellationToken);
        }

        if (!await db.Laboratories.IgnoreQueryFilters().AnyAsync(x => x.Code == "BL301", cancellationToken))
            db.Laboratories.Add(new Laboratory
            {
                FacultyId = faculty.Id,
                Name = "Bilgisayar Laboratuvarı 301",
                Code = "BL301",
                Building = "Ana Bina",
                Floor = "3",
                Capacity = 40,
                ComputerCount = 40,
                OperatingSystem = "Windows 11",
                ComputerType = "Masaüstü"
            });

        if (!await db.AcademicTerms.AnyAsync(cancellationToken))
        {
            var today = DateTimeOffset.UtcNow;
            db.AcademicTerms.Add(new AcademicTerm
            {
                AcademicYear = $"{today.Year}-{today.Year + 1}",
                TermName = "Güz",
                StartDate = DateOnly.FromDateTime(today.UtcDateTime.Date),
                EndDate = DateOnly.FromDateTime(today.AddMonths(5).UtcDateTime.Date),
                RequestStartDate = today.AddMonths(-1),
                RequestEndDate = today.AddMonths(1),
                IsCurrent = true
            });
        }

        var softwareSeeds = new[]
        {
            ("Microsoft Office", "Microsoft", LicenseType.UniversityLicensed),
            ("Microsoft Visual Studio", "Microsoft", LicenseType.Free),
            ("Visual Studio Code", "Microsoft", LicenseType.Free),
            ("MATLAB", "MathWorks", LicenseType.UniversityLicensed),
            ("SPSS", "IBM", LicenseType.UniversityLicensed),
            ("AutoCAD", "Autodesk", LicenseType.UniversityLicensed),
            ("Adobe Creative Cloud", "Adobe", LicenseType.UniversityLicensed),
            ("Python", "Python Software Foundation", LicenseType.OpenSource),
            ("R", "R Foundation", LicenseType.OpenSource),
            ("Java JDK", "Oracle/OpenJDK", LicenseType.OpenSource),
            ("Android Studio", "Google", LicenseType.Free),
            ("Cisco Packet Tracer", "Cisco", LicenseType.Free)
        };
        var existingNames = await db.SoftwareApplications.IgnoreQueryFilters().Select(x => x.NormalizedName).ToListAsync(cancellationToken);
        foreach (var (name, manufacturer, license) in softwareSeeds)
        {
            var normalized = TextNormalization.NormalizeSoftwareName(name);
            if (!existingNames.Contains(normalized))
            {
                db.SoftwareApplications.Add(new SoftwareApplication
                {
                    Name = name,
                    NormalizedName = normalized,
                    Manufacturer = manufacturer,
                    LicenseType = license,
                    IsPaid = license is LicenseType.Paid or LicenseType.UniversityLicensed,
                    ApprovalStatus = ApprovalStatus.Approved,
                    IsActive = true
                });
            }
        }
        if (!await db.SystemSettings.AnyAsync(x => x.Key == "AllowedEmailDomain", cancellationToken))
            db.SystemSettings.Add(new SystemSetting
            {
                Key = "AllowedEmailDomain",
                Value = "fbu.edu.tr",
                Description = "Talep formunda kabul edilen öğretim elemanı e-posta domaini"
            });
        if (!await db.SystemSettings.AnyAsync(x => x.Key == "SmtpHost", cancellationToken))
            db.SystemSettings.Add(new SystemSetting
            {
                Key = "SmtpHost",
                Value = "10.2.0.22",
                Description = "Talep bildirimi e-postaları için SMTP sunucu adresi"
            });
        if (!await db.SystemSettings.AnyAsync(x => x.Key == "SmtpPort", cancellationToken))
            db.SystemSettings.Add(new SystemSetting
            {
                Key = "SmtpPort",
                Value = "25",
                Description = "SMTP sunucu portu"
            });
        if (!await db.SystemSettings.AnyAsync(x => x.Key == "SmtpFrom", cancellationToken))
            db.SystemSettings.Add(new SystemSetting
            {
                Key = "SmtpFrom",
                Value = "yazilimtalep@fbu.edu.tr",
                Description = "Bildirim e-postalarının gönderen adresi"
            });
        if (!await db.SystemSettings.AnyAsync(x => x.Key == "SmtpEnableSsl", cancellationToken))
            db.SystemSettings.Add(new SystemSetting
            {
                Key = "SmtpEnableSsl",
                Value = "false",
                Description = "SMTP bağlantısında TLS/SSL kullanılsın mı ('true' veya 'false')"
            });
        if (!await db.SystemSettings.AnyAsync(x => x.Key == "SystemTimeZone", cancellationToken))
            db.SystemSettings.Add(new SystemSetting
            {
                Key = "SystemTimeZone",
                Value = "Europe/Istanbul",
                Description = "Tarih/saat gösterimlerinde kullanılan IANA zaman dilimi kimliği"
            });
        await SeedLdapSettingsFromLegacyConfigAsync(cancellationToken);
        await SeedSamlSettingsFromMetadataFileAsync(cancellationToken);
        await db.SaveChangesAsync(cancellationToken);

        var seeds = new[]
        {
            new SeedUser("admin@fbu.edu.tr", "Sistem Yöneticisi", AppRoles.SystemAdministrator, "INITIAL_ADMIN_PASSWORD", null),
            new SeedUser("akademisyen@fbu.edu.tr", "Örnek Akademisyen", AppRoles.Academic, "INITIAL_ACADEMIC_PASSWORD", faculty.Id),
            new SeedUser("fakulteyetkilisi@fbu.edu.tr", "Örnek Fakülte Yetkilisi", AppRoles.FacultyAuthorizedUser, "INITIAL_FACULTY_USER_PASSWORD", faculty.Id)
        };
        foreach (var seed in seeds)
        {
            var password = configuration[$"Seed:{seed.PasswordEnvironmentKey}"]
                           ?? Environment.GetEnvironmentVariable(seed.PasswordEnvironmentKey);
            if (string.IsNullOrWhiteSpace(password))
            {
                logger.LogWarning("{Email} development kullanıcısı oluşturulmadı: {EnvironmentKey} tanımlı değil.",
                    seed.Email, seed.PasswordEnvironmentKey);
                continue;
            }
            var user = await userManager.FindByEmailAsync(seed.Email);
            if (user is null)
            {
                user = new ApplicationUser
                {
                    UserName = seed.Email,
                    Email = seed.Email,
                    EmailConfirmed = true,
                    FullName = seed.FullName,
                    FacultyId = seed.FacultyId,
                    IsActive = true
                };
                EnsureSucceeded(await userManager.CreateAsync(user, password), $"Kullanıcı oluşturulamadı: {seed.Email}");
            }
            if (!await userManager.IsInRoleAsync(user, seed.Role))
                EnsureSucceeded(await userManager.AddToRoleAsync(user, seed.Role), $"Rol atanamadı: {seed.Email}");
            if (seed.Role == AppRoles.FacultyAuthorizedUser &&
                !await db.UserFacultyPermissions.AnyAsync(x => x.UserId == user.Id && x.FacultyId == faculty.Id, cancellationToken))
                db.UserFacultyPermissions.Add(new UserFacultyPermission
                {
                    UserId = user.Id,
                    FacultyId = faculty.Id,
                    Permissions = FacultyPermission.View | FacultyPermission.Edit | FacultyPermission.Report |
                                  FacultyPermission.ChangeStatus
                });
        }
        await db.SaveChangesAsync(cancellationToken);
    }

    // Üretimde zaten çalışan LDAP senkronunu bozmamak için: DB'de hiç LdapSettings satırı
    // yoksa, appsettings/ortam değişkenindeki mevcut Ldap:* değerlerinden Enabled=true bir
    // satır türetilir (bkz. plan: "Sıfır regresyon, geriye dönük uyumlu geçiş"). Bu bloğun
    // hiç çalışmaması (host boşsa) durumunda AdSyncService zaten IOptions<LdapOptions>'a
    // düşmeye devam eder.
    private async Task SeedLdapSettingsFromLegacyConfigAsync(CancellationToken cancellationToken)
    {
        if (await db.LdapSettings.AnyAsync(cancellationToken))
            return;
        var ldap = configuration.GetSection("Ldap");
        var host = ldap["Host"];
        if (string.IsNullOrWhiteSpace(host))
            return;
        var protector = dataProtectionProvider.CreateProtector("Ldap.BindPassword");
        db.LdapSettings.Add(new LdapSettings
        {
            Enabled = true,
            PrimaryHost = host,
            PrimaryPort = int.TryParse(ldap["Port"], out var port) ? port : 636,
            BindDn = ldap["BindDn"] ?? string.Empty,
            BindPasswordProtected = protector.Protect(ldap["BindPassword"] ?? string.Empty),
            AcademicOu = ldap["AcademicOu"] ?? string.Empty,
            AdministrativeOu = ldap["AdministrativeOu"] ?? string.Empty,
            SyncIntervalHours = int.TryParse(ldap["SyncIntervalHours"], out var interval) ? interval : 12
        });
        logger.LogInformation("LdapSettings, mevcut appsettings Ldap:* değerlerinden Enabled=true olarak tohumlandı.");
    }

    // SAML SSO canlıda çalışıyor ve kırılganlığı yüksek — bu yüzden burada seed edilen satır
    // bilinçli olarak Enabled=false: admin GUI'den inceleyip açana kadar Program.cs'teki eski
    // statik appsettings+dosya tabanlı SAML config'i kullanılmaya devam eder.
    private async Task SeedSamlSettingsFromMetadataFileAsync(CancellationToken cancellationToken)
    {
        if (await db.SamlSettings.AnyAsync(cancellationToken))
            return;
        var idpEntityId = configuration["Saml:IdpEntityId"];
        if (string.IsNullOrWhiteSpace(idpEntityId))
            return;
        var metadataPath = Path.Combine(AppContext.BaseDirectory, "Saml", "idp-metadata.xml");
        if (!File.Exists(metadataPath))
            return;
        try
        {
            XNamespace md = "urn:oasis:names:tc:SAML:2.0:metadata";
            XNamespace ds = "http://www.w3.org/2000/09/xmldsig#";
            var doc = XDocument.Load(metadataPath);
            var idpDescriptor = doc.Descendants(md + "IDPSSODescriptor").FirstOrDefault();
            var ssoUrl = idpDescriptor?.Elements(md + "SingleSignOnService")
                .FirstOrDefault(e => (string?)e.Attribute("Binding") ==
                    "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect")
                ?.Attribute("Location")?.Value;
            var sloUrl = idpDescriptor?.Element(md + "SingleLogoutService")?.Attribute("Location")?.Value;
            var certificate = idpDescriptor?.Descendants(ds + "X509Certificate").FirstOrDefault()?.Value?.Trim();
            if (string.IsNullOrWhiteSpace(ssoUrl) || string.IsNullOrWhiteSpace(certificate))
            {
                logger.LogWarning("SamlSettings tohumlanamadı: idp-metadata.xml içinde SSO URL veya sertifika bulunamadı.");
                return;
            }
            db.SamlSettings.Add(new SamlSettings
            {
                Enabled = false,
                IdpEntityId = idpEntityId,
                IdpSsoUrl = ssoUrl,
                IdpSloUrl = sloUrl,
                Certificate = certificate
            });
            logger.LogInformation("SamlSettings, mevcut idp-metadata.xml dosyasından Enabled=false olarak tohumlandı.");
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "SamlSettings idp-metadata.xml dosyasından tohumlanamadı, statik config kullanılmaya devam edecek.");
        }
    }

    private static void EnsureSucceeded(IdentityResult result, string message)
    {
        if (!result.Succeeded)
            throw new InvalidOperationException($"{message} {string.Join(" ", result.Errors.Select(x => x.Description))}");
    }

    private sealed record SeedUser(
        string Email,
        string FullName,
        string Role,
        string PasswordEnvironmentKey,
        Guid? FacultyId);
}

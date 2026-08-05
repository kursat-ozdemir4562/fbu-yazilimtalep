using FbuLabSoftware.Application;
using FbuLabSoftware.Domain;
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

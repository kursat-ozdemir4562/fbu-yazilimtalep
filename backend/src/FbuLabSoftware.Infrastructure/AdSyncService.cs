using System.DirectoryServices.Protocols;
using System.Net;
using FbuLabSoftware.Application;
using FbuLabSoftware.Domain;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FbuLabSoftware.Infrastructure;

public sealed class LdapOptions
{
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 636;
    public string BindDn { get; set; } = string.Empty;
    public string BindPassword { get; set; } = string.Empty;
    public string AcademicOu { get; set; } = string.Empty;
    public string AdministrativeOu { get; set; } = string.Empty;
    public int SyncIntervalHours { get; set; } = 12;
}

public sealed record AdSyncResult(int Created, int Updated, int Deactivated, int FacultiesCreated);
public sealed record AdSyncStatusDto(bool IsConfigured, DateTimeOffset? LastSyncedAt, int SyncedUserCount);
public sealed record LdapSettingsDto(
    bool Enabled,
    string PrimaryHost,
    int PrimaryPort,
    string? SecondaryHost,
    int? SecondaryPort,
    string BindDn,
    bool HasBindPassword,
    string AcademicOu,
    string AdministrativeOu,
    int SyncIntervalHours,
    TimeOnly? SyncTimeOfDay);
public sealed record UpsertLdapSettingsRequest(
    bool Enabled,
    string PrimaryHost,
    int PrimaryPort,
    string? SecondaryHost,
    int? SecondaryPort,
    string BindDn,
    string? BindPassword,
    string AcademicOu,
    string AdministrativeOu,
    int SyncIntervalHours,
    TimeOnly? SyncTimeOfDay);

public interface IAdSyncService
{
    Task<AdSyncResult> SyncAsync(CancellationToken cancellationToken);
    Task<AdSyncStatusDto> GetStatusAsync(CancellationToken cancellationToken);
    Task<LdapSettingsDto> GetSettingsAsync(CancellationToken cancellationToken);
    Task<LdapSettingsDto> SaveSettingsAsync(UpsertLdapSettingsRequest request, CancellationToken cancellationToken);
}

// DB'de Enabled=true bir LdapSettings satırı varsa onu kullanır; yoksa/disabled ise appsettings
// tabanlı IOptions<LdapOptions>'a düşer — canlıda çalışan AD senkronunu bozmamak için bilinçli
// geriye uyumluluk (bkz. plan: "Sıfır regresyon, geriye dönük uyumlu geçiş").
internal sealed record EffectiveLdapConfig(
    bool IsConfigured,
    string[] Hosts,
    int Port,
    string BindDn,
    string BindPassword,
    string AcademicOu,
    string AdministrativeOu);

public sealed class AdSyncService(
    AppDbContext db,
    UserManager<ApplicationUser> userManager,
    IOptions<LdapOptions> legacyOptions,
    IDataProtectionProvider dataProtectionProvider,
    ILogger<AdSyncService> logger) : IAdSyncService
{
    private const string Source = "AD";
    // Bu OU'daki kullanıcıların physicalDeliveryOfficeName'i boş geliyor (Fakülte eşlemesi
    // o alana dayanıyor), bu yüzden fakülte OU'dan doğrudan eşleniyor. SHMYO fakültesi
    // önceden DB'de mevcut olmalı — yoksa bu kullanıcılar yine fakültesiz kalır (sessizce atlanır).
    private const string HealthVocationalSchoolOu = "OU=HEALTH VOCATIONAL SCHOOL,OU=ACADEMIC,OU=FBU USER,DC=fbu,DC=edu,DC=tr";
    private const string HealthVocationalSchoolFacultyCode = "SHMYO";
    private readonly LdapOptions _legacy = legacyOptions.Value;
    private readonly IDataProtector _protector = dataProtectionProvider.CreateProtector("Ldap.BindPassword");

    public async Task<AdSyncResult> SyncAsync(CancellationToken cancellationToken)
    {
        var effective = await ResolveEffectiveConfigAsync(cancellationToken);
        if (!effective.IsConfigured)
        {
            logger.LogWarning("LDAP yapılandırması eksik, AD senkronizasyonu atlandı.");
            return new AdSyncResult(0, 0, 0, 0);
        }

        var syncStarted = DateTimeOffset.UtcNow;
        var created = 0;
        var updated = 0;

        using var connection = new LdapConnection(new LdapDirectoryIdentifier(effective.Hosts, effective.Port, false, false))
        {
            AuthType = AuthType.Basic
        };
        connection.SessionOptions.SecureSocketLayer = true;
        connection.SessionOptions.ProtocolVersion = 3;
        connection.Bind(new NetworkCredential(effective.BindDn, effective.BindPassword));

        var entries = new List<(SearchResultEntry Entry, bool IsAcademic)>();
        if (!string.IsNullOrWhiteSpace(effective.AcademicOu))
            entries.AddRange(SearchOu(connection, effective.AcademicOu).Select(e => (e, true)));
        if (!string.IsNullOrWhiteSpace(effective.AdministrativeOu))
            entries.AddRange(SearchOu(connection, effective.AdministrativeOu).Select(e => (e, false)));

        var facultyCache = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
        var existingFacultyCodes = new HashSet<string>(
            await db.Faculties.Select(x => x.Code).ToListAsync(cancellationToken),
            StringComparer.OrdinalIgnoreCase);
        var facultiesCreated = 0;
        var healthVocationalSchoolFacultyId = await db.Faculties
            .Where(x => x.Code == HealthVocationalSchoolFacultyCode)
            .Select(x => (Guid?)x.Id)
            .FirstOrDefaultAsync(cancellationToken);

        foreach (var (entry, isAcademic) in entries)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var email = GetAttribute(entry, "mail") ?? GetAttribute(entry, "userPrincipalName");
            if (string.IsNullOrWhiteSpace(email))
                continue;

            var givenName = GetAttribute(entry, "givenName");
            var surname = GetAttribute(entry, "sn");
            var displayName = GetAttribute(entry, "displayName");
            var fullName = !string.IsNullOrWhiteSpace(givenName) || !string.IsNullOrWhiteSpace(surname)
                ? $"{givenName} {surname}".Trim()
                : displayName ?? email;
            var officeName = GetAttribute(entry, "physicalDeliveryOfficeName")?.Trim();
            var department = GetAttribute(entry, "department")?.Trim();
            var uacRaw = GetAttribute(entry, "userAccountControl");
            var adDisabled = int.TryParse(uacRaw, out var uac) && (uac & 0x2) != 0;

            Guid? facultyId = null;
            if (isAcademic && !string.IsNullOrWhiteSpace(officeName) &&
                officeName.Contains("Fakülte", StringComparison.OrdinalIgnoreCase))
            {
                if (!facultyCache.TryGetValue(officeName, out var cachedId))
                {
                    var faculty = await db.Faculties.FirstOrDefaultAsync(x => x.Name == officeName, cancellationToken);
                    if (faculty is null)
                    {
                        faculty = new Faculty { Name = officeName, Code = TextNormalization.GenerateFacultyCode(officeName, existingFacultyCodes) };
                        db.Faculties.Add(faculty);
                        await db.SaveChangesAsync(cancellationToken);
                        facultiesCreated++;
                    }
                    cachedId = faculty.Id;
                    facultyCache[officeName] = cachedId;
                }
                facultyId = cachedId;
            }
            else if (isAcademic && healthVocationalSchoolFacultyId is not null &&
                     entry.DistinguishedName.EndsWith(HealthVocationalSchoolOu, StringComparison.OrdinalIgnoreCase))
            {
                facultyId = healthVocationalSchoolFacultyId;
            }

            var normalizedEmail = userManager.NormalizeEmail(email.Trim());
            var user = await userManager.Users.SingleOrDefaultAsync(x => x.NormalizedEmail == normalizedEmail, cancellationToken);

            if (user is null)
            {
                user = new ApplicationUser
                {
                    UserName = email.Trim(),
                    Email = email.Trim(),
                    EmailConfirmed = true,
                    FullName = fullName,
                    FacultyId = facultyId,
                    Department = department,
                    IsActive = !adDisabled,
                    DirectorySource = Source,
                    DirectorySyncedAt = syncStarted
                };
                var createResult = await userManager.CreateAsync(user);
                if (!createResult.Succeeded)
                {
                    logger.LogWarning(
                        "AD kullanıcısı oluşturulamadı: {Email} - {Errors}",
                        email, string.Join(" ", createResult.Errors.Select(x => x.Description)));
                    continue;
                }
                await userManager.AddToRoleAsync(user, isAcademic ? AppRoles.Academic : AppRoles.Administrative);
                created++;
            }
            else
            {
                user.FullName = fullName;
                if (facultyId is not null)
                    user.FacultyId = facultyId;
                if (!string.IsNullOrWhiteSpace(department))
                    user.Department = department;
                if (adDisabled)
                    user.IsActive = false;
                if ((await userManager.GetRolesAsync(user)).Count == 0)
                {
                    await userManager.AddToRoleAsync(user, isAcademic ? AppRoles.Academic : AppRoles.Administrative);
                    user.IsActive = !adDisabled;
                }
                user.DirectorySource ??= Source;
                user.DirectorySyncedAt = syncStarted;
                user.UpdatedAt = DateTimeOffset.UtcNow;
                await userManager.UpdateAsync(user);
                updated++;
            }
        }

        var deactivated = await db.Users
            .Where(x => x.DirectorySource == Source && x.DirectorySyncedAt != null &&
                        x.DirectorySyncedAt < syncStarted && x.IsActive)
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.IsActive, false), cancellationToken);

        logger.LogInformation(
            "AD senkronizasyonu tamamlandı: {Created} yeni, {Updated} güncellendi, {Deactivated} pasifleştirildi, {FacultiesCreated} fakülte oluşturuldu.",
            created, updated, deactivated, facultiesCreated);

        return new AdSyncResult(created, updated, deactivated, facultiesCreated);
    }

    public async Task<AdSyncStatusDto> GetStatusAsync(CancellationToken cancellationToken)
    {
        var effective = await ResolveEffectiveConfigAsync(cancellationToken);
        var directoryUsers = db.Users.Where(x => x.DirectorySource == Source);
        var lastSyncedAt = await directoryUsers
            .Select(x => x.DirectorySyncedAt)
            .OrderByDescending(x => x)
            .FirstOrDefaultAsync(cancellationToken);
        var syncedUserCount = await directoryUsers.CountAsync(cancellationToken);
        return new AdSyncStatusDto(effective.IsConfigured, lastSyncedAt, syncedUserCount);
    }

    public async Task<LdapSettingsDto> GetSettingsAsync(CancellationToken cancellationToken)
    {
        var settings = await db.LdapSettings.AsNoTracking().SingleOrDefaultAsync(cancellationToken);
        if (settings is null)
            return new LdapSettingsDto(false, _legacy.Host, _legacy.Port, null, null, _legacy.BindDn,
                !string.IsNullOrWhiteSpace(_legacy.BindPassword), _legacy.AcademicOu, _legacy.AdministrativeOu,
                _legacy.SyncIntervalHours, null);
        return ToDto(settings);
    }

    public async Task<LdapSettingsDto> SaveSettingsAsync(UpsertLdapSettingsRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.PrimaryHost))
            throw new BusinessRuleException("Birincil DC adresi zorunludur.");
        if (string.IsNullOrWhiteSpace(request.BindDn))
            throw new BusinessRuleException("Bind DN zorunludur.");

        var settings = await db.LdapSettings.SingleOrDefaultAsync(cancellationToken);
        if (settings is null)
        {
            if (string.IsNullOrWhiteSpace(request.BindPassword))
                throw new BusinessRuleException("İlk kayıtta bind şifresi girilmelidir.");
            settings = new LdapSettings();
            db.LdapSettings.Add(settings);
        }

        settings.Enabled = request.Enabled;
        settings.PrimaryHost = request.PrimaryHost.Trim();
        settings.PrimaryPort = request.PrimaryPort;
        settings.SecondaryHost = string.IsNullOrWhiteSpace(request.SecondaryHost) ? null : request.SecondaryHost.Trim();
        settings.SecondaryPort = request.SecondaryPort;
        settings.BindDn = request.BindDn.Trim();
        if (!string.IsNullOrWhiteSpace(request.BindPassword))
            settings.BindPasswordProtected = _protector.Protect(request.BindPassword);
        settings.AcademicOu = request.AcademicOu?.Trim() ?? string.Empty;
        settings.AdministrativeOu = request.AdministrativeOu?.Trim() ?? string.Empty;
        settings.SyncIntervalHours = Math.Max(1, request.SyncIntervalHours);
        settings.SyncTimeOfDay = request.SyncTimeOfDay;
        await db.SaveChangesAsync(cancellationToken);
        return ToDto(settings);
    }

    private static LdapSettingsDto ToDto(LdapSettings settings) => new(
        settings.Enabled, settings.PrimaryHost, settings.PrimaryPort, settings.SecondaryHost, settings.SecondaryPort,
        settings.BindDn, !string.IsNullOrWhiteSpace(settings.BindPasswordProtected), settings.AcademicOu,
        settings.AdministrativeOu, settings.SyncIntervalHours, settings.SyncTimeOfDay);

    private async Task<EffectiveLdapConfig> ResolveEffectiveConfigAsync(CancellationToken cancellationToken)
    {
        var settings = await db.LdapSettings.AsNoTracking().SingleOrDefaultAsync(cancellationToken);
        if (settings is { Enabled: true } && !string.IsNullOrWhiteSpace(settings.PrimaryHost) && !string.IsNullOrWhiteSpace(settings.BindDn))
        {
            var hosts = new List<string> { settings.PrimaryHost };
            if (!string.IsNullOrWhiteSpace(settings.SecondaryHost))
                hosts.Add(settings.SecondaryHost);
            var password = string.IsNullOrWhiteSpace(settings.BindPasswordProtected)
                ? string.Empty
                : _protector.Unprotect(settings.BindPasswordProtected);
            return new EffectiveLdapConfig(true, hosts.ToArray(), settings.PrimaryPort, settings.BindDn, password,
                settings.AcademicOu, settings.AdministrativeOu);
        }

        if (!string.IsNullOrWhiteSpace(_legacy.Host) && !string.IsNullOrWhiteSpace(_legacy.BindDn))
            return new EffectiveLdapConfig(true, [_legacy.Host], _legacy.Port, _legacy.BindDn, _legacy.BindPassword,
                _legacy.AcademicOu, _legacy.AdministrativeOu);

        return new EffectiveLdapConfig(false, [], 636, string.Empty, string.Empty, string.Empty, string.Empty);
    }

    private static IEnumerable<SearchResultEntry> SearchOu(LdapConnection connection, string ou)
    {
        var request = new SearchRequest(
            ou,
            "(&(objectClass=user)(objectCategory=person))",
            SearchScope.Subtree,
            "mail", "userPrincipalName", "givenName", "sn", "displayName", "physicalDeliveryOfficeName", "department", "userAccountControl");
        var pageControl = new PageResultRequestControl(500);
        request.Controls.Add(pageControl);

        while (true)
        {
            var response = (SearchResponse)connection.SendRequest(request);
            foreach (SearchResultEntry entry in response.Entries)
                yield return entry;

            var pageResponse = response.Controls.OfType<PageResultResponseControl>().FirstOrDefault();
            if (pageResponse is null || pageResponse.Cookie.Length == 0)
                yield break;
            pageControl.Cookie = pageResponse.Cookie;
        }
    }

    private static string? GetAttribute(SearchResultEntry entry, string name)
    {
        if (!entry.Attributes.Contains(name))
            return null;
        var values = entry.Attributes[name];
        return values.Count > 0 ? values[0]?.ToString() : null;
    }

}

public sealed class AdSyncBackgroundService(
    IServiceScopeFactory scopeFactory,
    IOptions<LdapOptions> legacyOptions,
    ILogger<AdSyncBackgroundService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var syncService = scope.ServiceProvider.GetRequiredService<IAdSyncService>();
                await syncService.SyncAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "AD senkronizasyonu sırasında hata oluştu.");
            }

            var delay = await ComputeNextDelayAsync(stoppingToken);
            try
            {
                await Task.Delay(delay, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    // Konfigürasyon (senkron sıklığı/saati) her döngüde DB'den taze okunur — admin GUI'den
    // değiştirdiğinde uygulama yeniden başlatılmadan bir sonraki döngüde etkili olsun diye.
    private async Task<TimeSpan> ComputeNextDelayAsync(CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var settings = await db.LdapSettings.AsNoTracking().SingleOrDefaultAsync(cancellationToken);
        var intervalHours = Math.Max(1, settings?.SyncIntervalHours ?? legacyOptions.Value.SyncIntervalHours);
        var timeOfDay = settings?.SyncTimeOfDay;
        if (timeOfDay is { } tod)
        {
            var now = DateTime.UtcNow;
            var todayRun = new DateTime(now.Year, now.Month, now.Day, tod.Hour, tod.Minute, tod.Second, DateTimeKind.Utc);
            var nextRun = todayRun > now ? todayRun : todayRun.AddDays(1);
            return nextRun - now;
        }
        return TimeSpan.FromHours(intervalHours);
    }
}

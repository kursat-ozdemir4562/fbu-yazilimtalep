using System.DirectoryServices.Protocols;
using System.Net;
using FbuLabSoftware.Domain;
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

public interface IAdSyncService
{
    Task<AdSyncResult> SyncAsync(CancellationToken cancellationToken);
}

public sealed class AdSyncService(
    AppDbContext db,
    UserManager<ApplicationUser> userManager,
    IOptions<LdapOptions> options,
    ILogger<AdSyncService> logger) : IAdSyncService
{
    private const string Source = "AD";
    private readonly LdapOptions _options = options.Value;

    public async Task<AdSyncResult> SyncAsync(CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_options.Host) || string.IsNullOrWhiteSpace(_options.BindDn))
        {
            logger.LogWarning("LDAP yapılandırması eksik, AD senkronizasyonu atlandı.");
            return new AdSyncResult(0, 0, 0, 0);
        }

        var syncStarted = DateTimeOffset.UtcNow;
        var created = 0;
        var updated = 0;

        using var connection = new LdapConnection(new LdapDirectoryIdentifier(_options.Host, _options.Port))
        {
            AuthType = AuthType.Basic
        };
        connection.SessionOptions.SecureSocketLayer = true;
        connection.SessionOptions.ProtocolVersion = 3;
        connection.Bind(new NetworkCredential(_options.BindDn, _options.BindPassword));

        var entries = new List<(SearchResultEntry Entry, bool IsAcademic)>();
        if (!string.IsNullOrWhiteSpace(_options.AcademicOu))
            entries.AddRange(SearchOu(connection, _options.AcademicOu).Select(e => (e, true)));
        if (!string.IsNullOrWhiteSpace(_options.AdministrativeOu))
            entries.AddRange(SearchOu(connection, _options.AdministrativeOu).Select(e => (e, false)));

        var facultyCache = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
        var existingFacultyCodes = new HashSet<string>(
            await db.Faculties.Select(x => x.Code).ToListAsync(cancellationToken),
            StringComparer.OrdinalIgnoreCase);
        var facultiesCreated = 0;

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
    IOptions<LdapOptions> options,
    ILogger<AdSyncBackgroundService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var intervalHours = Math.Max(1, options.Value.SyncIntervalHours);
        using var timer = new PeriodicTimer(TimeSpan.FromHours(intervalHours));
        do
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
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}

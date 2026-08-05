using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using FbuLabSoftware.Application;
using FbuLabSoftware.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Sustainsys.Saml2.AspNetCore2;

namespace FbuLabSoftware.Infrastructure;

public sealed record SamlSettingsDto(
    bool Enabled,
    string IdpEntityId,
    string IdpSsoUrl,
    string? IdpSloUrl,
    string Certificate,
    string EmailAttribute,
    string DisplayNameAttribute,
    string NameIdMapping,
    string SpEntityId,
    string SpAcsUrl,
    string SpMetadataUrl);

public sealed record UpsertSamlSettingsRequest(
    bool Enabled,
    string IdpEntityId,
    string IdpSsoUrl,
    string? IdpSloUrl,
    string Certificate,
    string EmailAttribute,
    string DisplayNameAttribute,
    string NameIdMapping);

public interface ISamlSettingsService
{
    Task<SamlSettingsDto> GetAsync(CancellationToken cancellationToken);
    Task<SamlSettingsDto> SaveAsync(UpsertSamlSettingsRequest request, CancellationToken cancellationToken);
}

// DB'de Enabled=true bir satır varsa Program.cs'teki AddOptions<Saml2Options>(...).Configure(...)
// bunu okuyup statik appsettings tabanlı SAML config'i override eder (bkz. Program.cs). SaveAsync
// başarılı olduktan sonra IOptionsMonitorCache<Saml2Options> invalidate edilir — bir sonraki SSO
// isteği yeni ayarları restart gerekmeden alır.
public sealed class SamlSettingsService(
    AppDbContext db,
    ResourceAuthorizationService authorization,
    IConfiguration configuration,
    IOptionsMonitorCache<Saml2Options> optionsCache) : ISamlSettingsService
{
    public async Task<SamlSettingsDto> GetAsync(CancellationToken cancellationToken)
    {
        authorization.RequireAdministrator();
        var settings = await db.SamlSettings.AsNoTracking().SingleOrDefaultAsync(cancellationToken);
        return ToDto(settings);
    }

    public async Task<SamlSettingsDto> SaveAsync(UpsertSamlSettingsRequest request, CancellationToken cancellationToken)
    {
        authorization.RequireAdministrator();
        if (request.Enabled)
        {
            if (string.IsNullOrWhiteSpace(request.IdpEntityId))
                throw new BusinessRuleException("IdP Entity ID zorunludur.");
            if (string.IsNullOrWhiteSpace(request.IdpSsoUrl) || !Uri.TryCreate(request.IdpSsoUrl, UriKind.Absolute, out _))
                throw new BusinessRuleException("Geçerli bir IdP SSO URL girin.");
            if (!string.IsNullOrWhiteSpace(request.IdpSloUrl) && !Uri.TryCreate(request.IdpSloUrl, UriKind.Absolute, out _))
                throw new BusinessRuleException("Geçerli bir IdP SLO URL girin.");
            ValidateCertificate(request.Certificate);
        }

        var settings = await db.SamlSettings.SingleOrDefaultAsync(cancellationToken);
        if (settings is null)
        {
            settings = new SamlSettings();
            db.SamlSettings.Add(settings);
        }
        settings.Enabled = request.Enabled;
        settings.IdpEntityId = request.IdpEntityId?.Trim() ?? string.Empty;
        settings.IdpSsoUrl = request.IdpSsoUrl?.Trim() ?? string.Empty;
        settings.IdpSloUrl = string.IsNullOrWhiteSpace(request.IdpSloUrl) ? null : request.IdpSloUrl.Trim();
        settings.Certificate = request.Certificate?.Trim() ?? string.Empty;
        if (!string.IsNullOrWhiteSpace(request.EmailAttribute))
            settings.EmailAttribute = request.EmailAttribute.Trim();
        if (!string.IsNullOrWhiteSpace(request.DisplayNameAttribute))
            settings.DisplayNameAttribute = request.DisplayNameAttribute.Trim();
        if (!string.IsNullOrWhiteSpace(request.NameIdMapping))
            settings.NameIdMapping = request.NameIdMapping.Trim();
        await db.SaveChangesAsync(cancellationToken);

        optionsCache.TryRemove(Saml2Defaults.Scheme);

        return ToDto(settings);
    }

    private static void ValidateCertificate(string certificate)
    {
        if (string.IsNullOrWhiteSpace(certificate))
            throw new BusinessRuleException("X.509 sertifikası zorunludur.");
        try
        {
            var cleaned = string.Concat(certificate
                .Replace("-----BEGIN CERTIFICATE-----", string.Empty)
                .Replace("-----END CERTIFICATE-----", string.Empty)
                .Where(c => !char.IsWhiteSpace(c)));
            using var parsed = new X509Certificate2(Convert.FromBase64String(cleaned));
            _ = parsed.Thumbprint;
        }
        catch (Exception ex) when (ex is FormatException or CryptographicException)
        {
            throw new BusinessRuleException("Sertifika geçerli bir X.509/base64 formatında değil.");
        }
    }

    private SamlSettingsDto ToDto(SamlSettings? settings)
    {
        var publicOrigin = configuration["Saml:PublicOrigin"]?.TrimEnd('/') ?? string.Empty;
        var spEntityId = $"{publicOrigin}/auth/saml/metadata";
        var spAcsUrl = $"{publicOrigin}/auth/saml/acs";
        if (settings is null)
            return new SamlSettingsDto(false, string.Empty, string.Empty, null, string.Empty,
                "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
                "http://schemas.microsoft.com/identity/claims/displayname",
                "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
                spEntityId, spAcsUrl, spEntityId);
        return new SamlSettingsDto(settings.Enabled, settings.IdpEntityId, settings.IdpSsoUrl, settings.IdpSloUrl,
            settings.Certificate, settings.EmailAttribute, settings.DisplayNameAttribute, settings.NameIdMapping,
            spEntityId, spAcsUrl, spEntityId);
    }
}

using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using FbuLabSoftware.Application;
using FbuLabSoftware.Domain;
using FluentValidation;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace FbuLabSoftware.Infrastructure;

public sealed class JwtOptions
{
    public string Issuer { get; set; } = "FbuLabSoftware";
    public string Audience { get; set; } = "FbuLabSoftware.Client";
    public string Secret { get; set; } = string.Empty;
    public int AccessTokenMinutes { get; set; } = 15;
    public int RefreshTokenDays { get; set; } = 7;
    public int RememberMeRefreshTokenDays { get; set; } = 30;
}

public sealed class AuthService(
    AppDbContext db,
    UserManager<ApplicationUser> userManager,
    IOptions<JwtOptions> options,
    IValidator<LoginRequest> loginValidator,
    IValidator<UpdateThemePreferenceRequest> themePreferenceValidator,
    ICurrentUserService currentUser,
    IAuditService auditService) : IAuthService
{
    private readonly JwtOptions _options = options.Value;

    public async Task<TokenResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken)
    {
        await loginValidator.ValidateRequestAsync(request, cancellationToken);
        var normalizedEmail = userManager.NormalizeEmail(request.Email.Trim());
        var user = await userManager.Users.SingleOrDefaultAsync(x => x.NormalizedEmail == normalizedEmail, cancellationToken);
        if (user is null || !user.IsActive || !await userManager.CheckPasswordAsync(user, request.Password))
        {
            if (user is not null)
                await userManager.AccessFailedAsync(user);
            var actor = user is null
                ? null
                : new AuditActorIdentity(user.Id, user.Email ?? request.Email.Trim());
            await auditService.WriteAsync(
                AuditActionType.LoginFailed,
                "Authentication",
                user?.Id,
                cancellationToken: cancellationToken,
                actor: actor);
            throw new UnauthorizedException("E-posta veya parola hatalı.");
        }
        if (await userManager.IsLockedOutAsync(user))
            throw new UnauthorizedException("Hesap geçici olarak kilitlendi.");

        await userManager.ResetAccessFailedCountAsync(user);
        var refreshTokenLifetime = TimeSpan.FromDays(
            request.RememberMe ? _options.RememberMeRefreshTokenDays : _options.RefreshTokenDays);
        var response = await IssueTokensAsync(user, null, refreshTokenLifetime, cancellationToken);
        await auditService.WriteAsync(
            AuditActionType.LoginSucceeded,
            "Authentication",
            user.Id,
            cancellationToken: cancellationToken,
            actor: new AuditActorIdentity(user.Id, user.Email ?? request.Email.Trim()));
        return response;
    }

    public async Task<TokenResponse> LoginWithSsoAsync(string email, string? fullName, CancellationToken cancellationToken)
    {
        var normalizedEmail = userManager.NormalizeEmail(email.Trim());
        var user = await userManager.Users.SingleOrDefaultAsync(x => x.NormalizedEmail == normalizedEmail, cancellationToken);
        if (user is not null && !user.IsActive)
        {
            await auditService.WriteAsync(
                AuditActionType.LoginFailed,
                "Authentication",
                user.Id,
                cancellationToken: cancellationToken,
                actor: new AuditActorIdentity(user.Id, user.Email ?? email));
            throw new UnauthorizedException("Hesabınız pasif durumda. Lütfen yöneticinize başvurun.");
        }

        if (user is null)
        {
            user = new ApplicationUser
            {
                UserName = email.Trim(),
                Email = email.Trim(),
                EmailConfirmed = true,
                FullName = string.IsNullOrWhiteSpace(fullName) ? email.Trim() : fullName.Trim()
            };
            var createResult = await userManager.CreateAsync(user);
            if (!createResult.Succeeded)
                throw new UnauthorizedException(
                    "Kurumsal hesap sisteme eklenemedi: " + string.Join(" ", createResult.Errors.Select(x => x.Description)));
            await userManager.AddToRoleAsync(user, AppRoles.Academic);
            await auditService.WriteAsync(
                AuditActionType.UserCreated,
                nameof(ApplicationUser),
                user.Id,
                System.Text.Json.JsonSerializer.Serialize(new { user.Email, user.FullName, Source = "SAML" }),
                cancellationToken: cancellationToken);
        }

        var response = await IssueTokensAsync(user, null, TimeSpan.FromDays(_options.RefreshTokenDays), cancellationToken);
        await auditService.WriteAsync(
            AuditActionType.LoginSucceeded,
            "Authentication",
            user.Id,
            cancellationToken: cancellationToken,
            actor: new AuditActorIdentity(user.Id, user.Email ?? email));
        return response;
    }

    public async Task<TokenResponse> RefreshAsync(RefreshRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
            throw new UnauthorizedException("Refresh token geçersiz.");
        var hash = HashToken(request.RefreshToken);
        var existing = await db.RefreshTokens.SingleOrDefaultAsync(x => x.TokenHash == hash, cancellationToken)
                       ?? throw new UnauthorizedException("Refresh token geçersiz.");

        if (existing.RevokedAt is not null)
        {
            var familyTokens = await db.RefreshTokens
                .Where(x => x.UserId == existing.UserId && x.FamilyId == existing.FamilyId && x.RevokedAt == null)
                .ToListAsync(cancellationToken);
            foreach (var token in familyTokens)
            {
                token.RevokedAt = DateTimeOffset.UtcNow;
                token.RevokedByIp = currentUser.IpAddress;
                token.RevokeReason = "Döndürülmüş token yeniden kullanıldı; token ailesi iptal edildi.";
            }
            await db.SaveChangesAsync(cancellationToken);
            throw new UnauthorizedException("Refresh token yeniden kullanımı algılandı.");
        }
        if (existing.ExpiresAt <= DateTimeOffset.UtcNow)
            throw new UnauthorizedException("Refresh token süresi dolmuş.");

        var user = await userManager.FindByIdAsync(existing.UserId);
        if (user is null || !user.IsActive)
            throw new UnauthorizedException();

        existing.RevokedAt = DateTimeOffset.UtcNow;
        existing.RevokedByIp = currentUser.IpAddress;
        existing.RevokeReason = "Token rotation";
        var originalRefreshTokenLifetime = existing.ExpiresAt - existing.CreatedAt;
        var response = await IssueTokensAsync(user, existing, originalRefreshTokenLifetime, cancellationToken);
        await auditService.WriteAsync(AuditActionType.RefreshTokenRotated, "RefreshToken", existing.Id.ToString(), cancellationToken: cancellationToken);
        return response;
    }

    public async Task LogoutAsync(RefreshRequest? request, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(request?.RefreshToken))
        {
            var hash = HashToken(request.RefreshToken);
            var token = await db.RefreshTokens.SingleOrDefaultAsync(x => x.TokenHash == hash, cancellationToken);
            if (token is not null && (currentUser.IsInRole(AppRoles.SystemAdministrator) || token.UserId == currentUser.UserId))
            {
                token.RevokedAt ??= DateTimeOffset.UtcNow;
                token.RevokedByIp = currentUser.IpAddress;
                token.RevokeReason = "Kullanıcı çıkış yaptı.";
            }
        }
        else if (currentUser.UserId is not null)
        {
            var tokens = await db.RefreshTokens.Where(x => x.UserId == currentUser.UserId && x.RevokedAt == null).ToListAsync(cancellationToken);
            foreach (var token in tokens)
            {
                token.RevokedAt = DateTimeOffset.UtcNow;
                token.RevokedByIp = currentUser.IpAddress;
                token.RevokeReason = "Kullanıcı tüm oturumlardan çıkış yaptı.";
            }
        }
        await db.SaveChangesAsync(cancellationToken);
        await auditService.WriteAsync(AuditActionType.Logout, "Authentication", currentUser.UserId, cancellationToken: cancellationToken);
    }

    public async Task<CurrentUserDto> MeAsync(CancellationToken cancellationToken)
    {
        var id = currentUser.UserId ?? throw new UnauthorizedException();
        var user = await userManager.Users.Include(x => x.Faculty).SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                   ?? throw new UnauthorizedException();
        var roles = await userManager.GetRolesAsync(user);
        var authorizedFaculties = await db.UserFacultyPermissions.AsNoTracking()
            .Where(x => x.UserId == id && x.Faculty.IsActive)
            .OrderBy(x => x.Faculty.Name)
            .Select(x => new AuthorizedFacultyDto(x.FacultyId, x.Faculty.Name, (int)x.Permissions))
            .ToListAsync(cancellationToken);
        return new CurrentUserDto(
            user.Id,
            user.Email ?? string.Empty,
            user.FullName,
            user.FacultyId,
            user.Faculty?.Name,
            user.Department,
            roles.ToList(),
            authorizedFaculties,
            user.ThemePreference);
    }

    public async Task UpdateThemePreferenceAsync(UpdateThemePreferenceRequest request, CancellationToken cancellationToken)
    {
        await themePreferenceValidator.ValidateRequestAsync(request, cancellationToken);
        var id = currentUser.UserId ?? throw new UnauthorizedException();
        var user = await userManager.FindByIdAsync(id) ?? throw new UnauthorizedException();
        user.ThemePreference = request.Theme;
        await userManager.UpdateAsync(user);
    }

    private async Task<TokenResponse> IssueTokensAsync(
        ApplicationUser user,
        RefreshToken? replacedToken,
        TimeSpan refreshTokenLifetime,
        CancellationToken cancellationToken)
    {
        if (Encoding.UTF8.GetByteCount(_options.Secret) < 32)
            throw new InvalidOperationException("JWT secret en az 32 bayt olmalıdır.");

        var now = DateTimeOffset.UtcNow;
        var accessExpires = now.AddMinutes(_options.AccessTokenMinutes);
        var roles = await userManager.GetRolesAsync(user);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id),
            new(ClaimTypes.NameIdentifier, user.Id),
            new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new(ClaimTypes.Email, user.Email ?? string.Empty),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N"))
        };
        if (user.FacultyId is { } facultyId)
            claims.Add(new Claim("faculty_id", facultyId.ToString()));
        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

        var signingCredentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.Secret)),
            SecurityAlgorithms.HmacSha256);
        var jwt = new JwtSecurityToken(
            _options.Issuer,
            _options.Audience,
            claims,
            now.UtcDateTime,
            accessExpires.UtcDateTime,
            signingCredentials);
        var accessToken = new JwtSecurityTokenHandler().WriteToken(jwt);

        var rawRefresh = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
        var refreshExpires = now.Add(refreshTokenLifetime);
        var refresh = new RefreshToken
        {
            UserId = user.Id,
            TokenHash = HashToken(rawRefresh),
            FamilyId = replacedToken?.FamilyId ?? Guid.NewGuid().ToString("N"),
            ExpiresAt = refreshExpires,
            CreatedAt = now,
            CreatedByIp = currentUser.IpAddress
        };
        if (replacedToken is not null)
            replacedToken.ReplacedByTokenHash = refresh.TokenHash;
        db.RefreshTokens.Add(refresh);
        await db.SaveChangesAsync(cancellationToken);
        return new TokenResponse(accessToken, rawRefresh, accessExpires, refreshExpires);
    }

    internal static string HashToken(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}

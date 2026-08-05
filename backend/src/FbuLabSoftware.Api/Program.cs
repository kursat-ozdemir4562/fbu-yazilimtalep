using System.Net;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using FbuLabSoftware.Api;
using FbuLabSoftware.Application;
using FbuLabSoftware.Domain;
using FbuLabSoftware.Infrastructure;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;
using Sustainsys.Saml2;
using Sustainsys.Saml2.AspNetCore2;
using Sustainsys.Saml2.Metadata;
using Sustainsys.Saml2.WebSso;

const string SamlCookieScheme = "Saml2Cookies";

var builder = WebApplication.CreateBuilder(args);
var absoluteUploadLimit = builder.Configuration.GetValue<long>("Uploads:AbsoluteMaxFileBytes", 50 * 1024 * 1024);
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = absoluteUploadLimit);
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
    options.MultipartBodyLengthLimit = absoluteUploadLimit);
var forwardedHeadersConfiguration = builder.Configuration.GetSection("ForwardedHeaders");
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.ForwardLimit = forwardedHeadersConfiguration.GetValue("ForwardLimit", 1);
    if (options.ForwardLimit < 1)
        throw new InvalidOperationException("ForwardedHeaders:ForwardLimit en az 1 olmalıdır.");
    options.RequireHeaderSymmetry = forwardedHeadersConfiguration.GetValue("RequireHeaderSymmetry", true);

    foreach (var configuredProxy in forwardedHeadersConfiguration.GetSection("KnownProxies").Get<string[]>() ?? [])
    {
        if (!IPAddress.TryParse(configuredProxy, out var proxy))
            throw new InvalidOperationException($"Geçersiz ForwardedHeaders:KnownProxies değeri: {configuredProxy}");
        options.KnownProxies.Add(proxy);
    }
    foreach (var configuredNetwork in forwardedHeadersConfiguration.GetSection("KnownNetworks").Get<string[]>() ?? [])
        options.KnownNetworks.Add(ParseKnownNetwork(configuredNetwork));
});
var seedOnly = args.Any(x => string.Equals(x, "--seed-only", StringComparison.OrdinalIgnoreCase));
var jwtSecret = builder.Configuration["Jwt:Secret"] ?? Environment.GetEnvironmentVariable("JWT_SECRET");
if (string.IsNullOrWhiteSpace(jwtSecret))
{
    if (!seedOnly && !builder.Environment.IsEnvironment("Testing"))
        throw new InvalidOperationException("Jwt:Secret user secret veya JWT_SECRET environment variable ile tanımlanmalıdır.");
    jwtSecret = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(48));
    builder.Configuration["Jwt:Secret"] = jwtSecret;
}
if (Encoding.UTF8.GetByteCount(jwtSecret) < 32)
    throw new InvalidOperationException("JWT secret en az 32 bayt olmalıdır.");

builder.Host.UseSerilog((context, services, logger) => logger
    .ReadFrom.Configuration(context.Configuration)
    .ReadFrom.Services(services)
    .Enrich.FromLogContext()
    .WriteTo.Console());

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration, builder.Environment);
// Anahtarları DB'de sakla — container her deploy'da yeniden oluşturuluyor, diskteki
// varsayılan anahtar deposu (bkz. "may not be persisted outside of the container" uyarısı)
// her deploy'da kaybolur ve önceden şifrelenmiş LDAP bind şifresi çözülemez hale gelir.
builder.Services.AddDataProtection().PersistKeysToDbContext<AppDbContext>();
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        options.JsonSerializerOptions.Converters.Add(new TimeOnlyJsonConverter());
    });
builder.Services.Configure<Microsoft.AspNetCore.Mvc.ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        var details = new ValidationProblemDetails(context.ModelState)
        {
            Title = "İstek doğrulaması başarısız.",
            Status = StatusCodes.Status400BadRequest,
            Instance = context.HttpContext.Request.Path
        };
        details.Extensions["traceId"] = context.HttpContext.TraceIdentifier;
        return new Microsoft.AspNetCore.Mvc.BadRequestObjectResult(details);
    };
});

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "FbuLabSoftware",
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "FbuLabSoftware.Client",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            NameClaimType = System.Security.Claims.ClaimTypes.NameIdentifier,
            RoleClaimType = System.Security.Claims.ClaimTypes.Role,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                var userId = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier)
                             ?? context.Principal?.FindFirstValue("sub");
                if (string.IsNullOrWhiteSpace(userId))
                {
                    context.Fail("Token kullanıcı kimliği içermiyor.");
                    return;
                }

                var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                var isActive = await db.Users.AsNoTracking()
                    .AnyAsync(user => user.Id == userId && user.IsActive, context.HttpContext.RequestAborted);
                if (!isActive)
                    context.Fail("Kullanıcı aktif değil.");
            }
        };
    })
    .AddCookie(SamlCookieScheme)
    .AddSaml2(options =>
    {
        var publicOrigin = builder.Configuration["Saml:PublicOrigin"]?.TrimEnd('/');
        if (!string.IsNullOrWhiteSpace(publicOrigin))
        {
            options.SPOptions.EntityId = new EntityId($"{publicOrigin}/auth/saml/metadata");
            options.SPOptions.PublicOrigin = new Uri(publicOrigin);
            options.SPOptions.ReturnUrl = new Uri($"{publicOrigin}/api/auth/sso/complete");
        }
        options.SPOptions.ModulePath = "/auth/saml";
        options.SignInScheme = SamlCookieScheme;

        var idpEntityId = builder.Configuration["Saml:IdpEntityId"];
        if (!string.IsNullOrWhiteSpace(idpEntityId))
        {
            var identityProvider = new IdentityProvider(new EntityId(idpEntityId), options.SPOptions)
            {
                MetadataLocation = Path.Combine(AppContext.BaseDirectory, "Saml", "idp-metadata.xml"),
                LoadMetadata = true,
                AllowUnsolicitedAuthnResponse = true
            };
            options.IdentityProviders.Add(identityProvider);
        }
    });

// DB'de Enabled=true bir SamlSettings satırı varsa yukarıdaki statik appsettings tabanlı
// yapılandırmayı DB değerleriyle override eder; yoksa/disabled ise hiçbir şeye dokunmaz
// (statik config aynen kullanılmaya devam eder — canlı SSO'yu bozmama garantisi). Admin GUI'den
// kaydettikten sonra IOptionsMonitorCache<Saml2Options>.TryRemove(Saml2Defaults.Scheme) çağrılır;
// bu sayede bir sonraki SSO isteği yeni ayarları restart gerekmeden alır (bkz. ASP.NET Core
// named-options pattern: IOptionsMonitor<T>.Get(name) cache invalidation sonrası yeniden build eder).
builder.Services.AddOptions<Saml2Options>(Saml2Defaults.Scheme)
    .Configure<IServiceScopeFactory>((options, scopeFactory) =>
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var settings = db.SamlSettings.AsNoTracking().SingleOrDefault();
        if (settings is not { Enabled: true } ||
            string.IsNullOrWhiteSpace(settings.IdpEntityId) ||
            string.IsNullOrWhiteSpace(settings.IdpSsoUrl) ||
            string.IsNullOrWhiteSpace(settings.Certificate))
            return;

        X509Certificate2 certificate;
        try
        {
            var certificateBytes = Convert.FromBase64String(CleanCertificateText(settings.Certificate));
            certificate = new X509Certificate2(certificateBytes);
        }
        catch (Exception ex) when (ex is FormatException or CryptographicException)
        {
            var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
            logger.LogError(ex, "SamlSettings.Certificate ayrıştırılamadı, statik SAML yapılandırması kullanılmaya devam ediyor.");
            return;
        }

        // Sıra kritik: IdentityProvider.Validate() (LoadMetadata setter'ı içinde çalışır)
        // Binding, SingleSignOnServiceUrl ve en az bir SigningKey'in ÖNCEDEN set edilmiş
        // olmasını şart koşuyor — bunlar eksikken LoadMetadata atanırsa (true ya da false
        // fark etmez) ConfigurationErrorsException fırlatıyor. Bu handler SAML dışı TÜM
        // istekler için de çalıştığından (Saml2Handler bir IAuthenticationRequestHandler),
        // buradaki bir hata tüm uygulamayı kilitler — sıra bilinçli olarak bu şekilde.
        var identityProvider = new IdentityProvider(new EntityId(settings.IdpEntityId), options.SPOptions)
        {
            SingleSignOnServiceUrl = new Uri(settings.IdpSsoUrl),
            Binding = Saml2BindingType.HttpRedirect,
            AllowUnsolicitedAuthnResponse = true
        };
        if (!string.IsNullOrWhiteSpace(settings.IdpSloUrl))
            identityProvider.SingleLogoutServiceUrl = new Uri(settings.IdpSloUrl);
        identityProvider.SigningKeys.AddConfiguredKey(certificate);
        identityProvider.LoadMetadata = false;

        // IdentityProviderDictionary bir Clear() sunmuyor (bkz. Sustainsys.Saml2 kaynak kodu);
        // önce statik config'ten gelen kayıtları tek tek kaldırıyoruz.
        foreach (var existing in options.IdentityProviders.KnownIdentityProviders)
            options.IdentityProviders.Remove(existing.EntityId);
        options.IdentityProviders.Add(identityProvider);
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdministratorOnly", policy => policy.RequireRole(AppRoles.SystemAdministrator));
    options.AddPolicy("FacultyOrAdministrator", policy =>
        policy.RequireRole(AppRoles.FacultyAuthorizedUser, AppRoles.SystemAdministrator));
});

var corsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                  ?? ["http://localhost:5173", "https://localhost:5173"];
builder.Services.AddCors(options => options.AddPolicy("Frontend", policy =>
    policy.WithOrigins(corsOrigins).AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = builder.Configuration.GetValue("RateLimit:PermitLimit", 100),
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
    options.AddPolicy("auth", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = builder.Configuration.GetValue("RateLimit:AuthPermitLimit", 10),
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
});
builder.Services.AddHealthChecks().AddDbContextCheck<AppDbContext>("database");
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "FBU Laboratuvar Yazılım Talep Sistemi API",
        Version = "v1",
        Description = "Fenerbahçe Üniversitesi laboratuvar yazılım talepleri API'si"
    });
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header
    });
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        [new OpenApiSecurityScheme
        {
            Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
        }] = []
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var autoMigrate = builder.Configuration.GetValue("Database:AutoMigrate", false);
    if (autoMigrate || seedOnly)
    {
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        if (db.Database.IsRelational())
            await db.Database.MigrateAsync();
        else
            await db.Database.EnsureCreatedAsync();
        await scope.ServiceProvider.GetRequiredService<IDevelopmentSeeder>().SeedAsync(CancellationToken.None);
    }
}
if (seedOnly)
    return;

app.UseForwardedHeaders();
app.UseMiddleware<GlobalExceptionMiddleware>();
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseSerilogRequestLogging(options =>
{
    options.MessageTemplate = "HTTP {RequestMethod} {RequestPath} {StatusCode} {Elapsed:0.0000} ms";
});
var configuredUrls = builder.Configuration["ASPNETCORE_URLS"] ?? builder.Configuration["urls"];
var hasHttpsEndpoint = string.IsNullOrWhiteSpace(configuredUrls) ||
                       configuredUrls.Contains("https://", StringComparison.OrdinalIgnoreCase);
if (!app.Environment.IsEnvironment("Testing") &&
    builder.Configuration.GetValue("HttpsRedirection:Enabled", true) &&
    hasHttpsEndpoint)
    app.UseHttpsRedirection();
if (app.Environment.IsDevelopment() ||
    builder.Configuration.GetValue("Swagger:Enabled", false))
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
app.UseCors("Frontend");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health").AllowAnonymous();

app.MapGet("/api/auth/sso/complete", async (HttpContext http, IAuthService authService, IConfiguration configuration, CancellationToken cancellationToken) =>
{
    var publicOrigin = configuration["Saml:PublicOrigin"]?.TrimEnd('/') ?? string.Empty;
    var authResult = await http.AuthenticateAsync(SamlCookieScheme);
    if (!authResult.Succeeded || authResult.Principal is null)
        return Results.Redirect($"{publicOrigin}/giris?sso=hata");

    var email = authResult.Principal.FindFirstValue(ClaimTypes.Email)
        ?? authResult.Principal.FindFirstValue("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress")
        ?? authResult.Principal.FindFirstValue(ClaimTypes.Upn)
        ?? authResult.Principal.FindFirstValue(ClaimTypes.NameIdentifier);
    var givenName = authResult.Principal.FindFirstValue(ClaimTypes.GivenName);
    var surname = authResult.Principal.FindFirstValue(ClaimTypes.Surname);
    var fullName = !string.IsNullOrWhiteSpace(givenName) || !string.IsNullOrWhiteSpace(surname)
        ? $"{givenName} {surname}".Trim()
        : authResult.Principal.FindFirstValue(ClaimTypes.Name);

    await http.SignOutAsync(SamlCookieScheme);

    if (string.IsNullOrWhiteSpace(email))
        return Results.Redirect($"{publicOrigin}/giris?sso=hata");

    try
    {
        var tokens = await authService.LoginWithSsoAsync(email, fullName, cancellationToken);
        var fragment = $"access_token={Uri.EscapeDataString(tokens.AccessToken)}&refresh_token={Uri.EscapeDataString(tokens.RefreshToken)}";
        return Results.Redirect($"{publicOrigin}/sso/callback#{fragment}");
    }
    catch (UnauthorizedException)
    {
        return Results.Redirect($"{publicOrigin}/giris?sso=pasif");
    }
}).AllowAnonymous();

app.Run();

static Microsoft.AspNetCore.HttpOverrides.IPNetwork ParseKnownNetwork(string value)
{
    var parts = value.Split('/', StringSplitOptions.TrimEntries);
    if (parts.Length != 2 ||
        !IPAddress.TryParse(parts[0], out var prefix) ||
        !int.TryParse(parts[1], out var prefixLength) ||
        prefixLength < 0 ||
        prefixLength > prefix.GetAddressBytes().Length * 8)
        throw new InvalidOperationException($"Geçersiz ForwardedHeaders:KnownNetworks CIDR değeri: {value}");

    return new Microsoft.AspNetCore.HttpOverrides.IPNetwork(prefix, prefixLength);
}

// Admin GUI'den yapıştırılan sertifika "-----BEGIN CERTIFICATE-----" başlıklı PEM formatında ya
// da ham base64 olabilir; Convert.FromBase64String yalnız ham base64 kabul ettiği için başlık/altlık
// satırlarını ve boşlukları temizler.
static string CleanCertificateText(string certificate) =>
    string.Concat(certificate
        .Replace("-----BEGIN CERTIFICATE-----", string.Empty)
        .Replace("-----END CERTIFICATE-----", string.Empty)
        .Where(c => !char.IsWhiteSpace(c)));

public partial class Program;

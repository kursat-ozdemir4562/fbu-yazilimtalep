using FbuLabSoftware.Application;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace FbuLabSoftware.Infrastructure;

public static class InfrastructureRegistration
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        var provider = configuration["Database:Provider"] ?? "SqlServer";
        if (provider.Equals("InMemory", StringComparison.OrdinalIgnoreCase) &&
            !environment.IsDevelopment() &&
            !environment.IsEnvironment("Testing"))
            throw new InvalidOperationException("InMemory veritabanı yalnızca Development veya Testing ortamında kullanılabilir.");

        services.AddDbContext<AppDbContext>(options =>
        {
            if (provider.Equals("InMemory", StringComparison.OrdinalIgnoreCase))
            {
                options.UseInMemoryDatabase(configuration["Database:Name"] ?? $"FbuLabSoftware-{environment.EnvironmentName}");
            }
            else
            {
                var connectionString = configuration.GetConnectionString("DefaultConnection")
                    ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection tanımlanmalıdır.");
                if (provider.Equals("Npgsql", StringComparison.OrdinalIgnoreCase) ||
                    provider.Equals("PostgreSql", StringComparison.OrdinalIgnoreCase))
                {
                    options.UseNpgsql(connectionString, npgsql =>
                    {
                        npgsql.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName);
                        npgsql.EnableRetryOnFailure(3);
                    });
                }
                else
                {
                    options.UseSqlServer(connectionString, sql =>
                    {
                        sql.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName);
                        sql.EnableRetryOnFailure(3);
                    });
                }
            }
        });

        services.AddIdentityCore<ApplicationUser>(options =>
            {
                options.Password.RequiredLength = 10;
                options.Password.RequireDigit = true;
                options.Password.RequireLowercase = true;
                options.Password.RequireUppercase = true;
                options.Password.RequireNonAlphanumeric = true;
                options.Lockout.AllowedForNewUsers = true;
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
                options.User.RequireUniqueEmail = true;
            })
            .AddRoles<IdentityRole>()
            .AddEntityFrameworkStores<AppDbContext>()
            .AddDefaultTokenProviders();

        services.Configure<JwtOptions>(options =>
        {
            options.Issuer = configuration["Jwt:Issuer"] ?? options.Issuer;
            options.Audience = configuration["Jwt:Audience"] ?? options.Audience;
            options.Secret = configuration["Jwt:Secret"]
                             ?? Environment.GetEnvironmentVariable("JWT_SECRET")
                             ?? string.Empty;
            options.AccessTokenMinutes = configuration.GetValue("Jwt:AccessTokenMinutes", options.AccessTokenMinutes);
            options.RefreshTokenDays = configuration.GetValue("Jwt:RefreshTokenDays", options.RefreshTokenDays);
            options.RememberMeRefreshTokenDays = configuration.GetValue("Jwt:RememberMeRefreshTokenDays", options.RememberMeRefreshTokenDays);
        });

        services.AddScoped<ResourceAuthorizationService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IFacultyService, FacultyService>();
        services.AddScoped<ILaboratoryService, LaboratoryService>();
        services.AddScoped<IAcademicTermService, AcademicTermService>();
        services.AddScoped<IInstructorDirectoryService, InstructorDirectoryService>();
        services.AddScoped<ISoftwareService, SoftwareService>();
        services.AddScoped<ISoftwareSuggestionService, SoftwareSuggestionService>();
        services.AddScoped<IRequestService, RequestService>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<IAuditService, AuditService>();
        services.AddScoped<IReportService, ReportService>();
        services.AddScoped<IUserAdministrationService, UserAdministrationService>();
        services.AddScoped<ISystemSettingService, SystemSettingService>();
        services.Configure<SmtpOptions>(configuration.GetSection("Smtp"));
        services.AddScoped<IEmailSender, SmtpEmailSender>();
        services.AddScoped<IDevelopmentSeeder, DevelopmentSeeder>();

        services.Configure<LdapOptions>(configuration.GetSection("Ldap"));
        services.AddScoped<IAdSyncService, AdSyncService>();
        services.AddHostedService<AdSyncBackgroundService>();
        services.AddScoped<ISamlSettingsService, SamlSettingsService>();
        return services;
    }
}

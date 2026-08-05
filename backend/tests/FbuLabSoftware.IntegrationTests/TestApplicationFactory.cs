using System.Net.Http.Headers;
using System.Net.Http.Json;
using FbuLabSoftware.Application;
using FbuLabSoftware.Domain;
using FbuLabSoftware.Infrastructure;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

[assembly: CollectionBehavior(DisableTestParallelization = true)]

namespace FbuLabSoftware.IntegrationTests;

public sealed class TestApplicationFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    public const string Password = "Test-Only!Pass1234";
    private readonly string _databaseName = $"FbuIntegration-{Guid.NewGuid():N}";
    public Guid PrimaryFacultyId { get; private set; }
    public Guid OtherFacultyId { get; private set; }
    public Guid OwnRequestId { get; private set; }
    public Guid OtherRequestId { get; private set; }
    public Guid AcademicTermId { get; private set; }
    public Guid SoftwareId { get; private set; }
    public string SecondAcademicId { get; private set; } = string.Empty;

    public TestApplicationFactory()
    {
        Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Testing");
        Environment.SetEnvironmentVariable("Database__Provider", "InMemory");
        Environment.SetEnvironmentVariable("Database__Name", _databaseName);
        Environment.SetEnvironmentVariable("Database__AutoMigrate", "true");
        Environment.SetEnvironmentVariable("JWT_SECRET", "integration-tests-only-jwt-secret-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ");
        Environment.SetEnvironmentVariable("INITIAL_ADMIN_PASSWORD", Password);
        Environment.SetEnvironmentVariable("INITIAL_ACADEMIC_PASSWORD", Password);
        Environment.SetEnvironmentVariable("INITIAL_FACULTY_USER_PASSWORD", Password);
        Environment.SetEnvironmentVariable("HttpsRedirection__Enabled", "false");
        Environment.SetEnvironmentVariable("RateLimit__AuthPermitLimit", "1000");
    }

    protected override IHost CreateHost(IHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, configuration) =>
        {
            configuration.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Database:Provider"] = "InMemory",
                ["Database:Name"] = _databaseName,
                ["Database:AutoMigrate"] = "true",
                ["Jwt:Secret"] = "integration-tests-only-jwt-secret-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ",
                ["HttpsRedirection:Enabled"] = "false",
                ["RateLimit:AuthPermitLimit"] = "1000",
                ["Swagger:Enabled"] = "false",
                ["Seed:INITIAL_ADMIN_PASSWORD"] = Password,
                ["Seed:INITIAL_ACADEMIC_PASSWORD"] = Password,
                ["Seed:INITIAL_FACULTY_USER_PASSWORD"] = Password
            });
        });
        return base.CreateHost(builder);
    }

    public async Task InitializeAsync()
    {
        _ = CreateClient();
        await using var scope = Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var academic = await users.FindByEmailAsync("akademisyen@fbu.edu.tr")
                       ?? throw new InvalidOperationException("Seed academic missing.");
        PrimaryFacultyId = academic.FacultyId!.Value;
        AcademicTermId = await db.AcademicTerms.Select(x => x.Id).FirstAsync();
        SoftwareId = await db.SoftwareApplications.Select(x => x.Id).FirstAsync();

        var otherFaculty = new Faculty
        {
            Name = "Test İkinci Fakülte",
            Code = ($"TST-{Guid.NewGuid():N}")[..12]
        };
        db.Faculties.Add(otherFaculty);
        await db.SaveChangesAsync();
        OtherFacultyId = otherFaculty.Id;
        var secondAcademic = new ApplicationUser
        {
            UserName = "akademisyen2@fbu.edu.tr",
            Email = "akademisyen2@fbu.edu.tr",
            EmailConfirmed = true,
            FullName = "İkinci Akademisyen",
            FacultyId = otherFaculty.Id,
            IsActive = true
        };
        var result = await users.CreateAsync(secondAcademic, Password);
        if (!result.Succeeded)
            throw new InvalidOperationException(string.Join(" ", result.Errors.Select(x => x.Description)));
        await users.AddToRoleAsync(secondAcademic, AppRoles.Academic);
        SecondAcademicId = secondAcademic.Id;

        var own = new SoftwareRequest
        {
            OwnerUserId = academic.Id,
            FacultyId = PrimaryFacultyId,
            AcademicTermId = AcademicTermId,
            CourseCode = "OWN101",
            CourseName = "Kendi Talebi",
            InstructorEmail = academic.Email!,
            StudentCount = 1,
            CreatedByUserId = academic.Id
        };
        var other = new SoftwareRequest
        {
            OwnerUserId = secondAcademic.Id,
            FacultyId = OtherFacultyId,
            AcademicTermId = AcademicTermId,
            CourseCode = "OTH101",
            CourseName = "Başka Talep",
            InstructorEmail = secondAcademic.Email!,
            StudentCount = 1,
            CreatedByUserId = secondAcademic.Id
        };
        db.SoftwareRequests.AddRange(own, other);
        await db.SaveChangesAsync();
        OwnRequestId = own.Id;
        OtherRequestId = other.Id;
    }

    Task IAsyncLifetime.DisposeAsync()
    {
        Dispose();
        return Task.CompletedTask;
    }

    public async Task<HttpClient> AuthenticatedClientAsync(string email)
    {
        var client = CreateClient();
        var login = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, Password));
        login.EnsureSuccessStatusCode();
        var token = await login.Content.ReadFromJsonAsync<TokenResponse>()
                    ?? throw new InvalidOperationException("Token response missing.");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);
        return client;
    }
}

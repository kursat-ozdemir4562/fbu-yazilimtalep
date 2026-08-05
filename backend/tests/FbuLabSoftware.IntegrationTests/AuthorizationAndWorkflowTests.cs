using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FbuLabSoftware.Application;
using FbuLabSoftware.Domain;
using FbuLabSoftware.Infrastructure;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace FbuLabSoftware.IntegrationTests;

public sealed class AuthorizationAndWorkflowTests(TestApplicationFactory factory) : IClassFixture<TestApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    [Fact]
    public async Task Anonymous_api_request_returns_401()
    {
        var response = await factory.CreateClient().GetAsync("/api/requests/my");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Academic_can_read_own_request()
    {
        using var client = await factory.AuthenticatedClientAsync("akademisyen@fbu.edu.tr");
        var response = await client.GetAsync($"/api/requests/{factory.OwnRequestId}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Academic_cannot_read_another_academics_request_by_changing_url_id()
    {
        using var client = await factory.AuthenticatedClientAsync("akademisyen@fbu.edu.tr");
        var response = await client.GetAsync($"/api/requests/{factory.OtherRequestId}");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Deactivated_user_cannot_keep_using_an_existing_access_token()
    {
        using var client = await factory.AuthenticatedClientAsync("akademisyen2@fbu.edu.tr");
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = await db.Users.SingleAsync(x => x.Id == factory.SecondAcademicId);
        user.IsActive = false;
        await db.SaveChangesAsync();

        try
        {
            var response = await client.GetAsync("/api/requests/my");
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
        finally
        {
            user.IsActive = true;
            await db.SaveChangesAsync();
        }
    }

    [Fact]
    public async Task Faculty_user_can_read_assigned_faculty_but_not_other_faculty()
    {
        using var client = await factory.AuthenticatedClientAsync("fakulteyetkilisi@fbu.edu.tr");
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/requests/{factory.OwnRequestId}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync($"/api/requests/{factory.OtherRequestId}")).StatusCode);
    }

    [Fact]
    public async Task Administrator_can_list_all_requests()
    {
        using var client = await factory.AuthenticatedClientAsync("admin@fbu.edu.tr");
        var result = await client.GetFromJsonAsync<PagedResult<SoftwareRequestDto>>("/api/requests?pageSize=100", JsonOptions);
        Assert.NotNull(result);
        Assert.Contains(result.Items, x => x.Id == factory.OwnRequestId);
        Assert.Contains(result.Items, x => x.Id == factory.OtherRequestId);
    }

    [Fact]
    public async Task Notifications_are_paged_and_can_be_limited_to_unread_items()
    {
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var userId = await db.Users.Where(x => x.Email == "akademisyen@fbu.edu.tr").Select(x => x.Id).SingleAsync();
            var existing = await db.Notifications.Where(x => x.UserId == userId).ToListAsync();
            db.Notifications.RemoveRange(existing);
            var now = DateTimeOffset.UtcNow;
            db.Notifications.AddRange(
                new Notification
                {
                    UserId = userId,
                    Type = NotificationType.RequestStatusChanged,
                    Title = "Bir",
                    Message = "Okunmamış",
                    CreatedAt = now.AddMinutes(-1)
                },
                new Notification
                {
                    UserId = userId,
                    Type = NotificationType.RequestStatusChanged,
                    Title = "İki",
                    Message = "Okunmamış",
                    CreatedAt = now
                },
                new Notification
                {
                    UserId = userId,
                    Type = NotificationType.RequestStatusChanged,
                    Title = "Üç",
                    Message = "Okunmuş",
                    IsRead = true,
                    ReadAt = now,
                    CreatedAt = now.AddMinutes(-2)
                });
            await db.SaveChangesAsync();
        }

        using var client = await factory.AuthenticatedClientAsync("akademisyen@fbu.edu.tr");
        var unread = await client.GetFromJsonAsync<PagedResult<NotificationDto>>(
            "/api/notifications?page=1&pageSize=1&unread=true",
            JsonOptions);
        Assert.NotNull(unread);
        Assert.Equal(2, unread.TotalCount);
        Assert.Single(unread.Items);
        Assert.All(unread.Items, item => Assert.False(item.IsRead));

        var all = await client.GetFromJsonAsync<PagedResult<NotificationDto>>(
            "/api/notifications?page=2&pageSize=2&unread=false",
            JsonOptions);
        Assert.NotNull(all);
        Assert.Equal(3, all.TotalCount);
        Assert.Equal(2, all.Page);
        Assert.Single(all.Items);
    }

    [Fact]
    public async Task Audit_log_endpoint_combines_paging_entity_search_and_action_filters()
    {
        using var client = await factory.AuthenticatedClientAsync("admin@fbu.edu.tr");
        var marker = Guid.NewGuid().ToString("N");
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.AuditLogs.AddRange(
                new AuditLog
                {
                    ActionType = AuditActionType.Created,
                    EntityType = nameof(SoftwareRequest),
                    EntityId = $"{marker}-1",
                    UserName = "operator"
                },
                new AuditLog
                {
                    ActionType = AuditActionType.Created,
                    EntityType = nameof(SoftwareRequest),
                    EntityId = "different-id",
                    UserName = $"operator-{marker}"
                },
                new AuditLog
                {
                    ActionType = AuditActionType.Updated,
                    EntityType = nameof(SoftwareRequest),
                    EntityId = $"{marker}-updated"
                },
                new AuditLog
                {
                    ActionType = AuditActionType.Created,
                    EntityType = nameof(Faculty),
                    EntityId = $"{marker}-faculty"
                });
            await db.SaveChangesAsync();
        }

        var result = await client.GetFromJsonAsync<PagedResult<AuditLogDto>>(
            $"/api/audit-logs?page=2&pageSize=1&entityType=SoftwareRequest&search={marker}&actionType=Created",
            JsonOptions);

        Assert.NotNull(result);
        Assert.Equal(2, result.TotalCount);
        Assert.Equal(2, result.Page);
        Assert.Single(result.Items);
        Assert.Equal(AuditActionType.Created, result.Items[0].ActionType);
        Assert.Equal(nameof(SoftwareRequest), result.Items[0].EntityType);
    }

    [Fact]
    public async Task Academic_cannot_override_faculty_from_request_body()
    {
        using var client = await factory.AuthenticatedClientAsync("akademisyen@fbu.edu.tr");
        var body = new CreateSoftwareRequestRequest(
            factory.OtherFacultyId,
            factory.AcademicTermId,
            "IDOR101",
            "IDOR Denemesi",
            "akademisyen@fbu.edu.tr",
            null,
            0,
            [],
            [],
            []);
        var response = await client.PostAsJsonAsync("/api/requests", body);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Suggestion_starts_pending_and_admin_approval_creates_software()
    {
        var uniqueName = $"Test Program {Guid.NewGuid():N}";
        using var academic = await factory.AuthenticatedClientAsync("akademisyen@fbu.edu.tr");
        var createdResponse = await academic.PostAsJsonAsync("/api/software/suggestions",
            new CreateSoftwareSuggestionRequest(uniqueName, "Test", null, "https://example.org/download",
                false, LicenseType.Free, "Türkçe", "Windows", "1.0", null));
        createdResponse.EnsureSuccessStatusCode();
        var created = await createdResponse.Content.ReadFromJsonAsync<SoftwareSuggestionDto>(JsonOptions);
        Assert.NotNull(created);
        Assert.Equal(ApprovalStatus.Pending, created.Status);

        using var admin = await factory.AuthenticatedClientAsync("admin@fbu.edu.tr");
        var approval = await admin.PostAsJsonAsync($"/api/software/suggestions/{created.Id}/approve",
            new ReviewSoftwareSuggestionRequest(null, null, null, null, null, null, null, null, null));
        approval.EnsureSuccessStatusCode();
        var approved = await approval.Content.ReadFromJsonAsync<SoftwareSuggestionDto>(JsonOptions);
        Assert.Equal(ApprovalStatus.Approved, approved!.Status);
        Assert.NotNull(approved.ApprovedSoftwareId);

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.True(await db.SoftwareApplications.AnyAsync(x => x.Id == approved.ApprovedSoftwareId));
    }

    [Fact]
    public async Task Suggestion_rejection_requires_reason()
    {
        using var admin = await factory.AuthenticatedClientAsync("admin@fbu.edu.tr");
        var response = await admin.PostAsJsonAsync($"/api/software/suggestions/{Guid.NewGuid()}/reject",
            new RejectSoftwareSuggestionRequest(""));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Suggestion_approval_override_rejects_unsafe_download_url()
    {
        using var academic = await factory.AuthenticatedClientAsync("akademisyen@fbu.edu.tr");
        var createdResponse = await academic.PostAsJsonAsync("/api/software/suggestions",
            new CreateSoftwareSuggestionRequest(
                $"URL Test {Guid.NewGuid():N}",
                "Test",
                null,
                "https://example.org/download",
                false,
                LicenseType.Free,
                "Türkçe",
                "Windows",
                "1.0",
                null));
        createdResponse.EnsureSuccessStatusCode();
        var created = await createdResponse.Content.ReadFromJsonAsync<SoftwareSuggestionDto>(JsonOptions);

        using var admin = await factory.AuthenticatedClientAsync("admin@fbu.edu.tr");
        var response = await admin.PostAsJsonAsync(
            $"/api/software/suggestions/{created!.Id}/approve",
            new ReviewSoftwareSuggestionRequest(null, null, null, "file:///etc/passwd", null, null, null, null, null));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Refresh_token_is_rotated_and_reuse_revokes_family()
    {
        using var client = factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest("akademisyen@fbu.edu.tr", TestApplicationFactory.Password));
        login.EnsureSuccessStatusCode();
        var first = (await login.Content.ReadFromJsonAsync<TokenResponse>())!;
        var rotation = await client.PostAsJsonAsync("/api/auth/refresh", new RefreshRequest(first.RefreshToken));
        rotation.EnsureSuccessStatusCode();
        var second = (await rotation.Content.ReadFromJsonAsync<TokenResponse>())!;
        Assert.NotEqual(first.RefreshToken, second.RefreshToken);

        var reuse = await client.PostAsJsonAsync("/api/auth/refresh", new RefreshRequest(first.RefreshToken));
        Assert.Equal(HttpStatusCode.Unauthorized, reuse.StatusCode);
        var familyRevoked = await client.PostAsJsonAsync("/api/auth/refresh", new RefreshRequest(second.RefreshToken));
        Assert.Equal(HttpStatusCode.Unauthorized, familyRevoked.StatusCode);
    }

    [Fact]
    public async Task Remember_me_refresh_rotation_preserves_the_long_lifetime()
    {
        using var client = factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest("akademisyen@fbu.edu.tr", TestApplicationFactory.Password, true));
        login.EnsureSuccessStatusCode();
        var first = (await login.Content.ReadFromJsonAsync<TokenResponse>())!;

        var rotation = await client.PostAsJsonAsync("/api/auth/refresh", new RefreshRequest(first.RefreshToken));
        rotation.EnsureSuccessStatusCode();
        var second = (await rotation.Content.ReadFromJsonAsync<TokenResponse>())!;

        Assert.True(first.RefreshTokenExpiresAt > DateTimeOffset.UtcNow.AddDays(29));
        Assert.True(second.RefreshTokenExpiresAt > DateTimeOffset.UtcNow.AddDays(29));
        Assert.True(second.RefreshTokenExpiresAt >= first.RefreshTokenExpiresAt);
    }

    [Fact]
    public async Task Capacity_warning_is_set_when_any_selected_laboratory_is_too_small()
    {
        Guid smallLaboratoryId;
        Guid largeLaboratoryId;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var suffix = Guid.NewGuid().ToString("N")[..8];
            var small = new Laboratory
            {
                FacultyId = factory.PrimaryFacultyId,
                Name = $"Küçük Lab {suffix}",
                Code = $"S-{suffix}",
                Capacity = 1,
                ComputerCount = 1
            };
            var large = new Laboratory
            {
                FacultyId = factory.PrimaryFacultyId,
                Name = $"Büyük Lab {suffix}",
                Code = $"L-{suffix}",
                Capacity = 100,
                ComputerCount = 100
            };
            db.Laboratories.AddRange(small, large);
            await db.SaveChangesAsync();
            smallLaboratoryId = small.Id;
            largeLaboratoryId = large.Id;
        }

        using var client = await factory.AuthenticatedClientAsync("akademisyen@fbu.edu.tr");
        var create = await client.PostAsJsonAsync("/api/requests", new CreateSoftwareRequestRequest(
            null,
            factory.AcademicTermId,
            $"CAP{Guid.NewGuid():N}"[..12],
            "Kapasite Testi",
            "akademisyen@fbu.edu.tr",
            null,
            2,
            [],
            [],
            [smallLaboratoryId, largeLaboratoryId]));
        create.EnsureSuccessStatusCode();
        var request = await create.Content.ReadFromJsonAsync<SoftwareRequestDto>(JsonOptions);
        Assert.NotNull(request);
        Assert.True(request.HasCapacityWarning);

        var firstStudent = await client.PostAsJsonAsync(
            $"/api/requests/{request.Id}/students",
            new StudentInput($"S{Guid.NewGuid():N}", "Bir", "Öğrenci", null));
        firstStudent.EnsureSuccessStatusCode();
        var afterFirst = await client.GetFromJsonAsync<SoftwareRequestDto>($"/api/requests/{request.Id}", JsonOptions);
        Assert.NotNull(afterFirst);
        Assert.False(afterFirst.HasCapacityWarning);

        var secondStudent = await client.PostAsJsonAsync(
            $"/api/requests/{request.Id}/students",
            new StudentInput($"S{Guid.NewGuid():N}", "İki", "Öğrenci", null));
        secondStudent.EnsureSuccessStatusCode();
        var afterSecond = await client.GetFromJsonAsync<SoftwareRequestDto>($"/api/requests/{request.Id}", JsonOptions);
        Assert.NotNull(afterSecond);
        Assert.True(afterSecond.HasCapacityWarning);
    }

    [Fact]
    public void Testing_startup_uses_secure_forwarded_headers_and_enables_database_initialization()
    {
        var configuration = factory.Services.GetRequiredService<IConfiguration>();
        var forwardedHeaders = factory.Services.GetRequiredService<IOptions<ForwardedHeadersOptions>>().Value;
        var productionDefaults = new ConfigurationBuilder()
            .SetBasePath(AppContext.BaseDirectory)
            .AddJsonFile("appsettings.json")
            .Build();
        var developmentDefaults = new ConfigurationBuilder()
            .SetBasePath(AppContext.BaseDirectory)
            .AddJsonFile("appsettings.json")
            .AddJsonFile("appsettings.Development.json")
            .Build();

        Assert.Equal("true", configuration["Database:AutoMigrate"], ignoreCase: true);
        Assert.False(productionDefaults.GetValue<bool>("Database:AutoMigrate"));
        Assert.True(developmentDefaults.GetValue<bool>("Database:AutoMigrate"));
        Assert.Equal(1, forwardedHeaders.ForwardLimit);
        Assert.True(forwardedHeaders.RequireHeaderSymmetry);
        Assert.Equal(
            ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
            forwardedHeaders.ForwardedHeaders);
        Assert.NotEmpty(forwardedHeaders.KnownNetworks);
    }

    [Fact]
    public async Task Duplicate_student_number_in_same_request_returns_conflict()
    {
        using var client = await factory.AuthenticatedClientAsync("akademisyen@fbu.edu.tr");
        var student = new StudentInput($"S{Guid.NewGuid():N}", "Ada", "Lovelace", "ada@fbu.edu.tr");
        var first = await client.PostAsJsonAsync($"/api/requests/{factory.OwnRequestId}/students", student);
        first.EnsureSuccessStatusCode();
        var duplicate = await client.PostAsJsonAsync($"/api/requests/{factory.OwnRequestId}/students", student);
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
    }

    [Fact]
    public async Task Soft_deleted_request_is_no_longer_readable()
    {
        Guid requestId;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var request = new SoftwareRequest
            {
                OwnerUserId = factory.SecondAcademicId,
                FacultyId = factory.OtherFacultyId,
                AcademicTermId = factory.AcademicTermId,
                CourseCode = ($"DEL{Guid.NewGuid():N}")[..10],
                CourseName = "Silinecek Talep",
                InstructorEmail = "akademisyen2@fbu.edu.tr",
                CreatedByUserId = factory.SecondAcademicId
            };
            db.SoftwareRequests.Add(request);
            await db.SaveChangesAsync();
            requestId = request.Id;
        }
        using var client = await factory.AuthenticatedClientAsync("akademisyen2@fbu.edu.tr");
        var delete = await client.DeleteAsync($"/api/requests/{requestId}");
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);
        var get = await client.GetAsync($"/api/requests/{requestId}");
        Assert.Equal(HttpStatusCode.NotFound, get.StatusCode);
    }

    [Fact]
    public async Task Invalid_student_upload_extension_is_rejected()
    {
        using var client = await factory.AuthenticatedClientAsync("akademisyen@fbu.edu.tr");
        using var form = new MultipartFormDataContent();
        using var content = new ByteArrayContent("bad"u8.ToArray());
        content.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        form.Add(content, "file", "../students.exe");
        var response = await client.PostAsync($"/api/requests/{factory.OwnRequestId}/students/import", form);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
    }

    [Fact]
    public async Task Health_response_does_not_expose_secrets()
    {
        var response = await factory.CreateClient().GetAsync("/api/health");
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("ConnectionStrings", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Jwt", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(TestApplicationFactory.Password, body, StringComparison.Ordinal);
    }
}

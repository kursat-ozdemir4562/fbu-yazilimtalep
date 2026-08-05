using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text.Json;
using System.Text.Json.Serialization;
using FbuLabSoftware.Application;
using FbuLabSoftware.Domain;
using FbuLabSoftware.Infrastructure;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc.Testing;
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
            1,
            false,
            null,
            "akademisyen@fbu.edu.tr",
            null,
            0,
            [],
            [],
            [],
            null);
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
            1,
            false,
            null,
            "akademisyen@fbu.edu.tr",
            null,
            2,
            [],
            [],
            [smallLaboratoryId, largeLaboratoryId],
            null));
        create.EnsureSuccessStatusCode();
        var request = await create.Content.ReadFromJsonAsync<SoftwareRequestDto>(JsonOptions);
        Assert.NotNull(request);
        Assert.True(request.HasCapacityWarning);
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
        var delete = await client.PostAsync($"/api/requests/{requestId}/delete", null);
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);
        var get = await client.GetAsync($"/api/requests/{requestId}");
        Assert.Equal(HttpStatusCode.NotFound, get.StatusCode);
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

    [Fact]
    public async Task Request_draft_is_isolated_per_user_and_round_trips()
    {
        using var owner = await factory.AuthenticatedClientAsync("akademisyen@fbu.edu.tr");
        using var other = await factory.AuthenticatedClientAsync("akademisyen2@fbu.edu.tr");

        Assert.Equal(HttpStatusCode.NoContent, (await owner.PostAsync("/api/requests/draft/delete", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await owner.GetAsync("/api/requests/draft")).StatusCode);

        var save = await owner.PostAsJsonAsync("/api/requests/draft", new UpsertRequestDraftRequest("{\"courseCode\":\"CSE101\"}"));
        save.EnsureSuccessStatusCode();
        var saved = await save.Content.ReadFromJsonAsync<RequestDraftDto>(JsonOptions);
        Assert.NotNull(saved);
        Assert.Equal("{\"courseCode\":\"CSE101\"}", saved.PayloadJson);

        var ownerFetch = await owner.GetFromJsonAsync<RequestDraftDto>("/api/requests/draft", JsonOptions);
        Assert.NotNull(ownerFetch);
        Assert.Equal(saved.PayloadJson, ownerFetch.PayloadJson);

        Assert.Equal(HttpStatusCode.NoContent, (await other.GetAsync("/api/requests/draft")).StatusCode);

        var overwrite = await owner.PostAsJsonAsync("/api/requests/draft", new UpsertRequestDraftRequest("{\"courseCode\":\"CSE202\"}"));
        overwrite.EnsureSuccessStatusCode();
        var overwritten = await owner.GetFromJsonAsync<RequestDraftDto>("/api/requests/draft", JsonOptions);
        Assert.Equal("{\"courseCode\":\"CSE202\"}", overwritten!.PayloadJson);

        Assert.Equal(HttpStatusCode.NoContent, (await owner.PostAsync("/api/requests/draft/delete", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await owner.GetAsync("/api/requests/draft")).StatusCode);
    }

    [Fact]
    public async Task Theme_preference_persists_and_reflects_in_me_endpoint()
    {
        using var client = await factory.AuthenticatedClientAsync("akademisyen@fbu.edu.tr");
        var update = await client.PostAsJsonAsync("/api/auth/me/theme", new UpdateThemePreferenceRequest("light"));
        Assert.Equal(HttpStatusCode.NoContent, update.StatusCode);

        var me = await client.GetFromJsonAsync<CurrentUserDto>("/api/auth/me", JsonOptions);
        Assert.Equal("light", me!.ThemePreference);

        var invalid = await client.PostAsJsonAsync("/api/auth/me/theme", new UpdateThemePreferenceRequest("blue"));
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
    }

    [Fact]
    public async Task Ad_sync_status_is_admin_only_and_reports_unconfigured_when_ldap_host_is_missing()
    {
        using var admin = await factory.AuthenticatedClientAsync("admin@fbu.edu.tr");
        var status = await admin.GetFromJsonAsync<AdSyncStatusDto>("/api/admin/ad-sync", JsonOptions);
        Assert.NotNull(status);
        Assert.False(status.IsConfigured);

        using var academic = await factory.AuthenticatedClientAsync("akademisyen@fbu.edu.tr");
        var forbidden = await academic.GetAsync("/api/admin/ad-sync");
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);
    }

    [Fact]
    public async Task Ldap_settings_are_admin_only_and_round_trip_without_exposing_the_password()
    {
        using var academic = await factory.AuthenticatedClientAsync("akademisyen@fbu.edu.tr");
        Assert.Equal(HttpStatusCode.Forbidden, (await academic.GetAsync("/api/admin/ad-sync/settings")).StatusCode);

        using var admin = await factory.AuthenticatedClientAsync("admin@fbu.edu.tr");
        var initial = await admin.GetFromJsonAsync<LdapSettingsDto>("/api/admin/ad-sync/settings", JsonOptions);
        Assert.NotNull(initial);
        Assert.False(initial.Enabled);
        Assert.False(initial.HasBindPassword);

        try
        {
            var save = await admin.PostAsJsonAsync("/api/admin/ad-sync/settings", new UpsertLdapSettingsRequest(
                true, "dc1.fbu.edu.tr", 636, "dc2.fbu.edu.tr", 636, "CN=Lab Query,DC=fbu,DC=edu,DC=tr",
                "s3cret-pass", "OU=ACADEMIC,DC=fbu,DC=edu,DC=tr", "OU=ADMINISTRATIVE,DC=fbu,DC=edu,DC=tr", 6, null));
            save.EnsureSuccessStatusCode();
            var saveBody = await save.Content.ReadAsStringAsync();
            Assert.DoesNotContain("s3cret-pass", saveBody);
            var saved = JsonSerializer.Deserialize<LdapSettingsDto>(saveBody, JsonOptions);
            Assert.NotNull(saved);
            Assert.True(saved.HasBindPassword);

            var status = await admin.GetFromJsonAsync<AdSyncStatusDto>("/api/admin/ad-sync", JsonOptions);
            Assert.True(status!.IsConfigured);

            var reloaded = await admin.GetFromJsonAsync<LdapSettingsDto>("/api/admin/ad-sync/settings", JsonOptions);
            Assert.Equal("dc1.fbu.edu.tr", reloaded!.PrimaryHost);
            Assert.Equal("dc2.fbu.edu.tr", reloaded.SecondaryHost);
            Assert.True(reloaded.HasBindPassword);
        }
        finally
        {
            // Diğer testlerin (ör. varsayılan "yapılandırılmamış" durumunu bekleyen testler)
            // paylaşılan test DB'sinde bu testin bıraktığı satırdan etkilenmemesi için geri al.
            await using var scope = factory.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var row = await db.LdapSettings.SingleOrDefaultAsync();
            if (row is not null)
            {
                db.LdapSettings.Remove(row);
                await db.SaveChangesAsync();
            }
        }
    }

    [Fact]
    public async Task Saml_settings_are_admin_only_and_reject_enabling_without_a_valid_certificate()
    {
        using var academic = await factory.AuthenticatedClientAsync("akademisyen@fbu.edu.tr");
        Assert.Equal(HttpStatusCode.Forbidden, (await academic.GetAsync("/api/admin/saml-settings")).StatusCode);

        using var admin = await factory.AuthenticatedClientAsync("admin@fbu.edu.tr");
        var initial = await admin.GetFromJsonAsync<SamlSettingsDto>("/api/admin/saml-settings", JsonOptions);
        Assert.NotNull(initial);
        Assert.False(initial.Enabled);

        // Sertifikasız/geçersiz sertifikayla etkinleştirme reddedilmeli — canlı SSO'yu bozacak
        // bir yapılandırmanın kaydedilmesini önleyen doğrulama.
        var invalidCert = await admin.PostAsJsonAsync("/api/admin/saml-settings", new UpsertSamlSettingsRequest(
            true, "https://sts.windows.net/test/", "https://login.microsoftonline.com/test/saml2", null,
            "not-a-valid-certificate", "email", "name", "nameid"));
        Assert.False(invalidCert.IsSuccessStatusCode);

        try
        {
            using var rsa = RSA.Create(2048);
            var request = new CertificateRequest("CN=test-idp", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
            using var certificate = request.CreateSelfSigned(DateTimeOffset.UtcNow.AddDays(-1), DateTimeOffset.UtcNow.AddDays(1));
            var certificateBase64 = Convert.ToBase64String(certificate.Export(X509ContentType.Cert));

            var save = await admin.PostAsJsonAsync("/api/admin/saml-settings", new UpsertSamlSettingsRequest(
                true, "https://sts.windows.net/test/", "https://login.microsoftonline.com/test/saml2", null,
                certificateBase64, "email", "name", "nameid"));
            save.EnsureSuccessStatusCode();
            var saved = await save.Content.ReadFromJsonAsync<SamlSettingsDto>(JsonOptions);
            Assert.NotNull(saved);
            Assert.True(saved.Enabled);
            Assert.Equal("https://sts.windows.net/test/", saved.IdpEntityId);

            // Restart'sız geçiş: cache invalidate edildikten sonraki ilk SignIn isteği yeni
            // (DB'den okunan) IdP'ye yönlenmeli, sunucu hatası vermeden. Gerçek dış ağa
            // (login.microsoftonline.com) istek atılmasın diye redirect takibi kapalı.
            using var noRedirectClient = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
            var signIn = await noRedirectClient.GetAsync("/auth/saml/SignIn");
            Assert.NotEqual(HttpStatusCode.InternalServerError, signIn.StatusCode);
            Assert.True(
                signIn.StatusCode is HttpStatusCode.Redirect or HttpStatusCode.Found or HttpStatusCode.SeeOther,
                $"Beklenmeyen durum kodu: {signIn.StatusCode}");
        }
        finally
        {
            await using var scope = factory.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var row = await db.SamlSettings.SingleOrDefaultAsync();
            if (row is not null)
            {
                db.SamlSettings.Remove(row);
                await db.SaveChangesAsync();
            }
        }
    }
}

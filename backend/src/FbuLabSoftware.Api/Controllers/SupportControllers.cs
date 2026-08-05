using System.Reflection;
using FbuLabSoftware.Application;
using FbuLabSoftware.Domain;
using FbuLabSoftware.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace FbuLabSoftware.Api.Controllers;

[ApiController, Authorize, Route("api/reports")]
public sealed class ReportsController(IReportService service) : ControllerBase
{
    [HttpGet("requests")]
    public async Task<IActionResult> Requests([FromQuery] RequestQuery query, [FromQuery] string format = "csv",
        CancellationToken cancellationToken = default) => AsFile(await service.RequestsAsync(query, format, cancellationToken));

    [HttpGet("software")]
    public async Task<IActionResult> Software([FromQuery] string format = "csv", CancellationToken cancellationToken = default) =>
        AsFile(await service.SoftwareAsync(format, cancellationToken));

    [HttpGet("faculties")]
    public async Task<IActionResult> Faculties([FromQuery] string format = "csv", CancellationToken cancellationToken = default) =>
        AsFile(await service.FacultiesAsync(format, cancellationToken));

    [HttpGet("laboratories")]
    public async Task<IActionResult> Laboratories([FromQuery] string format = "csv", CancellationToken cancellationToken = default) =>
        AsFile(await service.LaboratoriesAsync(format, cancellationToken));

    [HttpGet("schedule")]
    public async Task<IActionResult> Schedule([FromQuery] string format = "csv", CancellationToken cancellationToken = default) =>
        AsFile(await service.ScheduleAsync(format, cancellationToken));

    private FileContentResult AsFile(ExportFile file) => File(file.Content, file.ContentType, file.FileName);
}

[ApiController, Authorize, Route("api/notifications")]
public sealed class NotificationsController(INotificationService service) : ControllerBase
{
    [HttpGet]
    public Task<PagedResult<NotificationDto>> Get(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] bool? unread = null,
        CancellationToken cancellationToken = default) =>
        service.GetAsync(page, pageSize, unread, cancellationToken);

    [HttpPost("{id:guid}/read")]
    public async Task<IActionResult> Read(Guid id, CancellationToken cancellationToken)
    {
        await service.ReadAsync(id, cancellationToken);
        return NoContent();
    }

    [HttpPost("read-all")]
    public async Task<IActionResult> ReadAll(CancellationToken cancellationToken)
    {
        await service.ReadAllAsync(cancellationToken);
        return NoContent();
    }
}

[ApiController, Authorize(Policy = "AdministratorOnly"), Route("api/audit-logs")]
public sealed class AuditLogsController(IAuditService service) : ControllerBase
{
    [HttpGet]
    public Task<PagedResult<AuditLogDto>> Get([FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        [FromQuery] string? entityType = null, [FromQuery] string? search = null,
        [FromQuery] AuditActionType? actionType = null, CancellationToken cancellationToken = default) =>
        service.GetAsync(page, pageSize, entityType, search, actionType, cancellationToken);
}

[ApiController, Authorize(Policy = "AdministratorOnly"), Route("api/users")]
public sealed class UsersController(IUserAdministrationService service) : ControllerBase
{
    [HttpGet]
    public Task<PagedResult<UserSummaryDto>> Get([FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null, CancellationToken cancellationToken = default) =>
        service.GetAsync(page, pageSize, search, cancellationToken);

    [HttpPost]
    public Task<UserSummaryDto> Create(CreateUserRequest request, CancellationToken cancellationToken) =>
        service.CreateAsync(request, cancellationToken);

    [HttpPut("{id}")]
    public Task<UserSummaryDto> Update(string id, UpdateUserRequest request, CancellationToken cancellationToken) =>
        service.UpdateAsync(id, request, cancellationToken);

    [HttpPut("{id}/faculty-permissions")]
    public async Task<IActionResult> SetFacultyPermission(string id, SetFacultyPermissionRequest request,
        CancellationToken cancellationToken)
    {
        await service.SetFacultyPermissionAsync(id, request, cancellationToken);
        return NoContent();
    }
}

[ApiController, Authorize(Policy = "AdministratorOnly"), Route("api/admin/ad-sync")]
public sealed class AdSyncController(IAdSyncService service) : ControllerBase
{
    [HttpGet]
    public Task<AdSyncStatusDto> Status(CancellationToken cancellationToken) => service.GetStatusAsync(cancellationToken);

    [HttpPost]
    public Task<AdSyncResult> Sync(CancellationToken cancellationToken) => service.SyncAsync(cancellationToken);

    [HttpGet("settings")]
    public Task<LdapSettingsDto> GetSettings(CancellationToken cancellationToken) => service.GetSettingsAsync(cancellationToken);

    [HttpPut("settings")]
    public Task<LdapSettingsDto> SaveSettings(UpsertLdapSettingsRequest request, CancellationToken cancellationToken) =>
        service.SaveSettingsAsync(request, cancellationToken);
}

[ApiController, Authorize(Policy = "AdministratorOnly"), Route("api/admin/saml-settings")]
public sealed class SamlSettingsController(ISamlSettingsService service) : ControllerBase
{
    [HttpGet]
    public Task<SamlSettingsDto> Get(CancellationToken cancellationToken) => service.GetAsync(cancellationToken);

    [HttpPut]
    public Task<SamlSettingsDto> Save(UpsertSamlSettingsRequest request, CancellationToken cancellationToken) =>
        service.SaveAsync(request, cancellationToken);
}

[ApiController, AllowAnonymous, Route("api/health")]
public sealed class HealthController(
    AppDbContext db,
    IWebHostEnvironment environment) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        var databaseAvailable = false;
        try
        {
            databaseAvailable = await db.Database.CanConnectAsync(cancellationToken);
        }
        catch
        {
            // Do not expose database or connection details.
        }
        var status = databaseAvailable ? "Healthy" : "Unhealthy";
        var body = new
        {
            status,
            checks = new { api = "Healthy", database = databaseAvailable ? "Healthy" : "Unhealthy" },
            environment = environment.EnvironmentName,
            version = Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "unknown",
            utcTime = DateTimeOffset.UtcNow
        };
        return StatusCode(databaseAvailable ? StatusCodes.Status200OK : StatusCodes.Status503ServiceUnavailable, body);
    }
}

[ApiController, Authorize(Policy = "AdministratorOnly"), Route("api/system-settings")]
public sealed class SystemSettingsController(ISystemSettingService service) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<SystemSettingDto>> Get(CancellationToken cancellationToken) =>
        service.GetAsync(cancellationToken);

    [HttpPut("{key}")]
    public Task<SystemSettingDto> Upsert(string key, UpsertSystemSettingRequest request,
        CancellationToken cancellationToken) => service.UpsertAsync(key, request, cancellationToken);

    [HttpPost("smtp-test")]
    public Task<SmtpTestResultDto> SendTestEmail(SendTestEmailRequest request, CancellationToken cancellationToken) =>
        service.SendTestEmailAsync(request, cancellationToken);

    [AllowAnonymous, HttpGet("timezone")]
    public Task<string> GetTimeZone(CancellationToken cancellationToken) => service.GetTimeZoneAsync(cancellationToken);
}

using FbuLabSoftware.Domain;

namespace FbuLabSoftware.Application;

public interface ICurrentUserService
{
    string? UserId { get; }
    string? Email { get; }
    string? IpAddress { get; }
    string? UserAgent { get; }
    bool IsAuthenticated { get; }
    bool IsInRole(string role);
}

public interface IAuthService
{
    Task<TokenResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken);
    Task<TokenResponse> LoginWithSsoAsync(string email, string? fullName, CancellationToken cancellationToken);
    Task<TokenResponse> RefreshAsync(RefreshRequest request, CancellationToken cancellationToken);
    Task LogoutAsync(RefreshRequest? request, CancellationToken cancellationToken);
    Task<CurrentUserDto> MeAsync(CancellationToken cancellationToken);
    Task UpdateThemePreferenceAsync(UpdateThemePreferenceRequest request, CancellationToken cancellationToken);
}

public interface IFacultyService
{
    Task<PagedResult<FacultyDto>> GetAsync(int page, int pageSize, string? search, CancellationToken cancellationToken);
    Task<FacultyDto> GetByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<FacultyDto> CreateAsync(CreateFacultyRequest request, CancellationToken cancellationToken);
    Task<FacultyDto> UpdateAsync(Guid id, UpdateFacultyRequest request, CancellationToken cancellationToken);
    Task DeleteAsync(Guid id, CancellationToken cancellationToken);
}

public interface ILaboratoryService
{
    Task<PagedResult<LaboratoryDto>> GetAsync(int page, int pageSize, string? search, Guid? facultyId, CancellationToken cancellationToken);
    Task<LaboratoryDto> GetByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<LaboratoryDto> CreateAsync(CreateLaboratoryRequest request, CancellationToken cancellationToken);
    Task<LaboratoryDto> UpdateAsync(Guid id, UpdateLaboratoryRequest request, CancellationToken cancellationToken);
    Task DeleteAsync(Guid id, CancellationToken cancellationToken);
}

public interface IInstructorDirectoryService
{
    Task<IReadOnlyList<InstructorDto>> SearchAsync(string? search, int limit, CancellationToken cancellationToken);
}

public interface IAcademicTermService
{
    Task<IReadOnlyList<AcademicTermDto>> GetAsync(CancellationToken cancellationToken);
    Task<AcademicTermDto> CreateAsync(UpsertAcademicTermRequest request, CancellationToken cancellationToken);
    Task<AcademicTermDto> UpdateAsync(Guid id, UpsertAcademicTermRequest request, CancellationToken cancellationToken);
    Task DeleteAsync(Guid id, CancellationToken cancellationToken);
}

public interface ISoftwareService
{
    Task<PagedResult<SoftwareDto>> GetAsync(int page, int pageSize, string? search, bool activeOnly, CancellationToken cancellationToken);
    Task<SoftwareDto> GetByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<IReadOnlyList<SoftwareDto>> SearchAsync(string query, int limit, CancellationToken cancellationToken);
    Task<SoftwareDto> CreateAsync(UpsertSoftwareRequest request, CancellationToken cancellationToken);
    Task<SoftwareDto> UpdateAsync(Guid id, UpsertSoftwareRequest request, CancellationToken cancellationToken);
    Task DeleteAsync(Guid id, CancellationToken cancellationToken);
}

public interface ISoftwareSuggestionService
{
    Task<SoftwareSuggestionDto> CreateAsync(CreateSoftwareSuggestionRequest request, CancellationToken cancellationToken);
    Task<PagedResult<SoftwareSuggestionDto>> GetAsync(int page, int pageSize, ApprovalStatus? status, CancellationToken cancellationToken);
    Task<IReadOnlyList<SoftwareSuggestionDto>> GetMineAsync(CancellationToken cancellationToken);
    Task<SoftwareSuggestionDto> ApproveAsync(Guid id, ReviewSoftwareSuggestionRequest? request, CancellationToken cancellationToken);
    Task<SoftwareSuggestionDto> RejectAsync(Guid id, RejectSoftwareSuggestionRequest request, CancellationToken cancellationToken);
}

public interface IRequestService
{
    Task<PagedResult<SoftwareRequestDto>> GetAsync(
        RequestQuery query,
        bool mineOnly,
        CancellationToken cancellationToken,
        FacultyPermission facultyPermission = FacultyPermission.View);
    Task<SoftwareRequestDto> GetByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<SoftwareRequestDto> CreateAsync(CreateSoftwareRequestRequest request, CancellationToken cancellationToken);
    Task<SoftwareRequestDto> UpdateAsync(Guid id, UpdateSoftwareRequestRequest request, CancellationToken cancellationToken);
    Task DeleteAsync(Guid id, CancellationToken cancellationToken);
    Task<SoftwareRequestDto> SubmitAsync(Guid id, CancellationToken cancellationToken);
    Task<SoftwareRequestDto> ChangeStatusAsync(Guid id, ChangeRequestStatusRequest request, CancellationToken cancellationToken);
    Task<SoftwareRequestDto> CopyAsync(Guid id, CancellationToken cancellationToken);
    Task<IReadOnlyList<SoftwareRequestRevisionDto>> GetHistoryAsync(Guid id, CancellationToken cancellationToken);
    Task<IReadOnlyList<CourseScheduleEntryDto>> GetScheduleAsync(CancellationToken cancellationToken);
    Task<RequestStatsDto> GetStatsAsync(CancellationToken cancellationToken);
    Task<RequestDraftDto?> GetDraftAsync(CancellationToken cancellationToken);
    Task<RequestDraftDto> SaveDraftAsync(UpsertRequestDraftRequest request, CancellationToken cancellationToken);
    Task DeleteDraftAsync(CancellationToken cancellationToken);
}

public interface INotificationService
{
    Task<PagedResult<NotificationDto>> GetAsync(int page, int pageSize, bool? unread, CancellationToken cancellationToken);
    Task ReadAsync(Guid id, CancellationToken cancellationToken);
    Task ReadAllAsync(CancellationToken cancellationToken);
}

public interface IAuditService
{
    Task<PagedResult<AuditLogDto>> GetAsync(
        int page,
        int pageSize,
        string? entityType,
        string? search,
        AuditActionType? actionType,
        CancellationToken cancellationToken);
    Task WriteAsync(
        AuditActionType action,
        string entityType,
        string? entityId,
        string? newValues = null,
        AuditActorIdentity? actor = null,
        CancellationToken cancellationToken = default);
}

public interface IReportService
{
    Task<ExportFile> RequestsAsync(RequestQuery query, string format, CancellationToken cancellationToken);
    Task<ExportFile> SoftwareAsync(string format, CancellationToken cancellationToken);
    Task<ExportFile> FacultiesAsync(string format, CancellationToken cancellationToken);
    Task<ExportFile> LaboratoriesAsync(string format, CancellationToken cancellationToken);
    Task<ExportFile> ScheduleAsync(string format, CancellationToken cancellationToken);
}

public interface IUserAdministrationService
{
    Task<PagedResult<UserSummaryDto>> GetAsync(int page, int pageSize, string? search, CancellationToken cancellationToken);
    Task<UserSummaryDto> CreateAsync(CreateUserRequest request, CancellationToken cancellationToken);
    Task<UserSummaryDto> UpdateAsync(string id, UpdateUserRequest request, CancellationToken cancellationToken);
    Task SetFacultyPermissionAsync(string id, SetFacultyPermissionRequest request, CancellationToken cancellationToken);
}

public enum EmailSendOutcome { Sent, NotConfigured, Failed }

public sealed record EmailSendResult(EmailSendOutcome Outcome, string? ErrorMessage);

public interface IEmailSender
{
    Task SendAsync(string recipient, string subject, string body, CancellationToken cancellationToken);
    Task<EmailSendResult> SendTestAsync(string recipient, CancellationToken cancellationToken);
}

public interface IDevelopmentSeeder
{
    Task SeedAsync(CancellationToken cancellationToken);
}

public interface ISystemSettingService
{
    Task<IReadOnlyList<SystemSettingDto>> GetAsync(CancellationToken cancellationToken);
    Task<SystemSettingDto> UpsertAsync(string key, UpsertSystemSettingRequest request, CancellationToken cancellationToken);
    Task<SmtpTestResultDto> SendTestEmailAsync(SendTestEmailRequest request, CancellationToken cancellationToken);
    Task<string> GetTimeZoneAsync(CancellationToken cancellationToken);
}

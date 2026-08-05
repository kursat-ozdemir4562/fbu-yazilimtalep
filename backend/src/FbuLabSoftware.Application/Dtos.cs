using FbuLabSoftware.Domain;

namespace FbuLabSoftware.Application;

public sealed record PagedResult<T>(
    IReadOnlyList<T> Items,
    int Page,
    int PageSize,
    int TotalCount)
{
    public int TotalPages => TotalCount == 0 ? 0 : (int)Math.Ceiling((double)TotalCount / PageSize);
}

public sealed record LoginRequest(string Email, string Password, bool RememberMe = false);
public sealed record RefreshRequest(string RefreshToken);
public sealed record TokenResponse(
    string AccessToken,
    string RefreshToken,
    DateTimeOffset AccessTokenExpiresAt,
    DateTimeOffset RefreshTokenExpiresAt);
public sealed record AuthorizedFacultyDto(Guid Id, string Name, int Permissions);
public sealed record CurrentUserDto(
    string Id,
    string Email,
    string FullName,
    Guid? FacultyId,
    string? FacultyName,
    string? Department,
    IReadOnlyList<string> Roles,
    IReadOnlyList<AuthorizedFacultyDto> AuthorizedFaculties);

public sealed record FacultyDto(
    Guid Id,
    string Name,
    string Code,
    string? Description,
    bool IsActive,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt);
public sealed record CreateFacultyRequest(string Name, string Code, string? Description);
public sealed record UpdateFacultyRequest(string Name, string Code, string? Description, bool IsActive);

public sealed record LaboratoryDto(
    Guid Id,
    Guid? FacultyId,
    string Name,
    string Code,
    string? Building,
    string? Floor,
    int Capacity,
    int ComputerCount,
    string? OperatingSystem,
    string? ComputerType,
    string? Description,
    bool IsActive);
public sealed record CreateLaboratoryRequest(
    string Name,
    string Code,
    string? Building,
    string? Floor,
    int Capacity,
    int ComputerCount,
    string? OperatingSystem,
    string? ComputerType,
    string? Description,
    Guid? FacultyId = null);
public sealed record UpdateLaboratoryRequest(
    string Name,
    string Code,
    string? Building,
    string? Floor,
    int Capacity,
    int ComputerCount,
    string? OperatingSystem,
    string? ComputerType,
    string? Description,
    bool IsActive,
    Guid? FacultyId = null);

public sealed record AcademicTermDto(
    Guid Id,
    string AcademicYear,
    string TermName,
    DateOnly StartDate,
    DateOnly EndDate,
    DateTimeOffset RequestStartDate,
    DateTimeOffset RequestEndDate,
    bool IsCurrent,
    bool IsActive);
public sealed record UpsertAcademicTermRequest(
    string AcademicYear,
    string TermName,
    DateOnly StartDate,
    DateOnly EndDate,
    DateTimeOffset RequestStartDate,
    DateTimeOffset RequestEndDate,
    bool IsCurrent,
    bool IsActive = true);

public sealed record SoftwareDto(
    Guid Id,
    string Name,
    string? Manufacturer,
    string? Description,
    string? DefaultDownloadUrl,
    LicenseType LicenseType,
    bool IsPaid,
    string? SupportedOperatingSystems,
    string? DefaultLanguage,
    string? Version,
    bool IsActive,
    ApprovalStatus ApprovalStatus,
    IReadOnlyList<Guid> LaboratoryIds);
public sealed record UpsertSoftwareRequest(
    string Name,
    string? Manufacturer,
    string? Description,
    string? DefaultDownloadUrl,
    LicenseType LicenseType,
    bool IsPaid,
    string? SupportedOperatingSystems,
    string? DefaultLanguage,
    string? Version,
    bool IsActive = true,
    IReadOnlyList<Guid>? LaboratoryIds = null);

public sealed record CreateSoftwareSuggestionRequest(
    string Name,
    string? Manufacturer,
    string? Description,
    string? DownloadUrl,
    bool IsPaid,
    LicenseType LicenseType,
    string? Language,
    string? RequiredOperatingSystem,
    string? SuggestedVersion,
    string? AdditionalNote);
public sealed record ReviewSoftwareSuggestionRequest(
    string? Name,
    string? Manufacturer,
    string? Description,
    string? DownloadUrl,
    bool? IsPaid,
    LicenseType? LicenseType,
    string? Language,
    string? RequiredOperatingSystem,
    string? SuggestedVersion);
public sealed record RejectSoftwareSuggestionRequest(string Reason);
public sealed record SoftwareSuggestionDto(
    Guid Id,
    string Name,
    string? Manufacturer,
    string? Description,
    string? DownloadUrl,
    bool IsPaid,
    LicenseType LicenseType,
    string? Language,
    string? RequiredOperatingSystem,
    string? SuggestedVersion,
    string? AdditionalNote,
    ApprovalStatus Status,
    string? RejectionReason,
    string CreatedByUserId,
    DateTimeOffset CreatedAt,
    Guid? ApprovedSoftwareId);

public sealed record SoftwarePluginInput(string Name, string? Version, string? DownloadUrl, string? Description);
public sealed record SoftwareRequestItemInput(
    Guid? SoftwareApplicationId,
    string? OtherSoftwareName,
    string? RequestedVersion,
    LicenseType LicenseType,
    string? LicenseOverrideReason,
    string? DownloadUrl,
    string? Language,
    string? OtherLanguage,
    bool NoPluginRequired,
    IReadOnlyList<SoftwarePluginInput>? Plugins);
public sealed record CourseScheduleInput(DayOfWeek DayOfWeek, TimeOnly StartTime, TimeOnly EndTime);
public sealed record RequestAssistantInput(string FullName, string Email);
public sealed record CreateSoftwareRequestRequest(
    Guid? FacultyId,
    Guid AcademicTermId,
    string CourseCode,
    string CourseName,
    int SectionCount,
    bool HasOtherSectionInstructor,
    IReadOnlyList<int>? OwnedSections,
    string InstructorEmail,
    string? Description,
    int StudentCount,
    IReadOnlyList<SoftwareRequestItemInput>? Items,
    IReadOnlyList<CourseScheduleInput>? Schedules,
    IReadOnlyList<Guid>? LaboratoryIds,
    string? OtherLaboratoryName,
    IReadOnlyList<RequestAssistantInput>? Assistants = null);
public sealed record UpdateSoftwareRequestRequest(
    Guid? FacultyId,
    Guid AcademicTermId,
    string CourseCode,
    string CourseName,
    int SectionCount,
    bool HasOtherSectionInstructor,
    IReadOnlyList<int>? OwnedSections,
    string InstructorEmail,
    string? Description,
    int StudentCount,
    IReadOnlyList<SoftwareRequestItemInput>? Items,
    IReadOnlyList<CourseScheduleInput>? Schedules,
    IReadOnlyList<Guid>? LaboratoryIds,
    string? OtherLaboratoryName,
    IReadOnlyList<RequestAssistantInput>? Assistants = null);
public sealed record ChangeRequestStatusRequest(
    SoftwareRequestStatus Status,
    string? Reason,
    string? AdministratorNote,
    string? InstallationPersonnel = null,
    DateTimeOffset? InstallationDate = null,
    string? InstalledVersion = null,
    IReadOnlyList<Guid>? InstallationLaboratoryIds = null,
    string? InstallationNote = null);
public sealed record SoftwarePluginDto(Guid Id, string Name, string? Version, string? DownloadUrl, string? Description);
public sealed record SoftwareRequestItemDto(
    Guid Id,
    Guid? SoftwareApplicationId,
    string SoftwareName,
    string? OtherSoftwareName,
    string? RequestedVersion,
    LicenseType LicenseType,
    string? LicenseOverrideReason,
    string? DownloadUrl,
    string? Language,
    string? OtherLanguage,
    bool NoPluginRequired,
    IReadOnlyList<SoftwarePluginDto> Plugins);
public sealed record CourseScheduleDto(Guid Id, DayOfWeek DayOfWeek, TimeOnly StartTime, TimeOnly EndTime);
public sealed record RequestLaboratoryDto(Guid Id, Guid LaboratoryId, string Name, int Capacity, int ComputerCount);
public sealed record RequestAssistantDto(Guid Id, string FullName, string Email);
public sealed record CourseScheduleEntryDto(
    Guid RequestId,
    string CourseCode,
    string CourseName,
    IReadOnlyList<int> OwnedSections,
    string InstructorEmail,
    string OwnerFullName,
    string OwnerEmail,
    SoftwareRequestStatus Status,
    DayOfWeek DayOfWeek,
    TimeOnly StartTime,
    TimeOnly EndTime,
    Guid LaboratoryId,
    string LaboratoryName);
public sealed record SoftwareRequestRevisionDto(
    Guid Id,
    Guid RequestId,
    int Version,
    RequestRevisionChangeType ChangeType,
    string SnapshotJson,
    string ActorUserId,
    DateTimeOffset CreatedAt);
public sealed record SoftwareRequestDto(
    Guid Id,
    string OwnerUserId,
    string OwnerFullName,
    string OwnerEmail,
    Guid FacultyId,
    string FacultyName,
    Guid AcademicTermId,
    string AcademicTerm,
    string CourseCode,
    string CourseName,
    int SectionCount,
    bool HasOtherSectionInstructor,
    IReadOnlyList<int> OwnedSections,
    string InstructorEmail,
    string? Description,
    SoftwareRequestStatus Status,
    string? AdministratorNote,
    string? StatusReason,
    string? InstallationPersonnel,
    DateTimeOffset? InstallationDate,
    string? InstalledVersion,
    IReadOnlyList<Guid> InstallationLaboratoryIds,
    string? InstallationNote,
    int StudentCount,
    bool HasCapacityWarning,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt,
    IReadOnlyList<SoftwareRequestItemDto> Items,
    IReadOnlyList<CourseScheduleDto> Schedules,
    IReadOnlyList<RequestLaboratoryDto> Laboratories,
    string? OtherLaboratoryName,
    IReadOnlyList<RequestAssistantDto> Assistants);
public sealed record RequestQuery(
    int Page = 1,
    int PageSize = 20,
    string? Search = null,
    Guid? FacultyId = null,
    Guid? AcademicTermId = null,
    SoftwareRequestStatus? Status = null,
    Guid? LaboratoryId = null,
    Guid? SoftwareId = null,
    DateTimeOffset? From = null,
    DateTimeOffset? To = null,
    string SortBy = "createdAt",
    bool Descending = true,
    string? OwnerUserId = null,
    bool? IsPaid = null,
    DayOfWeek? DayOfWeek = null,
    string? CourseCode = null,
    string? CourseName = null);

public sealed record NotificationDto(
    Guid Id,
    NotificationType Type,
    string Title,
    string Message,
    string? Link,
    bool IsRead,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ReadAt);
public sealed record AuditLogDto(
    Guid Id,
    string? UserId,
    string? UserName,
    AuditActionType ActionType,
    string EntityType,
    string? EntityId,
    string? OldValues,
    string? NewValues,
    string? IpAddress,
    string? UserAgent,
    DateTimeOffset CreatedAt);
public sealed record AuditActorIdentity(string UserId, string UserName);

public sealed record ExportFile(byte[] Content, string ContentType, string FileName);
public sealed record HealthDto(string Status, string Environment, string Version, DateTimeOffset UtcTime);

public sealed record InstructorDto(string Email, string FullName);

public sealed record UserSummaryDto(
    string Id,
    string Email,
    string FullName,
    Guid? FacultyId,
    string? Department,
    bool IsActive,
    IReadOnlyList<string> Roles,
    IReadOnlyList<AuthorizedFacultyDto> AuthorizedFaculties);
public sealed record CreateUserRequest(
    string Email,
    string FullName,
    Guid? FacultyId,
    string? Department,
    string Password,
    IReadOnlyList<string> Roles);
public sealed record UpdateUserRequest(
    string FullName,
    Guid? FacultyId,
    string? Department,
    bool IsActive,
    IReadOnlyList<string> Roles);
public sealed record SetFacultyPermissionRequest(Guid FacultyId, FacultyPermission Permissions);
public sealed record SystemSettingDto(Guid Id, string Key, string? Value, string? Description, bool IsSecret);
public sealed record UpsertSystemSettingRequest(string Value, string? Description, bool IsSecret = false);
public sealed record SendTestEmailRequest(string Recipient);
public sealed record SmtpTestResultDto(bool Success, string Message);

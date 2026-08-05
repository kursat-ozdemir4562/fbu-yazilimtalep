namespace FbuLabSoftware.Domain;

public interface ISoftDeletable
{
    bool IsDeleted { get; set; }
    DateTimeOffset? DeletedAt { get; set; }
}

public abstract class Entity
{
    public Guid Id { get; set; } = Guid.NewGuid();
}

public abstract class AuditableEntity : Entity
{
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAt { get; set; }
    public string? CreatedByUserId { get; set; }
    public string? UpdatedByUserId { get; set; }
}

public abstract class SoftDeletableEntity : AuditableEntity, ISoftDeletable
{
    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
}

public sealed class Faculty : SoftDeletableEntity
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public ICollection<Laboratory> Laboratories { get; set; } = [];
}

public sealed class UserFacultyPermission : Entity
{
    public string UserId { get; set; } = string.Empty;
    public Guid FacultyId { get; set; }
    public FacultyPermission Permissions { get; set; } = FacultyPermission.View;
    public Faculty Faculty { get; set; } = null!;
}

public sealed class AcademicTerm : AuditableEntity
{
    public string AcademicYear { get; set; } = string.Empty;
    public string TermName { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public DateTimeOffset RequestStartDate { get; set; }
    public DateTimeOffset RequestEndDate { get; set; }
    public bool IsCurrent { get; set; }
    public bool IsActive { get; set; } = true;
    public ICollection<AcademicTermExtension> Extensions { get; set; } = [];

    public bool IsOpenAt(DateTimeOffset now, string userId, Guid facultyId) =>
        IsActive && (now >= RequestStartDate && now <= RequestEndDate ||
                     Extensions.Any(x => x.IsActive && x.ValidUntil >= now &&
                         (x.UserId == userId || x.FacultyId == facultyId)));
}

public sealed class AcademicTermExtension : Entity
{
    public Guid AcademicTermId { get; set; }
    public string? UserId { get; set; }
    public Guid? FacultyId { get; set; }
    public DateTimeOffset ValidUntil { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Reason { get; set; }
    public AcademicTerm AcademicTerm { get; set; } = null!;
}

public sealed class Laboratory : SoftDeletableEntity
{
    // Laboratories are a shared university resource, not owned by a single faculty (see
    // LaboratoryService/RequestService: selection and viewing were never meant to be
    // faculty-scoped). FacultyId is kept nullable only for legacy/historical labs.
    public Guid? FacultyId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Building { get; set; }
    public string? Floor { get; set; }
    public int Capacity { get; set; }
    public int ComputerCount { get; set; }
    public string? OperatingSystem { get; set; }
    public string? ComputerType { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public Faculty? Faculty { get; set; }
}

public sealed class Course : SoftDeletableEntity
{
    public Guid FacultyId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public Faculty Faculty { get; set; } = null!;
}

public sealed class SoftwareApplication : SoftDeletableEntity
{
    public string Name { get; set; } = string.Empty;
    public string? NormalizedName { get; set; }
    public string? Manufacturer { get; set; }
    public string? Description { get; set; }
    public string? DefaultDownloadUrl { get; set; }
    public LicenseType LicenseType { get; set; } = LicenseType.Unknown;
    public bool IsPaid { get; set; }
    public string? SupportedOperatingSystems { get; set; }
    public string? DefaultLanguage { get; set; }
    public string? Version { get; set; }
    public bool IsActive { get; set; } = true;
    public ApprovalStatus ApprovalStatus { get; set; } = ApprovalStatus.Approved;
    public ICollection<SoftwareApplicationLaboratory> Laboratories { get; set; } = [];
}

public sealed class SoftwareApplicationLaboratory : Entity
{
    public Guid SoftwareApplicationId { get; set; }
    public Guid LaboratoryId { get; set; }
    public SoftwareApplication SoftwareApplication { get; set; } = null!;
    public Laboratory Laboratory { get; set; } = null!;
}

public sealed class SoftwareSuggestion : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string NormalizedName { get; set; } = string.Empty;
    public string? Manufacturer { get; set; }
    public string? Description { get; set; }
    public string? DownloadUrl { get; set; }
    public bool IsPaid { get; set; }
    public LicenseType LicenseType { get; set; }
    public string? Language { get; set; }
    public string? RequiredOperatingSystem { get; set; }
    public string? SuggestedVersion { get; set; }
    public string? AdditionalNote { get; set; }
    public ApprovalStatus Status { get; set; } = ApprovalStatus.Pending;
    public string? RejectionReason { get; set; }
    public string? ReviewedByUserId { get; set; }
    public DateTimeOffset? ReviewedAt { get; set; }
    public Guid? ApprovedSoftwareId { get; set; }
    public SoftwareApplication? ApprovedSoftware { get; set; }
}

public sealed class SoftwareRequest : SoftDeletableEntity
{
    public string OwnerUserId { get; set; } = string.Empty;
    public Guid FacultyId { get; set; }
    public Guid AcademicTermId { get; set; }
    public Guid? CourseId { get; set; }
    public string CourseCode { get; set; } = string.Empty;
    public string CourseName { get; set; } = string.Empty;
    public int SectionCount { get; set; } = 1;
    public bool HasOtherSectionInstructor { get; set; }
    public string OwnedSections { get; set; } = "1";
    public string InstructorEmail { get; set; } = string.Empty;
    public string? Description { get; set; }
    public SoftwareRequestStatus Status { get; private set; } = SoftwareRequestStatus.Draft;
    public string? AdministratorNote { get; set; }
    public string? StatusReason { get; set; }
    public string? InstallationPersonnel { get; set; }
    public DateTimeOffset? InstallationDate { get; set; }
    public string? InstalledVersion { get; set; }
    public string? InstallationLaboratoryIds { get; set; }
    public string? InstallationNote { get; set; }
    public int StudentCount { get; set; }
    public bool HasCapacityWarning { get; set; }
    public string? OtherLaboratoryName { get; set; }
    public Faculty Faculty { get; set; } = null!;
    public AcademicTerm AcademicTerm { get; set; } = null!;
    public Course? Course { get; set; }
    public ICollection<SoftwareRequestItem> Items { get; set; } = [];
    public ICollection<CourseSchedule> Schedules { get; set; } = [];
    public ICollection<RequestLaboratory> RequestLaboratories { get; set; } = [];
    public ICollection<RequestAssistant> Assistants { get; set; } = [];
    public ICollection<UploadedFile> UploadedFiles { get; set; } = [];
    public ICollection<SoftwareRequestRevision> Revisions { get; set; } = [];

    public void ChangeStatus(SoftwareRequestStatus next, string? reason = null)
    {
        if (!RequestStatusTransitions.CanTransition(Status, next))
            throw new InvalidOperationException($"{Status} durumundan {next} durumuna geçilemez.");
        if (next is SoftwareRequestStatus.Rejected or SoftwareRequestStatus.AwaitingInformation &&
            string.IsNullOrWhiteSpace(reason))
            throw new InvalidOperationException("Bu durum değişikliği için açıklama zorunludur.");
        Status = next;
        StatusReason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void RestoreStatus(SoftwareRequestStatus status) => Status = status;
}

public sealed class SoftwareRequestItem : Entity
{
    public Guid SoftwareRequestId { get; set; }
    public Guid? SoftwareApplicationId { get; set; }
    public string? OtherSoftwareName { get; set; }
    public string? RequestedVersion { get; set; }
    public LicenseType LicenseType { get; set; }
    public string? LicenseOverrideReason { get; set; }
    public string? DownloadUrl { get; set; }
    public string? Language { get; set; }
    public string? OtherLanguage { get; set; }
    public bool NoPluginRequired { get; set; }
    public SoftwareRequest SoftwareRequest { get; set; } = null!;
    public SoftwareApplication? SoftwareApplication { get; set; }
    public ICollection<SoftwarePlugin> Plugins { get; set; } = [];
}

public sealed class SoftwarePlugin : Entity
{
    public Guid SoftwareRequestItemId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Version { get; set; }
    public string? DownloadUrl { get; set; }
    public string? Description { get; set; }
    public SoftwareRequestItem SoftwareRequestItem { get; set; } = null!;
}

public sealed class RequestAssistant : Entity
{
    public Guid SoftwareRequestId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public SoftwareRequest SoftwareRequest { get; set; } = null!;
}

public sealed class CourseSchedule : Entity
{
    public Guid SoftwareRequestId { get; set; }
    public DayOfWeek DayOfWeek { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public SoftwareRequest SoftwareRequest { get; set; } = null!;
}

public sealed class RequestLaboratory : Entity
{
    public Guid SoftwareRequestId { get; set; }
    public Guid LaboratoryId { get; set; }
    public SoftwareRequest SoftwareRequest { get; set; } = null!;
    public Laboratory Laboratory { get; set; } = null!;
}

public sealed class RefreshToken : Entity
{
    public string UserId { get; set; } = string.Empty;
    public string TokenHash { get; set; } = string.Empty;
    public string FamilyId { get; set; } = string.Empty;
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public string? CreatedByIp { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    public string? RevokedByIp { get; set; }
    public string? ReplacedByTokenHash { get; set; }
    public string? RevokeReason { get; set; }
    public bool IsActive => RevokedAt is null && ExpiresAt > DateTimeOffset.UtcNow;
}

public sealed class UploadedFile : AuditableEntity
{
    public string StoredFileName { get; set; } = string.Empty;
    public string OriginalFileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long Size { get; set; }
    public UploadedFileType FileType { get; set; }
    public string StoragePath { get; set; } = string.Empty;
    public string Sha256 { get; set; } = string.Empty;
    public Guid? SoftwareRequestId { get; set; }
    public SoftwareRequest? SoftwareRequest { get; set; }
}

public sealed class Notification : AuditableEntity
{
    public string UserId { get; set; } = string.Empty;
    public NotificationType Type { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? Link { get; set; }
    public bool IsRead { get; set; }
    public DateTimeOffset? ReadAt { get; set; }
}

public sealed class SoftwareRequestRevision : Entity
{
    private SoftwareRequestRevision()
    {
    }

    public SoftwareRequestRevision(
        Guid requestId,
        int version,
        RequestRevisionChangeType changeType,
        string snapshotJson,
        string actorUserId,
        DateTimeOffset createdAt)
    {
        SoftwareRequestId = requestId;
        Version = version;
        ChangeType = changeType;
        SnapshotJson = snapshotJson;
        ActorUserId = actorUserId;
        CreatedAt = createdAt;
    }

    public Guid SoftwareRequestId { get; private set; }
    public int Version { get; private set; }
    public RequestRevisionChangeType ChangeType { get; private set; }
    public string SnapshotJson { get; private set; } = string.Empty;
    public string ActorUserId { get; private set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; private set; }
    public SoftwareRequest SoftwareRequest { get; private set; } = null!;
}

public sealed class AuditLog : Entity
{
    public string? UserId { get; set; }
    public string? UserName { get; set; }
    public AuditActionType ActionType { get; set; }
    public string EntityType { get; set; } = string.Empty;
    public string? EntityId { get; set; }
    public string? OldValues { get; set; }
    public string? NewValues { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class SystemSetting : AuditableEntity
{
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsSecret { get; set; }
}

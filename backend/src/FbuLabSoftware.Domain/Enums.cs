namespace FbuLabSoftware.Domain;

public static class AppRoles
{
    public const string Academic = nameof(Academic);
    public const string Administrative = nameof(Administrative);
    public const string FacultyAuthorizedUser = nameof(FacultyAuthorizedUser);
    public const string SystemAdministrator = nameof(SystemAdministrator);

    public static readonly string[] All = [Academic, Administrative, FacultyAuthorizedUser, SystemAdministrator];
}

[Flags]
public enum FacultyPermission
{
    None = 0,
    View = 1,
    Edit = 2,
    Report = 4,
    ChangeStatus = 8
}

public enum LicenseType
{
    Free,
    Paid,
    UniversityLicensed,
    Trial,
    OpenSource,
    Unknown
}

public enum ApprovalStatus
{
    Pending,
    Approved,
    Rejected
}

public enum SoftwareRequestStatus
{
    Draft,
    Submitted,
    UnderReview,
    AwaitingInformation,
    Approved,
    Rejected,
    InstallationScheduled,
    InstallationCompleted,
    Cancelled
}

public enum NotificationType
{
    Information,
    RequestSubmitted,
    RequestStatusChanged,
    InformationRequested,
    SuggestionCreated,
    SuggestionDecision,
    InstallationCompleted,
    DeadlineReminder
}

// Explicit values preserve the original StudentImport=0 slot's meaning as "unused" rather
// than silently shifting these onto it — UploadedFileType is stored as a raw int (no
// HasConversion<string>), so a default-numbering removal would corrupt historical rows.
public enum UploadedFileType
{
    Attachment = 1,
    Export = 2
}

public enum RequestRevisionChangeType
{
    Submitted,
    UpdateBefore,
    UpdateAfter,
    StatusChangeBefore,
    StatusChangeAfter
}

// Explicit values from UserFacultyPermissionChanged onward preserve the original ordinals of
// ReportDownloaded/RefreshTokenRotated/RefreshTokenRevoked — AuditActionType is stored as a raw
// int (no HasConversion<string>), so removing StudentListImported/StudentListDownloaded without
// pinning the values after them would silently relabel historical audit rows.
public enum AuditActionType
{
    LoginSucceeded,
    LoginFailed,
    Logout,
    Created,
    Updated,
    Deleted,
    RequestSubmitted,
    RequestStatusChanged,
    FacultyChanged,
    SoftwareCreated,
    SoftwareSuggested,
    SuggestionApproved,
    SuggestionRejected,
    UserCreated,
    UserRoleChanged,
    UserFacultyPermissionChanged = 15,
    ReportDownloaded = 18,
    RefreshTokenRotated = 19,
    RefreshTokenRevoked = 20
}


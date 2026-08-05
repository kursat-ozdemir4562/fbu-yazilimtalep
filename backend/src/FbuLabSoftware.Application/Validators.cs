using FluentValidation;
using FbuLabSoftware.Domain;
using Microsoft.Extensions.DependencyInjection;

namespace FbuLabSoftware.Application;

public static class ApplicationRegistration
{
    public static IServiceCollection AddApplication(this IServiceCollection services) =>
        services.AddValidatorsFromAssemblyContaining<LoginRequestValidator>();
}

public static class ValidationRules
{
    public static bool IsSafeHttpUrl(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return true;
        return Uri.TryCreate(value, UriKind.Absolute, out var uri) &&
               (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps) &&
               !string.IsNullOrWhiteSpace(uri.Host) &&
               string.IsNullOrEmpty(uri.UserInfo);
    }

    public static bool IsValidFbuEmail(string? value) =>
        !string.IsNullOrWhiteSpace(value) &&
        System.Net.Mail.MailAddress.TryCreate(value, out _);
}

public static class ValidatorRuleExtensions
{
    public static IRuleBuilderOptions<T, string?> SafeHttpUrl<T>(this IRuleBuilder<T, string?> ruleBuilder) =>
        ruleBuilder.Must(ValidationRules.IsSafeHttpUrl).WithMessage("Yalnızca geçerli HTTP/HTTPS adresleri kullanılabilir.");
}

public sealed class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.Password).NotEmpty().MaximumLength(200);
    }
}

public sealed class UpdateThemePreferenceRequestValidator : AbstractValidator<UpdateThemePreferenceRequest>
{
    // Eski 'light'/'dark' değerleri de kabul edilir — bunlar frontend'de normalizeTheme ile
    // yeni slug'lara eşleniyor (bkz. ThemeContext.tsx), ama sunucuya doğrudan bu isimlerle
    // istek atan eski/önbelleğe alınmış bir istemci olursa yine de reddedilmesin diye.
    private static readonly string[] ValidThemes =
    [
        "midnight-command", "graphite-control", "deep-ocean", "secure-forest",
        "burgundy-ops", "violet-signal", "white-console", "light", "dark"
    ];

    public UpdateThemePreferenceRequestValidator() =>
        RuleFor(x => x.Theme).Must(theme => ValidThemes.Contains(theme))
            .WithMessage("Geçersiz tema.");
}

public sealed class UpsertRequestDraftRequestValidator : AbstractValidator<UpsertRequestDraftRequest>
{
    public UpsertRequestDraftRequestValidator() =>
        RuleFor(x => x.PayloadJson).NotEmpty().MaximumLength(100_000);
}

public sealed class CreateFacultyRequestValidator : AbstractValidator<CreateFacultyRequest>
{
    public CreateFacultyRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(250);
        RuleFor(x => x.Code).NotEmpty().MaximumLength(50);
        RuleFor(x => x.Description).MaximumLength(2000);
    }
}

public sealed class UpdateFacultyRequestValidator : AbstractValidator<UpdateFacultyRequest>
{
    public UpdateFacultyRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(250);
        RuleFor(x => x.Code).NotEmpty().MaximumLength(50);
        RuleFor(x => x.Description).MaximumLength(2000);
    }
}

public sealed class CreateLaboratoryRequestValidator : AbstractValidator<CreateLaboratoryRequest>
{
    public CreateLaboratoryRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(250);
        RuleFor(x => x.Code).NotEmpty().MaximumLength(50);
        RuleFor(x => x.Capacity).GreaterThanOrEqualTo(0);
        RuleFor(x => x.ComputerCount).GreaterThanOrEqualTo(0);
        RuleFor(x => x.ComputerType).MaximumLength(100);
    }
}

public sealed class UpdateLaboratoryRequestValidator : AbstractValidator<UpdateLaboratoryRequest>
{
    public UpdateLaboratoryRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(250);
        RuleFor(x => x.Code).NotEmpty().MaximumLength(50);
        RuleFor(x => x.Capacity).GreaterThanOrEqualTo(0);
        RuleFor(x => x.ComputerCount).GreaterThanOrEqualTo(0);
        RuleFor(x => x.ComputerType).MaximumLength(100);
    }
}

public sealed class UpsertSoftwareRequestValidator : AbstractValidator<UpsertSoftwareRequest>
{
    public UpsertSoftwareRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(250);
        RuleFor(x => x.DefaultDownloadUrl).SafeHttpUrl();
    }
}

public sealed class CreateSoftwareSuggestionRequestValidator : AbstractValidator<CreateSoftwareSuggestionRequest>
{
    public CreateSoftwareSuggestionRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(250);
        RuleFor(x => x.Manufacturer).MaximumLength(250);
        RuleFor(x => x.Description).MaximumLength(2000);
        RuleFor(x => x.DownloadUrl).MaximumLength(2048).SafeHttpUrl();
        RuleFor(x => x.Language).MaximumLength(100);
        RuleFor(x => x.RequiredOperatingSystem).MaximumLength(500);
        RuleFor(x => x.SuggestedVersion).MaximumLength(100);
        RuleFor(x => x.AdditionalNote).MaximumLength(2000);
    }
}

public sealed class ReviewSoftwareSuggestionRequestValidator : AbstractValidator<ReviewSoftwareSuggestionRequest>
{
    public ReviewSoftwareSuggestionRequestValidator()
    {
        RuleFor(x => x.Name).MaximumLength(250);
        RuleFor(x => x.Manufacturer).MaximumLength(250);
        RuleFor(x => x.Description).MaximumLength(2000);
        RuleFor(x => x.DownloadUrl).MaximumLength(2048).SafeHttpUrl();
        RuleFor(x => x.Language).MaximumLength(100);
        RuleFor(x => x.RequiredOperatingSystem).MaximumLength(500);
        RuleFor(x => x.SuggestedVersion).MaximumLength(100);
    }
}

public sealed class RejectSoftwareSuggestionRequestValidator : AbstractValidator<RejectSoftwareSuggestionRequest>
{
    public RejectSoftwareSuggestionRequestValidator() =>
        RuleFor(x => x.Reason).NotEmpty().MaximumLength(2000);
}

public sealed class SoftwareRequestItemInputValidator : AbstractValidator<SoftwareRequestItemInput>
{
    public SoftwareRequestItemInputValidator()
    {
        RuleFor(x => x.OtherSoftwareName)
            .NotEmpty().WithMessage("Program adını girin.")
            .MaximumLength(250)
            .When(x => x.SoftwareApplicationId is null);
        RuleFor(x => x.SoftwareApplicationId)
            .Must((item, id) => id.HasValue || !string.IsNullOrWhiteSpace(item.OtherSoftwareName))
            .WithMessage("Bir program seçin veya program adını girin.");
        RuleFor(x => x.DownloadUrl).SafeHttpUrl();
        RuleFor(x => x.LicenseOverrideReason)
            .NotEmpty()
            .When(x => x.LicenseType != LicenseType.Unknown)
            .When(x => false); // Override requirement is evaluated against the selected software in the service.
        RuleForEach(x => x.Plugins).SetValidator(new SoftwarePluginInputValidator());
        RuleFor(x => x.OtherLanguage)
            .NotEmpty()
            .When(x => string.Equals(x.Language, "Diğer", StringComparison.OrdinalIgnoreCase));
    }
}

public sealed class SoftwarePluginInputValidator : AbstractValidator<SoftwarePluginInput>
{
    public SoftwarePluginInputValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(250);
        RuleFor(x => x.DownloadUrl).SafeHttpUrl();
    }
}

public sealed class CourseScheduleInputValidator : AbstractValidator<CourseScheduleInput>
{
    public CourseScheduleInputValidator() =>
        RuleFor(x => x.EndTime).GreaterThan(x => x.StartTime)
            .WithMessage("Ders bitiş saati başlangıç saatinden sonra olmalıdır.");
}

public sealed class RequestAssistantInputValidator : AbstractValidator<RequestAssistantInput>
{
    public RequestAssistantInputValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(250);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
    }
}

public sealed class CreateSoftwareRequestRequestValidator : AbstractValidator<CreateSoftwareRequestRequest>
{
    public CreateSoftwareRequestRequestValidator()
    {
        RuleFor(x => x.AcademicTermId).NotEmpty();
        RuleFor(x => x.CourseCode).NotEmpty().MaximumLength(50);
        RuleFor(x => x.CourseName).NotEmpty().MaximumLength(250);
        RuleFor(x => x.SectionCount).InclusiveBetween(1, 5);
        RuleFor(x => x)
            .Must(x => !x.HasOtherSectionInstructor || (x.OwnedSections is { Count: > 0 } sections
                && sections.All(s => s >= 1 && s <= x.SectionCount)))
            .WithMessage("Diğer section'ları başka akademisyen veriyorsanız, kendi verdiğiniz section'ları (toplam section sayısını aşmayacak şekilde) seçmelisiniz.")
            .OverridePropertyName(nameof(CreateSoftwareRequestRequest.OwnedSections));
        RuleFor(x => x.InstructorEmail).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.StudentCount).GreaterThanOrEqualTo(0);
        RuleFor(x => x.OtherLaboratoryName).MaximumLength(250);
        RuleForEach(x => x.Items).SetValidator(new SoftwareRequestItemInputValidator());
        RuleForEach(x => x.Schedules).SetValidator(new CourseScheduleInputValidator());
        RuleForEach(x => x.Assistants).SetValidator(new RequestAssistantInputValidator());
    }
}

public sealed class UpdateSoftwareRequestRequestValidator : AbstractValidator<UpdateSoftwareRequestRequest>
{
    public UpdateSoftwareRequestRequestValidator()
    {
        RuleFor(x => x.AcademicTermId).NotEmpty();
        RuleFor(x => x.CourseCode).NotEmpty().MaximumLength(50);
        RuleFor(x => x.CourseName).NotEmpty().MaximumLength(250);
        RuleFor(x => x.SectionCount).InclusiveBetween(1, 5);
        RuleFor(x => x)
            .Must(x => !x.HasOtherSectionInstructor || (x.OwnedSections is { Count: > 0 } sections
                && sections.All(s => s >= 1 && s <= x.SectionCount)))
            .WithMessage("Diğer section'ları başka akademisyen veriyorsanız, kendi verdiğiniz section'ları (toplam section sayısını aşmayacak şekilde) seçmelisiniz.")
            .OverridePropertyName(nameof(CreateSoftwareRequestRequest.OwnedSections));
        RuleFor(x => x.InstructorEmail).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.StudentCount).GreaterThanOrEqualTo(0);
        RuleFor(x => x.OtherLaboratoryName).MaximumLength(250);
        RuleForEach(x => x.Items).SetValidator(new SoftwareRequestItemInputValidator());
        RuleForEach(x => x.Schedules).SetValidator(new CourseScheduleInputValidator());
        RuleForEach(x => x.Assistants).SetValidator(new RequestAssistantInputValidator());
    }
}

public sealed class ChangeRequestStatusRequestValidator : AbstractValidator<ChangeRequestStatusRequest>
{
    public ChangeRequestStatusRequestValidator()
    {
        RuleFor(x => x.Reason).NotEmpty()
            .When(x => x.Status is SoftwareRequestStatus.Rejected or SoftwareRequestStatus.AwaitingInformation);
        RuleFor(x => x.InstallationPersonnel).NotEmpty()
            .When(x => x.Status == SoftwareRequestStatus.InstallationCompleted);
        RuleFor(x => x.InstallationDate).NotNull()
            .When(x => x.Status == SoftwareRequestStatus.InstallationCompleted);
        RuleFor(x => x.InstalledVersion).NotEmpty()
            .When(x => x.Status == SoftwareRequestStatus.InstallationCompleted);
        RuleFor(x => x.InstallationLaboratoryIds).NotEmpty()
            .When(x => x.Status == SoftwareRequestStatus.InstallationCompleted);
    }
}

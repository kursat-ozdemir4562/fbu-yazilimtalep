using FbuLabSoftware.Application;
using FbuLabSoftware.Domain;

namespace FbuLabSoftware.UnitTests;

public sealed class DomainAndValidationTests
{
    [Theory]
    [InlineData(" Visual   Studio ", "visual studio")]
    [InlineData("İSTANBUL Çözüm", "istanbul cozum")]
    [InlineData("ışık", "isik")]
    public void Software_name_normalization_handles_spacing_case_and_turkish_characters(string source, string expected) =>
        Assert.Equal(expected, TextNormalization.NormalizeSoftwareName(source));

    [Theory]
    [InlineData("Visual Studio Code", "visual studio code")]
    [InlineData("MATLAB", "Mat Lab")]
    public void Similar_software_names_are_detected(string left, string right) =>
        Assert.True(TextNormalization.AreSimilarSoftwareNames(left, right));

    [Fact]
    public void Draft_request_can_be_submitted()
    {
        var request = new SoftwareRequest();
        request.ChangeStatus(SoftwareRequestStatus.Submitted);
        Assert.Equal(SoftwareRequestStatus.Submitted, request.Status);
    }

    [Fact]
    public void Draft_request_cannot_jump_to_installation_completed()
    {
        var request = new SoftwareRequest();
        var error = Assert.Throws<InvalidOperationException>(() =>
            request.ChangeStatus(SoftwareRequestStatus.InstallationCompleted));
        Assert.Contains("geçilemez", error.Message);
    }

    [Fact]
    public void Rejection_requires_reason()
    {
        var request = new SoftwareRequest();
        request.ChangeStatus(SoftwareRequestStatus.Submitted);
        Assert.Throws<InvalidOperationException>(() => request.ChangeStatus(SoftwareRequestStatus.Rejected));
    }

    [Theory]
    [InlineData("CSE101", true)]
    [InlineData("", false)]
    [InlineData("ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ", false)]
    public async Task Course_code_validation_works(string code, bool expected)
    {
        var model = ValidRequest() with { CourseCode = code };
        var result = await new CreateSoftwareRequestRequestValidator().ValidateAsync(model);
        Assert.Equal(expected, !result.Errors.Any(x => x.PropertyName == nameof(model.CourseCode)));
    }

    [Theory]
    [InlineData("akademisyen@fbu.edu.tr", true)]
    [InlineData("not-an-email", false)]
    [InlineData("", false)]
    public async Task Instructor_email_validation_works(string email, bool expected)
    {
        var result = await new CreateSoftwareRequestRequestValidator()
            .ValidateAsync(ValidRequest() with { InstructorEmail = email });
        Assert.Equal(expected, !result.Errors.Any(x => x.PropertyName == nameof(CreateSoftwareRequestRequest.InstructorEmail)));
    }

    [Theory]
    [InlineData("https://example.org/download", true)]
    [InlineData("http://localhost/file", true)]
    [InlineData("javascript:alert(1)", false)]
    [InlineData("file:///etc/passwd", false)]
    [InlineData("https://user:password@example.org", false)]
    public void Download_url_validation_only_accepts_safe_http_urls(string url, bool expected) =>
        Assert.Equal(expected, ValidationRules.IsSafeHttpUrl(url));

    [Fact]
    public async Task Course_end_time_must_follow_start_time()
    {
        var validator = new CourseScheduleInputValidator();
        var invalid = await validator.ValidateAsync(new CourseScheduleInput(DayOfWeek.Monday, new TimeOnly(14, 0), new TimeOnly(13, 0)));
        var valid = await validator.ValidateAsync(new CourseScheduleInput(DayOfWeek.Monday, new TimeOnly(13, 0), new TimeOnly(14, 0)));
        Assert.False(invalid.IsValid);
        Assert.True(valid.IsValid);
    }

    [Fact]
    public async Task Suggestion_name_is_required()
    {
        var result = await new CreateSoftwareSuggestionRequestValidator().ValidateAsync(
            new CreateSoftwareSuggestionRequest("", null, null, null, false, LicenseType.Free, null, null, null, null));
        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task Rejected_suggestion_requires_reason()
    {
        var result = await new RejectSoftwareSuggestionRequestValidator()
            .ValidateAsync(new RejectSoftwareSuggestionRequest(" "));
        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task Installation_completion_requires_details()
    {
        var result = await new ChangeRequestStatusRequestValidator().ValidateAsync(
            new ChangeRequestStatusRequest(SoftwareRequestStatus.InstallationCompleted, null, null));
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, x => x.PropertyName == nameof(ChangeRequestStatusRequest.InstallationPersonnel));
        Assert.Contains(result.Errors, x => x.PropertyName == nameof(ChangeRequestStatusRequest.InstallationLaboratoryIds));
    }

    [Fact]
    public void Faculty_permissions_are_composable()
    {
        var permission = FacultyPermission.View | FacultyPermission.Report;
        Assert.True((permission & FacultyPermission.View) == FacultyPermission.View);
        Assert.False((permission & FacultyPermission.Edit) == FacultyPermission.Edit);
    }

    private static CreateSoftwareRequestRequest ValidRequest() =>
        new(null, Guid.NewGuid(), "CSE101", "Programlama", "akademisyen@fbu.edu.tr", null, 1, [], [], []);
}

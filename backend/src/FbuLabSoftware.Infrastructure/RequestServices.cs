using System.Globalization;
using System.Net;
using System.Text.Json;
using FbuLabSoftware.Application;
using FbuLabSoftware.Domain;
using FluentValidation;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace FbuLabSoftware.Infrastructure;

public sealed class SoftwareSuggestionService(
    AppDbContext db,
    UserManager<ApplicationUser> userManager,
    ResourceAuthorizationService authorization,
    IValidator<CreateSoftwareSuggestionRequest> createValidator,
    IValidator<ReviewSoftwareSuggestionRequest> reviewValidator,
    IValidator<RejectSoftwareSuggestionRequest> rejectValidator,
    IAuditService auditService) : ISoftwareSuggestionService
{
    public async Task<SoftwareSuggestionDto> CreateAsync(CreateSoftwareSuggestionRequest request, CancellationToken cancellationToken)
    {
        if (!authorization.IsAcademic && !authorization.IsAdministrator)
            throw new ForbiddenException();
        await createValidator.ValidateRequestAsync(request, cancellationToken);
        var normalized = TextNormalization.NormalizeSoftwareName(request.Name);
        var knownNames = await db.SoftwareApplications.IgnoreQueryFilters()
            .Select(x => x.Name).Concat(db.SoftwareSuggestions.Where(x => x.Status == ApprovalStatus.Pending).Select(x => x.Name))
            .ToListAsync(cancellationToken);
        if (knownNames.Any(x => TextNormalization.AreSimilarSoftwareNames(x, request.Name)))
            throw new ConflictException("Aynı veya çok benzer isimli bir program/program önerisi zaten bulunuyor.");

        var entity = new SoftwareSuggestion
        {
            Name = request.Name.Trim(),
            NormalizedName = normalized,
            Manufacturer = request.Manufacturer?.Trim(),
            Description = request.Description?.Trim(),
            DownloadUrl = request.DownloadUrl?.Trim(),
            IsPaid = request.IsPaid,
            LicenseType = request.LicenseType,
            Language = request.Language?.Trim(),
            RequiredOperatingSystem = request.RequiredOperatingSystem?.Trim(),
            SuggestedVersion = request.SuggestedVersion?.Trim(),
            AdditionalNote = request.AdditionalNote?.Trim(),
            Status = ApprovalStatus.Pending,
            CreatedByUserId = authorization.UserId
        };
        db.SoftwareSuggestions.Add(entity);

        var admins = await userManager.GetUsersInRoleAsync(AppRoles.SystemAdministrator);
        db.Notifications.AddRange(admins.Where(x => x.IsActive).Select(x => new Notification
        {
            UserId = x.Id,
            Type = NotificationType.SuggestionCreated,
            Title = "Yeni program önerisi",
            Message = $"{entity.Name} için yeni program önerisi oluşturuldu.",
            Link = $"/admin/software-suggestions/{entity.Id}"
        }));
        await db.SaveChangesAsync(cancellationToken);
        await auditService.WriteAsync(AuditActionType.SoftwareSuggested, nameof(SoftwareSuggestion), entity.Id.ToString(), cancellationToken: cancellationToken);
        return entity.ToDto();
    }

    public async Task<PagedResult<SoftwareSuggestionDto>> GetAsync(int page, int pageSize, ApprovalStatus? status, CancellationToken cancellationToken)
    {
        if (!authorization.IsAdministrator && !authorization.IsFacultyUser)
            throw new ForbiddenException();
        (page, pageSize) = FacultyService.Page(page, pageSize);
        var query = db.SoftwareSuggestions.AsNoTracking();
        if (!authorization.IsAdministrator)
        {
            var allowedFacultyIds = await authorization.AllowedFacultyIdsAsync(FacultyPermission.View, cancellationToken);
            var allowedUsers = userManager.Users.Where(x => x.FacultyId != null && allowedFacultyIds.Contains(x.FacultyId.Value)).Select(x => x.Id);
            query = query.Where(x => x.CreatedByUserId != null && allowedUsers.Contains(x.CreatedByUserId));
        }
        if (status.HasValue)
            query = query.Where(x => x.Status == status.Value);
        var count = await query.CountAsync(cancellationToken);
        var items = await query.OrderByDescending(x => x.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        return new PagedResult<SoftwareSuggestionDto>(items.Select(x => x.ToDto()).ToList(), page, pageSize, count);
    }

    public async Task<IReadOnlyList<SoftwareSuggestionDto>> GetMineAsync(CancellationToken cancellationToken)
    {
        var userId = authorization.UserId;
        var entities = await db.SoftwareSuggestions.AsNoTracking()
            .Where(x => x.CreatedByUserId == userId).OrderByDescending(x => x.CreatedAt).ToListAsync(cancellationToken);
        return entities.Select(x => x.ToDto()).ToList();
    }

    public async Task<SoftwareSuggestionDto> ApproveAsync(Guid id, ReviewSoftwareSuggestionRequest? request, CancellationToken cancellationToken)
    {
        authorization.RequireAdministrator();
        if (request is not null)
            await reviewValidator.ValidateRequestAsync(request, cancellationToken);
        var suggestion = await db.SoftwareSuggestions.SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                         ?? throw new NotFoundException("Program önerisi bulunamadı.");
        if (suggestion.Status != ApprovalStatus.Pending)
            throw new ConflictException("Yalnızca onay bekleyen öneriler değerlendirilebilir.");

        var name = string.IsNullOrWhiteSpace(request?.Name) ? suggestion.Name : request.Name.Trim();
        var normalized = TextNormalization.NormalizeSoftwareName(name);
        if (await db.SoftwareApplications.IgnoreQueryFilters().AnyAsync(x => x.NormalizedName == normalized, cancellationToken))
            throw new ConflictException("Aynı isimli program ana listede zaten mevcut.");

        var software = new SoftwareApplication
        {
            Name = name,
            NormalizedName = normalized,
            Manufacturer = request?.Manufacturer ?? suggestion.Manufacturer,
            Description = request?.Description ?? suggestion.Description,
            DefaultDownloadUrl = request?.DownloadUrl ?? suggestion.DownloadUrl,
            IsPaid = request?.IsPaid ?? suggestion.IsPaid,
            LicenseType = request?.LicenseType ?? suggestion.LicenseType,
            DefaultLanguage = request?.Language ?? suggestion.Language,
            SupportedOperatingSystems = request?.RequiredOperatingSystem ?? suggestion.RequiredOperatingSystem,
            Version = request?.SuggestedVersion ?? suggestion.SuggestedVersion,
            IsActive = true,
            ApprovalStatus = ApprovalStatus.Approved,
            CreatedByUserId = authorization.UserId
        };
        db.SoftwareApplications.Add(software);
        suggestion.Status = ApprovalStatus.Approved;
        suggestion.ReviewedAt = DateTimeOffset.UtcNow;
        suggestion.ReviewedByUserId = authorization.UserId;
        suggestion.ApprovedSoftware = software;
        if (suggestion.CreatedByUserId is { } owner)
            db.Notifications.Add(new Notification
            {
                UserId = owner,
                Type = NotificationType.SuggestionDecision,
                Title = "Program öneriniz onaylandı",
                Message = $"{suggestion.Name} programı ana listeye eklendi.",
                Link = $"/software/{software.Id}"
            });
        await db.SaveChangesAsync(cancellationToken);
        await auditService.WriteAsync(AuditActionType.SuggestionApproved, nameof(SoftwareSuggestion), id.ToString(), cancellationToken: cancellationToken);
        return suggestion.ToDto();
    }

    public async Task<SoftwareSuggestionDto> RejectAsync(Guid id, RejectSoftwareSuggestionRequest request, CancellationToken cancellationToken)
    {
        authorization.RequireAdministrator();
        await rejectValidator.ValidateRequestAsync(request, cancellationToken);
        var suggestion = await db.SoftwareSuggestions.SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                         ?? throw new NotFoundException("Program önerisi bulunamadı.");
        if (suggestion.Status != ApprovalStatus.Pending)
            throw new ConflictException("Yalnızca onay bekleyen öneriler değerlendirilebilir.");
        suggestion.Status = ApprovalStatus.Rejected;
        suggestion.RejectionReason = request.Reason.Trim();
        suggestion.ReviewedAt = DateTimeOffset.UtcNow;
        suggestion.ReviewedByUserId = authorization.UserId;
        if (suggestion.CreatedByUserId is { } owner)
            db.Notifications.Add(new Notification
            {
                UserId = owner,
                Type = NotificationType.SuggestionDecision,
                Title = "Program öneriniz reddedildi",
                Message = $"{suggestion.Name} önerisi reddedildi. Neden: {request.Reason.Trim()}",
                Link = "/software-suggestions/my"
            });
        await db.SaveChangesAsync(cancellationToken);
        await auditService.WriteAsync(AuditActionType.SuggestionRejected, nameof(SoftwareSuggestion), id.ToString(), cancellationToken: cancellationToken);
        return suggestion.ToDto();
    }
}

public sealed class RequestService(
    AppDbContext db,
    UserManager<ApplicationUser> userManager,
    ResourceAuthorizationService authorization,
    IValidator<CreateSoftwareRequestRequest> createValidator,
    IValidator<UpdateSoftwareRequestRequest> updateValidator,
    IValidator<ChangeRequestStatusRequest> statusValidator,
    IValidator<UpsertRequestDraftRequest> draftValidator,
    IAuditService auditService,
    IEmailSender emailSender,
    IConfiguration configuration) : IRequestService
{
    // Reused from the SAML integration: the same public base URL the app is served from,
    // not SAML-specific in nature (see Program.cs SPOptions.PublicOrigin wiring).
    private string PublicOrigin => configuration["Saml:PublicOrigin"]?.TrimEnd('/') ?? string.Empty;

    public async Task<PagedResult<SoftwareRequestDto>> GetAsync(
        RequestQuery query,
        bool mineOnly,
        CancellationToken cancellationToken,
        FacultyPermission facultyPermission = FacultyPermission.View)
    {
        var (page, pageSize) = FacultyService.Page(query.Page, query.PageSize);
        var source = IncludeGraph(db.SoftwareRequests.AsNoTracking());
        if (mineOnly || authorization.IsAcademic)
            source = source.Where(x => x.OwnerUserId == authorization.UserId);
        else if (!authorization.IsAdministrator)
        {
            var allowed = await authorization.AllowedFacultyIdsAsync(facultyPermission, cancellationToken);
            source = source.Where(x => allowed.Contains(x.FacultyId));
        }

        if (query.FacultyId.HasValue)
            source = source.Where(x => x.FacultyId == query.FacultyId.Value);
        if (query.AcademicTermId.HasValue)
            source = source.Where(x => x.AcademicTermId == query.AcademicTermId.Value);
        if (query.Status.HasValue)
            source = source.Where(x => x.Status == query.Status.Value);
        if (query.LaboratoryId.HasValue)
            source = source.Where(x => x.RequestLaboratories.Any(y => y.LaboratoryId == query.LaboratoryId.Value));
        if (query.SoftwareId.HasValue)
            source = source.Where(x => x.Items.Any(y => y.SoftwareApplicationId == query.SoftwareId.Value));
        if (!string.IsNullOrWhiteSpace(query.OwnerUserId))
            source = source.Where(x => x.OwnerUserId == query.OwnerUserId);
        if (query.IsPaid.HasValue)
            source = source.Where(x => x.Items.Any(y => y.SoftwareApplication != null && y.SoftwareApplication.IsPaid == query.IsPaid.Value));
        if (query.DayOfWeek.HasValue)
            source = source.Where(x => x.Schedules.Any(y => y.DayOfWeek == query.DayOfWeek.Value));
        if (!string.IsNullOrWhiteSpace(query.CourseCode))
        {
            var courseCode = query.CourseCode.Trim().ToLower();
            source = source.Where(x => x.CourseCode.ToLower().Contains(courseCode));
        }
        if (!string.IsNullOrWhiteSpace(query.CourseName))
        {
            var courseName = query.CourseName.Trim().ToLower();
            source = source.Where(x => x.CourseName.ToLower().Contains(courseName));
        }
        if (query.From.HasValue)
            source = source.Where(x => x.CreatedAt >= query.From.Value);
        if (query.To.HasValue)
            source = source.Where(x => x.CreatedAt <= query.To.Value);
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLower();
            source = source.Where(x => x.CourseCode.ToLower().Contains(term) || x.CourseName.ToLower().Contains(term) ||
                                       x.Items.Any(y => (y.SoftwareApplication != null && y.SoftwareApplication.Name.ToLower().Contains(term)) ||
                                                         (y.OtherSoftwareName != null && y.OtherSoftwareName.ToLower().Contains(term))));
        }

        source = (query.SortBy.ToLowerInvariant(), query.Descending) switch
        {
            ("coursecode", false) => source.OrderBy(x => x.CourseCode),
            ("coursecode", true) => source.OrderByDescending(x => x.CourseCode),
            ("status", false) => source.OrderBy(x => x.Status),
            ("status", true) => source.OrderByDescending(x => x.Status),
            ("createdat", false) => source.OrderBy(x => x.CreatedAt),
            _ => source.OrderByDescending(x => x.CreatedAt)
        };
        var count = await source.CountAsync(cancellationToken);
        var entities = await source.Skip((page - 1) * pageSize).Take(pageSize).AsSplitQuery().ToListAsync(cancellationToken);
        var items = await ToDtosAsync(entities, cancellationToken);
        return new PagedResult<SoftwareRequestDto>(items, page, pageSize, count);
    }

    // Aggregated counts for the dashboard. Reuses GetAsync's visibility rule (academics see only
    // their own requests, faculty-authorized users see their allowed faculties, admins see all) but
    // aggregates with GroupBy/Count directly in the database instead of loading + paging entities,
    // since dashboard totals must stay accurate regardless of how many requests exist.
    public async Task<RequestStatsDto> GetStatsAsync(CancellationToken cancellationToken)
    {
        var baseQuery = db.SoftwareRequests.AsNoTracking().AsQueryable();
        if (authorization.IsAcademic)
            baseQuery = baseQuery.Where(x => x.OwnerUserId == authorization.UserId);
        else if (!authorization.IsAdministrator)
        {
            var allowed = await authorization.AllowedFacultyIdsAsync(FacultyPermission.View, cancellationToken);
            baseQuery = baseQuery.Where(x => allowed.Contains(x.FacultyId));
        }

        var totalCount = await baseQuery.CountAsync(cancellationToken);

        var statusCounts = await baseQuery
            .GroupBy(x => x.Status)
            .Select(g => new StatusCountDto(g.Key, g.Count()))
            .ToListAsync(cancellationToken);

        var facultyCounts = await baseQuery
            .GroupBy(x => new { x.FacultyId, x.Faculty.Name })
            .OrderByDescending(g => g.Count())
            .Select(g => new NamedCountDto(g.Key.FacultyId, g.Key.Name, g.Count()))
            .Take(8)
            .ToListAsync(cancellationToken);

        var requestIds = baseQuery.Select(x => x.Id);
        var laboratoryCounts = await db.RequestLaboratories.AsNoTracking()
            .Where(x => requestIds.Contains(x.SoftwareRequestId))
            .GroupBy(x => new { x.LaboratoryId, x.Laboratory.Name })
            .OrderByDescending(g => g.Count())
            .Select(g => new NamedCountDto(g.Key.LaboratoryId, g.Key.Name, g.Count()))
            .Take(8)
            .ToListAsync(cancellationToken);

        var topSoftware = await db.SoftwareRequestItems.AsNoTracking()
            .Where(x => requestIds.Contains(x.SoftwareRequestId))
            .GroupBy(x => x.SoftwareApplicationId != null ? x.SoftwareApplication!.Name : (x.OtherSoftwareName ?? "Diğer"))
            .OrderByDescending(g => g.Count())
            .Select(g => new NamedCountDto(null, g.Key, g.Count()))
            .Take(8)
            .ToListAsync(cancellationToken);

        return new RequestStatsDto(totalCount, statusCounts, facultyCounts, laboratoryCounts, topSoftware);
    }

    public async Task<SoftwareRequestDto> GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await IncludeGraph(db.SoftwareRequests.AsNoTracking()).AsSplitQuery()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new NotFoundException("Talep bulunamadı.");
        await EnsureAccessAsync(entity, FacultyPermission.View, cancellationToken);
        return await ToDtoAsync(entity, cancellationToken);
    }

    public async Task<IReadOnlyList<SoftwareRequestRevisionDto>> GetHistoryAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        var request = await db.SoftwareRequests.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new NotFoundException("Talep bulunamadı.");
        await EnsureAccessAsync(request, FacultyPermission.View, cancellationToken);
        return await db.SoftwareRequestRevisions.AsNoTracking()
            .Where(x => x.SoftwareRequestId == id)
            .OrderBy(x => x.Version)
            .Select(x => new SoftwareRequestRevisionDto(
                x.Id,
                x.SoftwareRequestId,
                x.Version,
                x.ChangeType,
                x.SnapshotJson,
                x.ActorUserId,
                x.CreatedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<SoftwareRequestDto> CreateAsync(CreateSoftwareRequestRequest request, CancellationToken cancellationToken)
    {
        if (!authorization.IsAcademic && !authorization.IsAdministrator)
            throw new ForbiddenException("Yalnızca akademisyenler ve sistem yöneticileri talep oluşturabilir.");
        await createValidator.ValidateRequestAsync(request, cancellationToken);
        await ValidateInstructorDomainAsync(request.InstructorEmail, cancellationToken);
        var (user, facultyId) = await ResolveCreateFacultyAsync(request.FacultyId, cancellationToken);
        var term = await db.AcademicTerms.Include(x => x.Extensions).SingleOrDefaultAsync(x => x.Id == request.AcademicTermId, cancellationToken)
                   ?? throw new NotFoundException("Akademik dönem bulunamadı.");
        if (authorization.IsAcademic && !term.IsOpenAt(DateTimeOffset.UtcNow, user.Id, facultyId))
            throw new BusinessRuleException("Bu akademik dönem için talep giriş süresi kapalı.");
        var entity = new SoftwareRequest
        {
            OwnerUserId = user.Id,
            FacultyId = facultyId,
            AcademicTermId = request.AcademicTermId,
            CourseCode = request.CourseCode.Trim().ToUpperInvariant(),
            CourseName = request.CourseName.Trim(),
            SectionCount = request.SectionCount,
            HasOtherSectionInstructor = request.HasOtherSectionInstructor,
            OwnedSections = FormatIntList(ResolveOwnedSections(request.HasOtherSectionInstructor, request.SectionCount, request.OwnedSections)),
            InstructorEmail = request.InstructorEmail.Trim().ToLowerInvariant(),
            Description = request.Description?.Trim(),
            StudentCount = request.StudentCount,
            OtherLaboratoryName = request.OtherLaboratoryName?.Trim(),
            CreatedByUserId = user.Id
        };
        await ApplyDetailsAsync(entity, request.Items, request.Schedules, request.LaboratoryIds, request.Assistants, cancellationToken);
        db.SoftwareRequests.Add(entity);
        await db.SaveChangesAsync(cancellationToken);
        return await ReloadDtoAsync(entity.Id, cancellationToken);
    }

    public async Task<SoftwareRequestDto> UpdateAsync(Guid id, UpdateSoftwareRequestRequest request, CancellationToken cancellationToken)
    {
        await updateValidator.ValidateRequestAsync(request, cancellationToken);
        await ValidateInstructorDomainAsync(request.InstructorEmail, cancellationToken);
        var entity = await IncludeGraph(db.SoftwareRequests).AsSplitQuery().SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                     ?? throw new NotFoundException("Talep bulunamadı.");
        await EnsureAccessAsync(entity, FacultyPermission.Edit, cancellationToken);
        if (authorization.IsAcademic && entity.Status is not (SoftwareRequestStatus.Draft or SoftwareRequestStatus.AwaitingInformation))
            throw new BusinessRuleException("Akademisyen yalnızca taslak veya eksik bilgi beklenen talepleri düzenleyebilir.");
        var canChangeFaculty = authorization.IsAdministrator || authorization.IsAdministrativeStaff;
        if (!canChangeFaculty && request.FacultyId.HasValue && request.FacultyId.Value != entity.FacultyId)
            throw new ForbiddenException("Fakülte bilgisi istemciden değiştirilemez.");
        var trackHistory = entity.Status != SoftwareRequestStatus.Draft;
        var beforeSnapshot = trackHistory ? CreateHistorySnapshot(entity) : null;
        if (canChangeFaculty && request.FacultyId.HasValue)
        {
            if (!await db.Faculties.AnyAsync(x => x.Id == request.FacultyId.Value && x.IsActive, cancellationToken))
                throw new NotFoundException("Fakülte bulunamadı.");
            entity.FacultyId = request.FacultyId.Value;
        }
        entity.AcademicTermId = request.AcademicTermId;
        entity.CourseCode = request.CourseCode.Trim().ToUpperInvariant();
        entity.CourseName = request.CourseName.Trim();
        entity.SectionCount = request.SectionCount;
        entity.HasOtherSectionInstructor = request.HasOtherSectionInstructor;
        entity.OwnedSections = FormatIntList(ResolveOwnedSections(request.HasOtherSectionInstructor, request.SectionCount, request.OwnedSections));
        entity.InstructorEmail = request.InstructorEmail.Trim().ToLowerInvariant();
        entity.Description = request.Description?.Trim();
        entity.StudentCount = request.StudentCount;
        entity.OtherLaboratoryName = request.OtherLaboratoryName?.Trim();

        db.SoftwarePlugins.RemoveRange(entity.Items.SelectMany(x => x.Plugins));
        db.SoftwareRequestItems.RemoveRange(entity.Items);
        db.CourseSchedules.RemoveRange(entity.Schedules);
        db.RequestLaboratories.RemoveRange(entity.RequestLaboratories);
        db.RequestAssistants.RemoveRange(entity.Assistants);
        entity.Items = [];
        entity.Schedules = [];
        entity.RequestLaboratories = [];
        entity.Assistants = [];
        await ApplyDetailsAsync(entity, request.Items, request.Schedules, request.LaboratoryIds, request.Assistants, cancellationToken);
        if (trackHistory)
            await AppendRevisionsAsync(
                entity,
                cancellationToken,
                (RequestRevisionChangeType.UpdateBefore, beforeSnapshot!),
                (RequestRevisionChangeType.UpdateAfter, CreateHistorySnapshot(entity)));
        await db.SaveChangesAsync(cancellationToken);
        return await ReloadDtoAsync(entity.Id, cancellationToken);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await db.SoftwareRequests.SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                     ?? throw new NotFoundException("Talep bulunamadı.");
        await EnsureAccessAsync(entity, FacultyPermission.Edit, cancellationToken);
        if (!authorization.IsAdministrator && entity.Status != SoftwareRequestStatus.Draft)
            throw new BusinessRuleException("Yalnızca taslak talepler silinebilir.");
        db.SoftwareRequests.Remove(entity);
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<SoftwareRequestDto> SubmitAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await IncludeGraph(db.SoftwareRequests).AsSplitQuery().SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                     ?? throw new NotFoundException("Talep bulunamadı.");
        if (entity.OwnerUserId != authorization.UserId && !authorization.IsAdministrator)
            throw new ForbiddenException();
        if (entity.Items.Count == 0 || entity.Schedules.Count == 0 ||
            (entity.RequestLaboratories.Count == 0 && string.IsNullOrWhiteSpace(entity.OtherLaboratoryName)))
            throw new BusinessRuleException("Program, ders zamanı ve laboratuvar bilgileri tamamlanmadan talep gönderilemez.");
        try
        {
            entity.ChangeStatus(SoftwareRequestStatus.Submitted);
        }
        catch (InvalidOperationException ex)
        {
            throw new BusinessRuleException(ex.Message);
        }
        await AppendRevisionsAsync(
            entity,
            cancellationToken,
            (RequestRevisionChangeType.Submitted, CreateHistorySnapshot(entity)));
        var reviewerEmails = await NotifyFacultyReviewersAsync(entity, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await auditService.WriteAsync(AuditActionType.RequestSubmitted, nameof(SoftwareRequest), id.ToString(), cancellationToken: cancellationToken);
        await SendSubmissionEmailsAsync(entity, reviewerEmails, cancellationToken);
        return await ToDtoAsync(entity, cancellationToken);
    }

    private async Task SendSubmissionEmailsAsync(
        SoftwareRequest entity,
        IReadOnlyList<string> reviewerEmails,
        CancellationToken cancellationToken)
    {
        // Unlike Notification.Link (a relative path the frontend's normalizeNotificationLink()
        // rewrites at render time), this is an absolute URL opened directly from an email client,
        // so it must already be the real route the SPA serves: /talepler/:id, not /requests/:id.
        var link = $"{PublicOrigin}/talepler/{entity.Id}";
        var logoUrl = $"{PublicOrigin}/fbu-logo.png";
        var owner = await userManager.FindByIdAsync(entity.OwnerUserId);
        var softwareNames = string.Join(", ", entity.Items.Select(i => i.SoftwareApplication?.Name ?? i.OtherSoftwareName ?? "Diğer"));
        var labNames = string.Join(", ", entity.RequestLaboratories.Select(l => l.Laboratory.Name));
        var submittedAt = DateTimeOffset.UtcNow.ToString("dd.MM.yyyy HH:mm", CultureInfo.InvariantCulture);
        var courseTitle = $"{WebUtility.HtmlEncode(entity.CourseCode)} &ndash; {WebUtility.HtmlEncode(entity.CourseName)}";
        var termLabel = WebUtility.HtmlEncode($"{entity.AcademicTerm.AcademicYear} {entity.AcademicTerm.TermName}");
        var softwareLabel = WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(softwareNames) ? "—" : softwareNames);
        var labLabel = WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(labNames) ? "—" : labNames);

        if (reviewerEmails.Count > 0)
        {
            var reviewerHtml = BuildRequestEmailHtml(
                logoUrl, "Yeni Yazılım Talebi", "GÖNDERİLDİ", "#2f7c6e",
                $"<strong>{courseTitle}</strong> dersi için yeni bir yazılım talebi gönderildi. Talep detayları aşağıdadır.",
                [
                    ("Ders Kodu", WebUtility.HtmlEncode(entity.CourseCode)),
                    ("Ders Adı", WebUtility.HtmlEncode(entity.CourseName)),
                    ("Fakülte", WebUtility.HtmlEncode(entity.Faculty.Name)),
                    ("Akademik Dönem", termLabel),
                    ("Öğretim Üyesi", WebUtility.HtmlEncode(entity.InstructorEmail)),
                    ("Öğrenci Sayısı", entity.StudentCount.ToString(CultureInfo.InvariantCulture)),
                    ("Talep Eden", WebUtility.HtmlEncode(owner is null ? "—" : $"{owner.FullName} ({owner.Email})")),
                    ("İstenen Programlar", softwareLabel),
                    ("Laboratuvarlar", labLabel),
                    ("Gönderim Tarihi", submittedAt),
                ],
                "Talebi İncele", "#2f7c6e", link,
                "Bu e-posta FBÜ Yazılım Talep Sistemi tarafından otomatik olarak gönderilmiştir, lütfen bu adrese yanıt vermeyiniz. " +
                "Sorularınız için <a href=\"mailto:yazilimtalep@fbu.edu.tr\" style=\"color:#2f7c6e;\">yazilimtalep@fbu.edu.tr</a> adresine ulaşabilirsiniz.");
            foreach (var email in reviewerEmails)
                await emailSender.SendAsync(email, $"Yeni yazılım talebi: {entity.CourseCode}", reviewerHtml, cancellationToken);
        }

        if (!string.IsNullOrWhiteSpace(owner?.Email))
        {
            var confirmationHtml = BuildRequestEmailHtml(
                logoUrl, "Talebiniz Alındı", "ALINDI", "#223a5e",
                $"<strong>{courseTitle}</strong> dersi için yazılım talebiniz başarıyla oluşturuldu ve incelemeye alındı. Talebin durumu değiştikçe size bilgi verilecektir.",
                [
                    ("Ders Kodu", WebUtility.HtmlEncode(entity.CourseCode)),
                    ("Ders Adı", WebUtility.HtmlEncode(entity.CourseName)),
                    ("Akademik Dönem", termLabel),
                    ("Öğrenci Sayısı", entity.StudentCount.ToString(CultureInfo.InvariantCulture)),
                    ("İstenen Programlar", softwareLabel),
                    ("Laboratuvarlar", labLabel),
                    ("Durum", "Gönderildi"),
                    ("Gönderim Tarihi", submittedAt),
                ],
                "Talebi Görüntüle", "#223a5e", link,
                "Bu e-posta FBÜ Yazılım Talep Sistemi tarafından otomatik olarak gönderilmiştir, lütfen bu adrese yanıt vermeyiniz. " +
                "Sorularınız için <a href=\"https://portal.fbu.edu.tr/helpdesk\" style=\"color:#2f7c6e;\">https://portal.fbu.edu.tr/helpdesk</a> adresinden talep açabilirsiniz.");
            await emailSender.SendAsync(owner.Email, $"Talebiniz alındı: {entity.CourseCode}", confirmationHtml, cancellationToken);
        }
    }

    // Table-based, inline-styled layout: mirrors the constraints of real email clients
    // (Outlook/Gmail strip <style> blocks and ignore flex/grid), not a stylistic choice.
    private static string BuildRequestEmailHtml(
        string logoUrl,
        string headerTitle,
        string badgeText,
        string badgeColor,
        string introHtml,
        IReadOnlyList<(string Label, string Value)> rows,
        string ctaLabel,
        string ctaColor,
        string link,
        string footerHtml)
    {
        var rowsHtml = string.Concat(rows.Select((row, index) => DetailRow(row.Label, row.Value, index == rows.Count - 1)));
        var bodyContent = $"""
            <tr>
              <td style="padding:26px 32px 6px;">
                <p style="margin:0;color:#1c2530;font-size:15px;line-height:1.65;">{introHtml}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 4px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2dfd6;border-radius:8px;overflow:hidden;">
                  {rowsHtml}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 32px 4px;">
                {CtaButton(ctaLabel, ctaColor, link)}
              </td>
            </tr>
            """;
        return EmailShell(logoUrl, headerTitle, badgeText, badgeColor, bodyContent, footerHtml);
    }

    private static string DetailRow(string label, string value, bool isLast)
    {
        var borderStyle = isLast ? "" : "border-bottom:1px solid #e2dfd6;";
        return $"""
            <tr>
              <td style="padding:10px 14px;background-color:#f5f4f0;color:#6b6459;font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.03em;width:36%;{borderStyle}">{WebUtility.HtmlEncode(label)}</td>
              <td style="padding:10px 14px;color:#1c2530;font-size:14px;{borderStyle}">{value}</td>
            </tr>
            """;
    }

    private static string CtaButton(string label, string color, string link) =>
        $"""
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="border-radius:6px;background-color:{color};">
              <a href="{link}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">{WebUtility.HtmlEncode(label)}</a>
            </td>
          </tr>
        </table>
        """;

    private static string EmailShell(
        string logoUrl,
        string headerTitle,
        string badgeText,
        string badgeColor,
        string bodyContentHtml,
        string footerHtml) =>
        $"""
        <!doctype html>
        <html lang="tr">
        <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{WebUtility.HtmlEncode(headerTitle)}</title>
        </head>
        <body style="margin:0;padding:0;background-color:#eeece6;font-family:Segoe UI, Helvetica, Arial, sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eeece6;padding:28px 12px;">
        <tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background-color:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e2dfd6;">
          <tr>
            <td style="background-color:#223a5e;padding:24px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td width="52" style="padding-right:14px;vertical-align:middle;">
                    <img src="{logoUrl}" width="44" height="44" alt="FBÜ" style="display:block;border-radius:50%;border:1px solid rgba(255,255,255,0.35);" />
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="color:#c9d4e2;font-size:12px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;">FBÜ Yazılım Talep Sistemi</span>
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:8px;">
                      <tr>
                        <td style="color:#ffffff;font-size:21px;font-weight:700;padding-right:10px;">{WebUtility.HtmlEncode(headerTitle)}</td>
                        <td>
                          <span style="display:inline-block;background-color:{badgeColor};color:#ffffff;font-size:11px;font-weight:700;letter-spacing:0.03em;padding:4px 10px;border-radius:999px;">{WebUtility.HtmlEncode(badgeText)}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          {bodyContentHtml}
          <tr>
            <td style="padding:22px 32px 30px;border-top:1px solid #e2dfd6;">
              <p style="margin:0;color:#9b9488;font-size:12px;line-height:1.6;">
                {footerHtml}
              </p>
            </td>
          </tr>
        </table>
        </td></tr>
        </table>
        </body>
        </html>
        """;

    public async Task<SoftwareRequestDto> ChangeStatusAsync(Guid id, ChangeRequestStatusRequest request, CancellationToken cancellationToken)
    {
        await statusValidator.ValidateRequestAsync(request, cancellationToken);
        var entity = await IncludeGraph(db.SoftwareRequests).AsSplitQuery().SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                     ?? throw new NotFoundException("Talep bulunamadı.");
        var previousStatus = entity.Status;
        var beforeSnapshot = CreateHistorySnapshot(entity);
        if (!authorization.IsAdministrator)
        {
            if (!authorization.IsFacultyUser)
                throw new ForbiddenException();
            await authorization.EnsureFacultyAccessAsync(entity.FacultyId, FacultyPermission.ChangeStatus, cancellationToken);
        }
        if (request.Status == SoftwareRequestStatus.InstallationCompleted)
        {
            var requestedLabIds = request.InstallationLaboratoryIds!.Distinct().ToList();
            var validLabIds = entity.RequestLaboratories.Select(x => x.LaboratoryId).ToHashSet();
            if (requestedLabIds.Any(x => !validLabIds.Contains(x)))
                throw new BusinessRuleException("Kurulum laboratuvarları talepte seçili laboratuvarlardan olmalıdır.");
            entity.InstallationPersonnel = request.InstallationPersonnel!.Trim();
            entity.InstallationDate = request.InstallationDate;
            entity.InstalledVersion = request.InstalledVersion!.Trim();
            entity.InstallationLaboratoryIds = string.Join(',', requestedLabIds);
            entity.InstallationNote = request.InstallationNote?.Trim();
        }
        try
        {
            entity.ChangeStatus(request.Status, request.Reason);
        }
        catch (InvalidOperationException ex)
        {
            throw new BusinessRuleException(ex.Message);
        }
        entity.AdministratorNote = request.AdministratorNote?.Trim();
        if (previousStatus == SoftwareRequestStatus.Draft &&
            request.Status == SoftwareRequestStatus.Submitted)
            await AppendRevisionsAsync(
                entity,
                cancellationToken,
                (RequestRevisionChangeType.Submitted, CreateHistorySnapshot(entity)));
        else
            await AppendRevisionsAsync(
                entity,
                cancellationToken,
                (RequestRevisionChangeType.StatusChangeBefore, beforeSnapshot),
                (RequestRevisionChangeType.StatusChangeAfter, CreateHistorySnapshot(entity)));
        db.Notifications.Add(new Notification
        {
            UserId = entity.OwnerUserId,
            Type = request.Status == SoftwareRequestStatus.InstallationCompleted
                ? NotificationType.InstallationCompleted
                : request.Status == SoftwareRequestStatus.AwaitingInformation
                    ? NotificationType.InformationRequested
                    : NotificationType.RequestStatusChanged,
            Title = "Talep durumu güncellendi",
            Message = $"{entity.CourseCode} talebinin durumu {request.Status} olarak değiştirildi.",
            Link = $"/requests/{entity.Id}"
        });
        await db.SaveChangesAsync(cancellationToken);
        await auditService.WriteAsync(AuditActionType.RequestStatusChanged, nameof(SoftwareRequest), id.ToString(), cancellationToken: cancellationToken);
        return await ToDtoAsync(entity, cancellationToken);
    }

    public async Task<SoftwareRequestDto> CopyAsync(Guid id, CancellationToken cancellationToken)
    {
        var source = await IncludeGraph(db.SoftwareRequests)
            .AsSplitQuery().SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new NotFoundException("Talep bulunamadı.");
        await EnsureAccessAsync(source, FacultyPermission.View, cancellationToken);
        var user = await authorization.GetUserAsync(cancellationToken);
        if (!authorization.IsAdministrator && !authorization.IsAcademic)
            throw new ForbiddenException();
        var target = new SoftwareRequest
        {
            OwnerUserId = user.Id,
            FacultyId = authorization.IsAdministrator || authorization.IsAdministrativeStaff
                ? source.FacultyId
                : user.FacultyId ?? throw new BusinessRuleException("Kullanıcıya fakülte atanmamış."),
            AcademicTermId = source.AcademicTermId,
            CourseCode = source.CourseCode,
            CourseName = source.CourseName,
            SectionCount = source.SectionCount,
            HasOtherSectionInstructor = source.HasOtherSectionInstructor,
            OwnedSections = source.OwnedSections,
            InstructorEmail = user.Email ?? source.InstructorEmail,
            Description = source.Description,
            StudentCount = source.StudentCount,
            HasCapacityWarning = source.HasCapacityWarning,
            OtherLaboratoryName = source.OtherLaboratoryName,
            Items = source.Items.Select(x => new SoftwareRequestItem
            {
                SoftwareApplicationId = x.SoftwareApplicationId,
                OtherSoftwareName = x.OtherSoftwareName,
                RequestedVersion = x.RequestedVersion,
                LicenseType = x.LicenseType,
                LicenseOverrideReason = x.LicenseOverrideReason,
                DownloadUrl = x.DownloadUrl,
                Language = x.Language,
                OtherLanguage = x.OtherLanguage,
                NoPluginRequired = x.NoPluginRequired,
                Plugins = x.Plugins.Select(p => new SoftwarePlugin
                { Name = p.Name, Version = p.Version, DownloadUrl = p.DownloadUrl, Description = p.Description }).ToList()
            }).ToList(),
            Schedules = source.Schedules.Select(x => new CourseSchedule
            { DayOfWeek = x.DayOfWeek, StartTime = x.StartTime, EndTime = x.EndTime }).ToList(),
            RequestLaboratories = source.RequestLaboratories.Select(x => new RequestLaboratory
            { LaboratoryId = x.LaboratoryId }).ToList(),
            Assistants = source.Assistants.Select(x => new RequestAssistant
            { FullName = x.FullName, Email = x.Email }).ToList()
        };
        db.SoftwareRequests.Add(target);
        await db.SaveChangesAsync(cancellationToken);
        return await ReloadDtoAsync(target.Id, cancellationToken);
    }

    // Ders Programı (admin calendar): flattens every request's schedule rows across its selected
    // labs (there is no per-lab link on CourseSchedule, so a request with N schedules and M labs
    // occupies all N*M lab/day/time combinations). Draft/Rejected/Cancelled requests are excluded
    // since they will not actually run.
    private static readonly SoftwareRequestStatus[] ScheduleExcludedStatuses =
        [SoftwareRequestStatus.Draft, SoftwareRequestStatus.Rejected, SoftwareRequestStatus.Cancelled];

    public async Task<IReadOnlyList<CourseScheduleEntryDto>> GetScheduleAsync(CancellationToken cancellationToken)
    {
        authorization.RequireAdministrator();
        var entities = await IncludeGraph(db.SoftwareRequests.AsNoTracking())
            .Where(x => !ScheduleExcludedStatuses.Contains(x.Status) && x.Schedules.Any() && x.RequestLaboratories.Any())
            .AsSplitQuery()
            .ToListAsync(cancellationToken);
        var ownerIds = entities.Select(x => x.OwnerUserId).Distinct().ToList();
        var owners = await userManager.Users.AsNoTracking()
            .Where(u => ownerIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, cancellationToken);

        var entries = new List<CourseScheduleEntryDto>();
        foreach (var request in entities)
        {
            owners.TryGetValue(request.OwnerUserId, out var owner);
            foreach (var schedule in request.Schedules)
            foreach (var lab in request.RequestLaboratories)
                entries.Add(new CourseScheduleEntryDto(
                    request.Id, request.CourseCode, request.CourseName, ParseIntList(request.OwnedSections), request.InstructorEmail,
                    owner?.FullName ?? string.Empty, owner?.Email ?? string.Empty, request.Status,
                    schedule.DayOfWeek, schedule.StartTime, schedule.EndTime,
                    lab.LaboratoryId, lab.Laboratory.Name));
        }
        return entries
            .OrderBy(x => x.DayOfWeek).ThenBy(x => x.StartTime).ThenBy(x => x.LaboratoryName)
            .ToList();
    }

    public async Task<RequestDraftDto?> GetDraftAsync(CancellationToken cancellationToken)
    {
        var draft = await db.RequestDrafts.AsNoTracking()
            .SingleOrDefaultAsync(x => x.UserId == authorization.UserId, cancellationToken);
        return draft is null ? null : new RequestDraftDto(draft.PayloadJson, draft.UpdatedAt ?? draft.CreatedAt);
    }

    public async Task<RequestDraftDto> SaveDraftAsync(UpsertRequestDraftRequest request, CancellationToken cancellationToken)
    {
        await draftValidator.ValidateRequestAsync(request, cancellationToken);
        var draft = await db.RequestDrafts.SingleOrDefaultAsync(x => x.UserId == authorization.UserId, cancellationToken);
        if (draft is null)
        {
            draft = new RequestDraft { UserId = authorization.UserId };
            db.RequestDrafts.Add(draft);
        }
        draft.PayloadJson = request.PayloadJson;
        await db.SaveChangesAsync(cancellationToken);
        return new RequestDraftDto(draft.PayloadJson, draft.UpdatedAt ?? draft.CreatedAt);
    }

    public async Task DeleteDraftAsync(CancellationToken cancellationToken)
    {
        var draft = await db.RequestDrafts.SingleOrDefaultAsync(x => x.UserId == authorization.UserId, cancellationToken);
        if (draft is not null)
        {
            db.RequestDrafts.Remove(draft);
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    private async Task EnsureAccessAsync(SoftwareRequest entity, FacultyPermission permission, CancellationToken cancellationToken)
    {
        if (authorization.IsAdministrator || entity.OwnerUserId == authorization.UserId)
            return;
        if (authorization.IsAcademic)
            throw new ForbiddenException("Başka bir akademisyene ait talebe erişemezsiniz.");
        await authorization.EnsureFacultyAccessAsync(entity.FacultyId, permission, cancellationToken);
    }

    private async Task<(ApplicationUser User, Guid FacultyId)> ResolveCreateFacultyAsync(Guid? suppliedFacultyId, CancellationToken cancellationToken)
    {
        var user = await authorization.GetUserAsync(cancellationToken);
        if (authorization.IsAdministrator)
        {
            var id = suppliedFacultyId ?? user.FacultyId ?? throw new BusinessRuleException("Fakülte seçimi zorunludur.");
            if (!await db.Faculties.AnyAsync(x => x.Id == id && x.IsActive, cancellationToken))
                throw new NotFoundException("Fakülte bulunamadı.");
            return (user, id);
        }
        if (authorization.IsAdministrativeStaff)
        {
            // Administrative staff belong to a department/unit, not a Faculty, so they have no
            // ApplicationUser.FacultyId. They may either pick an existing faculty to request for,
            // or leave it unset to request on behalf of their own department/unit.
            if (suppliedFacultyId.HasValue)
            {
                if (!await db.Faculties.AnyAsync(x => x.Id == suppliedFacultyId.Value && x.IsActive, cancellationToken))
                    throw new NotFoundException("Fakülte bulunamadı.");
                return (user, suppliedFacultyId.Value);
            }
            return (user, await EnsureOwnUnitFacultyAsync(user, cancellationToken));
        }
        var facultyId = user.FacultyId ?? throw new BusinessRuleException("Kullanıcı hesabına fakülte atanmamış.");
        if (suppliedFacultyId.HasValue && suppliedFacultyId.Value != facultyId)
            throw new ForbiddenException("Akademisyen fakülte bilgisini değiştiremez.");
        return (user, facultyId);
    }

    /// <summary>
    /// Finds or lazily creates a Faculty row representing an administrative user's own
    /// department/unit (e.g. "Bilgi Teknolojileri Daire Başkanlığı"), so their requests can still
    /// be attached to the required non-nullable SoftwareRequest.FacultyId. Mirrors the
    /// find-or-create pattern AdSyncService already uses for academic office names.
    /// </summary>
    private async Task<Guid> EnsureOwnUnitFacultyAsync(ApplicationUser user, CancellationToken cancellationToken)
    {
        var unitName = string.IsNullOrWhiteSpace(user.Department) ? "Genel İdari Birim" : user.Department.Trim();
        var existing = await db.Faculties.FirstOrDefaultAsync(x => x.Name == unitName, cancellationToken);
        if (existing is not null)
            return existing.Id;
        var existingCodes = new HashSet<string>(
            await db.Faculties.Select(x => x.Code).ToListAsync(cancellationToken),
            StringComparer.OrdinalIgnoreCase);
        var faculty = new Faculty
        {
            Name = unitName,
            Code = TextNormalization.GenerateFacultyCode(unitName, existingCodes),
            Description = "İdari personel taleplerinde birim seçimi için otomatik oluşturuldu."
        };
        db.Faculties.Add(faculty);
        await db.SaveChangesAsync(cancellationToken);
        return faculty.Id;
    }

    private async Task ApplyDetailsAsync(
        SoftwareRequest entity,
        IReadOnlyList<SoftwareRequestItemInput>? itemInputs,
        IReadOnlyList<CourseScheduleInput>? scheduleInputs,
        IReadOnlyList<Guid>? laboratoryIds,
        IReadOnlyList<RequestAssistantInput>? assistantInputs,
        CancellationToken cancellationToken)
    {
        var inputs = itemInputs ?? [];
        var softwareIds = inputs.Where(x => x.SoftwareApplicationId.HasValue)
            .Select(x => x.SoftwareApplicationId!.Value).Distinct().ToList();
        var software = await db.SoftwareApplications.Where(x => softwareIds.Contains(x.Id) && x.IsActive)
            .ToDictionaryAsync(x => x.Id, cancellationToken);
        if (software.Count != softwareIds.Count)
            throw new BusinessRuleException("Seçilen programlardan biri bulunamadı veya pasif.");
        foreach (var input in inputs)
        {
            var selected = input.SoftwareApplicationId.HasValue ? software[input.SoftwareApplicationId.Value] : null;
            if (selected is not null && input.LicenseType != selected.LicenseType && string.IsNullOrWhiteSpace(input.LicenseOverrideReason))
                throw new BusinessRuleException($"{selected.Name} için lisans durumu değişiklik açıklaması zorunludur.");
            var item = new SoftwareRequestItem
            {
                SoftwareApplicationId = input.SoftwareApplicationId,
                OtherSoftwareName = selected is null ? input.OtherSoftwareName?.Trim() : null,
                RequestedVersion = input.RequestedVersion?.Trim(),
                LicenseType = input.LicenseType,
                LicenseOverrideReason = input.LicenseOverrideReason?.Trim(),
                DownloadUrl = input.DownloadUrl?.Trim() ?? selected?.DefaultDownloadUrl,
                Language = input.Language?.Trim() ?? selected?.DefaultLanguage,
                OtherLanguage = input.OtherLanguage?.Trim(),
                NoPluginRequired = input.NoPluginRequired,
                Plugins = (input.Plugins ?? []).Select(x => new SoftwarePlugin
                {
                    Name = x.Name.Trim(),
                    Version = x.Version?.Trim(),
                    DownloadUrl = x.DownloadUrl?.Trim(),
                    Description = x.Description?.Trim()
                }).ToList()
            };
            entity.Items.Add(item);
            // entity may already be tracked (Update flow): a plain collection Add is only
            // discovered via navigation fix-up, and since Id is client-assigned (non-default)
            // EF would otherwise assume the child already exists and mark it Unchanged instead
            // of Added, causing a "does not exist in the store" failure on SaveChanges.
            db.SoftwareRequestItems.Add(item);
        }
        foreach (var input in scheduleInputs ?? [])
        {
            var schedule = new CourseSchedule { DayOfWeek = input.DayOfWeek, StartTime = input.StartTime, EndTime = input.EndTime };
            entity.Schedules.Add(schedule);
            db.CourseSchedules.Add(schedule);
        }
        foreach (var input in assistantInputs ?? [])
        {
            var assistant = new RequestAssistant { FullName = input.FullName.Trim(), Email = input.Email.Trim().ToLowerInvariant() };
            entity.Assistants.Add(assistant);
            db.RequestAssistants.Add(assistant);
        }

        var labIds = (laboratoryIds ?? []).Distinct().ToList();
        var labs = await db.Laboratories.Where(x => labIds.Contains(x.Id) && x.IsActive).ToListAsync(cancellationToken);
        if (labs.Count != labIds.Count)
            throw new BusinessRuleException("Seçilen laboratuvarlardan biri bulunamadı veya pasif.");
        // Laboratories are a shared university resource; a request's faculty does not need to
        // match the lab's administratively-owning faculty (see LaboratoryService.GetAsync).
        foreach (var lab in labs)
        {
            var requestLaboratory = new RequestLaboratory { LaboratoryId = lab.Id };
            entity.RequestLaboratories.Add(requestLaboratory);
            db.RequestLaboratories.Add(requestLaboratory);
        }
        entity.HasCapacityWarning = labs.Any(x =>
            entity.StudentCount > Math.Min(x.Capacity, x.ComputerCount));
    }

    private async Task<IReadOnlyList<string>> NotifyFacultyReviewersAsync(SoftwareRequest entity, CancellationToken cancellationToken)
    {
        var permittedUserIds = await db.UserFacultyPermissions
            .Where(x => x.FacultyId == entity.FacultyId && (x.Permissions & FacultyPermission.View) == FacultyPermission.View)
            .Select(x => x.UserId).ToListAsync(cancellationToken);
        var admins = await userManager.GetUsersInRoleAsync(AppRoles.SystemAdministrator);
        var permittedUsers = await userManager.Users
            .Where(x => permittedUserIds.Contains(x.Id))
            .ToListAsync(cancellationToken);
        var recipients = permittedUsers.Concat(admins).Where(x => x.IsActive).DistinctBy(x => x.Id).ToList();
        foreach (var recipient in recipients)
            db.Notifications.Add(new Notification
            {
                UserId = recipient.Id,
                Type = NotificationType.RequestSubmitted,
                Title = "Yeni yazılım talebi",
                Message = $"{entity.CourseCode} dersi için yeni talep gönderildi.",
                Link = $"/requests/{entity.Id}"
            });
        return recipients.Where(x => !string.IsNullOrWhiteSpace(x.Email)).Select(x => x.Email!).Distinct().ToList();
    }

    private async Task ValidateInstructorDomainAsync(string email, CancellationToken cancellationToken)
    {
        var configuredDomain = await db.SystemSettings.AsNoTracking()
            .Where(x => x.Key == "AllowedEmailDomain")
            .Select(x => x.Value)
            .SingleOrDefaultAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(configuredDomain))
            return;
        var at = email.LastIndexOf('@');
        if (at < 0 || !string.Equals(email[(at + 1)..], configuredDomain.Trim().TrimStart('@'),
                StringComparison.OrdinalIgnoreCase))
            throw new BusinessRuleException($"E-posta adresi @{configuredDomain.Trim().TrimStart('@')} domaininde olmalıdır.");
    }

    private async Task<SoftwareRequestDto> ReloadDtoAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await IncludeGraph(db.SoftwareRequests.AsNoTracking()).AsSplitQuery()
            .SingleAsync(x => x.Id == id, cancellationToken);
        return await ToDtoAsync(entity, cancellationToken);
    }

    private async Task AppendRevisionsAsync(
        SoftwareRequest request,
        CancellationToken cancellationToken,
        params (RequestRevisionChangeType ChangeType, string SnapshotJson)[] revisions)
    {
        var version = await db.SoftwareRequestRevisions
            .Where(x => x.SoftwareRequestId == request.Id)
            .MaxAsync(x => (int?)x.Version, cancellationToken) ?? 0;
        var createdAt = DateTimeOffset.UtcNow;
        foreach (var revision in revisions)
            db.SoftwareRequestRevisions.Add(new SoftwareRequestRevision(
                request.Id,
                ++version,
                revision.ChangeType,
                revision.SnapshotJson,
                authorization.UserId,
                createdAt));
    }

    private static string CreateHistorySnapshot(SoftwareRequest request) =>
        JsonSerializer.Serialize(new
        {
            schemaVersion = 1,
            requestId = request.Id,
            request.OwnerUserId,
            request.FacultyId,
            request.AcademicTermId,
            request.CourseId,
            request.CourseCode,
            request.CourseName,
            request.SectionCount,
            request.HasOtherSectionInstructor,
            ownedSections = ParseIntList(request.OwnedSections),
            request.InstructorEmail,
            request.Description,
            status = request.Status.ToString(),
            request.AdministratorNote,
            request.StatusReason,
            request.InstallationPersonnel,
            request.InstallationDate,
            request.InstalledVersion,
            installationLaboratoryIds = ParseGuidList(request.InstallationLaboratoryIds),
            request.InstallationNote,
            request.StudentCount,
            request.HasCapacityWarning,
            request.OtherLaboratoryName,
            items = request.Items
                .OrderBy(x => x.SoftwareApplicationId)
                .Select(x => new
                {
                    x.SoftwareApplicationId,
                    x.OtherSoftwareName,
                    x.RequestedVersion,
                    licenseType = x.LicenseType.ToString(),
                    x.LicenseOverrideReason,
                    x.DownloadUrl,
                    x.Language,
                    x.OtherLanguage,
                    x.NoPluginRequired,
                    plugins = x.Plugins.OrderBy(p => p.Name).Select(p => new
                    {
                        p.Name,
                        p.Version,
                        p.DownloadUrl,
                        p.Description
                    })
                }),
            schedules = request.Schedules
                .OrderBy(x => x.DayOfWeek)
                .ThenBy(x => x.StartTime)
                .Select(x => new
                {
                    dayOfWeek = x.DayOfWeek.ToString(),
                    x.StartTime,
                    x.EndTime
                }),
            laboratoryIds = request.RequestLaboratories
                .Select(x => x.LaboratoryId)
                .OrderBy(x => x),
            assistants = request.Assistants
                .OrderBy(x => x.Email)
                .Select(x => new { x.FullName, x.Email })
        });

    private static IQueryable<SoftwareRequest> IncludeGraph(IQueryable<SoftwareRequest> query) =>
        query.Include(x => x.Faculty)
            .Include(x => x.AcademicTerm)
            .Include(x => x.Items).ThenInclude(x => x.SoftwareApplication)
            .Include(x => x.Items).ThenInclude(x => x.Plugins)
            .Include(x => x.Schedules)
            .Include(x => x.RequestLaboratories).ThenInclude(x => x.Laboratory)
            .Include(x => x.Assistants);

    private async Task<SoftwareRequestDto> ToDtoAsync(SoftwareRequest x, CancellationToken cancellationToken)
    {
        var owner = await userManager.FindByIdAsync(x.OwnerUserId);
        return ToDto(x, owner?.FullName, owner?.Email);
    }

    private async Task<List<SoftwareRequestDto>> ToDtosAsync(List<SoftwareRequest> entities, CancellationToken cancellationToken)
    {
        var ownerIds = entities.Select(x => x.OwnerUserId).Distinct().ToList();
        var owners = await userManager.Users.AsNoTracking()
            .Where(u => ownerIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, cancellationToken);
        return entities.Select(x =>
        {
            owners.TryGetValue(x.OwnerUserId, out var owner);
            return ToDto(x, owner?.FullName, owner?.Email);
        }).ToList();
    }

    internal static SoftwareRequestDto ToDto(SoftwareRequest x, string? ownerFullName, string? ownerEmail) =>
        new(
            x.Id, x.OwnerUserId, ownerFullName ?? string.Empty, ownerEmail ?? string.Empty, x.FacultyId, x.Faculty.Name, x.AcademicTermId,
            $"{x.AcademicTerm.AcademicYear} {x.AcademicTerm.TermName}", x.CourseCode, x.CourseName,
            x.SectionCount, x.HasOtherSectionInstructor, ParseIntList(x.OwnedSections),
            x.InstructorEmail, x.Description, x.Status, x.AdministratorNote, x.StatusReason,
            x.InstallationPersonnel, x.InstallationDate, x.InstalledVersion,
            ParseGuidList(x.InstallationLaboratoryIds), x.InstallationNote,
            x.StudentCount, x.HasCapacityWarning, x.CreatedAt, x.UpdatedAt,
            x.Items.Select(i => new SoftwareRequestItemDto(
                i.Id, i.SoftwareApplicationId, i.SoftwareApplication?.Name ?? i.OtherSoftwareName ?? string.Empty, i.OtherSoftwareName, i.RequestedVersion, i.LicenseType,
                i.LicenseOverrideReason, i.DownloadUrl, i.Language, i.OtherLanguage, i.NoPluginRequired,
                i.Plugins.Select(p => new SoftwarePluginDto(p.Id, p.Name, p.Version, p.DownloadUrl, p.Description)).ToList())).ToList(),
            x.Schedules.Select(s => new CourseScheduleDto(s.Id, s.DayOfWeek, s.StartTime, s.EndTime)).ToList(),
            x.RequestLaboratories.Select(l => new RequestLaboratoryDto(
                l.Id, l.LaboratoryId, l.Laboratory.Name, l.Laboratory.Capacity, l.Laboratory.ComputerCount)).ToList(),
            x.OtherLaboratoryName,
            x.Assistants.Select(a => new RequestAssistantDto(a.Id, a.FullName, a.Email)).ToList());

    private static IReadOnlyList<Guid> ParseGuidList(string? value) =>
        string.IsNullOrWhiteSpace(value)
            ? []
            : value.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(Guid.Parse).ToList();

    private static IReadOnlyList<int> ParseIntList(string? value) =>
        string.IsNullOrWhiteSpace(value)
            ? []
            : value.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(int.Parse).ToList();

    private static string FormatIntList(IEnumerable<int> values) => string.Join(',', values.OrderBy(x => x));

    // "Diğer section'ları başka akademisyen veriyor" unchecked: this request covers every section
    // of the course, so the owned-section list is derived rather than asked of the user.
    private static IReadOnlyList<int> ResolveOwnedSections(bool hasOtherSectionInstructor, int sectionCount, IReadOnlyList<int>? ownedSections) =>
        hasOtherSectionInstructor ? ownedSections ?? [] : Enumerable.Range(1, sectionCount).ToList();
}

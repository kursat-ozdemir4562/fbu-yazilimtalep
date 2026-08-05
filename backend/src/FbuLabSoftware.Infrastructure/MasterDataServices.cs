using FbuLabSoftware.Application;
using FbuLabSoftware.Domain;
using FluentValidation;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FbuLabSoftware.Infrastructure;

public sealed class ResourceAuthorizationService(
    AppDbContext db,
    UserManager<ApplicationUser> userManager,
    ICurrentUserService currentUser)
{
    public string UserId => currentUser.UserId ?? throw new UnauthorizedException();
    public bool IsAdministrator => currentUser.IsInRole(AppRoles.SystemAdministrator);
    public bool IsAcademic => currentUser.IsInRole(AppRoles.Academic) || currentUser.IsInRole(AppRoles.Administrative);
    public bool IsAdministrativeStaff => currentUser.IsInRole(AppRoles.Administrative);
    public bool IsFacultyUser => currentUser.IsInRole(AppRoles.FacultyAuthorizedUser);

    public void RequireAdministrator()
    {
        if (!IsAdministrator)
            throw new ForbiddenException();
    }

    public async Task<ApplicationUser> GetUserAsync(CancellationToken cancellationToken) =>
        await userManager.Users.SingleOrDefaultAsync(x => x.Id == UserId && x.IsActive, cancellationToken)
        ?? throw new UnauthorizedException();

    public async Task<IReadOnlyList<Guid>> AllowedFacultyIdsAsync(
        FacultyPermission permission,
        CancellationToken cancellationToken)
    {
        if (IsAdministrator)
            return await db.Faculties.Select(x => x.Id).ToListAsync(cancellationToken);
        if (IsAcademic)
        {
            var facultyId = await userManager.Users.Where(x => x.Id == UserId).Select(x => x.FacultyId).SingleAsync(cancellationToken);
            return facultyId is null ? [] : [facultyId.Value];
        }
        var explicitIds = await db.UserFacultyPermissions
            .Where(x => x.UserId == UserId && (x.Permissions & permission) == permission)
            .Select(x => x.FacultyId)
            .ToListAsync(cancellationToken);
        if (IsFacultyUser)
        {
            // A FacultyAuthorizedUser's own faculty (ApplicationUser.FacultyId) is implicitly
            // fully authorized without needing a separate UserFacultyPermissions grant from an
            // admin — that's the entire point of the role. Explicit grants (e.g. covering a
            // second faculty) still layer on top of this.
            var ownFacultyId = await userManager.Users.Where(x => x.Id == UserId).Select(x => x.FacultyId).SingleAsync(cancellationToken);
            if (ownFacultyId is not null && !explicitIds.Contains(ownFacultyId.Value))
                explicitIds = [.. explicitIds, ownFacultyId.Value];
        }
        return explicitIds;
    }

    public async Task EnsureFacultyAccessAsync(
        Guid facultyId,
        FacultyPermission permission,
        CancellationToken cancellationToken)
    {
        if (IsAdministrator)
            return;
        var ids = await AllowedFacultyIdsAsync(permission, cancellationToken);
        if (!ids.Contains(facultyId))
            throw new ForbiddenException("Bu fakültenin verilerine erişim yetkiniz yok.");
    }
}

internal static class InfrastructureMapping
{
    public static FacultyDto ToDto(this Faculty x) =>
        new(x.Id, x.Name, x.Code, x.Description, x.IsActive, x.CreatedAt, x.UpdatedAt);

    public static LaboratoryDto ToDto(this Laboratory x) =>
        new(x.Id, x.FacultyId, x.Name, x.Code, x.Building, x.Floor, x.Capacity, x.ComputerCount,
            x.OperatingSystem, x.ComputerType, x.Description, x.IsActive);

    public static AcademicTermDto ToDto(this AcademicTerm x) =>
        new(x.Id, x.AcademicYear, x.TermName, x.StartDate, x.EndDate, x.RequestStartDate, x.RequestEndDate, x.IsCurrent, x.IsActive);

    public static SoftwareDto ToDto(this SoftwareApplication x) =>
        new(x.Id, x.Name, x.Manufacturer, x.Description, x.DefaultDownloadUrl, x.LicenseType, x.IsPaid,
            x.SupportedOperatingSystems, x.DefaultLanguage, x.Version, x.IsActive, x.ApprovalStatus,
            x.Laboratories.Select(l => l.LaboratoryId).ToList());

    public static SoftwareSuggestionDto ToDto(this SoftwareSuggestion x) =>
        new(x.Id, x.Name, x.Manufacturer, x.Description, x.DownloadUrl, x.IsPaid, x.LicenseType,
            x.Language, x.RequiredOperatingSystem, x.SuggestedVersion, x.AdditionalNote, x.Status,
            x.RejectionReason, x.CreatedByUserId ?? string.Empty, x.CreatedAt, x.ApprovedSoftwareId);
}

public sealed class FacultyService(
    AppDbContext db,
    ResourceAuthorizationService authorization,
    IValidator<CreateFacultyRequest> createValidator,
    IValidator<UpdateFacultyRequest> updateValidator) : IFacultyService
{
    public async Task<PagedResult<FacultyDto>> GetAsync(int page, int pageSize, string? search, CancellationToken cancellationToken)
    {
        (page, pageSize) = Page(page, pageSize);
        var allowed = await authorization.AllowedFacultyIdsAsync(FacultyPermission.View, cancellationToken);
        var query = db.Faculties.AsNoTracking().Where(x => authorization.IsAdministrator || allowed.Contains(x.Id));
        if (!authorization.IsAdministrator)
            query = query.Where(x => x.IsActive);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(x => x.Name.ToLower().Contains(term) || x.Code.ToLower().Contains(term));
        }
        var count = await query.CountAsync(cancellationToken);
        var items = await query.OrderBy(x => x.Name).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        return new PagedResult<FacultyDto>(items.Select(x => x.ToDto()).ToList(), page, pageSize, count);
    }

    public async Task<FacultyDto> GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await db.Faculties.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                     ?? throw new NotFoundException("Fakülte bulunamadı.");
        await authorization.EnsureFacultyAccessAsync(id, FacultyPermission.View, cancellationToken);
        return entity.ToDto();
    }

    public async Task<FacultyDto> CreateAsync(CreateFacultyRequest request, CancellationToken cancellationToken)
    {
        authorization.RequireAdministrator();
        await createValidator.ValidateRequestAsync(request, cancellationToken);
        var code = request.Code.Trim().ToUpperInvariant();
        if (await db.Faculties.IgnoreQueryFilters().AnyAsync(x => x.Code == code, cancellationToken))
            throw new ConflictException("Bu fakülte kodu zaten kullanılıyor.");
        var entity = new Faculty { Name = request.Name.Trim(), Code = code, Description = request.Description?.Trim() };
        db.Faculties.Add(entity);
        await db.SaveChangesAsync(cancellationToken);
        return entity.ToDto();
    }

    public async Task<FacultyDto> UpdateAsync(Guid id, UpdateFacultyRequest request, CancellationToken cancellationToken)
    {
        authorization.RequireAdministrator();
        await updateValidator.ValidateRequestAsync(request, cancellationToken);
        var entity = await db.Faculties.SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                     ?? throw new NotFoundException("Fakülte bulunamadı.");
        var code = request.Code.Trim().ToUpperInvariant();
        if (await db.Faculties.AnyAsync(x => x.Id != id && x.Code == code, cancellationToken))
            throw new ConflictException("Bu fakülte kodu zaten kullanılıyor.");
        entity.Name = request.Name.Trim();
        entity.Code = code;
        entity.Description = request.Description?.Trim();
        entity.IsActive = request.IsActive;
        await db.SaveChangesAsync(cancellationToken);
        return entity.ToDto();
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        authorization.RequireAdministrator();
        var entity = await db.Faculties.SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                     ?? throw new NotFoundException("Fakülte bulunamadı.");
        entity.IsActive = false;
        db.Faculties.Remove(entity);
        await db.SaveChangesAsync(cancellationToken);
    }

    internal static (int Page, int PageSize) Page(int page, int pageSize) =>
        (Math.Max(1, page), Math.Clamp(pageSize, 1, 100));
}

public sealed class LaboratoryService(
    AppDbContext db,
    ResourceAuthorizationService authorization,
    IValidator<CreateLaboratoryRequest> createValidator,
    IValidator<UpdateLaboratoryRequest> updateValidator) : ILaboratoryService
{
    public async Task<PagedResult<LaboratoryDto>> GetAsync(int page, int pageSize, string? search, Guid? facultyId, CancellationToken cancellationToken)
    {
        (page, pageSize) = FacultyService.Page(page, pageSize);
        // Laboratories are a shared physical resource: any authenticated user creating or
        // browsing a request may see and select any active lab, regardless of which faculty
        // administratively owns it. Faculty scoping here previously hid almost every lab from
        // users outside the lab's own faculty, blocking request creation entirely.
        var query = db.Laboratories.AsNoTracking().AsQueryable();
        if (!authorization.IsAdministrator)
            query = query.Where(x => x.IsActive);
        if (facultyId.HasValue)
            query = query.Where(x => x.FacultyId == facultyId.Value);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(x => x.Name.ToLower().Contains(term) || x.Code.ToLower().Contains(term));
        }
        var count = await query.CountAsync(cancellationToken);
        var items = await query.OrderBy(x => x.Name).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        return new PagedResult<LaboratoryDto>(items.Select(x => x.ToDto()).ToList(), page, pageSize, count);
    }

    public async Task<LaboratoryDto> GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await db.Laboratories.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                     ?? throw new NotFoundException("Laboratuvar bulunamadı.");
        return entity.ToDto();
    }

    public async Task<LaboratoryDto> CreateAsync(CreateLaboratoryRequest request, CancellationToken cancellationToken)
    {
        authorization.RequireAdministrator();
        await createValidator.ValidateRequestAsync(request, cancellationToken);
        if (request.FacultyId.HasValue && !await db.Faculties.AnyAsync(x => x.Id == request.FacultyId.Value, cancellationToken))
            throw new NotFoundException("Fakülte bulunamadı.");
        var code = request.Code.Trim().ToUpperInvariant();
        if (await db.Laboratories.IgnoreQueryFilters().AnyAsync(x => x.Code == code, cancellationToken))
            throw new ConflictException("Bu laboratuvar kodu zaten kullanılıyor.");
        var entity = new Laboratory
        {
            FacultyId = request.FacultyId,
            Name = request.Name.Trim(),
            Code = code,
            Building = request.Building?.Trim(),
            Floor = request.Floor?.Trim(),
            Capacity = request.Capacity,
            ComputerCount = request.ComputerCount,
            OperatingSystem = request.OperatingSystem?.Trim(),
            ComputerType = request.ComputerType?.Trim(),
            Description = request.Description?.Trim()
        };
        db.Laboratories.Add(entity);
        await db.SaveChangesAsync(cancellationToken);
        return entity.ToDto();
    }

    public async Task<LaboratoryDto> UpdateAsync(Guid id, UpdateLaboratoryRequest request, CancellationToken cancellationToken)
    {
        authorization.RequireAdministrator();
        await updateValidator.ValidateRequestAsync(request, cancellationToken);
        var entity = await db.Laboratories.SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                     ?? throw new NotFoundException("Laboratuvar bulunamadı.");
        var code = request.Code.Trim().ToUpperInvariant();
        if (await db.Laboratories.AnyAsync(x => x.Id != id && x.Code == code, cancellationToken))
            throw new ConflictException("Bu laboratuvar kodu zaten kullanılıyor.");
        entity.FacultyId = request.FacultyId;
        entity.Name = request.Name.Trim();
        entity.Code = code;
        entity.Building = request.Building?.Trim();
        entity.Floor = request.Floor?.Trim();
        entity.Capacity = request.Capacity;
        entity.ComputerCount = request.ComputerCount;
        entity.OperatingSystem = request.OperatingSystem?.Trim();
        entity.ComputerType = request.ComputerType?.Trim();
        entity.Description = request.Description?.Trim();
        entity.IsActive = request.IsActive;
        await db.SaveChangesAsync(cancellationToken);
        return entity.ToDto();
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        authorization.RequireAdministrator();
        var entity = await db.Laboratories.SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                     ?? throw new NotFoundException("Laboratuvar bulunamadı.");
        entity.IsActive = false;
        db.Laboratories.Remove(entity);
        await db.SaveChangesAsync(cancellationToken);
    }
}

// Lets any authenticated user (not just admins, unlike UsersController) look up course
// instructors by name so the request wizard's "Ders Hocası" field can be a searchable picker
// that auto-fills the instructor's e-mail instead of requiring free-text entry.
public sealed class InstructorDirectoryService(UserManager<ApplicationUser> userManager) : IInstructorDirectoryService
{
    public async Task<IReadOnlyList<InstructorDto>> SearchAsync(string? search, int limit, CancellationToken cancellationToken)
    {
        limit = Math.Clamp(limit, 1, 50);
        var academics = await userManager.GetUsersInRoleAsync(AppRoles.Academic);
        var administrative = await userManager.GetUsersInRoleAsync(AppRoles.Administrative);
        var facultyAuthorized = await userManager.GetUsersInRoleAsync(AppRoles.FacultyAuthorizedUser);
        var administrators = await userManager.GetUsersInRoleAsync(AppRoles.SystemAdministrator);
        IEnumerable<ApplicationUser> candidates = academics.Concat(administrative).Concat(facultyAuthorized).Concat(administrators)
            .Where(x => x.IsActive && !string.IsNullOrWhiteSpace(x.Email))
            .DistinctBy(x => x.Id);

        var term = search?.Trim();
        if (!string.IsNullOrWhiteSpace(term))
        {
            var normalizedTerm = TextNormalization.NormalizeSoftwareName(term);
            candidates = candidates.Where(x =>
                TextNormalization.NormalizeSoftwareName(x.FullName).Contains(normalizedTerm) ||
                x.Email!.Contains(term, StringComparison.OrdinalIgnoreCase));
        }

        return candidates
            .OrderBy(x => x.FullName, StringComparer.Ordinal)
            .Take(limit)
            .Select(x => new InstructorDto(x.Email!, x.FullName))
            .ToList();
    }
}

public sealed class AcademicTermService(AppDbContext db, ResourceAuthorizationService authorization) : IAcademicTermService
{
    public async Task<IReadOnlyList<AcademicTermDto>> GetAsync(CancellationToken cancellationToken)
    {
        var query = db.AcademicTerms.AsNoTracking();
        if (!authorization.IsAdministrator)
            query = query.Where(x => x.IsActive);
        return (await query.OrderByDescending(x => x.StartDate).ToListAsync(cancellationToken))
            .Select(x => x.ToDto()).ToList();
    }

    public async Task<AcademicTermDto> CreateAsync(UpsertAcademicTermRequest request, CancellationToken cancellationToken)
    {
        authorization.RequireAdministrator();
        Validate(request);
        if (request.IsCurrent)
        {
            var currentTerms = await db.AcademicTerms.Where(x => x.IsCurrent).ToListAsync(cancellationToken);
            foreach (var current in currentTerms)
                current.IsCurrent = false;
        }
        var entity = new AcademicTerm();
        Apply(entity, request);
        db.AcademicTerms.Add(entity);
        await db.SaveChangesAsync(cancellationToken);
        return entity.ToDto();
    }

    public async Task<AcademicTermDto> UpdateAsync(Guid id, UpsertAcademicTermRequest request, CancellationToken cancellationToken)
    {
        authorization.RequireAdministrator();
        Validate(request);
        var entity = await db.AcademicTerms.SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                     ?? throw new NotFoundException("Akademik dönem bulunamadı.");
        if (request.IsCurrent)
        {
            var currentTerms = await db.AcademicTerms.Where(x => x.Id != id && x.IsCurrent).ToListAsync(cancellationToken);
            foreach (var current in currentTerms)
                current.IsCurrent = false;
        }
        Apply(entity, request);
        await db.SaveChangesAsync(cancellationToken);
        return entity.ToDto();
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        authorization.RequireAdministrator();
        var entity = await db.AcademicTerms.SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                     ?? throw new NotFoundException("Akademik dönem bulunamadı.");
        entity.IsActive = false;
        await db.SaveChangesAsync(cancellationToken);
    }

    private static void Validate(UpsertAcademicTermRequest x)
    {
        if (string.IsNullOrWhiteSpace(x.AcademicYear) || string.IsNullOrWhiteSpace(x.TermName))
            throw new BusinessRuleException("Akademik yıl ve dönem adı zorunludur.");
        if (x.EndDate < x.StartDate || x.RequestEndDate < x.RequestStartDate)
            throw new BusinessRuleException("Dönem tarih aralıkları geçersiz.");
    }

    private static void Apply(AcademicTerm entity, UpsertAcademicTermRequest x)
    {
        entity.AcademicYear = x.AcademicYear.Trim();
        entity.TermName = x.TermName.Trim();
        entity.StartDate = x.StartDate;
        entity.EndDate = x.EndDate;
        entity.RequestStartDate = x.RequestStartDate;
        entity.RequestEndDate = x.RequestEndDate;
        entity.IsCurrent = x.IsCurrent;
        entity.IsActive = x.IsActive;
    }
}

public sealed class SoftwareService(
    AppDbContext db,
    ResourceAuthorizationService authorization,
    IValidator<UpsertSoftwareRequest> validator) : ISoftwareService
{
    public async Task<PagedResult<SoftwareDto>> GetAsync(int page, int pageSize, string? search, bool activeOnly, CancellationToken cancellationToken)
    {
        (page, pageSize) = FacultyService.Page(page, pageSize);
        var query = db.SoftwareApplications.AsNoTracking();
        if (activeOnly || !authorization.IsAdministrator)
            query = query.Where(x => x.IsActive && x.ApprovalStatus == ApprovalStatus.Approved);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(x => x.Name.ToLower().Contains(term) || (x.Manufacturer != null && x.Manufacturer.ToLower().Contains(term)));
        }
        var count = await query.CountAsync(cancellationToken);
        var items = await query.Include(x => x.Laboratories).OrderBy(x => x.Name).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        return new PagedResult<SoftwareDto>(items.Select(x => x.ToDto()).ToList(), page, pageSize, count);
    }

    public async Task<SoftwareDto> GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        var query = db.SoftwareApplications.AsNoTracking().Where(x => x.Id == id);
        if (!authorization.IsAdministrator)
            query = query.Where(x => x.IsActive && x.ApprovalStatus == ApprovalStatus.Approved);
        return (await query.Include(x => x.Laboratories).SingleOrDefaultAsync(cancellationToken)
                ?? throw new NotFoundException("Program bulunamadı.")).ToDto();
    }

    public async Task<IReadOnlyList<SoftwareDto>> SearchAsync(string query, int limit, CancellationToken cancellationToken)
    {
        var normalized = TextNormalization.NormalizeSoftwareName(query ?? string.Empty);
        if (normalized.Length < 2)
            return [];
        var lowerQuery = (query ?? string.Empty).ToLower();
        var entities = await db.SoftwareApplications.AsNoTracking().Include(x => x.Laboratories)
            .Where(x => x.IsActive && x.ApprovalStatus == ApprovalStatus.Approved &&
                        (x.NormalizedName!.Contains(normalized) || x.Name.ToLower().Contains(lowerQuery)))
            .OrderBy(x => x.Name).Take(Math.Clamp(limit, 1, 50)).ToListAsync(cancellationToken);
        return entities.Select(x => x.ToDto()).ToList();
    }

    public async Task<SoftwareDto> CreateAsync(UpsertSoftwareRequest request, CancellationToken cancellationToken)
    {
        authorization.RequireAdministrator();
        await validator.ValidateRequestAsync(request, cancellationToken);
        var normalized = TextNormalization.NormalizeSoftwareName(request.Name);
        if (await db.SoftwareApplications.IgnoreQueryFilters().AnyAsync(x => x.NormalizedName == normalized, cancellationToken))
            throw new ConflictException("Bu program zaten kayıtlı.");
        var entity = new SoftwareApplication { ApprovalStatus = ApprovalStatus.Approved };
        Apply(entity, request, normalized);
        await SyncLaboratoriesAsync(entity, request.LaboratoryIds, cancellationToken);
        db.SoftwareApplications.Add(entity);
        await db.SaveChangesAsync(cancellationToken);
        return entity.ToDto();
    }

    public async Task<SoftwareDto> UpdateAsync(Guid id, UpsertSoftwareRequest request, CancellationToken cancellationToken)
    {
        authorization.RequireAdministrator();
        await validator.ValidateRequestAsync(request, cancellationToken);
        var entity = await db.SoftwareApplications.Include(x => x.Laboratories).SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                     ?? throw new NotFoundException("Program bulunamadı.");
        var normalized = TextNormalization.NormalizeSoftwareName(request.Name);
        if (await db.SoftwareApplications.AnyAsync(x => x.Id != id && x.NormalizedName == normalized, cancellationToken))
            throw new ConflictException("Bu program adı zaten kayıtlı.");
        Apply(entity, request, normalized);
        await SyncLaboratoriesAsync(entity, request.LaboratoryIds, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        return entity.ToDto();
    }

    // Diffs the join table against the requested lab IDs. New rows are added to both the
    // navigation collection AND the DbSet explicitly — on an already-tracked parent (UpdateAsync),
    // EF's change tracker can otherwise mistake a client-generated-Id child added only via
    // navigation for an existing/unchanged row (see RequestServices.ApplyDetailsAsync for the
    // same pattern and the bug it was fixed for).
    private async Task SyncLaboratoriesAsync(SoftwareApplication entity, IReadOnlyList<Guid>? laboratoryIds, CancellationToken cancellationToken)
    {
        var ids = (laboratoryIds ?? []).Distinct().ToList();
        if (ids.Count > 0)
        {
            var existingCount = await db.Laboratories.CountAsync(x => ids.Contains(x.Id), cancellationToken);
            if (existingCount != ids.Count)
                throw new BusinessRuleException("Seçilen laboratuvarlardan biri veya birkaçı bulunamadı.");
        }
        foreach (var link in entity.Laboratories.Where(x => !ids.Contains(x.LaboratoryId)).ToList())
            entity.Laboratories.Remove(link);
        var currentIds = entity.Laboratories.Select(x => x.LaboratoryId).ToHashSet();
        foreach (var labId in ids.Where(x => !currentIds.Contains(x)))
        {
            var link = new SoftwareApplicationLaboratory { LaboratoryId = labId };
            entity.Laboratories.Add(link);
            db.SoftwareApplicationLaboratories.Add(link);
        }
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        authorization.RequireAdministrator();
        var entity = await db.SoftwareApplications.SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                     ?? throw new NotFoundException("Program bulunamadı.");
        entity.IsActive = false;
        db.SoftwareApplications.Remove(entity);
        await db.SaveChangesAsync(cancellationToken);
    }

    private static void Apply(SoftwareApplication entity, UpsertSoftwareRequest request, string normalized)
    {
        entity.Name = request.Name.Trim();
        entity.NormalizedName = normalized;
        entity.Manufacturer = request.Manufacturer?.Trim();
        entity.Description = request.Description?.Trim();
        entity.DefaultDownloadUrl = request.DefaultDownloadUrl?.Trim();
        entity.LicenseType = request.LicenseType;
        entity.IsPaid = request.IsPaid;
        entity.SupportedOperatingSystems = request.SupportedOperatingSystems?.Trim();
        entity.DefaultLanguage = request.DefaultLanguage?.Trim();
        entity.Version = request.Version?.Trim();
        entity.IsActive = request.IsActive;
    }
}

public sealed class UserAdministrationService(
    AppDbContext db,
    UserManager<ApplicationUser> userManager,
    ResourceAuthorizationService authorization,
    IAuditService auditService) : IUserAdministrationService
{
    // Turkish display labels for the "Roller" column, normalized once so a search for "akademisyen"
    // (what the UI shows) also matches, not just the raw role code ("Academic") stored in AspNetRoles.
    private static readonly Dictionary<string, string> RoleSearchLabels = new()
    {
        [AppRoles.Academic] = TextNormalization.NormalizeSoftwareName("Akademisyen"),
        [AppRoles.Administrative] = TextNormalization.NormalizeSoftwareName("İdari Personel"),
        [AppRoles.FacultyAuthorizedUser] = TextNormalization.NormalizeSoftwareName("Fakülte Yetkilisi"),
        [AppRoles.SystemAdministrator] = TextNormalization.NormalizeSoftwareName("Sistem Yöneticisi"),
    };

    public async Task<PagedResult<UserSummaryDto>> GetAsync(int page, int pageSize, string? search, CancellationToken cancellationToken)
    {
        authorization.RequireAdministrator();
        (page, pageSize) = FacultyService.Page(page, pageSize);
        var query = userManager.Users.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var value = search.Trim().ToLower();
            var normalizedValue = TextNormalization.NormalizeSoftwareName(search);
            var matchingRoleCodes = RoleSearchLabels
                .Where(kv => kv.Key.ToLower().Contains(value) || kv.Value.Contains(normalizedValue))
                .Select(kv => kv.Key)
                .ToList();
            var matchingUserIds = matchingRoleCodes.Count > 0
                ? await db.UserRoles.AsNoTracking()
                    .Join(db.Roles.AsNoTracking(), ur => ur.RoleId, r => r.Id, (ur, r) => new { ur.UserId, r.Name })
                    .Where(x => matchingRoleCodes.Contains(x.Name))
                    .Select(x => x.UserId)
                    .ToListAsync(cancellationToken)
                : [];
            query = query.Where(x =>
                x.Email!.ToLower().Contains(value) ||
                x.FullName.ToLower().Contains(value) ||
                (x.Department != null && x.Department.ToLower().Contains(value)) ||
                (x.Faculty != null && x.Faculty.Name.ToLower().Contains(value)) ||
                matchingUserIds.Contains(x.Id));
        }
        var count = await query.CountAsync(cancellationToken);
        var users = await query.OrderBy(x => x.FullName).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        var userIds = users.Select(x => x.Id).ToList();
        var permissionRows = await db.UserFacultyPermissions.AsNoTracking()
            .Where(x => userIds.Contains(x.UserId) && x.Faculty.IsActive)
            .OrderBy(x => x.Faculty.Name)
            .Select(x => new { x.UserId, x.FacultyId, x.Faculty.Name, x.Permissions })
            .ToListAsync(cancellationToken);
        var permissionsByUser = permissionRows
            .GroupBy(x => x.UserId)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyList<AuthorizedFacultyDto>)group
                    .Select(x => new AuthorizedFacultyDto(x.FacultyId, x.Name, (int)x.Permissions))
                    .ToList());
        var result = new List<UserSummaryDto>(users.Count);
        foreach (var user in users)
            result.Add(new UserSummaryDto(
                user.Id,
                user.Email ?? string.Empty,
                user.FullName,
                user.FacultyId,
                user.Department,
                user.IsActive,
                (await userManager.GetRolesAsync(user)).ToList(),
                permissionsByUser.GetValueOrDefault(user.Id) ?? []));
        return new PagedResult<UserSummaryDto>(result, page, pageSize, count);
    }

    public async Task<UserSummaryDto> CreateAsync(CreateUserRequest request, CancellationToken cancellationToken)
    {
        authorization.RequireAdministrator();
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.FullName))
            throw new BusinessRuleException("E-posta ve ad soyad zorunludur.");
        if (request.Roles.Any(x => !AppRoles.All.Contains(x)))
            throw new BusinessRuleException("Geçersiz rol.");
        var user = new ApplicationUser
        {
            UserName = request.Email.Trim(),
            Email = request.Email.Trim(),
            EmailConfirmed = true,
            FullName = request.FullName.Trim(),
            FacultyId = request.FacultyId,
            Department = string.IsNullOrWhiteSpace(request.Department) ? null : request.Department.Trim()
        };
        var result = await userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
            throw new BusinessRuleException(string.Join(" ", result.Errors.Select(x => x.Description)));
        if (request.Roles.Count > 0)
            await userManager.AddToRolesAsync(user, request.Roles.Distinct());
        await auditService.WriteAsync(AuditActionType.UserCreated, nameof(ApplicationUser), user.Id,
            System.Text.Json.JsonSerializer.Serialize(new { user.Email, user.FullName, request.Roles }),
            cancellationToken: cancellationToken);
        return new UserSummaryDto(
            user.Id,
            user.Email!,
            user.FullName,
            user.FacultyId,
            user.Department,
            user.IsActive,
            (await userManager.GetRolesAsync(user)).ToList(),
            []);
    }

    public async Task<UserSummaryDto> UpdateAsync(string id, UpdateUserRequest request, CancellationToken cancellationToken)
    {
        authorization.RequireAdministrator();
        var user = await userManager.FindByIdAsync(id) ?? throw new NotFoundException("Kullanıcı bulunamadı.");
        if (request.Roles.Any(x => !AppRoles.All.Contains(x)))
            throw new BusinessRuleException("Geçersiz rol.");
        user.FullName = request.FullName.Trim();
        user.FacultyId = request.FacultyId;
        user.Department = string.IsNullOrWhiteSpace(request.Department) ? null : request.Department.Trim();
        user.IsActive = request.IsActive;
        user.UpdatedAt = DateTimeOffset.UtcNow;
        var result = await userManager.UpdateAsync(user);
        if (!result.Succeeded)
            throw new BusinessRuleException(string.Join(" ", result.Errors.Select(x => x.Description)));
        var existing = await userManager.GetRolesAsync(user);
        await userManager.RemoveFromRolesAsync(user, existing.Except(request.Roles));
        await userManager.AddToRolesAsync(user, request.Roles.Except(existing));
        await auditService.WriteAsync(AuditActionType.UserRoleChanged, nameof(ApplicationUser), user.Id,
            System.Text.Json.JsonSerializer.Serialize(new { Roles = request.Roles }),
            cancellationToken: cancellationToken);
        return new UserSummaryDto(
            user.Id,
            user.Email!,
            user.FullName,
            user.FacultyId,
            user.Department,
            user.IsActive,
            (await userManager.GetRolesAsync(user)).ToList(),
            await GetAuthorizedFacultiesAsync(user.Id, cancellationToken));
    }

    public async Task SetFacultyPermissionAsync(string id, SetFacultyPermissionRequest request, CancellationToken cancellationToken)
    {
        authorization.RequireAdministrator();
        if (!await userManager.Users.AnyAsync(x => x.Id == id, cancellationToken))
            throw new NotFoundException("Kullanıcı bulunamadı.");
        if (!await db.Faculties.AnyAsync(x => x.Id == request.FacultyId, cancellationToken))
            throw new NotFoundException("Fakülte bulunamadı.");
        var entity = await db.UserFacultyPermissions.SingleOrDefaultAsync(x => x.UserId == id && x.FacultyId == request.FacultyId, cancellationToken);
        if (request.Permissions == FacultyPermission.None)
        {
            if (entity is not null)
                db.UserFacultyPermissions.Remove(entity);
        }
        else if (entity is null)
        {
            db.UserFacultyPermissions.Add(new UserFacultyPermission { UserId = id, FacultyId = request.FacultyId, Permissions = request.Permissions });
        }
        else
        {
            entity.Permissions = request.Permissions;
        }
        await db.SaveChangesAsync(cancellationToken);
        await auditService.WriteAsync(AuditActionType.UserFacultyPermissionChanged, nameof(UserFacultyPermission), id,
            System.Text.Json.JsonSerializer.Serialize(new { request.FacultyId, request.Permissions }),
            cancellationToken: cancellationToken);
    }

    private async Task<IReadOnlyList<AuthorizedFacultyDto>> GetAuthorizedFacultiesAsync(
        string userId,
        CancellationToken cancellationToken)
    {
        return await db.UserFacultyPermissions.AsNoTracking()
            .Where(x => x.UserId == userId && x.Faculty.IsActive)
            .OrderBy(x => x.Faculty.Name)
            .Select(x => new AuthorizedFacultyDto(x.FacultyId, x.Faculty.Name, (int)x.Permissions))
            .ToListAsync(cancellationToken);
    }
}

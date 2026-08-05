using FbuLabSoftware.Application;
using FbuLabSoftware.Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace FbuLabSoftware.Infrastructure;

public sealed class ApplicationUser : IdentityUser
{
    public string FullName { get; set; } = string.Empty;
    public Guid? FacultyId { get; set; }
    public Faculty? Faculty { get; set; }
    public string? Department { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAt { get; set; }
    public string? DirectorySource { get; set; }
    public DateTimeOffset? DirectorySyncedAt { get; set; }
    public ICollection<UserFacultyPermission> FacultyPermissions { get; set; } = [];
    public ICollection<RefreshToken> RefreshTokens { get; set; } = [];
    public ICollection<Notification> Notifications { get; set; } = [];
    public ICollection<SoftwareRequest> SoftwareRequests { get; set; } = [];
    public ICollection<SoftwareRequestRevision> RequestRevisions { get; set; } = [];
}

public sealed class AppDbContext : IdentityDbContext<ApplicationUser, IdentityRole, string>
{
    private readonly ICurrentUserService? _currentUser;

    public AppDbContext(DbContextOptions<AppDbContext> options, ICurrentUserService? currentUser = null)
        : base(options) => _currentUser = currentUser;

    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Faculty> Faculties => Set<Faculty>();
    public DbSet<UserFacultyPermission> UserFacultyPermissions => Set<UserFacultyPermission>();
    public DbSet<AcademicTerm> AcademicTerms => Set<AcademicTerm>();
    public DbSet<AcademicTermExtension> AcademicTermExtensions => Set<AcademicTermExtension>();
    public DbSet<Laboratory> Laboratories => Set<Laboratory>();
    public DbSet<Course> Courses => Set<Course>();
    public DbSet<SoftwareApplication> SoftwareApplications => Set<SoftwareApplication>();
    public DbSet<SoftwareApplicationLaboratory> SoftwareApplicationLaboratories => Set<SoftwareApplicationLaboratory>();
    public DbSet<SoftwareSuggestion> SoftwareSuggestions => Set<SoftwareSuggestion>();
    public DbSet<SoftwareRequest> SoftwareRequests => Set<SoftwareRequest>();
    public DbSet<SoftwareRequestItem> SoftwareRequestItems => Set<SoftwareRequestItem>();
    public DbSet<SoftwarePlugin> SoftwarePlugins => Set<SoftwarePlugin>();
    public DbSet<CourseSchedule> CourseSchedules => Set<CourseSchedule>();
    public DbSet<RequestLaboratory> RequestLaboratories => Set<RequestLaboratory>();
    public DbSet<RequestAssistant> RequestAssistants => Set<RequestAssistant>();
    public DbSet<UploadedFile> UploadedFiles => Set<UploadedFile>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<SoftwareRequestRevision> SoftwareRequestRevisions => Set<SoftwareRequestRevision>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<SystemSetting> SystemSettings => Set<SystemSetting>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<ApplicationUser>().ToTable("Users");
        builder.Entity<IdentityRole>().ToTable("Roles");
        builder.Entity<IdentityUserRole<string>>().ToTable("UserRoles");
        builder.Entity<IdentityUserClaim<string>>().ToTable("UserClaims");
        builder.Entity<IdentityUserLogin<string>>().ToTable("UserLogins");
        builder.Entity<IdentityRoleClaim<string>>().ToTable("RoleClaims");
        builder.Entity<IdentityUserToken<string>>().ToTable("UserTokens");

        builder.Entity<ApplicationUser>(e =>
        {
            e.Property(x => x.FullName).HasMaxLength(250).IsRequired();
            e.Property(x => x.Department).HasMaxLength(250);
            e.Property(x => x.DirectorySource).HasMaxLength(20);
            e.HasOne(x => x.Faculty).WithMany().HasForeignKey(x => x.FacultyId).OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<Faculty>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(250).IsRequired();
            e.Property(x => x.Code).HasMaxLength(50).IsRequired();
            e.HasIndex(x => x.Code).IsUnique();
            e.HasQueryFilter(x => !x.IsDeleted);
        });
        builder.Entity<UserFacultyPermission>(e =>
        {
            e.HasIndex(x => new { x.UserId, x.FacultyId }).IsUnique();
            e.HasOne(x => x.Faculty).WithMany().HasForeignKey(x => x.FacultyId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne<ApplicationUser>().WithMany(x => x.FacultyPermissions)
                .HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        });
        builder.Entity<AcademicTerm>(e =>
        {
            e.Property(x => x.AcademicYear).HasMaxLength(20).IsRequired();
            e.Property(x => x.TermName).HasMaxLength(50).IsRequired();
            e.HasIndex(x => new { x.AcademicYear, x.TermName }).IsUnique();
        });
        builder.Entity<AcademicTermExtension>(e =>
        {
            e.HasOne(x => x.AcademicTerm).WithMany(x => x.Extensions).HasForeignKey(x => x.AcademicTermId);
            e.HasIndex(x => new { x.AcademicTermId, x.UserId, x.FacultyId });
        });
        builder.Entity<Laboratory>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(250).IsRequired();
            e.Property(x => x.Code).HasMaxLength(50).IsRequired();
            e.HasIndex(x => x.Code).IsUnique();
            e.HasOne(x => x.Faculty).WithMany(x => x.Laboratories).HasForeignKey(x => x.FacultyId).OnDelete(DeleteBehavior.SetNull);
            e.HasQueryFilter(x => !x.IsDeleted);
        });
        builder.Entity<Course>(e =>
        {
            e.Property(x => x.Code).HasMaxLength(50).IsRequired();
            e.Property(x => x.Name).HasMaxLength(250).IsRequired();
            e.HasIndex(x => new { x.FacultyId, x.Code }).IsUnique();
            e.HasOne(x => x.Faculty).WithMany().HasForeignKey(x => x.FacultyId).OnDelete(DeleteBehavior.Restrict);
            e.HasQueryFilter(x => !x.IsDeleted);
        });
        builder.Entity<SoftwareApplication>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(250).IsRequired();
            e.Property(x => x.NormalizedName).HasMaxLength(250);
            e.HasIndex(x => x.NormalizedName).IsUnique();
            e.HasQueryFilter(x => !x.IsDeleted);
        });
        builder.Entity<SoftwareApplicationLaboratory>(e =>
        {
            e.HasIndex(x => new { x.SoftwareApplicationId, x.LaboratoryId }).IsUnique();
            e.HasOne(x => x.SoftwareApplication).WithMany(x => x.Laboratories).HasForeignKey(x => x.SoftwareApplicationId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Laboratory).WithMany().HasForeignKey(x => x.LaboratoryId).OnDelete(DeleteBehavior.Restrict);
        });
        builder.Entity<SoftwareSuggestion>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(250).IsRequired();
            e.Property(x => x.NormalizedName).HasMaxLength(250).IsRequired();
            e.HasIndex(x => new { x.NormalizedName, x.Status });
            e.HasOne(x => x.ApprovedSoftware).WithMany().HasForeignKey(x => x.ApprovedSoftwareId).OnDelete(DeleteBehavior.SetNull);
        });
        builder.Entity<SoftwareRequest>(e =>
        {
            e.Property(x => x.CourseCode).HasMaxLength(50).IsRequired();
            e.Property(x => x.CourseName).HasMaxLength(250).IsRequired();
            e.Property(x => x.SectionCount).HasDefaultValue(1).IsRequired();
            e.Property(x => x.OwnedSections).HasMaxLength(50).HasDefaultValue("1").IsRequired();
            e.Property(x => x.InstructorEmail).HasMaxLength(256).IsRequired();
            e.Property(x => x.OtherLaboratoryName).HasMaxLength(250);
            e.HasIndex(x => new { x.OwnerUserId, x.Status });
            e.HasIndex(x => new { x.FacultyId, x.AcademicTermId, x.Status });
            e.HasOne(x => x.Faculty).WithMany().HasForeignKey(x => x.FacultyId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.AcademicTerm).WithMany().HasForeignKey(x => x.AcademicTermId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Course).WithMany().HasForeignKey(x => x.CourseId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne<ApplicationUser>().WithMany(x => x.SoftwareRequests)
                .HasForeignKey(x => x.OwnerUserId).OnDelete(DeleteBehavior.Restrict);
            e.HasQueryFilter(x => !x.IsDeleted);
        });
        builder.Entity<SoftwareRequestItem>(e =>
        {
            e.HasOne(x => x.SoftwareRequest).WithMany(x => x.Items).HasForeignKey(x => x.SoftwareRequestId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.SoftwareApplication).WithMany().HasForeignKey(x => x.SoftwareApplicationId).OnDelete(DeleteBehavior.Restrict);
            e.Property(x => x.OtherSoftwareName).HasMaxLength(250);
        });
        builder.Entity<SoftwarePlugin>(e =>
            e.HasOne(x => x.SoftwareRequestItem).WithMany(x => x.Plugins).HasForeignKey(x => x.SoftwareRequestItemId).OnDelete(DeleteBehavior.Cascade));
        builder.Entity<CourseSchedule>(e =>
            e.HasOne(x => x.SoftwareRequest).WithMany(x => x.Schedules).HasForeignKey(x => x.SoftwareRequestId).OnDelete(DeleteBehavior.Cascade));
        builder.Entity<RequestLaboratory>(e =>
        {
            e.HasIndex(x => new { x.SoftwareRequestId, x.LaboratoryId }).IsUnique();
            e.HasOne(x => x.SoftwareRequest).WithMany(x => x.RequestLaboratories).HasForeignKey(x => x.SoftwareRequestId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Laboratory).WithMany().HasForeignKey(x => x.LaboratoryId).OnDelete(DeleteBehavior.Restrict);
        });
        builder.Entity<RequestAssistant>(e =>
        {
            e.Property(x => x.FullName).HasMaxLength(250).IsRequired();
            e.Property(x => x.Email).HasMaxLength(256).IsRequired();
            e.HasOne(x => x.SoftwareRequest).WithMany(x => x.Assistants).HasForeignKey(x => x.SoftwareRequestId).OnDelete(DeleteBehavior.Cascade);
        });
        builder.Entity<RefreshToken>(e =>
        {
            e.Property(x => x.TokenHash).HasMaxLength(128).IsRequired();
            e.Property(x => x.FamilyId).HasMaxLength(100).IsRequired();
            e.HasIndex(x => x.TokenHash).IsUnique();
            e.HasIndex(x => new { x.UserId, x.FamilyId });
            e.HasOne<ApplicationUser>().WithMany(x => x.RefreshTokens)
                .HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        });
        builder.Entity<UploadedFile>(e =>
            e.HasOne(x => x.SoftwareRequest).WithMany(x => x.UploadedFiles)
                .HasForeignKey(x => x.SoftwareRequestId).OnDelete(DeleteBehavior.Cascade));
        builder.Entity<Notification>(e =>
        {
            e.HasIndex(x => new { x.UserId, x.IsRead, x.CreatedAt });
            e.Property(x => x.Title).HasMaxLength(250).IsRequired();
            e.HasOne<ApplicationUser>().WithMany(x => x.Notifications)
                .HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        });
        builder.Entity<SoftwareRequestRevision>(e =>
        {
            e.Property(x => x.ChangeType).HasConversion<string>().HasMaxLength(50).IsRequired();
            e.Property(x => x.SnapshotJson).IsRequired();
            e.HasIndex(x => new { x.SoftwareRequestId, x.Version }).IsUnique();
            e.HasOne(x => x.SoftwareRequest).WithMany(x => x.Revisions)
                .HasForeignKey(x => x.SoftwareRequestId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<ApplicationUser>().WithMany(x => x.RequestRevisions)
                .HasForeignKey(x => x.ActorUserId).OnDelete(DeleteBehavior.Restrict);
        });
        builder.Entity<AuditLog>(e => e.HasIndex(x => new { x.EntityType, x.EntityId, x.CreatedAt }));
        builder.Entity<SystemSetting>(e =>
        {
            e.Property(x => x.Key).HasMaxLength(150).IsRequired();
            e.HasIndex(x => x.Key).IsUnique();
        });
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ApplyAuditAndSoftDelete();
        return base.SaveChangesAsync(cancellationToken);
    }

    public override int SaveChanges()
    {
        ApplyAuditAndSoftDelete();
        return base.SaveChanges();
    }

    private void ApplyAuditAndSoftDelete()
    {
        var now = DateTimeOffset.UtcNow;
        var userId = _currentUser?.UserId;
        var pendingAudits = new List<AuditLog>();
        foreach (var entry in ChangeTracker.Entries().ToArray())
        {
            if (entry.Entity is SoftwareRequestRevision &&
                entry.State is EntityState.Modified or EntityState.Deleted)
                throw new InvalidOperationException("Talep geçmişi kayıtları değiştirilemez veya silinemez.");
            if (entry.Entity is AuditLog or SoftwareRequestRevision ||
                entry.State is EntityState.Detached or EntityState.Unchanged)
                continue;

            var wasDeleted = entry.State == EntityState.Deleted;
            if (wasDeleted && entry.Entity is ISoftDeletable soft)
            {
                entry.State = EntityState.Modified;
                soft.IsDeleted = true;
                soft.DeletedAt = now;
            }

            if (entry.Entity is AuditableEntity auditable)
            {
                if (entry.State == EntityState.Added)
                {
                    auditable.CreatedAt = now;
                    auditable.CreatedByUserId ??= userId;
                }
                else if (entry.State == EntityState.Modified)
                {
                    auditable.UpdatedAt = now;
                    auditable.UpdatedByUserId = userId;
                }
            }

            var action = wasDeleted ? AuditActionType.Deleted : entry.State switch
            {
                EntityState.Added => AuditActionType.Created,
                EntityState.Modified => AuditActionType.Updated,
                EntityState.Deleted => AuditActionType.Deleted,
                _ => (AuditActionType?)null
            };
            if (action is null || entry.Entity is RefreshToken)
                continue;
            var changedProperties = entry.Properties
                .Where(x => x.IsModified && !IsSensitiveProperty(x.Metadata.Name))
                .ToDictionary(x => x.Metadata.Name, x => new { Old = x.OriginalValue, New = x.CurrentValue });
            pendingAudits.Add(new AuditLog
            {
                UserId = userId,
                UserName = _currentUser?.Email,
                ActionType = action.Value,
                EntityType = entry.Metadata.ClrType.Name,
                EntityId = entry.Entity is Entity entity ? entity.Id.ToString() : null,
                OldValues = changedProperties.Count == 0 ? null : System.Text.Json.JsonSerializer.Serialize(changedProperties.ToDictionary(x => x.Key, x => x.Value.Old)),
                NewValues = changedProperties.Count == 0 ? null : System.Text.Json.JsonSerializer.Serialize(changedProperties.ToDictionary(x => x.Key, x => x.Value.New)),
                IpAddress = SanitizeLogValue(_currentUser?.IpAddress, 64),
                UserAgent = SanitizeLogValue(_currentUser?.UserAgent, 500),
                CreatedAt = now
            });
        }
        if (pendingAudits.Count > 0)
            AuditLogs.AddRange(pendingAudits);
    }

    private static string? SanitizeLogValue(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;
        var cleaned = value.Replace("\r", string.Empty).Replace("\n", string.Empty);
        return cleaned[..Math.Min(cleaned.Length, maxLength)];
    }

    private static bool IsSensitiveProperty(string name) =>
        name.Contains("Password", StringComparison.OrdinalIgnoreCase) ||
        name.Contains("Token", StringComparison.OrdinalIgnoreCase) ||
        name.Contains("SecurityStamp", StringComparison.OrdinalIgnoreCase) ||
        name.Contains("Email", StringComparison.OrdinalIgnoreCase) ||
        name.Contains("Content", StringComparison.OrdinalIgnoreCase);
}

public sealed class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var current = Directory.GetCurrentDirectory();
        var candidates = new[]
        {
            Path.Combine(current, "backend", "src", "FbuLabSoftware.Api"),
            Path.Combine(current, "..", "FbuLabSoftware.Api"),
            Path.Combine(current, "src", "FbuLabSoftware.Api"),
            current
        }.Select(Path.GetFullPath);
        var basePath = candidates.First(path => File.Exists(Path.Combine(path, "appsettings.json")));
        var configuration = new ConfigurationBuilder()
            .SetBasePath(basePath)
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile("appsettings.Development.json", optional: true)
            .AddEnvironmentVariables()
            .Build();
        var connection = configuration.GetConnectionString("DefaultConnection")
                         ?? throw new InvalidOperationException("DefaultConnection tanımlı değil.");
        var provider = configuration["Database:Provider"] ?? "SqlServer";
        var builder = new DbContextOptionsBuilder<AppDbContext>();
        if (provider.Equals("Npgsql", StringComparison.OrdinalIgnoreCase) ||
            provider.Equals("PostgreSql", StringComparison.OrdinalIgnoreCase))
            builder.UseNpgsql(connection);
        else
            builder.UseSqlServer(connection);
        return new AppDbContext(builder.Options);
    }
}

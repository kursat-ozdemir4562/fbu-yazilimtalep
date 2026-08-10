using System.Globalization;
using System.Net;
using System.Net.Mail;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using ClosedXML.Excel;
using FbuLabSoftware.Application;
using FbuLabSoftware.Domain;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FbuLabSoftware.Infrastructure;

public sealed class NotificationService(AppDbContext db, ICurrentUserService currentUser) : INotificationService
{
    private string UserId => currentUser.UserId ?? throw new UnauthorizedException();

    public async Task<PagedResult<NotificationDto>> GetAsync(
        int page,
        int pageSize,
        bool? unread,
        CancellationToken cancellationToken)
    {
        (page, pageSize) = FacultyService.Page(page, pageSize);
        var query = db.Notifications.AsNoTracking().Where(x => x.UserId == UserId);
        if (unread == true)
            query = query.Where(x => !x.IsRead);

        var count = await query.CountAsync(cancellationToken);
        var items = await query.OrderByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new NotificationDto(x.Id, x.Type, x.Title, x.Message, x.Link, x.IsRead, x.CreatedAt, x.ReadAt))
            .ToListAsync(cancellationToken);
        return new PagedResult<NotificationDto>(items, page, pageSize, count);
    }

    public async Task ReadAsync(Guid id, CancellationToken cancellationToken)
    {
        var notification = await db.Notifications.SingleOrDefaultAsync(x => x.Id == id && x.UserId == UserId, cancellationToken)
                           ?? throw new NotFoundException("Bildirim bulunamadı.");
        notification.IsRead = true;
        notification.ReadAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task ReadAllAsync(CancellationToken cancellationToken)
    {
        var notifications = await db.Notifications.Where(x => x.UserId == UserId && !x.IsRead)
            .ToListAsync(cancellationToken);
        var now = DateTimeOffset.UtcNow;
        foreach (var notification in notifications)
        {
            notification.IsRead = true;
            notification.ReadAt = now;
        }
        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class AuditService(AppDbContext db, ICurrentUserService currentUser) : IAuditService
{
    public async Task<PagedResult<AuditLogDto>> GetAsync(
        int page,
        int pageSize,
        string? entityType,
        string? search,
        AuditActionType? actionType,
        CancellationToken cancellationToken)
    {
        if (!currentUser.IsInRole(AppRoles.SystemAdministrator))
            throw new ForbiddenException();
        (page, pageSize) = FacultyService.Page(page, pageSize);
        var query = db.AuditLogs.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(entityType))
        {
            var entityTypeFilter = entityType.Trim();
            query = query.Where(x => x.EntityType == entityTypeFilter);
        }
        if (actionType.HasValue)
            query = query.Where(x => x.ActionType == actionType.Value);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchTerm = search.Trim().ToLower();
            query = query.Where(x =>
                x.EntityType.ToLower().Contains(searchTerm) ||
                x.UserId != null && x.UserId.ToLower().Contains(searchTerm) ||
                x.UserName != null && x.UserName.ToLower().Contains(searchTerm) ||
                x.EntityId != null && x.EntityId.ToLower().Contains(searchTerm) ||
                x.OldValues != null && x.OldValues.ToLower().Contains(searchTerm) ||
                x.NewValues != null && x.NewValues.ToLower().Contains(searchTerm));
        }
        var count = await query.CountAsync(cancellationToken);
        var items = await query.OrderByDescending(x => x.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new AuditLogDto(x.Id, x.UserId, x.UserName, x.ActionType, x.EntityType, x.EntityId,
                x.OldValues, x.NewValues, x.IpAddress, x.UserAgent, x.CreatedAt))
            .ToListAsync(cancellationToken);
        return new PagedResult<AuditLogDto>(items, page, pageSize, count);
    }

    public async Task WriteAsync(
        AuditActionType action,
        string entityType,
        string? entityId,
        string? newValues = null,
        AuditActorIdentity? actor = null,
        CancellationToken cancellationToken = default)
    {
        if (actor is not null &&
            (string.IsNullOrWhiteSpace(actor.UserId) || string.IsNullOrWhiteSpace(actor.UserName)))
            throw new ArgumentException("Audit actor kimliği eksiksiz olmalıdır.", nameof(actor));
        db.AuditLogs.Add(new AuditLog
        {
            UserId = actor?.UserId ?? currentUser.UserId,
            UserName = actor?.UserName ?? currentUser.Email,
            ActionType = action,
            EntityType = entityType,
            EntityId = entityId,
            NewValues = newValues,
            IpAddress = Clean(currentUser.IpAddress, 64),
            UserAgent = Clean(currentUser.UserAgent, 500)
        });
        await db.SaveChangesAsync(cancellationToken);
    }

    private static string? Clean(string? value, int length)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;
        value = value.Replace("\r", string.Empty).Replace("\n", string.Empty);
        return value[..Math.Min(value.Length, length)];
    }
}

public sealed class ReportService(
    AppDbContext db,
    IRequestService requestService,
    ResourceAuthorizationService authorization,
    IAuditService auditService,
    IConfiguration configuration) : IReportService
{
    public async Task<ExportFile> RequestsAsync(RequestQuery query, string format, CancellationToken cancellationToken)
    {
        var all = await ReportPaging.ReadAllAsync(
            MaxRows(),
            (page, pageSize, token) => requestService.GetAsync(
                query with { Page = page, PageSize = pageSize },
                false,
                token,
                FacultyPermission.Report),
            cancellationToken);
        var rows = all.Select(x => new[]
        {
            x.CourseCode, x.CourseName, x.SectionCount.ToString(CultureInfo.InvariantCulture),
            string.Join(", ", x.OwnedSections), x.HasOtherSectionInstructor ? "Evet" : "Hayır",
            x.InstructorEmail, x.OwnerFullName, x.OwnerEmail, x.FacultyName, x.AcademicTerm,
            x.Status.ToString(), x.StudentCount.ToString(CultureInfo.InvariantCulture),
            x.HasCapacityWarning ? "Evet" : "Hayır", x.Description ?? "",
            string.Join("; ", x.Items.Select(ItemSummary)),
            string.Join("; ", x.Items.Select(PluginsSummary).Where(s => s.Length > 0)),
            string.Join("; ", x.Items.Select(DownloadSummary).Where(s => s.Length > 0)),
            string.Join("; ", x.Schedules.Select(ScheduleSummary)),
            string.Join("; ", x.Laboratories.Select(LaboratorySummary)
                .Concat(string.IsNullOrWhiteSpace(x.OtherLaboratoryName) ? [] : [$"{x.OtherLaboratoryName} (listede yok)"])),
            string.Join("; ", x.Assistants.Select(AssistantSummary)),
            x.CreatedAt.ToString("O")
        });
        var file = ExportBuilder.Build(format, "talepler",
            [
                "Ders Kodu", "Ders Adı", "Section Sayısı", "Sorumlu Olunan Section'lar", "Diğer Section Hocası Var mı",
                "Ders Hocası E-posta", "Talebi Açan", "Talebi Açan E-posta", "Fakülte", "Akademik Dönem", "Durum",
                "Öğrenci Sayısı", "Kapasite Uyarısı", "Talep Açıklaması", "Programlar", "Eklentiler",
                "İndirme Bağlantıları", "Ders Günü ve Saatleri", "Laboratuvarlar", "Asistanlar", "Oluşturulma"
            ], rows);
        await auditService.WriteAsync(AuditActionType.ReportDownloaded, "RequestReport", null, cancellationToken: cancellationToken);
        return file;
    }

    public async Task<ExportFile> ScheduleAsync(string format, CancellationToken cancellationToken)
    {
        var entries = await requestService.GetScheduleAsync(cancellationToken);
        ReportPaging.EnsureWithinLimit(entries.Count, MaxRows());
        var rows = entries.Select(x => new[]
        {
            x.CourseCode, x.CourseName, string.Join(", ", x.OwnedSections), x.InstructorEmail,
            x.OwnerFullName, x.OwnerEmail, x.Status.ToString(), TurkishDayName(x.DayOfWeek),
            x.StartTime.ToString("HH:mm"), x.EndTime.ToString("HH:mm"), x.LaboratoryName
        });
        var file = ExportBuilder.Build(format, "ders-programi",
            [
                "Ders Kodu", "Ders Adı", "Section'lar", "Ders Hocası E-posta", "Talebi Açan",
                "Talebi Açan E-posta", "Durum", "Gün", "Başlangıç", "Bitiş", "Laboratuvar"
            ], rows);
        await auditService.WriteAsync(AuditActionType.ReportDownloaded, "ScheduleReport", null, cancellationToken: cancellationToken);
        return file;
    }

    private static string ItemSummary(SoftwareRequestItemDto item)
    {
        var version = string.IsNullOrWhiteSpace(item.RequestedVersion) ? "-" : item.RequestedVersion;
        var language = string.Equals(item.Language, "Diğer", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(item.OtherLanguage)
            ? item.OtherLanguage
            : item.Language ?? "-";
        return $"{item.SoftwareName} (Sürüm: {version}, Lisans: {item.LicenseType}, Dil: {language})";
    }

    private static string PluginsSummary(SoftwareRequestItemDto item)
    {
        if (item.NoPluginRequired || item.Plugins.Count == 0)
            return "";
        var plugins = string.Join(", ", item.Plugins.Select(p =>
            string.IsNullOrWhiteSpace(p.Version) ? p.Name : $"{p.Name} v{p.Version}"));
        return $"{item.SoftwareName}: {plugins}";
    }

    private static string DownloadSummary(SoftwareRequestItemDto item) =>
        string.IsNullOrWhiteSpace(item.DownloadUrl) ? "" : $"{item.SoftwareName}: {item.DownloadUrl}";

    private static string ScheduleSummary(CourseScheduleDto schedule) =>
        $"{TurkishDayName(schedule.DayOfWeek)} {schedule.StartTime:HH:mm}-{schedule.EndTime:HH:mm}";

    private static string LaboratorySummary(RequestLaboratoryDto lab) =>
        $"{lab.Name} (Kapasite: {lab.Capacity}, Bilgisayar: {lab.ComputerCount})";

    private static string AssistantSummary(RequestAssistantDto assistant) =>
        $"{assistant.FullName} <{assistant.Email}>";

    private static readonly Dictionary<DayOfWeek, string> TurkishDayNames = new()
    {
        [DayOfWeek.Monday] = "Pazartesi",
        [DayOfWeek.Tuesday] = "Salı",
        [DayOfWeek.Wednesday] = "Çarşamba",
        [DayOfWeek.Thursday] = "Perşembe",
        [DayOfWeek.Friday] = "Cuma",
        [DayOfWeek.Saturday] = "Cumartesi",
        [DayOfWeek.Sunday] = "Pazar",
    };

    private static string TurkishDayName(DayOfWeek day) => TurkishDayNames[day];

    public async Task<ExportFile> SoftwareAsync(string format, CancellationToken cancellationToken)
    {
        var maxRows = MaxRows();
        var requestRows = await ReportPaging.ReadAllAsync(
            maxRows,
            (page, pageSize, token) => requestService.GetAsync(
                new RequestQuery(Page: page, PageSize: pageSize),
                false,
                token,
                FacultyPermission.Report),
            cancellationToken);
        var ids = requestRows.SelectMany(x => x.Items).Select(x => x.SoftwareApplicationId).Distinct().ToList();
        var entities = await db.SoftwareApplications.AsNoTracking().Where(x => ids.Contains(x.Id))
            .OrderBy(x => x.Name).Take(maxRows + 1).ToListAsync(cancellationToken);
        ReportPaging.EnsureWithinLimit(entities.Count, maxRows);
        var rows = entities.Select(x => new[] { x.Name, x.Manufacturer ?? "", x.Version ?? "", x.LicenseType.ToString(), x.IsPaid ? "Evet" : "Hayır", x.DefaultDownloadUrl ?? "" });
        var file = ExportBuilder.Build(format, "programlar", ["Program", "Üretici", "Sürüm", "Lisans", "Ücretli", "İndirme Adresi"], rows);
        await auditService.WriteAsync(AuditActionType.ReportDownloaded, "SoftwareReport", null, cancellationToken: cancellationToken);
        return file;
    }

    public async Task<ExportFile> FacultiesAsync(string format, CancellationToken cancellationToken)
    {
        var maxRows = MaxRows();
        var allowed = await authorization.AllowedFacultyIdsAsync(FacultyPermission.Report, cancellationToken);
        var entities = await db.Faculties.AsNoTracking()
            .Where(x => authorization.IsAdministrator || allowed.Contains(x.Id))
            .OrderBy(x => x.Name).Take(maxRows + 1).ToListAsync(cancellationToken);
        ReportPaging.EnsureWithinLimit(entities.Count, maxRows);
        var rows = entities.Select(x => new[] { x.Code, x.Name, x.IsActive ? "Aktif" : "Pasif" });
        var file = ExportBuilder.Build(format, "fakulteler", ["Kod", "Fakülte", "Durum"], rows);
        await auditService.WriteAsync(AuditActionType.ReportDownloaded, "FacultyReport", null, cancellationToken: cancellationToken);
        return file;
    }

    public async Task<ExportFile> LaboratoriesAsync(string format, CancellationToken cancellationToken)
    {
        var maxRows = MaxRows();
        // Laboratories are a shared university resource, not scoped to a faculty (see
        // LaboratoryService.GetAsync) — every authenticated caller sees the same full list.
        var entities = await db.Laboratories.AsNoTracking()
            .OrderBy(x => x.Name).Take(maxRows + 1).ToListAsync(cancellationToken);
        ReportPaging.EnsureWithinLimit(entities.Count, maxRows);
        var rows = entities.Select(x => new[]
        {
            x.Code, x.Name, x.Building ?? "", x.Floor ?? "",
            x.Capacity.ToString(CultureInfo.InvariantCulture), x.ComputerCount.ToString(CultureInfo.InvariantCulture),
            x.OperatingSystem ?? "", x.ComputerType ?? ""
        });
        var file = ExportBuilder.Build(format, "laboratuvarlar", ["Kod", "Laboratuvar", "Bina", "Kat", "Kapasite", "Bilgisayar", "İşletim Sistemi", "Bilgisayar Türü"], rows);
        await auditService.WriteAsync(AuditActionType.ReportDownloaded, "LaboratoryReport", null, cancellationToken: cancellationToken);
        return file;
    }

    private int MaxRows()
    {
        var value = configuration.GetValue("Reports:MaxRows", 100_000);
        if (value is < 1 or > 1_000_000)
            throw new InvalidOperationException("Reports:MaxRows 1 ile 1000000 arasında olmalıdır.");
        return value;
    }
}

internal static class ReportPaging
{
    private const int PageSize = 100;

    public static async Task<IReadOnlyList<T>> ReadAllAsync<T>(
        int maxRows,
        Func<int, int, CancellationToken, Task<PagedResult<T>>> readPage,
        CancellationToken cancellationToken)
    {
        var all = new List<T>();
        for (var page = 1; ; page++)
        {
            var result = await readPage(page, PageSize, cancellationToken);
            EnsureWithinLimit(result.TotalCount, maxRows);
            if (all.Count + result.Items.Count > maxRows)
                ThrowLimit(maxRows);
            all.AddRange(result.Items);
            if (page >= result.TotalPages)
                return all;
            if (result.Items.Count == 0)
                throw new BusinessRuleException("Rapor sayfalama sırasında tutarsız sonuç üretildi.");
        }
    }

    public static void EnsureWithinLimit(int rowCount, int maxRows)
    {
        if (rowCount > maxRows)
            ThrowLimit(maxRows);
    }

    private static void ThrowLimit(int maxRows) =>
        throw new BusinessRuleException(
            $"Rapor en fazla {maxRows} satır içerebilir. Filtreleri daraltıp yeniden deneyin.");
}

internal static class ExportBuilder
{
    public static ExportFile Build(string format, string stem, IReadOnlyList<string> headers, IEnumerable<string[]> rows)
    {
        var materialized = rows.ToList();
        return format.Trim().ToLowerInvariant() switch
        {
            "xlsx" or "excel" => Xlsx(stem, headers, materialized),
            "pdf" => Pdf(stem, headers, materialized),
            "csv" or "" => Csv(stem, headers, materialized),
            _ => throw new BusinessRuleException("Desteklenen rapor formatları: csv, xlsx, pdf.")
        };
    }

    private static ExportFile Csv(string stem, IReadOnlyList<string> headers, IReadOnlyList<string[]> rows)
    {
        var output = new StringBuilder();
        output.AppendLine(string.Join(';', headers.Select(x => EscapeCsv(NeutralizeFormula(x)))));
        foreach (var row in rows)
            output.AppendLine(string.Join(';', row.Select(x => EscapeCsv(NeutralizeFormula(x)))));
        return new ExportFile(new UTF8Encoding(true).GetBytes(output.ToString()), "text/csv; charset=utf-8", $"{stem}-{DateTime.UtcNow:yyyyMMddHHmmss}.csv");
    }

    private static ExportFile Xlsx(string stem, IReadOnlyList<string> headers, IReadOnlyList<string[]> rows)
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.Worksheets.Add("Rapor");
        for (var column = 0; column < headers.Count; column++)
        {
            sheet.Cell(1, column + 1).Value = NeutralizeFormula(headers[column]);
            sheet.Cell(1, column + 1).Style.Font.Bold = true;
        }
        for (var row = 0; row < rows.Count; row++)
            for (var column = 0; column < rows[row].Length; column++)
                sheet.Cell(row + 2, column + 1).Value = NeutralizeFormula(rows[row][column]);
        sheet.SheetView.FreezeRows(1);
        sheet.Columns().AdjustToContents();
        using var output = new MemoryStream();
        workbook.SaveAs(output);
        return new ExportFile(output.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"{stem}-{DateTime.UtcNow:yyyyMMddHHmmss}.xlsx");
    }

    private static ExportFile Pdf(string stem, IReadOnlyList<string> headers, IReadOnlyList<string[]> rows)
    {
        var lines = new List<string> { string.Join(" | ", headers) };
        lines.AddRange(rows.Take(45).Select(x => string.Join(" | ", x)));
        var escapedLines = lines.Select(line =>
        {
            var decomposed = line.Normalize(NormalizationForm.FormD);
            var ascii = new string(decomposed.Where(c => c <= 127 &&
                CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark).ToArray());
            return ascii.Replace("\\", "\\\\").Replace("(", "\\(").Replace(")", "\\)");
        });
        var content = $"BT /F1 8 Tf 36 800 Td ({string.Join(") Tj 0 -16 Td (", escapedLines)}) Tj ET";
        var objects = new[]
        {
            "<< /Type /Catalog /Pages 2 0 R >>",
            "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
            $"<< /Length {Encoding.ASCII.GetByteCount(content)} >>\nstream\n{content}\nendstream",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
        };
        using var output = new MemoryStream();
        using var writer = new StreamWriter(output, Encoding.ASCII, leaveOpen: true) { NewLine = "\n" };
        writer.WriteLine("%PDF-1.4");
        writer.Flush();
        var offsets = new List<long> { 0 };
        for (var i = 0; i < objects.Length; i++)
        {
            offsets.Add(output.Position);
            writer.WriteLine($"{i + 1} 0 obj");
            writer.WriteLine(objects[i]);
            writer.WriteLine("endobj");
            writer.Flush();
        }
        var xref = output.Position;
        writer.WriteLine($"xref\n0 {objects.Length + 1}\n0000000000 65535 f ");
        foreach (var offset in offsets.Skip(1))
            writer.WriteLine($"{offset:0000000000} 00000 n ");
        writer.WriteLine($"trailer\n<< /Size {objects.Length + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF");
        writer.Flush();
        return new ExportFile(output.ToArray(), "application/pdf", $"{stem}-{DateTime.UtcNow:yyyyMMddHHmmss}.pdf");
    }

    private static string EscapeCsv(string value) =>
        value.IndexOfAny([';', '"', '\r', '\n']) >= 0 ? $"\"{value.Replace("\"", "\"\"")}\"" : value;

    internal static string NeutralizeFormula(string value)
    {
        var trimmed = value.AsSpan().TrimStart();
        return !trimmed.IsEmpty && trimmed[0] is '=' or '+' or '-' or '@'
            ? $"'{value}"
            : value;
    }
}

// Username/Password are deliberately kept environment-only, never DB-stored: SystemSettingService.UpsertAsync
// already refuses to persist IsSecret settings to the database, so credentials follow that same boundary.
public sealed class SmtpOptions
{
    public string? Username { get; set; }
    public string? Password { get; set; }
}

public sealed class SmtpEmailSender(AppDbContext db, IOptions<SmtpOptions> options, ILogger<SmtpEmailSender> logger) : IEmailSender
{
    private readonly SmtpOptions _credentials = options.Value;

    public async Task SendAsync(string recipient, string subject, string body, CancellationToken cancellationToken)
    {
        var result = await TrySendAsync(recipient, subject, body, cancellationToken);
        switch (result.Outcome)
        {
            case EmailSendOutcome.NotConfigured:
                logger.LogInformation("SMTP yapılandırması eksik (Sistem Ayarları > SmtpHost/SmtpFrom), e-posta gönderilmedi. Alıcı domaini: {Domain}, Konu: {Subject}",
                    recipient.Split('@').LastOrDefault() ?? "unknown", subject.Replace("\r", "").Replace("\n", ""));
                break;
            case EmailSendOutcome.Failed:
                // Best-effort: a mail relay outage must not fail the business operation that
                // triggered the notification (e.g. request submission already succeeded in the DB).
                logger.LogError("E-posta gönderimi başarısız. Alıcı domaini: {Domain}, Konu: {Subject}, Hata: {Error}",
                    recipient.Split('@').LastOrDefault() ?? "unknown", subject.Replace("\r", "").Replace("\n", ""), result.ErrorMessage);
                break;
        }
    }

    public Task<EmailSendResult> SendTestAsync(string recipient, CancellationToken cancellationToken) =>
        TrySendAsync(
            recipient,
            "FBU Yazılım Talep Sistemi - SMTP Testi",
            "Bu e-posta, Sistem Ayarları ekranındaki SMTP yapılandırmasını test etmek için gönderilmiştir.",
            cancellationToken);

    private async Task<EmailSendResult> TrySendAsync(string recipient, string subject, string body, CancellationToken cancellationToken)
    {
        var settings = await db.SystemSettings.AsNoTracking()
            .Where(x => x.Key == "SmtpHost" || x.Key == "SmtpPort" || x.Key == "SmtpFrom" || x.Key == "SmtpEnableSsl")
            .ToDictionaryAsync(x => x.Key, x => x.Value, cancellationToken);
        var host = settings.GetValueOrDefault("SmtpHost");
        var from = settings.GetValueOrDefault("SmtpFrom");
        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(from))
            return new EmailSendResult(EmailSendOutcome.NotConfigured, null);

        var port = int.TryParse(settings.GetValueOrDefault("SmtpPort"), out var parsedPort) ? parsedPort : 25;
        var enableSsl = bool.TryParse(settings.GetValueOrDefault("SmtpEnableSsl"), out var parsedSsl) && parsedSsl;

        using var message = new MailMessage(from, recipient, subject, body) { IsBodyHtml = true };
        using var client = new SmtpClient(host, port) { EnableSsl = enableSsl };
        if (!string.IsNullOrWhiteSpace(_credentials.Username))
            client.Credentials = new NetworkCredential(_credentials.Username, _credentials.Password);
        try
        {
            await client.SendMailAsync(message, cancellationToken);
            return new EmailSendResult(EmailSendOutcome.Sent, null);
        }
        catch (Exception ex) when (ex is SmtpException or SocketException)
        {
            return new EmailSendResult(EmailSendOutcome.Failed, ex.Message);
        }
    }
}

// Shared with RequestService (see RequestServices.cs CreateAsync), which enforces this same
// window when a new request is submitted — this evaluator is the single source of truth so
// the admin-facing status and the actual enforcement can never drift apart.
public static class RequestCollectionSettings
{
    public const string EnabledKey = "RequestCollectionEnabled";
    public const string StartDateKey = "RequestCollectionStartDate";
    public const string EndDateKey = "RequestCollectionEndDate";

    public static async Task<RequestCollectionStatusDto> EvaluateAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        var settings = await db.SystemSettings.AsNoTracking()
            .Where(x => x.Key == EnabledKey || x.Key == StartDateKey || x.Key == EndDateKey)
            .ToDictionaryAsync(x => x.Key, x => x.Value, cancellationToken);
        // Missing/unparseable key defaults to enabled — matches "şu anda açık" out of the box.
        var enabled = !bool.TryParse(settings.GetValueOrDefault(EnabledKey), out var parsedEnabled) || parsedEnabled;
        var startDate = DateOnly.TryParse(settings.GetValueOrDefault(StartDateKey), CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedStart)
            ? parsedStart : (DateOnly?)null;
        var endDate = DateOnly.TryParse(settings.GetValueOrDefault(EndDateKey), CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedEnd)
            ? parsedEnd : (DateOnly?)null;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var withinWindow = (startDate is null || today >= startDate) && (endDate is null || today <= endDate);
        return new RequestCollectionStatusDto(enabled && withinWindow, enabled, startDate, endDate);
    }
}

public sealed class SystemSettingService(
    AppDbContext db,
    ResourceAuthorizationService authorization,
    IEmailSender emailSender) : ISystemSettingService
{
    public async Task<IReadOnlyList<SystemSettingDto>> GetAsync(CancellationToken cancellationToken)
    {
        authorization.RequireAdministrator();
        return await db.SystemSettings.AsNoTracking().OrderBy(x => x.Key)
            .Select(x => new SystemSettingDto(x.Id, x.Key, x.IsSecret ? null : x.Value, x.Description, x.IsSecret))
            .ToListAsync(cancellationToken);
    }

    public async Task<SystemSettingDto> UpsertAsync(
        string key,
        UpsertSystemSettingRequest request,
        CancellationToken cancellationToken)
    {
        authorization.RequireAdministrator();
        key = key.Trim();
        if (string.IsNullOrWhiteSpace(key) || key.Length > 150)
            throw new BusinessRuleException("Ayar anahtarı 1-150 karakter olmalıdır.");
        if (request.Value.Length > 4000)
            throw new BusinessRuleException("Ayar değeri en fazla 4000 karakter olabilir.");
        if (request.IsSecret)
            throw new BusinessRuleException("Gizli ayarlar veritabanına yazılmaz; environment variable veya user secrets kullanın.");
        var setting = await db.SystemSettings.SingleOrDefaultAsync(x => x.Key == key, cancellationToken);
        if (setting is null)
        {
            setting = new SystemSetting { Key = key };
            db.SystemSettings.Add(setting);
        }
        setting.Value = request.Value;
        setting.Description = request.Description?.Trim();
        setting.IsSecret = request.IsSecret;
        await db.SaveChangesAsync(cancellationToken);
        return new SystemSettingDto(setting.Id, setting.Key, setting.IsSecret ? null : setting.Value, setting.Description, setting.IsSecret);
    }

    public async Task<SmtpTestResultDto> SendTestEmailAsync(SendTestEmailRequest request, CancellationToken cancellationToken)
    {
        authorization.RequireAdministrator();
        var recipient = request.Recipient?.Trim() ?? string.Empty;
        if (!System.Net.Mail.MailAddress.TryCreate(recipient, out _))
            throw new BusinessRuleException("Geçerli bir e-posta adresi giriniz.");
        var result = await emailSender.SendTestAsync(recipient, cancellationToken);
        return result.Outcome switch
        {
            EmailSendOutcome.Sent => new SmtpTestResultDto(true, $"{recipient} adresine test e-postası gönderildi."),
            EmailSendOutcome.NotConfigured => new SmtpTestResultDto(false, "SMTP ayarları eksik. Önce SmtpHost ve SmtpFrom değerlerini kaydedin."),
            _ => new SmtpTestResultDto(false, $"Gönderim başarısız: {result.ErrorMessage}")
        };
    }

    // Anonim erişilebilir — sadece bir görüntüleme tercihi, hassas veri değil; login öncesi
    // sayfalarda bile tarih/saat gösteriminde kullanılabilmesi için yetki gerektirmiyor.
    public async Task<string> GetTimeZoneAsync(CancellationToken cancellationToken)
    {
        var value = await db.SystemSettings.AsNoTracking()
            .Where(x => x.Key == "SystemTimeZone")
            .Select(x => x.Value)
            .SingleOrDefaultAsync(cancellationToken);
        return string.IsNullOrWhiteSpace(value) ? "Europe/Istanbul" : value;
    }

    // Herhangi bir oturum açmış kullanıcı ("Yeni Talep" butonunu görecek herkes) çağırabilmeli,
    // bu yüzden yönetici kontrolü yok — sadece durum bilgisi döner, ayar değiştirmez.
    public Task<RequestCollectionStatusDto> GetRequestCollectionStatusAsync(CancellationToken cancellationToken) =>
        RequestCollectionSettings.EvaluateAsync(db, cancellationToken);
}

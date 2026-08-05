using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace FbuLabSoftware.Domain;

public static class RequestStatusTransitions
{
    private static readonly IReadOnlyDictionary<SoftwareRequestStatus, SoftwareRequestStatus[]> Allowed =
        new Dictionary<SoftwareRequestStatus, SoftwareRequestStatus[]>
        {
            [SoftwareRequestStatus.Draft] = [SoftwareRequestStatus.Submitted, SoftwareRequestStatus.Cancelled],
            [SoftwareRequestStatus.Submitted] = [SoftwareRequestStatus.UnderReview, SoftwareRequestStatus.AwaitingInformation, SoftwareRequestStatus.Approved, SoftwareRequestStatus.Rejected, SoftwareRequestStatus.Cancelled],
            [SoftwareRequestStatus.UnderReview] = [SoftwareRequestStatus.AwaitingInformation, SoftwareRequestStatus.Approved, SoftwareRequestStatus.Rejected, SoftwareRequestStatus.Cancelled],
            [SoftwareRequestStatus.AwaitingInformation] = [SoftwareRequestStatus.Submitted, SoftwareRequestStatus.Cancelled],
            [SoftwareRequestStatus.Approved] = [SoftwareRequestStatus.InstallationScheduled, SoftwareRequestStatus.Cancelled],
            [SoftwareRequestStatus.InstallationScheduled] = [SoftwareRequestStatus.InstallationCompleted, SoftwareRequestStatus.Cancelled],
            [SoftwareRequestStatus.InstallationCompleted] = [],
            [SoftwareRequestStatus.Rejected] = [],
            [SoftwareRequestStatus.Cancelled] = []
        };

    public static bool CanTransition(SoftwareRequestStatus from, SoftwareRequestStatus to) =>
        Allowed.TryGetValue(from, out var targets) && targets.Contains(to);
}

public static partial class TextNormalization
{
    [GeneratedRegex(@"\s+")]
    private static partial Regex MultiSpaceRegex();

    public static string NormalizeSoftwareName(string value)
    {
        var normalized = value.Trim().Replace('İ', 'i').Replace('I', 'i').ToLowerInvariant()
            .Replace('ı', 'i').Replace('ğ', 'g').Replace('ş', 's')
            .Replace('ç', 'c').Replace('ö', 'o').Replace('ü', 'u');
        var decomposed = normalized.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(decomposed.Length);
        foreach (var character in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(character) != UnicodeCategory.NonSpacingMark)
                builder.Append(character);
        }
        return MultiSpaceRegex().Replace(builder.ToString().Normalize(NormalizationForm.FormC), " ");
    }

    public static bool AreSimilarSoftwareNames(string left, string right)
    {
        left = NormalizeSoftwareName(left);
        right = NormalizeSoftwareName(right);
        if (left == right)
            return true;
        var distance = LevenshteinDistance(left, right);
        var max = Math.Max(left.Length, right.Length);
        return max > 0 && (double)distance / max <= 0.2;
    }

    private static int LevenshteinDistance(string left, string right)
    {
        var costs = Enumerable.Range(0, right.Length + 1).ToArray();
        for (var i = 1; i <= left.Length; i++)
        {
            var previous = costs[0];
            costs[0] = i;
            for (var j = 1; j <= right.Length; j++)
            {
                var saved = costs[j];
                costs[j] = Math.Min(Math.Min(costs[j] + 1, costs[j - 1] + 1),
                    previous + (left[i - 1] == right[j - 1] ? 0 : 1));
                previous = saved;
            }
        }
        return costs[right.Length];
    }

    /// <summary>
    /// Derives a short unique Faculty.Code from a Turkish name (word initials, ASCII-folded),
    /// appending a numeric suffix on collision. Shared by AD sync (auto-created faculties from
    /// office names) and administrative "own unit" request faculties.
    /// </summary>
    public static string GenerateFacultyCode(string name, ISet<string> existingCodes)
    {
        var normalized = name
            .Replace('İ', 'I').Replace('ı', 'i').Replace('Ğ', 'G').Replace('ğ', 'g')
            .Replace('Ü', 'U').Replace('ü', 'u').Replace('Ş', 'S').Replace('ş', 's')
            .Replace('Ö', 'O').Replace('ö', 'o').Replace('Ç', 'C').Replace('ç', 'c');
        var skip = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "ve", "the", "of" };
        var words = normalized.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(w => !skip.Contains(w)).ToList();
        var initials = string.Concat(words.Select(w => char.ToUpperInvariant(w[0])));
        if (initials.Length < 2)
            initials = normalized.Length >= 4 ? normalized[..4].ToUpperInvariant() : normalized.ToUpperInvariant();

        var code = initials;
        var suffix = 1;
        while (existingCodes.Contains(code))
            code = $"{initials}{++suffix}";
        existingCodes.Add(code);
        return code;
    }
}

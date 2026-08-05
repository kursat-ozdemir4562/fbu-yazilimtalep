using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace FbuLabSoftware.Api;

/// <summary>
/// The frontend wizard sends and expects "HH:mm" (no seconds) for course schedule times,
/// while the built-in System.Text.Json TimeOnly converter only accepts "HH:mm:ss.fffffff".
/// </summary>
public sealed class TimeOnlyJsonConverter : JsonConverter<TimeOnly>
{
    private static readonly string[] Formats = ["HH:mm:ss.fffffff", "HH:mm:ss", "HH:mm"];

    public override TimeOnly Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var value = reader.GetString();
        if (TimeOnly.TryParseExact(value, Formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var result))
            return result;
        throw new JsonException($"'{value}' geçerli bir saat değeri (HH:mm) değil.");
    }

    public override void Write(Utf8JsonWriter writer, TimeOnly value, JsonSerializerOptions options) =>
        writer.WriteStringValue(value.ToString("HH:mm", CultureInfo.InvariantCulture));
}

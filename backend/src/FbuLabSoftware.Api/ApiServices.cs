using System.Security.Claims;
using FbuLabSoftware.Application;
using FluentValidation;
using Microsoft.AspNetCore.Mvc;

namespace FbuLabSoftware.Api;

public sealed class CurrentUserService(IHttpContextAccessor accessor) : ICurrentUserService
{
    private ClaimsPrincipal? Principal => accessor.HttpContext?.User;
    public string? UserId => Principal?.FindFirstValue(ClaimTypes.NameIdentifier)
                             ?? Principal?.FindFirstValue("sub");
    public string? Email => Principal?.FindFirstValue(ClaimTypes.Email)
                            ?? Principal?.FindFirstValue("email");
    public string? IpAddress => accessor.HttpContext?.Connection.RemoteIpAddress?.ToString();
    public string? UserAgent => accessor.HttpContext?.Request.Headers.UserAgent.ToString();
    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated == true;
    public bool IsInRole(string role) => Principal?.IsInRole(role) == true;
}

public sealed class GlobalExceptionMiddleware(
    RequestDelegate next,
    ILogger<GlobalExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception exception)
        {
            await WriteProblemAsync(context, exception);
        }
    }

    private async Task WriteProblemAsync(HttpContext context, Exception exception)
    {
        var (status, title, errors) = exception switch
        {
            AppException appException => (appException.StatusCode, appException.Message, null),
            ValidationException validation => (
                StatusCodes.Status400BadRequest,
                "İstek doğrulaması başarısız.",
                validation.Errors.GroupBy(x => x.PropertyName)
                    .ToDictionary(x => x.Key, x => x.Select(y => y.ErrorMessage).Distinct().ToArray())),
            _ => (StatusCodes.Status500InternalServerError, "Beklenmeyen bir sunucu hatası oluştu.", null)
        };
        if (status >= 500)
            logger.LogError(exception, "İşlenmeyen API hatası. TraceId: {TraceId}", context.TraceIdentifier);
        else
            logger.LogWarning("API isteği reddedildi. Status: {Status}, TraceId: {TraceId}, Tür: {ExceptionType}",
                status, context.TraceIdentifier, exception.GetType().Name);

        context.Response.StatusCode = status;
        context.Response.ContentType = "application/problem+json";
        var problem = new ProblemDetails
        {
            Status = status,
            Title = title,
            Type = $"https://httpstatuses.com/{status}",
            Instance = context.Request.Path
        };
        problem.Extensions["traceId"] = context.TraceIdentifier;
        if (errors is not null)
            problem.Extensions["errors"] = errors;
        await context.Response.WriteAsJsonAsync(problem);
    }
}

public sealed class SecurityHeadersMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        context.Response.OnStarting(() =>
        {
            var headers = context.Response.Headers;
            headers["X-Content-Type-Options"] = "nosniff";
            headers["X-Frame-Options"] = "DENY";
            headers["Referrer-Policy"] = "no-referrer";
            headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
            headers["Content-Security-Policy"] = context.Request.Path.StartsWithSegments("/swagger")
                ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'"
                : "default-src 'none'; frame-ancestors 'none'; base-uri 'none'";
            if (context.Request.IsHttps)
                headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
            return Task.CompletedTask;
        });
        await next(context);
    }
}

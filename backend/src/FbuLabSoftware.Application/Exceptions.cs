using FluentValidation;

namespace FbuLabSoftware.Application;

public abstract class AppException(string message) : Exception(message)
{
    public abstract int StatusCode { get; }
}

public sealed class NotFoundException(string message) : AppException(message)
{
    public override int StatusCode => 404;
}

public sealed class ForbiddenException(string message = "Bu işlem için yetkiniz yok.") : AppException(message)
{
    public override int StatusCode => 403;
}

public sealed class UnauthorizedException(string message = "Kimlik doğrulama başarısız.") : AppException(message)
{
    public override int StatusCode => 401;
}

public sealed class ConflictException(string message) : AppException(message)
{
    public override int StatusCode => 409;
}

public sealed class BusinessRuleException(string message) : AppException(message)
{
    public override int StatusCode => 422;
}

public static class ValidationExtensions
{
    public static async Task ValidateRequestAsync<T>(
        this IValidator<T> validator,
        T request,
        CancellationToken cancellationToken)
    {
        var result = await validator.ValidateAsync(request, cancellationToken);
        if (!result.IsValid)
            throw new ValidationException(result.Errors);
    }
}


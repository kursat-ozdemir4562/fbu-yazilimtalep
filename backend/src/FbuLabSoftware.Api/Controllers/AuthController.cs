using FbuLabSoftware.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace FbuLabSoftware.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(IAuthService service) : ControllerBase
{
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    [HttpPost("login")]
    [ProducesResponseType<TokenResponse>(StatusCodes.Status200OK)]
    public Task<TokenResponse> Login(LoginRequest request, CancellationToken cancellationToken) =>
        service.LoginAsync(request, cancellationToken);

    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    [HttpPost("refresh")]
    [ProducesResponseType<TokenResponse>(StatusCodes.Status200OK)]
    public Task<TokenResponse> Refresh(RefreshRequest request, CancellationToken cancellationToken) =>
        service.RefreshAsync(request, cancellationToken);

    [Authorize]
    [HttpPost("logout")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Logout(RefreshRequest? request, CancellationToken cancellationToken)
    {
        await service.LogoutAsync(request, cancellationToken);
        return NoContent();
    }

    [Authorize]
    [HttpGet("me")]
    public Task<CurrentUserDto> Me(CancellationToken cancellationToken) => service.MeAsync(cancellationToken);

    [Authorize]
    [HttpPut("me/theme")]
    public async Task<IActionResult> UpdateThemePreference(UpdateThemePreferenceRequest request, CancellationToken cancellationToken)
    {
        await service.UpdateThemePreferenceAsync(request, cancellationToken);
        return NoContent();
    }
}


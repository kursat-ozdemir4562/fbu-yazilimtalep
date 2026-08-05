using FbuLabSoftware.Application;
using FbuLabSoftware.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FbuLabSoftware.Api.Controllers;

[ApiController, Authorize, Route("api/software/suggestions")]
public sealed class SoftwareSuggestionsController(ISoftwareSuggestionService service) : ControllerBase
{
    [HttpPost]
    public Task<SoftwareSuggestionDto> Create(CreateSoftwareSuggestionRequest request, CancellationToken cancellationToken) =>
        service.CreateAsync(request, cancellationToken);

    [Authorize(Policy = "FacultyOrAdministrator"), HttpGet]
    public Task<PagedResult<SoftwareSuggestionDto>> Get([FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        [FromQuery] ApprovalStatus? status = null, CancellationToken cancellationToken = default) =>
        service.GetAsync(page, pageSize, status, cancellationToken);

    [HttpGet("my")]
    public Task<IReadOnlyList<SoftwareSuggestionDto>> Mine(CancellationToken cancellationToken) =>
        service.GetMineAsync(cancellationToken);

    [Authorize(Policy = "AdministratorOnly"), HttpPost("{id:guid}/approve")]
    public Task<SoftwareSuggestionDto> Approve(Guid id, ReviewSoftwareSuggestionRequest? request,
        CancellationToken cancellationToken) => service.ApproveAsync(id, request, cancellationToken);

    [Authorize(Policy = "AdministratorOnly"), HttpPost("{id:guid}/reject")]
    public Task<SoftwareSuggestionDto> Reject(Guid id, RejectSoftwareSuggestionRequest request,
        CancellationToken cancellationToken) => service.RejectAsync(id, request, cancellationToken);
}

[ApiController, Authorize, Route("api/requests")]
public sealed class RequestsController(IRequestService service) : ControllerBase
{
    [HttpGet("my")]
    public Task<PagedResult<SoftwareRequestDto>> Mine([FromQuery] RequestQuery query, CancellationToken cancellationToken) =>
        service.GetAsync(query, true, cancellationToken);

    [HttpGet("draft")]
    public Task<RequestDraftDto?> GetDraft(CancellationToken cancellationToken) => service.GetDraftAsync(cancellationToken);

    [HttpPost("draft")]
    public Task<RequestDraftDto> SaveDraft(UpsertRequestDraftRequest request, CancellationToken cancellationToken) =>
        service.SaveDraftAsync(request, cancellationToken);

    [HttpPost("draft/delete")]
    public async Task<IActionResult> DeleteDraft(CancellationToken cancellationToken)
    {
        await service.DeleteDraftAsync(cancellationToken);
        return NoContent();
    }

    [Authorize(Policy = "AdministratorOnly"), HttpGet("schedule")]
    public Task<IReadOnlyList<CourseScheduleEntryDto>> Schedule(CancellationToken cancellationToken) =>
        service.GetScheduleAsync(cancellationToken);

    [HttpGet("stats")]
    public Task<RequestStatsDto> Stats(CancellationToken cancellationToken) =>
        service.GetStatsAsync(cancellationToken);

    [HttpGet]
    public Task<PagedResult<SoftwareRequestDto>> Get([FromQuery] RequestQuery query, CancellationToken cancellationToken) =>
        service.GetAsync(query, false, cancellationToken);

    [HttpGet("{id:guid}")]
    public Task<SoftwareRequestDto> GetById(Guid id, CancellationToken cancellationToken) =>
        service.GetByIdAsync(id, cancellationToken);

    [HttpGet("{id:guid}/history")]
    public Task<IReadOnlyList<SoftwareRequestRevisionDto>> History(Guid id, CancellationToken cancellationToken) =>
        service.GetHistoryAsync(id, cancellationToken);

    [HttpPost]
    public async Task<ActionResult<SoftwareRequestDto>> Create(CreateSoftwareRequestRequest request, CancellationToken cancellationToken)
    {
        var result = await service.CreateAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPost("{id:guid}")]
    public Task<SoftwareRequestDto> Update(Guid id, UpdateSoftwareRequestRequest request, CancellationToken cancellationToken) =>
        service.UpdateAsync(id, request, cancellationToken);

    [HttpPost("{id:guid}/delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        await service.DeleteAsync(id, cancellationToken);
        return NoContent();
    }

    [HttpPost("{id:guid}/submit")]
    public Task<SoftwareRequestDto> Submit(Guid id, CancellationToken cancellationToken) =>
        service.SubmitAsync(id, cancellationToken);

    [HttpPost("{id:guid}/status")]
    public Task<SoftwareRequestDto> ChangeStatus(Guid id, ChangeRequestStatusRequest request,
        CancellationToken cancellationToken) => service.ChangeStatusAsync(id, request, cancellationToken);

    [HttpPost("{id:guid}/copy")]
    public Task<SoftwareRequestDto> Copy(Guid id, CancellationToken cancellationToken) =>
        service.CopyAsync(id, cancellationToken);
}

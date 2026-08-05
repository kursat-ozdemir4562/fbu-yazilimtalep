using FbuLabSoftware.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FbuLabSoftware.Api.Controllers;

[ApiController, Authorize, Route("api/faculties")]
public sealed class FacultiesController(IFacultyService service) : ControllerBase
{
    [HttpGet]
    public Task<PagedResult<FacultyDto>> Get([FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null, CancellationToken cancellationToken = default) =>
        service.GetAsync(page, pageSize, search, cancellationToken);

    [HttpGet("{id:guid}")]
    public Task<FacultyDto> GetById(Guid id, CancellationToken cancellationToken) =>
        service.GetByIdAsync(id, cancellationToken);

    [Authorize(Policy = "AdministratorOnly"), HttpPost]
    public async Task<ActionResult<FacultyDto>> Create(CreateFacultyRequest request, CancellationToken cancellationToken)
    {
        var result = await service.CreateAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [Authorize(Policy = "AdministratorOnly"), HttpPut("{id:guid}")]
    public Task<FacultyDto> Update(Guid id, UpdateFacultyRequest request, CancellationToken cancellationToken) =>
        service.UpdateAsync(id, request, cancellationToken);

    [Authorize(Policy = "AdministratorOnly"), HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        await service.DeleteAsync(id, cancellationToken);
        return NoContent();
    }
}

[ApiController, Authorize, Route("api/laboratories")]
public sealed class LaboratoriesController(ILaboratoryService service) : ControllerBase
{
    [HttpGet]
    public Task<PagedResult<LaboratoryDto>> Get([FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null, [FromQuery] Guid? facultyId = null,
        CancellationToken cancellationToken = default) =>
        service.GetAsync(page, pageSize, search, facultyId, cancellationToken);

    [HttpGet("{id:guid}")]
    public Task<LaboratoryDto> GetById(Guid id, CancellationToken cancellationToken) =>
        service.GetByIdAsync(id, cancellationToken);

    [Authorize(Policy = "AdministratorOnly"), HttpPost]
    public async Task<ActionResult<LaboratoryDto>> Create(CreateLaboratoryRequest request, CancellationToken cancellationToken)
    {
        var result = await service.CreateAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [Authorize(Policy = "AdministratorOnly"), HttpPut("{id:guid}")]
    public Task<LaboratoryDto> Update(Guid id, UpdateLaboratoryRequest request, CancellationToken cancellationToken) =>
        service.UpdateAsync(id, request, cancellationToken);

    [Authorize(Policy = "AdministratorOnly"), HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        await service.DeleteAsync(id, cancellationToken);
        return NoContent();
    }
}

[ApiController, Authorize, Route("api/instructors")]
public sealed class InstructorsController(IInstructorDirectoryService service) : ControllerBase
{
    [HttpGet("search")]
    public Task<IReadOnlyList<InstructorDto>> Search([FromQuery] string? q, [FromQuery] int limit = 20,
        CancellationToken cancellationToken = default) => service.SearchAsync(q, limit, cancellationToken);
}

[ApiController, Authorize, Route("api/academic-terms")]
public sealed class AcademicTermsController(IAcademicTermService service) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<AcademicTermDto>> Get(CancellationToken cancellationToken) =>
        service.GetAsync(cancellationToken);

    [Authorize(Policy = "AdministratorOnly"), HttpPost]
    public Task<AcademicTermDto> Create(UpsertAcademicTermRequest request, CancellationToken cancellationToken) =>
        service.CreateAsync(request, cancellationToken);

    [Authorize(Policy = "AdministratorOnly"), HttpPut("{id:guid}")]
    public Task<AcademicTermDto> Update(Guid id, UpsertAcademicTermRequest request, CancellationToken cancellationToken) =>
        service.UpdateAsync(id, request, cancellationToken);

    [Authorize(Policy = "AdministratorOnly"), HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        await service.DeleteAsync(id, cancellationToken);
        return NoContent();
    }
}

[ApiController, Authorize, Route("api/software")]
public sealed class SoftwareController(ISoftwareService service) : ControllerBase
{
    [HttpGet]
    public Task<PagedResult<SoftwareDto>> Get([FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null, [FromQuery] bool activeOnly = true,
        CancellationToken cancellationToken = default) =>
        service.GetAsync(page, pageSize, search, activeOnly, cancellationToken);

    [HttpGet("{id:guid}")]
    public Task<SoftwareDto> GetById(Guid id, CancellationToken cancellationToken) =>
        service.GetByIdAsync(id, cancellationToken);

    [HttpGet("search")]
    public Task<IReadOnlyList<SoftwareDto>> Search([FromQuery] string q, [FromQuery] int limit = 20,
        CancellationToken cancellationToken = default) => service.SearchAsync(q, limit, cancellationToken);

    [Authorize(Policy = "AdministratorOnly"), HttpPost]
    public async Task<ActionResult<SoftwareDto>> Create(UpsertSoftwareRequest request, CancellationToken cancellationToken)
    {
        var result = await service.CreateAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [Authorize(Policy = "AdministratorOnly"), HttpPut("{id:guid}")]
    public Task<SoftwareDto> Update(Guid id, UpsertSoftwareRequest request, CancellationToken cancellationToken) =>
        service.UpdateAsync(id, request, cancellationToken);

    [Authorize(Policy = "AdministratorOnly"), HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        await service.DeleteAsync(id, cancellationToken);
        return NoContent();
    }
}


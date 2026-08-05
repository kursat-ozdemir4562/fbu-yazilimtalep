using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FbuLabSoftware.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ReplaceSectionWithSectionCountAndOwnedSections : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Section",
                table: "SoftwareRequests",
                newName: "SectionCount");

            migrationBuilder.AddColumn<bool>(
                name: "HasOtherSectionInstructor",
                table: "SoftwareRequests",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "OwnedSections",
                table: "SoftwareRequests",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "1");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "HasOtherSectionInstructor",
                table: "SoftwareRequests");

            migrationBuilder.DropColumn(
                name: "OwnedSections",
                table: "SoftwareRequests");

            migrationBuilder.RenameColumn(
                name: "SectionCount",
                table: "SoftwareRequests",
                newName: "Section");
        }
    }
}

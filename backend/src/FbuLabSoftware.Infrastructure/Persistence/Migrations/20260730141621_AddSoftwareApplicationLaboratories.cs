using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FbuLabSoftware.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSoftwareApplicationLaboratories : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SoftwareApplicationLaboratories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SoftwareApplicationId = table.Column<Guid>(type: "uuid", nullable: false),
                    LaboratoryId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SoftwareApplicationLaboratories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SoftwareApplicationLaboratories_Laboratories_LaboratoryId",
                        column: x => x.LaboratoryId,
                        principalTable: "Laboratories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SoftwareApplicationLaboratories_SoftwareApplications_Softwa~",
                        column: x => x.SoftwareApplicationId,
                        principalTable: "SoftwareApplications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SoftwareApplicationLaboratories_LaboratoryId",
                table: "SoftwareApplicationLaboratories",
                column: "LaboratoryId");

            migrationBuilder.CreateIndex(
                name: "IX_SoftwareApplicationLaboratories_SoftwareApplicationId_Labor~",
                table: "SoftwareApplicationLaboratories",
                columns: new[] { "SoftwareApplicationId", "LaboratoryId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SoftwareApplicationLaboratories");
        }
    }
}

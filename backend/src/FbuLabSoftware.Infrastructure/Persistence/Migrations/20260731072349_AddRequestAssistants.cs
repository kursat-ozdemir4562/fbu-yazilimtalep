using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FbuLabSoftware.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRequestAssistants : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RequestAssistants",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SoftwareRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    FullName = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    Email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RequestAssistants", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RequestAssistants_SoftwareRequests_SoftwareRequestId",
                        column: x => x.SoftwareRequestId,
                        principalTable: "SoftwareRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RequestAssistants_SoftwareRequestId",
                table: "RequestAssistants",
                column: "SoftwareRequestId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RequestAssistants");
        }
    }
}

using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FbuLabSoftware.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddThemePreferenceAndRequestDrafts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ThemePreference",
                table: "Users",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "RequestDrafts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    PayloadJson = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedByUserId = table.Column<string>(type: "text", nullable: true),
                    UpdatedByUserId = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RequestDrafts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RequestDrafts_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RequestDrafts_UserId",
                table: "RequestDrafts",
                column: "UserId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RequestDrafts");

            migrationBuilder.DropColumn(
                name: "ThemePreference",
                table: "Users");
        }
    }
}

using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FbuLabSoftware.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLaboratoryComputerTypeAndOptionalFaculty : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Laboratories_Faculties_FacultyId",
                table: "Laboratories");

            migrationBuilder.AlterColumn<Guid>(
                name: "FacultyId",
                table: "Laboratories",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<string>(
                name: "ComputerType",
                table: "Laboratories",
                type: "text",
                nullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Laboratories_Faculties_FacultyId",
                table: "Laboratories",
                column: "FacultyId",
                principalTable: "Faculties",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Laboratories_Faculties_FacultyId",
                table: "Laboratories");

            migrationBuilder.DropColumn(
                name: "ComputerType",
                table: "Laboratories");

            migrationBuilder.AlterColumn<Guid>(
                name: "FacultyId",
                table: "Laboratories",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Laboratories_Faculties_FacultyId",
                table: "Laboratories",
                column: "FacultyId",
                principalTable: "Faculties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}

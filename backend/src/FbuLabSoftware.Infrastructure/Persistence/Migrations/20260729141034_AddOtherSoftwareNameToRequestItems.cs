using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FbuLabSoftware.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOtherSoftwareNameToRequestItems : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Guid>(
                name: "SoftwareApplicationId",
                table: "SoftwareRequestItems",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<string>(
                name: "OtherSoftwareName",
                table: "SoftwareRequestItems",
                type: "character varying(250)",
                maxLength: 250,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OtherSoftwareName",
                table: "SoftwareRequestItems");

            migrationBuilder.AlterColumn<Guid>(
                name: "SoftwareApplicationId",
                table: "SoftwareRequestItems",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);
        }
    }
}

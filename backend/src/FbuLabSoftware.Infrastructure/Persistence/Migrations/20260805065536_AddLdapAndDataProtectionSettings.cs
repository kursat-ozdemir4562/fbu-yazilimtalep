using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace FbuLabSoftware.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLdapAndDataProtectionSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DataProtectionKeys",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    FriendlyName = table.Column<string>(type: "text", nullable: true),
                    Xml = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DataProtectionKeys", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "LdapSettings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    PrimaryHost = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    PrimaryPort = table.Column<int>(type: "integer", nullable: false),
                    SecondaryHost = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: true),
                    SecondaryPort = table.Column<int>(type: "integer", nullable: true),
                    BindDn = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    BindPasswordProtected = table.Column<string>(type: "text", nullable: false),
                    AcademicOu = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    AdministrativeOu = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    SyncIntervalHours = table.Column<int>(type: "integer", nullable: false),
                    SyncTimeOfDay = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedByUserId = table.Column<string>(type: "text", nullable: true),
                    UpdatedByUserId = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LdapSettings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SamlSettings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    IdpEntityId = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    IdpSsoUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    IdpSloUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Certificate = table.Column<string>(type: "text", nullable: false),
                    EmailAttribute = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    DisplayNameAttribute = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    NameIdMapping = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedByUserId = table.Column<string>(type: "text", nullable: true),
                    UpdatedByUserId = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SamlSettings", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DataProtectionKeys");

            migrationBuilder.DropTable(
                name: "LdapSettings");

            migrationBuilder.DropTable(
                name: "SamlSettings");
        }
    }
}

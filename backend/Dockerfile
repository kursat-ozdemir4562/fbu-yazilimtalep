FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY backend/src/FbuLabSoftware.Domain/FbuLabSoftware.Domain.csproj backend/src/FbuLabSoftware.Domain/
COPY backend/src/FbuLabSoftware.Application/FbuLabSoftware.Application.csproj backend/src/FbuLabSoftware.Application/
COPY backend/src/FbuLabSoftware.Infrastructure/FbuLabSoftware.Infrastructure.csproj backend/src/FbuLabSoftware.Infrastructure/
COPY backend/src/FbuLabSoftware.Api/FbuLabSoftware.Api.csproj backend/src/FbuLabSoftware.Api/
RUN dotnet restore backend/src/FbuLabSoftware.Api/FbuLabSoftware.Api.csproj
COPY backend/src backend/src
RUN dotnet publish backend/src/FbuLabSoftware.Api/FbuLabSoftware.Api.csproj \
    --configuration Release \
    --output /app/publish \
    --no-restore \
    /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
RUN apt-get update \
    && apt-get install --yes --no-install-recommends wget libldap-2.5-0 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/publish .
RUN mkdir -p /app/storage \
    && chown -R app:app /app
USER app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "FbuLabSoftware.Api.dll"]


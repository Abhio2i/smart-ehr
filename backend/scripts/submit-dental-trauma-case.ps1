param(
    [string]$BaseUrl = $env:PROD_BASE_URL,
    [string]$AccessToken = $env:PROD_ACCESS_TOKEN,
    [string]$PayloadPath = "docs/dental-trauma-epcr-create-request.json",
    [string]$IdempotencyKey = "dental-trauma-tooth-11-2026-03-15-v1",
    [switch]$SubmitAfterCreate
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
    throw "Set PROD_BASE_URL or pass -BaseUrl, for example https://api.example.com"
}

if ([string]::IsNullOrWhiteSpace($AccessToken)) {
    throw "Set PROD_ACCESS_TOKEN or pass -AccessToken with a valid bearer token."
}

if (-not (Test-Path -LiteralPath $PayloadPath)) {
    throw "Payload file not found: $PayloadPath"
}

$base = $BaseUrl.TrimEnd("/")
$payload = Get-Content -LiteralPath $PayloadPath -Raw
$headers = @{
    Authorization = "Bearer $AccessToken"
    "Content-Type" = "application/json"
    "Idempotency-Key" = $IdempotencyKey
}

$created = Invoke-RestMethod `
    -Method Post `
    -Uri "$base/api/epcr/records" `
    -Headers $headers `
    -Body $payload

Write-Host "Created or reused ePCR record id: $($created.id)"
Write-Host "Patient id: $($created.patientId)"
Write-Host "Incident number: $($created.incidentNumber)"

if ($SubmitAfterCreate) {
    $submitHeaders = @{
        Authorization = "Bearer $AccessToken"
        "Content-Type" = "application/json"
    }
    $submitted = Invoke-RestMethod `
        -Method Post `
        -Uri "$base/api/epcr/records/$($created.id)/submit" `
        -Headers $submitHeaders
    Write-Host "Submitted ePCR record id: $($submitted.id)"
    Write-Host "Status: $($submitted.status)"
}

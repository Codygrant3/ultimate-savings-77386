[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$TaskName = "77386 Savings Weekly Report",
    [string]$ProjectPath = (Split-Path -Parent $PSScriptRoot),
    [string]$At = "08:00"
)

$resolvedProjectPath = (Resolve-Path -LiteralPath $ProjectPath).Path
$packagePath = Join-Path $resolvedProjectPath "package.json"

if (-not (Test-Path -LiteralPath $packagePath)) {
    throw "No package.json was found at $resolvedProjectPath."
}

$npmCommand = (Get-Command npm.cmd -ErrorAction Stop).Source
$action = New-ScheduledTaskAction `
    -Execute $npmCommand `
    -Argument "run report:weekly" `
    -WorkingDirectory $resolvedProjectPath
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At $At
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries

if ($PSCmdlet.ShouldProcess($TaskName, "Register weekly savings report task")) {
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Description "Generate the 77386 weekly savings briefing every Monday." `
        -Force | Out-Null

    Write-Output "Registered '$TaskName' for Mondays at $At."
    Write-Output "Working directory: $resolvedProjectPath"
}

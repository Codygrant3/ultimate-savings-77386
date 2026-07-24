[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$TaskName = "77386 Savings Deal Discovery",
    [string]$ProjectPath = (Split-Path -Parent $PSScriptRoot),
    [string]$At = "07:00"
)

$resolvedProjectPath = (Resolve-Path -LiteralPath $ProjectPath).Path
$packagePath = Join-Path $resolvedProjectPath "package.json"

if (-not (Test-Path -LiteralPath $packagePath)) {
    throw "No package.json was found at $resolvedProjectPath."
}

$npmCommand = (Get-Command npm.cmd -ErrorAction Stop).Source
$action = New-ScheduledTaskAction `
    -Execute $npmCommand `
    -Argument "run refresh:deals" `
    -WorkingDirectory $resolvedProjectPath
$trigger = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries

if ($PSCmdlet.ShouldProcess($TaskName, "Register daily public-source deal discovery task")) {
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Description "Check configured public offer sources and surface only new or improved high-value matches." `
        -Force | Out-Null

    Write-Output "Registered '$TaskName' for daily refreshes at $At."
    Write-Output "Working directory: $resolvedProjectPath"
}

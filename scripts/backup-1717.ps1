param(
  [ValidateSet('Backup','Verify')][string]$Action = 'Backup',
  [string]$BackupFile,
  [string]$PgBin = "$env:LOCALAPPDATA/BarberiaOS/tools/postgresql-17.11/pgsql/bin"
)
$ErrorActionPreference = 'Stop'
$taskRoot = Join-Path $env:LOCALAPPDATA 'BarberiaOS/private-backups/tbcfhagteyqufjkmbxzz'
New-Item -ItemType Directory -Force -Path $taskRoot | Out-Null
$taskIdentity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls.exe $taskRoot /inheritance:r /grant:r "${taskIdentity}:(OI)(CI)F" 'SYSTEM:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Cannot restrict the private backup directory' }
foreach ($taskTool in @('pg_dump.exe','pg_restore.exe')) {
  if (-not (Test-Path -LiteralPath (Join-Path $PgBin $taskTool))) { throw "Missing PostgreSQL tool: $taskTool" }
}
function Read-TaskSecret([string]$Prompt) {
  $taskSecure = Read-Host $Prompt -AsSecureString
  $taskPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskSecure)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskPointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskPointer); $taskSecure.Dispose() }
}
try {
  if ($Action -eq 'Verify' -and -not $BackupFile) {
    $taskLatest = Get-ChildItem -LiteralPath $taskRoot -Filter '*.bkos' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $taskLatest) { throw 'No hay un archivo cifrado para verificar' }
    $BackupFile = $taskLatest.FullName
  }
  $env:TASK_BACKUP_ACTION = $Action
  $env:TASK_BACKUP_ROOT = $taskRoot
  $env:TASK_BACKUP_PG_BIN = (Resolve-Path -LiteralPath $PgBin).Path
  $env:TASK_BACKUP_FILE = $BackupFile
  if ($Action -eq 'Backup') {
    $env:TASK_BACKUP_DB_PASSWORD = Read-TaskSecret 'Contraseña actual PostgreSQL de tbcfhagteyqufjkmbxzz (oculta; no se guardará)'
  }
  $env:TASK_BACKUP_PASSPHRASE = Read-TaskSecret 'Frase de cifrado del respaldo (mínimo 20 caracteres; guardala en tu gestor de contraseñas)'
  if ($Action -eq 'Backup') {
    $taskConfirm = Read-TaskSecret 'Repetí la frase de cifrado'
    if ($taskConfirm -cne $env:TASK_BACKUP_PASSPHRASE) { throw 'Las frases no coinciden' }
    $taskConfirm = $null
  }
  & node --import tsx (Join-Path $PSScriptRoot 'private-database-backup.ts')
  if ($LASTEXITCODE -ne 0) { throw 'Respaldo o restauración no aprobados. Ver el recibo privado; no aplicar migraciones.' }
} finally {
  foreach ($taskName in @('TASK_BACKUP_ACTION','TASK_BACKUP_ROOT','TASK_BACKUP_PG_BIN','TASK_BACKUP_FILE','TASK_BACKUP_DB_PASSWORD','TASK_BACKUP_PASSPHRASE')) {
    Remove-Item -LiteralPath "Env:$taskName" -ErrorAction SilentlyContinue
  }
}

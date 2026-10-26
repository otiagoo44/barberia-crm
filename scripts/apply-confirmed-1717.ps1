param([ValidateSet('Plan','Apply')][string]$Action='Plan')
$ErrorActionPreference='Stop'
function Read-ActivationSecret([string]$Prompt) {
 $taskSecure=Read-Host $Prompt -AsSecureString
 $taskPointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskSecure)
 try {[Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskPointer)}
 finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskPointer);$taskSecure.Dispose()}
}
try {
 $env:TASK_ACTIVATION_ACTION=$Action
 if ($Action -eq 'Apply') {
  Write-Host 'Cuenta owner autorizada: ortegatiago733@gmail.com. Proyecto: tbcfhagteyqufjkmbxzz.'
  Write-Host 'Aplicara el plan confirmado: 8 servicios, precios/capacidades, horario 09-21, pausa, domingo cerrado; booking permanece cerrado.'
  $env:TASK_ACTIVATION_PASSWORD=Read-ActivationSecret 'Tu contrasena actual del CRM (oculta; no se guardara)'
  $env:TASK_ACTIVATION_TOTP=Read-ActivationSecret 'Codigo vigente de tu autenticador del CRM (oculto)'
 }
 & node --import tsx (Join-Path $PSScriptRoot 'apply-confirmed-1717.ts')
 if ($LASTEXITCODE -ne 0) {throw 'La configuracion no fue aprobada. Revisar el resultado; no repetir sin inspeccion.'}
} finally {
 foreach($taskName in @('TASK_ACTIVATION_ACTION','TASK_ACTIVATION_PASSWORD','TASK_ACTIVATION_TOTP')) {Remove-Item -LiteralPath "Env:$taskName" -ErrorAction SilentlyContinue}
}

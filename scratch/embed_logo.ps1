$parentDir = (Get-Item $PSScriptRoot).Parent.FullName
$pngPath = Join-Path $parentDir "icons\LOGOig.png"
$svgPath = Join-Path $parentDir "icons\icon.svg"
$svgMaskPath = Join-Path $parentDir "icons\icon-maskable.svg"

$bytes = [IO.File]::ReadAllBytes($pngPath)
$base64 = [Convert]::ToBase64String($bytes)

$svgContent = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 1000' width='100%' height='100%'><image href='data:image/png;base64,$base64' x='0' y='0' width='1000' height='1000'/></svg>"

[IO.File]::WriteAllText($svgPath, $svgContent)
[IO.File]::WriteAllText($svgMaskPath, $svgContent)
Write-Output "Successfully embedded PNG inside SVG files!"

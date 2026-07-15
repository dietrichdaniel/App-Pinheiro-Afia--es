$parentDir = (Get-Item $PSScriptRoot).Parent.FullName
$pngPath = Join-Path $parentDir "icons\LOGOig.png"
$svgPath = Join-Path $parentDir "icons\icon.svg"
$svgMaskPath = Join-Path $parentDir "icons\icon-maskable.svg"

$bytes = [IO.File]::ReadAllBytes($pngPath)
$base64 = [Convert]::ToBase64String($bytes)

# Template para favicon/UI (com recorte circular para remover cantos quadrados)
$svgContent = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 1000' width='100%' height='100%'><defs><clipPath id='circleClip'><circle cx='500' cy='500' r='500'/></clipPath></defs><image href='data:image/png;base64,$base64' x='0' y='0' width='1000' height='1000' clip-path='url(#circleClip)'/></svg>"

# Template para PWA maskable (com fundo escuro preenchido e imagem reduzida a 80% para ficar na Safe Zone e não cortar as bordas)
$svgMaskContent = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 1000' width='100%' height='100%'><rect width='1000' height='1000' fill='#06080d'/><image href='data:image/png;base64,$base64' x='100' y='100' width='800' height='800'/></svg>"

[IO.File]::WriteAllText($svgPath, $svgContent)
[IO.File]::WriteAllText($svgMaskPath, $svgMaskContent)
Write-Output "Successfully updated embedded PNG inside SVG files with masking and safe zone scaling!"

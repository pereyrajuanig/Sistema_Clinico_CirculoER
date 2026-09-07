// Script de uso único para generar los íconos de la PWA a partir del logo institucional.
// No forma parte del build — se corre a mano una vez (`node scripts/generar-iconos-pwa.cjs`)
// y después se puede borrar junto con la dependencia "sharp" (devDependency de uso único).
const sharp = require('sharp')
const path = require('path')

const LOGO = path.join(__dirname, '..', 'src', 'assets', 'Logo-Circulo_FondoTransparente.png')
const OUT = path.join(__dirname, '..', 'public')

// #FAF6EC — mismo token "background" del modo claro (src/index.css), para que el ícono
// combine con el resto de la identidad de la app en vez de tener un fondo genérico
const BG = { r: 0xfa, g: 0xf6, b: 0xec, alpha: 1 }

async function icono(nombre, size, margenPct) {
  const logoSize = Math.round(size * (1 - margenPct * 2))

  const logoRedimensionado = await sharp(LOGO)
    .resize(logoSize, logoSize, { fit: 'contain', background: BG })
    .flatten({ background: BG })
    .toBuffer()

  await sharp({
    create: { width: size, height: size, channels: 3, background: BG },
  })
    .composite([{ input: logoRedimensionado, gravity: 'center' }])
    .png()
    .toFile(path.join(OUT, nombre))

  console.log(`✓ ${nombre} (${size}x${size})`)
}

async function main() {
  // Íconos estándar: margen chico, el logo ocupa casi todo el cuadrado
  await icono('pwa-192x192.png', 192, 0.08)
  await icono('pwa-512x512.png', 512, 0.08)
  await icono('apple-touch-icon.png', 180, 0.1)
  await icono('favicon-96x96.png', 96, 0.08)
  // Maskable: el SO recorta a círculo/rounded-square — necesita más margen para no comerse
  // el logo (safe zone recomendada por la spec: ~80% del lienzo como máximo)
  await icono('maskable-icon-512x512.png', 512, 0.2)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

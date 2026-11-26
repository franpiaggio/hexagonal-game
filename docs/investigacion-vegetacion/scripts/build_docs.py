"""Fill species galleries, credits, contact sheets and measured palettes.

Usage: python3 -I build_docs.py <docs/investigacion-vegetacion>
"""
import json, pathlib, random, re, subprocess, sys, tempfile, shutil

ROOT = pathlib.Path(sys.argv[1])
IMG = ROOT / "imagenes"
credits = json.loads((IMG / "creditos.json").read_text())

# Images reviewed by eye and rejected: wrong species or garden specimens far from the region.
PRUNE = {
    "maiten": ["maytenus-boria"],  # Kerzenbaum (Parmentiera), not Maytenus
    "radal": ["desmaria"],  # parasite flower, not the radal itself
    "cipres-cordillera": ["jardin-des-plantes"],
}
for slug, files in PRUNE.items():
    for f in (IMG / slug).glob("*") if (IMG / slug).exists() else []:
        if any(p in f.name for p in files): f.unlink()
for slug in list(credits):
    credits[slug] = [c for c in credits[slug] if (IMG / slug / c["file"]).exists()]
(IMG / "creditos.json").write_text(json.dumps(credits, ensure_ascii=False, indent=2))

NAMES = {
    "coihue": "Coihue", "lenga": "Lenga", "nire": "Ñire", "roble-pellin": "Roble pellín", "rauli": "Raulí",
    "cipres-cordillera": "Ciprés de la cordillera", "araucaria": "Araucaria", "arrayan": "Arrayán",
    "maiten": "Maitén", "notro": "Notro", "radal": "Radal", "paisaje": "Paisajes de referencia",
    "acompanantes": "Especies acompañantes",
}

def credit_line(c, prefix):
    artist = c["artist"] or "autor sin datos legibles"
    lic = f"[{c['license']}]({c['license_url']})" if c.get("license_url") else c["license"]
    return f"{artist} · {lic} · [ficha en Commons]({c['page']})"

def sheet(slug, items):
    """Contact sheet of up to 12 images, 4 columns, using ffmpeg."""
    if not items: return None
    out = IMG / "hojas" / f"{slug}.jpg"; out.parent.mkdir(exist_ok=True)
    tmp = pathlib.Path(tempfile.mkdtemp())
    try:
        for i, c in enumerate(items[:12]):
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(IMG / slug / c["file"]), "-vf",
                            "scale=400:300:force_original_aspect_ratio=increase,crop=400:300", str(tmp / f"{i:02d}.jpg")], check=True)
        n = min(len(items), 12); cols = min(n, 4)
        inputs = []
        for i in range(n): inputs += ["-i", str(tmp / f"{i:02d}.jpg")]
        if n == 1:
            shutil.copy(tmp / "00.jpg", out); return out
        layout = "|".join(f"{(i % cols) * 406}_{(i // cols) * 306}" for i in range(n))
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *inputs, "-filter_complex",
                        f"xstack=inputs={n}:layout={layout}:fill=white", "-frames:v", "1", "-q:v", "3", str(out)], check=True)
    finally:
        shutil.rmtree(tmp)
    return out

def pixels(path, size=40):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(path), "-vf", f"scale={size}:{size}",
                          "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    return [tuple(raw[i:i + 3]) for i in range(0, len(raw), 3)]

def kmeans(px, k=6, iters=12):
    random.seed(1)
    centers = random.sample(px, k)
    for _ in range(iters):
        groups = [[] for _ in range(k)]
        for p in px:
            j = min(range(k), key=lambda j: sum((p[t] - centers[j][t]) ** 2 for t in range(3)))
            groups[j].append(p)
        centers = [tuple(sum(c[t] for c in g) / len(g) for t in range(3)) if g else centers[j] for j, g in enumerate(groups)]
    return sorted(((len(g), centers[j]) for j, g in enumerate(groups)), reverse=True)

def is_sky(c):
    r, g, b = c
    return (b > r + 15 and b > g and b > 120) or min(c) > 215

def hexc(c): return "#%02X%02X%02X" % tuple(int(round(v)) for v in c)

# 1. Galleries in species files
for md in sorted((ROOT / "especies").glob("*.md")):
    text = md.read_text()
    m = re.search(r"<!-- GALERIA:([a-z-]+) -->", text)
    if not m: continue
    slug = m.group(1); items = credits.get(slug, [])
    sh = sheet(slug, items)
    lines = [f"<!-- GALERIA:{slug} -->", ""]
    if not items:
        lines.append("No se descargaron imágenes con licencia libre para esta especie. Ver los enlaces a iNaturalist y Wikimedia Commons en Fuentes.")
    else:
        lines += [f"Imágenes de Wikimedia Commons con licencia libre, guardadas en [`imagenes/{slug}/`](../imagenes/{slug}/). "
                  "Las marcadas con 📍 fueron tomadas en Argentina o en la Patagonia según su descripción.", ""]
        if sh: lines += [f"![Hoja de contacto: {NAMES[slug]}](../imagenes/hojas/{slug}.jpg)", ""]
        for c in items:
            desc = (c["description"] or c["title"][5:]).replace("\n", " ").strip()
            desc = re.sub(r"\s+", " ", desc).replace("[", "(").replace("]", ")")[:180]
            pin = "📍 " if c["local_hint"] else ""
            lines += [f"![{desc}](../imagenes/{slug}/{c['file']})", "",
                      f"{pin}*{desc}*  ", credit_line(c, "../"), ""]
    lines.append("<!-- /GALERIA -->")
    block = "\n".join(lines)
    text = re.sub(r"<!-- GALERIA:[a-z-]+ -->.*?(<!-- /GALERIA -->|(?=\n## Fuentes))", block, text, flags=re.S)
    md.write_text(text)
    print("gallery", slug, len(items))

# 2. Galleries for landscapes and companions in a separate file
out = ["# Galería de paisajes y acompañantes", "",
       "Fotos reales de San Martín de los Andes, Bariloche y alrededores, y de las especies acompañantes. Todas son de Wikimedia Commons con licencia libre.", "",
       "[Volver al índice](README.md)", ""]
for slug in ("paisaje", "acompanantes"):
    items = credits.get(slug, [])
    sh = sheet(slug, items)
    out += [f"## {NAMES[slug]}", ""]
    if sh: out += [f"![Hoja de contacto: {NAMES[slug]}](imagenes/hojas/{slug}.jpg)", ""]
    for c in items:
        desc = re.sub(r"\s+", " ", (c["description"] or c["title"][5:])).replace("[", "(").replace("]", ")")[:180]
        out += [f"![{desc}](imagenes/{slug}/{c['file']})", "", f"*{desc}*  ", credit_line(c, ""), ""]
(ROOT / "galeria-paisajes.md").write_text("\n".join(out))

# 3. Credits
cr = ["# Créditos de las imágenes", "",
      "Todas las imágenes provienen de [Wikimedia Commons](https://commons.wikimedia.org/) y se descargaron en una versión reducida (1280 px de ancho). "
      "Las licencias CC BY y CC BY-SA exigen citar al autor y la licencia si se redistribuyen; CC BY-SA además exige compartir las obras derivadas con la misma licencia. "
      "Son material de referencia: no deben empaquetarse dentro del juego sin revisar su licencia.", "",
      "Los datos completos, incluida la descripción original, están en [`creditos.json`](creditos.json).", ""]
for slug, items in credits.items():
    if not items: continue
    cr += [f"## {NAMES.get(slug, slug)}", "", "| Archivo | Autor | Licencia | Fuente |", "| --- | --- | --- | --- |"]
    for c in items:
        artist = (c["artist"] or "sin datos").replace("|", "/")[:60]
        lic = f"[{c['license']}]({c['license_url']})" if c.get("license_url") else c["license"]
        cr.append(f"| [{c['file']}]({slug}/{c['file']}) | {artist} | {lic} | [Commons]({c['page']}) |")
    cr.append("")
(IMG / "CREDITOS.md").write_text("\n".join(cr))

# 4. Measured palettes
pal = ["# Paletas medidas en las fotografías", "",
       "Colores dominantes de cada grupo de fotos, obtenidos con k-means (6 grupos) sobre las imágenes reducidas a 40 × 40 px. "
       "Se descartan los tonos de cielo y los blancos. Son una medición cruda: mezclan follaje, suelo y fondo, así que sirven para calibrar la temperatura y la saturación, no como colores finales. "
       "Los colores elegidos a mano están en [generacion-de-assets.md](generacion-de-assets.md#3-paletas-de-referencia).", "",
       "[Volver al índice](README.md)", "",
       "| Grupo | Colores dominantes (de mayor a menor peso) |", "| --- | --- |"]
for slug, items in credits.items():
    if not items: continue
    px = []
    for c in items: px += pixels(IMG / slug / c["file"])
    clusters = [(n, c) for n, c in kmeans(px, 7) if not is_sky(c)][:6]
    total = sum(n for n, _ in clusters) or 1
    cells = " ".join(f"`{hexc(c)}` {round(100 * n / total)}%" for n, c in clusters)
    pal.append(f"| {NAMES.get(slug, slug)} | {cells} |")
    print("palette", slug)
(ROOT / "paletas.md").write_text("\n".join(pal) + "\n")

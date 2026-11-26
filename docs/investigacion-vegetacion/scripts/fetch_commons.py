"""Download freely licensed Wikimedia Commons images per species, with credits."""
import json, re, sys, time, urllib.parse, urllib.request, pathlib, html

OUT = pathlib.Path(sys.argv[1])
UA = "hexagonal-game-research/1.0 (personal research script)"
API = "https://commons.wikimedia.org/w/api.php"
PER = 7
LOC = re.compile(r"neuqu|lan[ií]n|l[aá]car|bariloche|nahuel|huapi|mart[ií]n de los andes|quetrihu|arrayanes|angostura|chapelco|lolog|ca[tl]edral|llao|tronador|alumin|moquehue|pehuenia|argentin|patagon", re.I)

SPECIES = {
    "roble-pellin": ["Nothofagus obliqua", "Nothofagus obliqua Lanín", "Nothofagus obliqua bark", "Nothofagus obliqua autumn"],
    "coihue": ["Nothofagus dombeyi", "Nothofagus dombeyi Nahuel Huapi", "Nothofagus dombeyi Bariloche", "Nothofagus dombeyi bark"],
    "rauli": ["Nothofagus alpina", "Nothofagus nervosa", "Nothofagus alpina autumn", "Nothofagus nervosa Lanín"],
    "cipres-cordillera": ["Austrocedrus chilensis", "Austrocedrus chilensis Bariloche", "Austrocedrus chilensis Neuquén", "Austrocedrus chilensis forest"],
    "maiten": ["Maytenus boaria", "Maytenus boaria tree", "Maytenus boaria Argentina"],
    "notro": ["Embothrium coccineum", "Embothrium coccineum Bariloche", "Embothrium coccineum flowers", "Embothrium coccineum Argentina"],
    "radal": ["Lomatia hirsuta", "Lomatia hirsuta Argentina", "Lomatia hirsuta flowers"],
    "nire": ["Nothofagus antarctica", "Nothofagus antarctica Argentina", "Nothofagus antarctica autumn", "Nothofagus antarctica Bariloche"],
    "lenga": ["Nothofagus pumilio", "Nothofagus pumilio Bariloche", "Nothofagus pumilio autumn", "Nothofagus pumilio Argentina", "lenga Chapelco"],
    "araucaria": ["Araucaria araucana", "Araucaria araucana Neuquén", "Araucaria araucana Lanín", "Araucaria araucana bark", "Araucaria araucana forest"],
    "arrayan": ["Luma apiculata", "Bosque de Arrayanes", "Luma apiculata bark", "Luma apiculata Quetrihué"],
    "paisaje": ["Lago Lácar", "Lago Lolog", "Chapelco", "Llao Llao bosque", "Puerto Blest", "Cerro Catedral Bariloche", "Lago Gutiérrez", "Isla Victoria Nahuel Huapi", "Cerro Otto Bariloche", "Lago Mascardi"],
    "acompanantes": ["Chusquea culeou", "Misodendrum", "Usnea patagonia", "Protousnea magellanica", "Cyttaria darwinii", "Aristotelia chilensis maqui", "Berberis microphylla calafate", "Fuchsia magellanica"],
}

EXCL = re.compile(r"meise|herbar|helsinki|kaisaniemi|ecuador|seeds|specimen|botanical garden|garden|jard[ií]n bot|arboretum|ireland|scotland|england|cornwall|new zealand|california|stamp|map|mapa", re.I)

def fetch(url, binary=False):
    for attempt in range(6):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read() if binary else json.load(r)
        except urllib.error.HTTPError as e:
            if e.code != 429: raise
            time.sleep(15 * (attempt + 1))
    raise RuntimeError("rate limited")

def get(params):
    params = {**params, "format": "json"}
    return fetch(API + "?" + urllib.parse.urlencode(params))

def strip(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()

def candidates(query):
    data = get({"action": "query", "generator": "search", "gsrsearch": f"{query} filetype:bitmap", "gsrnamespace": 6,
                "gsrlimit": 25, "prop": "imageinfo", "iiprop": "url|extmetadata|size|mime", "iiurlwidth": 1280})
    for page in (data.get("query", {}).get("pages", {}) or {}).values():
        info = (page.get("imageinfo") or [{}])[0]
        meta = info.get("extmetadata", {})
        lic = meta.get("LicenseShortName", {}).get("value", "")
        if not re.search(r"CC|Public domain|PD", lic, re.I): continue
        if info.get("mime") not in ("image/jpeg", "image/png"): continue
        if info.get("width", 0) < 800: continue
        if EXCL.search(page["title"] + " " + strip(meta.get("ImageDescription", {}).get("value", ""))[:300]): continue
        desc = strip(meta.get("ImageDescription", {}).get("value", ""))
        yield {"title": page["title"], "thumb": info.get("thumburl"), "page": info.get("descriptionurl"),
               "license": lic, "license_url": meta.get("LicenseUrl", {}).get("value", ""),
               "artist": strip(meta.get("Artist", {}).get("value", "")), "description": desc[:300],
               "local_hint": bool(LOC.search(page["title"] + " " + desc))}

def main():
    only = sys.argv[2:]
    cpath = OUT / "creditos.json"
    credits = json.loads(cpath.read_text()) if cpath.exists() else {}
    for slug, queries in SPECIES.items():
        if only and slug not in only: continue
        seen, pool, pool_by_query = set(), [], []
        for q in queries:
            try:
                for c in candidates(q):
                    if c["title"] not in seen:
                        seen.add(c["title"]); pool.append(c); pool_by_query.append((q, c))
            except Exception as e:
                print("search fail", q, e)
            time.sleep(3)
        genus = slug != "paisaje"
        # Prefer Argentine/local photos, keep variety by original order.
        pool.sort(key=lambda c: (not c["local_hint"]))
        if slug in ("paisaje", "acompanantes"):
            # one or two per query so every place/species is represented
            chosen, perq = [], {}
            for c in pool_by_query:
                if perq.get(c[0], 0) < 2: chosen.append(c[1]); perq[c[0]] = perq.get(c[0], 0) + 1
        else:
            chosen = pool[:PER]
        folder = OUT / slug; folder.mkdir(parents=True, exist_ok=True)
        credits[slug] = []
        for i, c in enumerate(chosen, 1):
            name = re.sub(r"[^a-z0-9]+", "-", c["title"][5:].rsplit(".", 1)[0].lower()).strip("-")[:60]
            ext = ".png" if c["thumb"].lower().endswith(".png") else ".jpg"
            dest = folder / f"{i:02d}-{name}{ext}"
            try:
                dest.write_bytes(fetch(c["thumb"], binary=True))
                c["file"] = dest.name; credits[slug].append(c)
                print(slug, dest.name, c["license"], "LOCAL" if c["local_hint"] else "")
            except Exception as e:
                print("download fail", c["title"], e)
            time.sleep(1.5)
        cpath.write_text(json.dumps(credits, ensure_ascii=False, indent=2))

main()

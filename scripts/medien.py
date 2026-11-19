"""Erstellt den statischen Medienkatalog für GitHub Pages. Aufruf: python3 scripts/medien.py"""
import json
import re
from threading import Lock
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / "media"
FOTOS = {".avif", ".webp", ".jpeg", ".jpg", ".png"}
FILME = {".mp4", ".webm", ".m4v"}
ORDNER = {"videos": FILME, "fotos-display": FOTOS, "fotos-galerie": FOTOS}


def sortierschluessel(datei):
    """Bei nummerierten Dateien kommt 2 vor 10."""
    return [int(teil) if teil.isdigit() else teil.casefold()
            for teil in re.split(r"(\d+)", datei.name)]


def webpfad(datei):
    return quote(datei.relative_to(ROOT).as_posix())


def einlesen(ordner, endungen):
    ergebnis = []
    for datei in sorted(ordner.iterdir(), key=sortierschluessel):
        if not datei.is_file() or datei.suffix.lower() not in endungen:
            continue
        name = re.sub(r"^\d+[\s_-]+", "", datei.stem)
        titel = name.replace("_", " ").replace("-", " ").strip() or datei.stem
        eintrag = {"src": webpfad(datei), "title": titel}
        if endungen == FILME:
            poster = datei.with_suffix(".jpg")
            if poster.is_file():
                eintrag["poster"] = webpfad(poster)
            untertitel = datei.with_suffix(".vtt")
            if untertitel.is_file():
                eintrag["captions"] = webpfad(untertitel)
        ergebnis.append(eintrag)
    return ergebnis


_schreibsperre = Lock()


def aktualisieren():
    katalog = {name: einlesen(MEDIA / name, endungen) for name, endungen in ORDNER.items()}
    daten = json.dumps(katalog, indent=2, ensure_ascii=False)
    ziel = MEDIA / "katalog.js"
    inhalt = ("// Generiert von scripts/medien.py. Eigene Angaben stehen in details.js.\n"
              + "window.PORTFOLIO_DATEIEN = " + daten + ";\n")
    with _schreibsperre:
        if ziel.exists() and ziel.read_text(encoding="utf-8") == inhalt:
            return
        zwischenstand = ziel.with_suffix(".tmp")
        zwischenstand.write_text(inhalt, encoding="utf-8")
        zwischenstand.replace(ziel)


if __name__ == "__main__":
    aktualisieren()

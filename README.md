# Alexander Ismailov · Film & Fotografie

Die Startseite liegt in `index.html`. HTML, CSS, JavaScript und Medien lassen sich direkt als statische Website über GitHub Pages veröffentlichen (Branch main, Ordner / (root), also das oberste Verzeichnis).

## Eigene Medien einsetzen

1. Lege Filmdateien in `media/videos/`, die ausgewählten Fotos in `media/fotos-display/` und weitere Bilder in `media/fotos-galerie/`.
2. Führe im Hauptordner `python3 scripts/medien.py` aus. Nach Hinzufügen, Umbenennen oder Löschen braucht der Katalog diesen Schritt erneut. Beim Austausch unter demselben Dateinamen genügt das Ersetzen der Datei.
3. Prüfe die Vorschau. Für GitHub Pages überträgst du die Medien **und** die aktualisierte `media/katalog.js` mit deinem nächsten Commit.

Filme: MP4 (H.264/AAC für Safari), WebM oder M4V. Fotos: JPG, PNG, WebP oder AVIF. Für ein Vorschaubild zu `01-Nordsee.mp4` lege `01-Nordsee.jpg` daneben, für deutsche Untertitel `01-Nordsee.vtt`. Die ersten drei Filme stehen direkt auf der Seite. Ab dem vierten erscheint „Weitere Filme zeigen“.

Dateinamen bestimmen Reihenfolge und Titel. `01-Zwischen-den-Wellen.mp4` steht vor `02-Nachtfahrt.mp4`. In `media/details.js` kannst du eine Kontaktadresse, individuelle Titel und beschreibende Alternativtexte setzen. Verwende eindeutige Dateinamen, wenn zwei Fotos unterschiedliche Beschreibungen brauchen. Sobald ein Ordner eigene Medien enthält, ersetzen sie die Beispiele dieser Sammlung. Die Quellen der sichtbaren Beispiele stehen im Seitenfuß.

## Lokal ansehen

Aus dem Projektordner:

```sh
python3 scripts/vorschau.py
```

Öffne http://127.0.0.1:8317/ in Safari. Die Vorschau aktualisiert den Katalog beim Neuladen automatisch und unterstützt Teilabrufe für Videos in Safari. Zum Beenden drücke im Terminal Control+C.

## Verhalten anpassen

- `app.js`: In `measureCrop` legt der Faktor 1.12 den zusätzlichen Anfangszoom fest. `changeFrame` steuert Ausschnitt, Originalformat und Vollbild. Escape oder „Verkleinern“ führt zum Ausschnitt zurück.
- `styles.css`: Die Abschnitte zum Videorahmen, zum versetzten Foto-Raster und zur Wischgalerie bestimmen Größen und Übergänge. Die Einstellung für reduzierte Bewegung wird berücksichtigt.
- `app.js`: `photoFigure` erzeugt die Bildunterschriften. Die Galerie verwendet natives horizontales Scrollen mit Einrastpunkten sowie Pfeilbuttons und Pfeiltasten.

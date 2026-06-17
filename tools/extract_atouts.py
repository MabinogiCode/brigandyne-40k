#!/usr/bin/env python3
"""Extrait du Livre Premier de Brigandyne :
- Spécialités (p.112-114) : « Nom +bonus description » → dict nom→desc.
- Talents (p.116-120) : pages sur 2 colonnes. On sort les LIGNES ordonnées
  colonne par colonne (gauche puis droite, de haut en bas). Le découpage en
  talents se fait côté JS par ancrage sur les noms connus (mêmes polices ici,
  impossible de distinguer en-têtes et corps autrement).

Sortie : tools/source/pdf/atouts.json = { specialties:{...}, talentLines:[...] }
"""
import fitz, json, re, os, io, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
PDF = r"C:/Perso/Brigandyne v2/brigandyne_2e_edition_livre_premier.pdf"
OUT = r"C:/Git-perso/brigandyne-40k/tools/source/pdf/atouts.json"
doc = fitz.open(PDF)

# ---------- Spécialités (pages 112-114) ----------
specialties = {}
spec_re = re.compile(r'^\s*(.+?)\s+(\+\d+|\(spécial\))\s+(.+\S)\s*$')
for pno in range(111, 114):
    for line in doc.load_page(pno).get_text("text", sort=True).split("\n"):
        m = spec_re.match(line)
        if not m:
            continue
        name = re.sub(r'^[^A-Za-zÀ-ÿ]+', '', m.group(1)).strip()   # retire puce/espaces en tête
        desc = m.group(3).strip()
        if 2 <= len(name) <= 40 and len(desc) > 6 and not name.lower().startswith(("spécialit", "aventures")):
            specialties[name] = re.sub(r'\s+', ' ', desc)

# ---------- Talents (pages 116-120) : lignes ordonnées par colonne ----------
SKIP = re.compile(r'^(Description des Talents|Atouts|PERSONNAGES|Aventures|B R I G|Florent|\d+\s*$)', re.I)
talent_lines = []
for pno in range(115, 120):
    page = doc.load_page(pno)
    mid = page.rect.width / 2
    rows = []  # (col, y, text)
    for blk in page.get_text("dict")["blocks"]:
        for ln in blk.get("lines", []):
            txt = " ".join(sp["text"] for sp in ln["spans"]).strip()
            if not txt or SKIP.match(txt):
                continue
            x0 = ln["bbox"][0]
            rows.append((0 if x0 < mid else 1, round(ln["bbox"][1]), re.sub(r'\s+', ' ', txt)))
    rows.sort(key=lambda r: (r[0], r[1]))
    talent_lines.extend(t for _, _, t in rows)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump({"specialties": specialties, "talentLines": talent_lines}, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"Spécialités : {len(specialties)} | Lignes talents : {len(talent_lines)}")
print("\n-- échantillon lignes talents --")
for l in talent_lines[:12]:
    print("  ", l[:75])

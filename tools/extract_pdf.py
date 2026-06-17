#!/usr/bin/env python3
"""Extraction texte des PDF Brigandyne 2e (Livre Premier / Second / Ecran MJ).

Sortie dans tools/source/pdf/ :
  - <slug>.txt        : texte par page avec marqueurs « ===== PAGE n =====»
  - <slug>.toc.txt    : sommaire (signets PDF) avec niveaux et pages
Utilise PyMuPDF (fitz) — rapide et robuste sur gros fichiers.
"""
import os
import sys
import fitz  # PyMuPDF

SRC = r"C:/Perso/Brigandyne v2"
OUT = r"C:/Git-perso/brigandyne-40k/tools/source/pdf"
FILES = [
    ("livre1", "brigandyne_2e_edition_livre_premier.pdf"),
    ("livre2", "brigandyne_2e_edition__livre_second.pdf"),
    ("ecran_mj", "ecran_du_meneur_de_jeu__precisions__brigandyne_2e_edition.pdf"),
]

os.makedirs(OUT, exist_ok=True)


def extract(slug, filename):
    path = os.path.join(SRC, filename)
    if not os.path.exists(path):
        print(f"[SKIP] introuvable: {path}", flush=True)
        return
    doc = fitz.open(path)
    n = doc.page_count
    print(f"[{slug}] {filename} — {n} pages", flush=True)

    # Sommaire (signets)
    toc = doc.get_toc(simple=True)
    with open(os.path.join(OUT, f"{slug}.toc.txt"), "w", encoding="utf-8") as f:
        if toc:
            for level, title, page in toc:
                f.write(f"{'  ' * (level - 1)}- {title}  (p.{page})\n")
        else:
            f.write("(aucun signet dans ce PDF)\n")

    # Texte par page
    out_path = os.path.join(OUT, f"{slug}.txt")
    with open(out_path, "w", encoding="utf-8") as f:
        for i in range(n):
            page = doc.load_page(i)
            # "text" = ordre de lecture par blocs ; sort=True pour ordre haut->bas / gauche->droite
            txt = page.get_text("text", sort=True)
            f.write(f"\n===== PAGE {i + 1} =====\n")
            f.write(txt.rstrip() + "\n")
            if (i + 1) % 25 == 0:
                print(f"  [{slug}] {i + 1}/{n}", flush=True)
    doc.close()
    size = os.path.getsize(out_path)
    print(f"[{slug}] OK -> {out_path} ({size // 1024} Ko)", flush=True)


if __name__ == "__main__":
    for slug, filename in FILES:
        try:
            extract(slug, filename)
        except Exception as e:  # noqa
            print(f"[ERREUR] {slug}: {e}", flush=True)
    print("=== EXTRACTION TERMINEE ===", flush=True)

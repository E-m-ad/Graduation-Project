from __future__ import annotations

import re
from pathlib import Path
from xml.sax.saxutils import escape

import arabic_reshaper
from bidi.algorithm import get_display
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, Preformatted, SimpleDocTemplate, Spacer


ROOT = Path(__file__).resolve().parents[2]
DOCS_DIR = ROOT / "docs" / "flutter-integration"
WINDOWS_FONTS = Path("C:/Windows/Fonts")


def register_fonts() -> tuple[str, str]:
    english_font_name = "Helvetica"
    arabic_font_name = "Helvetica"

    arial_path = WINDOWS_FONTS / "arial.ttf"
    tahoma_path = WINDOWS_FONTS / "tahoma.ttf"

    if arial_path.exists():
        pdfmetrics.registerFont(TTFont("Arial", str(arial_path)))
        english_font_name = "Arial"

    if tahoma_path.exists():
        pdfmetrics.registerFont(TTFont("Tahoma", str(tahoma_path)))
        arabic_font_name = "Tahoma"
    elif arial_path.exists():
        arabic_font_name = "Arial"

    return english_font_name, arabic_font_name


def contains_arabic(text: str) -> bool:
    return bool(re.search(r"[\u0600-\u06FF]", text))


def shape_arabic(text: str) -> str:
    reshaped = arabic_reshaper.reshape(text)
    return get_display(reshaped)


def is_numbered_line(line: str) -> bool:
    return bool(re.match(r"^\d+\.\s", line))


def build_styles(base_font: str, rtl: bool) -> dict[str, ParagraphStyle]:
    sample = getSampleStyleSheet()
    alignment = TA_RIGHT if rtl else TA_LEFT

    return {
        "title": ParagraphStyle(
            "title",
            parent=sample["Title"],
            fontName=base_font,
            fontSize=20,
            leading=26,
            alignment=alignment,
            spaceAfter=10,
        ),
        "h2": ParagraphStyle(
            "h2",
            parent=sample["Heading2"],
            fontName=base_font,
            fontSize=14,
            leading=20,
            alignment=alignment,
            spaceBefore=8,
            spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "body",
            parent=sample["BodyText"],
            fontName=base_font,
            fontSize=11,
            leading=16,
            alignment=alignment,
            spaceAfter=4,
        ),
        "bullet": ParagraphStyle(
            "bullet",
            parent=sample["BodyText"],
            fontName=base_font,
            fontSize=11,
            leading=16,
            alignment=alignment,
            leftIndent=12 if not rtl else 0,
            rightIndent=0 if not rtl else 12,
            spaceAfter=3,
        ),
        "number": ParagraphStyle(
            "number",
            parent=sample["BodyText"],
            fontName=base_font,
            fontSize=11,
            leading=16,
            alignment=alignment,
            leftIndent=12 if not rtl else 0,
            rightIndent=0 if not rtl else 12,
            spaceAfter=3,
        ),
        "code": ParagraphStyle(
            "code",
            parent=sample["Code"],
            fontName="Courier",
            fontSize=9,
            leading=12,
            alignment=TA_LEFT,
            backColor="#F3F4F6",
            borderPadding=6,
        ),
    }


def format_text(text: str, rtl: bool) -> str:
    normalized = shape_arabic(text) if rtl and contains_arabic(text) else text
    return escape(normalized)


def parse_markdown(markdown_text: str, styles: dict[str, ParagraphStyle], rtl: bool):
    story = []
    lines = markdown_text.splitlines()
    in_code_block = False
    code_lines: list[str] = []

    for raw_line in lines:
        line = raw_line.rstrip()

        if line.startswith("```"):
            if in_code_block:
                story.append(Preformatted("\n".join(code_lines), styles["code"]))
                story.append(Spacer(1, 0.25 * cm))
                code_lines = []
                in_code_block = False
            else:
                in_code_block = True
            continue

        if in_code_block:
            code_lines.append(line)
            continue

        if not line.strip():
            story.append(Spacer(1, 0.2 * cm))
            continue

        if line.startswith("# "):
            story.append(Paragraph(format_text(line[2:].strip(), rtl), styles["title"]))
            continue

        if line.startswith("## "):
            story.append(Paragraph(format_text(line[3:].strip(), rtl), styles["h2"]))
            continue

        if line.startswith("- "):
            bullet = "• " + line[2:].strip()
            story.append(Paragraph(format_text(bullet, rtl), styles["bullet"]))
            continue

        if is_numbered_line(line):
            story.append(Paragraph(format_text(line.strip(), rtl), styles["number"]))
            continue

        story.append(Paragraph(format_text(line.strip(), rtl), styles["body"]))

    return story


def build_pdf(markdown_path: Path, output_path: Path, rtl: bool, base_font: str) -> None:
    styles = build_styles(base_font=base_font, rtl=rtl)
    story = parse_markdown(markdown_path.read_text(encoding="utf-8"), styles, rtl)

    document = SimpleDocTemplate(
        str(output_path),
        pagesize=A4,
        leftMargin=1.8 * cm,
        rightMargin=1.8 * cm,
        topMargin=1.6 * cm,
        bottomMargin=1.6 * cm,
        title=markdown_path.stem,
    )
    document.build(story)


def main() -> None:
    english_font, arabic_font = register_fonts()

    build_pdf(
        markdown_path=DOCS_DIR / "flutter-backend-integration-en.md",
        output_path=DOCS_DIR / "flutter-backend-integration-en.pdf",
        rtl=False,
        base_font=english_font,
    )
    build_pdf(
        markdown_path=DOCS_DIR / "flutter-backend-integration-ar.md",
        output_path=DOCS_DIR / "flutter-backend-integration-ar.pdf",
        rtl=True,
        base_font=arabic_font,
    )


if __name__ == "__main__":
    main()

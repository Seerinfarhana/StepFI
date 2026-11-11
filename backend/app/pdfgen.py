from io import BytesIO
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
ST = getSampleStyleSheet()
def esc(s): return str(s).replace("&", "&amp;").replace("<", "&lt;").replace("₹", "Rs ")
def _build(story, title):
    b = BytesIO(); SimpleDocTemplate(b, pagesize=A4, leftMargin=40, rightMargin=40, topMargin=40, bottomMargin=40, title=title).build(story); return b.getvalue()
def _tbl(data, widths=None):
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#DDEFE9")), ("GRID", (0, 0), (-1, -1), .5, colors.HexColor("#CFDDD9")), ("FONTSIZE", (0, 0), (-1, -1), 9), ("VALIGN", (0, 0), (-1, -1), "TOP")])); return t
def form_pdf(title, rows, name):
    story = [Paragraph("StepFI", ST["Title"]), Paragraph(esc(title), ST["Heading2"]),
             Paragraph(f"Prepared for {esc(name)} on {datetime.now():%d %B %Y}. Prepared by StepFI from the details you gave. Check every detail before you sign.", ST["Normal"]), Spacer(1, 14),
             _tbl([["Field", "Details"]] + [[esc(k), Paragraph(esc(v), ST["Normal"])] for k, v in rows], [160, 350]), Spacer(1, 48),
             Table([["Signature:", "______________________", "Date:", "______________"]])]
    return _build(story, title)
def report_pdf(title, sections):
    story = [Paragraph("StepFI", ST["Title"]), Paragraph(esc(title), ST["Heading2"]), Paragraph(f"Generated on {datetime.now():%d %B %Y, %H:%M}", ST["Normal"]), Spacer(1, 12)]
    for kind, val in sections:
        if kind == "h": story += [Spacer(1, 10), Paragraph(esc(val), ST["Heading3"])]
        elif kind == "p": story.append(Paragraph(esc(val), ST["Normal"]))
        else: story += [_tbl([[esc(x) for x in r] for r in val]), Spacer(1, 6)]
    return _build(story, title)

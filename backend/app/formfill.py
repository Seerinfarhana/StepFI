"""Fill the customer's own uploaded form: Gemini finds the empty fields and their boxes, the customer types the values,
and we write them onto the original image (preview) and into a PDF (download)."""
import io, json, base64
from typing import Literal
from pydantic import BaseModel
from PIL import Image, ImageDraw, ImageFont, ImageOps
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.utils import ImageReader
class FField(BaseModel):
    label: str
    type: Literal["text", "comb", "date", "checkbox", "signature", "photo"] = "text"
    box_2d: list[int]
    cells: int = 0
    section: str = ""
    hint: str = ""
class FForm(BaseModel):
    title: str
    fields: list[FField]
PROMPT = """You are reading a photo or scan of a blank paper form from India (usually a bank form). List every item the customer has to fill in or tick, in reading order.
For each item give:
- label: the printed caption, in English as printed.
- section: the heading it sits under, or an empty string.
- type: text (a line or box to write in), comb (a row of separate small boxes, one character per box), date, checkbox (a small square to tick; make one field per option and put the option in the label, for example "Occupation: Salaried"), signature, or photo (space to stick a photograph).
- box_2d: [ymin, xmin, ymax, xmax] normalised to 0..1000 relative to the whole image, tightly around the EMPTY writing area only, not the caption. For a comb row, cover all the boxes.
- cells: for comb fields, the number of boxes in the row, otherwise 0.
Skip parts marked for bank use only, notes and instructions. Do not invent fields. Return JSON."""
def analyze(data, mime, key, model):
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=key)
    from . import gem
    cfg = types.GenerateContentConfig(response_mime_type="application/json", response_schema=FForm, max_output_tokens=8192)
    r = gem.call(lambda m: client.models.generate_content(model=m, contents=[types.Part.from_bytes(data=data, mime_type=mime), PROMPT], config=cfg), model)
    form = FForm.model_validate(json.loads(r.text)); fields = []
    for f in form.fields:
        if len(f.box_2d) != 4: continue
        y0, x0, y1, x1 = [max(0, min(1000, v)) for v in f.box_2d]
        if y1 <= y0 or x1 <= x0: continue
        d = f.model_dump(); d["box_2d"] = [y0, x0, y1, x1]; d["id"] = len(fields); fields.append(d)
    return form.title.strip() or "Form", fields
def ops(fields, values, dx=0, dy=0):
    out = []
    for f in fields:
        v = values.get(str(f["id"]))
        if v in (None, "", False): continue
        y0, x0, y1, x1 = f["box_2d"]; y0 += dy; y1 += dy; x0 += dx; x1 += dx; t = f["type"]
        if t == "checkbox": out.append(("mark", x0, y0, x1, y1, "X", 0))
        elif t == "comb" and f["cells"] > 0: out.append(("comb", x0, y0, x1, y1, str(v).upper()[:f["cells"]], f["cells"]))
        elif t in ("text", "date", "comb"): out.append(("text", x0, y0, x1, y1, str(v), 0))
    return out
def _img(data): return ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")
def _font(px):
    try: return ImageFont.load_default(size=px)
    except TypeError: return ImageFont.load_default()
INK = (10, 30, 120)
def preview_b64(data, op_list):
    im = _img(data); W, H = im.size; d = ImageDraw.Draw(im)
    for kind, x0, y0, x1, y1, text, cells in op_list:
        X0, X1, Y0, Y1 = x0 / 1000 * W, x1 / 1000 * W, y0 / 1000 * H, y1 / 1000 * H; bh = Y1 - Y0; base = Y1 - bh * 0.2
        if kind == "comb":
            cw = (X1 - X0) / cells; font = _font(int(max(6, min(bh * 0.7, cw * 0.9))))
            for i, ch in enumerate(text): d.text((X0 + cw * (i + .5), base), ch, font=font, fill=INK, anchor="ms")
        elif kind == "mark": d.text(((X0 + X1) / 2, (Y0 + Y1) / 2), "X", font=_font(int(max(8, bh * 0.9))), fill=INK, anchor="mm")
        else:
            px = int(max(6, min(bh * 0.75, 30))); font = _font(px)
            while px > 6 and d.textlength(text, font=font) > (X1 - X0): px -= 1; font = _font(px)
            d.text((X0 + 2, base), text, font=font, fill=INK, anchor="ls")
    buf = io.BytesIO(); im.save(buf, "JPEG", quality=85); return base64.b64encode(buf.getvalue()).decode()
def pdf_bytes(data, op_list, title="Form"):
    im = _img(data); W, H = im.size; pw, ph = landscape(A4) if W > H else A4; m = 18; s = min((pw - 2 * m) / W, (ph - 2 * m) / H)
    dw, dh = W * s, H * s; ox, oy = (pw - dw) / 2, (ph - dh) / 2
    jpg = io.BytesIO(); im.save(jpg, "JPEG", quality=90); jpg.seek(0)
    buf = io.BytesIO(); c = canvas.Canvas(buf, pagesize=(pw, ph)); c.setTitle(title); c.drawImage(ImageReader(jpg), ox, oy, dw, dh); c.setFillColorRGB(*[v / 255 for v in INK])
    X = lambda x: ox + x / 1000 * dw; Y = lambda y: oy + dh - y / 1000 * dh
    for kind, x0, y0, x1, y1, text, cells in op_list:
        bh = (y1 - y0) / 1000 * dh; bw = (x1 - x0) / 1000 * dw; base = Y(y1) + bh * 0.2
        if kind == "comb":
            cw = bw / cells; c.setFont("Helvetica", max(4, min(bh * 0.7, cw * 0.9)))
            for i, ch in enumerate(text): c.drawCentredString(X(x0) + cw * (i + .5), base, ch)
        elif kind == "mark": c.setFont("Helvetica-Bold", max(6, bh * 0.9)); c.drawCentredString((X(x0) + X(x1)) / 2, (Y(y0) + Y(y1)) / 2 - bh * 0.3, "X")
        else:
            size = max(4, min(bh * 0.75, 11))
            while size > 4 and c.stringWidth(text, "Helvetica", size) > bw: size -= .5
            c.setFont("Helvetica", size); c.drawString(X(x0) + 1, base, text)
    c.showPage(); c.save(); return buf.getvalue()

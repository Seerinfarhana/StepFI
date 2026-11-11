import os, json, base64
from . import rag, gem
from . import db as D
from .pdfgen import form_pdf
MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5-5")
def _forms(c): return [json.loads(r["data"]) for r in D.rows(c, "select data from form_templates")]
def _obj(props, req=()): return {"type": "object", "properties": props, "required": list(req)}
TOOLS = [
 {"name": "search_knowledge", "description": "Search the StepFI knowledge base of loans, services, eligibility, terms, documents and steps. Always use an English query, even if the customer wrote in another language.", "input_schema": _obj({"query": {"type": "string"}}, ["query"])},
 {"name": "get_account_summary", "description": "Get this customer's account type, balance, card status and account status.", "input_schema": _obj({})},
 {"name": "get_recent_transactions", "description": "Get this customer's recent transactions, including bank fees with their reason.", "input_schema": _obj({"limit": {"type": "integer"}})},
 {"name": "recommend_loans", "description": "List loans that match this customer's profile by age, type, study level and area.", "input_schema": _obj({})},
 {"name": "prepare_form", "description": "Create a downloadable PDF of a bank form once every required field is known. Returns the missing fields if any are absent. Write values in English.", "input_schema": _obj({"form_type": {"type": "string"}, "fields": {"type": "array", "items": {"type": "object", "properties": {"key": {"type": "string"}, "value": {"type": "string"}}, "required": ["key", "value"]}}}, ["form_type", "fields"])},
]
def run_tool(name, a, ctx):
    c, u = ctx["c"], ctx["user"]
    if name == "search_knowledge":
        hits = rag.search(a.get("query", ""), 4)
        if hits and not ctx.get("topic"): ctx["topic"] = hits[0]["topic"]
        return json.dumps([{k: h[k] for k in ("id", "type", "title", "text")} for h in hits]) if hits else "No matching knowledge found."
    if name == "get_account_summary":
        return json.dumps(D.row(c, "select account_type,balance,card_status,status,account_no from accounts where user_id=?", (u["id"],)) or {"note": "No bank account is linked to this profile yet."})
    if name == "get_recent_transactions":
        return json.dumps(D.rows(c, "select ts,direction,txn_type,category,amount,fee_reason from transactions where user_id=? order by ts desc limit ?", (u["id"], min(int(a.get("limit") or 10), 25))))
    if name == "recommend_loans":
        ls = [json.loads(r["data"]) for r in D.rows(c, "select data from loans")]
        ctx["topic"] = ctx.get("topic") or "loans"
        return json.dumps([{"id": l["id"], "name": l["name"], "summary": l["summary"]} for l in ls if D.loan_matches(l, ctx["profile"])])
    if name == "prepare_form":
        forms = _forms(c); tpl = next((f for f in forms if f["id"] == a.get("form_type")), None)
        if not tpl: return json.dumps({"error": "Unknown form type", "available": [f["id"] for f in forms]})
        raw = a.get("fields") or []
        if isinstance(raw, list): raw = {x.get("key"): x.get("value") for x in raw if isinstance(x, dict)}
        vals = {k: str(v).strip() for k, v in raw.items() if k and str(v).strip()}
        missing = [f["label"] for f in tpl["fields"] if f["required"] and f["key"] not in vals]
        if missing: return json.dumps({"status": "missing", "missing": missing})
        pdf = form_pdf(tpl["title"], [(f["label"], vals[f["key"]]) for f in tpl["fields"] if f["key"] in vals], u["name"])
        cur = c.execute("insert into forms(user_id,chat_id,form_type,data,pdf) values(?,?,?,?,?)", (u["id"], ctx["chat_id"], tpl["id"], json.dumps(sorted(vals)), pdf)); c.commit()
        ctx["form_id"] = cur.lastrowid; ctx["topic"] = ctx.get("topic") or "forms"
        return json.dumps({"status": "created", "form": tpl["title"], "note": "A download button is shown to the customer automatically. Tell them to print, sign and bring their documents."})
    return "Unknown tool"
def _system(ctx):
    p = ctx["profile"]; lang = next((l["name"] for l in D.load("languages.json") if l["code"] == ctx["lang"]), "English")
    forms = "; ".join(f"{f['id']}: " + ", ".join(("*" if x["required"] else "") + x["key"] for x in f["fields"]) for f in _forms(ctx["c"]))
    return f"""You are StepFI, a warm, patient banking assistant for customers in India. You are a full conversational assistant: you can chat normally, answer questions, and use tools when they help.
Reply in {lang} unless the customer writes in another language, then mirror their language and script. Customer: {ctx['user']['name']}, age {p.get('age')}, {p.get('user_type')}, {p.get('area')} area, account type {p.get('account_type')}, study level {p.get('study_level') or 'n/a'}. Simple mode is {p.get('simple_mode')}: if yes, use short sentences, everyday words, one step at a time, and a small example.
Rules:
1. For any question about loans, services, charges, documents or processes, call search_knowledge first (English query) and answer only from what it returns. Never invent rates, fees, limits or eligibility. If the knowledge base does not cover it, say so and suggest the branch or the bank helpline.
2. Use get_account_summary and get_recent_transactions only for this customer. To explain a charge, read fee_reason.
3. For loan suggestions call recommend_loans, then explain eligibility and terms from search_knowledge. State that figures are sample values and the bank decides.
4. Forms: you can prepare these forms (* means required): {forms}. If a photo is attached, read the form and its filled values, confirm anything unclear, ask for missing required fields one or two at a time, then call prepare_form with values written in English. After it succeeds, tell the customer to print, sign, and bring their documents.
5. Never invent or guess any detail. Use only what the customer typed or what is printed on their photo. If a value is missing, ask for it. Before calling prepare_form, read the values back and wait for the customer to confirm.
6. Safety: never ask for OTP, PIN, password, CVV or full card number. Ask for PAN or Aadhaar numbers only when a form needs them, and say they are used only to prepare the PDF. You cannot move money, block cards or change bank records, so explain how the customer can do it in the bank app or at the branch. For fraud or a lost card, tell them to contact the bank helpline at once.
7. You are not a financial advisor. Keep answers short and kind, with no exclamation marks."""
def _fallback(ctx, message, unavailable=False):
    hits = rag.search(message, 2); ctx["topic"] = hits[0]["topic"] if hits else "general"
    why = "The AI model is unavailable right now (check the API key and billing)." if unavailable else "The AI model is not connected on this server yet."
    if not hits: return f"{why} I also could not find this in the knowledge base. Try asking about a loan or a bank service.", None, "general"
    return f"{hits[0]['title']}\n{hits[0]['text'][:800]}\n\n({why} This is a direct knowledge base answer.)", None, ctx["topic"]
def respond(ctx, history, message, image):
    prov = os.getenv("LLM_PROVIDER", "gemini").lower()
    key = os.getenv("GEMINI_API_KEY") if prov == "gemini" else os.getenv("ANTHROPIC_API_KEY")
    if not key: return _fallback(ctx, message)
    try: return (_gemini if prov == "gemini" else _llm)(ctx, history, message, image, key)
    except Exception as e:
        print(f"[assistant] {prov} call failed:", str(e)[:400]); return _fallback(ctx, message, unavailable=True)
def _gemini(ctx, history, message, image, key):
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=key); model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
    contents = []
    def add(role, parts):
        if contents and contents[-1].role == role: contents[-1].parts.extend(parts)   # Gemini wants alternating roles
        else: contents.append(types.Content(role=role, parts=parts))
    for h in history:
        if h["text"].strip(): add("user" if h["role"] == "user" else "model", [types.Part.from_text(text=h["text"])])
    while contents and contents[0].role != "user": contents.pop(0)
    parts = []
    if image: parts.append(types.Part.from_bytes(data=image[1], mime_type=image[0]))
    parts.append(types.Part.from_text(text=message or "Please read this form and help me fill it."))
    add("user", parts)
    decls = []
    for t in TOOLS:
        d = {"name": t["name"], "description": t["description"]}
        if t["input_schema"]["properties"]: d["parameters"] = {k: v for k, v in t["input_schema"].items() if v or k == "properties"}
        decls.append(types.FunctionDeclaration(**d))
    cfg = types.GenerateContentConfig(system_instruction=_system(ctx), tools=[types.Tool(function_declarations=decls)], max_output_tokens=2048,
                                      automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True))
    for _ in range(6):
        r = gem.call(lambda m: client.models.generate_content(model=m, contents=contents, config=cfg), model)
        calls = r.function_calls or []
        if not calls: break
        contents.append(r.candidates[0].content)   # keep the model turn exactly as returned (Gemini 3 needs its thought signatures)
        contents.append(types.Content(role="user", parts=[types.Part.from_function_response(name=c.name, response={"result": run_tool(c.name, dict(c.args or {}), ctx)}) for c in calls]))
    text = (r.text or "").strip()
    return text or "I could not write an answer. Please try again.", ctx.get("form_id"), ctx.get("topic") or "general"
def _llm(ctx, history, message, image, key):
    import anthropic
    client = anthropic.Anthropic(api_key=key)
    msgs = [{"role": h["role"], "content": h["text"]} for h in history]
    while msgs and msgs[0]["role"] != "user": msgs.pop(0)
    content = []
    if image: content.append({"type": "image", "source": {"type": "base64", "media_type": image[0], "data": base64.b64encode(image[1]).decode()}})
    content.append({"type": "text", "text": message or "Please read this form and help me fill it."})
    msgs.append({"role": "user", "content": content}); system = _system(ctx)
    for _ in range(6):
        r = client.messages.create(model=MODEL, max_tokens=1500, system=system, tools=TOOLS, messages=msgs)
        if r.stop_reason != "tool_use": break
        msgs.append({"role": "assistant", "content": [b.model_dump(exclude_none=True) for b in r.content]})
        msgs.append({"role": "user", "content": [{"type": "tool_result", "tool_use_id": b.id, "content": run_tool(b.name, b.input, ctx)} for b in r.content if b.type == "tool_use"]})
    text = "".join(b.text for b in r.content if b.type == "text").strip()
    return text or "I could not write an answer. Please try again.", ctx.get("form_id"), ctx.get("topic") or "general"

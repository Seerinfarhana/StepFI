"""Call Gemini with retries and automatic fallback to other models when one is overloaded or has no free quota."""
import os, time
TRANSIENT = ("503", "unavailable", "overloaded", "high demand", "500", "internal", "deadline", "timed out", "429", "resource_exhausted")
def models(first=None):
    primary = first or os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
    fb = [m.strip() for m in os.getenv("GEMINI_FALLBACK_MODELS", "gemini-3.1-flash-lite,gemini-3.6-flash").split(",") if m.strip()]
    return [primary] + [m for m in fb if m != primary]
def is_transient(e): s = str(e).lower(); return any(k in s for k in TRANSIENT)
def call(run, first=None):
    """run(model) -> result. Retries busy errors twice, then tries the next model. Raises the last error if all fail."""
    last = None
    for model in models(first):
        for i in range(3):
            try: return run(model)
            except Exception as e:
                last = e; s = str(e).lower()
                if "not_found" in s or "404" in s or "limit: 0" in s: print(f"[gemini] {model} unavailable for this key ({str(e)[:60]}), trying the next model"); break
                if not is_transient(e): raise
                print(f"[gemini] {model} is busy, retry {i + 1}/3"); 
                if i < 2: time.sleep(3 * (i + 1))
    raise last

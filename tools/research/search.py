# Ищет записи на Wikimedia Commons по запросам из queries.json и дописывает candidates.json.
# Честно ждёт Retry-After; уже найденные ключи пропускает.  Запуск:  python tools/research/search.py
import json, os, re, sys, time, urllib.parse, urllib.request, urllib.error, html
HERE = os.path.dirname(os.path.abspath(__file__))
UA = "ClassicalQuizCatalogBuilder/0.1 (catalog build script; python-urllib)"
API = "https://commons.wikimedia.org/w/api.php"
def api(params):
    params = dict(params, format="json", formatversion="2")
    url = API + "?" + urllib.parse.urlencode(params)
    for attempt in range(12):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=40) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            wait = int(e.headers.get('retry-after') or 20) + 1
            time.sleep(min(wait, 90))
        except Exception as e:
            time.sleep(10)
    return {}
def strip(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", s or ""))).strip()
def search(q, limit=10):
    d = api({"action": "query", "generator": "search", "gsrnamespace": "6", "gsrlimit": str(limit),
             "gsrsearch": q + " filetype:audio", "prop": "videoinfo",
             "viprop": "url|size|mime|extmetadata"})
    out = []
    for p in sorted(d.get("query", {}).get("pages", []), key=lambda p: p.get("index", 99)):
        vi = (p.get("videoinfo") or [{}])[0]
        em = vi.get("extmetadata", {})
        out.append({"title": p["title"], "dur": vi.get("duration"), "size": vi.get("size"), "mime": vi.get("mime"),
                    "url": vi.get("url"), "page": vi.get("descriptionurl"),
                    "license": strip(em.get("LicenseShortName", {}).get("value")),
                    "artist": strip(em.get("Artist", {}).get("value"))[:160],
                    "credit": strip(em.get("Credit", {}).get("value"))[:120],
                    "desc": strip(em.get("ImageDescription", {}).get("value"))[:200]})
    return out
if __name__ == "__main__":
    qs = json.load(open(os.path.join(HERE, "queries.json"), encoding="utf-8"))
    path = os.path.join(HERE, "candidates.json")
    res = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}
    for k, q in qs.items():
        if res.get(k):
            continue
        res[k] = search(q)
        print(k, len(res[k]), flush=True)
        json.dump(res, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        time.sleep(0.5)

import asyncio, json, sys
from playwright.async_api import async_playwright
"""
Accessibility scan with axe-core (WCAG 2.0/2.1 A + AA + best practice) at desktop and phone widths.
Usage:  npm i --no-save axe-core && python3 scripts/a11y-audit.py /,/sign-in,/marketplace
Env:    BASE (default http://localhost:3301). Run against `next start`.
Signed-in screens need a session: log in once in the Playwright context (storage_state) before scanning them.
"""
import os
AXE=open(os.path.join(os.path.dirname(__file__),'..','node_modules','axe-core','axe.min.js')).read()
BASE=os.environ.get('BASE','http://localhost:3301')
pages=sys.argv[1].split(",")
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for name,w,h in [("desk",1366,900),("mob",390,844)]:
            ctx = await b.new_context(viewport={"width":w,"height":h})
            pg = await ctx.new_page()
            for path in pages:
                try: await pg.goto(BASE+path, wait_until="networkidle", timeout=30000)
                except Exception as e: print(path,"nav err"); continue
                await pg.add_script_tag(content=AXE)
                r = await pg.evaluate("axe.run(document,{runOnly:['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice']})")
                print(f"== {path} [{name}] violations={len(r['violations'])}")
                for v in r['violations']:
                    print("  -",v['impact'],v['id'],len(v['nodes']),"|",v['help'])
                    for n in v['nodes'][:2]: print("      ",n['target'],n['html'][:110].replace("\n"," "))
        await b.close()
asyncio.run(main())

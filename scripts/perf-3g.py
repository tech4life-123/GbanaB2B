"""
Throttled-network load check (needs: pip install playwright; a running `next start`).
Usage: python3 scripts/perf-3g.py http://localhost:3301 / /sign-in /marketplace
Profiles: Slow 3G (400 kbps, 400 ms RTT) and Fast 3G (1.6 Mbps, 150 ms RTT), cold cache, phone viewport.
Reports transferred KB, First Contentful Paint and Largest Contentful Paint.
"""
import asyncio, sys
from playwright.async_api import async_playwright

PROFILES = {
    "slow-3g": dict(offline=False, latency=400, downloadThroughput=400 * 1024 / 8, uploadThroughput=400 * 1024 / 8),
    "fast-3g": dict(offline=False, latency=150, downloadThroughput=1600 * 1024 / 8, uploadThroughput=750 * 1024 / 8),
}
OBSERVE = """() => new Promise(res => {
  const out = {fcp: null, lcp: null};
  new PerformanceObserver(l => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') out.fcp = e.startTime; }).observe({type: 'paint', buffered: true});
  new PerformanceObserver(l => { const e = l.getEntries().pop(); if (e) out.lcp = e.startTime; }).observe({type: 'largest-contentful-paint', buffered: true});
  setTimeout(() => res(out), 1500);
})"""

async def main():
    base, paths = sys.argv[1], sys.argv[2:] or ["/"]
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for pname, cond in PROFILES.items():
            for path in paths:
                ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True)
                pg = await ctx.new_page()
                cdp = await ctx.new_cdp_session(pg)
                await cdp.send("Network.enable")
                await cdp.send("Network.emulateNetworkConditions", cond)
                total = {"b": 0}
                cdp.on("Network.loadingFinished", lambda e: total.__setitem__("b", total["b"] + e.get("encodedDataLength", 0)))
                await pg.goto(base + path, wait_until="load", timeout=120000)
                m = await pg.evaluate(OBSERVE)
                print(f"{pname:8} {path:14} transfer={total['b']/1024:7.0f} KB  FCP={m['fcp'] and round(m['fcp']):>6} ms  LCP={m['lcp'] and round(m['lcp']):>6} ms")
                await ctx.close()
        await b.close()
asyncio.run(main())

import sys, numpy as np, warnings
warnings.simplefilter("ignore")
sys.path.insert(0, __file__.rsplit('/', 1)[0])
import vegcore, vegspec as V
d = vegcore.load(sys.argv[1])
for sq in vegcore.SQ:
    st = vegcore.scene_stats(d, sq)
    rec = dict(date=d["date"], clear=st["clear"], snow=st["snow"], ndvi=st["ndvi"], ndmi=st["ndmi"], nbr2=st["nbr2"], p10=st["ndvi_p10"], p90=st["ndvi_p90"])
    series = {y: V.build_year(rec, y) for y in range(2017, 2027)}
    mets = {y: V.metrics(series[y]) for y in series}
    print(f"\n=== {sq}  annual cropland: {V.is_annual_cropland(mets)}")
    for y in series:
        m = mets[y]
        b = V.baseline(series, mets, y)
        al = V.alerts(series, mets, y)
        print(y, f"{m['use'][:11]:11s} {m.get('group', '')[:11]:11s} pre {m['pre']:.2f} midmax {m['mid_max']:.2f} peak {m['peak']:.2f}@{m['peak_i']:2d} ngreen {m['n_green']:2d} integ {m['integral']:5.1f} bare {m['bare_days']:3d}d tilled {m['bare_tilled_days']:3d}d nbase {b['n'] if b else 0} |",
              "; ".join(f"{a[0]}:{a[1]} ({a[2]})" for a in al))

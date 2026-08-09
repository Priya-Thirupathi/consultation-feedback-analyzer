/**
 * Placeholders in the shape of the real results. A run takes 20s to minutes, so
 * the alternative is a blank column that only reports how long it has waited —
 * this shows what is coming and stops the layout jumping when it lands.
 */
export function ResultsSkeleton() {
  return (
    <div style={{ marginTop: 24 }} aria-hidden="true">
      <div className="kpis">
        {[0, 1, 2, 3].map((i) => (
          <div className="kpi" key={i}>
            <div className="skeleton" style={{ height: 40, width: 40, borderRadius: 999 }} />
            <div className="skeleton" style={{ height: 40, width: "45%", marginTop: 14 }} />
            <div className="skeleton skel-line" style={{ width: "70%" }} />
          </div>
        ))}
      </div>

      <div className="overview-grid">
        <div className="card">
          <div className="skeleton skel-line" style={{ width: 260, height: 16 }} />
          <div className="bars">
            {[100, 78, 64, 52, 40, 31].map((w, i) => (
              <div className="row" key={i}>
                <div className="skeleton skel-line" style={{ justifySelf: "end", width: "80%" }} />
                <div className="track">
                  <div className="skeleton" style={{ height: 20, width: `${w}%` }} />
                </div>
                <div className="skeleton skel-line" style={{ width: "80%" }} />
              </div>
            ))}
          </div>
        </div>

        <div className="lead">
          <div className="skeleton skel-line" style={{ width: "40%", height: 10 }} />
          <div className="skeleton" style={{ height: 28, width: "80%", marginTop: 10 }} />
          <div className="skeleton skel-line" style={{ width: "100%", marginTop: 18 }} />
          <div className="skeleton skel-line" style={{ width: "92%" }} />
          <div className="skeleton skel-line" style={{ width: "60%" }} />
        </div>
      </div>
    </div>
  );
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var firestore_1 = require("firebase/firestore");
var firebase_1 = require("../../firebase");
var SemifinalsAndFinal = function (_a) {
    var standings = _a.standings;
    var _b = (0, react_1.useState)({}), dates = _b[0], setDates = _b[1];
    (0, react_1.useEffect)(function () {
        var unsubscribe = (0, firestore_1.onSnapshot)((0, firestore_1.collection)(firebase_1.db, 'matchDates'), function (snapshot) {
            var data = {};
            snapshot.forEach(function (doc) { return data[doc.id] = doc.data(); });
            setDates(data);
        });
        return function () { return unsubscribe(); };
    }, []);
    if (standings.length < 4)
        return null;
    var s1 = standings[0], s2 = standings[1], s3 = standings[2], s4 = standings[3];
    var renderDate = function (id) {
        var match = dates[id];
        return match ? (<div className="text-xs text-muted text-center">
        {match.date}<br />{match.time}
      </div>) : null;
    };
    return (<div className="mt-10 relative p-6 bg-[var(--surface-3)] text-[var(--text)] rounded-xl shadow-soft overflow-x-auto">
      <h3 className="text-3xl font-bold text-center mb-12">Fase Eliminatoria</h3>
      <div className="relative w-full max-w-[1000px] mx-auto h-[450px] px-4 sm:px-6 lg:px-8 overflow-x-auto">
        {/* Bracket lines (SVG) */}
        <svg className="absolute top-0 left-0 w-full h-full z-0" viewBox="0 0 1000 450">
          {/* Semifinal Left */}
          <line x1="100" y1="75" x2="200" y2="75" stroke="var(--divider)" strokeWidth="3"/>
          <line x1="100" y1="325" x2="200" y2="325" stroke="var(--divider)" strokeWidth="3"/>
          <line x1="200" y1="75" x2="200" y2="200" stroke="var(--divider)" strokeWidth="3"/>
          <line x1="200" y1="325" x2="200" y2="200" stroke="var(--divider)" strokeWidth="3"/>
          <line x1="200" y1="200" x2="400" y2="200" stroke="var(--divider)" strokeWidth="3"/>
          {/* Semifinal Right */}
          <line x1="900" y1="75" x2="800" y2="75" stroke="var(--divider)" strokeWidth="3"/>
          <line x1="900" y1="325" x2="800" y2="325" stroke="var(--divider)" strokeWidth="3"/>
          <line x1="800" y1="75" x2="800" y2="200" stroke="var(--divider)" strokeWidth="3"/>
          <line x1="800" y1="325" x2="800" y2="200" stroke="var(--divider)" strokeWidth="3"/>
          <line x1="800" y1="200" x2="600" y2="200" stroke="var(--divider)" strokeWidth="3"/>
          {/* Final */}
          <line x1="400" y1="200" x2="460" y2="200" stroke="var(--brand-2)" strokeWidth="2" strokeDasharray="4 4"/>
          <line x1="600" y1="200" x2="540" y2="200" stroke="var(--brand-2)" strokeWidth="2" strokeDasharray="4 4"/>
        </svg>

        {/* Semifinal Left */}
        <div className="absolute top-[60px] left-[20px] z-10">
          <div className="card px-4 py-2 rounded-full font-semibold text-center text-[var(--text)]">
            {s1.team}
          </div>
          {renderDate('semifinal1')}
        </div>
        <div className="absolute bottom-[60px] left-[20px] z-10">
          <div className="card px-4 py-2 rounded-full font-semibold text-center text-[var(--text)]">
            {s4.team}
          </div>
          {renderDate('semifinal2')}
        </div>

        {/* Semifinal Right */}
        <div className="absolute top-[60px] right-[20px] z-10">
          <div className="card px-4 py-2 rounded-full font-semibold text-center text-[var(--text)]">
            {s2.team}
          </div>
          {renderDate('semifinal1')}
        </div>
        <div className="absolute bottom-[60px] right-[20px] z-10">
          <div className="card px-4 py-2 rounded-full font-semibold text-center text-[var(--text)]">
            {s3.team}
          </div>
          {renderDate('semifinal2')}
        </div>

        {/* Final */}
        <div className="absolute top-[170px] left-1/2 transform -translate-x-1/2 z-20">
          <div className="bg-[var(--brand)] text-[var(--text)] px-6 py-3 rounded-full shadow-soft text-center font-bold border border-[var(--brand-2)]">
            Ganador S1 vs S2
          </div>
          {renderDate('final')}
        </div>

        {/* Trofeo */}
        <div className="absolute top-[100px] left-1/2 transform -translate-x-1/2 z-0 opacity-50">
          🏆
        </div>

        {/* Tercer puesto */}
        <div className="absolute top-[370px] left-1/2 transform -translate-x-1/2 z-20">
          <div className="card px-6 py-2 rounded text-center">
            Perdedor S1 vs Perdedor S2
          </div>
          {renderDate('third')}
        </div>
      </div>
    </div>);
};
exports.default = SemifinalsAndFinal;

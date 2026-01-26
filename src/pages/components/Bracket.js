"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/components/Bracket.tsx
var react_1 = require("react");
var formatDate = function (iso) {
    var d = new Date(iso);
    var date = d.toLocaleDateString('en-US', { day: 'numeric', month: 'long' });
    var time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return "".concat(date, " \u2022 ").concat(time);
};
var Bracket = function (_a) {
    var semi1 = _a.semi1, semi2 = _a.semi2, third = _a.third, final = _a.final;
    return (<div className="grid grid-cols-3 gap-x-4 items-center my-8">
    {/* Semifinales */}
    <div className="flex flex-col gap-6">
      <div className="p-3 bg-white rounded shadow text-center">
        <div className="font-semibold">{semi1.teamA}</div>
        <div className="text-xs text-gray-500">{formatDate(semi1.date)}</div>
      </div>
      <div className="p-3 bg-white rounded shadow text-center">
        <div className="font-semibold">{semi1.teamB}</div>
        <div className="text-xs text-gray-500">{formatDate(semi1.date)}</div>
      </div>
    </div>

    {/* Conector izquierdo → final */}
    <div className="relative h-full">
      <div className="absolute w-1 bg-gray-300 top-1/4 bottom-1/4 left-0"></div>
      <div className="absolute w-1 bg-gray-300 top-1/4 left-0 right-1/2"></div>
    </div>

    {/* Final */}
    <div className="p-4 bg-yellow-500 rounded shadow text-center text-white">
      <div className="font-semibold">{final.teamA} vs {final.teamB}</div>
      <div className="text-xs">{formatDate(final.date)}</div>
    </div>

    {/* Conector derecho ← final */}
    <div className="relative h-full">
      <div className="absolute w-1 bg-gray-300 top-1/4 bottom-1/4 right-0"></div>
      <div className="absolute w-1 bg-gray-300 top-1/4 right-0 left-1/2"></div>
    </div>

    {/* Semifinales 2 */}
    <div className="flex flex-col gap-6">
      <div className="p-3 bg-white rounded shadow text-center">
        <div className="font-semibold">{semi2.teamA}</div>
        <div className="text-xs text-gray-500">{formatDate(semi2.date)}</div>
      </div>
      <div className="p-3 bg-white rounded shadow text-center">
        <div className="font-semibold">{semi2.teamB}</div>
        <div className="text-xs text-gray-500">{formatDate(semi2.date)}</div>
      </div>
    </div>

    {/* Tercer Puesto abajo */}
    <div className="col-span-3 mt-8">
      <h4 className="text-center font-semibold mb-2">Third Place</h4>
      <div className="p-4 bg-gray-800 text-white text-center rounded shadow">
        <div className="font-semibold">{third.teamA} vs {third.teamB}</div>
        <div className="text-xs">{formatDate(third.date)}</div>
      </div>
    </div>
  </div>);
};
exports.default = Bracket;

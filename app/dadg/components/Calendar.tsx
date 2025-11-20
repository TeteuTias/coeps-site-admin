"use client"
import { Dispatch, SetStateAction, useState } from "react";
import { ObjectId } from "bson";
//
//

function NumberComponent({ n, lastMonth = false, isToday = false }: { n: number, lastMonth?: boolean, isToday?: boolean }) {
  if (lastMonth) {
    // os meses passados ficam com a cor menos destacada
    return (
      <div className="bg-gray-700 p-1 text-gray-300 cursor-pointer">
        {n}
      </div>
    )
  }
  // os meses atuais ficam com a cor destacada
  return (
    <div className="relative bg-gray-200 p-1 text-gray-700 cursor-pointer">
      {
        isToday &&
        <div className="absolute inset-0 left-9 bottom-10 animate-pulse w-2 h-2 bg-red-800 z-10 rounded-full" />
      }
      {n}
    </div>
  )
}
function getCalendar(year: number, month: number): {
  day: number | null;
  reactComponent: JSX.Element;
}[] {
  // month: 0 = Janeiro, 11 = Dezembro

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const daysInMonth = lastDay.getDate();
  const startWeekDay = firstDay.getDay(); // 0 domingo → 6 sábado

  // Preencher o array final com os dias na ordem que aparecerão no calendário
  const weeks: Array<{ day: number | null, reactComponent: JSX.Element }> = [];

  // Espaços vazios antes do primeiro dia
  if (startWeekDay !== 0) {
    const lastDayPrevMonth = new Date(year, month, 0).getDate();
    // Começa no último dia anterior e vai voltando
    for (let i = startWeekDay - 1; i >= 0; i--) {
      weeks.push({ day: lastDayPrevMonth - i, reactComponent: <NumberComponent n={lastDayPrevMonth - i} lastMonth={true} /> });
    }
  }


  // Dias do mês
  const today = new Date().getDay()
  const monthAtual = new Date().getMonth()
  for (let day = 1; day <= daysInMonth; day++) {

    weeks.push({ day, reactComponent: <NumberComponent n={day} isToday={day === today && monthAtual === month} /> });
  }

  return weeks;
}
//
export default function Calendar({ month, year, setMonth, setYear }: { month: number, setMonth: Dispatch<SetStateAction<number>>, year: number, setYear: Dispatch<SetStateAction<number>> }) {
  const weeks = getCalendar(year, month);

  function nextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear(y => y + 1);
    } else {
      setMonth(m => m + 1);
    }
  }

  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear(y => y - 1);
    } else {
      setMonth(m => m - 1);
    }
  }

  return (
    <div className="min-w-[400px] min-h-[400px] bg-red-300 p-5 rounded-2xl">
      {/* Header do calendário */}
      <div className="flex justify-between items-center mb-4">
        <button onClick={prevMonth}>◀️</button>
        <h2 className="font-bold text-xl">
          {month + 1}/{year}
        </h2>
        <button onClick={nextMonth}>▶️</button>
      </div>

      {/* Dias da semana dessa bomba atômica */}
      <div className="grid grid-cols-7 gap-2 text-center font-semibold">
        <div>Dom</div>
        <div>Seg</div>
        <div>Ter</div>
        <div>Qua</div>
        <div>Qui</div>
        <div>Sex</div>
        <div>Sáb</div>
      </div>

      {/* Dias aaaa */}
      <div className="grid grid-cols-7 gap-2 text-center mt-2">
        {weeks.map((d, i) => (
          <>
            {d.reactComponent}
          </>
        ))}
      </div>
    </div>
  );
}

//
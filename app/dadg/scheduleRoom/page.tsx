'use client'
import { useState } from "react";
import Calendar from "../components/Calendar"
import { ObjectId } from "bson";
//
//
interface IScheduleRoom {
  _id: ObjectId,
  title: string,
  description: string,
  scheduler: {
    name: string,
    cpf: string,
    phone: string,
    notes?: string,
  },
  startTime: string;
  endTime: string;
  status: "pending" | "confirmed" | "canceled"
  cancellationReason?: {
    reason: string,
  }
}
//
//
export default function Page() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());


  const scheduleData: IScheduleRoom[] = [
    {
      _id: new ObjectId(),
      title: "Study Room 01",
      description: "Private room with AC and whiteboard",
      scheduler: {
        name: "Alice Johnson",
        cpf: "123.456.789-00",
        phone: "+55 11 99999-1234",
        notes: "Needs HDMI cable"
      },
      startTime: "2025-11-20T09:00:00.000Z",
      endTime: "2025-11-20T10:30:00.000Z",
      status: "confirmed",
    },
    {
      _id: new ObjectId(),
      title: "Meeting Room 02",
      description: "Medium-sized room for group discussions",
      scheduler: {
        name: "Brian Carter",
        cpf: "987.654.321-00",
        phone: "+55 21 98888-6543",
      },
      startTime: "2025-11-20T13:00:00.000Z",
      endTime: "2025-11-20T14:00:00.000Z",
      status: "pending",
    },
    {
      _id: new ObjectId(),
      title: "Conference Room A",
      description: "Large conference room with projector",
      scheduler: {
        name: "Carla Mendes",
        cpf: "456.789.123-00",
        phone: "+55 31 97777-8888",
        notes: "Will bring external monitor"
      },
      startTime: "2025-11-20T15:00:00.000Z",
      endTime: "2025-11-20T17:00:00.000Z",
      status: "canceled",
      cancellationReason: {
        reason: "Unexpected schedule conflict"
      }
    },
    {
      _id: new ObjectId(),
      title: "Workshop Area",
      description: "Open space for practical activities",
      scheduler: {
        name: "Daniel Roberts",
        cpf: "222.333.444-55",
        phone: "+55 47 96666-2222",
      },
      startTime: "2025-11-21T08:30:00.000Z",
      endTime: "2025-11-21T12:00:00.000Z",
      status: "confirmed",
    }
  ]


  return (
    <div className="w-full flex-row">
      <div className="w-full space-x-10 min-h-screen flex items-center content-center justify-center space-y-5" style={{
      }}>
        <div className="space-x-5">
          <button className="bg-red-500 px-2 py-1">
            Agenda Atual
          </button>
          <button className="bg-red-500 px-2 py-1">
            Adicionar Agendamento
          </button>
        </div>
        <div className="w-full flex flex-row justify-center space-x-5">
          <Calendar month={month} setMonth={setMonth} year={year} setYear={setYear} />
          <div className="min-w-[400px] min-h-[400px] max-w-[400px] max-h-[400px] bg-red-300 p-5 rounded-2xl overflow-auto">
            <h1 className="w-full text-center font-semibold">Agenda Atual</h1>
            <div className="w-full space-y-4">
              {
                scheduleData.length ?
                  scheduleData.map((element) => (
                    <div
                      className="w-full bg-white shadow-md p-4 rounded-xl border border-gray-100 hover:shadow-lg transition"
                    >
                      <h2 className="text-lg font-semibold text-gray-800">{element.title}</h2>
                      <p className="text-sm text-gray-500 mb-3">{element.description}</p>

                      <div className="text-sm space-y-1">
                        <p><span className="font-medium">Name:</span> {element.scheduler.name}</p>
                        <p><span className="font-medium">CPF:</span> {element.scheduler.cpf}</p>
                        <p><span className="font-medium">Phone:</span> {element.scheduler.phone}</p>

                        {element.scheduler.notes && (
                          <p><span className="font-medium">Notes:</span> {element.scheduler.notes}</p>
                        )}
                      </div>

                      <div className="mt-3 text-sm text-gray-600">
                        <p><span className="font-medium">Start:</span> {element.startTime}</p>
                        <p><span className="font-medium">End:</span> {element.endTime}</p>
                      </div>

                      {/* STATUS */}
                      <div className="mt-3 text-sm">
                        <p>
                          <span className="font-medium">Status:</span>{" "}
                          {element.status === "pending" && (
                            <span className="text-yellow-600">Pending</span>
                          )}
                          {element.status === "confirmed" && (
                            <span className="text-green-600">Confirmed</span>
                          )}
                          {element.status === "canceled" && (
                            <span className="text-red-600">Canceled</span>
                          )}
                        </p>

                        {element.status === "canceled" && element.cancellationReason?.reason && (
                          <p className="text-red-500 mt-1">
                            <span className="font-medium">Cancellation Reason:</span>{" "}
                            {element.cancellationReason.reason}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                  :
                  <div className="w-full text-center text-gray-500 py-4">
                    <p>Não há nenhum agendamento para esse dia</p>
                  </div>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}



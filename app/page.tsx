'use client'

import Link from "next/link";
//
//
//
// <Header />
export default function Page() {

  return (
    <>
      <div className="min-h-screen bg-[#3E4095] flex flex-col justify-center content-center items-center">
        <PaginaAreaDoCliente />
      </div>
    </>
  )
}
//
//
function PaginaAreaDoCliente() { // como é uma pagina, pega toda a tela para ele com w-[100%]
  return (
    <>
      <div className="flex flex-col items-center content-center  justify-center w-[100%] h-[100%] text-white">

        <div className="w-[80%] lg:w-fit">
          <h1 className="break-words text-center font-extrabold text-white text-[22px] lg:text-[35px]">Área do Administrador</h1>
        </div>
        <div className="flex flex-col items-center content-center justify-center lg:w-[65%] p-4 ">
          <div className="grid grid-cols-2 gap-x-10 gap-y-10 lg:grid-cols-3 lg:gap-2 lg:gap-x-10 lg:gap-y-10">
            <Link href="/trabalhos"><CardOpcoes texto="Lista de Trabalhos" emoji="📖" /></Link>
            <Link href="/listas"><CardOpcoes texto="Lista de Participantes" emoji="🖨️" /></Link>
            <Link href="/presenca"><CardOpcoes texto="Lista de Presença" emoji="🤚" /></Link>
          </div>
        </div>
      </div>
    </>
  )
}
//
function CardOpcoes({ texto, emoji }: { texto: string, emoji: string }) {
  return (
    <div className="flex flex-col w-32 h-32 lg:w-40 lg:h-32 items-center justify-center shadow-xl bg-white text-center p-2 cursor-pointer">
      <h1 className="text-center font-extralight text-[36px] lg:text-[40px] font-emoji text-gray-800">
        {emoji}
      </h1>
      <h1 className="text-center font-semibold text-slate-950 text-[16px] lg:text-[20px]">
        {texto}
      </h1>
    </div>
  )
}